
// utils/soundUtils.ts

// --- Sound Assets (ลิงก์เพลงฟรีไม่มีลิขสิทธิ์) ---
const SOUNDS = {
  // เพลง Lobby: จังหวะสนุกๆ รอเพื่อน
  BGM_LOBBY: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3',
  
  // เพลง Game: จังหวะตื่นเต้น เร้าใจ (เปลี่ยนลิงก์ใหม่ให้โหลดง่ายขึ้น)
  BGM_GAME: 'https://cdn.pixabay.com/audio/2021/09/06/audio_3719979729.mp3', 
  
  // เพลง Victory: ชัยชนะ
  BGM_VICTORY: 'https://cdn.pixabay.com/audio/2021/08/04/audio_12b0cd4862.mp3',
  
  SFX_CORRECT: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.m4a',
  SFX_WRONG: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.m4a',
  SFX_COUNTDOWN: 'https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.m4a',
  SFX_TIMEUP: 'https://assets.mixkit.co/active_storage/sfx/139/139-preview.m4a'
};

let bgmAudio: HTMLAudioElement | null = null;
let isMuted = false;

export const speak = (text: string) => {
if (isMuted) return;
if ('speechSynthesis' in window) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'th-TH';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}
};

export const playBGM = (type: 'LOBBY' | 'GAME' | 'VICTORY') => {
  if (isMuted) return;
  
  // ถ้าเป็นเพลงเดิมและเล่นอยู่แล้ว ไม่ต้องโหลดใหม่
  if (bgmAudio && !bgmAudio.paused && bgmAudio.src.includes(type === 'GAME' ? 'audio_3719979729' : 'audio_c8c8a73467')) {
      return;
  }

  stopBGM(); // หยุดเพลงเก่า

  let src = '';
  switch (type) {
      case 'LOBBY': src = SOUNDS.BGM_LOBBY; break;
      case 'GAME': src = SOUNDS.BGM_GAME; break;
      case 'VICTORY': src = SOUNDS.BGM_VICTORY; break;
  }

  if (src) {
      bgmAudio = new Audio(src);
      bgmAudio.loop = true;
      bgmAudio.volume = 0.5; // เพิ่มความดังเป็น 50%
      const playPromise = bgmAudio.play();
      
      if (playPromise !== undefined) {
          playPromise.catch(error => {
              console.log("Auto-play prevented. Waiting for user interaction.", error);
          });
      }
  }
};

export const stopBGM = () => {
  if (bgmAudio) {
      bgmAudio.pause();
      bgmAudio.currentTime = 0;
      bgmAudio = null;
  }
};

export const playSFX = (type: 'CORRECT' | 'WRONG' | 'COUNTDOWN' | 'TIMEUP') => {
  if (isMuted) return;

  let src = '';
  switch (type) {
      case 'CORRECT': src = SOUNDS.SFX_CORRECT; break;
      case 'WRONG': src = SOUNDS.SFX_WRONG; break;
      case 'COUNTDOWN': src = SOUNDS.SFX_COUNTDOWN; break;
      case 'TIMEUP': src = SOUNDS.SFX_TIMEUP; break;
  }

  if (src) {
      const audio = new Audio(src);
      audio.volume = 0.8;
      audio.play().catch(e => console.log("SFX play error:", e));
  }
};

export const toggleMuteSystem = (muteState: boolean) => {
  isMuted = muteState;
  if (isMuted) {
      if (bgmAudio) bgmAudio.pause();
  } else {
      if (bgmAudio) bgmAudio.play().catch(() => {});
  }
};
