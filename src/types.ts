
export interface Student {
  id: string;
  name: string;
  school?: string; 
  avatar: string; 
  stars: number; // คะแนนสะสมรวม (EXP)
  grade?: string; 
  teacherId?: string;
  
  // ✅ Gamification Fields
  quizCount?: number; // จำนวนครั้งที่เล่น
  tokens?: number;    // ดาวพิเศษ (สำหรับแลกของรางวัล)
  level?: number;     // ระดับ/ด่าน
  inventory?: string[]; // รายการของรางวัลที่ได้
}

export interface Teacher {
  id?: string | number; 
  username?: string;
  password?: string;
  name: string;
  school: string;
  role?: string; // ADMIN or TEACHER
  gradeLevel?: string; 
  citizenId?: string; // New field for identification
}

// ✅ New Interface for Shop Items
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  type: 'DIGITAL' | 'PRIVILEGE'; // DIGITAL = โชว์ในกระเป๋า, PRIVILEGE = คูปองใช้จริง
  color: string;
}

// ✅ New Interface for School Management
export interface School {
  id: string;
  name: string;
  status?: 'active' | 'inactive'; // ✅ New field for suspension status
}

// ✅ New Interface for School Statistics
export interface SchoolStats {
  schoolName: string;
  loginCount: number;
  activityCount: number; // Represents quizzes/exams taken
  lastActive: number;
}

// ✅ Changed from Enum to string to support dynamic subjects
export type Subject = string;

// ✅ New Interface for Custom Subjects
export interface SubjectConfig {
  id: string;
  name: string;
  school: string;
  teacherId: string;
  grade: string;
  icon: string; // Store icon name (e.g., 'Book', 'Calculator')
  color: string; // Tailwind class string
}

export interface Question {
  id: string;
  subject: Subject;
  text: string;
  image?: string;
  choices: {
    id: string;
    text: string;
    image?: string;
  }[];
  correctChoiceId: string;
  explanation: string;
  grade?: string; 
  school?: string; 
  teacherId?: string; 
}

export interface ExamResult {
  id: string;
  studentId: string;
  subject: Subject;
  score: number;
  totalQuestions: number;
  timestamp: number;
  assignmentId?: string; 
}

export interface Assignment {
  id: string;
  school: string;
  subject: Subject;
  grade?: string; 
  questionCount: number;
  deadline: string; 
  createdBy: string;
  title?: string; // ✅ ชื่อหัวข้อการบ้าน
}

export interface RegistrationRequest {
  id: string;
  citizenId: string;
  name: string;
  surname: string;
  timestamp: number;
}

export type GameState = 'LOBBY' | 'COUNTDOWN' | 'QUESTION' | 'LEADERBOARD' | 'FINISHED';
