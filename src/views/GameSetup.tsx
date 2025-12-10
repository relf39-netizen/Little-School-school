import React, { useState, useEffect } from 'react';
import { Question, Subject, Teacher } from '../types';
import { ArrowLeft, Play, Layers, Shuffle, Clock, Wand2, Sparkles, Database, Key, Trash2, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../services/firebaseConfig'; // Using Supabase client
import { fetchAppData } from '../services/api';
import { generateQuestionWithAI } from '../services/aiService';

interface GameSetupProps {
  onBack: () => void;
  onGameCreated: (roomCode: string) => void;
  teacher?: Teacher;
}

const GameSetup: React.FC<GameSetupProps> = ({ onBack, onGameCreated, teacher }) => {
  const [mode, setMode] = useState<'BANK' | 'AI'>('BANK');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Settings (Common)
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timePerQuestion, setTimePerQuestion] = useState<number>(20); 

  // Bank Mode Settings
  const [selectedSubject, setSelectedSubject] = useState<string>('MIXED'); 

  // AI Mode Settings
  const [aiSubject, setAiSubject] = useState<string>('คณิตศาสตร์');
  const [aiGrade, setAiGrade] = useState<string>('P6');
  const [aiTopic, setAiTopic] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  
  // AI Preview State
  const [aiPreviewQuestions, setAiPreviewQuestions] = useState<Question[]>([]);
  const [showAiPreview, setShowAiPreview] = useState(false);

  // Hardcoded subjects/grades for selection
  const SUBJECTS = ['คณิตศาสตร์', 'ภาษาไทย', 'วิทยาศาสตร์', 'ภาษาอังกฤษ', 'สังคมศึกษา', 'ประวัติศาสตร์', 'คอมพิวเตอร์'];
  const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3'];
  const GRADE_LABELS: Record<string, string> = { 
      'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6', 
      'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3'
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Check Table Health First
        const { error } = await supabase.from('games').select('id').limit(1);
        if (error && error.code === '42P01') {
            setDbError("ไม่พบตาราง 'games' ในฐานข้อมูล กรุณารัน SQL Script Setup ก่อนใช้งาน");
            setLoading(false);
            return;
        }

        const data = await fetchAppData();
        setAllQuestions(data.questions);
        setLoading(false);
        
        // Auto-load API Key if available
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) setApiKey(savedKey);
        
        // Set default grade based on teacher
        if (teacher && teacher.gradeLevel && teacher.gradeLevel !== 'ALL') {
            const firstGrade = teacher.gradeLevel.split(',')[0].trim();
            setAiGrade(firstGrade);
        }
      } catch (err) {
        console.error("Setup load error:", err);
        setLoading(false);
      }
    };
    loadData();
  }, [teacher]);

  // Generate Random 6-Digit PIN
  const generateGamePin = () => {
      return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const createGameRoom = async (gameQuestions: Question[], subjectName: string) => {
    try {
        const ROOM_ID = generateGamePin();

        // Upsert Game State to Supabase
        const { error } = await supabase.from('games').insert({
            room_code: ROOM_ID,
            status: 'LOBBY',
            current_question_index: 0,
            total_questions: gameQuestions.length,
            subject: subjectName,
            time_per_question: timePerQuestion,
            timer: timePerQuestion,
            questions: gameQuestions // Pass array directly for JSONB
        });
        
        if (error) {
            if (error.code === '42P01') {
                throw new Error("ไม่พบตารางฐานข้อมูล 'games'");
            }
            throw error;
        }

        onGameCreated(ROOM_ID); 
    } catch (e: any) {
        alert("เกิดข้อผิดพลาดในการสร้างห้องเกม: " + e.message);
        console.error(e);
    }
  };

  const handleCreateGameFromBank = async () => {
    setProcessing(true);

    // 1. Filter
    let filtered = selectedSubject === 'MIXED' 
      ? allQuestions 
      : allQuestions.filter(q => q.subject === selectedSubject);

    // 2. Shuffle
    filtered.sort(() => 0.5 - Math.random());

    // 3. Slice
    const finalQuestions = filtered.slice(0, questionCount);

    if (finalQuestions.length === 0) {
        alert("ไม่พบข้อสอบในเงื่อนไขที่เลือก (คลังข้อสอบอาจจะว่างเปล่า)");
        setProcessing(false);
        return;
    }

    await createGameRoom(finalQuestions, selectedSubject === 'MIXED' ? 'แบบคละวิชา' : selectedSubject);
    setProcessing(false);
  };

  const handlePreviewAI = async () => {
      if (!apiKey) return alert("กรุณาระบุ API Key");
      if (!aiTopic) return alert("กรุณาระบุเรื่องที่ต้องการเน้น");

      setProcessing(true);
      try {
          localStorage.setItem('gemini_api_key', apiKey);

          const generated = await generateQuestionWithAI(
              aiSubject, 
              aiGrade, 
              aiTopic, 
              apiKey, 
              questionCount, 
              'normal'
          );

          if (!generated || generated.length === 0) {
              throw new Error("AI ไม่สามารถสร้างข้อสอบได้ในขณะนี้");
          }

          // Convert to Question Format for Preview
          const gameQuestions: Question[] = generated.map((g, i) => ({
              id: `ai_game_${Date.now()}_${i}`,
              subject: aiSubject,
              text: g.text,
              image: g.image,
              choices: [
                  { id: '1', text: g.c1 },
                  { id: '2', text: g.c2 },
                  { id: '3', text: g.c3 },
                  { id: '4', text: g.c4 }
              ],
              correctChoiceId: g.correct,
              explanation: g.explanation,
              grade: aiGrade
          }));

          setAiPreviewQuestions(gameQuestions);
          setShowAiPreview(true);

      } catch (e: any) {
          alert("เกิดข้อผิดพลาด: " + e.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleConfirmAiGame = async () => {
      if (aiPreviewQuestions.length === 0) return;
      setProcessing(true);
      await createGameRoom(aiPreviewQuestions, `${aiSubject}: ${aiTopic}`);
      setProcessing(false);
  };

  const removeAiQuestion = (index: number) => {
      setAiPreviewQuestions(prev => prev.filter((_, i) => i !== index));
  };

  if (dbError) {
      return (
          <div className="max-w-2xl mx-auto min-h-[80vh] flex flex-col items-center justify-center text-center p-6">
              <div className="bg-red-100 border-2 border-red-500 rounded-3xl p-8 shadow-xl">
                  <AlertCircle size={64} className="text-red-500 mx-auto mb-4"/>
                  <h2 className="text-2xl font-bold text-red-700 mb-2">ไม่พบฐานข้อมูลเกม</h2>
                  <p className="text-gray-700 mb-4">{dbError}</p>
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                      กรุณากลับไปที่ Supabase -&gt; SQL Editor และรันสคริปต์ที่ได้รับใหม่
                  </p>
                  <button onClick={onBack} className="mt-6 px-6 py-3 bg-gray-800 text-white rounded-xl font-bold">กลับเมนูหลัก</button>
              </div>
          </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto min-h-[80vh] flex flex-col pb-10">
       <button onClick={onBack} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4 w-fit">
        <ArrowLeft size={20} /> กลับห้องพักครู
      </button>

      <div className="bg-white rounded-3xl shadow-lg flex-1 overflow-hidden flex flex-col">
        {/* Header Tabs */}
        {!showAiPreview && (
        <div className="flex border-b">
            <button 
                onClick={() => setMode('BANK')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition ${mode === 'BANK' ? 'bg-white text-purple-600 border-b-4 border-purple-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
            >
                <Database size={20}/> เลือกจากคลังข้อสอบ
            </button>
            <button 
                onClick={() => setMode('AI')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition ${mode === 'AI' ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-indigo-600 border-b-4 border-indigo-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
            >
                <Wand2 size={20}/> ให้ AI ช่วยออกข้อสอบ
            </button>
        </div>
        )}

        <div className="p-6 md:p-8 flex-1 flex flex-col">
            
            {/* AI PREVIEW MODE */}
            {showAiPreview ? (
                <div className="animate-fade-in flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                            <CheckCircle className="text-green-500"/> ตรวจสอบข้อสอบ ({aiPreviewQuestions.length} ข้อ)
                        </h3>
                        <button onClick={() => { setShowAiPreview(false); setAiPreviewQuestions([]); }} className="text-sm text-gray-500 hover:text-red-500">ยกเลิก/สร้างใหม่</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6 custom-scrollbar">
                        {aiPreviewQuestions.map((q, i) => (
                            <div key={q.id} className="bg-white p-4 rounded-xl border border-gray-200 mb-3 shadow-sm relative group">
                                <div className="pr-8">
                                    <div className="font-bold text-gray-800 mb-2">{i+1}. {q.text}</div>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                                        {q.choices.map((c, idx) => (
                                            <div key={idx} className={`${(idx+1).toString() === q.correctChoiceId ? 'text-green-600 font-bold' : ''}`}>
                                                {idx+1}. {c.text}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-xs text-indigo-500 bg-indigo-50 p-2 rounded">
                                        <b>เฉลย:</b> {q.explanation}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => removeAiQuestion(i)}
                                    className="absolute top-2 right-2 p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                                    title="ลบข้อนี้"
                                >
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        ))}
                        {aiPreviewQuestions.length === 0 && <div className="text-center text-gray-400 mt-10">ลบหมดแล้ว กรุณาสร้างใหม่</div>}
                    </div>

                    <div className="flex gap-4">
                        <button 
                            onClick={() => { setShowAiPreview(false); setAiPreviewQuestions([]); }}
                            className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-50"
                        >
                            ยกเลิก
                        </button>
                        <button 
                            onClick={handleConfirmAiGame}
                            disabled={processing || aiPreviewQuestions.length === 0}
                            className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-600 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {processing ? 'กำลังเปิดห้อง...' : <><Play fill="currentColor"/> ยืนยันและเริ่มเกม</>}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                {/* --- BANK MODE --- */}
                {mode === 'BANK' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">เลือกวิชาจากคลังที่มีอยู่</h2>
                            <p className="text-gray-500 text-sm">ระบบจะสุ่มข้อสอบจากคลังข้อสอบกลาง</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">วิชา</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                <button 
                                    onClick={() => setSelectedSubject('MIXED')}
                                    className={`p-3 rounded-xl border-2 transition flex flex-col items-center justify-center ${
                                        selectedSubject === 'MIXED' 
                                        ? 'border-purple-500 bg-purple-100 text-purple-800' 
                                        : 'border-gray-200 hover:border-purple-200 bg-white text-gray-600'
                                    }`}
                                >
                                    <Shuffle size={20} className="mb-1"/>
                                    <span className="font-bold text-sm">คละทุกวิชา</span>
                                </button>
                                {SUBJECTS.map((sub) => (
                                    <button 
                                        key={sub}
                                        onClick={() => setSelectedSubject(sub)}
                                        className={`p-3 rounded-xl border-2 transition ${
                                            selectedSubject === sub 
                                            ? 'border-purple-500 bg-purple-100 text-purple-800' 
                                            : 'border-gray-200 hover:border-purple-200 bg-white text-gray-600'
                                        }`}
                                    >
                                        <span className="font-bold text-sm">{sub}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- AI MODE --- */}
                {mode === 'AI' && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
                            <Sparkles className="text-indigo-600 mt-1 flex-shrink-0" size={24}/>
                            <div>
                                <h3 className="font-bold text-indigo-900">สร้างโจทย์ใหม่แบบเจาะจงเรื่อง</h3>
                                <p className="text-indigo-700 text-sm">ระบุหัวข้อที่ต้องการเน้น AI จะสร้างโจทย์ชุดใหม่ให้ตรวจสอบก่อนเริ่มเกม</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">ระดับชั้น</label>
                                <select value={aiGrade} onChange={e => setAiGrade(e.target.value)} className="w-full p-3 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-200">
                                    {GRADES.map(g => (
                                        <option key={g} value={g}>{GRADE_LABELS[g] || g}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">วิชา</label>
                                <select value={aiSubject} onChange={e => setAiSubject(e.target.value)} className="w-full p-3 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-200">
                                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">เรื่องที่ต้องการเน้น (Topic)</label>
                            <input 
                                type="text" 
                                value={aiTopic}
                                onChange={e => setAiTopic(e.target.value)}
                                placeholder="เช่น การบวกเลข, คำราชาศัพท์, ระบบสุริยะ, Past Tense"
                                className="w-full p-3 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Google Gemini API Key</label>
                            <div className="relative">
                                <input 
                                    type="password" 
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                    placeholder="วาง API Key ที่นี่..."
                                    className="w-full p-3 pl-10 border rounded-xl bg-gray-50 focus:bg-white outline-none transition"
                                    autoComplete="new-password"
                                />
                                <Key className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                            </div>
                        </div>
                    </div>
                )}

                <hr className="my-6 border-gray-100"/>

                {/* Common Settings */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">จำนวนข้อ</label>
                        <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border">
                            <input 
                                type="range" min="5" max={mode === 'AI' ? 20 : 50} step="5"
                                value={questionCount} 
                                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            />
                            <span className="font-bold text-purple-600 min-w-[30px] text-center">{questionCount}</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">เวลาต่อข้อ</label>
                        <select 
                            value={timePerQuestion}
                            onChange={(e) => setTimePerQuestion(parseInt(e.target.value))}
                            className="w-full p-3 rounded-xl border border-gray-200 bg-white font-bold text-gray-700"
                        >
                            <option value="10">10 วินาที (เร็ว)</option>
                            <option value="15">15 วินาที</option>
                            <option value="20">20 วินาที (ปกติ)</option>
                            <option value="30">30 วินาที (ช้า)</option>
                            <option value="45">45 วินาที (ยาก)</option>
                            <option value="60">60 วินาที (นาน)</option>
                        </select>
                    </div>
                </div>

                <button 
                    onClick={mode === 'BANK' ? handleCreateGameFromBank : handlePreviewAI}
                    disabled={loading || processing || (mode === 'BANK' && allQuestions.length === 0)}
                    className={`w-full py-4 rounded-2xl font-bold text-xl shadow-lg hover:scale-[1.02] transition flex items-center justify-center gap-2 text-white ${
                        mode === 'AI' 
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-200' 
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-purple-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {processing ? (
                        <><RefreshCw className="animate-spin"/> กำลังประมวลผล...</>
                    ) : (
                        mode === 'AI' ? <><Sparkles fill="currentColor" /> สร้างและตรวจสอบข้อสอบ</> : <><Play fill="currentColor" /> เปิดห้องแข่งขัน</>
                    )}
                </button>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default GameSetup;