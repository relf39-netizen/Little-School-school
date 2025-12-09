
import { Student, Question, Teacher, ExamResult, Assignment, SubjectConfig, School, RegistrationRequest, SchoolStats } from '../types'; 
import { supabase } from './firebaseConfig'; 

// Helper: Clean String
const cleanString = (str?: string) => str ? String(str).trim() : '';

// ---------------------------------------------------------------------------
// 🟢 UTILS & HELPERS
// ---------------------------------------------------------------------------

export const checkSchoolStatus = async (schoolName: string): Promise<boolean> => {
    if (!schoolName || schoolName === 'System') return true;
    try {
        const { data, error } = await supabase
            .from('schools')
            .select('status')
            .eq('name', schoolName)
            .maybeSingle();
            
        if (error || !data) return true; 
        return data.status !== 'inactive';
    } catch (e) {
        return true; 
    }
}

// ---------------------------------------------------------------------------
// 🟢 ANALYTICS & STATS
// ---------------------------------------------------------------------------

export const getAllSchoolStats = async (): Promise<SchoolStats[]> => {
    // ใน Supabase การทำ Aggregation แบบ Complex อาจต้องใช้ RPC หรือ View
    // เพื่อความง่ายใน Demo นี้ เราจะ Mock ค่าว่างไว้ก่อน หรือดึงข้อมูลดิบมานับ
    // (Recommended: สร้าง View ใน SQL แล้ว Select จาก View นั้น)
    return [];
};

// ---------------------------------------------------------------------------
// 🟢 DATA FETCHING
// ---------------------------------------------------------------------------

export const getQuestionsBySubject = async (subject: string): Promise<Question[]> => {
    try {
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .eq('subject', subject);
        
        if (error) throw error;

        return (data || []).map((q: any) => ({
            ...q,
            choices: typeof q.choices === 'string' ? JSON.parse(q.choices) : q.choices,
            correctChoiceId: q.correct_choice_id
        }));
    } catch (e) {
        console.error("Error fetching questions", e);
        return [];
    }
}

// ---------------------------------------------------------------------------
// 🟢 STUDENT LOGIN & DATA
// ---------------------------------------------------------------------------

