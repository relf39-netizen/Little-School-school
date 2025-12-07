

import { Student, Question, Teacher, Subject, ExamResult, Assignment, SubjectConfig, School, RegistrationRequest, SchoolStats } from '../types'; 
import { db, firebase } from './firebaseConfig'; 

// Helper: Convert Firebase Object to Array
const snapshotToArray = <T>(snapshot: any): T[] => {
  if (!snapshot || !snapshot.val()) return [];
  const returnArr: T[] = [];
  snapshot.forEach((childSnapshot: any) => {
    const item = childSnapshot.val();
    item.id = childSnapshot.key; // Use Firebase Key as ID
    returnArr.push(item);
  });
  return returnArr;
};

// Helper: Clean String
const cleanString = (str?: string) => str ? String(str).trim() : '';

// ---------------------------------------------------------------------------
// 🟢 ANALYTICS & STATS TRACKING (NEW)
// ---------------------------------------------------------------------------

// Function to increment counters atomically (Performant)
export const trackSchoolActivity = async (school: string, type: 'login' | 'activity') => {
    if (!school || school === '-' || school === 'System') return;
    try {
        const cleanName = cleanString(school);
        const statsRef = db.ref(`school_stats/${cleanName}`);
        
        // Use transaction for atomic updates to prevent race conditions
        if (type === 'login') {
            await statsRef.child('loginCount').transaction((current) => (current || 0) + 1);
        } else if (type === 'activity') {
            await statsRef.child('activityCount').transaction((current) => (current || 0) + 1);
        }
        
        // Update last active timestamp
        await statsRef.child('lastActive').set(firebase.database.ServerValue.TIMESTAMP);
    } catch (e) {
        console.error("Tracking error (non-blocking):", e);
    }
};

export const getAllSchoolStats = async (): Promise<SchoolStats[]> => {
    try {
        const snapshot = await db.ref('school_stats').once('value');
        if (!snapshot.exists()) return [];
        
        const stats: SchoolStats[] = [];
        snapshot.forEach(child => {
            const val = child.val();
            stats.push({
                schoolName: child.key || 'Unknown',
                loginCount: val.loginCount || 0,
                activityCount: val.activityCount || 0,
                lastActive: val.lastActive || 0
            });
        });
        return stats.sort((a, b) => b.lastActive - a.lastActive); // Sort by most recently active
    } catch (e) {
        return [];
    }
};

// ---------------------------------------------------------------------------
// 🟢 LAZY LOAD QUESTIONS
// ---------------------------------------------------------------------------

export const getQuestionsBySubject = async (subject: string): Promise<Question[]> => {
    try {
        const snapshot = await db.ref('questions')
            .orderByChild('subject')
            .equalTo(subject)
            .once('value');
        
        const questions: Question[] = [];
        snapshot.forEach((child) => {
            const q = child.val();
            let choices = q.choices;
            if (choices && typeof choices === 'object' && !Array.isArray(choices)) {
                choices = Object.values(choices);
            }
            if (!Array.isArray(choices)) choices = [];
            questions.push({ ...q, id: child.key, choices, image: q.image || '' });
        });
        return questions;
    } catch (e) {
        console.error("Error fetching questions by subject", e);
        return [];
    }
}

// ---------------------------------------------------------------------------
// 🟢 STUDENT LOGIN & DATA
// ---------------------------------------------------------------------------

export const verifyStudentLogin = async (studentId: string): Promise<Student | null> => {
    try {
        const snapshot = await db.ref(`students/${studentId}`).once('value');
        if (snapshot.exists()) {
            const data = snapshot.val();
            // ✅ Track Login
            if (data.school) trackSchoolActivity(data.school, 'login');
            return { ...data, id: studentId };
        }
        return null;
    } catch (error) {
        console.error("Login verification failed:", error);
        return null;
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
        const [resultsSnap, assignmentsSnap, subjectsSnap] = await Promise.all([
            db.ref('results').orderByChild('studentId').equalTo(student.id).once('value'),
            db.ref('assignments').orderByChild('school').equalTo(cleanSchool).once('value'),
            db.ref(`subjects/${cleanSchool}`).once('value')
        ]);

        const results = snapshotToArray<ExamResult>(resultsSnap);
        const assignments = snapshotToArray<Assignment>(assignmentsSnap);
        
        // Lazy load: Return empty questions initially
        const questions: Question[] = [];

        let subjects: SubjectConfig[] = [];
        if (subjectsSnap.exists()) {
            const subData = subjectsSnap.val();
            subjects = Object.keys(subData).map(key => ({ ...subData[key], id: key }));
        }

        return { questions, results, assignments, subjects };

    } catch (error) {
        console.error("Error fetching student data:", error);
        return { questions: [], results: [], assignments: [], subjects: [] };
    }
};

