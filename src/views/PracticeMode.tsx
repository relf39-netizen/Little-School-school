
import React, { useState, useEffect } from 'react';
import { Question, Subject } from '../types';
import { CheckCircle, XCircle, ArrowRight, RefreshCw, ArrowLeft } from 'lucide-react';
import { speak } from '../utils/soundUtils';

interface PracticeModeProps {
  onFinish: (score: number, total: number) => void;
  onBack: () => void;
  questions: Question[]; // รับคำถามเข้ามาจาก Google Sheet
}

const PracticeMode: React.FC<PracticeModeProps> = ({ onFinish, onBack, questions: allQuestions }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  const choiceLabels = ['A', 'B', 'C', 'D']; // ป้ายกำกับตัวเลือก

  useEffect(() => {
    // กระบวนการเตรียมข้อสอบ: สุ่มโจทย์ + ตัดเหลือ 10 ข้อ + สลับช้อยส์
    if (allQuestions && allQuestions.length > 0) {
        // 1. สุ่มลำดับโจทย์ทั้งหมดก่อน (Shuffle Questions)
        const shuffledQuestions = [...allQuestions].sort(() => 0.5 - Math.random());

        // 2. ตัดมาแค่ 10 ข้อ (หรือน้อยกว่าถ้าในคลังมีไม่ถึง 10 ข้อ)
        const limitedQuestions = shuffledQuestions.slice(0, 10);

        // 3. สลับตำแหน่งตัวเลือกในแต่ละข้อ (Shuffle Choices)
        const finalQuestions = limitedQuestions.map(q => ({
            ...q,
            choices: [...q.choices].sort(() => 0.5 - Math.random())
        }));

        setQuestions(finalQuestions);
        setLoading(false);
    } else {
        setLoading(false); // กรณีไม่มีคำถามเลย
    }
  }, [allQuestions]);

  const currentQuestion = questions[currentIndex];

  const handleChoiceSelect = (choiceId: string) => {
    if (isSubmitted) return;
    setSelectedChoice(choiceId);
  };

  const handleSubmit = () => {
    if (!selectedChoice) return;
    
    const isCorrect = selectedChoice === currentQuestion.correctChoiceId;
    setIsSubmitted(true);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      speak("ถูกต้องครับ เก่งมาก");
    } else {
      speak("ยังไม่ถูก ไม่เป็นไรครับ ดูเฉลยกัน");
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedChoice(null);
      setIsSubmitted(false);
    } else {
      // ✅ แก้ไข: ส่ง score ล่าสุดไปเลย ไม่ต้องบวกเพิ่มอีก (เพราะบวกไปแล้วตอน handleSubmit)
      onFinish(score, questions.length);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64 text-blue-500 font-bold text-xl animate-pulse">กำลังเตรียมชุดข้อสอบ 10 ข้อ...</div>;
  }

  if (questions.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="text-xl font-bold mb-4">ไม่พบข้อมูลข้อสอบ</p>
            <button onClick={onBack} className="bg-blue-500 text-white px-4 py-2 rounded-lg">กลับหน้าหลัก</button>
        </div>
    );
  }

  // ชุดสีสำหรับปุ่มตัวเลือก (ฟ้า, เขียว, ส้ม, ชมพู)
  const choiceColors = [
    { 
      base: 'bg-sky-50 border-sky-200 text-sky-800', 
      hover: 'hover:bg-sky-100 hover:border-sky-300 hover:-translate-y-1', 
      selected: 'bg-sky-100 border-sky-500 ring-2 ring-sky-300 shadow-md scale-[1.02]' 
    },
    { 
      base: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
      hover: 'hover:bg-emerald-100 hover:border-emerald-300 hover:-translate-y-1', 
      selected: 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-300 shadow-md scale-[1.02]' 
    },
    { 
      base: 'bg-amber-50 border-amber-200 text-amber-800', 
      hover: 'hover:bg-amber-100 hover:border-amber-300 hover:-translate-y-1', 
      selected: 'bg-amber-100 border-amber-500 ring-2 ring-amber-300 shadow-md scale-[1.02]' 
    },
    { 
      base: 'bg-rose-50 border-rose-200 text-rose-800', 
      hover: 'hover:bg-rose-100 hover:border-rose-300 hover:-translate-y-1', 
      selected: 'bg-rose-100 border-rose-500 ring-2 ring-rose-300 shadow-md scale-[1.02]' 
    }
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft size={20} /> ออก
        </button>
        <div className="flex-1 mx-4 bg-gray-200 rounded-full h-3">
          <div 
            className="bg-blue-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
          ></div>
        </div>
        <span className="font-bold text-gray-600 text-sm">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8 mb-6 border-b-4 border-gray-200">
        <div className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded mb-3">
          {currentQuestion.subject}
        </div>
        
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 leading-relaxed">
          {currentQuestion.text}
        </h2>

        {currentQuestion.image && (
          <div className="mb-6 rounded-xl overflow-hidden border-2 border-gray-100">
            <img src={currentQuestion.image} alt="Question" className="w-full h-auto object-contain max-h-60 bg-gray-50" />
          </div>
        )}

        <div className="space-y-4">
          {currentQuestion.choices.map((choice, index) => {
            const colorTheme = choiceColors[index % 4]; // วนสีตามลำดับ
            const label = choiceLabels[index] || (index + 1).toString();
            
            let buttonStyle = `border-2 shadow-sm transition-all duration-200 relative flex items-center gap-4 ${colorTheme.base} ${colorTheme.hover}`;
            let badgeStyle = "bg-white border-2 border-white/50 text-gray-500";

            if (selectedChoice === choice.id) {
              buttonStyle = `border-2 shadow-md font-bold ${colorTheme.selected}`;
              badgeStyle = "bg-white text-blue-600 border-blue-200 shadow-inner";
            }

            if (isSubmitted) {
              if (choice.id === currentQuestion.correctChoiceId) {
                buttonStyle = "border-2 border-green-500 bg-green-100 text-green-900 shadow-md scale-[1.02]";
                badgeStyle = "bg-green-500 text-white border-transparent";
              } else if (choice.id === selectedChoice) {
                buttonStyle = "border-2 border-red-500 bg-red-100 text-red-900 opacity-80";
                badgeStyle = "bg-red-500 text-white border-transparent";
              } else {
                buttonStyle = "border-2 border-gray-100 bg-gray-50 text-gray-400 opacity-50 grayscale";
                badgeStyle = "bg-gray-200 text-gray-400";
              }
            }

            return (
              <button
                key={choice.id}
                onClick={() => handleChoiceSelect(choice.id)}
                disabled={isSubmitted}
                className={`w-full p-3 md:p-4 rounded-2xl text-left text-lg ${buttonStyle}`}
              >
                {/* Label Circle A, B, C, D */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${badgeStyle}`}>
                   {label}
                </div>

                <div className="flex-1">
                  {choice.image ? (
                     <div className="flex items-center gap-3 w-full">
                        <img src={choice.image} alt="choice" className="w-16 h-16 rounded object-cover border bg-white" />
                        <span className="font-medium">{choice.text}</span>
                     </div>
                  ) : (
                     <span className="font-medium">{choice.text}</span>
                  )}
                </div>

                {isSubmitted && choice.id === currentQuestion.correctChoiceId && (
                  <CheckCircle className="text-green-600 absolute right-4 drop-shadow-sm" size={28} />
                )}
                {isSubmitted && choice.id === selectedChoice && choice.id !== currentQuestion.correctChoiceId && (
                  <XCircle className="text-red-500 absolute right-4 drop-shadow-sm" size={28} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 md:static md:bg-transparent md:border-0 md:p-0 z-20">
        <div className="max-w-3xl mx-auto">
          {!isSubmitted ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedChoice}
              className={`w-full py-3 rounded-2xl font-bold text-xl shadow-lg transition-all transform active:scale-95 ${
                selectedChoice 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              ส่งคำตอบ
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 animate-fade-in shadow-sm">
                <h3 className="font-bold text-green-800 mb-2 flex items-center gap-2 text-lg">
                  <CheckCircle size={24} /> เฉลย
                </h3>
                <p className="text-green-800 text-base leading-relaxed">{currentQuestion.explanation}</p>
              </div>
              <button
                onClick={handleNext}
                className="w-full py-3 rounded-2xl font-bold text-xl shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2 shadow-blue-200"
              >
                {currentIndex < questions.length - 1 ? 'ข้อต่อไป' : 'ดูผลลัพธ์'} <ArrowRight size={24} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PracticeMode;
