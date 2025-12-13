
import { Student, Question, Teacher, Subject, ExamResult, Assignment, SubjectConfig, School, RegistrationRequest, SchoolStats } from '../types'; 
import { MOCK_STUDENTS, MOCK_QUESTIONS } from '../constants';
import { supabase } from './firebaseConfig';

export interface AppData {
  students: Student[];
  questions: Question[];
  results: ExamResult[];
  assignments: Assignment[];
  subjects: SubjectConfig[];
}

// 🔄 Helper to normalize subject
const normalizeSubject = (rawSubject: string): Subject => {
  const s = String(rawSubject).trim().toUpperCase();
  if (s === 'MATH' || s === 'คณิตศาสตร์' || s === 'คณิต') return 'คณิตศาสตร์';
  if (s === 'THAI' || s === 'ภาษาไทย' || s === 'ไทย') return 'ภาษาไทย';
  if (s === 'SCIENCE' || s === 'วิทยาศาสตร์' || s === 'วิทย์') return 'วิทยาศาสตร์';
  if (s === 'ENGLISH' || s === 'ภาษาอังกฤษ' || s === 'อังกฤษ') return 'ภาษาอังกฤษ';
  return rawSubject; // Return as is for dynamic subjects
};

// Login ครู
export const teacherLogin = async (username: string, password: string): Promise<{success: boolean, teacher?: Teacher, message?: string}> => {
  try {
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !data) return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
    
    // Check school status
    if (data.school) {
        const { data: school } = await supabase.from('schools').select('status').eq('name', data.school).single();
        if (school && school.status === 'inactive') {
            return { success: false, message: 'โรงเรียนถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
        }
    }

    // ✅ Map snake_case from DB to camelCase for App
    const teacher: Teacher = {
        ...data,
        gradeLevel: data.grade_level || data.gradeLevel, // Robust mapping
        citizenId: data.citizen_id || data.citizenId
    };

    return { success: true, teacher };
  } catch (e) {
    console.error("Login error", e);
    return { success: false, message: 'Connection Error' };
  }
};

// Verify Student Login
export const verifyStudentLogin = async (code: string): Promise<{student?: Student, error?: string}> => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', code)
      .single();
    
    if (error || !data) return { error: 'ไม่พบข้อมูลนักเรียน' };
    
    // Check school status
    if (data.school) {
        const { data: school } = await supabase.from('schools').select('status').eq('name', data.school).single();
        if (school && school.status === 'inactive') {
            return { error: 'โรงเรียนถูกระงับการใช้งาน' };
        }
    }

    // Map snake_case back to camelCase if needed
    const student: Student = {
        ...data,
        teacherId: data.teacher_id || data.teacherId,
        quizCount: data.quiz_count || data.quizCount
    };

    return { student };
  } catch (e) {
    return { error: 'Connection Error' };
  }
};

// Request Registration
export const requestRegistration = async (citizenId: string, name: string, surname: string): Promise<{success: boolean, message: string}> => {
    try {
        const { error } = await supabase.from('registration_requests').insert({
            citizen_id: citizenId, name, surname, timestamp: Date.now(), status: 'pending'
        });
        if (error) throw error;
        return { success: true, message: 'ส่งคำขอเรียบร้อย รอการอนุมัติ' };
    } catch (e) {
        return { success: false, message: 'เกิดข้อผิดพลาด หรือเลขบัตรนี้มีในระบบแล้ว' };
    }
};

