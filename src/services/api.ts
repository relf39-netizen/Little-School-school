
// services/api.ts

import { Student, Question, Teacher, Subject, ExamResult, Assignment, SubjectConfig, School, RegistrationRequest } from '../types'; 
import { MOCK_STUDENTS, MOCK_QUESTIONS } from '../constants';
import { db, firebase } from './firebaseConfig'; // Import Firebase DB

export interface AppData {
  students: Student[];
  questions: Question[];
  results: ExamResult[];
  assignments: Assignment[];
}

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

// Helper: Clean String (Remove Trailing Spaces)
const cleanString = (str?: string) => str ? String(str).trim() : '';

// 🔄 ฟังก์ชันช่วยแปลงรหัสวิชา (ถ้าจำเป็น)
const normalizeSubject = (rawSubject: string): Subject => {
  return String(rawSubject).trim();
};

// ---------------------------------------------------------------------------
// 🟢 SYSTEM INITIALIZATION (SEEDING)
// ---------------------------------------------------------------------------

const seedDatabase = async () => {
    console.log("🌱 Seeding database with initial data...");
    
    // 1. Seed Students
    const studentRef = db.ref('students');
    for (const s of MOCK_STUDENTS) {
        await studentRef.child(s.id).set({ ...s, stars: 0 });
    }

    // 2. Seed Questions
    const questionRef = db.ref('questions');
    for (const q of MOCK_QUESTIONS) {
        const newRef = questionRef.push();
        await newRef.set({ 
            ...q, 
            id: newRef.key,
            school: 'CENTER', // Default to center so everyone sees it
            grade: q.grade || 'P6'
        });
    }
};

// ---------------------------------------------------------------------------
// 🟢 SCHOOL MANAGEMENT (FIREBASE)
// ---------------------------------------------------------------------------

export const getSchools = async (): Promise<School[]> => {
  try {
    // 1. Get explicit schools
    const snapshot = await db.ref('schools').once('value');
    const schools = snapshotToArray<School>(snapshot);

    // 2. Get distinct schools from Teachers (Legacy support)
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
    console.error("Error fetching schools", e);
    return [];
  }
};

export const manageSchool = async (data: { action: 'add' | 'delete', name?: string, id?: string }): Promise<boolean> => {
  try {
    if (data.action === 'add' && data.name) {
      const cleanName = cleanString(data.name);
      // Check duplicate
      const existing = await db.ref('schools').orderByChild('name').equalTo(cleanName).once('value');
      if (existing.exists()) return false;

      const newRef = db.ref('schools').push();
      await newRef.set({ id: newRef.key, name: cleanName });
      return true;
    } else if (data.action === 'delete' && data.id) {
      if (!data.id.startsWith('legacy_')) {
          await db.ref(`schools/${data.id}`).remove();
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error("Manage school error", e);
    return false;
  }
};


// ---------------------------------------------------------------------------
// 🟢 SUBJECT MANAGEMENT (FIREBASE)
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
  } catch (e) {
    console.error("Error fetching subjects", e);
    return [];
  }
};

export const addSubject = async (school: string, subject: SubjectConfig): Promise<boolean> => {
  try {
    const cleanSchool = cleanString(school);
    const newRef = db.ref(`subjects/${cleanSchool}`).push();
    await newRef.set({ ...subject, id: newRef.key });
    return true;
  } catch (e) {
    console.error("Error adding subject", e);
    return false;
  }
};

export const deleteSubject = async (school: string, subjectId: string): Promise<boolean> => {
  try {
    const cleanSchool = cleanString(school);
    await db.ref(`subjects/${cleanSchool}/${subjectId}`).remove();
    return true;
  } catch (e) {
    console.error("Error deleting subject", e);
    return false;
  }
};

// ---------------------------------------------------------------------------
// 🟢 TEACHER MANAGEMENT (FIREBASE)
// ---------------------------------------------------------------------------

