
import React, { useState, useEffect } from 'react';
import { BookOpen, Gamepad2, BarChart3, Star, Calendar, CheckCircle, History, ArrowLeft, Users, Calculator, FlaskConical, Languages, Sparkles, RefreshCw, Trophy, Backpack, AlertCircle, Clock, FileText, Dumbbell, ShoppingBag, Info } from 'lucide-react';
import { Student, Assignment, ExamResult, SubjectConfig } from '../types';
import { speak } from '../utils/soundUtils';

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
  const [view, setView] = useState<'main' | 'history' | 'onet' | 'inventory'>('main');
  const [historyTab, setHistoryTab] = useState<'homework' | 'practice'>('homework');
  const [onetTab, setOnetTab] = useState<'pending' | 'finished'>('pending');

  const GRADE_LABELS: Record<string, string> = { 'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6', 'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3', 'ALL': 'ทุกชั้น' };

  // ✅ 1. กรองและกำจัดงานซ้ำ (Enhanced Deduplication Logic)
  // แก้ปัญหาแสดงงาน O-NET เยอะเกินไป โดยเช็คจากเนื้อหา (Title + Subject + Deadline) แทน ID
  const myAssignments = React.useMemo(() => {
      // 1.1 กรองเบื้องต้น: ต้องเป็นโรงเรียนเดียวกัน และ ระดับชั้นตรงกัน
      const relevant = assignments.filter(a => {
          if (a.school !== student.school) return false;
          
          // ถ้างานระบุระดับชั้น ต้องตรงกับนักเรียน (ถ้าเป็น ALL คือทุกคนเห็นได้)
          if (a.grade && a.grade !== 'ALL' && student.grade) {
              if (a.grade !== student.grade) return false;
          }
          return true;
      });

      // 1.2 กำจัดตัวซ้ำ: ใช้ Title + Subject + Deadline เป็น Key
      const uniqueMap = new Map();
      relevant.forEach(a => {
          // สร้าง Key สำหรับเช็คซ้ำ (ตัดช่องว่างชื่อหัวข้อออก)
          const key = `${a.title?.trim()}|${a.subject}|${a.grade}|${a.deadline}`;
          
          // ถ้ายังไม่มี Key นี้ หรือ ถ้ามีแล้วแต่ ID ปัจจุบันใหม่กว่า (เผื่ออัพเดต) ให้เก็บไว้
          // ในที่นี้เราจะเก็บตัวแรกที่เจอเพื่อความง่าย
          if (!uniqueMap.has(key)) {
              uniqueMap.set(key, a);
          }
      });

      return Array.from(uniqueMap.values());
  }, [assignments, student.school, student.grade]);

  const getLatestResult = (assignmentId: string) => {
      // ต้องเช็คด้วยชื่อ Assignment หรือ ID
      // เนื่องจากเรา Deduplicate การบ้านไปแล้ว เราต้องระวังการเช็ค ID
      // แต่ใน ExamResult เราเก็บ assignmentId ไว้ ซึ่งควรจะตรงกัน
      
      const relevant = examResults.filter(r => 
          String(r.assignmentId).trim() === String(assignmentId).trim() && 
          String(r.studentId).trim() === String(student.id).trim()
      );
      
      // ถ้าไม่เจอโดย ID ลองหาโดยชื่อหัวข้อ (เผื่อกรณีระบบเก่า/ใหม่)
      if (relevant.length === 0) {
         // Logic เพิ่มเติมถ้าจำเป็น
      }

      if (relevant.length === 0) return null;
      relevant.sort((a, b) => b.timestamp - a.timestamp);
      return relevant[0];
  };

  const checkIsDone = (assignmentId: string) => {
      return !!getLatestResult(assignmentId);
  };
  
  const onetAssignments = myAssignments.filter(a => a.title && a.title.startsWith('[O-NET]'));
  const generalAssignments = myAssignments.filter(a => !a.title || !a.title.startsWith('[O-NET]'));

  const pendingGeneral = generalAssignments.filter(a => !checkIsDone(a.id));
  const pendingOnet = onetAssignments.filter(a => !checkIsDone(a.id));
  const finishedOnet = onetAssignments.filter(a => checkIsDone(a.id));

  pendingGeneral.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  
  const myHistory = examResults
    .filter(r => String(r.studentId) === String(student.id))
    .sort((a, b) => b.timestamp - a.timestamp); 

  const mySubjects = subjects.filter(s => {
      const subjectSchool = (s.school || '').trim();
      const studentSchool = (student.school || '').trim();
      if (subjectSchool !== studentSchool) return false;
      return s.grade === 'ALL' || s.grade === student.grade;
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatHistoryDateTime = (timestamp: number) => {
      const date = new Date(timestamp);
      const datePart = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
      const timePart = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `วันที่ ${datePart} ${timePart} น.`;
  };
  
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

  const handleStartOnet = (hw: Assignment) => {
      speak("ตั้งใจทำนะครับ คะแนนเต็มรับ 3 ดาว เจ็ดสิบเปอร์เซ็นต์รับ 2 ดาว ห้าสิบเปอร์เซ็นต์รับ 1 ดาวครับ");
      if (onStartAssignment) onStartAssignment(hw);
  };

  if (view === 'inventory') {
      return (
          <div className="space-y-6 pb-20 animate-fade-in">
              <button onClick={() => setView('main')} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
                  <ArrowLeft size={20} /> กลับหน้าแดชบอร์ด
              </button>
              
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
                  <div className="relative z-10 flex items-center gap-4">
                      <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                          <Backpack size={40} className="text-white" />
                      </div>
                      <div>
                          <h2 className="text-2xl font-bold">กระเป๋าของฉัน</h2>
                          <p className="text-yellow-100">ไอเทมที่แลกมาจะอยู่ที่นี่</p>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {(student.inventory && student.inventory.length > 0) ? student.inventory.map((item, index) => (
                      <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center hover:-translate-y-1 transition-transform">
                          <div className="text-5xl mb-3 drop-shadow-md">
                            {item.includes('ดาบ') ? '⚔️' : 
                             item.includes('โล่') ? '🛡️' : 
                             item.includes('หมวก') ? '🧙‍♂️' : 
                             item.includes('มงกุฎ') ? '👑' :
                             item.includes('ตุ๊กตา') ? '🧸' :
                             item.includes('เหรียญ') ? '🪙' :
                             item.includes('รองเท้า') ? '👢' :
                             item.includes('หนังสือ') ? '📘' :
                             item.includes('โพชั่น') || item.includes('น้ำยา') ? '🧪' :
                             item.includes('แผนที่') ? '🗺️' :
                             item.includes('หีบ') ? '⚱️' :
                             item.includes('ไข่') ? '🥚' : 
                             item.includes('บัตร') || item.includes('ดีเจ') || item.includes('คะแนน') ? '🎟️' : '🎁'}
                          </div>
                          <div className="font-bold text-gray-700 text-sm">{item.split('#')[0]}</div>
                          {item.includes('#') && <div className="text-[10px] text-gray-400 mt-1 bg-gray-50 px-2 py-0.5 rounded-full">Coupon</div>}
                      </div>
                  )) : (
                      <div className="col-span-full py-20 text-center text-gray-400 border-2 border-dashed rounded-3xl">
                          ยังไม่มีของสะสม ไปที่ "ร้านค้า" เพื่อแลกของรางวัลกันเถอะ!
                      </div>
                  )}
              </div>
          </div>
      );
  }

  if (view === 'history') {
    const homeworkHistory = myHistory.filter(r => r.assignmentId);
    const practiceHistory = myHistory.filter(r => !r.assignmentId);
    const displayList = historyTab === 'homework' ? homeworkHistory : practiceHistory;

    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <button onClick={() => setView('main')} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
          <ArrowLeft size={20} /> กลับหน้าแดชบอร์ด
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="bg-yellow-100 p-3 rounded-2xl text-yellow-600">
            <History size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">ประวัติการส่งงาน</h2>
            <p className="text-gray-500">รวมรายการที่ทำเสร็จแล้ว</p>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button 
                onClick={() => setHistoryTab('homework')} 
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${historyTab === 'homework' ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
            >
                <FileText size={16} /> การบ้านที่ส่งครู ({homeworkHistory.length})
            </button>
            <button 
                onClick={() => setHistoryTab('practice')} 
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${historyTab === 'practice' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
            >
                <Dumbbell size={16} /> ฝึกฝนเอง ({practiceHistory.length})
            </button>
        </div>

        <div className="space-y-4">
          {displayList.length > 0 ? (
            displayList.map(result => {
              const assignment = assignments.find(a => String(a.id) === String(result.assignmentId));
              const title = assignment?.title || (assignment ? assignment.subject : (result.assignmentId ? 'แบบฝึกหัด (ไม่ระบุ)' : `ฝึกฝน: ${result.subject}`));
              const isOnet = title.startsWith('[O-NET]');
              
              const score = result.score;
              const total = result.totalQuestions;
              const percent = total > 0 ? Math.round((score / total) * 100) : 0;
              
              let scoreColor = 'text-red-600';
              if (percent >= 80) scoreColor = 'text-green-600';
              else if (percent >= 50) scoreColor = 'text-yellow-600';

              return (
                <div key={result.id} className={`p-5 rounded-2xl shadow-sm border flex flex-col justify-between items-start gap-4 hover:shadow-md transition-shadow ${isOnet ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-gray-100'}`}>
                   <div className="flex flex-col sm:flex-row justify-between w-full items-start sm:items-center gap-4">
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isOnet ? 'bg-indigo-100 text-indigo-700' : historyTab === 'practice' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>{result.subject}</span>
                            <span className="text-xs text-gray-400">{formatHistoryDateTime(result.timestamp)}</span>
                         </div>
                         <div className="font-bold text-gray-800 text-lg">
                            {title}
                         </div>
                       </div>
                       
                       <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end bg-white/50 p-2 rounded-xl border border-gray-100 sm:bg-transparent sm:border-0 sm:p-0">
                         <div className="text-right">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">คะแนนที่ได้</div>
                            <div className={`text-2xl font-black leading-none flex items-baseline justify-end gap-1 ${scoreColor}`}>
                                {score}
                                <span className="text-sm text-gray-400 font-medium">/{total}</span>
                            </div>
                         </div>
                         <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs border-4 ${percent >= 80 ? 'border-green-200 bg-green-100 text-green-700' : percent >= 50 ? 'border-yellow-200 bg-yellow-100 text-yellow-700' : 'border-red-200 bg-red-100 text-red-700'}`}>
                             {percent}%
                         </div>
                       </div>
                   </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20 text-gray-400 bg-white rounded-3xl border-2 border-dashed">
              <p>ยังไม่มีประวัติในหมวดนี้</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'onet') {
      return (
        <div className="space-y-6 pb-20 animate-fade-in">
            <button onClick={() => setView('main')} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
                <ArrowLeft size={20} /> กลับหน้าแดชบอร์ด
            </button>

            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-4">
                    <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                        <Trophy size={40} className="text-yellow-300 fill-yellow-300" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">ภารกิจพิชิต O-NET</h2>
                        <p className="text-indigo-100 text-sm">ตั้งใจทำเพื่อรับดาวสะสมพิเศษ! 🌟</p>
                    </div>
                </div>
            </div>

            {/* 🟢 RULES CARD */}
            <div className="bg-white p-4 rounded-2xl border-2 border-indigo-100 shadow-sm flex flex-col md:flex-row items-center gap-4 text-sm">
                <div className="bg-indigo-50 p-2 rounded-full text-indigo-600 flex-shrink-0"><Info size={24}/></div>
                <div className="flex-1 text-gray-600">
                    <span className="font-bold text-indigo-700 block mb-1">กติกาการรับดาว O-NET:</span>
                    <div className="flex flex-wrap gap-2 md:gap-4 text-xs font-bold">
                        <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200"><Star size={12} fill="currentColor"/> คะแนนเต็ม: 3 ดาว</span>
                        <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-200"><Star size={12} fill="currentColor"/> เกิน 70%: 2 ดาว</span>
                        <span className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-200"><Star size={12} fill="currentColor"/> เกิน 50%: 1 ดาว</span>
                    </div>
                </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                <button onClick={() => setOnetTab('pending')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${onetTab === 'pending' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>
                    <BookOpen size={16} /> แบบทดสอบ ({pendingOnet.length})
                </button>
                <button onClick={() => setOnetTab('finished')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${onetTab === 'finished' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>
                    <CheckCircle size={16} /> เสร็จแล้ว ({finishedOnet.length})
                </button>
            </div>

            <div className="space-y-4">
                {onetTab === 'pending' ? (
                    <>
                        {pendingOnet.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-400">
                                <Trophy size={48} className="mx-auto mb-2 opacity-20"/>
                                <p>สุดยอด! คุณทำข้อสอบครบหมดแล้ว</p>
                            </div>
                        ) : (
                            pendingOnet.map(hw => (
                                <div key={hw.id} className="bg-white border-l-4 border-indigo-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="font-bold text-gray-800 text-lg mb-1">{hw.title}</div>
                                        <div className="flex gap-3 text-sm text-gray-500">
                                            <span className="flex items-center gap-1"><BookOpen size={14}/> {hw.subject}</span>
                                            <span className="flex items-center gap-1 text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full"><Star size={12} fill="currentColor"/> สูงสุด 3 ดาว</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleStartOnet(hw)}
                                        className="w-full md:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition active:scale-95"
                                    >
                                        เริ่มทำข้อสอบ
                                    </button>
                                </div>
                            ))
                        )}
                    </>
                ) : (
                    <>
                        {finishedOnet.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-400">
                                <History size={48} className="mx-auto mb-2 opacity-20"/>
                                <p>ยังไม่มีประวัติการทำข้อสอบ O-NET</p>
                            </div>
                        ) : (
                            finishedOnet.map(hw => {
                                const result = getLatestResult(hw.id);
                                const score = result?.score || 0;
                                const total = result?.totalQuestions || 0;
                                const percent = total > 0 ? Math.round((score/total)*100) : 0;
                                
                                return (
                                    <div key={hw.id} className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="flex-1">
                                            <div className="font-bold text-indigo-900 text-lg">{hw.title}</div>
                                            <div className="text-xs text-gray-500 mt-1 flex gap-3">
                                                <span>{hw.subject}</span>
                                                <span>•</span>
                                                <span>ทำเมื่อ: {result ? formatHistoryDateTime(result.timestamp) : '-'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end bg-gray-50 p-3 rounded-xl md:bg-transparent md:p-0">
                                            <div className="text-right">
                                                <div className="text-[10px] text-gray-400 uppercase font-bold">คะแนน</div>
                                                <div className={`font-black text-xl ${percent >= 50 ? 'text-green-600' : 'text-orange-500'}`}>
                                                    {score} <span className="text-sm text-gray-400">/{total}</span>
                                                </div>
                                            </div>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[10px] border-2 ${percent >= 80 ? 'bg-green-100 text-green-700 border-green-200' : percent >= 50 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                {percent}%
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </>
                )}
            </div>
        </div>
      );
  }

  // ... (Rest of component same as original)
  return (
    <div className="space-y-8 pb-20">
      {/* 1. Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10"><Star size={150} /></div>
        <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
                <div className="text-5xl bg-white/20 p-3 rounded-full backdrop-blur-sm shadow-inner relative">
                    {student.avatar}
                    <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-1 rounded-full border-2 border-white">
                        Lv.{student.level || 1}
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl font-bold mb-1">สวัสดี, {student.name.split(' ')[0]}!</h2>
                    <div className="flex gap-2 text-indigo-100 items-center text-sm">
                        <span>สะสมดาวเพื่อแลกของรางวัลสุดพิเศษ!</span>
                    </div>
                </div>
            </div>

            {/* 🟢 BUTTON TO SHOP */}
            <button 
                onClick={() => onNavigate('shop')}
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-yellow-900 font-bold py-3 px-6 rounded-xl shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-between"
            >
                <div className="flex items-center gap-2">
                    <ShoppingBag size={20} />
                    <span>ร้านค้าแลกรางวัล</span>
                </div>
                <div className="bg-white/30 px-3 py-1 rounded-lg text-sm flex items-center gap-1">
                    <Star size={14} fill="currentColor" /> {student.stars} ดาว
                </div>
            </button>
            
            <div className="flex gap-2 mt-4">
                <div className="text-center bg-white/10 rounded-lg p-2 flex-1">
                    <div className="text-[10px] text-indigo-200 uppercase mb-1">เล่นไปแล้ว</div>
                    <div className="flex items-center justify-center gap-1">
                        <Gamepad2 className="text-green-300" size={16} />
                        <span className="font-bold text-sm">{student.quizCount || 0} ครั้ง</span>
                    </div>
                </div>
                <div onClick={() => setView('inventory')} className="text-center bg-white/10 rounded-lg p-2 flex-1 cursor-pointer hover:bg-white/20 transition">
                    <div className="text-[10px] text-indigo-200 uppercase mb-1">กระเป๋าของฉัน</div>
                    <div className="flex items-center justify-center gap-1">
                        <Backpack className="text-orange-300" size={16} />
                        <span className="font-bold text-sm">{(student.inventory || []).length} ชิ้น</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 2. Pending General Assignments */}
      {pendingGeneral.length > 0 ? (
        <div className="bg-white border-l-4 border-orange-500 rounded-2xl p-6 shadow-md animate-fade-in">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Calendar size={20} /></div>
                ภารกิจที่ต้องทำ ({pendingGeneral.length})
            </h3>
            <div className="space-y-3">
                {pendingGeneral.map(hw => {
                    const deadlineDate = new Date(hw.deadline);
                    const now = new Date();
                    const isExpired = deadlineDate < now;
                    return (
                        <div key={hw.id} className={`p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center border gap-3 ${isExpired ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                            <div className="flex-1">
                                <div className="font-bold text-gray-800 text-lg flex items-center gap-2 flex-wrap">
                                  {hw.title || hw.subject} 
                                  {isExpired && (
                                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                                          <AlertCircle size={10}/> เลยกำหนด
                                      </span>
                                  )}
                                </div>
                                <div className={`text-sm mt-1 flex items-center gap-2 ${isExpired ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                                  <Clock size={14}/> {hw.questionCount} ข้อ • ส่งภายใน {formatDate(hw.deadline)}
                                </div>
                            </div>
                            <button 
                                onClick={() => onStartAssignment && onStartAssignment(hw)}
                                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2
                                  ${isExpired 
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-200' 
                                    : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200'}`}
                            >
                                {isExpired ? <><History size={16}/> ทำย้อนหลัง</> : 'เริ่มทำ'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
      ) : (
        (myHistory.length > 0) && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-green-700 shadow-sm text-center animate-fade-in">
                <div className="bg-green-100 p-4 rounded-full"><CheckCircle size={32} /></div>
                <div>
                    <h4 className="font-bold text-lg">ไม่มีการบ้านค้างแล้ว!</h4>
                    <p className="text-sm text-green-600">เยี่ยมมาก! คุณทำงานเสร็จครบทุกชิ้นแล้ว</p>
                </div>
            </div>
        )
      )}

      {/* 3. Your Subjects */}
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
                    </button>
                ))}
            </div>
        )}
      </div>

      {/* 4. Menu */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="text-yellow-500" /> เมนูเพิ่มเติม
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <button onClick={() => setView('onet')} className="group bg-white rounded-3xl p-4 shadow-sm hover:shadow-lg transition-all border-b-4 border-indigo-100 hover:border-indigo-500 hover:-translate-y-1 flex flex-col items-center justify-center gap-2 text-center h-32 relative overflow-hidden">
                <div className="bg-indigo-100 p-3 rounded-full text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors relative z-10">
                    <Trophy size={28} />
                </div>
                <span className="font-bold text-gray-700 text-sm relative z-10">พิชิต O-NET</span>
                {pendingOnet.length > 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{pendingOnet.length}</span>}
            </button>

            <button onClick={() => onNavigate('game')} className="group bg-white rounded-3xl p-4 shadow-sm hover:shadow-lg transition-all border-b-4 border-purple-100 hover:border-purple-500 hover:-translate-y-1 flex flex-col items-center justify-center gap-2 text-center h-32">
                <div className="bg-purple-100 p-3 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors"><Gamepad2 size={28} /></div>
                <span className="font-bold text-gray-700 text-sm">เกมแข่งขัน</span>
            </button>

            <button onClick={() => setView('history')} className="group bg-white rounded-3xl p-4 shadow-sm hover:shadow-lg transition-all border-b-4 border-yellow-100 hover:border-yellow-500 hover:-translate-y-1 flex flex-col items-center justify-center gap-2 text-center h-32">
                <div className="bg-yellow-100 p-3 rounded-full text-yellow-600 group-hover:bg-yellow-600 group-hover:text-white transition-colors"><History size={28} /></div>
                <span className="font-bold text-gray-700 text-sm">ประวัติส่งงาน</span>
            </button>

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