// ---------------------------------------------------------------------------
// 🟢 SCHOOLS
// ---------------------------------------------------------------------------

export const getSchools = async (): Promise<School[]> => {
  try {
    const snapshot = await db.ref('schools').once('value');
    const schools = snapshotToArray<School>(snapshot);
    // Add legacy schools from teachers if missing
    const teachersSnap = await db.ref('teachers').once('value');
    const teachers = snapshotToArray<Teacher>(teachersSnap);
    const existingSchoolNames = new Set(schools.map(s => s.name));
    teachers.forEach(t => {
        const sName = cleanString(t.school);
        if (sName && sName !== 'System' && !existingSchoolNames.has(sName)) {
            schools.push({ id: `legacy_${sName}`, name: sName });
            existingSchoolNames.add(sName);
        }
    });
    return schools;
  } catch (e) {
    return [];
  }
};

export const manageSchool = async (data: { action: 'add' | 'delete', name?: string, id?: string }): Promise<boolean> => {
  try {
    if (data.action === 'add' && data.name) {
      const cleanName = cleanString(data.name);
      const existing = await db.ref('schools').orderByChild('name').equalTo(cleanName).once('value');
      if (existing.exists()) return false;
      const newRef = db.ref('schools').push();
      await newRef.set({ id: newRef.key, name: cleanName });
      return true;
    } else if (data.action === 'delete' && data.id) {
      if (!data.id.startsWith('legacy_')) await db.ref(`schools/${data.id}`).remove();
      return true;
    }
    return false;
  } catch (e) { return false; }
};

// ---------------------------------------------------------------------------
// 🟢 SUBJECTS
// ---------------------------------------------------------------------------

export const getSubjects = async (school: string): Promise<SubjectConfig[]> => {
  try {
    const cleanSchool = cleanString(school);
    const snapshot = await db.ref(`subjects/${cleanSchool}`).once('value');
    if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.keys(data).map(key => ({ ...data[key], id: key }));
    }
    return [];
  } catch (e) { return []; }
};

export const addSubject = async (school: string, subject: SubjectConfig): Promise<boolean> => {
  try {
    const cleanSchool = cleanString(school);
    const newRef = db.ref(`subjects/${cleanSchool}`).push();
    await newRef.set({ ...subject, id: newRef.key });
    return true;
  } catch (e) { return false; }
};

export const deleteSubject = async (school: string, subjectId: string): Promise<boolean> => {
  try {
    await db.ref(`subjects/${cleanString(school)}/${subjectId}`).remove();
    return true;
  } catch (e) { return false; }
};

// ---------------------------------------------------------------------------
// 🟢 TEACHERS
// ---------------------------------------------------------------------------

export const teacherLogin = async (username: string, password: string): Promise<{success: boolean, teacher?: Teacher}> => {
  try {
    const snapshot = await db.ref('teachers').orderByChild('username').equalTo(username).once('value');
    if (snapshot.exists()) {
      const teachers = snapshotToArray<Teacher>(snapshot);
      const teacher = teachers[0];
      if (teacher && teacher.password === password) {
          // ✅ Track Teacher Login
          if(teacher.school) trackSchoolActivity(teacher.school, 'login');
          return { success: true, teacher };
      }
    } else {
        if (username === 'admin' && password === '1234') {
             const newAdmin: Teacher = { id: 'admin_root', username: 'admin', password: '1234', name: 'Super Admin', school: 'System', role: 'ADMIN', gradeLevel: 'ALL' };
             await db.ref('teachers/admin_root').set(newAdmin);
             return { success: true, teacher: newAdmin };
        }
    }
    return { success: false };
  } catch (e) { return { success: false }; }
};

export const getAllTeachers = async (): Promise<Teacher[]> => {
  try {
    const snapshot = await db.ref('teachers').once('value');
    return snapshotToArray<Teacher>(snapshot);
  } catch (e) { return []; }
};

