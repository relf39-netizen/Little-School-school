
import { Student, Question, Teacher, Subject, ExamResult, Assignment } from '../types'; 
import { MOCK_STUDENTS, MOCK_QUESTIONS } from '../constants';

// ---------------------------------------------------------------------------
// 🟢 Web App URL
// ---------------------------------------------------------------------------
const GOOGLE_SCRIPT_URL: string = 'https://script.google.com/macros/s/AKfycbyOuMciXdsRjnZRXXQRMPH349xYtcFfsTyYzm8B5ux_sdjWRnvhjxBTMEFYtK3pTM9-/exec'; 

export interface AppData {
  students: Student[];
  questions: Question[];
  results: ExamResult[];
  assignments: Assignment[];
}

// 🔄 ฟังก์ชันช่วยแปลงรหัสวิชา (สำคัญมาก)
const normalizeSubject = (rawSubject: string): Subject => {
  const s = String(rawSubject).trim().toUpperCase();
  if (s === 'MATH' || s === 'คณิตศาสตร์' || s === 'คณิต') return Subject.MATH;
  if (s === 'THAI' || s === 'ภาษาไทย' || s === 'ไทย') return Subject.THAI;
  if (s === 'SCIENCE' || s === 'วิทยาศาสตร์' || s === 'วิทย์') return Subject.SCIENCE;
  if (s === 'ENGLISH' || s === 'ภาษาอังกฤษ' || s === 'อังกฤษ') return Subject.ENGLISH;
  return Subject.MATH; 
};

export const teacherLogin = async (username: string, password: string): Promise<{success: boolean, teacher?: Teacher}> => {
  if (!GOOGLE_SCRIPT_URL) return { success: false };
  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=teacher_login&username=${username}&password=${password}`);
    const data = await response.json();
    return data;
  } catch (e) {
    console.error("Login error", e);
    return { success: false };
  }
};

// ✅ แก้ไขฟังก์ชันนี้: ให้แปลงข้อมูลข้อสอบให้ถูกต้องก่อนส่งกลับ
export const getTeacherDashboard = async (school: string) => {
  if (!GOOGLE_SCRIPT_URL) return { students: [], results: [], assignments: [], questions: [] };
  
  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=teacher_data&school=${school}`);
    const data = await response.json();

    // แปลงข้อมูลข้อสอบ (Questions) ให้ตรงกับระบบ App
    const cleanQuestions = (data.questions || []).map((q: any) => ({
      ...q,
      id: String(q.id).trim(),
      subject: normalizeSubject(q.subject), // ⚠️ แปลง MATH -> คณิตศาสตร์ ตรงนี้!
      choices: q.choices.map((c: any) => ({ ...c, id: String(c.id) })),
      correctChoiceId: String(q.correctChoiceId),
      grade: q.grade || 'ALL',
      school: q.school || 'CENTER' // รับค่าโรงเรียน
    }));

    return {
        ...data,
        questions: cleanQuestions // ส่งตัวที่แปลงแล้วกลับไป
    };
  } catch (e) {
    console.error("Dashboard error", e);
    return { students: [], results: [], assignments: [], questions: [] };
  }
}

export const addStudent = async (name: string, school: string, avatar: string, grade: string): Promise<Student | null> => {
  if (!GOOGLE_SCRIPT_URL) return null;
  try {
    const url = `${GOOGLE_SCRIPT_URL}?type=add_student&name=${encodeURIComponent(name)}&school=${encodeURIComponent(school)}&avatar=${encodeURIComponent(avatar)}&grade=${encodeURIComponent(grade)}`;
    const response = await fetch(url);
    return await response.json();
  } catch (e) {
    return null;
  }
};

export const addQuestion = async (question: any): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const params = new URLSearchParams({
      type: 'add_question',
      subject: question.subject,
      text: question.text,
      image: question.image || '',
      c1: question.c1, c2: question.c2, c3: question.c3, c4: question.c4,
      correct: question.correct,
      explanation: question.explanation,
      grade: question.grade,
      school: question.school || '' // ✅ ส่งชื่อโรงเรียนไปด้วย
    });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    return true;
  } catch (e) {
    return false;
  }
};

export const addAssignment = async (school: string, subject: string, questionCount: number, deadline: string, createdBy: string): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const url = `${GOOGLE_SCRIPT_URL}?type=add_assignment&school=${encodeURIComponent(school)}&subject=${encodeURIComponent(subject)}&questionCount=${questionCount}&deadline=${deadline}&createdBy=${encodeURIComponent(createdBy)}`;
    await fetch(url);
    return true;
  } catch (e) {
    return false;
  }
};

export const saveScore = async (studentId: string, studentName: string, school: string, score: number, total: number, subject: string, assignmentId?: string) => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const aidParam = assignmentId ? `&assignmentId=${encodeURIComponent(assignmentId)}` : '';
    const url = `${GOOGLE_SCRIPT_URL}?type=save_score&studentId=${studentId}&studentName=${encodeURIComponent(studentName)}&school=${encodeURIComponent(school)}&score=${score}&total=${total}&subject=${encodeURIComponent(subject)}${aidParam}`;
    await fetch(url);
    return true;
  } catch (e) {
    return false;
  }
}

export const fetchAppData = async (): Promise<AppData> => {
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === '') {
    return { students: MOCK_STUDENTS, questions: MOCK_QUESTIONS, results: [], assignments: [] };
  }
  try {
    const targetUrl = `${GOOGLE_SCRIPT_URL}?type=json`;
    const response = await fetch(targetUrl);
    const textData = await response.text();
    if (textData.trim().startsWith('<')) throw new Error('Invalid JSON response');
    const data = JSON.parse(textData);
    
    const cleanStudents = (data.students || []).map((s: any) => ({
      ...s, id: String(s.id).trim(), stars: Number(s.stars) || 0, grade: s.grade || 'P6'
    }));
    const cleanQuestions = (data.questions || []).map((q: any) => ({
      ...q, id: String(q.id).trim(), subject: normalizeSubject(q.subject),
      choices: q.choices.map((c: any) => ({ ...c, id: String(c.id) })),
      correctChoiceId: String(q.correctChoiceId),
      grade: q.grade || 'ALL',
      school: q.school // ✅ เพิ่มการรับค่าโรงเรียน
    }));
    const cleanResults = (data.results || []).map((r: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      studentId: String(r.studentId),
      subject: normalizeSubject(r.subject),
      score: Number(r.score),
      totalQuestions: Number(r.total),
      timestamp: new Date(r.timestamp).getTime(),
      assignmentId: r.assignmentId !== '-' ? r.assignmentId : undefined
    }));
    const cleanAssignments = (data.assignments || []).map((a: any) => ({
      id: String(a.id), school: String(a.school), subject: normalizeSubject(a.subject),
      questionCount: Number(a.questionCount), deadline: String(a.deadline).split('T')[0], createdBy: String(a.createdBy)
    }));

    return { students: cleanStudents, questions: cleanQuestions, results: cleanResults, assignments: cleanAssignments };
  } catch (error) {
    return { students: MOCK_STUDENTS, questions: MOCK_QUESTIONS, results: [], assignments: [] };
  }
};