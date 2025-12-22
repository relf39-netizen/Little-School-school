
import React, { useState, useEffect, useRef } from 'react';
import { Question, Subject } from '../types';
/* Added Loader2 to imports from lucide-react */
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, Volume2, VolumeX, ShieldAlert, RefreshCw, Loader2 } from 'lucide-react';
import { speak, stopSpeak } from '../utils/soundUtils';

interface PracticeModeProps {
  onFinish: (score: number, total: number, assignmentId?: string) => void;
  onBack: () => void;
  questions: Question[];
  assignmentId?: string; 
  isExamMode?: boolean; 
}

const PracticeMode: React.FC<PracticeModeProps> = ({ onFinish, onBack, questions: allQuestions, assignmentId, isExamMode = false }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const assignmentIdRef = useRef(assignmentId);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);

  const choiceLabels = ['A', 'B', 'C', 'D']; 

  useEffect(() => {
    if (assignmentId) {
        assignmentIdRef.current = assignmentId;
    }
  }, [assignmentId]);

  useEffect(() => {
    if (allQuestions && allQuestions.length > 0) {
        // Shuffle questions
        const shuffledQuestions = [...allQuestions].sort(() => 0.5 - Math.random());
        
        // For practice mode (no assignmentId), limit to 10. 
        // For assignments, the list should already be prepared.
        const limit = assignmentId ? shuffledQuestions.length : 10;
        const limitedQuestions = shuffledQuestions.slice(0, limit);
        
        // Shuffle choices for each question
        const finalQuestions = limitedQuestions.map(q => ({
            ...q,
            choices: [...q.choices].sort(() => 0.5 - Math.random())
        }));

        setQuestions(finalQuestions);
        setLoading(false);
    } else {
        setLoading(false);
    }
  }, [allQuestions, assignmentId]);

  const currentQuestion = questions[currentIndex];

  const playAudio = () => {
    if (!currentQuestion) return;
    stopSpeak(); 
    if (isSubmitted) {
        if (!isExamMode) {
          const correctChoice = currentQuestion.choices.find(c => String(c.id) === String(currentQuestion.correctChoiceId));
          speak(`เฉลยคือข้อ ${correctChoice?.text || ''}. ${currentQuestion.explanation}`);
        }
    } else {
        let text = `คำถามข้อที่ ${currentIndex + 1}. ${currentQuestion.text}. `;
        currentQuestion.choices.forEach((c, i) => {
            text += `ตัวเลือก ${choiceLabels[i]}. ${c.text}. `;
        });
        speak(text);
    }
  };

  useEffect(() => {
    if (isTTSEnabled && !loading && currentQuestion) {
        playAudio();
    }
    return () => stopSpeak();
  }, [currentIndex, isTTSEnabled, isSubmitted, loading]);

  const handleChoiceSelect = (choiceId: string) => {
    if (isSubmitted) return;
    setSelectedChoice(choiceId);
  };

  const handleSubmit = () => {
    if (!selectedChoice) return;
    
    const isCorrect = String(selectedChoice) === String(currentQuestion.correctChoiceId) || 
                      selectedChoice.endsWith(String(currentQuestion.correctChoiceId));
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    if (isExamMode) {
        // In Exam mode, we record and move on without feedback
        setIsSubmitted(true);
        setTimeout(handleNext, 400); // Short delay for visual feedback of selection
    } else {
        setIsSubmitted(true);
        if (isCorrect) {
            if (!isTTSEnabled) speak("ถูกต้องครับ!");
        } else {
            if (!isTTSEnabled) speak("ยังไม่ถูกครับ ลองดูเฉลยนะ");
        }
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedChoice(null);
      setIsSubmitted(false);
    } else {
      // Logic for calculating final score on finish
      const finalScore = score;
      onFinish(finalScore, questions.length, assignmentIdRef.current);
    }
  };

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-indigo-600">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p className="text-xl font-bold">กำลังเตรียมข้อสอบ...</p>
        </div>
    );
  }

  if (questions.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white rounded-3xl shadow-sm border p-10">
            <p className="text-xl font-bold mb-4">ไม่พบข้อมูลข้อสอบ</p>
            <button onClick={onBack} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition">
                กลับหน้าหลัก
            </button>
        </div>
    );
  }

  const choiceColors = [
    { base: 'bg-sky-50 border-sky-200 text-sky-800', hover: 'hover:bg-sky-100 hover:border-sky-300', selected: 'bg-sky-100 border-sky-500 ring-4 ring-sky-200' },
    { base: 'bg-emerald-50 border-emerald-200 text-emerald-800', hover: 'hover:bg-emerald-100 hover:border-emerald-300', selected: 'bg-emerald-100 border-emerald-500 ring-4 ring-emerald-200' },
    { base: 'bg-amber-50 border-amber-200 text-amber-800', hover: 'hover:bg-amber-100 hover:border-amber-300', selected: 'bg-amber-100 border-amber-500 ring-4 ring-amber-200' },
    { base: 'bg-rose-50 border-rose-200 text-rose-800', hover: 'hover:bg-rose-100 hover:border-rose-300', selected: 'bg-rose-100 border-rose-500 ring-4 ring-rose-200' }
  ];

  return (
    <div className="max-w-3xl mx-auto pb-24 animate-fade-in">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-6 bg-white/50 p-3 rounded-2xl backdrop-blur-sm border border-white/50 shadow-sm">
        <button onClick={onBack} className="text-gray-500 hover:text-indigo-600 flex items-center gap-1 font-bold transition">
          <ArrowLeft size={20} /> ออก
        </button>
        <div className="flex-1 mx-4 bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 shadow-inner ${isExamMode ? 'bg-red-500' : 'bg-indigo-600'}`}
            style={{ width: `${((currentIndex + (isSubmitted && isExamMode ? 1 : 0)) / questions.length) * 100}%` }}
          ></div>
        </div>
        <div className="flex items-center gap-2 font-black text-indigo-900">
           {currentIndex + 1} <span className="text-gray-400 font-bold">/</span> {questions.length}
        </div>
      </div>

      {/* Main Question Card */}
      <div className={`bg-white rounded-[40px] shadow-2xl p-6 md:p-10 mb-6 border-b-[12px] relative transition-all duration-300 ${isExamMode ? 'border-red-100' : 'border-indigo-100'}`}>
        
        {/* Badge & TTS */}
        <div className="flex justify-between items-center mb-6">
            <div className={`px-4 py-1.5 rounded-full font-black text-xs flex items-center gap-2 ${isExamMode ? 'bg-red-600 text-white shadow-lg animate-pulse' : 'bg-indigo-100 text-indigo-700'}`}>
                {isExamMode ? <><ShieldAlert size={14}/> OFFICIAL EXAM</> : currentQuestion.subject}
            </div>
            <button 
                onClick={() => setIsTTSEnabled(!isTTSEnabled)}
                className={`p-3 rounded-2xl transition-all border-2 ${isTTSEnabled ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'}`}
                title="อ่านโจทย์"
            >
                {isTTSEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>
        </div>
        
        <h2 className="text-2xl md:text-3xl font-black text-gray-800 mb-8 leading-tight">
          {currentQuestion.text}
        </h2>

        {currentQuestion.image && (
          <div className="mb-8 rounded-3xl overflow-hidden border-4 border-gray-50 shadow-inner bg-gray-50">
            <img src={currentQuestion.image} alt="Question" className="w-full h-auto object-contain max-h-[300px]" />
          </div>
        )}

        {/* Choice Grid */}
        <div className="grid gap-4">
          {currentQuestion.choices.map((choice, index) => {
            const theme = choiceColors[index % 4];
            const label = choiceLabels[index];
            const isSelected = selectedChoice === choice.id;
            const isCorrect = String(choice.id) === String(currentQuestion.correctChoiceId) || choice.id.endsWith(String(currentQuestion.correctChoiceId));
            
            let btnClass = `w-full p-5 rounded-3xl text-left text-xl font-bold border-2 transition-all duration-200 relative flex items-center gap-5 shadow-sm ${theme.base} ${theme.hover}`;
            let badgeClass = "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl transition-colors bg-white shadow-inner border border-gray-100";

            if (isSelected) {
                btnClass = `w-full p-5 rounded-3xl text-left text-xl font-black border-2 transition-all duration-200 relative flex items-center gap-5 shadow-xl scale-[1.02] ${theme.selected}`;
                badgeClass = "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl transition-colors bg-indigo-600 text-white shadow-lg";
            }

            // Practice Mode Feedback
            if (isSubmitted && !isExamMode) {
                if (isCorrect) {
                    btnClass = "w-full p-5 rounded-3xl text-left text-xl font-black border-4 border-green-500 bg-green-50 text-green-900 shadow-xl scale-[1.02] flex items-center gap-5";
                    badgeClass = "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl bg-green-500 text-white shadow-lg";
                } else if (isSelected) {
                    btnClass = "w-full p-5 rounded-3xl text-left text-xl font-bold border-4 border-red-500 bg-red-50 text-red-900 opacity-80 flex items-center gap-5";
                    badgeClass = "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl bg-red-500 text-white shadow-lg";
                } else {
                    btnClass = "w-full p-5 rounded-3xl text-left text-xl font-medium border-2 border-gray-100 bg-gray-50 text-gray-300 grayscale opacity-40 flex items-center gap-5";
                    badgeClass = "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl bg-gray-200 text-gray-400";
                }
            }

            return (
              <button
                key={choice.id}
                onClick={() => handleChoiceSelect(choice.id)}
                disabled={isSubmitted}
                className={btnClass}
              >
                <div className={badgeClass}>
                   {label}
                </div>
                <div className="flex-1">
                    {choice.image ? (
                        <div className="flex items-center gap-4">
                            <img src={choice.image} alt="Choice" className="w-16 h-16 rounded-xl object-cover border bg-white shadow-sm" />
                            <span>{choice.text}</span>
                        </div>
                    ) : (
                        <span>{choice.text}</span>
                    )}
                </div>
                {isSubmitted && !isExamMode && isCorrect && (
                    <CheckCircle className="text-green-600 drop-shadow-md shrink-0" size={32} />
                )}
                {isSubmitted && !isExamMode && isSelected && !isCorrect && (
                    <XCircle className="text-red-500 drop-shadow-md shrink-0" size={32} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 md:static md:bg-transparent md:border-0 md:p-0 z-40">
        <div className="max-w-3xl mx-auto">
          {!isSubmitted ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedChoice}
              className={`w-full py-5 rounded-[24px] font-black text-2xl shadow-2xl transition-all transform active:scale-95 ${
                selectedChoice 
                  ? (isExamMode ? 'bg-red-600 text-white shadow-red-200' : 'bg-indigo-600 text-white shadow-indigo-200')
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isExamMode ? 'ยืนยันคำตอบ' : 'ส่งคำตอบ'}
            </button>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {!isExamMode && (
                  <div className="bg-green-50 border-l-[8px] border-green-500 rounded-3xl p-6 shadow-lg">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-black text-green-800 flex items-center gap-2 text-xl">
                          <CheckCircle size={24} /> เฉลย
                        </h3>
                        <button onClick={() => speak(currentQuestion.explanation)} className="p-2 bg-white rounded-xl text-green-600 shadow-sm border border-green-100 hover:bg-green-100 transition">
                            <Volume2 size={20}/>
                        </button>
                    </div>
                    <p className="text-green-900 text-lg leading-relaxed font-medium">{currentQuestion.explanation}</p>
                  </div>
              )}
              
              {!isExamMode && (
                  <button
                    onClick={handleNext}
                    className="w-full py-5 rounded-[24px] font-black text-2xl shadow-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 border-b-8 border-indigo-800"
                  >
                    {currentIndex < questions.length - 1 ? 'ข้อต่อไป' : 'ดูสรุปผลคะแนน'} <ArrowRight size={28} />
                  </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PracticeMode;
