
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowLeft, Trophy, AlertCircle, Activity } from 'lucide-react';
import { ExamResult } from '../types';

interface StatsProps {
  examResults: ExamResult[];
  studentId: string;
  onBack: () => void;
}

const Stats: React.FC<StatsProps> = ({ examResults, studentId, onBack }) => {
  
  // คำนวณสถิติ
  const statsData = useMemo(() => {
    // 1. กรองเฉพาะของนักเรียนคนนี้
    const myResults = examResults.filter(r => r.studentId === studentId);

    // 2. เตรียมข้อมูลแยกรายวิชา
    // ดึงรายวิชาทั้งหมดที่นักเรียนเคยสอบ
    const uniqueSubjects = Array.from(new Set(myResults.map(r => r.subject)));
    
    const data = uniqueSubjects.map(subject => {
        const subjectResults = myResults.filter(r => r.subject === subject);
        const totalAttempts = subjectResults.length;
        
        // หาคะแนนเฉลี่ย (%)
        let avgScore = 0;
        if (totalAttempts > 0) {
            const totalPercent = subjectResults.reduce((sum, r) => sum + ((r.score / r.totalQuestions) * 100), 0);
            avgScore = Math.round(totalPercent / totalAttempts);
        }

        return {
            name: subject,
            attempts: totalAttempts,
            score: avgScore,
            color: getSubjectColor(subject)
        };
    });

    // 3. หาจุดเด่น / จุดด้อย
    const playedSubjects = data.filter(d => d.attempts > 0);
    const bestSubject = playedSubjects.length > 0 ? playedSubjects.reduce((prev, current) => (prev.score > current.score) ? prev : current) : null;
    const weakSubject = playedSubjects.length > 0 ? playedSubjects.reduce((prev, current) => (prev.score < current.score) ? prev : current) : null;

    return { chartData: data, totalExams: myResults.length, bestSubject, weakSubject };
  }, [examResults, studentId]);

  function getSubjectColor(subject: string) {
      const s = String(subject).toLowerCase();
      if (s.includes('คณิต') || s.includes('math')) return '#ef4444'; // Red
      if (s.includes('ไทย') || s.includes('thai')) return '#eab308'; // Yellow
      if (s.includes('วิทย์') || s.includes('science')) return '#22c55e'; // Green
      if (s.includes('อังกฤษ') || s.includes('english')) return '#3b82f6'; // Blue
      if (s.includes('สังคม') || s.includes('social')) return '#f97316'; // Orange
      if (s.includes('ศิลปะ') || s.includes('art')) return '#ec4899'; // Pink
      if (s.includes('คอม') || s.includes('computer')) return '#8b5cf6'; // Purple
      return '#6b7280'; // Gray default
  }

  return (
    <div className="space-y-6 pb-20">
      <button onClick={onBack} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
        <ArrowLeft size={20} /> กลับหน้าหลัก
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">สรุปผลการเรียนรู้</h2>
        <div className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">
            เข้าสอบทั้งหมด {statsData.totalExams} ครั้ง
        </div>
      </div>
      
      {/* กราฟคะแนนเฉลี่ย */}
      <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 h-80 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full opacity-50 blur-2xl -mr-10 -mt-10"></div>
        <h3 className="font-bold text-gray-500 mb-4 flex items-center gap-2 relative z-10">
            <Activity size={18} /> คะแนนเฉลี่ยรายวิชา (%)
        </h3>
        
        {statsData.totalExams > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
            <BarChart data={statsData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{fill: '#6b7280', fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                cursor={{fill: '#f9fafb'}}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                formatter={(value: number) => [`${value}%`, 'คะแนนเฉลี่ย']}
                />
                <Bar dataKey="score" radius={[8, 8, 8, 8]} barSize={40}>
                {statsData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                ))}
                </Bar>
            </BarChart>
            </ResponsiveContainer>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <p>ยังไม่มีข้อมูลการสอบ</p>
            </div>
        )}
      </div>

      {/* สรุปจุดเด่น จุดด้อย */}
      {statsData.totalExams > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statsData.bestSubject && (
                <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-2xl shadow-sm border border-green-100 flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-full text-green-600">
                        <Trophy size={24} />
                    </div>
                    <div>
                        <span className="text-green-600 text-xs font-bold uppercase tracking-wider">วิชาจุดแข็ง</span>
                        <p className="text-xl font-bold text-gray-800">{statsData.bestSubject.name}</p>
                        <p className="text-sm text-gray-500">คะแนนเฉลี่ย {statsData.bestSubject.score}%</p>
                    </div>
                </div>
            )}
            
            {statsData.weakSubject && statsData.weakSubject.score < 50 && (
                <div className="bg-gradient-to-br from-red-50 to-white p-5 rounded-2xl shadow-sm border border-red-100 flex items-center gap-4">
                    <div className="bg-red-100 p-3 rounded-full text-red-500">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <span className="text-red-500 text-xs font-bold uppercase tracking-wider">ควรพัฒนา</span>
                        <p className="text-xl font-bold text-gray-800">{statsData.weakSubject.name}</p>
                        <p className="text-sm text-gray-500">คะแนนเฉลี่ย {statsData.weakSubject.score}%</p>
                    </div>
                </div>
            )}
          </div>
      )}

      {/* รายละเอียดรายวิชา */}
      <h3 className="text-lg font-bold text-gray-700 mt-4">สถิติการเข้าสอบ</h3>
      <div className="grid grid-cols-2 gap-3">
        {statsData.chartData.map((sub) => (
            <div key={sub.name} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                <div>
                    <div className="font-bold text-gray-800">{sub.name}</div>
                    <div className="text-xs text-gray-400">เฉลี่ย {sub.score}%</div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-black text-blue-600">{sub.attempts}</div>
                    <div className="text-[10px] text-gray-400">ครั้ง</div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default Stats;
