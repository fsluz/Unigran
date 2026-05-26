import { createContext, useCallback, useContext, useRef } from 'react';
import { useToast } from './ToastContext';

const STORAGE_KEY = 'unigran:achievements';

const ACHIEVEMENTS = {
  first_post: { id: 'first_post', title: 'Faça seu primeiro post!', icon: '🎉' },
  first_comment: { id: 'first_comment', title: 'Primeiro comentário!', icon: '💬' },
  first_follow: { id: 'first_follow', title: 'Seguiu alguém pela primeira vez!', icon: '🤝' },
};

const AchievementsContext = createContext(null);

function loadUnlocked() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveUnlocked(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

function playAchievementSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* silent */ }
}

export function AchievementsProvider({ children }) {
  const { showToast } = useToast();
  const unlockedRef = useRef(loadUnlocked());

  const unlock = useCallback((key) => {
    const def = ACHIEVEMENTS[key];
    if (!def || unlockedRef.current.has(key)) return false;
    unlockedRef.current.add(key);
    saveUnlocked(unlockedRef.current);
    playAchievementSound();
    showToast(`${def.icon} ${def.title}`, 'Conquista');
    return true;
  }, [showToast]);

  return (
    <AchievementsContext.Provider value={{ unlock }}>
      {children}
    </AchievementsContext.Provider>
  );
}

export function useAchievements() {
  const ctx = useContext(AchievementsContext);
  if (!ctx) return { unlock: () => false };
  return ctx;
}
