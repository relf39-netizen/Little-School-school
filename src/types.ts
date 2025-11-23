
export interface Student {
  id: string;
  name: string;
  school?: string; 
  avatar: string; 
  stars: number; 
}

export interface Teacher {
  name: string;
  school: string;
}

export enum Subject {
  MATH = 'คณิตศาสตร์',
  THAI = 'ภาษาไทย',
  SCIENCE = 'วิทยาศาสตร์',
  ENGLISH = 'ภาษาอังกฤษ'
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
}

export interface ExamResult {
  id: string;
  studentId: string;
  subject: Subject;
  score: number;
  totalQuestions: number;
  timestamp: number;
  assignmentId?: string; // ✅ ระบุว่าเป็นคะแนนจากการบ้านชิ้นไหน
}

export interface Assignment {
  id: string;
  school: string;
  subject: Subject;
  questionCount: number;
  deadline: string; // YYYY-MM-DD
  createdBy: string;
}

export type GameState = 'LOBBY' | 'COUNTDOWN' | 'QUESTION' | 'LEADERBOARD' | 'FINISHED';
