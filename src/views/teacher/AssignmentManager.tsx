
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Assignment, Question, SubjectConfig, Teacher, Student, ExamResult } from '../../types';
import { Calendar, ArrowRight, RefreshCw, BrainCircuit, Save, Copy, Eye, Trash2, Loader2, CheckCircle, Clock, X, FileText } from 'lucide-react';
import { addAssignment, deleteAssignment, addQuestion, getQuestionsBySubject } from '../../services/api';
import { generateQuestionWithAI, GeneratedQuestion } from '../../services/aiService';

interface AssignmentManagerProps {
  assignments: Assignment[];
  subjects: SubjectConfig[];
  students: Student[];
  stats: ExamResult[];
  teacher: Teacher;
  canManageAll: boolean;
  myGrades: string[];
  onRefresh: () => void;
}

const GRADE_LABELS: Record<string, string> = { 
    'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6', 
    'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3', 'ALL': 'ทุกชั้น' 
};

const AssignmentManager: React.FC<AssignmentManagerProps> = ({ assignments, subjects, students, stats, teacher, canManageAll, myGrades, onRefresh }) => {
  const [assignStep, setAssignStep] = useState<1 | 2>(1);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignSubject, setAssignSubject] = useState<string>('');
  const [assignGrade, setAssignGrade] = useState<string>(canManageAll ? 'ALL' : (myGrades[0] || 'P6')); 
  const [assignCount, setAssignCount] = useState(10);
  const [assignDeadline, setAssignDeadline] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  
  const [assignAiTopic, setAssignAiTopic] = useState('');
  const [newlyGeneratedQuestions, setNewlyGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentModalTab, setAssignmentModalTab] = useState<'status' | 'questions'>('status');
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  React.useEffect(() => {
      if (subjects.length > 0 && !assignSubject) {
          setAssignSubject(subjects[0].name);
      }
  }, [subjects]);

  const normalizeId = (id: any) => String(id || '').trim();

  const handleAssignGenerateQuestions = async () => {
      if (!geminiApiKey) return alert("กรุณาใส่ API Key");
      if (!assignAiTopic) return alert("กรุณาระบุหัวข้อ");
      setIsGeneratingAi(true);
      try {
          const generated = await generateQuestionWithAI(assignSubject, assignGrade, assignAiTopic, geminiApiKey, 5);
          if (generated) setNewlyGeneratedQuestions(prev => [...prev, ...generated]);
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setIsGeneratingAi(false);
      }
  };

  const handleFinalizeAssignment = async () => {
      setIsProcessing(true);
      if (newlyGeneratedQuestions.length > 0) {
          const tid = normalizeId(teacher.id);
          for (const q of newlyGeneratedQuestions) {
              await addQuestion({ 
                  subject: assignSubject, 
                  grade: assignGrade, 
                  text: q.text, 
                  image: q.image || '', 
                  c1: q.c1, c2: q.c2, c3: q.c3, c4: q.c4, 
                  correct: q.correct, 
                  explanation: q.explanation, 
                  school: teacher.school, 
                  teacherId: tid 
              });
          }
      }
      
      let finalTitle = assignTitle;
      if (!finalTitle) finalTitle = `การบ้าน ${assignSubject}`;
      
      const success = await addAssignment(
          teacher.school, assignSubject, assignGrade, assignCount, assignDeadline, teacher.name, finalTitle
      );
      
      setIsProcessing(false);
      if (success) {
          alert('✅ สั่งการบ้านเรียบร้อยแล้ว');
          setAssignStep(1); setAssignDeadline(''); setAssignTitle(''); setNewlyGeneratedQuestions([]); setAssignAiTopic('');
          onRefresh();
      } else {
          alert('เกิดข้อผิดพลาดในการสร้างการบ้าน');
      }
  };

  const handleRedoAssignment = async (original: Assignment) => {
      if(!confirm(`ต้องการมอบหมายงาน "${original.title || original.subject}" ให้นักเรียนทำอีกครั้งใช่ไหม?`)) return;
      
      setIsProcessing(true);
      const date = new Date();
      date.setDate(date.getDate() + 3);
      const newDeadline = date.toISOString().split('T')[0];
      
      const success = await addAssignment(
          original.school,
          original.subject,
          original.grade || 'ALL',
          original.questionCount,
          newDeadline,
          original.createdBy,
          original.title ? `${original.title} (รอบเพิ่มเติม)` : `${original.subject} (รอบเพิ่มเติม)`
      );
      
      setIsProcessing(false);
      if(success) {
          alert('✅ มอบหมายงานซ้ำเรียบร้อยแล้ว');
          onRefresh();
      } else {
          alert('เกิดข้อผิดพลาด');
      }
  };

  const handleDeleteAssignment = async (id: string) => {
      if (!confirm('ยืนยันลบการบ้านนี้?')) return;
      setIsProcessing(true);
      await deleteAssignment(id);
      setIsProcessing(false);
      onRefresh();
  };

  const loadPreviewQuestions = async (subject: string) => {
      setLoadingPreview(true);
      const qs = await getQuestionsBySubject(subject);
      setPreviewQuestions(qs);
      setLoadingPreview(false);
  };

  const formatDate = (dateString: string) => { if (!dateString) return '-'; const date = new Date(dateString); if (isNaN(date.getTime())) return dateString; return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const countSubmitted = (assignmentId: string) => { const submittedStudentIds = new Set(stats.filter(r => r.assignmentId === assignmentId).map(r => r.studentId)); return submittedStudentIds.size; };

  const normalAssignments = assignments.filter(a => !a.title || !a.title.startsWith('[O-NET]'));

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
        {/* Create Form */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-8 shadow-sm">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Calendar className="text-orange-500"/> สั่งงานใหม่</h4>
            
            {subjects.length === 0 ? (
                <div className="text-red-500 text-center p-4 bg-red-50 rounded-xl border border-red-200 mb-4">
                    กรุณาเพิ่มวิชาก่อนสั่งงาน
                </div>
            ) : (
            <div>
                {assignStep === 1 && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-gray-500 block mb-1">ชื่อหัวข้อการบ้าน</label>
                                <input type="text" value={assignTitle} onChange={e => setAssignTitle(e.target.value)} placeholder={`เช่น การบ้าน ${assignSubject || '...'} ประจำสัปดาห์`} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-orange-200 outline-none"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">วิชา</label>
                                <select value={assignSubject} onChange={(e) => setAssignSubject(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 outline-none">
                                    {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">ระดับชั้น</label>
                                <select value={assignGrade} onChange={(e) => setAssignGrade(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white outline-none">
                                    {canManageAll ? <option value="ALL">ทุกชั้น</option> : null}
                                    {myGrades.map(g => (
                                        <option key={g} value={g}>{GRADE_LABELS[g] || g}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">จำนวนข้อ</label>
                                <input type="number" value={assignCount} onChange={(e) => setAssignCount(Number(e.target.value))} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white" min="5" max="50" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">ส่งภายใน</label>
                                <input type="date" value={assignDeadline} onChange={(e) => setAssignDeadline(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 bg-white" />
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button 
                                onClick={() => {
                                    if (!assignSubject || !assignDeadline) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
                                    setAssignStep(2);
                                }}
                                className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-orange-600 shadow-sm flex items-center gap-2"
                            >
                                ถัดไป: สร้างข้อสอบด้วย AI <ArrowRight size={18}/>
                            </button>
                        </div>
                    </div>
                )}
                {assignStep === 2 && (
                    <div className="animate-fade-in space-y-4">
                        <div className="bg-orange-100 p-4 rounded-xl border border-orange-200 text-orange-900 text-sm mb-4 flex justify-between items-center">
                            <span>สร้างข้อสอบสำหรับ: <b>{assignSubject}</b> ({assignCount} ข้อ)</span>
                            <button onClick={() => setAssignStep(1)} className="text-orange-700 underline text-xs">แก้ไขข้อมูล</button>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Google Gemini API Key</label>
                            <div className="flex gap-2">
                                <input type="password" value={geminiApiKey} onChange={(e) => { setGeminiApiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value); }} className="flex-1 p-2 border rounded-lg text-sm bg-white" placeholder="วาง API Key ที่นี่..." />
                            </div>
                        </div>

                        <div className="p-4 bg-white border rounded-xl shadow-sm">
                            <label className="block text-sm font-bold text-gray-700 mb-2">หัวข้อเรื่องที่ต้องการ (Topic)</label>
                            <div className="flex gap-2 mb-2">
                                <input 
                                    type="text" 
                                    value={assignAiTopic} 
                                    onChange={(e) => setAssignAiTopic(e.target.value)} 
                                    placeholder="ระบุเรื่องที่ต้องการให้ AI สร้างโจทย์ เช่น การบวกเลข, คำราชาศัพท์"
                                    className="flex-1 p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
                                />
                                <button 
                                    onClick={handleAssignGenerateQuestions}
                                    disabled={isGeneratingAi || !assignAiTopic}
                                    className="bg-purple-600 text-white px-4 rounded-xl font-bold shadow-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isGeneratingAi ? <RefreshCw className="animate-spin" size={18}/> : <BrainCircuit size={18}/>}
                                    สร้าง +5 ข้อ
                                </button>
                            </div>
                        </div>

                        <div className="border rounded-xl overflow-hidden bg-white">
                            <div className="bg-gray-100 p-3 flex justify-between items-center">
                                <span className="font-bold text-gray-700 text-sm">รายการข้อสอบ ({newlyGeneratedQuestions.length}/{assignCount})</span>
                                {newlyGeneratedQuestions.length > 0 && <button onClick={() => setNewlyGeneratedQuestions([])} className="text-xs text-red-500 hover:underline">ล้างทั้งหมด</button>}
                            </div>
                            <div className="max-h-60 overflow-y-auto p-2 space-y-2">
                                {newlyGeneratedQuestions.map((q, i) => (
                                    <div key={i} className="p-3 border rounded-lg bg-gray-50 text-sm relative group">
                                        <div className="font-bold text-gray-800 pr-6">{i+1}. {q.text}</div>
                                        <div className="text-gray-500 text-xs mt-1">ตอบ: {q.correct}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex gap-3 pt-4 border-t">
                            <button onClick={() => setAssignStep(1)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">ย้อนกลับ</button>
                            <button 
                                onClick={handleFinalizeAssignment}
                                disabled={isProcessing || newlyGeneratedQuestions.length === 0}
                                className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-600 disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {isProcessing ? 'กำลังบันทึก...' : <><Save size={20}/> บันทึกการบ้าน</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            )}
        </div>

        {/* List */}
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">รายการการบ้าน ({normalAssignments.length})</h3>
            <button onClick={onRefresh} className="text-sm bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200 transition"><RefreshCw size={14}/> รีเฟรช</button>
        </div>
        
        {normalAssignments.length === 0 ? (
            <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">ยังไม่มีการบ้าน</div>
        ) : (
            <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-orange-50 text-orange-900">
                        <tr><th className="p-3">หัวข้อการบ้าน</th><th className="p-3 text-center">วิชา (ชั้น)</th><th className="p-3 text-center">จำนวนข้อ</th><th className="p-3">ส่งภายใน</th><th className="p-3 text-center">ส่งแล้ว</th><th className="p-3 text-right">จัดการ</th></tr>
                    </thead>
                    <tbody>
                        {normalAssignments.slice().reverse().map((a) => {
                            const submittedCount = countSubmitted(a.id);
                            const eligibleStudents = students.filter(s => !a.grade || a.grade === 'ALL' || s.grade === a.grade);
                            const totalEligible = eligibleStudents.length;
                            const notSubmittedCount = totalEligible - submittedCount;
                            const isExpired = new Date(a.deadline) < new Date();
                            return (
                                <tr key={a.id} className="border-b hover:bg-gray-50 last:border-0 transition-colors">
                                    <td className="p-3 font-bold text-gray-900">
                                        {a.title || a.subject} 
                                    </td>
                                    <td className="p-3 text-center text-gray-600">
                                        {a.subject}
                                        {a.grade && a.grade !== 'ALL' && <div className="text-[10px] text-gray-400">{GRADE_LABELS[a.grade] || a.grade}</div>}
                                    </td>
                                    <td className="p-3 text-center font-mono">{a.questionCount}</td>
                                    <td className={`p-3 font-medium ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                                        {formatDate(a.deadline)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`px-2 py-1 rounded-full font-bold text-xs ${submittedCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                                                {submittedCount} / {totalEligible}
                                            </span>
                                            {notSubmittedCount > 0 && (
                                                <span className="text-[10px] text-red-500 font-medium mt-1">
                                                    (ยังไม่ส่ง {notSubmittedCount})
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 text-right flex justify-end gap-2">
                                        <button onClick={() => handleRedoAssignment(a)} className="text-purple-600 hover:bg-purple-50 p-1.5 rounded" title="มอบหมายซ้ำ"><Copy size={16}/></button>
                                        <button onClick={() => { setSelectedAssignment(a); setAssignmentModalTab('status'); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded" title="ดูรายละเอียด"><Eye size={16} /></button>
                                        <button onClick={() => handleDeleteAssignment(a.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="ลบ"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}

        {/* Modal - Rendered via Portal to avoid stacking context issues */}
        {selectedAssignment && createPortal(
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <FileText size={20} className="text-blue-600"/> 
                                {selectedAssignment.title || selectedAssignment.subject}
                            </h3>
                            <p className="text-xs text-gray-500">
                                {GRADE_LABELS[selectedAssignment.grade || 'ALL'] || selectedAssignment.grade} | 
                                ส่งภายใน: {formatDate(selectedAssignment.deadline)}
                            </p>
                        </div>
                        <button onClick={() => setSelectedAssignment(null)} className="text-gray-400 hover:text-red-500 p-2"><X size={24}/></button>
                    </div>
                    <div className="flex border-b bg-white">
                        <button onClick={() => setAssignmentModalTab('status')} className={`flex-1 py-3 text-sm font-bold transition ${assignmentModalTab === 'status' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}>สถานะการส่งงาน</button>
                        <button onClick={() => { setAssignmentModalTab('questions'); loadPreviewQuestions(selectedAssignment.subject); }} className={`flex-1 py-3 text-sm font-bold transition ${assignmentModalTab === 'questions' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}>ข้อสอบที่ใช้</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0 bg-white">
                    {assignmentModalTab === 'status' ? (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-blue-50 text-blue-900 font-bold sticky top-0"><tr><th className="p-4">รายชื่อนักเรียน</th><th className="p-4 text-center">สถานะ</th><th className="p-4 text-right">คะแนน</th><th className="p-4 text-right">ส่งเมื่อ</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {students
                                    .filter(s => !selectedAssignment.grade || selectedAssignment.grade === 'ALL' || s.grade === selectedAssignment.grade)
                                    .map(s => {
                                        const results = stats.filter(r => String(r.studentId) === String(s.id) && r.assignmentId === selectedAssignment.id);
                                        const result = results.length > 0 ? results[results.length - 1] : undefined;
                                        return (
                                            <tr key={s.id} className="hover:bg-gray-50">
                                                <td className="p-4 flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">{s.avatar}</div><div><div className="font-bold text-gray-800">{s.name}</div><div className="text-xs text-gray-400">ID: {s.id}</div></div></td>
                                                <td className="p-4 text-center">{result ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto"><CheckCircle size={12}/> ส่งแล้ว</span> : <span className="bg-gray-100 text-gray-400 px-2 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto"><Clock size={12}/> รอส่ง</span>}</td>
                                                <td className="p-4 text-right">{result ? <span className="font-bold text-blue-600 text-lg">{result.score}/{result.totalQuestions}</span> : '-'}</td>
                                                <td className="p-4 text-right text-gray-500 text-xs">{result ? new Date(result.timestamp).toLocaleString('th-TH') : '-'}</td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-6">
                            {loadingPreview ? <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline mr-2"/>กำลังโหลดข้อสอบ...</div> : (
                                <div className="space-y-4">
                                    {previewQuestions.filter(q => q.subject === selectedAssignment.subject && (!selectedAssignment.grade || selectedAssignment.grade === 'ALL' || q.grade === selectedAssignment.grade || q.grade === 'ALL')).slice(0, selectedAssignment.questionCount).map((q, i) => (
                                        <div key={i} className="p-4 border rounded-xl bg-gray-50 relative group hover:bg-white transition shadow-sm">
                                            <div className="font-bold text-gray-800 mb-2">ข้อที่ {i+1}</div>
                                            <div className="text-gray-700 mb-2">{q.text}</div>
                                            {q.image && <img src={q.image} className="h-32 object-contain rounded border bg-white mb-2" />}
                                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">{q.choices.map((c, idx) => (<div key={idx} className={`${(idx+1).toString() === q.correctChoiceId ? 'text-green-600 font-bold' : ''}`}>{idx+1}. {c.text}</div>))}</div>
                                            <div className="text-xs text-blue-500 mt-2 pt-2 border-t border-gray-200"><b>เฉลย:</b> {q.explanation}</div>
                                        </div>
                                    ))}
                                    {previewQuestions.length === 0 && <div className="text-center text-gray-400">ไม่พบข้อมูลข้อสอบ</div>}
                                </div>
                            )}
                        </div>
                    )}
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};

export default AssignmentManager;
