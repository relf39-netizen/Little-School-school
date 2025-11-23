
import React, { useState, useEffect } from 'react';
import { Question, Subject } from '../types';
import { ArrowLeft, Play, Layers, Shuffle, Clock, GraduationCap } from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { fetchAppData } from '../services/api';

interface GameSetupProps {
  onBack: () => void;
  onGameCreated: () => void;
}

const GameSetup: React.FC<GameSetupProps> = ({ onBack, onGameCreated }) => {
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings
  const [selectedSubject, setSelectedSubject] = useState<string>('MIXED'); 
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timePerQuestion, setTimePerQuestion] = useState<number>(20);
  const [selectedGrade, setSelectedGrade] = useState<string>('P6');

  // ตัวแปลงรหัสชั้นเป็นภาษาไทย
  const GRADE_LABELS: Record<string, string> = {
      'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3',
      'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6'
  };

  useEffect(() => {
    const loadQuestions = async () => {
      const data = await fetchAppData();
      setAllQuestions(data.questions);
      setLoading(false);
    };
    loadQuestions();
  }, []);

  const handleCreateGame = async () => {
    setLoading(true);

    // 1. กรองระดับชั้น
    let filtered = allQuestions.filter(q => q.grade === selectedGrade || q.grade === 'ALL');

    // 2. กรองวิชา
    if (selectedSubject !== 'MIXED') {
        filtered = filtered.filter(q => q.subject === selectedSubject);
    }

    // 3. สุ่มลำดับ
    filtered.sort(() => 0.5 - Math.random());

    // 4. ตัดจำนวนข้อ
    const finalQuestions = filtered.slice(0, questionCount);

    if (finalQuestions.length === 0) {
        alert(`ไม่พบข้อสอบสำหรับชั้น ${GRADE_LABELS[selectedGrade]} ในหมวดนี้`);
        setLoading(false);
        return;
    }

    // ✅ แก้ไข Error: แปลงค่า undefined ให้เป็นค่าว่างก่อนส่งไป Firebase
    const sanitizedQuestions = finalQuestions.map(q => ({
        id: q.id || '',
        subject: q.subject || '',
        text: q.text || '',
        image: q.image || '',
        choices: q.choices.map(c => ({
            id: c.id || '',
            text: c.text || '',
            image: c.image || ''
        })),
        correctChoiceId: q.correctChoiceId || '',
        explanation: q.explanation || '',
        grade: q.grade || 'ALL',
        school: q.school || 'CENTER' // ป้องกัน school เป็น undefined
    }));

    try {
        await db.ref('game/scores').set({});
        await db.ref('questions').set(sanitizedQuestions); // ส่งตัวที่แก้แล้วไป
        
        await db.ref('gameState').set({
            status: 'LOBBY',
            currentQuestionIndex: 0,
            totalQuestions: sanitizedQuestions.length,
            subject: selectedSubject === 'MIXED' ? 'รวมวิชา' : selectedSubject,
            grade: selectedGrade,
            timePerQuestion: timePerQuestion,
            timer: timePerQuestion
        });

        onGameCreated(); 
    } catch (e) {
        alert("Firebase Error: " + e);
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto min-h-[80vh] flex flex-col pb-10">
       <button onClick={onBack} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4 w-fit">
        <ArrowLeft size={20} /> กลับห้องพักครู
      </button>

      <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8 flex-1 border-t-4 border-purple-500">
        <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
                <Layers className="text-purple-600" /> ตั้งค่าเกมการแข่งขัน
            </h2>
        </div>

        {/* 0. เลือกระดับชั้น (ภาษาไทย) */}
        <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><GraduationCap size={18}/> 0. เลือกระดับชั้น</label>
            <div className="grid grid-cols-3 gap-2">
                {['P1','P2','P3','P4','P5','P6'].map(g => (
                    <button key={g} onClick={() => setSelectedGrade(g)} className={`py-2 rounded-lg border-2 font-bold transition ${selectedGrade === g ? 'border-purple-500 bg-purple-100 text-purple-800 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                        {GRADE_LABELS[g]}
                    </button>
                ))}
            </div>
        </div>

        {/* 1. เลือกวิชา */}
        <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">1. เลือกวิชา</label>
            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => setSelectedSubject('MIXED')}
                    className={`p-3 rounded-xl border-2 transition flex flex-col items-center ${selectedSubject === 'MIXED' ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200'}`}
                >
                    <Shuffle size={20} className="mb-1"/>
                    <span className="font-bold text-sm">คละทุกวิชา</span>
                </button>
                {Object.values(Subject).map((sub: any) => (
                     <button 
                        key={sub}
                        onClick={() => setSelectedSubject(sub)}
                        className={`p-3 rounded-xl border-2 transition ${selectedSubject === sub ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200'}`}
                    >
                        <span className="font-bold text-sm">{sub}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* 2. จำนวนข้อ & เวลา */}
        <div className="grid grid-cols-2 gap-4 mb-8">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">จำนวนข้อ</label>
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border">
                    <input 
                        type="range" min="5" max="50" step="5"
                        value={questionCount} 
                        onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <span className="font-bold text-purple-600 min-w-[30px] text-center">{questionCount}</span>
                </div>
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">เวลาต่อข้อ (วินาที)</label>
                <select 
                    value={timePerQuestion}
                    onChange={(e) => setTimePerQuestion(parseInt(e.target.value))}
                    className="w-full p-3 rounded-xl border border-gray-200 bg-white font-bold text-gray-700"
                >
                    <option value="10">10 วินาที (เร็ว)</option>
                    <option value="15">15 วินาที</option>
                    <option value="20">20 วินาที (ปกติ)</option>
                    <option value="30">30 วินาที (ช้า)</option>
                </select>
            </div>
        </div>

        <button 
            onClick={handleCreateGame}
            disabled={loading || allQuestions.length === 0}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold text-xl shadow-lg hover:scale-[1.02] transition flex items-center justify-center gap-2"
        >
            {loading ? 'กำลังสร้างห้อง...' : <><Play fill="currentColor" /> เปิดห้องแข่งขัน</>}
        </button>

      </div>
    </div>
  );
};

export default GameSetup;