export const verifyStudentLogin = async (studentId: string): Promise<{ student: Student | null, error?: string }> => {
    try {
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('id', studentId)
            .single();

        if (error || !data) return { student: null, error: 'ไม่พบข้อมูลรหัสนักเรียนนี้' };
            
        // Check School Status
        if (data.school) {
            const isActive = await checkSchoolStatus(data.school);
            if (!isActive) return { student: null, error: 'โรงเรียนถูกระงับการใช้งาน' };
        }

        const student: Student = { 
            ...data, 
            id: String(data.id),
            quizCount: data.quiz_count || 0,
            tokens: data.tokens || 0,
            level: data.level || 1,
            inventory: data.inventory || []
        };
        return { student };
    } catch (error) {
        console.error("Login failed:", error);
        return { student: null, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
};

export const getDataForStudent = async (student: Student): Promise<{
    questions: Question[],
    results: ExamResult[],
    assignments: Assignment[],
    subjects: SubjectConfig[]
}> => {
    try {
        const cleanSchool = cleanString(student.school);
        
        const [resultsRes, assignmentsRes, subjectsRes] = await Promise.all([
            supabase.from('exam_results').select('*').eq('student_id', student.id),
            supabase.from('assignments').select('*').eq('school', cleanSchool),
            supabase.from('subjects').select('*').eq('school', cleanSchool)
        ]);

        const results = (resultsRes.data || []).map((r: any) => ({
            ...r,
            studentId: r.student_id,
            totalQuestions: r.total_questions,
            assignmentId: r.assignment_id
        }));

        const assignments = (assignmentsRes.data || []).map((a: any) => ({
            ...a,
            questionCount: a.question_count,
            createdBy: a.created_by
        }));
        
        const subjects = (subjectsRes.data || []).map((s: any) => ({
            ...s,
            teacherId: s.teacher_id
        }));

        return { questions: [], results, assignments, subjects };

    } catch (error) {
        console.error("Error fetching student data:", error);
        return { questions: [], results: [], assignments: [], subjects: [] };
    }
};

// ---------------------------------------------------------------------------
// 🟢 SCHOOLS & SUBJECTS
// ---------------------------------------------------------------------------

export const getSchools = async (): Promise<School[]> => {
  const { data } = await supabase.from('schools').select('*');
  return data || [];
};

export const manageSchool = async (data: { action: 'add' | 'edit' | 'delete', name?: string, id?: string, status?: 'active' | 'inactive' }): Promise<boolean> => {
  try {
    if (data.action === 'add' && data.name) {
      const { error } = await supabase.from('schools').insert([{ id: Date.now().toString(), name: data.name, status: 'active' }]);
      return !error;
    } else if (data.action === 'edit' && data.id) {
      const { error } = await supabase.from('schools').update({ status: data.status }).eq('id', data.id);
      return !error;
    } else if (data.action === 'delete' && data.id) {
      const { error } = await supabase.from('schools').delete().eq('id', data.id);
      return !error;
    }
    return false;
  } catch { return false; }
};

export const getSubjects = async (school: string): Promise<SubjectConfig[]> => {
  const { data } = await supabase.from('subjects').select('*').eq('school', school);
  return (data || []).map((s: any) => ({ ...s, teacherId: s.teacher_id }));
};

export const addSubject = async (school: string, subject: SubjectConfig): Promise<boolean> => {
  const { error } = await supabase.from('subjects').insert([{
        id: subject.id,
        name: subject.name,
        school: school,
        teacher_id: subject.teacherId,
        grade: subject.grade,
        icon: subject.icon,
        color: subject.color
  }]);
  return !error;
};

export const deleteSubject = async (school: string, subjectId: string): Promise<boolean> => {
  const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
  return !error;
};

// ---------------------------------------------------------------------------
// 🟢 TEACHERS
// ---------------------------------------------------------------------------

export const teacherLogin = async (username: string, password: string): Promise<{success: boolean, teacher?: Teacher, message?: string}> => {
  try {
    const { data, error } = await supabase.from('teachers').select('*').eq('username', username).maybeSingle();
    
    if (data && data.password === password) {
          if(data.school && data.school !== 'System') {
             const isSchoolActive = await checkSchoolStatus(data.school);
             if(!isSchoolActive) {
                 return { success: false, message: 'โรงเรียนถูกระงับการใช้งาน' };
             }
          }
          const teacher: Teacher = { ...data, gradeLevel: data.grade_level };
          return { success: true, teacher };
    }
    return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  } catch { return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' }; }
};

export const getAllTeachers = async (): Promise<Teacher[]> => {
    const { data } = await supabase.from('teachers').select('*');
    return (data || []).map((t: any) => ({ ...t, gradeLevel: t.grade_level }));
};

export const manageTeacher = async (data: any): Promise<{success: boolean, message?: string}> => {
    try {
        if (data.action === 'add') {
             const { error } = await supabase.from('teachers').insert([{
                 id: Date.now().toString(),
                 name: data.name,
                 username: data.username,
                 password: data.password,
                 school: data.school,
                 role: data.role,
                 grade_level: data.gradeLevel
             }]);
             if (error) throw error;
        } else if (data.action === 'edit' && data.id) {
             const updateData: any = {};
             if (data.name) updateData.name = data.name;
             if (data.password) updateData.password = data.password;
             if (data.school) updateData.school = data.school;
             if (data.gradeLevel) updateData.grade_level = data.gradeLevel;
             if (data.role) updateData.role = data.role;
             await supabase.from('teachers').update(updateData).eq('id', data.id);
        } else if (data.action === 'delete' && data.id) {
             await supabase.from('teachers').delete().eq('id', data.id);
        }
        return { success: true };
    } catch (e: any) { return { success: false, message: e.message }; }
};

// ---------------------------------------------------------------------------
// 🟢 STUDENTS
// ---------------------------------------------------------------------------

export const manageStudent = async (data: any): Promise<{success: boolean, student?: Student, message?: string}> => {
  try {
    if (data.action === 'add') {
         let newId = Math.floor(10000 + Math.random() * 90000).toString();
         const newStudent = { 
             id: newId, 
             name: data.name!, 
             school: data.school, 
             avatar: data.avatar!, 
             stars: 0, 
             grade: data.grade, 
             teacher_id: data.teacherId,
             quiz_count: 0,
             tokens: 0,
             level: 1,
             inventory: [] 
         };
         const { error } = await supabase.from('students').insert([newStudent]);
         if (error) throw error;
         
         const studentRes: Student = { 
             ...newStudent,
             teacherId: newStudent.teacher_id,
             quizCount: newStudent.quiz_count
         };
         return { success: true, student: studentRes };
    } else if (data.action === 'edit' && data.id) {
         const updateData: any = {};
         if (data.name) updateData.name = data.name;
         if (data.avatar) updateData.avatar = data.avatar;
         if (data.grade) updateData.grade = data.grade;
         await supabase.from('students').update(updateData).eq('id', data.id);
         return { success: true };
    } else if (data.action === 'delete' && data.id) {
         await supabase.from('students').delete().eq('id', data.id);
         return { success: true };
    }
    return { success: false };
  } catch (e: any) { return { success: false, message: e.message }; }
};

// ---------------------------------------------------------------------------
// 🟢 TEACHER DASHBOARD
// ---------------------------------------------------------------------------

export const getTeacherDashboard = async (school: string) => {
  try {
    const cleanSchool = cleanString(school);
    const [studentsRes, resultsRes, assignmentsRes] = await Promise.all([
        supabase.from('students').select('*').eq('school', cleanSchool),
        supabase.from('exam_results').select('*').eq('school', cleanSchool),
        supabase.from('assignments').select('*').eq('school', cleanSchool)
    ]);

    const students = (studentsRes.data || []).map((s:any) => ({
        ...s, 
        quizCount: s.quiz_count, 
        teacherId: s.teacher_id 
    }));

    const results = (resultsRes.data || []).map((r:any) => ({
        ...r, 
        studentId: r.student_id, 
        totalQuestions: r.total_questions,
        assignmentId: r.assignment_id
    }));

    const assignments = (assignmentsRes.data || []).map((a:any) => ({
        ...a, 
        questionCount: a.question_count, 
        createdBy: a.created_by 
    }));

    return { students, results, assignments, questions: [] };
  } catch (e) { return { students: [], results: [], assignments: [], questions: [] }; }
}

// ---------------------------------------------------------------------------
// 🟢 QUESTIONS & ASSIGNMENTS
// ---------------------------------------------------------------------------

export const addQuestion = async (question: any): Promise<boolean> => {
  const { error } = await supabase.from('questions').insert([{
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        subject: question.subject,
        grade: question.grade,
        text: question.text,
        image: question.image || '',
        choices: [ { id: '1', text: question.c1 }, { id: '2', text: question.c2 }, { id: '3', text: question.c3 }, { id: '4', text: question.c4 } ],
        correct_choice_id: question.correct,
        explanation: question.explanation,
        school: question.school,
        teacher_id: question.teacherId
  }]);
  return !error;
};

export const editQuestion = async (question: any): Promise<boolean> => {
    if (!question.id) return false;
    const { error } = await supabase.from('questions').update({
        subject: question.subject,
        grade: question.grade,
        text: question.text,
        image: question.image || '',
        choices: [ { id: '1', text: question.c1 }, { id: '2', text: question.c2 }, { id: '3', text: question.c3 }, { id: '4', text: question.c4 } ],
        correct_choice_id: question.correct,
        explanation: question.explanation
    }).eq('id', question.id);
    return !error;
};

export const deleteQuestion = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  return !error;
};

export const addAssignment = async (school: string, subject: string, grade: string, questionCount: number, deadline: string, createdBy: string, title: string = ''): Promise<boolean> => {
    const { error } = await supabase.from('assignments').insert([{
        id: Date.now().toString(),
        school,
        subject,
        grade,
        question_count: questionCount,
        deadline,
        created_by: createdBy,
        title
    }]);
    return !error;
};

export const deleteAssignment = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  return !error;
};

// ---------------------------------------------------------------------------
// 🟢 SAVE SCORES
// ---------------------------------------------------------------------------

export const saveScore = async (
    studentId: string, 
    studentName: string, 
    school: string, 
    score: number, 
    total: number, 
    subject: string, 
    assignmentId?: string,
    updates?: Partial<Student>
) => {
  try {
    // 1. Insert Result (Only if not GAME_MODE for now, or you can decide to save game results too)
    if (subject !== 'GAME_MODE') {
        await supabase.from('exam_results').insert([{
            id: Date.now().toString(),
            student_id: studentId,
            student_name: studentName,
            school: school,
            score,
            total_questions: total,
            subject,
            assignment_id: assignmentId || '-',
            timestamp: Date.now()
        }]);
    }
    
    // 2. Fetch current student stats
    const { data: currentData } = await supabase.from('students').select('stars').eq('id', studentId).single();
    const currentStars = currentData?.stars || 0;

    // 3. Prepare update object
    const updatePayload: any = { stars: currentStars + score };
    
    if (updates) {
        if (updates.quizCount !== undefined) updatePayload.quiz_count = updates.quizCount;
        if (updates.tokens !== undefined) updatePayload.tokens = updates.tokens;
        if (updates.level !== undefined) updatePayload.level = updates.level;
        if (updates.inventory !== undefined) updatePayload.inventory = updates.inventory;
    }

    // 4. Update Student
    await supabase.from('students').update(updatePayload).eq('id', studentId);
    return true;

  } catch (e) { 
      console.error(e);
      return false; 
  }
}

// ---------------------------------------------------------------------------
// 🟢 MOCKED REGISTRATION FUNCTIONS (For compatibility)
// ---------------------------------------------------------------------------
export const getRegistrationStatus = async (): Promise<boolean> => true;
export const toggleRegistrationStatus = async (enabled: boolean): Promise<boolean> => true;
export const requestRegistration = async (citizenId: string, name: string, surname: string): Promise<{success: boolean, message: string}> => ({success: true, message: 'ระบบสมัครสมาชิกยังไม่เปิดใช้งานใน Demo'});
export const getPendingRegistrations = async (): Promise<RegistrationRequest[]> => [];
export const approveRegistration = async (req: RegistrationRequest, schoolName: string): Promise<boolean> => true;
export const rejectRegistration = async (reqId: string): Promise<boolean> => true;
