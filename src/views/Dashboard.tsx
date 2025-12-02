import React, { useState } from 'react';
import { BookOpen, Gamepad2, BarChart3, Star, Calendar, CheckCircle, History, ArrowLeft, Users, Calculator, FlaskConical, Languages, Sparkles, RefreshCw } from 'lucide-react';
import { Student, Assignment, ExamResult, SubjectConfig } from '../types';

interface DashboardProps {
  student: Student;
  assignments?: Assignment[]; 
  examResults?: ExamResult[]; 
  subjects?: SubjectConfig[]; 
  onNavigate: (page: string) => void;
  onStartAssignment?: (assignment: Assignment) => void;
  onSelectSubject?: (subjectName: string) => void;
  onRefreshSubjects?: () => void;
}

const ENCOURAGING_MESSAGES = [
  "สู้ๆ นะคนเก่ง ✌️",
  "วิชานี้สนุกนะ 🌟",
  "ทำได้แน่นอน 💯",
  "มาเก็บดาวกันเถอะ ⭐",
  "ฝึกฝนบ่อยๆ เก่งขึ้นแน่ 📚",
  "เชื่อมั่นในตัวเองนะ 💪",
  "เก่งมากครับคนดี 👍",
  "ลุยเลย! 🚀",
  "ความพยายามอยู่ที่ไหน ความสำเร็จอยู่ที่นั่น ❤️",
  "วันนี้เรียนอะไรดีนะ 🤔",
  "สนุกกับการเรียนรู้นะ 🌈"
];