export const teacherLogin = async (username: string, password: string): Promise<{success: boolean, teacher?: Teacher}> => {
  try {
    // 1. Try to find the user in Firebase
    const snapshot = await db.ref('teachers')
                             .orderByChild('username')
                             .equalTo(username)
                             .once('value');
    
    if (snapshot.exists()) {
      const teachers = snapshotToArray<Teacher>(snapshot);
      const teacher = teachers[0];
      if (teacher && teacher.password === password) {
        return { success: true, teacher };
      }
    } else {
        // 2. 🚨 SPECIAL FALLBACK: If 'admin' doesn't exist, CREATE IT automatically
        if (username === 'admin' && password === '1234') {
             const newAdmin: Teacher = {
                 id: 'admin_root',
                 username: 'admin',
                 password: '1234',
                 name: 'Super Admin',
                 school: 'System', // System level
                 role: 'ADMIN',
                 gradeLevel: 'ALL'
             };
             await db.ref('teachers/admin_root').set(newAdmin);
             return { success: true, teacher: newAdmin };
        }
    }
    return { success: false };
  } catch (e) {
    console.error("Login error", e);
    return { success: false };
  }
};

export const getAllTeachers = async (): Promise<Teacher[]> => {
  try {
    const snapshot = await db.ref('teachers').once('value');
    return snapshotToArray<Teacher>(snapshot);
  } catch (e) {
    console.error("Get teachers error", e);
    return [];
  }
};

export const manageTeacher = async (data: { 
    action: 'add' | 'delete' | 'edit', 
    id?: string, 
    username?: string, 
    password?: string, 
    name?: string, 
    school?: string, 
    role?: string, 
    gradeLevel?: string 
}): Promise<{success: boolean, message?: string}> => {
    try {
        const cleanSchool = cleanString(data.school);
        if (data.action === 'add') {
             const newRef = db.ref('teachers').push();
             await newRef.set({
                 id: newRef.key,
                 name: data.name,
                 username: data.username,
                 password: data.password,
                 school: cleanSchool,
                 role: data.role,
                 gradeLevel: data.gradeLevel
             });
        } else if (data.action === 'edit' && data.id) {
             const updateData: any = {};
             if (data.name) updateData.name = data.name;
             if (data.password) updateData.password = data.password;
             if (data.school) updateData.school = cleanSchool;
             if (data.gradeLevel) updateData.gradeLevel = data.gradeLevel;
             await db.ref(`teachers/${data.id}`).update(updateData);
        } else if (data.action === 'delete' && data.id) {
             await db.ref(`teachers/${data.id}`).remove();
        }
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Firebase Error' };
    }
};

// ---------------------------------------------------------------------------
// 🟢 REGISTRATION SYSTEM (NEW)
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

        // Check if Teacher already exists
        const teacherSnap = await db.ref('teachers').orderByChild('username').equalTo(citizenId).once('value');
        if (teacherSnap.exists()) return { success: false, message: 'เลขบัตรประชาชนนี้มีในระบบแล้ว' };

        // Check pending
        const pendingSnap = await db.ref('pending_registrations').orderByChild('citizenId').equalTo(citizenId).once('value');
        if (pendingSnap.exists()) return { success: false, message: 'คุณได้ส่งคำขอไปแล้ว รอการอนุมัติ' };

        const newRef = db.ref('pending_registrations').push();
        await newRef.set({
            id: newRef.key,
            citizenId,
            name,
            surname,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

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
        
        // 1. Create Teacher (Auto password: '123456')
        const newRef = db.ref('teachers').push();
        await newRef.set({
            id: newRef.key,
            name: `${req.name} ${req.surname}`,
            username: req.citizenId, // Username is Citizen ID
            password: '123456', // Auto password
            school: cleanSchool,
            role: 'TEACHER',
            gradeLevel: 'ALL',
            citizenId: req.citizenId
        });

        // 2. Remove from pending
        await db.ref(`pending_registrations/${req.id}`).remove();
        
        // 3. Ensure school exists in schools list if not legacy
        await manageSchool({ action: 'add', name: cleanSchool });

        return true;
    } catch (e) { return false; }
};

