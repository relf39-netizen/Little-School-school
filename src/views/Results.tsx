
import React, { useEffect, useState } from 'react';
import { Star, RefreshCw, Home, CheckCircle, Clock, Gift, ArrowUpCircle, Zap } from 'lucide-react';
import { speak } from '../utils/soundUtils';

interface ResultsProps {
  score: number;
  total: number;
  isHomework?: boolean;
  isGame?: boolean; 
  earnedEffortToken?: boolean;
  earnedPerfectToken?: boolean;
  unlockedReward?: string | null;
  leveledUp?: boolean;
  onRetry: () => void;
  onHome: () => void;
}

const Results: React.FC<ResultsProps> = ({ score, total, isHomework = false, isGame = false, earnedEffortToken, earnedPerfectToken, unlockedReward, leveledUp, onRetry, onHome }) => {
  const percentage = (score / total) * 100;
  const [countdown, setCountdown] = useState(10);
  const [showReward, setShowReward] = useState(false);

  useEffect(() => {
    // Determine Feedback Speech
    let speechText = "";
    if (leveledUp) {
        speechText = "ยินดีด้วยครับ คุณได้เลื่อนระดับใหม่แล้ว! ";
    }
    
    if (earnedEffortToken || earnedPerfectToken) {
        speechText += "คุณได้รับดาวสะสมเพิ่ม! ";
    }

    if (percentage >= 80) {
      speechText += `สุดยอดไปเลย! ได้ ${score} เต็ม ${total} คะแนน`;
    } else if (percentage >= 50) {
      speechText += `เก่งมากครับ ได้ ${score} คะแนน`;
    } else {
      speechText += `พยายามได้ดีครับ ได้ ${score} คะแนน สู้ต่อไปนะ`;
    }

    speak(speechText);

    // Auto home for homework
    let timer: any;
    if (isHomework) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onHome();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Trigger Reward Modal
    if (unlockedReward) {
        setTimeout(() => setShowReward(true), 1500); // Delay slightly for effect
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [score, total, percentage, isHomework, onHome, leveledUp, earnedEffortToken, earnedPerfectToken, unlockedReward]);

  const getRewardIcon = (name: string) => {
      if (!name) return '🎁';
      if (name.includes('ดาบ')) return '⚔️';
      if (name.includes('โล่')) return '🛡️';
      if (name.includes('หมวก')) return '🧙‍♂️';
      if (name.includes('ตุ๊กตา')) return '🧸';
      if (name.includes('เหรียญ')) return '🪙';
      if (name.includes('มงกุฎ')) return '👑';
      if (name.includes('รองเท้า')) return '👢';
      if (name.includes('หนังสือ')) return '📘';
      if (name.includes('น้ำยา') || name.includes('โพชั่น')) return '🧪';
      if (name.includes('แผนที่')) return '🗺️';
      if (name.includes('หีบ')) return '⚱️';
      if (name.includes('ไข่')) return '🥚';
      return '🎁';
  };

  return (
    <div className="flex flex-col items-center text-center py-10 min-h-[70vh] justify-center relative overflow-hidden">
      
      {/* 🟢 REWARD MODAL */}
      {showReward && unlockedReward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative border-4 border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.5)]">
                  <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-yellow-400 p-4 rounded-full border-4 border-white shadow-xl animate-bounce">
                      <Gift size={48} className="text-yellow-900"/>
                  </div>
                  <h2 className="text-2xl font-black text-yellow-600 mt-8 mb-2">ของรางวัลใหม่!</h2>
                  <p className="text-gray-500 mb-6">คุณได้รับของรางวัลจากการเลื่อนระดับ</p>
                  
                  <div className="bg-yellow-50 p-6 rounded-2xl border-2 border-yellow-200 mb-6 transform hover:scale-105 transition duration-300">
                      <div className="text-6xl mb-4 drop-shadow-md">{getRewardIcon(unlockedReward)}</div>
                      <div className="font-bold text-xl text-yellow-800">{unlockedReward}</div>
                  </div>
                  
                  <button onClick={() => setShowReward(false)} className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition">
                      รับรางวัล
                  </button>
              </div>
          </div>
      )}

      {isHomework && (
        <div className="mb-6 animate-bounce">
            <span className="bg-green-100 text-green-800 px-6 py-2 rounded-full font-bold text-lg border-2 border-green-300 shadow-sm flex items-center gap-2">
                <CheckCircle size={24} /> ภารกิจสำเร็จ!
            </span>
        </div>
      )}

      {/* Main Score Display */}
      <div className="relative mb-6">
         <div className={`absolute inset-0 rounded-full blur-xl opacity-50 animate-pulse ${percentage >= 50 ? 'bg-yellow-200' : 'bg-gray-200'}`}></div>
         <div className={`bg-white rounded-full p-8 shadow-xl relative z-10 border-4 ${percentage >= 50 ? 'border-yellow-100' : 'border-gray-100'}`}>
           <Star size={80} className={percentage >= 50 ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
         </div>
      </div>

      <h1 className="text-3xl font-bold text-gray-800 mb-2">
        {percentage >= 80 ? 'ยอดเยี่ยมมาก!' : percentage >= 50 ? 'ทำได้ดีมาก!' : 'พยายามได้ดี!'}
      </h1>

      <div className="bg-white rounded-3xl p-6 shadow-lg border-b-4 border-blue-100 w-full max-w-sm mb-6 relative overflow-hidden">
        <div className="text-6xl font-black text-blue-600 mb-2">
          {score}<span className="text-2xl text-gray-400 font-medium">/{total}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 mb-2">
          <div 
            className={`h-4 rounded-full transition-all duration-1000 ${percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>

      {/* 🟢 GAMIFICATION FEEDBACK */}
      <div className="flex flex-col gap-3 w-full max-w-sm mb-6">
          {leveledUp && (
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 rounded-2xl shadow-lg flex items-center gap-4 animate-fade-in border-b-4 border-indigo-800">
                  <div className="bg-white/20 p-2 rounded-full"><ArrowUpCircle size={32} /></div>
                  <div className="text-left">
                      <div className="font-bold text-lg">LEVEL UP!</div>
                      <div className="text-xs text-purple-100">ใช้ 10 ดาวแลกของรางวัลแล้ว</div>
                  </div>
              </div>
          )}
          
          {/* Card 1: Effort Star */}
          {earnedEffortToken && (
              <div className="bg-blue-100 text-blue-800 p-3 rounded-2xl border-2 border-blue-200 shadow-sm flex items-center gap-3 animate-slide-up">
                   <div className="bg-blue-500 p-2 rounded-full text-white"><Zap fill="currentColor" size={20}/></div>
                   <div className="text-left flex-1">
                       <div className="font-bold text-sm">ขยันมาก!</div>
                       <div className="text-xs text-blue-600">เล่นครบ 5 รอบ รับดาว +1</div>
                   </div>
                   <div className="text-xl font-black text-blue-500">+1</div>
              </div>
          )}

          {/* Card 2: Perfect Score Star */}
          {earnedPerfectToken && (
              <div className="bg-yellow-100 text-yellow-800 p-3 rounded-2xl border-2 border-yellow-300 shadow-sm flex items-center gap-3 animate-slide-up" style={{animationDelay: '0.2s'}}>
                   <div className="bg-yellow-400 p-2 rounded-full text-white"><Star fill="currentColor" size={20}/></div>
                   <div className="text-left flex-1">
                       <div className="font-bold text-sm">เก่งทะลุโลก!</div>
                       <div className="text-xs text-yellow-700">คะแนนเต็ม รับดาว +1</div>
                   </div>
                   <div className="text-xl font-black text-yellow-500">+1</div>
              </div>
          )}
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        
        {isHomework ? (
            <button 
                onClick={onHome}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
            >
                <Home size={20} /> กลับหน้าหลักทันที ({countdown})
            </button>
        ) : (
            <div className="flex gap-4">
                <button 
                onClick={onHome}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${isGame ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}
                >
                <Home size={20} /> หน้าหลัก
                </button>
                {!isGame && (
                    <button 
                    onClick={onRetry}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"
                    >
                    <RefreshCw size={20} /> ทำอีกครั้ง
                    </button>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default Results;
