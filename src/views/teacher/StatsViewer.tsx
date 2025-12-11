
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Student, ExamResult, SubjectConfig } from '../../types';
import { BarChart2, RefreshCw, ArrowLeft, GraduationCap, Search, Loader2, X } from 'lucide-react';

interface StatsViewerProps {
  students: Student[];
  stats: ExamResult[];
  availableSubjects: SubjectConfig[];
  canManageAll: boolean;
  myGrades: string[];
  onRefresh: () => void;
}

const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3'];
const GRADE_LABELS: Record<string, string> = { 
    'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6', 
    'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3', 'ALL': 'ทุกชั้น' 
};

const StatsViewer: React.FC<StatsViewerProps> = ({ students, stats, availableSubjects, canManageAll, myGrades, onRefresh }) => {
  const [viewLevel, setViewLevel] = useState<'GRADES' | 'LIST'>('GRADES');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string | null>(null);
  const [selectedStudentForStats, setSelectedStudentForStats] = useState<Student | null>(null);

  React.useEffect(() => {
    if (!canManageAll && myGrades.length === 1) {
        setViewLevel('LIST');
        setSelectedGradeFilter(myGrades[0]);
    }
  }, [canManageAll, myGrades]);

  const getGradeStats = (grade: string) => {
      const gradeStudents = students.filter(s => s.grade === grade);
      const studentIds = gradeStudents.map(s => s.id);
      const gradeResults = stats.filter(r => studentIds.includes(String(r.studentId)));
      
      let totalScorePercent = 0; 
      let count = 0;
      
      const distinctSubjects = new Set<string>();
      availableSubjects.forEach(s => {
          if (s.grade === 'ALL' || s.grade === grade) distinctSubjects.add(s.name);
      });
      gradeResults.forEach(r => distinctSubjects.add(r.subject));

      const subjectMap: Record<string, { sumPct: number, count: number }> = {};
      distinctSubjects.forEach(sub => { subjectMap[sub] = { sumPct: 0, count: 0 }; });

      gradeResults.forEach(r => {
          const totalQ = Number(r.totalQuestions); 
          const score = Number(r.score) || 0;
          if (totalQ > 0) { 
              const pct = (score / totalQ) * 100;
              totalScorePercent += pct; 
              count++; 
              if(subjectMap[r.subject]) {
                  subjectMap[r.subject].sumPct += pct;
                  subjectMap[r.subject].count++;
              }
          }
      });
      
      const avg = count > 0 ? Math.round(totalScorePercent / count) : 0;
      const subjectStats = Object.keys(subjectMap).map(sub => ({
          name: sub,
          avg: subjectMap[sub].count > 0 ? Math.round(subjectMap[sub].sumPct / subjectMap[sub].count) : 0,
          hasData: subjectMap[sub].count > 0
      })).sort((a,b) => {
          if (a.hasData && !b.hasData) return -1;
          if (!a.hasData && b.hasData) return 1;
          return b.avg - a.avg;
      });

      return { studentCount: gradeStudents.length, avgScore: avg, activityCount: count, subjectStats };
  };

  const getStudentOverallStats = (studentId: string) => {
    const studentResults = stats.filter(r => String(r.studentId) === String(studentId));
    const attempts = studentResults.length;
    let average = 0;
    if (attempts > 0) {
        const sum = studentResults.reduce((acc, curr) => {
            const totalQ = Number(curr.totalQuestions);
            const score = Number(curr.score) || 0;
            if (totalQ > 0) return acc + ((score / totalQ) * 100);
            return acc;
        }, 0);
        average = Math.round(sum / attempts);
    }
    return { attempts, average: (isNaN(average) || !isFinite(average)) ? 0 : average };
  };

  const getStudentSubjectStats = (studentId: string) => {
    const studentResults = stats.filter(r => String(r.studentId) === String(studentId));
    const subjectsMap: any = {};
    studentResults.forEach(r => {
        if (!subjectsMap[r.subject]) subjectsMap[r.subject] = { name: r.subject, attempts: 0, totalScore: 0 };
        const totalQ = Number(r.totalQuestions);
        const score = Number(r.score) || 0;
        if (totalQ > 0) subjectsMap[r.subject].totalScore += (score / totalQ) * 100;
        subjectsMap[r.subject].attempts++;
    });
    return Object.values(subjectsMap).map((s:any) => {
        let avg = s.attempts > 0 ? Math.round(s.totalScore / s.attempts) : 0;
        if (isNaN(avg) || !isFinite(avg)) avg = 0;
        return { ...s, average: avg };
    });
  };

  const filteredStudents = students.filter(s => 
    selectedGradeFilter ? s.grade === selectedGradeFilter : true
  );

  return (
    <div className="animate-fade-in">
        {selectedStudentForStats && createPortal(
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-fade-in">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <span className="text-3xl">{selectedStudentForStats.avatar}</span>
                          <div>
                              <h3 className="font-bold text-lg">{selectedStudentForStats.name}</h3>
                              <p className="text-xs opacity-80">รหัส: {selectedStudentForStats.id} | ระดับ: {GRADE_LABELS[selectedStudentForStats.grade || ''] || selectedStudentForStats.grade}</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedStudentForStats(null)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={20}/></button>
                  </div>
                  <div className="p-4 overflow-y-auto bg-gray-50 flex-1">
                      <h4 className="font-bold text-gray-700 mb-2">คะแนนรายวิชา</h4>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                          {getStudentSubjectStats(selectedStudentForStats.id).map((s: any) => (
                              <div key={s.name} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                                  <div>
                                      <div className="text-sm font-bold text-gray-800">{s.name}</div>
                                      <div className="text-xs text-gray-500">สอบ {s.attempts} ครั้ง</div>
                                  </div>
                                  <div className="text-right">
                                      <div className={`text-lg font-black ${s.average >= 80 ? 'text-green-600' : s.average >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{s.average}%</div>
                                      <div className="text-[10px] text-gray-400">เฉลี่ย</div>
                                  </div>
                              </div>
                          ))}
                      </div>
                      <h4 className="font-bold text-gray-700 mb-2">ประวัติการสอบล่าสุด</h4>
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-gray-100 text-gray-600"><tr><th className="p-2">วิชา</th><th className="p-2 text-center">คะแนน</th><th className="p-2 text-right">วันที่</th></tr></thead>
                              <tbody>
                                  {stats.filter(r => String(r.studentId) === String(selectedStudentForStats.id)).slice().reverse().slice(0, 10).map((r, i) => (
                                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                          <td className="p-2">{r.subject}</td>
                                          <td className="p-2 text-center"><span className="font-bold">{r.score}</span><span className="text-gray-400">/{r.totalQuestions}</span></td>
                                          <td className="p-2 text-right text-xs text-gray-500">{new Date(r.timestamp).toLocaleDateString()}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>,
          document.body
        )}

        {viewLevel === 'GRADES' && (!(!canManageAll && myGrades.length === 1)) ? (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><BarChart2 className="text-green-600"/> เลือกชั้นเรียน (ดูผลการเรียน)</h3>
                    <button onClick={onRefresh} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg text-gray-600 flex items-center gap-1"><RefreshCw size={14}/> รีเฟรช</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {(canManageAll ? GRADES : myGrades).map(g => {
                        const gStats = getGradeStats(g);
                        if (gStats.studentCount === 0) return null;
                        return (
                            <button key={g} onClick={() => { setSelectedGradeFilter(g); setViewLevel('LIST'); }} className="bg-white hover:bg-green-50 p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-green-200 text-left group">
                                <div className="text-xs font-bold text-gray-400 mb-1">{GRADE_LABELS[g]}</div>
                                <div className="flex justify-between items-end">
                                    <div className="text-2xl font-black text-gray-800 group-hover:text-green-700">{gStats.avgScore}%</div>
                                    <div className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full group-hover:bg-white">{gStats.studentCount} คน</div>
                                </div>
                                <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-green-500 h-full" style={{width: `${gStats.avgScore}%`}}></div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        ) : (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                            {(!(!canManageAll && myGrades.length === 1)) && (
                                <button onClick={() => { setViewLevel('GRADES'); setSelectedGradeFilter(null); }} className="flex items-center gap-1 text-sm text-green-600 hover:underline mb-1">
                                <ArrowLeft size={16}/> เลือกชั้นเรียนอื่น
                                </button>
                            )}
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <BarChart2 className="text-green-600"/> ผลการเรียนชั้น {GRADE_LABELS[selectedGradeFilter || '']}
                            </h3>
                    </div>
                    <button onClick={onRefresh} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg text-gray-600 flex items-center gap-1"><RefreshCw size={14}/> รีเฟรช</button>
                </div>

                <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                            <tr>
                                <th className="p-4">นักเรียน</th>
                                <th className="p-4 text-center">ระดับชั้น</th>
                                <th className="p-4 text-center">เข้าสอบ (ครั้ง)</th>
                                <th className="p-4 text-right">คะแนนเฉลี่ยรวม</th>
                                <th className="p-4 text-center">รายละเอียด</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredStudents.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">ไม่มีนักเรียนในชั้นนี้</td></tr> :
                            filteredStudents.map(s => {
                                const overall = getStudentOverallStats(s.id);
                                return (
                                    <tr key={s.id} className="hover:bg-blue-50 transition-colors">
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">{s.avatar}</div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{s.name}</div>
                                                    <div className="text-xs text-gray-400 font-mono">ID: {s.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{GRADE_LABELS[s.grade || ''] || s.grade}</span></td>
                                        <td className="p-3 text-center font-mono text-gray-600">{overall.attempts}</td>
                                        <td className="p-3 text-right">
                                            {overall.attempts > 0 ? (
                                                <span className={`font-black text-lg ${overall.average >= 80 ? 'text-green-600' : overall.average >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                                    {overall.average}%
                                                </span>
                                            ) : <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => setSelectedStudentForStats(s)} className="text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition"><Search size={18}/></button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};

export default StatsViewer;
