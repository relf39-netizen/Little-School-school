
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
        gradeLevel: data.grade_level,
        citizenId: data.citizen_id
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

    return { student: data as Student };
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

    // ✅ Map snake_case to camelCase
    const cleanStudents = (students || []).map((s: any) => ({
      ...s,
      teacherId: s.teacher_id,
      quizCount: s.quiz_count,
    }));

    const cleanResults = (results || []).map((r: any) => ({
      ...r,
      studentId: r.student_id,
      studentName: r.student_name,
      totalQuestions: r.total_questions,
      assignmentId: r.assignment_id,
    }));

    const cleanAssignments = (assignments || []).map((a: any) => ({
      ...a,
      questionCount: a.question_count,
      createdBy: a.created_by,
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
        if (params.action === 'add') {
             // Generate ID if not provided (simple 5 digit)
             const id = Math.floor(10000 + Math.random() * 90000).toString();
             const newStudent = { ...params, id };
             delete newStudent.action;
             
             const { data, error } = await supabase.from('students').insert([newStudent]).select().single();
             if (error) throw error;
             return { success: true, student: data as Student };
        } else if (params.action === 'edit') {
             const { id, ...updates } = params;
             delete updates.action;
             const { error } = await supabase.from('students').update(updates).eq('id', id);
             if (error) throw error;
             return { success: true };
        } else if (params.action === 'delete') {
             const { error } = await supabase.from('students').delete().eq('id', params.id);
             if (error) throw error;
             return { success: true };
        }
    } catch (e) {
        console.error(e);
    }
    return { success: false };
};

// Manage Teacher
export const manageTeacher = async (params: any): Promise<{success: boolean, message?: string}> => {
    try {
        // ✅ Create mapping payload manually to handle camelCase -> snake_case
        const dbPayload: any = {};
        if (params.name) dbPayload.name = params.name;
        if (params.username) dbPayload.username = params.username;
        if (params.password) dbPayload.password = params.password;
        if (params.school) dbPayload.school = params.school;
        if (params.role) dbPayload.role = params.role;
        // Fix: Map gradeLevel to grade_level
        if (params.gradeLevel) dbPayload.grade_level = params.gradeLevel;
        // Fix: Map citizenId to citizen_id
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
        console.error("Manage teacher error:", e);
        return { success: false, message: e.message || e.toString() };
    }
};

export const getAllTeachers = async (): Promise<Teacher[]> => {
    const { data } = await supabase.from('teachers').select('*');
    // ✅ Map snake_case to camelCase
    return (data || []).map((t: any) => ({
        ...t,
        gradeLevel: t.grade_level,
        citizenId: t.citizen_id
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
    // Create teacher account
    const { error } = await supabase.from('teachers').insert({
        username: req.citizenId, // Use Citizen ID as username
        password: '123456', // Default password
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
      correctChoiceId: String(q.correct_choice_id),
      teacherId: String(q.teacher_id)
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

export const addSubject = async (school: string, sub: SubjectConfig) => {
    const { error } = await supabase.from('subjects').insert({
        name: sub.name, school, teacher_id: sub.teacherId, grade: sub.grade, icon: sub.icon, color: sub.color
    });
    return !error;
};

export const deleteSubject = async (school: string, id: string) => {
    await supabase.from('subjects').delete().eq('id', id);
};

// ✅ Stats (Real Data)
export const getAllSchoolStats = async (): Promise<SchoolStats[]> => {
    try {
        const { data: schools } = await supabase.from('schools').select('name, status');
        const stats: SchoolStats[] = [];
        
        if (schools) {
            for (const s of schools) {
                 // Count students
                 const { count: studentCount } = await supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('school', s.name);

                 // Count activity (exam results)
                 const { count: activityCount, data: lastActivity } = await supabase
                    .from('exam_results')
                    .select('timestamp', { count: 'exact' })
                    .eq('school', s.name)
                    .order('timestamp', { ascending: false })
                    .limit(1);

                 stats.push({
                     schoolName: s.name,
                     loginCount: studentCount || 0,  // Using student count as proxy for potential users
                     activityCount: activityCount || 0,
                     lastActive: lastActivity && lastActivity[0] ? lastActivity[0].timestamp : 0
                 });
            }
        }
        return stats;
    } catch (e) {
        console.error("Error fetching school stats:", e);
        return [];
    }
};

// ✅ บันทึกคะแนนสอบ
export const saveScore = async (
    studentId: string, 
    studentName: string, 
    school: string, 
    score: number, 
    total: number, 
    subject: string, 
    assignmentId?: string,
    gamificationData?: { quizCount: number, tokens: number, level: number, inventory: string[] }
) => {
  try {
    // 1. Save Result (if not game mode only)
    if (subject !== 'GAME_MODE') {
        await supabase.from('exam_results').insert([{
            student_id: studentId,
            student_name: studentName,
            school,
            score,
            total_questions: total,
            subject,
            assignment_id: assignmentId,
            timestamp: Date.now()
        }]);
    }

    // 2. Update Student Stats & Gamification
    const updatePayload: any = { 
        // Need to fetch current stars first or use RPC for atomic increment. 
        // For simplicity here, we assume client passed updated state or we rely on gamificationData
    };

    // If gamification data provided, update it
    if (gamificationData) {
        // Also add score to stars
        const { data: s } = await supabase.from('students').select('stars').eq('id', studentId).single();
        const currentStars = s?.stars || 0;
        
        await supabase.from('students').update({
            stars: currentStars + score,
            quiz_count: gamificationData.quizCount,
            tokens: gamificationData.tokens,
            level: gamificationData.level,
            inventory: gamificationData.inventory
        }).eq('id', studentId);
    } else {
        // Just increment stars
        const { data: s } = await supabase.from('students').select('stars').eq('id', studentId).single();
        await supabase.from('students').update({ stars: (s?.stars || 0) + score }).eq('id', studentId);
    }
    
    return true;
  } catch (e) {
    console.error("Save score error", e);
    return false;
  }
}

// Get Data For Student
export const getDataForStudent = async (student: Student): Promise<{results: ExamResult[], assignments: Assignment[], subjects: SubjectConfig[]}> => {
    try {
        const school = student.school || '';
        const [res, assign, subs] = await Promise.all([
            supabase.from('exam_results').select('*').eq('student_id', student.id),
            supabase.from('assignments').select('*').eq('school', school),
            supabase.from('subjects').select('*').eq('school', school)
        ]);
        
        const cleanResults = (res.data || []).map((r: any) => ({
            id: r.id,
            studentId: String(r.student_id),
            subject: normalizeSubject(r.subject),
            score: Number(r.score),
            totalQuestions: Number(r.total_questions),
            timestamp: Number(r.timestamp),
            assignmentId: r.assignment_id
        }));

        const cleanAssignments = (assign.data || []).map((a: any) => ({
            id: String(a.id),
            school: String(a.school),
            subject: normalizeSubject(a.subject),
            grade: a.grade,
            questionCount: Number(a.question_count),
            deadline: String(a.deadline),
            createdBy: String(a.created_by),
            title: a.title
        }));
        
        const cleanSubjects = (subs.data || []).map((s:any) => ({
            ...s, teacherId: s.teacher_id
        }));

        return { results: cleanResults, assignments: cleanAssignments, subjects: cleanSubjects };
    } catch (e) {
        return { results: [], assignments: [], subjects: [] };
    }
};

export const fetchAppData = async (): Promise<AppData> => {
  try {
    const [studentsRes, questionsRes, resultsRes, assignmentsRes, subjectsRes] = await Promise.all([
      supabase.from('students').select('*'),
      supabase.from('questions').select('*'),
      supabase.from('exam_results').select('*'),
      supabase.from('assignments').select('*'),
      supabase.from('subjects').select('*')
    ]);

    const cleanStudents = (studentsRes.data || []).map((s: any) => ({
      ...s, id: String(s.id).trim(), stars: Number(s.stars) || 0
    }));

    const cleanQuestions = (questionsRes.data || []).map((q: any) => ({
      ...q, id: String(q.id).trim(), subject: normalizeSubject(q.subject),
      choices: typeof q.choices === 'string' ? JSON.parse(q.choices) : q.choices,
      correctChoiceId: String(q.correct_choice_id),
      teacherId: String(q.teacher_id)
    }));

    const cleanResults = (resultsRes.data || []).map((r: any) => ({
      id: r.id,
      studentId: String(r.student_id),
      subject: normalizeSubject(r.subject),
      score: Number(r.score),
      totalQuestions: Number(r.total_questions),
      timestamp: Number(r.timestamp),
      assignmentId: r.assignment_id
    }));

    const cleanAssignments = (assignmentsRes.data || []).map((a: any) => ({
      id: String(a.id),
      school: String(a.school),
      subject: normalizeSubject(a.subject),
      grade: a.grade,
      questionCount: Number(a.question_count),
      deadline: String(a.deadline),
      createdBy: String(a.created_by),
      title: a.title
    }));
    
    const cleanSubjects = (subjectsRes.data || []).map((s:any) => ({
        ...s, teacherId: s.teacher_id
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
