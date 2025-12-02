import React, { useState, useEffect, useRef } from 'react';
import { Student, Question } from '../types';
import { Users, Trophy, Play, CheckCircle, Volume2, VolumeX, Crown, Zap, AlertTriangle, XCircle, KeyRound, LogIn } from 'lucide-react';
import { speak, playBGM, stopBGM, playSFX, toggleMuteSystem, stopSpeak } from '../utils/soundUtils';
import { db, firebase } from '../services/firebaseConfig';

interface GameModeProps {
  student: Student;
  initialRoomCode?: string; // ✅ รับค่าห้องถ้าเป็นครู (เข้าอัตโนมัติ)
  onExit: () => void;
  onFinish?: (score: number, total: number) => void;
}

type GameStatus = 'INPUT_PIN' | 'WAITING' | 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';

const GameMode: React.FC<GameModeProps> = ({ student, initialRoomCode, onExit, onFinish }) => {
  const [status, setStatus] = useState<GameStatus>('INPUT_PIN');
  const [roomCode, setRoomCode] = useState<string>('');
  
  const [players, setPlayers] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [countdown, setCountdown] = useState(5);
  
  const [scores, setScores] = useState<any>({});
  const [correctCount, setCorrectCount] = useState(0);
  
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null); 
  const [connectionError, setConnectionError] = useState(false);
  
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  // ✅ สถานะเปิด/ปิดเสียงอ่านโจทย์ (ค่าเริ่มต้น: ปิด = false)
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  
  const [timer, setTimer] = useState(0);
  const [maxTime, setMaxTime] = useState(20);
  const [joinError, setJoinError] = useState('');
  
  const isAdmin = student.id === '99999'; 
  const timerRef = useRef<any>(null);

  // ✅ ถ้าเป็นครู ให้ใช้รหัสห้องที่ส่งมาเลย และข้ามหน้า Input PIN
  useEffect(() => {
      if (initialRoomCode && isAdmin) {
          setRoomCode(initialRoomCode);
          connectToRoom(initialRoomCode);
      }
  }, [initialRoomCode, isAdmin]);

  const toggleSound = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    toggleMuteSystem(newState);
    // Resume music if unmuted during playing
    if (!newState) {
        if (status === 'PLAYING') playBGM('GAME');
        else if (status === 'LOBBY') playBGM('LOBBY');
        else if (status === 'FINISHED') playBGM('VICTORY');
    }
  };

  const enableAudio = () => {
    setAudioEnabled(true);
    setIsMuted(false);
    toggleMuteSystem(false);
    playBGM('LOBBY'); 
    speak("ยินดีต้อนรับสู่สนามสอบครับ");
  };

  // ✅ Audio State Management
  useEffect(() => {
    if (!audioEnabled) return;
    
    if (status === 'LOBBY') {
        playBGM('LOBBY');
    } else if (status === 'COUNTDOWN') { 
        stopBGM(); 
        // Countdown sound is handled in the countdown effect loop
    } else if (status === 'PLAYING') {
        playBGM('GAME');
    } else if (status === 'FINISHED') {
        playBGM('VICTORY');
    }
    
    return () => {};
  }, [status, audioEnabled]);

  useEffect(() => { return () => stopBGM(); }, []);

  // ✅ Read Question in Game
  useEffect(() => {
      if (status === 'PLAYING' && isTTSEnabled && questions[currentQuestionIndex]) {
          const q = questions[currentQuestionIndex];
          let text = "โจทย์.. " + q.text;
          q.choices.forEach((c, i) => text += `. ${c.text}`);
          speak(text);
      } else {
          stopSpeak();
      }
  }, [currentQuestionIndex, isTTSEnabled, status]);

  // ✅ Countdown Visuals & Sound (Runs for Everyone)
  useEffect(() => {
    if (status === 'COUNTDOWN') {
        let count = 5;
        setCountdown(count);
        if (audioEnabled && !isMuted) playSFX('COUNTDOWN');
        
        const interval = setInterval(() => {
            count--;
            setCountdown(count);
            if (count > 0 && audioEnabled && !isMuted) {
                playSFX('COUNTDOWN');
            }
        }, 1000);
        
        return () => clearInterval(interval);
    }
  }, [status, audioEnabled, isMuted]);

  // ... (Connect logic same as before) ...
  const connectToRoom = (code: string) => {
    const roomPath = `games/${code}`;
    db.ref(`${roomPath}/gameState`).once('value').then((snapshot) => {
        const gameState = snapshot.val();
        if (!gameState) { setJoinError('❌ ไม่พบห้องสอบนี้'); return; }
        if (!isAdmin && gameState.schoolId && gameState.schoolId !== student.school) { setJoinError(`❌ ห้องนี้สำหรับโรงเรียน ${gameState.schoolId} เท่านั้น`); return; }

        setJoinError(''); setRoomCode(code);
        
        const connectedRef = db.ref(".info/connected"); connectedRef.on('value', (snap: any) => setConnectionError(snap.val() === false));
        const gameStateRef = db.ref(`${roomPath}/gameState`);
        gameStateRef.on('value', (snap: any) => {
            const data = snap.val();
            if (data) {
                setStatus(data.status || 'LOBBY');
                setCurrentQuestionIndex(data.currentQuestionIndex || 0);
                setTimer(data.timer || 0);
                if (data.timePerQuestion) setMaxTime(data.timePerQuestion);
                if (!isAdmin) registerPlayer(roomPath);
            } else { setJoinError('ห้องสอบถูกปิดแล้ว'); setStatus('INPUT_PIN'); }
        });
        const playersRef = db.ref(`${roomPath}/players`);
        playersRef.on('value', (snap: any) => { const val = snap.val(); if(val) { const allPlayers = Object.keys(val).map(key => ({ id: key, ...val[key] })); setPlayers(allPlayers.filter((p:any) => p.name !== undefined && String(p.id) !== '99999')); } else { setPlayers([]); } });
        const scoresRef = db.ref(`${roomPath}/scores`); scoresRef.on('value', (snap: any) => { setScores(snap.val() || {}); });
        const questionsRef = db.ref(`${roomPath}/questions`);
        questionsRef.on('value', (snap: any) => { const data = snap.val(); if (data) { const qArray = Array.isArray(data) ? data : Object.values(data); setQuestions(qArray.filter((q: any) => q && q.id) as Question[]); } });
    });
  };

  const registerPlayer = (roomPath: string) => {
        const playerRef = db.ref(`${roomPath}/players/${student.id}`);
        playerRef.update({ id: student.id, name: student.name, avatar: student.avatar, online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });
        playerRef.onDisconnect().update({ online: false });
  };

  useEffect(() => { setHasAnswered(false); setSelectedChoice(null); }, [currentQuestionIndex]);

  // ✅ Admin Logic (State Control Only)
  useEffect(() => {
    if (!isAdmin || !roomCode || status === 'INPUT_PIN') return;
    const roomPath = `games/${roomCode}`;
    
    // Clear any existing timers when status changes
    if (timerRef.current) {
        clearTimeout(timerRef.current);
        clearInterval(timerRef.current);
    }

    if (status === 'COUNTDOWN') {
        db.ref(`${roomPath}/gameState`).update({ timer: maxTime });
        // Wait 5 seconds (matching visual countdown) then start
        timerRef.current = setTimeout(() => {
             db.ref(`${roomPath}/gameState`).update({ status: 'PLAYING', timer: maxTime });
        }, 5000);
    } else if (status === 'PLAYING') {
        let currentTimer = maxTime; 
        timerRef.current = setInterval(() => {
            currentTimer--; 
            if (currentTimer >= 0) db.ref(`${roomPath}/gameState/timer`).set(currentTimer);
            if (currentTimer < 0) {
                clearInterval(timerRef.current);
                if (currentQuestionIndex < questions.length - 1) {
                    db.ref(`${roomPath}/gameState`).update({ currentQuestionIndex: currentQuestionIndex + 1, timer: maxTime });
                } else {
                    db.ref(`${roomPath}/gameState`).update({ status: 'FINISHED', timer: 0 });
                }
            }
        }, 1000);
    }
    
    return () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            clearInterval(timerRef.current);
        }
    };
  }, [status, isAdmin, maxTime, currentQuestionIndex, questions.length, roomCode]);

  const handleStartGame = () => { if (!roomCode) return; if (questions.length === 0) return alert("ไม่พบข้อสอบ"); db.ref(`games/${roomCode}/scores`).set({}); db.ref(`games/${roomCode}/gameState`).update({ status: 'COUNTDOWN' }); };
  const handleReset = () => { if (!roomCode) return; db.ref(`games/${roomCode}/gameState`).update({ status: 'LOBBY', currentQuestionIndex: 0, timer: 0 }); db.ref(`games/${roomCode}/scores`).set({}); setCorrectCount(0); setHasAnswered(false); setSelectedChoice(null); };
  const normalizeId = (id: string | number) => String(id).trim().toLowerCase().replace('.', '');

  const handleAnswer = (choiceId: string) => {
    if (hasAnswered || timer <= 0 || !roomCode) return;
    setHasAnswered(true); setSelectedChoice(choiceId);
    const currentQ = questions[currentQuestionIndex];
    const normChoice = normalizeId(choiceId);
    const normCorrect = normalizeId(currentQ.correctChoiceId);
    let isCorrect = normChoice === normCorrect;
    if (!isCorrect) {
        const choiceIndex = currentQ.choices.findIndex(c => normalizeId(c.id) === normChoice);
        const correctIndex = parseInt(normCorrect);
        if (choiceIndex !== -1 && !isNaN(correctIndex) && (choiceIndex + 1) === correctIndex) isCorrect = true;
    }
    
    if (isCorrect) {
       setCorrectCount(prev => prev + 1);
       const timeBonus = Math.max(0, Math.round(50 * (timer / maxTime)));
       const points = 50 + timeBonus;
       playSFX('CORRECT'); speak("เยี่ยมมาก");
       db.ref(`games/${roomCode}/scores/${student.id}`).transaction((currentScore) => (currentScore || 0) + points);
    } else { playSFX('WRONG'); speak("ยังไม่ถูก"); }
  };

  const handleFinishAndExit = () => { if (status === 'FINISHED' && onFinish && !isAdmin) { onFinish(correctCount, questions.length); } else { onExit(); } };
  const sortedPlayers = players.filter(p => p.online && String(p.id) !== '99999').sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const currentQuestion = questions[currentQuestionIndex];

  // RENDER
  if (status === 'INPUT_PIN' && !isAdmin) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
              <div className="bg-white p-8 rounded-3xl shadow-xl border-4 border-blue-50 w-full max-w-md text-center">
                  <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600"><KeyRound size={40} /></div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">เข้าร่วมการแข่งขัน</h2>
                  <p className="text-gray-500 mb-6">กรอกรหัสห้อง 6 หลัก ที่คุณครูให้</p>
                  <input type="text" maxLength={6} value={roomCode} onChange={(e) => setRoomCode(e.target.value.replace(/[^0-9]/g, ''))} placeholder="000000" className="w-full text-center text-4xl font-mono font-bold tracking-widest p-4 border-2 border-gray-200 rounded-2xl mb-4 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition" />
                  {joinError && <p className="text-red-500 font-bold mb-4 bg-red-50 p-2 rounded-lg">{joinError}</p>}
                  <button onClick={() => connectToRoom(roomCode)} disabled={roomCode.length !== 6} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"><LogIn size={24} /> เข้าห้องสอบ</button>
                  <button onClick={onExit} className="mt-6 text-gray-400 text-sm hover:text-gray-600 underline">กลับหน้าหลัก</button>
              </div>
          </div>
      );
  }

  if (connectionError) return <div className="p-10 text-center">Connection Error...</div>;

  if (!audioEnabled) {
    return (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 to-purple-900 z-[999] flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="bg-white/10 p-6 rounded-full mb-6 animate-bounce"><Volume2 size={64} /></div>
            <h2 className="text-3xl font-bold mb-4">พร้อมแข่งขันหรือยัง?</h2>
            <p className="mb-8 text-blue-100 max-w-md">เกมนี้ใช้เสียงเพื่อความสนุก<br/>กดปุ่มด้านล่างเพื่อเริ่มได้เลย!</p>
            <button onClick={enableAudio} className="bg-yellow-400 text-yellow-900 px-10 py-4 rounded-full text-xl font-black shadow-[0_0_20px_rgba(250,204,21,0.6)] hover:scale-105 transition-transform flex items-center gap-3 animate-pulse cursor-pointer"><Zap fill="currentColor" /> เข้าสู่สนามแข่ง</button>
            <button onClick={onExit} className="mt-8 text-white/50 underline text-sm">กลับหน้าหลัก</button>
        </div>
    );
  }

  if (status === 'LOBBY') {
    return (
      <div className="text-center py-10 min-h-[70vh] flex flex-col justify-center relative bg-gradient-to-b from-blue-50 to-white rounded-3xl">
        <button onClick={toggleSound} className={`absolute top-4 right-4 p-3 rounded-full shadow ${isMuted?'bg-gray-200':'bg-white'}`}>{isMuted?<VolumeX/>:<Volume2/>}</button>
        <div className="mb-6"><div className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-1">GAME PIN</div><div className="text-6xl md:text-8xl font-black text-gray-800 tracking-widest font-mono bg-white inline-block px-8 py-4 rounded-3xl border-4 border-gray-100 shadow-xl">{roomCode}</div></div>
        <h2 className="text-2xl font-bold text-blue-900 mb-2 animate-bounce">🎮 ห้องพักนักกีฬา</h2>
        <div className="text-sm text-gray-400 font-medium mb-4">โรงเรียน: {student.school}</div>
        <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-blue-100 max-w-3xl mx-auto w-full mb-8"><div className="text-2xl font-bold text-blue-600 mb-6 flex justify-center gap-2 bg-blue-50 py-2 rounded-xl"><Users/> ผู้เข้าแข่งขัน {sortedPlayers.length} คน</div><div className="flex flex-wrap justify-center gap-6">{sortedPlayers.map((p: any, i) => (<div key={i} className="flex flex-col items-center animate-fade-in transform hover:scale-110 transition"><div className="text-4xl bg-white w-16 h-16 rounded-full flex items-center justify-center border-4 border-blue-200 shadow-md">{p.avatar}</div><span className="text-xs font-bold mt-2 bg-blue-600 text-white px-3 py-1 rounded-full shadow-sm">{p.name.split(' ')[0]}</span></div>))}</div></div>
        {isAdmin ? <button onClick={handleStartGame} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-12 py-5 rounded-2xl text-2xl font-black shadow-xl hover:scale-105 transition mx-auto flex gap-3 border-b-8 border-emerald-700 active:border-b-0 active:translate-y-2"><Play fill="currentColor"/> เริ่มเกมเลย!</button> : <div className="animate-pulse text-blue-400 font-bold bg-blue-50 inline-block px-6 py-2 rounded-full">รอคุณครูกดเริ่มเกม...</div>}
        <button onClick={onExit} className="text-gray-400 underline text-sm mt-8 hover:text-red-500">ออกจากห้อง</button>
      </div>
    );
  }

  if (status === 'COUNTDOWN') { return <div className="h-[70vh] flex flex-col items-center justify-center bg-black/5 rounded-3xl"><div className="text-2xl font-bold text-gray-500 mb-4">ARE YOU READY?</div><div className="text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-500 to-purple-600 animate-ping drop-shadow-2xl">{countdown}</div></div>; }

  if (status === 'PLAYING') {
    const timePercent = (timer / maxTime) * 100;
    const timerColor = timePercent > 50 ? 'bg-green-500' : timePercent > 20 ? 'bg-yellow-500' : 'bg-red-600';
    if (isAdmin) {
        return (
            <div className="max-w-4xl mx-auto pt-4 pb-20 relative">
                <div className="flex justify-between items-center mb-6 bg-gray-900 text-white p-4 rounded-2xl shadow-lg">
                   <div className="flex items-center gap-4"><div className="bg-white/10 px-3 py-1 rounded font-mono text-xl">{roomCode}</div><div className={`font-mono font-black text-4xl ${timer<=5?'text-red-400 animate-pulse':''}`}>{timer}</div><div className="text-sm opacity-80">ข้อที่ {currentQuestionIndex+1}/{questions.length}</div></div>
                   <div className="text-xl font-bold text-yellow-400">🏆 Live Ranking</div>
                   <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-xs font-bold">จบเกม</button>
                </div>
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-indigo-100"><div className="bg-indigo-50 p-4 flex justify-between font-bold text-indigo-900 text-sm uppercase tracking-wider"><span>อันดับ</span><span>ผู้เข้าแข่งขัน</span><span>คะแนน</span></div><div className="divide-y divide-gray-100">{sortedPlayers.map((p, i) => (<div key={p.id} className={`flex items-center justify-between p-4 transition-all duration-700 ease-in-out transform translate-y-0 ${i===0?'bg-yellow-50 scale-[1.02] shadow-md z-10':i%2===0?'bg-white':'bg-gray-50'}`}><div className="flex items-center gap-4"><div className={`w-10 h-10 flex items-center justify-center rounded-full font-black text-lg ${i===0?'bg-yellow-400 text-yellow-900':i===1?'bg-gray-300 text-gray-800':i===2?'bg-orange-300 text-orange-900':'bg-gray-200 text-gray-500'}`}>{i+1}</div><span className="text-3xl">{p.avatar}</span><span className="font-bold text-lg text-gray-800">{p.name}</span></div><span className="font-black text-2xl text-indigo-600">{scores[p.id]||0}</span></div>))}</div></div>
            </div>
        );
    }

    return (
      <div className="max-w-4xl mx-auto pt-4 pb-20 relative">
        {/* Buttons: Mute System and TTS Toggle */}
        <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
            <button onClick={toggleSound} className={`p-2 rounded-full shadow-lg ${isMuted ? 'bg-gray-200 text-gray-500' : 'bg-green-500 text-white'}`}>{isMuted ? <VolumeX size={24}/> : <Volume2 size={24}/>}</button>
            <button onClick={() => setIsTTSEnabled(!isTTSEnabled)} className={`p-2 rounded-full shadow-lg border-2 ${isTTSEnabled ? 'bg-blue-100 text-blue-600 border-blue-300' : 'bg-white text-gray-400 border-transparent'}`}>{isTTSEnabled ? <Volume2 size={24} className="animate-pulse"/> : <VolumeX size={24}/>}</button>
        </div>
        
        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-2xl shadow-md border-b-4 border-gray-200">
            <div className="flex flex-col items-center"><span className="text-xs text-gray-400 font-bold uppercase">QUESTION</span><span className="font-black text-2xl text-blue-600">{currentQuestionIndex+1}<span className="text-sm text-gray-400">/{questions.length}</span></span></div>
            <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden relative border border-gray-300 shadow-inner"><div className={`h-full transition-all duration-1000 ease-linear ${timerColor}`} style={{width:`${timePercent}%`}}></div></div>
            <div className={`flex flex-col items-center ${timer<=5?'animate-pulse':''}`}><span className="text-xs text-gray-400 font-bold uppercase">TIME</span><span className={`font-black text-2xl ${timer<=5?'text-red-600':'text-gray-700'}`}>{timer}</span></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border-b-8 border-blue-100 text-center relative overflow-hidden">
                    {timer <= 0 && <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center backdrop-blur-sm"><span className="bg-red-600 text-white px-8 py-4 rounded-full text-3xl font-black shadow-2xl animate-bounce border-4 border-white">หมดเวลา!</span></div>}
                    <div className="flex items-start justify-center gap-4 mb-6">
                         <h2 className="text-xl md:text-2xl font-bold text-gray-800 leading-relaxed text-left">{currentQuestion?.text}</h2>
                         <button 
                            onClick={() => speak(currentQuestion.text)} 
                            className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 hover:bg-blue-50 rounded-full transition-colors flex-shrink-0"
                        >
                            <Volume2 size={24} />
                        </button>
                    </div>
                    {currentQuestion?.image && <img src={currentQuestion.image} className="h-48 mx-auto object-contain mb-6 rounded-xl border-2 border-gray-100 shadow-sm"/>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentQuestion?.choices.map((c, i) => {
                             let btnClass = ['bg-red-50 border-red-200 text-red-800 hover:bg-red-100','bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100','bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100','bg-green-50 border-green-200 text-green-800 hover:bg-green-100'][i%4];
                             const isSelected = selectedChoice === c.id;
                             if (hasAnswered || timer <= 0) {
                                 btnClass += ' opacity-60 grayscale cursor-not-allowed';
                                 const normId = normalizeId(c.id); const normCorrect = normalizeId(currentQuestion.correctChoiceId);
                                 let isThisCorrect = normId === normCorrect;
                                 if(!isThisCorrect) { const cIdx = currentQuestion.choices.findIndex(ch => normalizeId(ch.id) === normId); const corrIdx = parseInt(normCorrect); if(cIdx !== -1 && !isNaN(corrIdx) && cIdx+1 === corrIdx) isThisCorrect = true; }
                                 if (isThisCorrect) { btnClass = 'bg-green-100 border-green-500 text-green-900 !opacity-100 !grayscale-0 ring-4 ring-green-200 shadow-lg'; } else if (isSelected) { btnClass = 'bg-red-100 border-red-500 text-red-900 !opacity-100 !grayscale-0 ring-4 ring-red-200 shadow-lg'; }
                             }
                             return (<button key={c.id} onClick={()=>handleAnswer(c.id)} disabled={hasAnswered || timer<=0} className={`p-5 rounded-2xl font-bold text-lg border-b-8 relative overflow-hidden transition active:scale-95 active:border-b-0 active:translate-y-2 ${btnClass}`}>{(hasAnswered || timer<=0) && normalizeId(c.id) === normalizeId(currentQuestion.correctChoiceId) && <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-10"><CheckCircle className="text-green-600 w-10 h-10 drop-shadow-md bg-white rounded-full"/></div>}{(hasAnswered || timer<=0) && isSelected && normalizeId(c.id) !== normalizeId(currentQuestion.correctChoiceId) && (<div className="absolute inset-0 bg-red-500/20 flex items-center justify-center z-10"><XCircle className="text-red-600 w-10 h-10 drop-shadow-md bg-white rounded-full"/></div>)}{c.text}</button>);
                        })}
                    </div>
                </div>
            </div>
            <div className="bg-gradient-to-b from-indigo-900 to-purple-900 rounded-3xl p-5 shadow-2xl border-4 border-indigo-800 text-white h-fit"><h3 className="text-center font-black text-xl mb-4 flex items-center justify-center gap-2 uppercase tracking-wider text-yellow-400 drop-shadow-md"><Trophy className="fill-yellow-400" /> Live Ranking</h3><div className="bg-white/10 p-2 rounded-lg mb-4 flex justify-between items-center border border-white/20"><span className="font-bold text-sm">คะแนนของฉัน</span><span className="font-black text-xl text-yellow-400 animate-pulse">{scores[student.id] || 0}</span></div><div className="bg-white/10 p-2 rounded-lg mb-4 flex justify-between items-center border border-white/20"><span className="font-bold text-sm">ตอบถูก (ข้อ)</span><span className="font-black text-xl text-green-400">{correctCount}/{questions.length}</span></div><div className="space-y-3">{sortedPlayers.slice(0, 5).map((p, i) => (<div key={p.id} className={`flex items-center justify-between p-3 rounded-2xl border-b-4 transition-all duration-500 ease-in-out transform ${i===0?'bg-yellow-400 border-yellow-600 text-yellow-900 scale-105 shadow-lg z-10':i===1?'bg-gray-300 border-gray-500 text-gray-800':i===2?'bg-orange-300 border-orange-600 text-orange-900':'bg-white/10 border-white/5 text-white'} ${p.id===student.id?'ring-4 ring-green-400':''}`}><div className="flex items-center gap-3"><div className={`font-black text-xl w-8 h-8 flex items-center justify-center rounded-full ${i<3?'bg-white/30':'bg-black/20'}`}>{i+1}</div><span className="text-2xl">{p.avatar}</span><div className="flex flex-col"><span className="font-bold text-sm truncate max-w-[80px]">{p.name.split(' ')[0]}</span></div></div><span className="font-black text-xl">{scores[p.id]||0}</span></div>))}</div></div>
        </div>
      </div>
    );
  }

  if (status === 'FINISHED') {
    const winner = sortedPlayers[0];
    return (
        <div className="max-w-4xl mx-auto py-10">
            <div className="text-center mb-10"><div className="relative inline-block"><div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-30 animate-pulse"></div><Trophy size={120} className="text-yellow-400 animate-bounce relative z-10 drop-shadow-2xl"/></div><h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-600 mt-4 mb-2">จบการแข่งขัน!</h1><p className="text-gray-500 text-lg">และผู้ชนะคือ...</p></div>
            <div className="flex justify-center items-end gap-4 mb-12 h-64 px-4">{sortedPlayers[1] && (<div className="flex flex-col items-center w-1/3 animate-slide-up" style={{animationDelay: '0.2s'}}><div className="text-5xl mb-2">{sortedPlayers[1].avatar}</div><div className="text-sm font-bold text-gray-600 mb-1">{sortedPlayers[1].name}</div><div className="w-full bg-gray-300 h-32 rounded-t-2xl border-b-8 border-gray-400 flex items-center justify-center text-4xl font-black text-gray-500 shadow-lg">2</div></div>)}{sortedPlayers[0] && (<div className="flex flex-col items-center w-1/3 z-10 animate-slide-up"><Crown className="text-yellow-500 mb-2 animate-pulse" size={40} /><div className="text-7xl mb-2 transform hover:scale-110 transition">{sortedPlayers[0].avatar}</div><div className="text-lg font-bold text-yellow-600 mb-1">{sortedPlayers[0].name}</div><div className="w-full bg-yellow-400 h-48 rounded-t-2xl border-b-8 border-yellow-500 flex items-center justify-center text-6xl font-black text-yellow-800 shadow-xl relative overflow-hidden">1<div className="absolute inset-0 bg-white/20 animate-pulse"></div></div></div>)}{sortedPlayers[2] && (<div className="flex flex-col items-center w-1/3 animate-slide-up" style={{animationDelay: '0.4s'}}><div className="text-5xl mb-2">{sortedPlayers[2].avatar}</div><div className="text-sm font-bold text-orange-700 mb-1">{sortedPlayers[2].name}</div><div className="w-full bg-orange-300 h-24 rounded-t-2xl border-b-8 border-orange-400 flex items-center justify-center text-4xl font-black text-orange-800 shadow-lg">3</div></div>)}</div>
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"><div className="bg-gray-50 p-4 font-bold text-gray-500 flex justify-between px-8"><span>อันดับ</span><span>ผู้เล่น</span><span>คะแนน</span></div><div className="divide-y divide-gray-100">{sortedPlayers.map((p, idx) => (<div key={p.id} className={`flex items-center justify-between p-4 px-8 hover:bg-blue-50 transition ${p.id===student.id ? 'bg-blue-50' : ''}`}><div className="flex items-center gap-6"><span className="font-black text-xl text-gray-300 w-8">{idx + 1}</span><div className="flex items-center gap-3"><span className="text-3xl">{p.avatar}</span><span className={`font-bold ${p.id===student.id ? 'text-blue-600' : 'text-gray-700'}`}>{p.name} {p.id===student.id && '(ฉัน)'}</span></div></div><span className="font-black text-xl text-blue-600">{scores[p.id]||0}</span></div>))}</div></div>
            <div className="mt-10 flex justify-center gap-4"><button onClick={handleFinishAndExit} className="bg-gray-200 text-gray-700 px-8 py-3 rounded-full font-bold hover:bg-gray-300 transition">ออกจากห้อง</button>{isAdmin && <button onClick={handleReset} className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 shadow-lg transition">เริ่มเกมใหม่</button>}</div>
        </div>
    );
  }

  return <div className="flex flex-col items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div><p className="text-gray-400 animate-pulse">กำลังเชื่อมต่อ...</p></div>;
};

export default GameMode;