export const rejectRegistration = async (reqId: string): Promise<boolean> => {
    try {
        await db.ref(`pending_registrations/${reqId}`).remove();
        return true;
    } catch (e) { return false; }
};

// ---------------------------------------------------------------------------
// 🟢 STUDENT MANAGEMENT (FIREBASE)
// ---------------------------------------------------------------------------

export const manageStudent = async (data: { action: 'add' | 'edit' | 'delete', id?: string, name?: string, school?: string, avatar?: string, grade?: string, teacherId?: string }): Promise<{success: boolean, student?: Student, message?: string}> => {
  try {
    const cleanSchool = cleanString(data.school);
    if (data.action === 'add') {
         let newId = Math.floor(10000 + Math.random() * 90000).toString();
         await db.ref(`students/${newId}`).set({
             id: newId,
             name: data.name,
             school: cleanSchool,
             avatar: data.avatar,
             grade: data.grade,
             teacherId: data.teacherId,
             stars: 0
         });
         const newStudent: Student = { 
             id: newId, name: data.name!, school: cleanSchool, avatar: data.avatar!, stars: 0, grade: data.grade, teacherId: data.teacherId 
         };
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
  } catch (e) {
    return { success: false, message: 'Firebase Error' };
  }
};

export const addStudent = async (name: string, school: string, avatar: string, grade: string = 'P6', teacherId?: string): Promise<Student | null> => {
  const result = await manageStudent({ action: 'add', name, school, avatar, grade, teacherId });
  if (result.success && result.student) return result.student;
  return null;
};

// ---------------------------------------------------------------------------
// 🟢 DASHBOARD DATA (FIREBASE)
// ---------------------------------------------------------------------------

export const getTeacherDashboard = async (school: string) => {
  try {
    const cleanSchool = cleanString(school);
    const [studentsSnap, resultsSnap, assignmentsSnap, questionsSnap] = await Promise.all([
        db.ref('students').orderByChild('school').equalTo(cleanSchool).once('value'),
        db.ref('results').orderByChild('school').equalTo(cleanSchool).once('value'),
        db.ref('assignments').orderByChild('school').equalTo(cleanSchool).once('value'),
        db.ref('questions').once('value') 
    ]);

    const students = snapshotToArray<Student>(studentsSnap);
    const results = snapshotToArray<ExamResult>(resultsSnap);
    const assignments = snapshotToArray<Assignment>(assignmentsSnap);
    
    // ✅ Use robust helper for questions array
    const questionsRaw = questionsSnap.val();
    const questions: Question[] = [];
    if (questionsRaw) {
        Object.keys(questionsRaw).forEach(k => {
            const q = questionsRaw[k];
            // Ensure choices is array
            let choices = q.choices;
            if (choices && typeof choices === 'object' && !Array.isArray(choices)) {
                choices = Object.values(choices);
            }
            if (!Array.isArray(choices)) choices = [];
            
            questions.push({ ...q, id: k, choices });
        });
    }

    const filteredQuestions = questions.filter(q => q.school === cleanSchool || q.school === 'CENTER' || q.school === 'Admin');

    return { 
        students: students, 
        results: results, 
        assignments: assignments, 
        questions: filteredQuestions 
    };
  } catch (e) {
    console.error(e);
    return { students: [], results: [], assignments: [], questions: [] };
  }
}

// ---------------------------------------------------------------------------
// 🟢 QUESTION MANAGEMENT (FIREBASE)
// ---------------------------------------------------------------------------

export const addQuestion = async (question: any): Promise<boolean> => {
  try {
    const newRef = db.ref('questions').push();
    await newRef.set({
      ...question,
      id: newRef.key,
      school: cleanString(question.school),
      choices: [
          { id: '1', text: question.c1 },
          { id: '2', text: question.c2 },
          { id: '3', text: question.c3 },
          { id: '4', text: question.c4 },
      ],
      correctChoiceId: question.correct
    });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const editQuestion = async (question: any): Promise<boolean> => {
  try {
    if (!question.id) return false;
    await db.ref(`questions/${question.id}`).update({
        subject: question.subject,
        grade: question.grade,
        text: question.text,
        image: question.image || '',
        school: cleanString(question.school),
        choices: [
            { id: '1', text: question.c1 },
            { id: '2', text: question.c2 },
            { id: '3', text: question.c3 },
            { id: '4', text: question.c4 },
        ],
        correctChoiceId: question.correct,
        explanation: question.explanation
    });
    return true;
  } catch (e) {
    return false;
  }
};

export const deleteQuestion = async (id: string): Promise<boolean> => {
  try {
    await db.ref(`questions/${id}`).remove();
    return true;
  } catch (e) {
    return false;
  }
};

// ---------------------------------------------------------------------------
// 🟢 ASSIGNMENT MANAGEMENT (FIREBASE)
// ---------------------------------------------------------------------------

export const addAssignment = async (school: string, subject: string, grade: string, questionCount: number, deadline: string, createdBy: string, title: string = ''): Promise<boolean> => {
  try {
    const newRef = db.ref('assignments').push();
    await newRef.set({
        id: newRef.key,
        school: cleanString(school),
        subject,
        grade,
        questionCount,
        deadline,
        createdBy,
        title
    });
    return true;
  } catch (e) {
    return false;
  }
};

export const deleteAssignment = async (id: string): Promise<boolean> => {
  try {
    await db.ref(`assignments/${id}`).remove();
    return true;
  } catch (e) {
    return false;
  }
};

// ---------------------------------------------------------------------------
// 🟢 SCORE SAVING (FIREBASE)
// ---------------------------------------------------------------------------

export const saveScore = async (studentId: string, studentName: string, school: string, score: number, total: number, subject: string, assignmentId?: string) => {
  try {
    const newRef = db.ref('results').push();
    await newRef.set({
        id: newRef.key,
        studentId,
        studentName,
        school: cleanString(school),
        score,
        totalQuestions: total,
        subject,
        assignmentId: assignmentId || '-',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    const studentRef = db.ref(`students/${studentId}`);
    studentRef.child('stars').transaction((currentStars) => {
        return (currentStars || 0) + score;
    });

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 🟢 FETCH ALL APP DATA (INITIAL LOAD)
// ---------------------------------------------------------------------------

export const fetchAppData = async (): Promise<AppData> => {
  try {
    const snapshot = await db.ref('/').once('value');
    let data = snapshot.val();

    if (!data || (!data.students && !data.questions)) {
        await seedDatabase();
        const newSnap = await db.ref('/').once('value');
        data = newSnap.val();
    }

    if (!data) return { students: [], questions: [], results: [], assignments: [] };

    const studentsArr: Student[] = data.students 
        ? Object.keys(data.students).map(k => ({...data.students[k], id: k})) 
        : [];
        
    // ✅ ROBUST QUESTION PARSING
    const questionsArr: Question[] = [];
    if (data.questions) {
        Object.keys(data.questions).forEach(k => {
            const q = data.questions[k];
            // Normalize choices
            let choices = q.choices;
            if (choices && typeof choices === 'object' && !Array.isArray(choices)) {
                choices = Object.values(choices);
            }
            if (!Array.isArray(choices)) choices = [];
            
            questionsArr.push({
                ...q,
                id: k,
                choices: choices,
                image: q.image || '', // Ensure no undefined props
            });
        });
    }

    const resultsArr: ExamResult[] = data.results 
        ? Object.keys(data.results).map(k => ({...data.results[k], id: k})) 
        : [];

    const assignmentsArr: Assignment[] = data.assignments 
        ? Object.keys(data.assignments).map(k => ({...data.assignments[k], id: k})) 
        : [];

    return { 
        students: studentsArr, 
        questions: questionsArr, 
        results: resultsArr, 
        assignments: assignmentsArr 
    };

  } catch (error) {
    console.error("Firebase fetch error:", error);
    return { students: MOCK_STUDENTS, questions: MOCK_QUESTIONS, results: [], assignments: [] };
  }
};