// ดึงข้อมูล Dashboard ครู
export const getTeacherDashboard = async (school: string) => {
  try {
    const { data: students } = await supabase.from('students').select('*').eq('school', school);
    const { data: results } = await supabase.from('exam_results').select('*').eq('school', school);
    const { data: assignments } = await supabase.from('assignments').select('*').eq('school', school);

    // ✅ Map snake_case to camelCase Robustly
    const cleanStudents = (students || []).map((s: any) => ({
      ...s,
      teacherId: s.teacher_id || s.teacherId,
      quizCount: s.quiz_count || s.quizCount,
    }));

    const cleanResults = (results || []).map((r: any) => {
      // ✅ Handle assignmentId properly (avoid "null" string)
      const rawAid = r.assignment_id ?? r.assignmentId ?? r.AssignmentId;
      return {
        ...r,
        studentId: r.student_id || r.studentId,
        studentName: r.student_name || r.studentName,
        totalQuestions: r.total_questions || r.totalQuestions,
        assignmentId: (rawAid !== null && rawAid !== undefined && rawAid !== '') ? String(rawAid) : undefined
      };
    });

    const cleanAssignments = (assignments || []).map((a: any) => ({
      ...a,
      questionCount: a.question_count || a.questionCount,
      createdBy: a.created_by || a.createdBy,
    }));

    return { 
      students: cleanStudents, 
      results: cleanResults,
      assignments: cleanAssignments
    };
  } catch (e) {
    console.error("Get dashboard error", e);
    return { students: [], results: [], assignments: [] };
  }
}

// Manage Student
export const manageStudent = async (params: any): Promise<{success: boolean, student?: Student}> => {
    try {
        const dbPayload: any = {};
        if (params.name !== undefined) dbPayload.name = params.name;
        if (params.school !== undefined) dbPayload.school = params.school;
        if (params.avatar !== undefined) dbPayload.avatar = params.avatar;
        if (params.grade !== undefined) dbPayload.grade = params.grade;
        if (params.stars !== undefined) dbPayload.stars = params.stars;
        
        if (params.teacherId !== undefined) dbPayload.teacher_id = params.teacherId;
        if (params.quizCount !== undefined) dbPayload.quiz_count = params.quizCount;
        if (params.tokens !== undefined) dbPayload.tokens = params.tokens;
        if (params.level !== undefined) dbPayload.level = params.level;
        if (params.inventory !== undefined) dbPayload.inventory = params.inventory;

        if (params.action === 'add') {
             const id = Math.floor(10000 + Math.random() * 90000).toString();
             dbPayload.id = id;
             
             const { data, error } = await supabase.from('students').insert([dbPayload]).select().single();
             if (error) throw error;
             
             const newStudent: Student = {
                 ...data,
                 teacherId: data.teacher_id,
                 quizCount: data.quiz_count
             };
             return { success: true, student: newStudent };
        } else if (params.action === 'edit') {
             const { id } = params;
             const { error } = await supabase.from('students').update(dbPayload).eq('id', id);
             if (error) throw error;
             return { success: true };
        } else if (params.action === 'delete') {
             const { error } = await supabase.from('students').delete().eq('id', params.id);
             if (error) throw error;
             return { success: true };
        }
    } catch (e: any) {
        console.error("Manage student exception:", e);
    }
    return { success: false };
};

// Manage Teacher
export const manageTeacher = async (params: any): Promise<{success: boolean, message?: string}> => {
    try {
        const dbPayload: any = {};
        if (params.name) dbPayload.name = params.name;
        if (params.username) dbPayload.username = params.username;
        if (params.password) dbPayload.password = params.password;
        if (params.school) dbPayload.school = params.school;
        if (params.role) dbPayload.role = params.role;
        if (params.gradeLevel) dbPayload.grade_level = params.gradeLevel;
        if (params.citizenId) dbPayload.citizen_id = params.citizenId;

        if (params.action === 'add') {
             const { error } = await supabase.from('teachers').insert([dbPayload]);
             if (error) throw error;
        } else if (params.action === 'edit') {
             const { id } = params;
             const { error } = await supabase.from('teachers').update(dbPayload).eq('id', id);
             if (error) throw error;
        } else if (params.action === 'delete') {
             const { error } = await supabase.from('teachers').delete().eq('id', params.id);
             if (error) throw error;
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message || e.toString() };
    }
};

export const getAllTeachers = async (): Promise<Teacher[]> => {
    const { data } = await supabase.from('teachers').select('*');
    return (data || []).map((t: any) => ({
        ...t,
        gradeLevel: t.grade_level || t.gradeLevel,
        citizenId: t.citizen_id || t.citizenId
    }));
}

// Manage Schools
export const getSchools = async (): Promise<School[]> => {
    const { data } = await supabase.from('schools').select('*');
    return data || [];
};

