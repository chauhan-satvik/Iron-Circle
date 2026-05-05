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
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { useTimerStore } from '../lib/timerStore';

interface FocusTimerProps {
  profile: UserProfile;
}

export default function FocusTimer({ profile }: FocusTimerProps) {
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
  const [isSaving, setIsSaving] = useState(false);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [todayStats, setTodayStats] = useState({ count: 0, minutes: 0 });

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
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const q = query(
      focusRef,
      where('date', '==', today),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FocusSession));
      setSessions(docs);
      
      const totalMinutes = docs.reduce((acc, s) => acc + (s.completed ? s.duration : 0), 0);
      setTodayStats({
        count: docs.filter(d => d.completed).length,
        minutes: totalMinutes
      });
    });

    return () => unsubscribe();
  }, [profile.groupId]);

  const handleComplete = async () => {
    completeTimer();
    
    if (mode === 'focus') {
      const durationInMinutes = Math.floor(FOCUS_TIME / 60);
      try {
        const userId = auth.currentUser!.uid;
        const focusRef = collection(db, 'groups', profile.groupId, 'users', userId, 'focusSessions');
        const userRef = doc(db, 'users', userId);
        const nestedUserRef = doc(db, 'groups', profile.groupId, 'users', userId);

        const xpDelta = durationInMinutes * 2;

        await runTransaction(db, async (transaction) => {
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) return;
          
          const userData = userSnap.data() as UserProfile;
          const newXp = (userData.xp || 0) + xpDelta;
          const newLevel = Math.floor(Math.sqrt(newXp / 100));

          // Save session
          transaction.set(doc(focusRef), {
            userId: userId,
            duration: durationInMinutes,
            date: format(new Date(), 'yyyy-MM-dd'),
            completed: true,
            createdAt: Date.now()
          });

          // Update user XP
          const updates = {
            xp: newXp,
            level: newLevel,
            lastActive: Date.now()
          };

          transaction.update(userRef, updates);
          transaction.update(nestedUserRef, updates);
        });

        // Trigger audio pulse
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      } catch (error) {
        console.error("Failed to save focus session:", error);
      }
    }

    // Auto switch or alert
    alert(mode === 'focus' ? "Focus session complete! Take a break." : "Break complete! Back to work.");
    setMode(mode === 'focus' ? 'break' : 'focus');
    setTimeLeft(mode === 'focus' ? BREAK_TIME : FOCUS_TIME);
  };

  const toggleTimer = () => {
    if (isRunning) {
      pauseTimer();
    } else if (isPaused) {
      resumeTimer();
    } else {
      startTimer(mode === 'focus' ? FOCUS_TIME : BREAK_TIME, mode);
    }
  };

  const switchMode = (newMode: 'focus' | 'break') => {
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

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center py-8">
      {/* Configuration Hub Toggle */}
      <div className="mb-8 flex flex-col items-center">
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

        {/* Supporting Footer Section */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-8 opacity-40 hover:opacity-100 transition-opacity duration-500">
           <div className="flex items-center gap-3">
              <History className="w-4 h-4" />
              <div className="flex gap-4">
                 {sessions.slice(0, 3).map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-white">{s.duration}M</span>
                       <span className="text-[8px] font-black uppercase tracking-tighter">{format(s.createdAt, 'HH:mm')}</span>
                    </div>
                 ))}
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-accent fill-current" />
              <div className="text-[10px] font-black uppercase tracking-widest italic">
                Daily Focus: {todayStats.minutes}M / {todayStats.count} Cycles
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
