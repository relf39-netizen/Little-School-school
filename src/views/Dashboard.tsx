
import React, { useState } from 'react';
import { BookOpen, Gamepad2, BarChart3, Star, Calendar, CheckCircle, AlertCircle, History, ArrowLeft, Clock } from 'lucide-react';
import { Student, Assignment, ExamResult } from '../types';

interface DashboardProps {
  student: Student;
  assignments?: Assignment[]; 
  examResults?: ExamResult[]; 
  onNavigate: (page: string) => void;
  onStartAssignment?: (assignment: Assignment) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ student, assignments = [], examResults = [], onNavigate, onStartAssignment }) => {
  // state สำหรับสลับหน้าระหว่าง 'main' (หน้าหลัก) กับ 'history' (ประวัติ)
  const [view, setView] = useState<'main' | 'history'>('main');

  // กรองข้อมูล
  const myAssignments = assignments.filter(a => a.school === student.school);
  
  const finishedAssignments = myAssignments.filter(a => examResults.some(r => r.assignmentId === a.id));
  const pendingAssignments = myAssignments.filter(a => !examResults.some(r => r.assignmentId === a.id));

  // เรียงลำดับ
  pendingAssignments.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  finishedAssignments.sort((a, b) => {
      const resultA = examResults.find(r => r.assignmentId === a.id);
      const resultB = examResults.find(r => r.assignmentId === b.id);
      return (resultB?.timestamp || 0) - (resultA?.timestamp || 0);
  });

  // --- ส่วนแสดงผลหน้ารายละเอียดประวัติ ---
  if (view === 'history') {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <button onClick={() => setView('main')} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
          <ArrowLeft size={20} /> กลับหน้าแดชบอร์ด
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
            <History size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">ประวัติการส่งงาน</h2>
            <p className="text-gray-500">รายการการบ้านที่ทำเสร็จแล้ว ({finishedAssignments.length} รายการ)</p>
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
                     <div className="font-bold text-gray-800 text-lg">การบ้าน {hw.questionCount} ข้อ</div>
                     <div className="text-sm text-gray-500">กำหนดส่งเดิม: {hw.deadline}</div>
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
    <div className="space-y-6 pb-20">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10"><Star size={150} /></div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="text-5xl bg-white/20 p-3 rounded-full backdrop-blur-sm shadow-inner">{student.avatar}</div>
          <div>
            <h2 className="text-2xl font-bold mb-1">สวัสดี, {student.name.split(' ')[0]}!</h2>
            <p className="text-blue-100">วันนี้เรามาฝึกฝนกันเถอะ</p>
            <div className="flex items-center gap-2 mt-2 bg-black/20 w-fit px-3 py-1 rounded-full"><Star className="text-yellow-300 fill-yellow-300" size={16} /><span className="font-bold">{student.stars} คะแนนสะสม</span></div>
          </div>
        </div>
      </div>

      {/* 📝 กล่องการบ้านที่ต้องทำ (Pending) */}
      {pendingAssignments.length > 0 ? (
        <div className="bg-white border-l-4 border-orange-500 rounded-2xl p-6 shadow-md animate-fade-in">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Calendar size={20} /></div>
                การบ้านที่ต้องทำ ({pendingAssignments.length})
            </h3>
            <div className="space-y-3">
                {pendingAssignments.map(hw => {
                    const isExpired = new Date(hw.deadline) < new Date();
                    return (
                        <div key={hw.id} className={`p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center border gap-3 ${isExpired ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                            <div>
                                <div className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                  {hw.subject} 
                                  {isExpired && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">เลยกำหนด</span>}
                                </div>
                                <div className={`text-sm ${isExpired ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                                  จำนวน {hw.questionCount} ข้อ • ส่งภายใน {hw.deadline}
                                </div>
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
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-center gap-2 text-green-700">
           <CheckCircle size={20} /> เยี่ยมมาก! คุณไม่มีการบ้านค้าง
        </div>
      )}

      {/* Grid เมนูหลัก */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* ปุ่มฝึกทำข้อสอบ */}
        <button onClick={() => onNavigate('select-subject')} className="group relative bg-white rounded-3xl p-6 shadow-md hover:shadow-xl transition-all border-b-4 border-blue-100 hover:border-blue-500 hover:-translate-y-1 text-left">
          <div className="bg-blue-100 w-14 h-14 rounded-2xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors"><BookOpen size={32} /></div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">ฝึกทำข้อสอบ</h3>
          <p className="text-gray-500 text-sm">ฝึกฝนวิชาคณิตศาสตร์ ภาษาไทย วิทยาศาสตร์ และภาษาอังกฤษ</p>
        </button>

        {/* ปุ่มเกมแข่งขัน */}
        <button onClick={() => onNavigate('game')} className="group relative bg-white rounded-3xl p-6 shadow-md hover:shadow-xl transition-all border-b-4 border-purple-100 hover:border-purple-500 hover:-translate-y-1 text-left">
          <div className="bg-purple-100 w-14 h-14 rounded-2xl flex items-center justify-center text-purple-600 mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors"><Gamepad2 size={32} /></div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">เกมแข่งขัน</h3>
          <p className="text-gray-500 text-sm">ประลองความเร็วกับเพื่อนๆ ในห้อง แบบเรียลไทม์</p>
          <div className="absolute top-6 right-6 flex gap-1"><span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span><span className="text-green-600 text-xs font-bold">LIVE</span></div>
        </button>

        {/* ปุ่มดูประวัติการส่งงาน (ใหม่) */}
        <button onClick={() => setView('history')} className="group bg-white rounded-3xl p-6 shadow-md hover:shadow-xl transition-all border-b-4 border-yellow-100 hover:border-yellow-500 hover:-translate-y-1 flex items-center gap-4">
          <div className="bg-yellow-100 w-12 h-12 rounded-2xl flex items-center justify-center text-yellow-600 group-hover:bg-yellow-600 group-hover:text-white transition-colors"><History size={24} /></div>
          <div><h3 className="text-lg font-bold text-gray-800">ประวัติการส่งงาน</h3><p className="text-gray-500 text-sm">ดูรายการการบ้านที่ทำเสร็จแล้ว ({finishedAssignments.length})</p></div>
        </button>

        {/* ปุ่มดูสถิติ */}
        <button onClick={() => onNavigate('stats')} className="group bg-white rounded-3xl p-6 shadow-md hover:shadow-xl transition-all border-b-4 border-green-100 hover:border-green-500 hover:-translate-y-1 flex items-center gap-4">
          <div className="bg-green-100 w-12 h-12 rounded-2xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors"><BarChart3 size={24} /></div>
          <div><h3 className="text-lg font-bold text-gray-800">ดูสถิติผลการเรียน</h3><p className="text-gray-500 text-sm">เช็คพัฒนาการและจุดที่ต้องปรับปรุง</p></div>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
    