export const manageTeacher = async (data: { action: 'add' | 'delete' | 'edit', id?: string, username?: string, password?: string, name?: string, school?: string, role?: string, gradeLevel?: string }): Promise<{success: boolean, message?: string}> => {
    try {
        const cleanSchool = cleanString(data.school);
        if (data.action === 'add') {
             const newRef = db.ref('teachers').push();
             await newRef.set({ id: newRef.key, name: data.name, username: data.username, password: data.password, school: cleanSchool, role: data.role, gradeLevel: data.gradeLevel });
        } else if (data.action === 'edit' && data.id) {
             const updateData: any = {};
             if (data.name) updateData.name = data.name;
             if (data.password) updateData.password = data.password;
             if (data.school) updateData.school = cleanSchool;
             if (data.gradeLevel) updateData.gradeLevel = data.gradeLevel;
             if (data.role) updateData.role = data.role;
             await db.ref(`teachers/${data.id}`).update(updateData);
        } else if (data.action === 'delete' && data.id) {
             await db.ref(`teachers/${data.id}`).remove();
        }
        return { success: true };
    } catch (e) { return { success: false, message: 'Firebase Error' }; }
};

// ---------------------------------------------------------------------------
// 🟢 REGISTRATIONS
// ---------------------------------------------------------------------------

export const getRegistrationStatus = async (): Promise<boolean> => {
    try {
        const snap = await db.ref('system_settings/registration_enabled').once('value');
        return snap.val() === true;
    } catch (e) { return false; }
};

export const toggleRegistrationStatus = async (enabled: boolean): Promise<boolean> => {
    try {
        await db.ref('system_settings/registration_enabled').set(enabled);
        return true;
    } catch (e) { return false; }
};

export const requestRegistration = async (citizenId: string, name: string, surname: string): Promise<{success: boolean, message: string}> => {
    try {
        const isEnabled = await getRegistrationStatus();
        if (!isEnabled) return { success: false, message: 'ระบบปิดรับสมัครสมาชิกชั่วคราว' };
        const teacherSnap = await db.ref('teachers').orderByChild('username').equalTo(citizenId).once('value');
        if (teacherSnap.exists()) return { success: false, message: 'เลขบัตรประชาชนนี้มีในระบบแล้ว' };
        const newRef = db.ref('pending_registrations').push();
        await newRef.set({ id: newRef.key, citizenId, name, surname, timestamp: firebase.database.ServerValue.TIMESTAMP });
        return { success: true, message: 'ส่งคำขอสำเร็จ รอผู้ดูแลระบบอนุมัติ' };
    } catch (e) { return { success: false, message: 'เกิดข้อผิดพลาด' }; }
};

export const getPendingRegistrations = async (): Promise<RegistrationRequest[]> => {
    try {
        const snapshot = await db.ref('pending_registrations').once('value');
        return snapshotToArray<RegistrationRequest>(snapshot);
    } catch (e) { return []; }
};

export const approveRegistration = async (req: RegistrationRequest, schoolName: string): Promise<boolean> => {
    try {
        const cleanSchool = cleanString(schoolName);
        const newRef = db.ref('teachers').push();
        await newRef.set({ id: newRef.key, name: `${req.name} ${req.surname}`, username: req.citizenId, password: '123456', school: cleanSchool, role: 'TEACHER', gradeLevel: 'ALL', citizenId: req.citizenId });
        await db.ref(`pending_registrations/${req.id}`).remove();
        await manageSchool({ action: 'add', name: cleanSchool });
        return true;
    } catch (e) { return false; }
};

export const rejectRegistration = async (reqId: string): Promise<boolean> => {
    try { await db.ref(`pending_registrations/${reqId}`).remove(); return true; } catch (e) { return false; }
};

// ---------------------------------------------------------------------------
// 🟢 STUDENTS
// ---------------------------------------------------------------------------