export const manageSchool = async (params: any) => {
    if (params.action === 'add') await supabase.from('schools').insert([{ name: params.name, status: 'active' }]);
    if (params.action === 'edit') await supabase.from('schools').update({ status: params.status }).eq('id', params.id);
    if (params.action === 'delete') await supabase.from('schools').delete().eq('id', params.id);
};

// Registration Logic
export const getRegistrationStatus = async () => {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'registration_enabled').single();
    return data?.value === 'true';
};

export const toggleRegistrationStatus = async (enabled: boolean) => {
    await supabase.from('system_settings').upsert({ key: 'registration_enabled', value: String(enabled) });
};

export const getPendingRegistrations = async () => {
    const { data } = await supabase.from('registration_requests').select('*').eq('status', 'pending');
    return (data || []).map((d:any) => ({...d, citizenId: d.citizen_id}));
};

export const approveRegistration = async (req: RegistrationRequest, school: string) => {
    const { error } = await supabase.from('teachers').insert({
        username: req.citizenId,
        password: '123456',
        name: `${req.name} ${req.surname}`,
        school: school,
        role: 'TEACHER',
        grade_level: 'ALL'
    });
    
    if (!error) {
        await supabase.from('registration_requests').update({ status: 'approved' }).eq('id', req.id);
        return true;
    }
    return false;
};

export const rejectRegistration = async (id: string) => {
    await supabase.from('registration_requests').update({ status: 'rejected' }).eq('id', id);
};

// Questions & Assignments
export const addQuestion = async (q: any) => {
    const { error } = await supabase.from('questions').insert([{
        subject: q.subject,
        grade: q.grade,
        text: q.text,
        image: q.image,
        choices: JSON.stringify([
            { id: '1', text: q.c1 }, { id: '2', text: q.c2 }, { id: '3', text: q.c3 }, { id: '4', text: q.c4 }
        ]),
        correct_choice_id: q.correct,
        explanation: q.explanation,
        school: q.school,
        teacher_id: q.teacherId
    }]);
    return !error;
};

export const editQuestion = async (q: any) => {
    const { error } = await supabase.from('questions').update({
        subject: q.subject,
        grade: q.grade,
        text: q.text,
        image: q.image,
        choices: JSON.stringify([
            { id: '1', text: q.c1 }, { id: '2', text: q.c2 }, { id: '3', text: q.c3 }, { id: '4', text: q.c4 }
        ]),
        correct_choice_id: q.correct,
        explanation: q.explanation
    }).eq('id', q.id);
    return !error;
};

export const deleteQuestion = async (id: string) => {
    await supabase.from('questions').delete().eq('id', id);
};

export const getQuestionsBySubject = async (subject: string) => {
    const { data } = await supabase.from('questions').select('*').eq('subject', subject);
    return (data || []).map((q: any) => ({
      ...q, id: String(q.id),
      choices: typeof q.choices === 'string' ? JSON.parse(q.choices) : q.choices,
      correctChoiceId: String(q.correct_choice_id || q.correctChoiceId),
      teacherId: String(q.teacher_id || q.teacherId)
    }));
};

export const addAssignment = async (school: string, subject: string, grade: string, questionCount: number, deadline: string, createdBy: string, title?: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('assignments').insert([{
      school,
      subject,
      grade,
      question_count: questionCount,
      deadline,
      created_by: createdBy,
      title
    }]);
    return !error;
  } catch (e) {
    console.error("Add assignment error", e);
    return false;
  }
};

export const deleteAssignment = async (id: string) => {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    return !error;
};

// Subjects
export const getSubjects = async (school: string) => {
    const { data } = await supabase.from('subjects').select('*').eq('school', school);
    return (data || []).map((s:any) => ({...s, teacherId: s.teacher_id}));
};

export const addSubject = async (school: string, sub: SubjectConfig): Promise<{success: boolean, message?: string}> => {
    try {
        const { error } = await supabase.from('subjects').insert({
            id: sub.id, 
            name: sub.name, 
            school, 
            teacher_id: sub.teacherId, 
            grade: sub.grade, 
            icon: sub.icon, 
            color: sub.color
        });
        
        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message || e.toString() };
    }
};

