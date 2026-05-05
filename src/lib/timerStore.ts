import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimerState {
  endTime: number | null;
  duration: number; // in seconds
  isRunning: boolean;
  isPaused: boolean;
  remainingTimeOnPause: number; // in seconds
  mode: 'focus' | 'break';
  
  startTimer: (durationInSeconds: number, mode: 'focus' | 'break') => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  setMode: (mode: 'focus' | 'break') => void;
  completeTimer: () => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      endTime: null,
      duration: 25 * 60,
      isRunning: false,
      isPaused: false,
      remainingTimeOnPause: 0,
      mode: 'focus',

      setMode: (mode) => set({ mode }),

      startTimer: (durationInSeconds, mode) => {
        const endTime = Date.now() + durationInSeconds * 1000;
        set({
          duration: durationInSeconds,
          endTime,
          isRunning: true,
          isPaused: false,
          remainingTimeOnPause: 0,
          mode,
        });
      },

      pauseTimer: () => {
        const { endTime, isRunning } = get();
        if (!isRunning || !endTime) return;

        const remainingSeconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        set({
          isRunning: false,
          isPaused: true,
          remainingTimeOnPause: remainingSeconds,
        });
      },

      resumeTimer: () => {
        const { isPaused, remainingTimeOnPause } = get();
        if (!isPaused) return;

        const newEndTime = Date.now() + remainingTimeOnPause * 1000;
        set({
          endTime: newEndTime,
          isRunning: true,
          isPaused: false,
          remainingTimeOnPause: 0,
        });
      },

      resetTimer: () => {
        set({
          endTime: null,
          isRunning: false,
          isPaused: false,
          remainingTimeOnPause: 0,
        });
      },

      completeTimer: () => {
        set({
          endTime: null,
          isRunning: false,
          isPaused: false,
          remainingTimeOnPause: 0,
        });
      }
    }),
    {
      name: 'timer-storage',
    }
  )
);
