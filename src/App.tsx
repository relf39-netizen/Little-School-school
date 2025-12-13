
import React, { useState, useEffect, useRef } from 'react';
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

const REWARDS = [
  'ดาบผู้กล้า', 'โล่อัศวิน', 'หมวกพ่อมด', 'ตุ๊กตามังกร', 
  'เหรียญทองคำ', 'มงกุฎราชา', 'รองเท้าความเร็วแสง', 
  'หนังสือเวทย์มนตร์', 'น้ำยาวิเศษ', 'แผนที่สมบัติ', 
  'หีบสมบัติโบราณ', 'ไข่มังกร'
];

const getRandomReward = () => {
  return REWARDS[Math.floor(Math.random() * REWARDS.length)];
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Student | null>(null);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [currentPage, setCurrentPage] = useState('login'); 
  
  // Normal Practice State
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  
  // Homework State
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  
  // Ref for fallback
  const currentAssignmentRef = useRef<Assignment | null>(null);

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

  // Update Ref whenever state changes
  useEffect(() => {
      currentAssignmentRef.current = currentAssignment;
  }, [currentAssignment]);

  // Reload student data when switching back to dashboard to get latest stats/inventory
  const refreshStudentData = async () => {
      if (currentUser) {
          // Fetch specific data for this student to ensure we get everything (overcoming global limits)
          const specificData = await getDataForStudent(currentUser);
          
          setExamResults(specificData.results);
          setAssignments(specificData.assignments);
          
          // Also check for profile updates (stars/inventory)
          const { students: allStudents } = await fetchAppData();
          const updatedStudent = allStudents.find(s => s.id === currentUser.id);
          if (updatedStudent) {
              setCurrentUser(prev => prev ? { ...prev, ...updatedStudent } : updatedStudent);
          }
      }
  };

  const handleLogin = async (student: Student) => { 
      setIsLoading(true);
      setCurrentUser(student);
      
      // 🟢 Force fetch student specific data immediately upon login
      // This solves the issue where global fetchAppData might miss recent records due to pagination
      try {
          const specificData = await getDataForStudent(student);
          setExamResults(specificData.results);
          setAssignments(specificData.assignments);
      } catch (e) {
          console.error("Error loading specific student data:", e);
      }
      
      setIsLoading(false);
      setCurrentPage('dashboard'); 
  };

  const handleTeacherLoginSuccess = (teacher: Teacher) => { setCurrentTeacher(teacher); setCurrentPage('teacher-dashboard'); };
  const handleLogout = () => { setCurrentUser(null); setCurrentTeacher(null); setCurrentPage('login'); setSelectedSubject(null); setCurrentAssignment(null); };

  // 🟢 FIX: รับ assignmentId ที่ส่งกลับมาจาก PracticeMode
  const handleFinishExam = async (score: number, total: number, returnedAssignmentId?: string) => {
    // Gamification Logic
    let isPerfect = score === total;
    let earnedEffortToken = false;
    let earnedPerfectToken = false;
    let levelUp = false;
    let reward: string | undefined = undefined;

    // Use returned ID first (most reliable), then ref, then fallback to undefined
    const activeAssignmentId = returnedAssignmentId || currentAssignmentRef.current?.id;
    
    // Find subject: try to find assignment by ID to get subject, or fallback
    const matchedAssignment = assignments.find(a => a.id === activeAssignmentId);
    const subjectToSave = matchedAssignment ? matchedAssignment.subject : (selectedSubject || 'รวมวิชา');

    console.log("Saving Score:", { score, total, subjectToSave, activeAssignmentId });

    // 1. Optimistic Update (Show result immediately)
    const newResult: ExamResult = {
        id: `temp-${Date.now()}`,
        studentId: currentUser!.id,
        subject: subjectToSave,
        score: score,
        totalQuestions: total,
        timestamp: Date.now(),
        assignmentId: activeAssignmentId 
    };
    
    setExamResults(prev => [...prev, newResult]);

    if (currentUser) {
        // Calculate Gamification locally
        const newQuizCount = (currentUser.quizCount || 0) + 1;
        if (newQuizCount % 5 === 0) earnedEffortToken = true;
        if (isPerfect) earnedPerfectToken = true;

        let starsToAdd = 0;
        if (earnedEffortToken) starsToAdd++;
        if (earnedPerfectToken) starsToAdd++;

        let currentTokens = currentUser.tokens || 0;
        let currentLevel = currentUser.level || 1;
        let currentInventory = currentUser.inventory || [];

        currentTokens += starsToAdd;

        if (currentTokens >= 5) {
            levelUp = true;
            currentLevel++;
            currentTokens = currentTokens - 5;
            reward = getRandomReward();
            currentInventory = [...currentInventory, reward];
        }

        const updatedUser = {
            ...currentUser,
            stars: currentUser.stars + score,
            quizCount: newQuizCount,
            tokens: currentTokens,
            level: currentLevel,
            inventory: currentInventory
        };
        setCurrentUser(updatedUser);
       
        // Save to backend with delay to ensure consistency
        const saveResult = await saveScore(
            currentUser.id, 
            currentUser.name, 
            currentUser.school || '-', 
            score, 
            total,
            subjectToSave,
            activeAssignmentId, // ✅ Send strictly ensured ID
            {
                quizCount: newQuizCount,
                tokens: currentTokens,
                level: currentLevel,
                inventory: currentInventory
            }
        );

        if (!saveResult.success) {
            alert("❌ บันทึกคะแนนไม่สำเร็จ! กรุณาแจ้งครู\n\nError: " + JSON.stringify(saveResult.error));
        } else {
            console.log("✅ Save confirmed by backend.");
            // 🟢 Show explicit success message to user if it's homework
            if (activeAssignmentId) {
                alert(`✅ บันทึกผลการบ้านเรียบร้อยแล้ว!\n(Assignment ID: ${activeAssignmentId})`);
            }
            // Force refresh to get data from server to verify ID persistence
            refreshStudentData();
        }
    }

    setLastScore({ score, total, perfect: isPerfect, effort: earnedEffortToken, levelUp, reward });
    setCurrentPage('results');
    setCurrentAssignment(null); 
  };

  // ... View Handlers ...

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-[80vh] text-indigo-600"><Loader2 className="animate-spin mb-4" size={48} /><p className="text-lg font-bold">กำลังโหลดข้อมูล...</p></div>;

  if (currentPage === 'teacher-login') return <TeacherLogin onLoginSuccess={handleTeacherLoginSuccess} onBack={() => setCurrentPage('login')} />;
  
  if (currentPage === 'teacher-dashboard' && currentTeacher) {
      return <TeacherDashboard 
        teacher={currentTeacher} 
        onLogout={handleLogout} 
        onStartGame={() => setCurrentPage('game-setup')} 
        onAdminLoginAsStudent={(s) => { handleLogin(s); }}
      />;
  }

  if (currentPage === 'game-setup') return <GameSetup onBack={() => setCurrentPage('teacher-dashboard')} onGameCreated={(code) => { setGameRoomCode(code); setCurrentPage('teacher-game'); }} teacher={currentTeacher || undefined}/>;
  
  if (currentPage === 'teacher-game' && currentTeacher) {
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
            if (activeSubject) {
                qList = questions.filter(q => q.subject === activeSubject);
            }
            if (currentAssignment && currentAssignment.questionCount < qList.length) {
                qList = qList.slice(0, currentAssignment.questionCount);
            }
            // 🟢 Pass currentAssignment.id explicitly
            return <PracticeMode 
                questions={qList} 
                onFinish={handleFinishExam} 
                onBack={() => setCurrentPage('dashboard')} 
                assignmentId={currentAssignment ? String(currentAssignment.id) : undefined}
            />;
          
          case 'game': return <GameMode student={currentUser!} onExit={() => setCurrentPage('dashboard')} onFinish={(s, t) => handleFinishExam(s, t)}/>;
          
          case 'results': return <Results 
              score={lastScore?.score || 0} 
              total={lastScore?.total || 0} 
              isHomework={!!lastScore && lastScore.reward === undefined && currentAssignment === null} 
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