export const deleteSubject = async (school: string, id: string) => {
    await supabase.from('subjects').delete().eq('id', id);
};

export const getAllSchoolStats = async (): Promise<SchoolStats[]> => {
    try {
        const { data: schools } = await supabase.from('schools').select('name, status');
        const stats: SchoolStats[] = [];
        
        if (schools) {
            for (const s of schools) {
                 const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school', s.name);
                 const { count: activityCount, data: lastActivity } = await supabase.from('exam_results').select('timestamp', { count: 'exact' }).eq('school', s.name).order('timestamp', { ascending: false }).limit(1);

                 stats.push({
                     schoolName: s.name,
                     loginCount: studentCount || 0,
                     activityCount: activityCount || 0,
                     lastActive: lastActivity && lastActivity[0] ? lastActivity[0].timestamp : 0
                 });
            }
        }
        return stats;
    } catch (e) {
        return [];
    }
};

// ✅ บันทึกคะแนนสอบ Robustly
export const saveScore = async (
    studentId: string, 
    studentName: string, 
    school: string, 
    score: number, 
    total: number, 
    subject: string, 
    assignmentId?: string,
    gamificationData?: { quizCount: number, tokens: number, level: number, inventory: string[] }
): Promise<{ success: boolean, error?: any }> => {
  try {
    // 🟢 Debug: Log what we are saving
    console.log(`[saveScore] Saving for ${studentName} (ID: ${studentId})`);
    console.log(`[saveScore] Assignment ID: "${assignmentId}" (Type: ${typeof assignmentId})`);

    // 1. Save Result (if not game mode only)
    if (subject !== 'GAME_MODE') {
        const payload: any = {
            student_id: studentId,
            student_name: studentName,
            school,
            score,
            total_questions: total,
            subject,
            timestamp: Date.now()
        };
        
        // Ensure assignmentId is added cleanly (snake_case)
        if (assignmentId && String(assignmentId).trim() !== '') {
            payload.assignment_id = String(assignmentId).trim();
        } else {
            // Explicitly set to null if missing, to be clear
            payload.assignment_id = null;
        }

        console.log("[saveScore] Payload:", payload);

        const { error } = await supabase.from('exam_results').insert([payload]);
        
        if (error) {
            console.error("Supabase Save Error:", error);
            return { success: false, error };
        }
    }

    // 2. Update Student Stats
    if (gamificationData) {
        const { data: s } = await supabase.from('students').select('stars').eq('id', studentId).single();
        const currentStars = s?.stars || 0;
        
        const { error: updateError } = await supabase.from('students').update({
            stars: currentStars + score,
            quiz_count: gamificationData.quizCount,
            tokens: gamificationData.tokens,
            level: gamificationData.level,
            inventory: gamificationData.inventory
        }).eq('id', studentId);

        if (updateError) console.warn("Gamification Update Error:", updateError);
    } else {
        const { data: s } = await supabase.from('students').select('stars').eq('id', studentId).single();
        const { error: updateError } = await supabase.from('students').update({ stars: (s?.stars || 0) + score }).eq('id', studentId);
        if (updateError) console.warn("Stars Update Error:", updateError);
    }
    
    return { success: true };
  } catch (e) {
    console.error("Save score exception:", e);
    return { success: false, error: e };
  }
}

