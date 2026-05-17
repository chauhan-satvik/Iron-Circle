import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  doc,
  runTransaction,
  updateDoc
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from 'recharts';
import { db, auth } from '../firebase';
import { FocusSession, UserProfile } from '../types';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Timer, 
  Coffee, 
  CheckCircle2, 
  Brain,
  History,
  Zap,
  Settings,
  Save,
  X,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, subDays, parseISO } from 'date-fns';
import { useTimerStore } from '../lib/timerStore';

interface FocusTimerProps {
  profile: UserProfile;
  today: Date;
}

export default function FocusTimer({ profile, today }: FocusTimerProps) {
  const { 
    endTime, 
    isRunning, 
    isPaused, 
    mode, 
    remainingTimeOnPause,
    startTimer, 
    pauseTimer, 
    resumeTimer, 
    resetTimer, 
    setMode,
    completeTimer
  } = useTimerStore();

  const [focusDuration, setFocusDuration] = useState(profile.defaultFocusDuration || 25);
  const [breakDuration, setBreakDuration] = useState(profile.defaultBreakDuration || 5);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [offlineDuration, setOfflineDuration] = useState<string | number>(25);
  const [offlineSubject, setOfflineSubject] = useState('');
  const [offlineNotes, setOfflineNotes] = useState('');
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [todayStats, setTodayStats] = useState({ count: 0, minutes: 0, trackedMinutes: 0, offlineMinutes: 0 });
  const [weeklyFocusData, setWeeklyFocusData] = useState<{ date: string; tracked: number; offline: number }[]>([]);

  const FOCUS_TIME = focusDuration * 60;
  const BREAK_TIME = breakDuration * 60;

  useEffect(() => {
    const updateTimeLeft = () => {
      if (isRunning && endTime) {
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          handleComplete();
        }
      } else if (isPaused) {
        setTimeLeft(remainingTimeOnPause);
      } else {
        // Idle
        setTimeLeft(mode === 'focus' ? focusDuration * 60 : breakDuration * 60);
      }
    };

    updateTimeLeft();

    if (isRunning) {
      const intervalId = setInterval(updateTimeLeft, 500);
      return () => clearInterval(intervalId);
    }
  }, [endTime, isRunning, isPaused, mode, focusDuration, breakDuration, remainingTimeOnPause]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const focusRef = collection(db, 'groups', profile.groupId, 'users', auth.currentUser.uid, 'focusSessions');
    const todayStr = format(today, 'yyyy-MM-dd');
    const sevenDaysAgo = format(subDays(today, 6), 'yyyy-MM-dd');
    
    // Get last 7 days of sessions for the chart
    const q = query(
      focusRef,
      where('date', '>=', sevenDaysAgo),
      orderBy('date', 'asc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FocusSession));
      const todayDocs = docs.filter(s => s.date === todayStr);
      setSessions(todayDocs);
      
      const trackedMinutes = todayDocs.filter(s => s.source !== 'offline' && s.completed).reduce((acc, s) => acc + s.duration, 0);
      const offlineMinutes = todayDocs.filter(s => s.source === 'offline' && s.completed).reduce((acc, s) => acc + s.duration, 0);
      
      setTodayStats({
        count: todayDocs.filter(d => d.completed && d.source !== 'offline').length,
        minutes: trackedMinutes + offlineMinutes,
        trackedMinutes,
        offlineMinutes
      });

      // Prepare weekly chart data
      const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(today, 6 - i), 'yyyy-MM-dd'));
      const weeklyData = last7Days.map(date => {
        const dayDocs = docs.filter(s => s.date === date && s.completed);
        return {
          date: format(parseISO(date), 'EEE'),
          tracked: dayDocs.filter(s => s.source !== 'offline').reduce((acc, s) => acc + s.duration, 0),
          offline: dayDocs.filter(s => s.source === 'offline').reduce((acc, s) => acc + s.duration, 0)
        };
      });
      setWeeklyFocusData(weeklyData as any);
    });

    return () => unsubscribe();
  }, [profile.groupId, today]);

  const playTacticalSound = (type: 'start' | 'pause' | 'switch' | 'complete') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playTone = (freq: number, duration: number, vol = 0.05, oscType: OscillatorType = 'sine') => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = oscType;
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
      };

      switch (type) {
        case 'start':
          playTone(880, 0.1);
          break;
        case 'pause':
          playTone(440, 0.15);
          break;
        case 'switch':
          playTone(660, 0.08);
          setTimeout(() => playTone(880, 0.08), 50);
          break;
        case 'complete':
          playTone(440, 0.2, 0.1);
          setTimeout(() => playTone(660, 0.2, 0.1), 150);
          setTimeout(() => playTone(880, 0.5, 0.1), 300);
          break;
      }
    } catch (e) {
      // Audio context might be blocked if no user interaction yet, ignore
    }
  };

  const handleFinishEarly = async () => {
    const completedSeconds = totalTime - timeLeft;
    const completedMinutes = Math.floor(completedSeconds / 60);
    const xpDelta = completedMinutes >= 5 ? completedMinutes * 2 : 0;
    
    setIsSaving(true);
    try {
      const userId = auth.currentUser!.uid;
      const focusRef = collection(db, 'groups', profile.groupId, 'users', userId, 'focusSessions');
      const userRef = doc(db, 'users', userId);
      const nestedUserRef = doc(db, 'groups', profile.groupId, 'users', userId);

      await runTransaction(db, async (transaction) => {
        // Save partial session
        transaction.set(doc(focusRef), {
          userId: userId,
          duration: completedMinutes,
          xpEarned: xpDelta,
          date: format(today, 'yyyy-MM-dd'),
          completed: true,
          completionType: 'partial',
          source: 'timer',
          rewardEligible: completedMinutes >= 5,
          createdAt: Date.now()
        });

        // Update lastActive
        const updates = {
          lastActive: Date.now()
        };

        transaction.update(userRef, updates);
        transaction.update(nestedUserRef, updates);
      });

      resetTimer();
      setShowFinishModal(false);
      playTacticalSound('complete');
    } catch (error) {
      console.error("Failed to save partial focus session:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    completeTimer();
    playTacticalSound('complete');
    
    if (mode === 'focus') {
      const durationInMinutes = Math.floor(FOCUS_TIME / 60);
      try {
        const userId = auth.currentUser!.uid;
        const focusRef = collection(db, 'groups', profile.groupId, 'users', userId, 'focusSessions');
        const userRef = doc(db, 'users', userId);
        const nestedUserRef = doc(db, 'groups', profile.groupId, 'users', userId);

        const xpDelta = durationInMinutes * 2;

        await runTransaction(db, async (transaction) => {
          // Save session
            transaction.set(doc(focusRef), {
              userId: userId,
              duration: durationInMinutes,
              xpEarned: xpDelta,
              date: format(today, 'yyyy-MM-dd'),
              completed: true,
              completionType: 'full',
              source: 'timer',
              rewardEligible: true,
              createdAt: Date.now()
            });

          // Update lastActive only
          const updates = {
            lastActive: Date.now()
          };

          transaction.update(userRef, updates);
          transaction.update(nestedUserRef, updates);
        });

      } catch (error) {
        console.error("Failed to save focus session:", error);
      }
    }

    // Auto switch or alert
    setMode(mode === 'focus' ? 'break' : 'focus');
    setTimeLeft(mode === 'focus' ? BREAK_TIME : FOCUS_TIME);
  };

  const toggleTimer = () => {
    if (isRunning) {
      pauseTimer();
      playTacticalSound('pause');
    } else if (isPaused) {
      resumeTimer();
      playTacticalSound('start');
    } else {
      startTimer(mode === 'focus' ? FOCUS_TIME : BREAK_TIME, mode);
      playTacticalSound('start');
    }
  };

  const switchMode = (newMode: 'focus' | 'break') => {
    if (newMode !== mode) {
      playTacticalSound('switch');
    }
    resetTimer();
    setMode(newMode);
    setTimeLeft(newMode === 'focus' ? FOCUS_TIME : BREAK_TIME);
  };

  const saveDefaults = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const userId = auth.currentUser.uid;
      const userRef = doc(db, 'users', userId);
      const nestedUserRef = doc(db, 'groups', profile.groupId, 'users', userId);

      const updates = {
        defaultFocusDuration: focusDuration,
        defaultBreakDuration: breakDuration
      };

      await updateDoc(userRef, updates);
      await updateDoc(nestedUserRef, updates);
      setShowSettings(false);
    } catch (error) {
      console.error("Error saving defaults:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // Circular Progress Logic
  const totalTime = mode === 'focus' ? FOCUS_TIME : BREAK_TIME;
  const progress = timeLeft / totalTime;
  const strokeDasharray = 1000;
  const strokeDashoffset = strokeDasharray * (1 - progress);

  const getTimerColor = () => {
    if (timeLeft <= 120) return '#EF4444'; // Red for last 2 mins
    if (progress <= 0.5) return '#8B5CF6'; // Purple for mid-range
    return mode === 'focus' ? '#3B82F6' : '#10B981'; // Blue for focus, Emerald for break
  };

  const timerColor = getTimerColor();

  const getFocusLabel = () => {
    if (mode === 'break') return "RESTORING ASSETS";
    if (progress > 0.7) return "FOCUS STABLE";
    if (progress >= 0.3) return "LOCKED IN";
    return "BREAKING POINT";
  };

  const focusLabel = getFocusLabel();

  const handleSaveOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    setOfflineError(null);
    
    const durationVal = typeof offlineDuration === 'string' ? parseFloat(offlineDuration) : offlineDuration;
    
    if (!auth.currentUser || isNaN(durationVal) || durationVal <= 0 || durationVal > 720) {
      setOfflineError("Enter a valid positive number (max 720)");
      return;
    }
    
    setIsSavingOffline(true);
    try {
      const userId = auth.currentUser.uid;
      const focusRef = collection(db, 'groups', profile.groupId, 'users', userId, 'focusSessions');
      
      await addDoc(focusRef, {
        userId,
        duration: durationVal,
        date: format(today, 'yyyy-MM-dd'),
        completed: true,
        source: 'offline',
        rewardEligible: false,
        subject: offlineSubject,
        notes: offlineNotes,
        createdAt: Date.now()
      });
      
      setShowOfflineModal(false);
      setOfflineSubject('');
      setOfflineNotes('');
      setOfflineDuration(25);
    } catch (error) {
      console.error("Error saving offline focus:", error);
      setOfflineError("Protocol error: Failed to save session.");
    } finally {
      setIsSavingOffline(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center py-8">
      {/* Configuration Hub Toggle */}
      <div className="mb-8 flex flex-col sm:flex-row items-center gap-4">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            "group flex items-center gap-3 px-8 py-3 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/5 text-text-dim hover:text-white transition-all duration-500",
            showSettings && "bg-accent/10 border-accent/20 text-accent"
          )}
        >
          <Settings className={cn("w-4 h-4 transition-transform duration-700", showSettings && "rotate-180")} />
          <span className="text-[9px] font-black uppercase tracking-[0.3em]">Configure Sequence</span>
        </button>

        <button 
          onClick={() => setShowOfflineModal(true)}
          className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/10 border border-white/5 text-text-dim hover:text-white transition-all duration-300"
        >
          <History className="w-4 h-4" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em]">Log Offline Focus</span>
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="w-full max-w-md mb-12 overflow-hidden px-4"
          >
            <div className="glass-card rounded-[2.5rem] p-8 border-accent/20 space-y-8 relative overflow-hidden">
              {/* Subtle grid background for settings */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
              
              <div className="relative z-10 space-y-8">
                {/* Quick Presets */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-text-dim/60 uppercase tracking-widest">Neural Presets</span>
                    <div className="h-px flex-1 mx-4 bg-white/5" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[5, 10, 25, 50, 90].map((mins) => (
                      <button
                        key={mins}
                        disabled={isRunning || isPaused}
                        onClick={() => {
                          setFocusDuration(mins);
                        }}
                        className={cn(
                          "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                          focusDuration === mins && mode === 'focus'
                            ? "bg-accent text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                            : "bg-white/[0.03] text-text-dim hover:text-white hover:bg-white/[0.08] disabled:opacity-30"
                        )}
                      >
                        {mins}M
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual Overrides */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                      <Brain className="w-3 h-3 text-accent" /> Focus Min
                    </label>
                    <input 
                      type="number"
                      value={focusDuration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setFocusDuration(val);
                      }}
                      disabled={isRunning || isPaused}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white font-black text-sm focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all outline-none disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                      <Coffee className="w-3 h-3 text-emerald-400" /> Break Min
                    </label>
                    <input 
                      type="number"
                      value={breakDuration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setBreakDuration(val);
                      }}
                      disabled={isRunning || isPaused}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white font-black text-sm focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 flex items-center justify-between gap-4">
                   <div className="text-[8px] text-text-dim/40 italic flex-1">
                      * Save values as permanent defaults.
                   </div>
                   <button 
                    onClick={saveDefaults}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:shadow-[0_10px_30px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap"
                  >
                    {isSaving ? "Syncing..." : <><Save className="w-3 h-3" /> Save Defaults</>}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFinishModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFinishModal(false)}
              className="absolute inset-0 bg-bg-main/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-card rounded-[3rem] p-8 sm:p-12 border-white/10 shadow-2xl overflow-hidden text-center"
            >
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
              
              <div className="relative z-10 space-y-8">
                <div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Extract Early?</h2>
                  <p className="text-[10px] font-black text-text-dim uppercase tracking-widest mt-2">Dossier Closure Protocol</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                    <div className="text-2xl font-black text-white italic">{Math.floor((totalTime - timeLeft) / 60)}M</div>
                    <div className="text-[8px] font-black text-text-dim uppercase tracking-widest mt-1">Focused</div>
                  </div>
                  <div className="bg-accent/10 p-6 rounded-3xl border border-accent/20">
                    <div className="text-2xl font-black text-accent italic">+{Math.floor((totalTime - timeLeft) / 60) >= 5 ? Math.floor((totalTime - timeLeft) / 60) * 2 : 0} XP</div>
                    <div className="text-[8px] font-black text-accent uppercase tracking-widest mt-1">Earned</div>
                  </div>
                </div>

                {Math.floor((totalTime - timeLeft) / 60) < 5 && (
                  <p className="text-[9px] font-black text-red-400 uppercase tracking-widest bg-red-400/5 py-2 rounded-lg border border-red-400/10 px-4">
                    Sessions under 5 minutes yield 0 XP to prevent protocol manipulation.
                  </p>
                )}

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleFinishEarly}
                    disabled={isSaving}
                    className="w-full py-4 bg-accent text-white font-black rounded-2xl uppercase tracking-widest hover:scale-[1.02] active:scale-95 shadow-2xl transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Synchronizing...' : 'Finish Session'}
                  </button>
                  <button 
                    onClick={() => setShowFinishModal(false)}
                    className="w-full py-4 bg-white/5 text-text-dim font-black rounded-2xl uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    Return to Focus
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOfflineModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOfflineModal(false)}
              className="absolute inset-0 bg-bg-main/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg glass-card rounded-[3rem] p-8 sm:p-12 border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Log Offline Focus</h2>
                    <p className="text-[10px] font-black text-text-dim uppercase tracking-widest mt-1">Manual Intelligence Entry • Non-XP</p>
                  </div>
                  <button onClick={() => setShowOfflineModal(false)} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 text-white/40 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveOffline} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-2">Session Duration (MINUTES)</label>
                    <div className="relative group">
                      <Timer className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-dim group-focus-within:text-accent transition-colors" />
                      <input 
                        type="number"
                        step="any"
                        max="720"
                        value={offlineDuration}
                        onChange={(e) => {
                          setOfflineDuration(e.target.value);
                          if (offlineError) setOfflineError(null);
                        }}
                        placeholder="Minutes (e.g. 0.5, 45)"
                        className={cn(
                          "w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-14 pr-6 py-4 text-white font-black text-sm focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none",
                          offlineError && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/5"
                        )}
                        required
                      />
                    </div>
                    {offlineError && (
                      <p className="text-[9px] font-black text-red-400 uppercase tracking-widest pl-2">
                        {offlineError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-2">Sector / Subject (OPTIONAL)</label>
                    <div className="relative group">
                      <Brain className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-dim group-focus-within:text-accent transition-colors" />
                      <input 
                        type="text"
                        placeholder="e.g. Physics, Coding, Analysis"
                        value={offlineSubject}
                        onChange={(e) => setOfflineSubject(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-14 pr-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-2">Neural Notes (OPTIONAL)</label>
                    <textarea 
                      placeholder="Summary of deep work protocol..."
                      value={offlineNotes}
                      onChange={(e) => setOfflineNotes(e.target.value)}
                      rows={3}
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-6 py-4 text-white font-medium placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none resize-none"
                    />
                  </div>

                  <div className="pt-4 flex items-center gap-4">
                    <button 
                      type="button"
                      onClick={() => setShowOfflineModal(false)}
                      className="flex-1 py-4 bg-white/5 text-text-dim font-black rounded-2xl uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                    >
                      Abort
                    </button>
                    <button 
                      type="submit"
                      disabled={isSavingOffline}
                      className="flex-[2] py-4 bg-accent text-white font-black rounded-2xl uppercase tracking-widest hover:scale-[1.02] active:scale-95 shadow-2xl transition-all disabled:opacity-50"
                    >
                      {isSavingOffline ? 'Establishing Link...' : 'Save Session'}
                    </button>
                  </div>
                </form>
                
                <div className="mt-8 p-4 bg-accent/5 border border-accent/10 rounded-2xl flex items-start gap-4">
                  <Activity className="w-5 h-5 text-accent shrink-0 mt-1" />
                  <p className="text-[9px] font-medium leading-relaxed text-text-dim/60 uppercase tracking-wider">
                    Note: Offline sessions contribute to personal study metrics but do not yield competitive XP or affect leaderboard positioning.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-5xl px-6">
        <div className="glass-card rounded-[3rem] p-10 sm:p-16 flex flex-col lg:flex-row items-center justify-center gap-16 lg:gap-24 relative overflow-hidden">
          {/* Background Glows */}
          <div className={cn(
            "absolute top-0 right-0 w-[500px] h-[500px] blur-[120px] opacity-10 transition-colors duration-1000",
            mode === 'focus' ? "bg-accent" : "bg-emerald-500"
          )} />
          
          {/* Left Side: Info & Primary Controls */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left space-y-8 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex p-1 bg-black/40 backdrop-blur-xl rounded-xl border border-white/5">
                  <button 
                    onClick={() => switchMode('focus')}
                    disabled={isRunning || isPaused}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                      mode === 'focus' ? "bg-accent text-white shadow-lg" : "text-text-dim hover:text-white disabled:opacity-30"
                    )}
                  >
                    Focus
                  </button>
                  <button 
                    onClick={() => switchMode('break')}
                    disabled={isRunning || isPaused}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                      mode === 'break' ? "bg-emerald-500 text-white shadow-lg" : "text-text-dim hover:text-white disabled:opacity-30"
                    )}
                  >
                    Break
                  </button>
                </div>
              </div>
              <div className="text-7xl sm:text-8xl font-black text-white italic tracking-tighter leading-none tabular-nums drop-shadow-2xl">
                {minutes.toString().padStart(2, '0')}<span className="opacity-20">:</span>{seconds.toString().padStart(2, '0')}
              </div>
              <div className="text-[10px] font-black text-text-dim uppercase tracking-widest opacity-40">
                {mode === 'focus' ? "Neural Focus Mode" : "Restoration Phase"}
              </div>
            </div>

              <div className="flex flex-col gap-4 w-full max-w-xs lg:max-w-none pt-4">
                <button
                  onClick={toggleTimer}
                  className={cn(
                    "w-full px-12 py-6 rounded-3xl flex items-center justify-center gap-4 text-base font-black uppercase tracking-[0.3em] transition-all transform active:scale-95 shadow-[0_20px_50px_rgba(0,0,0,0.3)]",
                    isRunning 
                      ? "bg-white/5 border border-white/10 text-white hover:bg-white/10" 
                      : mode === 'focus' 
                        ? "bg-accent text-white shadow-[0_15px_40px_rgba(59,130,246,0.3)] hover:shadow-[0_20px_50px_rgba(59,130,246,0.5)]" 
                        : "bg-emerald-500 text-white shadow-[0_15px_40_rgba(16,185,129,0.3)] hover:shadow-[0_20px_50px_rgba(16,185,129,0.5)]"
                  )}
                >
                  {isRunning ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                  {isRunning ? "Standby" : "Ignite"}
                </button>

                {(isRunning || isPaused) && mode === 'focus' && (
                  <button
                    onClick={() => setShowFinishModal(true)}
                    className="w-full px-8 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-dim hover:text-white transition-all flex items-center justify-center gap-3"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finish Session
                  </button>
                )}
                
                <div className="flex items-center justify-between w-full px-2">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-text-dim uppercase tracking-widest mb-0.5 opacity-40">Yield</span>
                  <span className="text-sm font-black text-white italic">+{focusDuration * 2} XP</span>
                </div>

                <button
                  onClick={resetTimer}
                  className="flex items-center gap-2 text-[10px] font-black text-text-dim hover:text-white uppercase tracking-widest transition-all opacity-50 hover:opacity-100"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Cycle
                </button>
              </div>
            </div>
          </div>

          {/* Right Side: Interactive Ring */}
          <div className="relative flex items-center justify-center z-10">
            <div 
              className="relative cursor-pointer group"
              onClick={toggleTimer}
            >
              {/* SVG Ring */}
              <svg className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] -rotate-90 transform overflow-visible">
                <circle
                  cx="50%"
                  cy="50%"
                  r="135"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-white/[0.03]"
                />
                <motion.circle
                  cx="50%"
                  cy="50%"
                  r="135"
                  fill="none"
                  stroke={timerColor}
                  strokeWidth="10"
                  strokeDasharray="848.23"
                  animate={{ 
                    strokeDashoffset: 848.23 * (1 - progress),
                    stroke: timerColor,
                    filter: `drop-shadow(0 0 15px ${timerColor}66)`
                  }}
                  transition={{ 
                    duration: isRunning ? 1.05 : 0, 
                    ease: "linear"
                  }}
                  strokeLinecap="round"
                  className="transition-colors duration-1000"
                />
              </svg>

              {/* Center Ring Icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={cn(
                  "w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-500",
                  "bg-white/[0.02] border border-white/5 group-hover:bg-white/[0.05] group-hover:scale-110",
                  isRunning ? "text-white" : mode === 'focus' ? "text-accent shadow-[0_0_30px_rgba(59,130,246,0.2)]" : "text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                )}>
                  <AnimatePresence mode="wait">
                    {isRunning ? (
                      <motion.div
                        key="pause"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.5, opacity: 0 }}
                      >
                        <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-current" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="play"
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                      >
                        <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1 sm:ml-2" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            
            {/* Status Label Inside/Near Ring */}
            <div className="absolute -bottom-8 flex flex-col items-center">
               <AnimatePresence mode="wait">
                  <motion.div
                    key={focusLabel}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-[9px] font-black uppercase tracking-[0.4em] text-white/30"
                  >
                    {focusLabel}
                  </motion.div>
               </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Personal Focus Matrix - Weekly Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-16 w-full glass-card rounded-[3rem] p-8 sm:p-12 border-white/5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[80px] rounded-full -mr-20 -mt-20" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-accent" />
                <span className="text-[10px] font-black text-text-dim uppercase tracking-[0.3em]">Personal Focus Matrix</span>
              </div>
              <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Weekly Output</h3>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-[9px] font-black text-text-dim uppercase tracking-widest">Tracked</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-[9px] font-black text-text-dim uppercase tracking-widest">Offline</span>
               </div>
            </div>
          </div>

          <div className="h-[300px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyFocusData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 900 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 900 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ 
                    backgroundColor: '#0A0A0A', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                  }}
                />
                <Bar 
                  dataKey="tracked" 
                  stackId="a" 
                  fill="#3B82F6" 
                  radius={[0, 0, 0, 0]} 
                  barSize={40}
                />
                <Bar 
                  dataKey="offline" 
                  stackId="a" 
                  fill="#8B5CF6" 
                  radius={[8, 8, 0, 0]} 
                  barSize={40}
                  opacity={0.8}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Supporting Footer Section */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-8 opacity-40 hover:opacity-100 transition-opacity duration-500">
           <div className="flex items-center gap-3">
              <History className="w-4 h-4" />
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                 {sessions.slice(0, 3).map((s) => (
                     <div 
                      key={s.id} 
                      className={cn(
                        "flex items-center gap-2 px-3 py-1 rounded-full border transition-all hover:scale-105",
                        s.source === 'offline' 
                          ? "bg-violet-500/10 border-violet-500/20 text-violet-400" 
                          : "bg-white/5 border-white/5 text-white"
                      )}
                    >
                       <span className="text-[10px] font-black text-white">{s.duration}M</span>
                       <div className="w-1 h-1 rounded-full bg-white/20 whitespace-nowrap" />
                       <span className="text-[8px] font-black uppercase tracking-tighter whitespace-nowrap">
                         {s.source === 'offline' ? 'OFFLINE' : format(s.createdAt, 'HH:mm')}
                       </span>
                    </div>
                 ))}
              </div>
           </div>
           
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-accent/5 px-4 py-2 rounded-xl border border-accent/10">
                <Zap className="w-4 h-4 text-accent fill-current animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white italic">
                    {(todayStats as any).trackedMinutes || 0}M Tracked
                  </span>
                  <span className="text-[7px] text-text-dim font-black uppercase tracking-widest">Active Focus Protocol</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-violet-500/5 px-4 py-2 rounded-xl border border-violet-500/10 group hover:bg-violet-500/10 transition-colors">
                <History className="w-4 h-4 text-violet-400/60 group-hover:text-violet-400 transition-colors" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 italic">
                    {(todayStats as any).offlineMinutes || 0}M Offline
                  </span>
                  <span className="text-[7px] text-violet-400/40 font-black uppercase tracking-widest">Manual Intelligence</span>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
