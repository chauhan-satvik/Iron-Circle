import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc,
  runTransaction,
  query,
  where,
  addDoc,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { UserProfile, Habit, DayCompletion, HabitDifficulty, HabitType, FocusSession } from '../types';
import { cn, getWeekId, getDaysOfWeek } from '../lib/utils';
import { format, isSameDay, subDays, parseISO } from 'date-fns';
import Chart from './Chart';
import Leaderboard from './Leaderboard';
import HabitRegistry from './HabitRegistry';
import HabitGrid from './HabitGrid';
import DistributionChart from './DistributionChart';
import { Sparkles, Zap, Shield, Flame, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { 
  calculateUserXP, 
  calculateHabitStreak, 
  calculateWeeklyProgress, 
  calculateWeeklyConsistency, 
  calculateDailyConsistency,
  getWeeklyStats,
  XP_MAP 
} from '../lib/habitEngine';

interface WeeklyDashboardProps {
  profile: UserProfile;
  today: Date;
}

export default function WeeklyDashboard({ profile, today }: WeeklyDashboardProps) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [xpPopups, setXpPopups] = useState<{ id: number; amount: number; x: number; y: number }[]>([]);
  
  const currentWeekDays = getDaysOfWeek(today);

  useEffect(() => {
    setLoading(true);
    // 1. Listen to habits
    const habitsPath = `groups/${profile.groupId}/users/${profile.uid}/habits`;
    const unsubscribeHabits = onSnapshot(collection(db, habitsPath), (snap) => {
      const h = snap.docs.map(d => ({ ...d.data(), id: d.id } as Habit));
      setHabits(h);
      if (loading) setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, habitsPath);
    });

    // 2. Listen to focus sessions
    const focusPath = `groups/${profile.groupId}/users/${profile.uid}/focusSessions`;
    const unsubscribeFocus = onSnapshot(collection(db, focusPath), (snap) => {
      setFocusSessions(snap.docs.map(d => ({ ...d.data(), id: d.id } as FocusSession)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, focusPath);
    });

    return () => {
      unsubscribeHabits();
      unsubscribeFocus();
    };
  }, [profile.uid, profile.groupId]);

  const handleAddHabit = async (name: string, difficulty: HabitDifficulty, type: HabitType, target: number) => {
    const habitsPath = `groups/${profile.groupId}/users/${profile.uid}/habits`;
    
    try {
      await addDoc(collection(db, habitsPath), {
        name,
        difficulty,
        type,
        target,
        xpValue: XP_MAP[difficulty],
        completions: {},
        createdAt: Date.now()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, habitsPath);
    }
  };

  const handleUpdateHabit = async (habitId: string, updates: Partial<Habit>) => {
    const habitPath = `groups/${profile.groupId}/users/${profile.uid}/habits/${habitId}`;
    const habitRef = doc(db, habitPath);
    try {
      await updateDoc(habitRef, updates);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, habitPath);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    const habitPath = `groups/${profile.groupId}/users/${profile.uid}/habits/${habitId}`;
    const habitRef = doc(db, habitPath);
    try {
      await deleteDoc(habitRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, habitPath);
    }
  };

  const [feedback, setFeedback] = useState<{ xp: number; streak: number; habitId: string } | null>(null);

  const handleToggleHabit = async (habitId: string, dateStr: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    // Security check: Only allow today's date
    const todayStr = format(today, 'yyyy-MM-dd');
    if (dateStr !== todayStr) {
      console.warn("Retrospective or future habit manipulation detected and blocked.");
      return;
    }

    const habitPath = `groups/${profile.groupId}/users/${profile.uid}/habits/${habitId}`;
    const habitRef = doc(db, habitPath);

    try {
      await runTransaction(db, async (transaction) => {
        const habitSnap = await transaction.get(habitRef);
        if (!habitSnap.exists()) return;

        const habitData = habitSnap.data() as Habit;
        const currentCompletions = habitData.completions || {};
        const isAdding = !currentCompletions[dateStr];
        
        const newCompletions = { ...currentCompletions };
        if (isAdding) {
          newCompletions[dateStr] = true;
        } else {
          delete newCompletions[dateStr];
        }

        transaction.update(habitRef, { completions: newCompletions });

        if (isAdding) {
          const rect = (e?.target as HTMLElement)?.getBoundingClientRect();
          const popup = {
            id: Date.now(),
            amount: XP_MAP[habitData.difficulty] || 10,
            x: rect ? rect.left : window.innerWidth / 2,
            y: rect ? rect.top : window.innerHeight / 2
          };
          setXpPopups(prev => [...prev, popup]);
          setTimeout(() => {
            setXpPopups(prev => prev.filter(p => p.id !== popup.id));
          }, 1000);
        }
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, dateStr);
    }
  };

  // Derived Stats Calculation
  const weeklyConsistency = calculateWeeklyConsistency(habits, currentWeekDays);
  const { totalCompleted, totalMissed } = getWeeklyStats(habits, currentWeekDays);

  const performanceChartData = [
    { name: 'Completed', value: totalCompleted, color: '#3B82F6' },
    { name: 'Missed', value: totalMissed, color: 'rgba(255,255,255,0.05)' }
  ].filter(d => d.value > 0 || (totalCompleted + totalMissed) === 0);

  const chartData = currentWeekDays.map(d => ({
    name: format(d, 'EEE'),
    progress: calculateDailyConsistency(habits, d)
  }));

  if (loading) return null;

  return (
    <div className="w-full space-y-8 pb-12">
      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 bg-accent rounded-2xl shadow-[0_20px_50px_rgba(59,130,246,0.5)] border border-white/20"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-white fill-white animate-pulse" />
              <span className="text-sm font-black text-white italic">+{feedback.xp} XP</span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-200 fill-orange-200" />
              <span className="text-sm font-black text-white italic">{feedback.streak} DAY STREAK</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Top Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-12 xl:col-span-4 2xl:col-span-5 glass-card rounded-[2rem] sm:rounded-3xl p-5 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-accent/10 blur-[80px] rounded-full" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-accent animate-pulse" />
                <h2 className="text-[8px] sm:text-xs font-black text-white/40 uppercase tracking-[0.25em] sm:tracking-[0.3em]">Neural Analytics</h2>
              </div>
              <h1 className="text-xl sm:text-3xl font-black text-white tracking-tighter italic uppercase">Weekly Efficiency</h1>
            </div>
            
            <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 bg-white/[0.03] sm:bg-transparent px-2.5 py-1.5 sm:p-0 rounded-lg sm:rounded-none border border-white/5 sm:border-none">
              <span className="text-[7px] sm:text-[10px] font-black text-text-dim uppercase tracking-widest leading-none">Consistency</span>
              <span className="text-base sm:text-2xl font-black text-accent italic leading-none">{weeklyConsistency}%</span>
            </div>
          </div>
          
          <div className="h-[200px] sm:h-[280px] w-full relative z-10">
            <Chart data={chartData} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-12 xl:col-span-3 2xl:col-span-3 glass-card rounded-[2rem] sm:rounded-3xl p-5 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 blur-[80px] rounded-full" />
          
          <div className="mb-6 sm:mb-8 relative z-10">
            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 animate-pulse" />
              <h2 className="text-[8px] sm:text-xs font-black text-white/40 uppercase tracking-[0.25em] sm:tracking-[0.3em]">Goal Adherence</h2>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tighter italic uppercase">Execution Rate</h1>
          </div>

          <div className="h-[200px] sm:h-[280px] w-full relative z-10">
            <DistributionChart data={performanceChartData} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-12 xl:col-span-5 2xl:col-span-4"
        >
          <Leaderboard groupId={profile.groupId} today={today} />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 2xl:col-span-3">
          <HabitRegistry 
            habits={habits}
            today={today}
            onAddHabit={handleAddHabit}
            onUpdateHabit={handleUpdateHabit}
            onDeleteHabit={handleDeleteHabit}
            onToggleHabit={(id, e) => handleToggleHabit(id, format(today, 'yyyy-MM-dd'), e)}
          />
        </div>
        <div className="xl:col-span-8 2xl:col-span-9">
          <HabitGrid 
            habits={habits}
            onToggleCell={(id, date) => handleToggleHabit(id, date)}
            today={today}
          />
        </div>
      </div>

      <AnimatePresence>
        {xpPopups.map((popup) => (
          <motion.div
            key={popup.id}
            initial={{ opacity: 0, y: popup.y - 20, x: popup.x }}
            animate={{ 
              opacity: 1, 
              y: popup.y - 80,
              x: popup.amount < 0 ? [popup.x - 5, popup.x + 5, popup.x - 5, popup.x] : popup.x 
            }}
            transition={{
              y: { duration: 0.8 },
              x: popup.amount < 0 ? { duration: 0.2, repeat: 2 } : { duration: 0 }
            }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed z-[999] pointer-events-none"
          >
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full font-black text-xl shadow-2xl italic border",
              popup.amount > 0 
                ? "bg-accent text-white border-accent/20 shadow-accent/50" 
                : "bg-red-500 text-white border-red-400/20 shadow-red-500/50"
            )}>
              {popup.amount > 0 ? <Zap className="w-5 h-5 fill-current" /> : <div className="w-5 h-5 flex items-center justify-center font-black">-</div>}
              {popup.amount > 0 ? `+${popup.amount}` : popup.amount} XP
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <footer className="pt-8 flex justify-between items-center text-[9px] font-black uppercase tracking-[0.4em] text-text-dim/30 border-t border-white/[0.05]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
            <span>Habit Matrix Online</span>
          </div>
          <span className="w-px h-3 bg-white/5" />
          <span>Core v3.0.0</span>
        </div>
        <div className="flex items-center gap-4 italic opacity-50">
          <Shield className="w-3.5 h-3.5" />
        </div>
      </footer>
    </div>
  );
}