// 🟢 Get Data For Student (Fixed for Missing History)
export const getDataForStudent = async (student: Student): Promise<{results: ExamResult[], assignments: Assignment[], subjects: SubjectConfig[]}> => {
    try {
        const school = student.school || '';
        
        // Fetch SPECIFIC student results, ordered by timestamp DESC
        // Note: Removing global limit and fetching all for this specific student
        // or setting a high limit enough for one person.
        const [res, assign, subs] = await Promise.all([
            supabase.from('exam_results')
                .select('*')
                .eq('student_id', student.id)
                .order('timestamp', { ascending: false })
                .limit(1000), // Get 1000 recent items for this student (much safer than global fetch)
            
            supabase.from('assignments')
                .select('*')
                .eq('school', school),
                
            supabase.from('subjects')
                .select('*')
                .eq('school', school)
        ]);
        
        // ✅ Robust Mapping: Handle snake_case and camelCase
        const cleanResults = (res.data || []).map((r: any) => {
            const rawAid = r.assignment_id ?? r.assignmentId;
            return {
                id: r.id,
                studentId: String(r.student_id || r.studentId || ''),
                subject: normalizeSubject(r.subject),
                score: Number(r.score),
                totalQuestions: Number(r.total_questions || r.totalQuestions),
                timestamp: Number(r.timestamp),
                assignmentId: (rawAid !== null && rawAid !== undefined && rawAid !== '') ? String(rawAid) : undefined
            };
        });

        const cleanAssignments = (assign.data || []).map((a: any) => ({
            id: String(a.id),
            school: String(a.school),
            subject: normalizeSubject(a.subject),
            grade: a.grade,
            questionCount: Number(a.question_count || a.questionCount),
            deadline: String(a.deadline),
            createdBy: String(a.created_by || a.createdBy),
            title: a.title
        }));
        
        const cleanSubjects = (subs.data || []).map((s:any) => ({
            ...s, teacherId: s.teacher_id
        }));

        return { results: cleanResults, assignments: cleanAssignments, subjects: cleanSubjects };
    } catch (e) {
        console.error("getDataForStudent error:", e);
        return { results: [], assignments: [], subjects: [] };
    }
};

// Global Fetch (Still needed for initial load or legacy)
export const fetchAppData = async (): Promise<AppData> => {
  try {
    const [studentsRes, questionsRes, resultsRes, assignmentsRes, subjectsRes] = await Promise.all([
      supabase.from('students').select('*'),
      supabase.from('questions').select('*'),
      // Limit global fetch to avoid timeouts, students use specific fetch now
      supabase.from('exam_results').select('*').order('timestamp', { ascending: false }).limit(2000), 
      supabase.from('assignments').select('*'),
      supabase.from('subjects').select('*')
    ]);

    // ✅ Robust Mapping
    const cleanStudents = (studentsRes.data || []).map((s: any) => ({
      ...s, 
      id: String(s.id).trim(), 
      stars: Number(s.stars) || 0,
      teacherId: s.teacher_id || s.teacherId, 
      quizCount: s.quiz_count || s.quizCount
    }));

    const cleanQuestions = (questionsRes.data || []).map((q: any) => ({
      ...q, id: String(q.id).trim(), subject: normalizeSubject(q.subject),
      choices: typeof q.choices === 'string' ? JSON.parse(q.choices) : q.choices,
      correctChoiceId: String(q.correct_choice_id || q.correctChoiceId),
      teacherId: String(q.teacher_id || q.teacherId)
    }));

    const cleanResults = (resultsRes.data || []).map((r: any) => {
        const rawAid = r.assignment_id ?? r.assignmentId ?? r.AssignmentId;
        return {
            id: r.id,
            studentId: String(r.student_id || r.studentId || ''),
            subject: normalizeSubject(r.subject),
            score: Number(r.score),
            totalQuestions: Number(r.total_questions || r.totalQuestions),
            timestamp: Number(r.timestamp),
            assignmentId: (rawAid !== null && rawAid !== undefined && rawAid !== '') ? String(rawAid) : undefined
        };
    });

    const cleanAssignments = (assignmentsRes.data || []).map((a: any) => ({
      id: String(a.id),
      school: String(a.school),
      subject: normalizeSubject(a.subject),
      grade: a.grade,
      questionCount: Number(a.question_count || a.questionCount),
      deadline: String(a.deadline),
      createdBy: String(a.created_by || a.createdBy),
      title: a.title
    }));
    
    const cleanSubjects = (subjectsRes.data || []).map((s:any) => ({
        ...s, teacherId: s.teacher_id || s.teacherId
    }));

    return {
      students: cleanStudents,
      questions: cleanQuestions,
      results: cleanResults,
      assignments: cleanAssignments,
      subjects: cleanSubjects
    };

  } catch (error) {
    console.error("Fetch error:", error);
    return { students: MOCK_STUDENTS, questions: MOCK_QUESTIONS, results: [], assignments: [], subjects: [] };
  }
};
