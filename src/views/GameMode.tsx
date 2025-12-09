
import React, { useState, useEffect, useRef } from 'react';
import { Student, Question } from '../types';
import { Users, Trophy, Play, CheckCircle, Volume2, VolumeX, Crown, Zap, XCircle, KeyRound, LogIn } from 'lucide-react';
import { speak, playBGM, stopBGM, playSFX, toggleMuteSystem, stopSpeak } from '../utils/soundUtils';
import { supabase } from '../services/firebaseConfig'; 

interface GameModeProps {
  student: Student;
  initialRoomCode?: string;
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
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [timer, setTimer] = useState(0);
  const [maxTime, setMaxTime] = useState(20);
  const [joinError, setJoinError] = useState('');
  
  const isAdmin = student.id === '99999'; 
  const timerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

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
    if (!newState && status === 'PLAYING') playBGM('GAME');
  };

  const enableAudio = () => {
    setAudioEnabled(true);
    setIsMuted(false);
    toggleMuteSystem(false);
    playBGM('LOBBY'); 
    speak("ยินดีต้อนรับสู่สนามสอบครับ");
  };

  useEffect(() => {
    if (!audioEnabled) return;
    if (status === 'LOBBY') playBGM('LOBBY');
    else if (status === 'COUNTDOWN') { stopBGM(); playSFX('COUNTDOWN'); }
    else if (status === 'PLAYING') playBGM('GAME');
    else if (status === 'FINISHED') playBGM('VICTORY');
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

  // 🔵 SUPABASE REALTIME CONNECTION
  const connectToRoom = async (code: string) => {
    // 1. Fetch Game State
    const { data: gameData, error } = await supabase.from('games').select('*').eq('room_code', code).single();
    if (error || !gameData) { setJoinError('❌ ไม่พบห้องสอบนี้'); return; }
    if (!isAdmin && gameData.school_id && gameData.school_id !== student.school) { setJoinError(`❌ ห้องนี้สำหรับโรงเรียน ${gameData.school_id} เท่านั้น`); return; }

    setJoinError('');
    setRoomCode(code);
    setStatus(gameData.status || 'LOBBY');
    setCurrentQuestionIndex(gameData.current_question_index || 0);
    setTimer(gameData.timer || 0);
    setMaxTime(gameData.time_per_question || 20);
    
    // Parse Questions (Assuming stored as JSONB)
    const parsedQuestions = typeof gameData.questions === 'string' ? JSON.parse(gameData.questions) : gameData.questions;
    setQuestions(parsedQuestions || []);

    // 2. Load initial players
    const { data: playersData } = await supabase.from('game_players').select('*').eq('room_code', code);
    if(playersData) {
        setPlayers(playersData.map(p => ({...p, id: p.student_id})));
        const scoreMap: any = {};
        playersData.forEach(p => scoreMap[p.student_id] = p.score);
        setScores(scoreMap);
    }

    if (!isAdmin) {
        // Register current player
        await supabase.from('game_players').upsert({
            room_code: code,
            student_id: student.id,
            name: student.name,
            avatar: student.avatar,
            online: true
        }, { onConflict: 'room_code,student_id' });
    }

    // 3. Subscribe to Realtime Changes
    const channel = supabase.channel(`game:${code}`, {
        config: { presence: { key: student.id } }
    });

    channel
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `room_code=eq.${code}` }, (payload) => {
        const newData = payload.new;
        if(newData.status) setStatus(newData.status);
        if(newData.current_question_index !== undefined) setCurrentQuestionIndex(newData.current_question_index);
        if(newData.timer !== undefined) setTimer(newData.timer);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `room_code=eq.${code}` }, (payload) => {
        // Simple reload on player change for simplicity in this migration
        fetchPlayers(code); 
    })
    .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await channel.track({ online_at: new Date().toISOString(), student_id: student.id });
        }
    });

    channelRef.current = channel;
  };

  const fetchPlayers = async (code: string) => {
      const { data } = await supabase.from('game_players').select('*').eq('room_code', code);
      if(data) {
          setPlayers(data.map(p => ({...p, id: p.student_id})));
          const scoreMap: any = {};
          data.forEach(p => scoreMap[p.student_id] = p.score);
          setScores(scoreMap);
      }
  };

  useEffect(() => { setHasAnswered(false); setSelectedChoice(null); }, [currentQuestionIndex]);

  // Admin Timer Loop
  useEffect(() => {
    if (!isAdmin || !roomCode || status === 'INPUT_PIN') return;
    
    if (timerRef.current) clearInterval(timerRef.current);

    if (status === 'COUNTDOWN') {
        let localCount = 5; setCountdown(localCount); 
        // Sync minimal DB updates
        timerRef.current = setInterval(async () => { 
            localCount--; setCountdown(localCount); 
            if (localCount <= 0) { 
                clearInterval(timerRef.current); 
                await supabase.from('games').update({ status: 'PLAYING', timer: maxTime }).eq('room_code', roomCode); 
            } 
        }, 1000);
    } else if (status === 'PLAYING') {
        let currentTimer = maxTime; 
        timerRef.current = setInterval(async () => {
            currentTimer--; 
            // Update timer every second
            if (currentTimer >= 0) await supabase.from('games').update({ timer: currentTimer }).eq('room_code', roomCode);
            if (currentTimer < 0) {
                clearInterval(timerRef.current);
                if (currentQuestionIndex < questions.length - 1) {
                    await supabase.from('games').update({ current_question_index: currentQuestionIndex + 1, timer: maxTime }).eq('room_code', roomCode);
                } else {
                    await supabase.from('games').update({ status: 'FINISHED', timer: 0 }).eq('room_code', roomCode);
                }
            }
        }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, isAdmin, maxTime, currentQuestionIndex, questions.length, roomCode]);

  const handleStartGame = async () => { if (!roomCode) return; await supabase.from('games').update({ status: 'COUNTDOWN' }).eq('room_code', roomCode); };
  const handleReset = async () => { if (!roomCode) return; await supabase.from('games').update({ status: 'LOBBY', current_question_index: 0, timer: 0 }).eq('room_code', roomCode); setCorrectCount(0); setHasAnswered(false); };
  const normalizeId = (id: string | number) => String(id).trim().toLowerCase().replace('.', '');

  const handleAnswer = async (choiceId: string) => {
    if (hasAnswered || timer <= 0 || !roomCode) return;
    setHasAnswered(true); setSelectedChoice(choiceId);
    const currentQ = questions[currentQuestionIndex];
    const normChoice = normalizeId(choiceId);
    const normCorrect = normalizeId(currentQ.correctChoiceId);
    let isCorrect = normChoice === normCorrect;
    
    // Check index fallback
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
       
       // Update score in DB
       const currentScore = scores[student.id] || 0;
       await supabase.from('game_players').update({ score: currentScore + points }).eq('room_code', roomCode).eq('student_id', student.id);
    } else { playSFX('WRONG'); speak("ยังไม่ถูก"); }
  };

  const handleFinishAndExit = () => { 
      if(channelRef.current) supabase.removeChannel(channelRef.current);
      if (status === 'FINISHED' && onFinish && !isAdmin) { onFinish(correctCount, questions.length); } else { onExit(); } 
  };
  
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const currentQuestion = questions[currentQuestionIndex];

  // RENDER BLOCKS
  if (status === 'INPUT_PIN' && !isAdmin) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
              <div className="bg-white p-8 rounded-3xl shadow-xl border-4 border-blue-50 w-full max-w-md text-center">
                  <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600"><KeyRound size={40} /></div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">เข้าร่วมการแข่งขัน</h2>
                  <p className="text-gray-500 mb-6">กรอกรหัสห้อง 6 หลัก</p>
                  <input type="text" maxLength={6} value={roomCode} onChange={(e) => setRoomCode(e.target.value.replace(/[^0-9]/g, ''))} placeholder="000000" className="w-full text-center text-4xl font-mono font-bold tracking-widest p-4 border-2 border-gray-200 rounded-2xl mb-4 focus:border-blue-500 outline-none" />
                  {joinError && <p className="text-red-500 font-bold mb-4 bg-red-50 p-2 rounded-lg">{joinError}</p>}
                  <button onClick={() => connectToRoom(roomCode)} disabled={roomCode.length !== 6} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2"><LogIn size={24} /> เข้าห้องสอบ</button>
                  <button onClick={onExit} className="mt-6 text-gray-400 text-sm hover:text-gray-600 underline">กลับหน้าหลัก</button>
              </div>
          </div>
      );
  }

  if (!audioEnabled) {
    return (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 to-purple-900 z-[999] flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="bg-white/10 p-6 rounded-full mb-6 animate-bounce"><Volume2 size={64} /></div>
            <h2 className="text-3xl font-bold mb-4">พร้อมแข่งขันหรือยัง?</h2>
            <button onClick={enableAudio} className="bg-yellow-400 text-yellow-900 px-10 py-4 rounded-full text-xl font-black shadow-[0_0_20px_rgba(250,204,21,0.6)] hover:scale-105 transition-transform flex items-center gap-3 animate-pulse cursor-pointer"><Zap fill="currentColor" /> เข้าสู่สนามแข่ง</button>
        </div>
    );
  }

  if (status === 'LOBBY') {
    return (
      <div className="text-center py-10 min-h-[70vh] flex flex-col justify-center relative bg-gradient-to-b from-blue-50 to-white rounded-3xl">
        <div className="mb-6"><div className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-1">GAME PIN</div><div className="text-6xl md:text-8xl font-black text-gray-800 tracking-widest font-mono bg-white inline-block px-8 py-4 rounded-3xl border-4 border-gray-100 shadow-xl">{roomCode}</div></div>
        <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-blue-100 max-w-3xl mx-auto w-full mb-8"><div className="text-2xl font-bold text-blue-600 mb-6 flex justify-center gap-2 bg-blue-50 py-2 rounded-xl"><Users/> ผู้เข้าแข่งขัน {players.length} คน</div><div className="flex flex-wrap justify-center gap-6">{players.map((p: any, i) => (<div key={i} className="flex flex-col items-center animate-fade-in"><div className="text-4xl bg-white w-16 h-16 rounded-full flex items-center justify-center border-4 border-blue-200 shadow-md">{p.avatar}</div><span className="text-xs font-bold mt-2 bg-blue-600 text-white px-3 py-1 rounded-full shadow-sm">{p.name?.split(' ')[0]}</span></div>))}</div></div>
        {isAdmin ? <button onClick={handleStartGame} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-12 py-5 rounded-2xl text-2xl font-black shadow-xl hover:scale-105 transition mx-auto flex gap-3"><Play fill="currentColor"/> เริ่มเกมเลย!</button> : <div className="animate-pulse text-blue-400 font-bold bg-blue-50 inline-block px-6 py-2 rounded-full">รอคุณครูกดเริ่มเกม...</div>}
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
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-indigo-100"><div className="divide-y divide-gray-100">{sortedPlayers.map((p, i) => (<div key={p.id} className="flex items-center justify-between p-4"><div className="flex items-center gap-4"><div className="font-black text-lg">{i+1}</div><span className="text-3xl">{p.avatar}</span><span className="font-bold text-lg text-gray-800">{p.name}</span></div><span className="font-black text-2xl text-indigo-600">{p.score||0}</span></div>))}</div></div>
            </div>
        );
    }

    return (
      <div className="max-w-4xl mx-auto pt-4 pb-20 relative">
        <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
            <button onClick={toggleSound} className={`p-2 rounded-full shadow-lg ${isMuted ? 'bg-gray-200 text-gray-500' : 'bg-green-500 text-white'}`}>{isMuted ? <VolumeX size={24}/> : <Volume2 size={24}/>}</button>
            <button onClick={() => setIsTTSEnabled(!isTTSEnabled)} className={`p-2 rounded-full shadow-lg border-2 ${isTTSEnabled ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-400'}`}>{isTTSEnabled ? <Volume2 size={24} className="animate-pulse"/> : <VolumeX size={24}/>}</button>
        </div>
        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-2xl shadow-md border-b-4 border-gray-200">
            <div className="flex flex-col items-center"><span className="text-xs text-gray-400 font-bold uppercase">QUESTION</span><span className="font-black text-2xl text-blue-600">{currentQuestionIndex+1}<span className="text-sm text-gray-400">/{questions.length}</span></span></div>
            <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden relative border border-gray-300 shadow-inner"><div className={`h-full transition-all duration-1000 ease-linear ${timerColor}`} style={{width:`${timePercent}%`}}></div></div>
            <div className={`flex flex-col items-center ${timer<=5?'animate-pulse':''}`}><span className="text-xs text-gray-400 font-bold uppercase">TIME</span><span className={`font-black text-2xl ${timer<=5?'text-red-600':'text-gray-700'}`}>{timer}</span></div>
        </div>
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border-b-8 border-blue-100 text-center relative overflow-hidden">
            {timer <= 0 && <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center backdrop-blur-sm"><span className="bg-red-600 text-white px-8 py-4 rounded-full text-3xl font-black shadow-2xl animate-bounce border-4 border-white">หมดเวลา!</span></div>}
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 leading-relaxed text-left mb-6">{currentQuestion?.text}</h2>
            {currentQuestion?.image && <img src={currentQuestion.image} className="h-48 mx-auto object-contain mb-6 rounded-xl border-2 border-gray-100 shadow-sm"/>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion?.choices.map((c, i) => {
                        let btnClass = ['bg-red-50 border-red-200 text-red-800','bg-blue-50 border-blue-200 text-blue-800','bg-yellow-50 border-yellow-200 text-yellow-800','bg-green-50 border-green-200 text-green-800'][i%4];
                        const isSelected = selectedChoice === c.id;
                        if (hasAnswered || timer <= 0) {
                            btnClass += ' opacity-60 grayscale cursor-not-allowed';
                            const normId = normalizeId(c.id); const normCorrect = normalizeId(currentQuestion.correctChoiceId);
                            let isThisCorrect = normId === normCorrect;
                            if(!isThisCorrect) { const cIdx = currentQuestion.choices.findIndex(ch => normalizeId(ch.id) === normId); const corrIdx = parseInt(normCorrect); if(cIdx !== -1 && !isNaN(corrIdx) && cIdx+1 === corrIdx) isThisCorrect = true; }
                            if (isThisCorrect) { btnClass = 'bg-green-100 border-green-500 text-green-900 !opacity-100 !grayscale-0 ring-4 ring-green-200 shadow-lg'; } else if (isSelected) { btnClass = 'bg-red-100 border-red-500 text-red-900 !opacity-100 !grayscale-0 ring-4 ring-red-200 shadow-lg'; }
                        }
                        return (<button key={c.id} onClick={()=>handleAnswer(c.id)} disabled={hasAnswered || timer<=0} className={`p-5 rounded-2xl font-bold text-lg border-b-8 relative overflow-hidden transition active:scale-95 active:border-b-0 active:translate-y-2 ${btnClass}`}>{(hasAnswered || timer<=0) && normalizeId(c.id) === normalizeId(currentQuestion.correctChoiceId) && <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-10"><CheckCircle className="text-green-600 w-10 h-10 drop-shadow-md bg-white rounded-full"/></div>}{c.text}</button>);
                })}
            </div>
        </div>
      </div>
    );
  }

  if (status === 'FINISHED') {
    const winner = sortedPlayers[0];
    return (
        <div className="max-w-4xl mx-auto py-10 text-center">
            <Trophy size={120} className="text-yellow-400 animate-bounce mx-auto mb-6"/>
            <h1 className="text-5xl font-black text-blue-900 mb-8">จบการแข่งขัน!</h1>
            {winner && <div className="bg-white rounded-3xl p-8 shadow-xl max-w-md mx-auto mb-8"><div className="text-7xl mb-4">{winner.avatar}</div><div className="text-2xl font-bold text-gray-800">{winner.name}</div><div className="text-4xl font-black text-blue-600">{winner.score || 0} คะแนน</div></div>}
            <button onClick={handleFinishAndExit} className="bg-gray-200 text-gray-700 px-8 py-3 rounded-full font-bold hover:bg-gray-300">ออกจากห้อง</button>
        </div>
    );
  }

  return <div className="flex flex-col items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div><p className="text-gray-400 animate-pulse">กำลังเชื่อมต่อ...</p></div>;
};

export default GameMode;
