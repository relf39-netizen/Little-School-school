
import React, { useState, useEffect, useRef } from 'react';
import { Student, Question } from '../types';
import { Users, Trophy, Play, CheckCircle, Volume2, VolumeX, Crown, LogIn, Loader2, RefreshCw, AlertTriangle, AlertCircle, Wifi, WifiOff, XCircle, Zap, Sparkles, BarChart3, Clock, LayoutDashboard, ChevronDown } from 'lucide-react';
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
  const [isJoining, setIsJoining] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const [players, setPlayers] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [countdown, setCountdown] = useState(5);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [hasAnswered, setHasAnswered] = useState(false);
  
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [timer, setTimer] = useState(0);
  const [maxTime, setMaxTime] = useState(20);
  
  const isAdmin = student.id === '99999'; 
  
  const timerRef = useRef<number | null>(null);
  const pollingRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
      if (initialRoomCode) {
          setRoomCode(initialRoomCode);
          connectToRoom(initialRoomCode);
      }
  }, [initialRoomCode]);

  useEffect(() => {
      if (status !== 'INPUT_PIN' && roomCode) {
          fetchPlayers(roomCode);
          if (pollingRef.current) window.clearInterval(pollingRef.current);
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
  }, [status, audioEnabled]);

  useEffect(() => {
      return () => {
          stopBGM();
          if (channelRef.current) supabase.removeChannel(channelRef.current);
      };
  }, []);

  const fetchPlayers = async (code: string) => {
      try {
          const { data, error } = await supabase
            .from('game_players')
            .select('*')
            .eq('room_code', code);
            
          if (error) throw error;
          
          setIsConnected(true);
          if (data) {
              setPlayers(data);
              const s: Record<string, number> = {};
              data.forEach((p: any) => {
                  s[String(p.student_id)] = Number(p.score) || 0;
              });
              setScores(s);
          }
      } catch (err: any) {
          console.error("Fetch players error:", err);
          setIsConnected(false);
      }
  };

  const connectToRoom = async (code: string) => {
      try {
        setJoinError('');
        const { data: gameData, error } = await supabase.from('games').select('*').eq('room_code', code).single();
        
        if (error || !gameData) {
            setJoinError("ไม่พบห้องเกมนี้ หรือ รหัส PIN ไม่ถูกต้อง");
            return;
        }
        
        if (gameData.status === 'FINISHED') {
            setJoinError("เกมจบลงแล้ว ไม่สามารถเข้าร่วมได้");
            return;
        }

        if (!isAdmin) {
            const { data: existingPlayer } = await supabase
                .from('game_players')
                .select('student_id')
                .eq('room_code', code)
                .eq('student_id', student.id)
                .maybeSingle();

            if (!existingPlayer) {
                const { error: joinError } = await supabase.from('game_players').insert({
                    room_code: code,
                    student_id: student.id,
                    name: student.name,
                    avatar: student.avatar,
                    score: 0
                });

                if (joinError) {
                    setJoinError("เข้าร่วมห้องไม่สำเร็จ: " + joinError.message);
                    return; 
                }
            }
        }

        setRoomCode(code);
        setStatus(gameData.status || 'LOBBY');
        setCurrentQuestionIndex(gameData.current_question_index || 0);
        setTimer(gameData.timer || 0);
        setMaxTime(gameData.time_per_question || 20);
        
        const parsedQuestions = typeof gameData.questions === 'string' ? JSON.parse(gameData.questions) : gameData.questions;
        setQuestions(parsedQuestions || []);

        if (channelRef.current) supabase.removeChannel(channelRef.current);

        const channel = supabase.channel(`room_${code}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `room_code=eq.${code}` }, (payload) => {
            const newData = payload.new as any;
            if (newData) {
                if (newData.status) setStatus(newData.status);
                if (newData.current_question_index !== undefined) setCurrentQuestionIndex(newData.current_question_index);
                if (newData.timer !== undefined) setTimer(newData.timer);
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `room_code=eq.${code}` }, () => {
            fetchPlayers(code);
        })
        .subscribe((subStatus) => {
            setIsConnected(subStatus === 'SUBSCRIBED');
        });

        channelRef.current = channel;
        await fetchPlayers(code);

      } catch (e: any) {
          console.error("Connect Exception:", e);
          setJoinError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      }
  };

  useEffect(() => {
    setHasAnswered(false);
  }, [currentQuestionIndex]);

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
                window.clearInterval(timerRef.current!);
                supabase.from('games').update({ status: 'PLAYING', timer: maxTime }).eq('room_code', roomCode).then();
            }
        }, 1000);
    } else if (status === 'PLAYING') {
        let currentTimer = maxTime; 
        timerRef.current = window.setInterval(() => {
            currentTimer--;
            if (currentTimer >= 0) {
                 supabase.from('games').update({ timer: currentTimer }).eq('room_code', roomCode).then();
            }
            if (currentTimer < 0) {
                window.clearInterval(timerRef.current!);
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

  const handleStartGame = () => {
    if (questions.length === 0) return alert("ไม่พบข้อสอบในห้องนี้");
    supabase.from('games').update({ status: 'COUNTDOWN', current_question_index: 0 }).eq('room_code', roomCode).then();
    supabase.from('game_players').update({ score: 0 }).eq('room_code', roomCode).then();
  };

  const handleReset = () => {
    supabase.from('games').update({ status: 'LOBBY', current_question_index: 0, timer: 0 }).eq('room_code', roomCode).then();
    supabase.from('game_players').update({ score: 0 }).eq('room_code', roomCode).then();
  };

  const handleAnswer = async (choiceId: string) => {
    if (hasAnswered || timer <= 0 || isAdmin) return;
    setHasAnswered(true);

    const currentQ = questions[currentQuestionIndex];
    const isCorrect = String(choiceId) === String(currentQ.correctChoiceId) || 
                      choiceId.endsWith(String(currentQ.correctChoiceId));
    
    if (isCorrect) {
       const timeBonus = Math.round(50 * (timer / maxTime));
       const points = 50 + timeBonus;
       const currentScore = Number(scores[student.id]) || 0;
       const newScore = currentScore + points;
       
       // อัปเดต State ทันทีเพื่อความลื่นไหล
       setScores(prev => ({...prev, [student.id]: newScore}));
       
       const { error } = await supabase.from('game_players').update({ score: newScore }).eq('room_code', roomCode).eq('student_id', student.id);
       
       if (error) {
           console.error("Score update error:", error);
           setHasAnswered(false);
       } else {
           playSFX('CORRECT'); 
           speak("เก่งมากครับ!");
       }
    } else {
       playSFX('WRONG'); 
       speak("ยังไม่ถูกนะครับ");
    }
    
    fetchPlayers(roomCode);
  };

  // Fixed: Implemented handleJoinGame to fix "Cannot find name 'handleJoinGame'" error
  const handleJoinGame = async () => {
    if (inputPin.length < 6) {
        setJoinError("กรุณากรอกรหัส PIN ให้ครบ 6 หลัก");
        return;
    }
    setIsJoining(true);
    await connectToRoom(inputPin);
    setIsJoining(false);
  };

  const sortedPlayers = [...players].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  const myRank = sortedPlayers.findIndex(p => String(p.student_id) === String(student.id)) + 1;
  const currentQuestion = questions[currentQuestionIndex];

  if (status === 'INPUT_PIN' && !isAdmin) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
              <div className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-sm border-b-8 border-indigo-200 text-center animate-fade-in">
                  <div className="bg-indigo-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-600 rotate-3">
                      <LogIn size={40}/>
                  </div>
                  <h2 className="text-2xl font-black text-indigo-900 mb-2">เข้าร่วมการแข่งขัน</h2>
                  <p className="text-gray-500 mb-8 text-sm font-bold">กรอกรหัส PIN จากหน้าจอของคุณครู</p>
                  
                  <input 
                      type="text" 
                      maxLength={6}
                      value={inputPin}
                      onChange={(e) => setInputPin(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full p-5 text-center text-4xl font-mono font-black border-4 border-indigo-50 rounded-3xl focus:border-indigo-500 outline-none mb-6 tracking-[0.2em] bg-indigo-50/50 text-indigo-900"
                      placeholder="------"
                  />
                  
                  {joinError && (
                      <div className="flex items-center gap-2 text-red-600 text-sm mb-6 bg-red-50 p-4 rounded-2xl border-2 border-red-100 text-left font-bold animate-pulse">
                          <XCircle size={24} className="shrink-0"/> <span>{joinError}</span>
                      </div>
                  )}
                  
                  <button onClick={handleJoinGame} disabled={isJoining} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-xl hover:bg-indigo-700 shadow-xl hover:shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                      {isJoining ? <Loader2 className="animate-spin"/> : 'ยืนยันรหัส PIN'}
                  </button>
                  <button onClick={onExit} className="mt-6 text-gray-400 hover:text-indigo-600 font-bold transition-colors">ยกเลิก</button>
              </div>
          </div>
      );
  }

  if (status === 'LOBBY') {
    return (
      <div className="text-center py-10 min-h-[80vh] flex flex-col justify-center relative px-4">
        <div className="absolute top-0 right-0 flex gap-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black shadow-sm ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isConnected ? <Wifi size={16}/> : <WifiOff size={16}/>} {isConnected ? 'เชื่อมต่อแล้ว' : 'สัญญาณขาดหาย'}
            </div>
            <button onClick={toggleSound} className={`p-2 rounded-full shadow-md transition-colors ${isMuted?'bg-gray-200 text-gray-500':'bg-white text-indigo-600'}`}>{isMuted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>
        </div>

        <div className="mb-10 animate-bounce-slow">
            <h2 className="text-xl text-indigo-400 font-black mb-2 uppercase tracking-widest">Game PIN</h2>
            <div className="text-7xl font-black text-indigo-900 tracking-widest bg-white inline-block px-12 py-4 rounded-[40px] shadow-2xl border-b-8 border-indigo-100 relative">
                <div className="absolute -top-4 -right-4 bg-yellow-400 p-2 rounded-xl shadow-lg rotate-12"><Zap size={24} className="text-yellow-900" fill="currentColor"/></div>
                {roomCode}
            </div>
        </div>
        
        <div className="bg-white/60 backdrop-blur-md p-8 rounded-[40px] shadow-xl max-w-3xl mx-auto w-full mb-10 border-4 border-white/50 relative">
          <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-indigo-900 flex items-center gap-3 mx-auto">
                <Users size={32} className="text-indigo-600"/> 
                เด็กๆ ในห้อง ({players.length})
              </h3>
              <button onClick={() => fetchPlayers(roomCode)} className="absolute right-6 top-6 p-3 bg-white rounded-2xl hover:bg-indigo-50 text-indigo-600 transition shadow-sm border" title="รีเฟรช"><RefreshCw size={20}/></button>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6">
            {players.map((p: any, i) => (
              <div key={i} className="flex flex-col items-center animate-scale-in">
                  <div className="text-4xl bg-gradient-to-br from-indigo-50 to-white w-16 h-16 rounded-[24px] flex items-center justify-center border-2 border-indigo-100 shadow-sm relative group-hover:scale-110 transition">
                      {p.avatar}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                  </div>
                  <span className="text-[10px] mt-2 font-black text-indigo-900 truncate w-full text-center">{p.name.split(' ')[0]}</span>
              </div>
            ))}
            {players.length === 0 && <div className="col-span-full text-indigo-300 font-bold py-10 italic">รอเด็กๆ เข้าร่วม...</div>}
          </div>
        </div>

        {!audioEnabled && !isAdmin && (
             <button onClick={enableAudio} className="mb-8 bg-yellow-400 text-yellow-900 px-10 py-4 rounded-3xl font-black shadow-xl animate-pulse border-b-4 border-yellow-600 hover:scale-105 transition-all text-lg">🔊 กดที่นี่เพื่อเปิดเสียงเกม</button>
        )}

        {isAdmin ? (
            <button 
                onClick={handleStartGame} 
                disabled={players.length === 0}
                className="bg-green-600 text-white px-16 py-6 rounded-[32px] text-3xl font-black shadow-2xl hover:bg-green-700 hover:scale-105 transition-all mx-auto flex items-center gap-4 border-b-8 border-green-800 disabled:opacity-50 disabled:grayscale"
            >
                <Play fill="currentColor" size={32}/> เริ่มการแข่ง!
            </button>
        ) : (
            <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 text-indigo-600 font-black text-xl animate-pulse">
                    <Loader2 className="animate-spin" size={24}/>
                    รอคุณครูสั่งเริ่ม...
                </div>
                <p className="text-gray-400 text-sm font-bold italic">เตรียมตัวให้พร้อมนะ!</p>
            </div>
        )}
        <button onClick={onExit} className="mt-12 text-gray-400 hover:text-red-500 font-bold underline transition-colors">ออกจากการแข่ง</button>
      </div>
    );
  }

  if (status === 'COUNTDOWN') {
    return (
        <div className="h-[80vh] flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-indigo-400 mb-4 tracking-widest uppercase">Get Ready!</div>
            <div className="text-[15rem] font-black text-indigo-600 animate-ping leading-none">{countdown}</div>
        </div>
    );
  }

  if (status === 'PLAYING' && currentQuestion) {
    const timePercent = (timer / maxTime) * 100;

    // ✅ กรณีคุณครู (Admin) - แสดงแค่ Leaderboard ทุกคน (Scrollable)
    if (isAdmin) {
        return (
            <div className="max-w-4xl mx-auto pt-4 pb-20 px-4">
                {/* Compact Header for Admin */}
                <div className="bg-indigo-600 text-white p-5 rounded-3xl shadow-xl mb-4 border-b-4 border-indigo-800 relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10"><BarChart3 size={150}/></div>
                    <div className="relative z-10 text-center md:text-left">
                        <h2 className="text-3xl font-black flex items-center gap-3 justify-center md:justify-start"><LayoutDashboard size={32}/> ตารางคะแนนนักเรียน</h2>
                        <p className="text-indigo-100 font-bold text-base uppercase tracking-widest">
                            ข้อที่ {currentQuestionIndex+1} / {questions.length} • {currentQuestion.subject} • {players.length} ผู้เล่น
                        </p>
                    </div>
                    <div className="flex items-center gap-4 relative z-10 bg-black/20 p-3 rounded-2xl">
                        <div className="text-center">
                            <div className="text-[10px] uppercase font-black text-indigo-200">เหลือเวลา</div>
                            <div className={`text-4xl font-mono font-black ${timer<=5?'text-yellow-300 animate-pulse':'text-white'}`}>{timer}</div>
                        </div>
                        <div className="w-16 h-16 rounded-full border-4 border-indigo-500 flex items-center justify-center relative bg-indigo-900/50">
                            <div className="text-xs font-black">{Math.round(timePercent)}%</div>
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-indigo-400" />
                                <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white" strokeDasharray="125" strokeDashoffset={125 - (125 * timePercent / 100)} />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* ✅ Leaderboard ทุกคน เลื่อนดูได้ (All Players Scrollable) */}
                <div className="bg-white rounded-[40px] shadow-xl p-4 border-2 border-indigo-50">
                    <div className="flex flex-col gap-2 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                        {sortedPlayers.map((p, i) => (
                            <div 
                                key={p.student_id} 
                                className={`flex items-center justify-between p-3 px-5 rounded-3xl border-2 transition-all duration-700 ease-in-out transform ${
                                    i === 0 ? 'bg-yellow-50 border-yellow-400 shadow-md scale-[1.01] z-10' : 
                                    i === 1 ? 'bg-gray-50 border-gray-300' : 
                                    i === 2 ? 'bg-orange-50 border-orange-200' : 
                                    'bg-white border-indigo-50'
                                }`}
                                style={{ order: i }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <span className={`font-black text-xl w-10 h-10 flex items-center justify-center rounded-2xl ${
                                            i === 0 ? 'bg-yellow-400 text-yellow-900 shadow-sm' : 
                                            i === 1 ? 'bg-gray-200 text-gray-700' : 
                                            i === 2 ? 'bg-orange-100 text-orange-700' : 
                                            'bg-gray-100 text-gray-400'
                                        }`}>
                                            {i+1}
                                        </span>
                                        {i === 0 && <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 w-6 h-6 text-yellow-500 animate-bounce"/>}
                                    </div>
                                    <div className="text-4xl">{p.avatar}</div>
                                    <div>
                                        <div className="font-black text-gray-800 text-lg leading-tight truncate max-w-[150px] md:max-w-md">{p.name}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Rank #{i+1}</div>
                                    </div>
                                </div>
                                <div className="text-right bg-indigo-50 px-5 py-2 rounded-2xl border border-indigo-100 min-w-[100px]">
                                    <div className="text-2xl font-black text-indigo-600 leading-none mb-1">{Number(p.score) || 0}</div>
                                    <div className="text-[10px] font-black text-indigo-300 uppercase leading-none">Points</div>
                                </div>
                            </div>
                        ))}
                        {players.length > 5 && (
                             <div className="text-center py-4 text-gray-300 flex flex-col items-center gap-1">
                                 <ChevronDown size={20} className="animate-bounce"/>
                                 <span className="text-[10px] font-bold uppercase">คุณครูสามารถเลื่อนดูรายชื่อด้านล่างได้</span>
                             </div>
                        )}
                    </div>
                    {players.length === 0 && (
                        <div className="text-center py-20 text-gray-300 flex flex-col items-center gap-4">
                            <Users size={48} className="opacity-20 animate-pulse"/>
                            <p className="text-lg font-bold italic">รอคะแนนจากเด็กๆ...</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ✅ กรณีนักเรียน - แสดงโจทย์และตัวเลือก
    const timePercentStud = (timer / maxTime) * 100;
    const timerColorStud = timePercentStud > 50 ? 'bg-green-500' : timePercentStud > 20 ? 'bg-yellow-500' : 'bg-red-600';

    return (
      <div className="max-w-4xl mx-auto pt-6 pb-20 relative px-4">
        <button onClick={toggleSound} className={`fixed top-20 right-4 z-50 p-3 rounded-2xl shadow-xl transition-all ${isMuted?'bg-gray-200 text-gray-500':'bg-white text-indigo-600'}`}>{isMuted?<VolumeX size={24}/>:<Volume2 size={24}/>}</button>
        
        <div className="flex items-center gap-6 mb-8 bg-white p-5 rounded-[32px] shadow-lg border-2 border-indigo-50">
            <div className="flex flex-col">
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-1">Question</span>
                <span className="font-black text-indigo-900 text-xl">{currentQuestionIndex+1}/{questions.length}</span>
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative shadow-inner">
                <div className={`h-full transition-all duration-1000 ease-linear ${timerColorStud} shadow-sm`} style={{width:`${timePercentStud}%`}}></div>
            </div>
            <div className={`font-mono font-black text-4xl w-16 text-center ${timer<=5?'text-red-600 animate-pulse scale-110':''}`}>{timer}</div>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl border-b-[12px] border-indigo-100 text-center mb-10 relative overflow-hidden">
            {timer <= 0 && <div className="absolute inset-0 bg-gray-900/40 z-30 flex items-center justify-center backdrop-blur-sm animate-fade-in"><span className="bg-red-600 text-white px-10 py-4 rounded-[24px] text-4xl font-black shadow-2xl animate-bounce-in border-4 border-white">TIME UP!</span></div>}
            <h2 className="text-2xl md:text-3xl font-black mb-8 text-gray-800 leading-relaxed">{currentQuestion.text}</h2>
            {currentQuestion.image && (
                <div className="mb-8 rounded-[32px] overflow-hidden border-4 border-indigo-50 shadow-inner bg-indigo-50/30">
                    <img src={currentQuestion.image} className="h-60 mx-auto object-contain p-4"/>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.choices.map((c, i) => {
                    const isCorrectChoice = String(c.id) === String(currentQuestion.correctChoiceId) || c.id.endsWith(String(currentQuestion.correctChoiceId));
                    return (
                        <button 
                            key={c.id} 
                            onClick={()=>handleAnswer(c.id)} 
                            disabled={hasAnswered || timer<=0} 
                            className={`p-6 rounded-[28px] font-black text-xl border-b-8 relative overflow-hidden transition-all active:scale-95 group ${
                                ['bg-red-50 border-red-200 text-red-800', 'bg-blue-50 border-blue-200 text-blue-800', 'bg-yellow-50 border-yellow-200 text-yellow-800', 'bg-green-50 border-green-200 text-green-800'][i%4]
                            } ${(hasAnswered || timer<=0) ? 'opacity-50 grayscale-[0.5]' : 'hover:-translate-y-1 hover:shadow-lg'}`}
                        >
                            {(hasAnswered || timer<=0) && isCorrectChoice && (
                                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-20 border-8 border-green-500 rounded-[28px] animate-fade-in">
                                    <CheckCircle className="text-green-600 w-12 h-12 bg-white rounded-full shadow-lg"/>
                                </div>
                            )}
                            <div className="flex items-center gap-4">
                                <span className="bg-white/50 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm text-sm">{String.fromCharCode(65+i)}</span>
                                <span className="flex-1 text-left">{c.text}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>

        <div className="bg-white rounded-[32px] p-6 shadow-xl border-2 border-indigo-50">
            <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2 border-b pb-3">
                <Trophy size={24} className="text-yellow-500"/> 
                คะแนนปัจจุบันของคุณ: {Number(scores[student.id]) || 0} PTS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedPlayers.slice(0, 8).map((p, i) => (
                    <div key={p.student_id} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${i===0?'bg-yellow-50 border-yellow-200 shadow-md':i===1?'bg-gray-50 border-gray-200':i===2?'bg-orange-50 border-orange-200':'bg-white border-gray-50'} ${String(p.student_id)===String(student.id)?'ring-4 ring-indigo-200 border-indigo-400':''}`}>
                        <div className="flex items-center gap-3">
                            <span className="font-black w-6 text-center text-indigo-400 text-xs">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
                            <span className="text-2xl">{p.avatar}</span>
                            <span className={`font-black text-sm ${String(p.student_id)===String(student.id)?'text-indigo-700 underline':'text-gray-800'}`}>{p.name.split(' ')[0]}</span>
                        </div>
                        <span className="font-black text-indigo-600 bg-white px-3 py-1 rounded-xl shadow-inner border">{Number(p.score) || 0}</span>
                    </div>
                ))}
            </div>
            {myRank > 8 && (
                <div className="mt-4 pt-4 border-t border-dashed">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-600 text-white shadow-lg transform -rotate-1">
                        <div className="flex items-center gap-3">
                            <span className="font-black w-6 text-center text-indigo-200">#{myRank}</span>
                            <span className="text-2xl">{student.avatar}</span>
                            <span className="font-black">{student.name.split(' ')[0]} (คุณเอง)</span>
                        </div>
                        <span className="font-black text-xl">{Number(scores[student.id]) || 0}</span>
                    </div>
                </div>
            )}
        </div>
      </div>
    );
  }

  if (status === 'FINISHED') {
    const winner = sortedPlayers[0];
    return (
        <div className="text-center py-20 px-4 min-h-[90vh] flex flex-col items-center justify-center">
            <div className="relative mb-12">
                <Trophy size={120} className="text-yellow-400 animate-bounce mx-auto drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]"/>
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center overflow-visible pointer-events-none">
                     <Sparkles className="text-yellow-300 absolute -top-4 -right-4 animate-pulse" size={48}/>
                     <Sparkles className="text-indigo-300 absolute bottom-0 -left-10 animate-pulse" size={32} style={{animationDelay: '0.5s'}}/>
                </div>
            </div>

            <h1 className="text-5xl font-black text-indigo-900 mb-4 drop-shadow-sm">The Winners!</h1>
            <p className="text-indigo-400 font-bold text-xl mb-12">การแข่งขันสิ้นสุดลงแล้ว</p>
            
            <div className="flex flex-col md:flex-row items-end justify-center gap-4 mb-16 w-full max-w-4xl">
                 {sortedPlayers[1] && (
                     <div className="bg-white rounded-[32px] p-6 shadow-xl border-b-8 border-gray-200 flex flex-col items-center w-full md:w-56 order-2 md:order-1 transform hover:-translate-y-2 transition">
                         <span className="text-4xl mb-2">🥈</span>
                         <div className="text-5xl mb-3">{sortedPlayers[1].avatar}</div>
                         <div className="font-black text-gray-700 truncate w-full mb-1">{sortedPlayers[1].name.split(' ')[0]}</div>
                         <div className="bg-gray-100 px-4 py-1 rounded-full font-black text-gray-500 text-sm">{sortedPlayers[1].score}</div>
                     </div>
                 )}
                 {winner && (
                     <div className="bg-white rounded-[40px] p-8 shadow-2xl border-b-[12px] border-yellow-300 flex flex-col items-center w-full md:w-72 order-1 md:order-2 z-10 scale-110 ring-8 ring-yellow-400/20 transform hover:-translate-y-4 transition">
                         <Crown className="w-12 h-12 text-yellow-500 mb-2 animate-pulse"/>
                         <div className="text-7xl mb-4 drop-shadow-lg">{winner.avatar}</div>
                         <div className="font-black text-2xl text-indigo-900 truncate w-full mb-2">{winner.name.split(' ')[0]}</div>
                         <div className="bg-yellow-400 text-yellow-900 px-8 py-3 rounded-2xl font-black text-2xl shadow-lg">{winner.score}</div>
                     </div>
                 )}
                 {sortedPlayers[2] && (
                     <div className="bg-white rounded-[32px] p-6 shadow-xl border-b-8 border-orange-200 flex flex-col items-center w-full md:w-56 order-3 transform hover:-translate-y-2 transition">
                         <span className="text-4xl mb-2">🥉</span>
                         <div className="text-5xl mb-3">{sortedPlayers[2].avatar}</div>
                         <div className="font-black text-gray-700 truncate w-full mb-1">{sortedPlayers[2].name.split(' ')[0]}</div>
                         <div className="bg-orange-100 px-4 py-1 rounded-full font-black text-orange-500 text-sm">{sortedPlayers[2].score}</div>
                     </div>
                 )}
            </div>

            <div className="flex flex-wrap justify-center gap-4">
                <button onClick={onExit} className="bg-white text-gray-600 border-2 border-gray-200 px-12 py-4 rounded-[24px] font-black text-xl hover:bg-gray-50 transition-all shadow-md active:scale-95">ออกจากการแข่ง</button>
                {isAdmin && (
                    <button onClick={handleReset} className="bg-indigo-600 text-white px-12 py-4 rounded-[24px] font-black text-xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95">แข่งใหม่รอบหน้า</button>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-indigo-600">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="text-xl font-black">กำลังเชื่อมต่อสัญญาณ...</p>
    </div>
  );
};

export default GameMode;
