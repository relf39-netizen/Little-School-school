
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Login from './views/Login';
import TeacherLogin from './views/TeacherLogin';
import TeacherDashboard from './views/TeacherDashboard';
import Dashboard from './views/Dashboard';
import PracticeMode from './views/PracticeMode';
import SubjectSelection from './views/SubjectSelection'; 
import GameMode from './views/GameMode';
import GameSetup from './views/GameSetup';
import Results from './views/Results';
import Stats from './views/Stats';
import { Student, Question, Teacher, Subject, ExamResult, Assignment, SubjectConfig } from './types';
import { fetchAppData, saveScore, getDataForStudent } from './services/api';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Student | null>(null);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [currentPage, setCurrentPage] = useState('login'); 
  
  // Normal Practice State
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  
  // Homework State
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);

  const [isMusicOn, setIsMusicOn] = useState(true);
  const [lastScore, setLastScore] = useState<{score: number, total: number, reward?: string, levelUp?: boolean, effort?: boolean, perfect?: boolean} | null>(null);
  
  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Game Room
  const [gameRoomCode, setGameRoomCode] = useState<string>('');

  useEffect(() => {
    const initData = async () => {
      const data = await fetchAppData();
      setStudents(data.students);
      setQuestions(data.questions);
      setExamResults(data.results);
      setAssignments(data.assignments);
      setSubjects(data.subjects); 
      setIsLoading(false);
    };
    initData();
  }, []);

  // Reload student data when switching back to dashboard to get latest stats/inventory
  const refreshStudentData = async () => {
      if (currentUser) {
          const data = await getDataForStudent(currentUser); // Need to check if this exists or I should refetch all
          // Ideally fetchAppData or just refetch specific student
          // For simplicity, let's refetch all for now or rely on local updates if optimistically updated
          const allData = await fetchAppData();
          setExamResults(allData.results);
          // Find updated student
          const updatedStudent = allData.students.find(s => s.id === currentUser.id);
          if (updatedStudent) setCurrentUser(updatedStudent);
      }
  };

  const handleLogin = (student: Student) => { setCurrentUser(student); setCurrentPage('dashboard'); };
  const handleTeacherLoginSuccess = (teacher: Teacher) => { setCurrentTeacher(teacher); setCurrentPage('teacher-dashboard'); };
  const handleLogout = () => { setCurrentUser(null); setCurrentTeacher(null); setCurrentPage('login'); setSelectedSubject(null); setCurrentAssignment(null); };

  const getRandomReward = () => {
      const rewards = ['ดาบวิเศษ', 'โล่ป้องกัน', 'หมวกพ่อมด', 'มงกุฎทองคำ', 'รองเท้าความเร็ว', 'หนังสือเวทย์', 'น้ำยาเพิ่มพลัง', 'แผนที่สมบัติ', 'หีบสมบัติ', 'ไข่มังกร'];
      return rewards[Math.floor(Math.random() * rewards.length)];
  };

  const handleFinishExam = async (score: number, total: number) => {
    // Gamification Logic
    let isPerfect = score === total;
    let earnedEffortToken = false;
    let earnedPerfectToken = false;
    let levelUp = false;
    let reward: string | undefined = undefined;

    if (currentUser) {
        // 1. Calculate new Quiz Count
        const newQuizCount = (currentUser.quizCount || 0) + 1;
        
        // 2. Logic: Earn Star for every 5 quizzes (Effort)
        if (newQuizCount % 5 === 0) {
            earnedEffortToken = true;
        }

        // 3. Logic: Earn Star for Perfect Score (Excellence)
        if (isPerfect) {
            earnedPerfectToken = true;
        }

        // 4. Calculate total stars to add
        let starsToAdd = 0;
        if (earnedEffortToken) starsToAdd++;
        if (earnedPerfectToken) starsToAdd++;

        // 5. Update Local State for Tokens & Level
        let currentTokens = currentUser.tokens || 0;
        let currentLevel = currentUser.level || 1;
        let currentInventory = currentUser.inventory || [];

        currentTokens += starsToAdd;

        // 6. Level Up Logic (Max 5 Stars per level)
        if (currentTokens >= 5) {
            levelUp = true;
            currentLevel++;
            currentTokens = currentTokens - 5; // Carry over excess stars
            reward = getRandomReward();
            currentInventory = [...currentInventory, reward];
        }

        const subjectToSave = currentAssignment ? currentAssignment.subject : (selectedSubject || 'รวมวิชา');
       
        // Save to backend with updated gamification data
        await saveScore(
            currentUser.id, 
            currentUser.name, 
            currentUser.school || '-', 
            score, 
            total,
            subjectToSave,
            currentAssignment ? currentAssignment.id : undefined,
            {
                quizCount: newQuizCount,
                tokens: currentTokens,
                level: currentLevel,
                inventory: currentInventory
            }
        );
       
        // Refresh data
        await refreshStudentData();
    }

    setLastScore({ score, total, perfect: isPerfect, effort: earnedEffortToken, levelUp, reward });
    setCurrentPage('results');
    setCurrentAssignment(null);
  };

  // ... View Handlers ...

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-[80vh] text-blue-600"><Loader2 className="animate-spin mb-4" size={48} /><p className="text-lg font-bold">กำลังโหลดข้อมูล...</p></div>;

  if (currentPage === 'teacher-login') return <TeacherLogin onLoginSuccess={handleTeacherLoginSuccess} onBack={() => setCurrentPage('login')} />;
  
  if (currentPage === 'teacher-dashboard' && currentTeacher) {
      return <TeacherDashboard 
        teacher={currentTeacher} 
        onLogout={handleLogout} 
        onStartGame={() => setCurrentPage('game-setup')} 
        onAdminLoginAsStudent={(s) => { setCurrentUser(s); setCurrentPage('dashboard'); }}
      />;
  }

  if (currentPage === 'game-setup') return <GameSetup onBack={() => setCurrentPage('teacher-dashboard')} onGameCreated={(code) => { setGameRoomCode(code); setCurrentPage('teacher-game'); }} teacher={currentTeacher || undefined}/>;
  
  if (currentPage === 'teacher-game' && currentTeacher) {
      // Teacher plays as admin (observer) or player? Usually admin view in GameMode. 
      // Reuse GameMode with admin flag (student id '99999')
      const teacherAsStudent: Student = { id: '99999', name: currentTeacher.name, school: currentTeacher.school, avatar: '👨‍🏫', stars: 0 };
      return <GameMode student={teacherAsStudent} initialRoomCode={gameRoomCode} onExit={() => setCurrentPage('teacher-dashboard')} />;
  }

  if (currentPage === 'login' && !currentUser) return <Login onLogin={handleLogin} onTeacherLoginClick={() => setCurrentPage('teacher-login')} />;

  return (
    <Layout studentName={currentUser?.name} onLogout={handleLogout} isMusicOn={isMusicOn} toggleMusic={() => setIsMusicOn(!isMusicOn)} currentPage={currentPage} onNavigate={setCurrentPage}>
      {(() => {
        switch (currentPage) {
          case 'dashboard':
            return <Dashboard 
                student={currentUser!} 
                assignments={assignments} 
                examResults={examResults} 
                subjects={subjects}
                onNavigate={setCurrentPage} 
                onStartAssignment={(a) => { setCurrentAssignment(a); setSelectedSubject(a.subject); setCurrentPage('practice'); }}
                onSelectSubject={(sub) => { setSelectedSubject(sub); setCurrentPage('practice'); }}
                onRefreshSubjects={refreshStudentData}
            />;
          case 'practice':
            let qList = questions;
            const activeSubject = currentAssignment ? currentAssignment.subject : selectedSubject;
            // Need to filter questions by subject
            if (activeSubject) {
                qList = questions.filter(q => q.subject === activeSubject);
            }
            if (currentAssignment && currentAssignment.questionCount < qList.length) {
                qList = qList.slice(0, currentAssignment.questionCount);
            }
            // If no questions loaded for subject (lazy loading?), might need to fetch
            return <PracticeMode questions={qList} onFinish={handleFinishExam} onBack={() => setCurrentPage('dashboard')} />;
          
          case 'game': return <GameMode student={currentUser!} onExit={() => setCurrentPage('dashboard')} onFinish={handleFinishExam}/>;
          
          case 'results': return <Results 
              score={lastScore?.score || 0} 
              total={lastScore?.total || 0} 
              isHomework={!!currentAssignment} 
              onRetry={() => setCurrentPage('dashboard')} 
              onHome={() => setCurrentPage('dashboard')}
              earnedEffortToken={lastScore?.effort}
              earnedPerfectToken={lastScore?.perfect}
              unlockedReward={lastScore?.reward}
              leveledUp={lastScore?.levelUp}
          />;
          
          case 'stats': return <Stats examResults={examResults} studentId={currentUser!.id} subjects={subjects} onBack={() => setCurrentPage('dashboard')} />;
          
          default: return <Dashboard student={currentUser!} onNavigate={setCurrentPage} />;
        }
      })()}
    </Layout>
  );
};

export default App;
