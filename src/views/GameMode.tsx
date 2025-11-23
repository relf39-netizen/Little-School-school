import React, { useState, useEffect, useRef } from 'react';
import { Student, Question } from '../types';
import { Users, Trophy, Play, CheckCircle, Volume2, VolumeX, Crown, Music, Zap, AlertTriangle, Clock } from 'lucide-react';
import { speak, playBGM, stopBGM, playSFX, toggleMuteSystem } from '../utils/soundUtils';
import { db, firebase } from '../services/firebaseConfig';

interface GameModeProps {
  student: Student;
  onExit: () => void;
}

type GameStatus = 'WAITING' | 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';

const GameMode: React.FC<GameModeProps> = ({ student, onExit }) => {
  const [status, setStatus] = useState<GameStatus>('WAITING');
  const [players, setPlayers] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [countdown, setCountdown] = useState(5);
  const [scores, setScores] = useState<any>({});
  const [hasAnswered, setHasAnswered] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false); // เช็คว่าผู้ใช้กดเปิดเสียงหรือยัง
  const [timer, setTimer] = useState(0);
  const [maxTime, setMaxTime] = useState(20);
  
  const isAdmin = student.id === '99999'; 
  const timerRef = useRef<any>(null);

  const toggleSound = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    toggleMuteSystem(newState);
    
    // ถ้ากดเปิดเสียง แล้วสถานะกำลังเล่น ให้เล่นเพลงทันที
    if (!newState && status === 'PLAYING') {
        playBGM('GAME');
    }
  };

  // ฟังก์ชันบังคับเปิดเสียง (ต้องกดปุ่มนี้ก่อนเล่น)
  const enableAudio = () => {
    setAudioEnabled(true);
    setIsMuted(false);
    toggleMuteSystem(false);
    playBGM('LOBBY'); 
    speak("ยินดีต้อนรับสู่สนามสอบครับ");
  };

  // จัดการเสียงตามสถานะเกม
  useEffect(() => {
    if (!audioEnabled) return;
    
    if (status === 'LOBBY') {
        playBGM('LOBBY');
    } else if (status === 'COUNTDOWN') { 
        stopBGM(); 
        playSFX('COUNTDOWN'); 
    } else if (status === 'PLAYING') {
        playBGM('GAME'); 
    } else if (status === 'FINISHED') {
        playBGM('VICTORY');
    }
    
    return () => {};
  }, [status, audioEnabled]);

  useEffect(() => {
      return () => stopBGM();
  }, []);

  // Firebase Listeners
  useEffect(() => {
    const connectedRef = db.ref(".info/connected");
    connectedRef.on('value', (snap: any) => setConnectionError(snap.val() === false));

    // 1. ฟังสถานะเกม (เพื่อเช็คว่ามีห้องไหม)
    const gameStateRef = db.ref('gameState');
    gameStateRef.on('value', (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        // ถ้ามีข้อมูล แสดงว่ามีห้อง
        setStatus(data.status || 'LOBBY');
        setCurrentQuestionIndex(data.currentQuestionIndex || 0);
        setTimer(data.timer || 0);
        if (data.timePerQuestion) setMaxTime(data.timePerQuestion);
        
        // เมื่อรู้ว่ามีห้องแล้ว ค่อยลงทะเบียนตัวเอง
        registerPlayer();
      } else {
        // ถ้าไม่มีข้อมูล gameState แปลว่ายังไม่เปิดห้อง
        setStatus('WAITING');
      }
    });

    const registerPlayer = () => {
        const playerRef = db.ref(`game/players/${student.id}`);
        playerRef.update({
            name: student.name,
            avatar: student.avatar,
            online: true,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
        playerRef.onDisconnect().update({ online: false });
    };

    const playersRef = db.ref('game/players');
    playersRef.on('value', (snap: any) => { if(snap.val()) setPlayers(Object.values(snap.val())); });
    
    const scoresRef = db.ref('game/scores');
    scoresRef.on('value', (snap: any) => { if(snap.val()) setScores(snap.val()); });

    const questionsRef = db.ref('questions');
    questionsRef.on('value', (snap: any) => {
      const data = snap.val();
      if (data) {
        const qArray = Array.isArray(data) ? data : Object.values(data);
        setQuestions(qArray.filter((q: any) => q && q.id) as Question[]);
      }
    });

    return () => {
      connectedRef.off();
      gameStateRef.off();
      playersRef.off();
      scoresRef.off();
      questionsRef.off();
    };
  }, [student.id]);

  useEffect(() => {
    setHasAnswered(false);
  }, [currentQuestionIndex]);

  // Admin Game Loop
  useEffect(() => {
    if (!isAdmin) return;
    if (timerRef.current) clearInterval(timerRef.current);

    if (status === 'COUNTDOWN') {
        let localCount = 5;
        setCountdown(localCount);
        db.ref('gameState').update({ timer: maxTime });

        timerRef.current = setInterval(() => {
            localCount--;
            setCountdown(localCount);
            if (localCount <= 0) {
                clearInterval(timerRef.current);
                db.ref('gameState').update({ status: 'PLAYING', timer: maxTime });
            }
        }, 1000);
    } else if (status === 'PLAYING') {
        let currentTimer = maxTime; 
        timerRef.current = setInterval(() => {
            currentTimer--;
            if (currentTimer >= 0) {
                 db.ref('gameState/timer').set(currentTimer);
            }
            if (currentTimer < 0) {
                clearInterval(timerRef.current);
                if (currentQuestionIndex < questions.length - 1) {
                    db.ref('gameState').update({
                        currentQuestionIndex: currentQuestionIndex + 1,
                        timer: maxTime
                    });
                } else {
                    db.ref('gameState').update({ status: 'FINISHED', timer: 0 });
                }
            }
        }, 1000);
    }

    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, isAdmin, maxTime, currentQuestionIndex, questions.length]);

  const handleStartGame = () => {
    if (questions.length === 0) return alert("ไม่พบข้อสอบ");
    db.ref('gameState').update({ status: 'COUNTDOWN' });
    db.ref('game/scores').set({});
  };

  const handleReset = () => {
    db.ref('gameState').update({ status: 'LOBBY', currentQuestionIndex: 0, timer: 0 });
    db.ref('game/scores').set({});
  };

  const handleAnswer = (choiceId: string) => {
    if (hasAnswered || timer <= 0) return;
    setHasAnswered(true);

    const currentQ = questions[currentQuestionIndex];
    const isCorrect = choiceId === currentQ.correctChoiceId;
    
    // สูตรคะแนน: 50 + (เวลาที่เหลือ * ตัวคูณ)
    const timeBonus = Math.round(50 * (timer / maxTime));
    const points = isCorrect ? (50 + timeBonus) : 0;
    
    if (points > 0) {
       // ✅ ใช้ Transaction เพื่อให้คะแนนบวกทบกันแน่นอน 100% ไม่หาย
       db.ref(`game/scores/${student.id}`).transaction((currentScore) => {
         return (currentScore || 0) + points;
       });
       playSFX('CORRECT'); speak("เยี่ยมมาก");
    } else {
       playSFX('WRONG'); speak("ยังไม่ถูก");
    }
  };

  // ✅ คำนวณ Leaderboard แบบ Real-time
  const sortedPlayers = players
    .filter(p => p.online)
    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
    
  const myRank = sortedPlayers.findIndex(p => p.id === student.id) + 1;
  const currentQuestion = questions[currentQuestionIndex];

  if (connectionError) return <div className="p-10 text-center">Connection Error...</div>;

  // --- หน้าจอ 1: รอห้อง (Waiting) ---
  if (status === 'WAITING') {
      return (
          <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6">
              <div className="bg-orange-100 p-6 rounded-full mb-6 animate-pulse">
                  <AlertTriangle size={64} className="text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">ยังไม่มีการแข่งขัน</h2>
              <p className="text-gray-500 mb-8">ครูยังไม่ได้เปิดห้องสอบ กรุณารอสักครู่...</p>
              <button onClick={onExit} className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-300 transition">
                  กลับหน้าหลัก
              </button>
          </div>
      );
  }

  // --- หน้าจอ 2: ขอเปิดเสียง (Audio Overlay) ---
  if (!audioEnabled) {
    return (
        <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-purple-700 z-[999] flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="bg-white/10 p-6 rounded-full mb-6 animate-bounce">
                <Volume2 size={64} />
            </div>
            <h2 className="text-3xl font-bold mb-4">พร้อมแข่งขันหรือยัง?</h2>
            <p className="mb-8 text-blue-100 max-w-md">
                เกมนี้ใช้เสียงเพื่อความสนุก<br/>กดปุ่มด้านล่างเพื่อเริ่มได้เลย!
            </p>
            <button onClick={enableAudio} className="bg-yellow-400 text-yellow-900 px-10 py-4 rounded-full text-xl font-black shadow-xl hover:scale-105 transition-transform flex items-center gap-3 animate-pulse cursor-pointer">
                <Zap fill="currentColor" /> เข้าสู่สนามแข่ง
            </button>
            <button onClick={onExit} className="mt-8 text-white/50 underline text-sm">กลับหน้าหลัก</button>
        </div>
    );
  }

  // --- หน้าจอ 3: Lobby ---
  if (status === 'LOBBY') {
    return (
      <div className="text-center py-10 min-h-[70vh] flex flex-col justify-center relative bg-gradient-to-b from-blue-50 to-white rounded-3xl">
        <button onClick={toggleSound} className={`absolute top-4 right-4 p-3 rounded-full shadow ${isMuted?'bg-gray-200':'bg-white'}`}>{isMuted?<VolumeX/>:<Volume2/>}</button>
        
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2 animate-bounce">🎮 ห้องพักนักกีฬา</h2>
        <p className="text-gray-500 mb-8">เตรียมตัวให้พร้อม การแข่งขันกำลังจะเริ่ม...</p>
        
        <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-blue-100 max-w-3xl mx-auto w-full mb-8">
          <div className="text-2xl font-bold text-blue-600 mb-6 flex justify-center gap-2 bg-blue-50 py-2 rounded-xl"><Users/> ผู้เข้าแข่งขัน {players.filter((p:any)=>p.online).length} คน</div>
          <div className="flex flex-wrap justify-center gap-6">
            {players.filter((p:any) => p.online).map((p: any, i) => (
              <div key={i} className="flex flex-col items-center animate-fade-in transform hover:scale-110 transition">
                  <div className="text-4xl bg-white w-16 h-16 rounded-full flex items-center justify-center border-4 border-blue-200 shadow-md">{p.avatar}</div>
                  <span className="text-xs font-bold mt-2 bg-blue-600 text-white px-3 py-1 rounded-full shadow-sm">{p.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
        {isAdmin ? <button onClick={handleStartGame} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-12 py-5 rounded-2xl text-2xl font-black shadow-xl hover:scale-105 transition mx-auto flex gap-3 border-b-8 border-emerald-700 active:border-b-0 active:translate-y-2"><Play fill="currentColor"/> เริ่มเกมเลย!</button> : <div className="animate-pulse text-blue-400 font-bold bg-blue-50 inline-block px-6 py-2 rounded-full">รอคุณครูกดเริ่มเกม...</div>}
        <button onClick={onExit} className="text-gray-400 underline text-sm mt-8 hover:text-red-500">ออกจากห้อง</button>
      </div>
    );
  }

  // --- หน้าจอ 4: Countdown ---
  if (status === 'COUNTDOWN') {
    return <div className="h-[70vh] flex flex-col items-center justify-center bg-black/5 rounded-3xl"><div className="text-2xl font-bold text-gray-500 mb-4">ARE YOU READY?</div><div className="text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-500 to-purple-600 animate-ping drop-shadow-2xl">{countdown}</div></div>;
  }

  // --- หน้าจอ 5: Playing Game ---
  if (status === 'PLAYING' && currentQuestion) {
    const timePercent = (timer / maxTime) * 100;
    const timerColor = timePercent > 50 ? 'bg-green-500' : timePercent > 20 ? 'bg-yellow-500' : 'bg-red-600';
    
    return (
      <div className="max-w-4xl mx-auto pt-4 pb-20 relative">
        <button onClick={toggleSound} className={`fixed top-20 right-4 z-50 p-2 rounded-full shadow-lg ${isMuted ? 'bg-gray-200 text-gray-500' : 'bg-green-500 text-white animate-pulse'}`}>{isMuted ? <VolumeX size={24}/> : <Volume2 size={24}/>}</button>
        
        {/* Timer Bar */}
        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-2xl shadow-md border-b-4 border-gray-200">
            <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400 font-bold uppercase">QUESTION</span>
                <span className="font-black text-2xl text-blue-600">{currentQuestionIndex+1}<span className="text-sm text-gray-400">/{questions.length}</span></span>
            </div>
            <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden relative border border-gray-300 shadow-inner">
                <div className={`h-full transition-all duration-1000 ease-linear ${timerColor}`} style={{width:`${timePercent}%`}}></div>
            </div>
            <div className={`flex flex-col items-center ${timer<=5?'animate-pulse':''}`}>
                <span className="text-xs text-gray-400 font-bold uppercase">TIME</span>
                <span className={`font-black text-2xl ${timer<=5?'text-red-600':'text-gray-700'}`}>{timer}</span>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Question Area */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border-b-8 border-blue-100 text-center relative overflow-hidden">
                    {timer <= 0 && <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center backdrop-blur-sm"><span className="bg-red-600 text-white px-8 py-4 rounded-full text-3xl font-black shadow-2xl animate-bounce border-4 border-white">หมดเวลา!</span></div>}
                    <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800 leading-relaxed">{currentQuestion.text}</h2>
                    {currentQuestion.image && <img src={currentQuestion.image} className="h-48 mx-auto object-contain mb-6 rounded-xl border-2 border-gray-100 shadow-sm"/>}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentQuestion.choices.map((c, i) => (
                            <button key={c.id} onClick={()=>handleAnswer(c.id)} disabled={hasAnswered || timer<=0} className={`p-5 rounded-2xl font-bold text-lg border-b-8 relative overflow-hidden transition active:scale-95 active:border-b-0 active:translate-y-2 ${['bg-red-50 border-red-200 text-red-800 hover:bg-red-100','bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100','bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100','bg-green-50 border-green-200 text-green-800 hover:bg-green-100'][i%4]} ${(hasAnswered||timer<=0)?'opacity-60 grayscale cursor-not-allowed':''}`}>
                                {(hasAnswered || timer<=0) && c.id === currentQuestion.correctChoiceId && <div className="absolute inset-0 bg-green-500/90 flex items-center justify-center z-10"><CheckCircle className="text-white w-10 h-10 drop-shadow-md"/></div>}
                                {c.text}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Leaderboard Area (Gradient Background) */}
            <div className="bg-gradient-to-b from-indigo-900 to-purple-900 rounded-3xl p-5 shadow-2xl border-4 border-indigo-800 text-white h-fit">
                <h3 className="text-center font-black text-xl mb-4 flex items-center justify-center gap-2 uppercase tracking-wider text-yellow-400 drop-shadow-md">
                    <Trophy className="fill-yellow-400" /> Live Ranking
                </h3>
                <div className="space-y-3">
                    {sortedPlayers.slice(0, 5).map((p, i) => (
                        <div key={p.id} className={`flex items-center justify-between p-3 rounded-2xl border-b-4 transition-all duration-500 ease-in-out transform ${i===0?'bg-yellow-400 border-yellow-600 text-yellow-900 scale-105 shadow-lg z-10':i===1?'bg-gray-300 border-gray-500 text-gray-800':i===2?'bg-orange-300 border-orange-600 text-orange-900':'bg-white/10 border-white/5 text-white'} ${p.id===student.id?'ring-4 ring-green-400':''}`}>
                            <div className="flex items-center gap-3">
                                <div className={`font-black text-xl w-8 h-8 flex items-center justify-center rounded-full ${i<3?'bg-white/30':'bg-black/20'}`}>{i+1}</div>
                                <span className="text-2xl">{p.avatar}</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm truncate max-w-[80px]">{p.name.split(' ')[0]}</span>
                                </div>
                            </div>
                            <span className="font-black text-xl">{scores[p.id]||0}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    );
  }

  // --- หน้าจอ 6: Finished (Leaderboard รวม) ---
  if (status === 'FINISHED') {
    return (
        <div className="max-w-4xl mx-auto py-10">
            <div className="text-center mb-10">
                <div className="relative inline-block">
                    <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-30 animate-pulse"></div>
                    <Trophy size={120} className="text-yellow-400 animate-bounce relative z-10 drop-shadow-2xl"/>
                </div>
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-600 mt-4 mb-2">จบการแข่งขัน!</h1>
                <p className="text-gray-500 text-lg">และผู้ชนะคือ...</p>
            </div>

            {/* Winner Podium */}
            <div className="flex justify-center items-end gap-4 mb-12 h-64 px-4">
                {/* ที่ 2 */}
                {sortedPlayers[1] && (
                    <div className="flex flex-col items-center w-1/3 animate-slide-up" style={{animationDelay: '0.2s'}}>
                        <div className="text-5xl mb-2">{sortedPlayers[1].avatar}</div>
                        <div className="text-sm font-bold text-gray-600 mb-1">{sortedPlayers[1].name}</div>
                        <div className="w-full bg-gray-300 h-32 rounded-t-2xl border-b-8 border-gray-400 flex items-center justify-center text-4xl font-black text-gray-500 shadow-lg">2</div>
                    </div>
                )}
                {/* ที่ 1 */}
                {sortedPlayers[0] && (
                    <div className="flex flex-col items-center w-1/3 z-10 animate-slide-up">
                        <Crown className="text-yellow-500 mb-2 animate-pulse" size={40} />
                        <div className="text-7xl mb-2 transform hover:scale-110 transition">{sortedPlayers[0].avatar}</div>
                        <div className="text-lg font-bold text-yellow-600 mb-1">{sortedPlayers[0].name}</div>
                        <div className="w-full bg-yellow-400 h-48 rounded-t-2xl border-b-8 border-yellow-500 flex items-center justify-center text-6xl font-black text-yellow-800 shadow-xl relative overflow-hidden">
                            1
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                )}
                {/* ที่ 3 */}
                {sortedPlayers[2] && (
                    <div className="flex flex-col items-center w-1/3 animate-slide-up" style={{animationDelay: '0.4s'}}>
                        <div className="text-5xl mb-2">{sortedPlayers[2].avatar}</div>
                        <div className="text-sm font-bold text-orange-700 mb-1">{sortedPlayers[2].name}</div>
                        <div className="w-full bg-orange-300 h-24 rounded-t-2xl border-b-8 border-orange-400 flex items-center justify-center text-4xl font-black text-orange-800 shadow-lg">3</div>
                    </div>
                )}
            </div>

            {/* Full List */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 p-4 font-bold text-gray-500 flex justify-between px-8">
                    <span>อันดับ</span>
                    <span>ผู้เล่น</span>
                    <span>คะแนน</span>
                </div>
                <div className="divide-y divide-gray-100">
                    {sortedPlayers.map((p, idx) => (
                        <div key={p.id} className={`flex items-center justify-between p-4 px-8 hover:bg-blue-50 transition ${p.id===student.id ? 'bg-blue-50' : ''}`}>
                            <div className="flex items-center gap-6">
                                <span className="font-black text-xl text-gray-300 w-8">{idx + 1}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{p.avatar}</span>
                                    <span className={`font-bold ${p.id===student.id ? 'text-blue-600' : 'text-gray-700'}`}>{p.name} {p.id===student.id && '(ฉัน)'}</span>
                                </div>
                            </div>
                            <span className="font-black text-xl text-blue-600">{scores[p.id]||0}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-10 flex justify-center gap-4">
                <button onClick={onExit} className="bg-gray-200 text-gray-700 px-8 py-3 rounded-full font-bold hover:bg-gray-300 transition">ออกจากห้อง</button>
                {isAdmin && <button onClick={handleReset} className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 shadow-lg transition">เริ่มเกมใหม่</button>}
            </div>
        </div>
    );
  }

  return <div className="flex flex-col items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div><p className="text-gray-400 animate-pulse">กำลังเชื่อมต่อ...</p></div>;
};

export default GameMode;