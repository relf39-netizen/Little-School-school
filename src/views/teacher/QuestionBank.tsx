
import React, { useState, useEffect } from 'react';
import { Question, SubjectConfig, Teacher } from '../../types';
import { FileText, Wand2, CheckCircle, UserCog, Edit, Trash2, ChevronLeft, ChevronRight, Book, Loader2, Key, RefreshCw, Save, PlusCircle, X } from 'lucide-react';
import { addQuestion, editQuestion, deleteQuestion, getQuestionsBySubject } from '../../services/api';
import { generateQuestionWithAI, GeneratedQuestion } from '../../services/aiService';

interface QuestionBankProps {
  subjects: SubjectConfig[];
  teacher: Teacher;
  canManageAll: boolean;
  myGrades: string[];
}

const ITEMS_PER_PAGE = 5;
const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3'];
const GRADE_LABELS: Record<string, string> = { 
    'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6', 
    'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3', 'ALL': 'ทุกชั้น' 
};

const QuestionBank: React.FC<QuestionBankProps> = ({ subjects, teacher, canManageAll, myGrades }) => {
  const [qSubject, setQSubject] = useState<string>('');
  const [qGrade, setQGrade] = useState<string>(canManageAll ? 'P6' : (myGrades[0] || 'P6'));
  const [qBankSubject, setQBankSubject] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showMyQuestionsOnly, setShowMyQuestionsOnly] = useState(false); // Default to false to see all questions first if wanted
  const [qBankPage, setQBankPage] = useState(1);
  
  // Form State
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qText, setQText] = useState('');
  const [qImage, setQImage] = useState('');
  const [qChoices, setQChoices] = useState({c1:'', c2:'', c3:'', c4:''});
  const [qCorrect, setQCorrect] = useState('1');
  const [qExplain, setQExplain] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // AI Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiPreviewQuestions, setAiPreviewQuestions] = useState<GeneratedQuestion[]>([]);

  useEffect(() => {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) setGeminiApiKey(savedKey);
      if (subjects.length > 0) {
          setQSubject(subjects[0].name);
      }
  }, [subjects]);

  const loadQuestions = async () => {
      if (qBankSubject) {
          setLoadingQuestions(true);
          try {
              const data = await getQuestionsBySubject(qBankSubject);
              setQuestions(data);
          } catch (e) {
              console.error("Failed to load questions", e);
          } finally {
              setLoadingQuestions(false);
          }
      } else {
          setQuestions([]);
      }
  };

  useEffect(() => {
      loadQuestions();
  }, [qBankSubject]);

  const normalizeId = (id: any) => String(id || '').trim();

  const handleSaveQuestion = async () => {
      if (!qText || !qChoices.c1 || !qChoices.c2 || !qSubject) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      setIsProcessing(true);
      const questionPayload = { 
          id: editingQuestionId, 
          subject: qSubject, 
          grade: qGrade, 
          text: qText, 
          image: qImage, 
          c1: qChoices.c1, 
          c2: qChoices.c2, 
          c3: qChoices.c3, 
          c4: qChoices.c4, 
          correct: qCorrect, 
          explanation: qExplain, 
          school: teacher.school, 
          teacherId: normalizeId(teacher.id) 
      };
      let success = editingQuestionId ? await editQuestion(questionPayload) : await addQuestion(questionPayload);
      setIsProcessing(false);
      
      if (success) {
          alert('✅ บันทึกสำเร็จ');
          setQText(''); setQChoices({c1:'', c2:'', c3:'', c4:''}); setQExplain(''); setEditingQuestionId(null);
          if (qBankSubject === qSubject) loadQuestions();
      } else {
          alert('บันทึกไม่สำเร็จ');
      }
  };

  const handleDeleteQuestion = async (id: string) => {
      if(!confirm('ลบข้อสอบนี้?')) return;
      setIsProcessing(true);
      await deleteQuestion(id);
      setIsProcessing(false);
      if (qBankSubject) loadQuestions();
  };

  const handleEditQuestion = (q: Question) => {
      setEditingQuestionId(q.id);
      setQSubject(q.subject);
      setQGrade(q.grade || 'P6');
      setQText(q.text);
      setQImage(q.image || '');
      setQCorrect(String(q.correctChoiceId));
      setQExplain(q.explanation);
      setQChoices({ c1: q.choices[0]?.text || '', c2: q.choices[1]?.text || '', c3: q.choices[2]?.text || '', c4: q.choices[3]?.text || '' });
      document.getElementById('question-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAiGenerate = async () => {
      if (!aiTopic || !geminiApiKey) return alert("กรุณาระบุหัวข้อและ API Key");
      setIsGeneratingAi(true);
      try {
          const generated = await generateQuestionWithAI(qSubject, qGrade, aiTopic, geminiApiKey, aiCount);
          if (generated) setAiPreviewQuestions(prev => [...prev, ...generated]);
      } catch (e: any) {
          alert("เกิดข้อผิดพลาด: " + (e?.message || JSON.stringify(e)));
      } finally {
          setIsGeneratingAi(false);
      }
  };

  const handleSaveAiQuestions = async () => {
      if (aiPreviewQuestions.length === 0) return;
      setIsProcessing(true);
      const tid = normalizeId(teacher.id);
      for (const q of aiPreviewQuestions) {
          await addQuestion({ subject: qSubject, grade: qGrade, text: q.text, image: q.image || '', c1: q.c1, c2: q.c2, c3: q.c3, c4: q.c4, correct: q.correct, explanation: q.explanation, school: teacher.school, teacherId: tid });
      }
      setIsProcessing(false);
      alert(`✅ บันทึกสำเร็จ`);
      setAiPreviewQuestions([]);
      setShowAiModal(false);
      if (qBankSubject === qSubject) loadQuestions();
  };

  const getFilteredQuestions = () => { 
      const currentTid = normalizeId(teacher.id);
      let result = questions;
      if (showMyQuestionsOnly) {
          if (!currentTid) result = [];
          else result = result.filter(q => normalizeId(q.teacherId) === currentTid);
      }
      return result;
  };
  
  const filteredQuestions = getFilteredQuestions();
  const currentQuestions = filteredQuestions.slice((qBankPage - 1) * ITEMS_PER_PAGE, qBankPage * ITEMS_PER_PAGE);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FileText className="text-blue-600" /> คลังข้อสอบ</h3>
            <div className="flex gap-2">
                <button onClick={() => { setShowAiModal(true); setAiPreviewQuestions([]); }} className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition flex items-center gap-2">
                    <Wand2 size={16}/> AI สร้างข้อสอบ
                </button>
                <button onClick={() => { setShowMyQuestionsOnly(!showMyQuestionsOnly); setQBankPage(1); }} className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition ${showMyQuestionsOnly ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
                    {showMyQuestionsOnly ? <CheckCircle size={16}/> : <UserCog size={16}/>} ของฉัน
                </button>
            </div>
        </div>

        {/* AI Modal */}
        {showAiModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-2xl">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Wand2 size={20}/> AI สร้างข้อสอบลงคลัง</h3>
                      <button onClick={() => setShowAiModal(false)} className="hover:bg-white/20 p-1 rounded"><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 mb-4 text-sm text-purple-700">
                          วิชา: <b>{qSubject}</b> | ชั้น: <b>{GRADE_LABELS[qGrade] || qGrade}</b>
                      </div>
                      <div className="space-y-4">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Google Gemini API Key</label>
                              <div className="flex gap-2">
                                  <input type="password" value={geminiApiKey} onChange={(e) => { setGeminiApiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value); }} className="flex-1 p-2 border rounded-lg text-sm" placeholder="วาง API Key ที่นี่..." />
                                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200"><Key size={18}/></a>
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">หัวข้อเรื่อง (Topic)</label>
                              <input type="text" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="เช่น การบวกเลข, สัตว์เลี้ยงลูกด้วยนม..." />
                          </div>
                          <button onClick={handleAiGenerate} disabled={isGeneratingAi} className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-purple-200 disabled:opacity-50 flex justify-center items-center gap-2">
                              {isGeneratingAi ? <RefreshCw className="animate-spin"/> : <Wand2 size={18}/>} 
                              {isGeneratingAi ? 'กำลังสร้าง...' : 'เริ่มสร้างข้อสอบ'}
                          </button>
                      </div>
                      
                      {aiPreviewQuestions.length > 0 && (
                          <div className="mt-6 border-t pt-4">
                              <h4 className="font-bold text-gray-800 mb-2 flex justify-between items-center">
                                  <span>ตัวอย่างที่สร้างได้ ({aiPreviewQuestions.length} ข้อ)</span>
                                  <button onClick={() => setAiPreviewQuestions([])} className="text-xs text-red-500 underline">ล้างทั้งหมด</button>
                              </h4>
                              <div className="bg-gray-50 rounded-lg p-2 max-h-40 overflow-y-auto mb-4 border border-gray-200">
                                  {aiPreviewQuestions.map((q, i) => (
                                      <div key={i} className="text-xs border-b last:border-0 p-2 text-gray-600">
                                          {i+1}. {q.text} <span className="text-green-600 font-bold">(ตอบ: {q.correct})</span>
                                      </div>
                                  ))}
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={handleAiGenerate} disabled={isGeneratingAi} className="flex-1 py-3 border-2 border-purple-500 text-purple-600 rounded-xl font-bold hover:bg-purple-50">+ เพิ่มอีก {aiCount} ข้อ</button>
                                  <button onClick={handleSaveAiQuestions} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold shadow-lg hover:bg-green-600">บันทึกลงคลัง</button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
        )}

        <div id="question-form" className={`bg-white p-6 rounded-2xl shadow-sm border mb-8 ${editingQuestionId ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
            <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-gray-800 flex items-center gap-2">
                {editingQuestionId ? '✏️ แก้ไขข้อสอบ' : '➕ เพิ่มข้อสอบใหม่ (Manual)'}
            </h4>
            </div>
            
            {subjects.length === 0 ? (
                <div className="text-red-500 text-center p-4">กรุณาสร้างรายวิชาก่อนเพิ่มข้อสอบด้วยตนเอง</div>
            ) : (
            <>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">วิชา</label>
                <select value={qSubject} onChange={(e)=>setQSubject(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                        <option value="">-- เลือกวิชา --</option>
                        {subjects.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                </div>
                <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">ระดับชั้น</label>
                {canManageAll ? (
                    <select value={qGrade} onChange={(e)=>setQGrade(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                        {GRADES.map(g=><option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
                    </select>
                ) : (
                    <select value={qGrade} onChange={(e)=>setQGrade(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                        {myGrades.map(g => (
                            <option key={g} value={g}>{GRADE_LABELS[g] || g}</option>
                        ))}
                    </select>
                )}
                </div>
            </div>
            <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1">โจทย์</label>
                <textarea value={qText} onChange={(e)=>setQText(e.target.value)} className="w-full p-2 border rounded-lg" rows={2} placeholder="โจทย์..."></textarea>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <input type="text" value={qChoices.c1} onChange={(e)=>setQChoices({...qChoices, c1:e.target.value})} placeholder="ก." className="p-2 border rounded-lg"/>
                <input type="text" value={qChoices.c2} onChange={(e)=>setQChoices({...qChoices, c2:e.target.value})} placeholder="ข." className="p-2 border rounded-lg"/>
                <input type="text" value={qChoices.c3} onChange={(e)=>setQChoices({...qChoices, c3:e.target.value})} placeholder="ค." className="p-2 border rounded-lg"/>
                <input type="text" value={qChoices.c4} onChange={(e)=>setQChoices({...qChoices, c4:e.target.value})} placeholder="ง." className="p-2 border rounded-lg"/>
            </div>
            <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1">ข้อถูก</label>
                <select value={qCorrect} onChange={(e)=>setQCorrect(e.target.value)} className="w-full p-2 border rounded-lg">
                <option value="1">ก.</option><option value="2">ข.</option><option value="3">ค.</option><option value="4">ง.</option>
                </select>
            </div>
            <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1">เฉลยละเอียด</label>
                <textarea value={qExplain} onChange={(e)=>setQExplain(e.target.value)} className="w-full p-2 border rounded-lg" rows={1}></textarea>
            </div>
            
            <div className="flex gap-2">
                {editingQuestionId && (
                    <button onClick={() => { setEditingQuestionId(null); setQText(''); }} className="px-4 py-2 bg-gray-200 rounded-xl font-bold">ยกเลิก</button>
                )}
                <button onClick={handleSaveQuestion} disabled={isProcessing} className={`flex-1 py-2 rounded-xl font-bold text-white flex items-center justify-center gap-2 ${editingQuestionId ? 'bg-orange-500' : 'bg-blue-600'}`}>
                    {isProcessing ? 'บันทึก...' : (editingQuestionId ? 'บันทึกแก้ไข' : 'บันทึกข้อสอบ')}
                </button>
            </div>
            </>
            )}
        </div>

        {subjects.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
                <div className="text-xs font-bold text-gray-500 mr-2 flex items-center">เลือกวิชาเพื่อดูข้อสอบ:</div>
                {subjects.map(sub => (
                <button 
                    key={sub.id}
                    onClick={() => { setQBankSubject(sub.name); setQBankPage(1); }}
                    className={`px-4 py-2 rounded-full border transition-all ${
                        qBankSubject === sub.name 
                        ? 'bg-blue-100 text-blue-700 border-blue-300 font-bold shadow-sm' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    {sub.name}
                </button>
                ))}
            </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[200px]">
            {!qBankSubject ? (
                <div className="flex flex-col items-center justify-center p-10 text-gray-400">
                    <Book size={40} className="mb-2 opacity-20"/>
                    <p>กรุณาเลือกวิชาด้านบนเพื่อโหลดข้อสอบ</p>
                </div>
            ) : loadingQuestions ? (
                    <div className="flex flex-col items-center justify-center p-10 text-blue-500">
                    <Loader2 className="animate-spin mb-2" size={32}/>
                    <p>กำลังโหลดข้อสอบ...</p>
                </div>
            ) : (
            <>
            <div className="p-4 bg-gray-50 font-bold text-gray-700 flex justify-between">
                <span>รายการข้อสอบ {qBankSubject} ({filteredQuestions.length})</span>
                <span className="text-xs font-normal text-gray-500">แสดงเฉพาะ: {showMyQuestionsOnly ? 'ของฉัน' : 'ทั้งหมด'}</span>
            </div>
            <div className="divide-y divide-gray-100">
                {currentQuestions.length > 0 ? currentQuestions.map((q, idx) => (
                    <div key={q.id} className="p-5 hover:bg-blue-50 transition border border-transparent hover:border-blue-100 rounded-xl mb-2 bg-white shadow-sm mx-2 group">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{GRADE_LABELS[q.grade || ''] || q.grade}</span>
                                    <span className="text-[10px] text-gray-400">ID: {q.id}</span>
                                </div>
                                <h4 className="font-bold text-gray-800 text-base mb-2">{q.text}</h4>
                                {q.image && (
                                    <img src={q.image} alt="Question" className="h-24 object-contain rounded-lg border border-gray-200 mb-2 bg-gray-50" />
                                )}
                            </div>
                            
                            {/* ✅ Updated Condition: Owner OR Admin OR Legacy (No Owner) */}
                            {(canManageAll || normalizeId(q.teacherId) === normalizeId(teacher.id) || !q.teacherId) && (
                                <div className="flex gap-1 ml-4 flex-shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>handleEditQuestion(q)} className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition" title="แก้ไข"><Edit size={18}/></button>
                                    <button onClick={()=>handleDeleteQuestion(q.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition" title="ลบ"><Trash2 size={18}/></button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            {q.choices.map((c, idx) => {
                                const isCorrect = String(idx + 1) === String(q.correctChoiceId);
                                return (
                                    <div key={idx} className={`flex items-start gap-2 ${isCorrect ? 'text-green-700 font-bold' : ''}`}>
                                        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs border ${isCorrect ? 'bg-green-500 text-white border-green-500' : 'bg-white border-gray-300 text-gray-500'}`}>
                                            {idx + 1}
                                        </span>
                                        <span>{c.text}</span>
                                        {isCorrect && <CheckCircle size={14} className="mt-0.5"/>}
                                    </div>
                                );
                            })}
                        </div>
                        
                        {q.explanation && (
                            <div className="mt-2 text-xs text-gray-500 flex items-start gap-1 pl-1">
                                <span className="font-bold text-blue-600">เฉลย:</span> {q.explanation}
                            </div>
                        )}
                    </div>
                )) : <div className="p-10 text-center text-gray-400">ไม่พบข้อสอบในหมวดนี้</div>}
            </div>
            {filteredQuestions.length > ITEMS_PER_PAGE && (
                <div className="p-4 border-t flex justify-center gap-2">
                    <button disabled={qBankPage===1} onClick={()=>setQBankPage(p=>p-1)} className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50"><ChevronLeft size={16}/></button>
                    <span className="p-2 text-sm text-gray-500">หน้า {qBankPage}</span>
                    <button disabled={qBankPage * ITEMS_PER_PAGE >= filteredQuestions.length} onClick={()=>setQBankPage(p=>p+1)} className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50"><ChevronRight size={16}/></button>
                </div>
            )}
            </>
            )}
        </div>
    </div>
  );
};

export default QuestionBank;
