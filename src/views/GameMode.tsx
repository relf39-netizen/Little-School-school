
import React, { useState, useEffect, useRef } from 'react';
import { Student, Question } from '../types';
import { Users, Trophy, Play, CheckCircle, Volume2, VolumeX, Crown, LogIn, Loader2, RefreshCw, AlertTriangle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { speak, playBGM, stopBGM, playSFX, toggleMuteSystem, stopSpeak } from '../utils/soundUtils';
import { supabase } from '../services/firebaseConfig';

interface GameModeProps {
  student: Student;
  initialRoomCode?: string;
  onExit: () => void;
  onFinish?: (score: number, total: number) => void;
}

type GameStatus = 'INPUT_PIN' | 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';

const GameMode: React.FC<GameModeProps> = ({ student, initialRoomCode, onExit, onFinish }) => {
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode || '');
  const [status, setStatus] = useState<GameStatus>(initialRoomCode ? 'LOBBY' : 'INPUT_PIN');
  
  const [inputPin, setInputPin] = useState('');
  const [joinError, setJoinError] = useState('');
  const [dbError, setDbError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const [players, setPlayers] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [countdown, setCountdown] = useState(5);
  const [scores, setScores] = useState<any>({});
  const [hasAnswered, setHasAnswered] = useState(false);
  
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [timer, setTimer] = useState(0);
  const [maxTime, setMaxTime] = useState(20);
  
  const isAdmin = student.id === '99999'; 
  
  // ✅ Fix: Explicitly type refs as number for window.setTimeout/Interval
  const timerRef = useRef<number | null>(null);
  const pollingRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);

  // Initialize if room code exists (Teacher or auto-join)
  useEffect(() => {
      if (initialRoomCode) {
          setRoomCode(initialRoomCode);
          connectToRoom(initialRoomCode);
      }
  }, [initialRoomCode]);

  // ✅ ROBUST POLLING: Fetch players every 3 seconds in Lobby
  useEffect(() => {
      if (status === 'LOBBY' && roomCode) {
          fetchPlayers(roomCode); // Initial fetch
          
          // Clear existing
          if (pollingRef.current) window.clearInterval(pollingRef.current);
          
          // Start new poll
          pollingRef.current = window.setInterval(() => {
              fetchPlayers(roomCode);
          }, 3000);
      }
      return () => {
          if (pollingRef.current) window.clearInterval(pollingRef.current);
      };
  }, [status, roomCode]);

  const toggleSound = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    toggleMuteSystem(newState);
  };

  const enableAudio = () => {
    setAudioEnabled(true);
    setIsMuted(false);
    toggleMuteSystem(false);
    playBGM('LOBBY'); 
  };

  useEffect(() => {
    if (!audioEnabled) return;
    if (status === 'LOBBY') playBGM('LOBBY');
    else if (status === 'COUNTDOWN') { stopBGM(); playSFX('COUNTDOWN'); }
    else if (status === 'PLAYING') playBGM('GAME');
    else if (status === 'FINISHED') playBGM('VICTORY');
    return () => {};
  }, [status, audioEnabled]);

  useEffect(() => {
      return () => stopBGM();
  }, []);

  // TTS Effect
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

  const handleJoinGame = async () => {
      if (!inputPin || inputPin.length !== 6) {
          setJoinError("กรุณากรอกรหัส 6 หลัก");
          return;
      }
      setJoinError('');
      setIsJoining(true);
      await connectToRoom(inputPin);
      setIsJoining(false);
  };

  const fetchPlayers = async (code: string) => {
      try {
          const { data, error } = await supabase
            .from('game_players')
            .select('*')
            .eq('room_code', code);
            
          if (error) {
              console.error("Error fetching players:", error);
              setIsConnected(false);
              return;
          }
          
          setIsConnected(true);
          if (data) {
              setPlayers(data);
              const s: any = {};
              data.forEach((p: any) => s[p.student_id] = p.score);
              setScores(s);
          }
      } catch (err: any) {
          console.error("Fetch exception:", err);
          setIsConnected(false);
      }
  };

  const connectToRoom = async (code: string) => {
      try {
        console.log("Connecting to room:", code);
        setJoinError('');

        // 1. Fetch Game State
        const { data: gameData, error } = await supabase.from('games').select('*').eq('room_code', code).single();
        
        if (error) {
            console.error("Fetch Game Error:", error);
            if (error.code === '42P01') {
                const msg = "ไม่พบตารางฐานข้อมูล 'games' (กรุณาแจ้งครูให้รัน SQL Script)";
                setJoinError(msg);
                if(isAdmin) setDbError(msg);
            } else if (error.code === 'PGRST116') { // No rows returned
                setJoinError("ไม่พบห้องเกมนี้ (รหัสผิด หรือห้องถูกปิดแล้ว)");
            } else {
                setJoinError("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + error.message);
            }
            return;
        }
        
        if (!gameData) {
            setJoinError("ไม่พบห้องเกมนี้");
            return;
        }
        
        if (gameData.status === 'FINISHED') {
            setJoinError("เกมจบลงแล้ว");
            return;
        }

        // 2. Join as Player (Safe Join Logic)
        if (!isAdmin) {
            // Optimistic UI Update: Show player immediately
            setPlayers(prev => [...prev, { student_id: student.id, name: student.name, avatar: student.avatar, score: 0, online: true }]);

            // Try Insert first
            const { error: insertError } = await supabase.from('game_players').insert({
                room_code: code,
                student_id: student.id,
                name: student.name,
                avatar: student.avatar,
                score: 0,
                online: true
            });

            if (insertError) {
                // If duplicate key (already joined), try Update
                if (insertError.code === '23505') {
                     await supabase.from('game_players').update({
                        name: student.name,
                        avatar: student.avatar,
                        online: true
                    }).eq('room_code', code).eq('student_id', student.id);
                } else if (insertError.code === '42501') {
                    setJoinError("ติดสิทธิ์การเข้าถึง (RLS Error) กรุณาแจ้งครูให้ปิด RLS");
                    return;
                } else {
                    console.error("Join Error:", insertError);
                    setJoinError("เข้าร่วมไม่สำเร็จ: " + insertError.message);
                    return; 
                }
            }
        }

        // --- SUCCESS: Proceed to update State ---
        setRoomCode(code);
        setStatus(gameData.status || 'LOBBY');
        setCurrentQuestionIndex(gameData.current_question_index || 0);
        setTimer(gameData.timer || 0);
        setMaxTime(gameData.time_per_question || 20);
        
        const parsedQuestions = typeof gameData.questions === 'string' ? JSON.parse(gameData.questions) : gameData.questions;
        setQuestions(parsedQuestions || []);

        // 3. Subscribe to Realtime
        if (channelRef.current) supabase.removeChannel(channelRef.current);

        const channel = supabase.channel(`game_room_${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `room_code=eq.${code}` }, (payload) => {
            const newData = payload.new as any;
            if (newData) {
                if (newData.status) setStatus(newData.status);
                if (newData.current_question_index !== undefined) setCurrentQuestionIndex(newData.current_question_index);
                if (newData.timer !== undefined) setTimer(newData.timer);
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `room_code=eq.${code}` }, (payload) => {
            fetchPlayers(code);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                setIsConnected(true);
                fetchPlayers(code);
            }
        });

        channelRef.current = channel;
        
        // Immediate fetch
        await fetchPlayers(code);

      } catch (e: any) {
          console.error("Join Exception:", e);
          setJoinError("เกิดข้อผิดพลาด: " + (e.message || "Unknown error"));
      }
  };

  useEffect(() => {
    setHasAnswered(false);
  }, [currentQuestionIndex]);

  // Admin Game Loop (Timer)
  useEffect(() => {
    if (!isAdmin || !roomCode || status === 'INPUT_PIN') return;
    if (timerRef.current) window.clearInterval(timerRef.current);

    if (status === 'COUNTDOWN') {
        let localCount = 5;
        setCountdown(localCount);
        timerRef.current = window.setInterval(() => {
            localCount--;
            setCountdown(localCount);
            if (localCount <= 0) {
                if (timerRef.current) window.clearInterval(timerRef.current);
                supabase.from('games').update({ status: 'PLAYING', timer: maxTime }).eq('room_code', roomCode).then();
            }
        }, 1000);
    } else if (status === 'PLAYING') {
        let currentTimer = maxTime; 
        // Initial set
        supabase.from('games').update({ timer: maxTime }).eq('room_code', roomCode).then();
        
        timerRef.current = window.setInterval(() => {
            currentTimer--;
            if (currentTimer >= 0) {
                 supabase.from('games').update({ timer: currentTimer }).eq('room_code', roomCode).then();
            }
            if (currentTimer < 0) {
                if (timerRef.current) window.clearInterval(timerRef.current);
                if (currentQuestionIndex < questions.length - 1) {
                    supabase.from('games').update({
                        current_question_index: currentQuestionIndex + 1,
                        timer: maxTime
                    }).eq('room_code', roomCode).then();
                } else {
                    supabase.from('games').update({ status: 'FINISHED', timer: 0 }).eq('room_code', roomCode).then();
                }
            }
        }, 1000);
    }

    return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [status, isAdmin, maxTime, currentQuestionIndex, questions.length, roomCode]);

  // Actions
  const handleStartGame = () => {
    if (questions.length === 0) return alert("ไม่พบข้อสอบ");
    supabase.from('games').update({ status: 'COUNTDOWN' }).eq('room_code', roomCode).then();
    supabase.from('game_players').update({ score: 0 }).eq('room_code', roomCode).then();
  };

  const handleReset = () => {
    supabase.from('games').update({ status: 'LOBBY', current_question_index: 0, timer: 0 }).eq('room_code', roomCode).then();
    supabase.from('game_players').update({ score: 0 }).eq('room_code', roomCode).then();
  };

  const handleAnswer = async (choiceId: string) => {
    if (hasAnswered || timer <= 0) return;
    setHasAnswered(true);

    const currentQ = questions[currentQuestionIndex];
    const isCorrect = String(choiceId) === String(currentQ.correctChoiceId) || 
                      (String(currentQ.correctChoiceId).length === 1 && String(choiceId) === String(currentQ.correctChoiceId));
    
    const timeBonus = Math.round(50 * (timer / maxTime));
    const points = isCorrect ? (50 + timeBonus) : 0;
    
    if (points > 0) {
       const currentScore = scores[student.id] || 0;
       const newScore = currentScore + points;
       setScores({...scores, [student.id]: newScore}); // Optimistic
       await supabase.from('game_players').update({ score: newScore }).eq('room_code', roomCode).eq('student_id', student.id);
       playSFX('CORRECT'); speak("เยี่ยมมาก");
    } else {
       playSFX('WRONG'); speak("ยังไม่ถูก");
    }
  };

  // Call onFinish
  useEffect(() => {
      if (status === 'FINISHED' && !isAdmin && onFinish && scores[student.id] !== undefined) {
          // Total Score
          onFinish(scores[student.id], questions.length * 100);
      }
  }, [status, isAdmin, onFinish, scores, student.id, questions.length]);

  // 🟢 RENDER: JOIN SCREEN
  if (status === 'INPUT_PIN' && !isAdmin) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
              <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border-b-4 border-purple-500 text-center animate-fade-in">
                  <div className="bg-purple-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-600">
                      <LogIn size={40}/>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">เข้าร่วมการแข่งขัน</h2>
                  <p className="text-gray-500 mb-6 text-sm">กรอกรหัส PIN 6 หลัก จากคุณครู</p>
                  
                  <input 
                      type="text" 
                      maxLength={6}
                      value={inputPin}
                      onChange={(e) => setInputPin(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full p-4 text-center text-3xl font-mono font-bold border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none mb-4 tracking-widest bg-gray-50"
                      placeholder="000000"
                  />
                  
                  {joinError && (
                      <div className="flex items-center gap-2 text-red-500 text-sm mb-4 bg-red-50 p-2 rounded-lg justify-center animate-pulse text-left">
                          <AlertTriangle size={24} className="flex-shrink-0"/> <span>{joinError}</span>
                      </div>
                  )}
                  
                  <button onClick={handleJoinGame} disabled={isJoining} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-purple-700 shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                      {isJoining ? <Loader2 className="animate-spin"/> : 'เข้าห้องเกม'}
                  </button>
                  <button onClick={onExit} className="mt-4 text-gray-400 hover:text-gray-600 text-sm">ยกเลิก</button>
              </div>
          </div>
      );
  }

  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const myRank = sortedPlayers.findIndex(p => p.student_id === student.id) + 1;
  const currentQuestion = questions[currentQuestionIndex];

  if (status === 'LOBBY') {
    return (
      <div className="text-center py-10 min-h-[70vh] flex flex-col justify-center relative">
        <div className="absolute top-0 right-0 flex gap-2">
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>} {isConnected ? 'Online' : 'Offline'}
            </div>
            <button onClick={toggleSound} className={`p-2 rounded-full shadow ${isMuted?'bg-gray-200':'bg-white'}`}>{isMuted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button>
        </div>
        
        {dbError && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 text-left mx-auto max-w-2xl rounded shadow-md animate-bounce">
                <p className="font-bold flex items-center gap-2"><AlertCircle/> ระบบฐานข้อมูลขัดข้อง (Database Error)</p>
                <p className="text-sm">{dbError}</p>
                <p className="text-xs mt-1 font-bold text-red-800">กรุณากลับไปที่ Supabase -&gt; SQL Editor และรันสคริปต์ที่ได้รับใหม่</p>
            </div>
        )}

        <div className="mb-6 animate-bounce">
            <h2 className="text-xl text-gray-500 font-bold mb-1">Game PIN:</h2>
            <div className="text-6xl font-black text-blue-900 tracking-widest bg-white inline-block px-8 py-2 rounded-2xl shadow-sm border-2 border-blue-100">
                {roomCode}
            </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur p-6 rounded-3xl shadow-lg max-w-2xl mx-auto w-full mb-8 relative">
          <div className="flex justify-between items-center mb-4">
              <div className="text-2xl font-bold text-blue-600 flex items-center gap-2 mx-auto"><Users/> ผู้เล่น {players.length} คน</div>
              <button onClick={() => fetchPlayers(roomCode)} className="absolute right-4 top-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-600 transition" title="รีเฟรชผู้เล่น"><RefreshCw size={16}/></button>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {players.map((p: any, i) => (
              <div key={i} className="flex flex-col items-center animate-scale-in">
                  <div className="text-3xl bg-blue-50 w-14 h-14 rounded-full flex items-center justify-center border-2 border-blue-100">{p.avatar}</div>
                  <span className="text-xs mt-1 bg-white px-2 py-0.5 rounded shadow text-gray-800">{p.name}</span>
              </div>
            ))}
            {players.length === 0 && <div className="text-gray-400 py-4">รอเพื่อนเข้าร่วม...</div>}
          </div>
        </div>
        {!audioEnabled && !isAdmin && (
             <button onClick={enableAudio} className="mb-4 bg-yellow-400 text-yellow-900 px-6 py-2 rounded-full font-bold shadow animate-pulse">🔊 กดเพื่อเปิดเสียงเกม</button>
        )}
        {isAdmin ? <button onClick={handleStartGame} className="bg-green-500 text-white px-10 py-4 rounded-full text-2xl font-bold shadow-xl hover:scale-105 transition mx-auto flex gap-2"><Play fill="currentColor"/> เริ่มเกม ({maxTime}วิ)</button> : <div className="animate-pulse text-gray-500">รอครูเริ่มเกม...</div>}
        <button onClick={onExit} className="text-gray-400 underline text-sm mt-8">ออก</button>
      </div>
    );
  }

  if (status === 'COUNTDOWN') {
    return <div className="h-[60vh] flex flex-col items-center justify-center"><div className="text-xl font-bold text-gray-500 mb-4">เริ่มใน</div><div className="text-[10rem] font-black text-blue-600 animate-ping">{countdown}</div></div>;
  }

  if (status === 'PLAYING' && currentQuestion) {
    const timePercent = (timer / maxTime) * 100;
    const timerColor = timePercent > 50 ? 'bg-green-500' : timePercent > 20 ? 'bg-yellow-500' : 'bg-red-600';
    return (
      <div className="max-w-3xl mx-auto pt-4 pb-20 relative">
        <button onClick={toggleSound} className={`fixed top-20 right-4 z-50 p-2 rounded-full shadow ${isMuted?'bg-gray-200':'bg-white'}`}>{isMuted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>
        <div className="flex items-center gap-4 mb-4 bg-white p-3 rounded-2xl shadow-sm">
            <span className="font-bold text-blue-800 text-sm">ข้อ {currentQuestionIndex+1}/{questions.length}</span>
            <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden relative"><div className={`h-full transition-all duration-1000 ease-linear ${timerColor}`} style={{width:`${timePercent}%`}}></div></div>
            <span className={`font-mono font-black text-xl w-8 text-center ${timer<=5?'text-red-600 animate-pulse':''}`}>{timer}</span>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-xl border-b-4 border-blue-200 text-center mb-6 relative overflow-hidden">
            {timer <= 0 && <div className="absolute inset-0 bg-gray-900/20 z-20 flex items-center justify-center"><span className="bg-red-600 text-white px-6 py-2 rounded-full text-xl font-bold animate-bounce">หมดเวลา!</span></div>}
            <h2 className="text-xl font-bold mb-4 text-gray-800">{currentQuestion.text}</h2>
            {currentQuestion.image && <img src={currentQuestion.image} className="h-40 mx-auto object-contain mb-4 rounded bg-gray-50"/>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentQuestion.choices.map((c, i) => (
                    <button key={c.id} onClick={()=>handleAnswer(c.id)} disabled={hasAnswered || timer<=0} className={`p-4 rounded-xl font-bold text-lg border-b-4 relative overflow-hidden transition active:scale-95 ${['bg-red-50 border-red-200 text-red-800','bg-blue-50 border-blue-200 text-blue-800','bg-yellow-50 border-yellow-200 text-yellow-800','bg-green-50 border-green-200 text-green-800'][i%4]} ${(hasAnswered||timer<=0)?'opacity-80':''}`}>
                        {(hasAnswered || timer<=0) && (String(c.id) === String(currentQuestion.correctChoiceId) || (String(currentQuestion.correctChoiceId).length === 1 && String(c.id).endsWith(String(currentQuestion.correctChoiceId)))) && <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-10 border-4 border-green-500 rounded-xl"><CheckCircle className="text-green-600 w-8 h-8 bg-white rounded-full"/></div>}
                        {c.text}
                    </button>
                ))}
            </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow border border-gray-100">
            <h3 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2"><Trophy size={16} className="text-yellow-500"/> ผู้นำคะแนน</h3>
            <div className="space-y-2">
                {sortedPlayers.slice(0, 5).map((p, i) => (
                    <div key={p.student_id} className={`flex items-center justify-between p-2 rounded-xl border ${i===0?'bg-yellow-50 border-yellow-200':i===1?'bg-gray-50 border-gray-200':i===2?'bg-orange-50 border-orange-200':'border-gray-100'} ${p.student_id===student.id?'ring-2 ring-blue-400':''}`}>
                        <div className="flex items-center gap-3">
                            <span className="font-bold w-6 text-center text-gray-600">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
                            <span className="text-xl">{p.avatar}</span>
                            <span className={`font-bold text-sm ${p.student_id===student.id?'text-blue-700':'text-gray-800'}`}>{p.name}</span>
                        </div>
                        <span className="font-bold text-blue-600">{p.score}</span>
                    </div>
                ))}
            </div>
            {myRank > 5 && <div className="mt-2 pt-2 border-t border-dashed"><div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 border border-blue-200"><div className="flex items-center gap-3"><span className="font-bold w-6 text-center text-gray-600">{myRank}</span><span>{student.avatar}</span><span className="font-bold text-sm text-blue-700">{student.name} (ฉัน)</span></div><span className="font-bold text-blue-600">{scores[student.id]||0}</span></div></div>}
        </div>
      </div>
    );
  }

  if (status === 'FINISHED') {
    const winner = sortedPlayers[0];
    return (
        <div className="text-center py-10">
            <Trophy size={100} className="text-yellow-400 animate-bounce mx-auto mb-6"/>
            <h1 className="text-4xl font-bold text-blue-900 mb-8">จบเกมแล้ว!</h1>
            <div className="relative max-w-md mx-auto bg-white rounded-3xl p-8 shadow-xl border-b-8 border-yellow-300">
                <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-4 animate-pulse"/>
                <div className="text-7xl mb-4">{winner?.avatar}</div>
                <div className="text-2xl font-bold text-gray-800 mb-2">{winner?.name}</div>
                <div className="text-4xl font-black text-blue-600">{winner?.score||0} คะแนน</div>
            </div>
            <div className="mt-10 space-x-4">
                <button onClick={onExit} className="bg-gray-200 text-gray-700 px-8 py-3 rounded-full font-bold hover:bg-gray-300">ออก</button>
                {isAdmin && <button onClick={handleReset} className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700">เริ่มใหม่</button>}
            </div>
        </div>
    );
  }

  return <div className="text-center p-10">Loading...</div>;
};

export default GameMode;