export const manageStudent = async (data: { action: 'add' | 'edit' | 'delete', id?: string, name?: string, school?: string, avatar?: string, grade?: string, teacherId?: string }): Promise<{success: boolean, student?: Student, message?: string}> => {
  try {
    const cleanSchool = cleanString(data.school);
    if (data.action === 'add') {
         let newId = Math.floor(10000 + Math.random() * 90000).toString();
         const newStudent: Student = { id: newId, name: data.name!, school: cleanSchool, avatar: data.avatar!, stars: 0, grade: data.grade, teacherId: data.teacherId };
         await db.ref(`students/${newId}`).set(newStudent);
         return { success: true, student: newStudent };
    } else if (data.action === 'edit' && data.id) {
         const updateData: any = {};
         if (data.name) updateData.name = data.name;
         if (data.avatar) updateData.avatar = data.avatar;
         if (data.grade) updateData.grade = data.grade;
         await db.ref(`students/${data.id}`).update(updateData);
         return { success: true };
    } else if (data.action === 'delete' && data.id) {
         await db.ref(`students/${data.id}`).remove();
         return { success: true };
    }
    return { success: false };
  } catch (e) { return { success: false, message: 'Firebase Error' }; }
};

// Wrapper for simple adding (Compatibility)
export const addStudent = async (name: string, school: string, avatar: string): Promise<Student | null> => {
    const res = await manageStudent({ action: 'add', name, school, avatar, grade: 'P6', teacherId: '' });
    return res.student || null;
};

// ---------------------------------------------------------------------------
// 🟢 DASHBOARD DATA
// ---------------------------------------------------------------------------

export const getTeacherDashboard = async (school: string) => {
  try {
    const cleanSchool = cleanString(school);
    // Lazy Load: Do NOT load questions here
    const [studentsSnap, resultsSnap, assignmentsSnap] = await Promise.all([
        db.ref('students').orderByChild('school').equalTo(cleanSchool).once('value'),
        db.ref('results').orderByChild('school').equalTo(cleanSchool).once('value'),
        db.ref('assignments').orderByChild('school').equalTo(cleanSchool).once('value')
    ]);
    return { 
        students: snapshotToArray<Student>(studentsSnap), 
        results: snapshotToArray<ExamResult>(resultsSnap), 
        assignments: snapshotToArray<Assignment>(assignmentsSnap), 
        questions: [] 
    };
  } catch (e) { return { students: [], results: [], assignments: [], questions: [] }; }
}

// ---------------------------------------------------------------------------
// 🟢 QUESTIONS & ASSIGNMENTS
// ---------------------------------------------------------------------------

export const addQuestion = async (question: any): Promise<boolean> => {
  try {
    const newRef = db.ref('questions').push();
    await newRef.set({ ...question, id: newRef.key, school: cleanString(question.school), choices: [ { id: '1', text: question.c1 }, { id: '2', text: question.c2 }, { id: '3', text: question.c3 }, { id: '4', text: question.c4 } ], correctChoiceId: question.correct });
    return true;
  } catch (e) { return false; }
};

export const editQuestion = async (question: any): Promise<boolean> => {
  try {
    if (!question.id) return false;
    await db.ref(`questions/${question.id}`).update({ subject: question.subject, grade: question.grade, text: question.text, image: question.image || '', school: cleanString(question.school), choices: [ { id: '1', text: question.c1 }, { id: '2', text: question.c2 }, { id: '3', text: question.c3 }, { id: '4', text: question.c4 } ], correctChoiceId: question.correct, explanation: question.explanation });
    return true;
  } catch (e) { return false; }
};

export const deleteQuestion = async (id: string): Promise<boolean> => {
  try { await db.ref(`questions/${id}`).remove(); return true; } catch (e) { return false; }
};

export const addAssignment = async (school: string, subject: string, grade: string, questionCount: number, deadline: string, createdBy: string, title: string = ''): Promise<boolean> => {
  try {
    const newRef = db.ref('assignments').push();
    await newRef.set({ id: newRef.key, school: cleanString(school), subject, grade, questionCount, deadline, createdBy, title });
    return true;
  } catch (e) { return false; }
};

export const deleteAssignment = async (id: string): Promise<boolean> => {
  try { await db.ref(`assignments/${id}`).remove(); return true; } catch (e) { return false; }
};

export const saveScore = async (studentId: string, studentName: string, school: string, score: number, total: number, subject: string, assignmentId?: string) => {
  try {
    const newRef = db.ref('results').push();
    await newRef.set({ id: newRef.key, studentId, studentName, school: cleanString(school), score, totalQuestions: total, subject, assignmentId: assignmentId || '-', timestamp: firebase.database.ServerValue.TIMESTAMP });
    db.ref(`students/${studentId}`).child('stars').transaction((currentStars) => (currentStars || 0) + score);
    
    // ✅ Track Activity (Activity Count)
    trackSchoolActivity(school, 'activity');
    
    return true;
  } catch (e) { return false; }
}