const Dashboard: React.FC<DashboardProps> = ({ 
  student, 
  assignments = [], 
  examResults = [], 
  subjects = [], 
  onNavigate, 
  onStartAssignment,
  onSelectSubject,
  onRefreshSubjects
}) => {
  const [view, setView] = useState<'main' | 'history'>('main');

  const GRADE_LABELS: Record<string, string> = { 'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6', 'ALL': 'ทุกชั้น' };

  // กรองข้อมูลการบ้าน
  const myAssignments = assignments.filter(a => {
      if (a.school !== student.school) return false;
      if (a.grade && a.grade !== 'ALL' && student.grade) {
          if (a.grade !== student.grade) return false;
      }
      return true;
  });
  
  const finishedAssignments = myAssignments.filter(a => examResults.some(r => r.assignmentId === a.id));
  const pendingAssignments = myAssignments.filter(a => !examResults.some(r => r.assignmentId === a.id));

  // เรียงลำดับ
  pendingAssignments.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  finishedAssignments.sort((a, b) => {
      const resultA = examResults.find(r => r.assignmentId === a.id);
      const resultB = examResults.find(r => r.assignmentId === b.id);
      return (resultB?.timestamp || 0) - (resultA?.timestamp || 0);
  });

  // ✅ กรองรายวิชา: พยายามกรองตามชั้นเรียนก่อน
  let mySubjects = subjects.filter(s => s.grade === 'ALL' || s.grade === student.grade);

  // ✅ Fallback: ถ้ากรองแล้วไม่เจอ แต่ในโรงเรียนมีวิชา ให้แสดงทั้งหมด (เพื่อป้องกันหน้าจอโล่งกรณีตั้งค่าเกรดผิด)
  if (mySubjects.length === 0 && subjects.length > 0) {
      mySubjects = subjects;
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  // Helper for Icons
  const getIcon = (iconName: string, size = 32) => {
      switch(iconName) {
          case 'Book': return <BookOpen size={size} />;
          case 'Calculator': return <Calculator size={size} />;
          case 'FlaskConical': return <FlaskConical size={size} />;
          case 'Languages': return <Languages size={size} />;
          case 'Globe': return <Users size={size} />;
          case 'Computer': return <Gamepad2 size={size} />;
          default: return <Sparkles size={size} />;
      }
  };

  const getEncouragement = (subjectName: string, index: number) => {
      let hash = 0;
      for (let i = 0; i < subjectName.length; i++) {
          hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
      }
      return ENCOURAGING_MESSAGES[(Math.abs(hash) + index) % ENCOURAGING_MESSAGES.length];
  };

  // --- ส่วนแสดงผลหน้าประวัติการส่งงาน ---
  if (view === 'history') {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <button onClick={() => setView('main')} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
          <ArrowLeft size={20} /> กลับหน้าแดชบอร์ด
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-yellow-100 p-3 rounded-2xl text-yellow-600">
            <History size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">ประวัติการส่งงาน</h2>
            <p className="text-gray-500">รายการที่ทำเสร็จแล้ว ({finishedAssignments.length} รายการ)</p>
          </div>
        </div>

        <div className="space-y-4">
          {finishedAssignments.length > 0 ? (
            finishedAssignments.map(hw => {
              const result = examResults.find(r => r.assignmentId === hw.id);
              return (
                <div key={hw.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition-shadow">
                   <div>
                     <div className="flex items-center gap-2 mb-1">
                        <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-1 rounded-lg">{hw.subject}</span>
                        <span className="text-xs text-gray-400">{new Date(result?.timestamp || 0).toLocaleString('th-TH')}</span>
                     </div>
                     <div className="font-bold text-gray-800 text-lg">
                        {hw.title || hw.subject}
                     </div>
                   </div>
                   
                   <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end bg-gray-50 p-3 rounded-xl sm:bg-transparent sm:p-0">
                     <div className="text-right">
                        <div className="text-xs text-gray-400 font-medium uppercase">คะแนนที่ได้</div>
                        <div className="text-2xl font-black text-blue-600 leading-none">
                            {result ? result.score : 0}
                            <span className="text-sm text-gray-400 font-medium">/{result ? result.totalQuestions : 0}</span>
                        </div>
                     </div>
                     <div className="bg-green-100 p-2 rounded-full text-green-600">
                        <CheckCircle size={24} />
                     </div>
                   </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20 text-gray-400 bg-white rounded-3xl border-2 border-dashed">
              ยังไม่มีประวัติการส่งงาน
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- ส่วนแสดงผลหน้าหลัก (Dashboard) ---
  return (
    <div className="space-y-8 pb-20">
      {/* 1. Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10"><Star size={150} /></div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="text-5xl bg-white/20 p-3 rounded-full backdrop-blur-sm shadow-inner">{student.avatar}</div>
          <div>
            <h2 className="text-2xl font-bold mb-1">สวัสดี, {student.name.split(' ')[0]}!</h2>
            <div className="flex gap-2 text-indigo-100 items-center text-sm">
                <span>ยินดีต้อนรับสู่ LittleSchool LearnUp</span>
            </div>
            <div className="flex items-center gap-2 mt-2 bg-black/20 w-fit px-3 py-1 rounded-full"><Star className="text-yellow-300 fill-yellow-300" size={16} /><span className="font-bold">{student.stars} ดาว</span></div>
          </div>
        </div>
      </div>

      {/* 2. การบ้าน (Pending Assignments) */}
      {pendingAssignments.length > 0 ? (
        <div className="bg-white border-l-4 border-orange-500 rounded-2xl p-6 shadow-md animate-fade-in">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Calendar size={20} /></div>
                ภารกิจที่ต้องทำ ({pendingAssignments.length})
            </h3>
            <div className="space-y-3">
                {pendingAssignments.map(hw => {
                    const isExpired = new Date(hw.deadline) < new Date();
                    return (
                        <div key={hw.id} className={`p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center border gap-3 ${isExpired ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                            <div>
                                <div className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                  {hw.title || hw.subject} 
                                  {isExpired && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">เลยกำหนด</span>}
                                </div>
                                <div className={`text-sm ${isExpired ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                                  {hw.questionCount} ข้อ • ส่งภายใน {formatDate(hw.deadline)}
                                </div>
                                {hw.createdBy && (
                                   <div className="text-xs text-purple-600 mt-1 font-medium bg-purple-50 px-2 py-0.5 rounded w-fit">
                                      มอบหมายโดย: ครู{hw.createdBy}
                                   </div>
                                )}
                            </div>
                            <button 
                                onClick={() => onStartAssignment && onStartAssignment(hw)}
                                className={`w-full sm:w-auto px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all hover:-translate-y-1 active:scale-95
                                  ${isExpired 
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-200' 
                                    : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200'}`}
                            >
                                {isExpired ? 'ส่งงานล่าช้า' : 'เริ่มทำ'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-center gap-2 text-green-700 shadow-sm">
           <CheckCircle size={20} /> เยี่ยมมาก! คุณส่งงานครบทุกชิ้นแล้ว
        </div>
      )}

      {/* 3. วิชาเรียนของคุณ (Your Subjects) */}
      <div>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="text-indigo-600" /> วิชาเรียนของคุณ
            </h3>
            {onRefreshSubjects && (
                <button onClick={onRefreshSubjects} className="text-gray-500 hover:text-indigo-600 bg-white p-2 rounded-full shadow-sm border hover:border-indigo-200 transition">
                    <RefreshCw size={16} />
                </button>
            )}
        </div>
        
        {mySubjects.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-400">
                <div className="bg-gray-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-3">
                    <BookOpen size={40} className="text-gray-300"/>
                </div>
                <p>ยังไม่มีรายวิชาสำหรับโรงเรียน: <span className="font-bold text-gray-500">{student.school || 'ไม่ระบุ'}</span></p>
                <p className="text-sm mt-1">ระดับชั้น: {GRADE_LABELS[student.grade || ''] || student.grade || 'ไม่ระบุ'}</p>
                <button onClick={onRefreshSubjects} className="mt-4 text-indigo-600 underline text-sm">ลองรีเฟรชข้อมูล</button>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in">
                {mySubjects.map((sub, index) => (
                    <button 
                        key={sub.id}
                        onClick={() => onSelectSubject && onSelectSubject(sub.name)}
                        className={`group relative p-6 rounded-3xl border-2 text-left transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col items-start gap-4 ${sub.color || 'bg-white border-gray-100'}`}
                    >
                        <div className="bg-white/80 p-3 rounded-2xl shadow-sm backdrop-blur-sm">
                            {getIcon(sub.icon, 32)}
                        </div>
                        <div className="w-full">
                            <h4 className="font-bold text-lg text-gray-800 group-hover:text-blue-700 transition-colors">{sub.name}</h4>
                            <p className="text-sm font-medium mt-2 text-gray-600 bg-white/60 p-2 rounded-lg italic">
                                "{getEncouragement(sub.name, index)}"
                            </p>
                        </div>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white/90 px-3 py-1 rounded-full text-xs font-bold shadow-sm text-blue-600">
                                เริ่มเลย
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        )}
      </div>

      {/* 4. เมนูอื่นๆ (Menu) */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="text-yellow-500" /> เมนูเพิ่มเติม
        </h3>
        <div className="grid grid-cols-3 gap-4">
            
            {/* ปุ่มเกมแข่งขัน */}
            <button onClick={() => onNavigate('game')} className="group bg-white rounded-3xl p-4 shadow-sm hover:shadow-lg transition-all border-b-4 border-purple-100 hover:border-purple-500 hover:-translate-y-1 flex flex-col items-center justify-center gap-2 text-center h-32">
                <div className="bg-purple-100 p-3 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors"><Gamepad2 size={28} /></div>
                <span className="font-bold text-gray-700 text-sm">เกมแข่งขัน</span>
            </button>

            {/* ปุ่มประวัติ */}
            <button onClick={() => setView('history')} className="group bg-white rounded-3xl p-4 shadow-sm hover:shadow-lg transition-all border-b-4 border-yellow-100 hover:border-yellow-500 hover:-translate-y-1 flex flex-col items-center justify-center gap-2 text-center h-32">
                <div className="bg-yellow-100 p-3 rounded-full text-yellow-600 group-hover:bg-yellow-600 group-hover:text-white transition-colors"><History size={28} /></div>
                <span className="font-bold text-gray-700 text-sm">ประวัติส่งงาน</span>
            </button>

            {/* ปุ่มสถิติ */}
            <button onClick={() => onNavigate('stats')} className="group bg-white rounded-3xl p-4 shadow-sm hover:shadow-lg transition-all border-b-4 border-green-100 hover:border-green-500 hover:-translate-y-1 flex flex-col items-center justify-center gap-2 text-center h-32">
                <div className="bg-green-100 p-3 rounded-full text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors"><BarChart3 size={28} /></div>
                <span className="font-bold text-gray-700 text-sm">สถิติการเรียน</span>
            </button>

        </div>
      </div>

    </div>
  );
};

export default Dashboard;