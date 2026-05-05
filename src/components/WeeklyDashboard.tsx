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
import { UserProfile, Habit, DayCompletion, HabitDifficulty, HabitType } from '../types';
import { cn, getWeekId, getDaysOfWeek } from '../lib/utils';
import { format, isSameDay, subDays, parseISO } from 'date-fns';
import Chart from './Chart';
import Leaderboard from './Leaderboard';
import HabitRegistry from './HabitRegistry';
import HabitGrid from './HabitGrid';
import DistributionChart from './DistributionChart';
import { Sparkles, Zap, Shield, Flame, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WeeklyDashboardProps {
  profile: UserProfile;
}

export default function WeeklyDashboard({ profile }: WeeklyDashboardProps) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [weekCompletions, setWeekCompletions] = useState<Record<string, DayCompletion>>({});
  const [loading, setLoading] = useState(true);
  const [xpPopups, setXpPopups] = useState<{ id: number; amount: number; x: number; y: number }[]>([]);
  
  const currentWeekDays = getDaysOfWeek(new Date());

  useEffect(() => {
    // 1. Listen to habits
    const habitsPath = `groups/${profile.groupId}/users/${profile.uid}/habits`;
    const unsubscribeHabits = onSnapshot(collection(db, habitsPath), (snap) => {
      const h = snap.docs.map(d => ({ ...d.data(), id: d.id } as Habit));
      setHabits(h);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, habitsPath);
    });

    // 2. Listen to completions for the current week
    const completionsPath = `groups/${profile.groupId}/users/${profile.uid}/completions`;
    const dateIds = currentWeekDays.map(d => format(d, 'yyyy-MM-dd'));
    
    const unsubscribeCompletions = onSnapshot(collection(db, completionsPath), (snap) => {
      const c: Record<string, DayCompletion> = {};
      snap.docs.forEach(d => {
        if (dateIds.includes(d.id)) {
          c[d.id] = { ...d.data(), id: d.id } as DayCompletion;
        }
      });
      setWeekCompletions(c);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, completionsPath);
    });

    return () => {
      unsubscribeHabits();
      unsubscribeCompletions();
    };
  }, [profile.uid, profile.groupId]);

  const handleAddHabit = async (name: string, difficulty: HabitDifficulty, type: HabitType, target: number) => {
    const habitsPath = `groups/${profile.groupId}/users/${profile.uid}/habits`;
    const xpValues = { easy: 10, medium: 25, hard: 50 };
    
    try {
      await addDoc(collection(db, habitsPath), {
        name,
        difficulty,
        type,
        target,
        xpValue: xpValues[difficulty],
        currentStreak: 0,
        bestStreak: 0,
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
    const habitPath = `groups/${profile.groupId}/users/${profile.uid}/habits/${habitId}`;
    const habitRef = doc(db, habitPath);
    const completionPath = `groups/${profile.groupId}/users/${profile.uid}/completions/${dateStr}`;
    const completionRef = doc(db, completionPath);
    const userRef = doc(db, 'users', profile.uid);
    const nestedUserRef = doc(db, 'groups', profile.groupId, 'users', profile.uid);

    try {
      // Fetch all habits and completions for full recalculation BEFORE transaction
      const habitsPath = `groups/${profile.groupId}/users/${profile.uid}/habits`;
      const completionsPath = `groups/${profile.groupId}/users/${profile.uid}/completions`;
      
      const [habitsSnap, completionsSnap] = await Promise.all([
        getDocs(collection(db, habitsPath)),
        getDocs(collection(db, completionsPath))
      ]);

      await runTransaction(db, async (transaction) => {
        const habitSnap = await transaction.get(habitRef);
        const userSnap = await transaction.get(userRef);
        const completionSnap = await transaction.get(completionRef);

        if (!habitSnap.exists() || !userSnap.exists()) return;

        const habitData = habitSnap.data() as Habit;
        const userData = userSnap.data() as UserProfile;
        const allHabits = habitsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Habit));
        const allCompletions = completionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DayCompletion));

        const completionData = completionSnap.exists() 
          ? (completionSnap.data() as DayCompletion) 
          : { date: dateStr, completions: {}, xpEarned: 0 };

        const isAdding = !completionData.completions[habitId];
        const newCompletions = { ...completionData.completions, [habitId]: isAdding };
        
        if (!isAdding) delete newCompletions[habitId];

        // Prepare this day's update
        const xpDelta = isAdding ? habitData.xpValue : -habitData.xpValue;
        const updatedDayCompletions = newCompletions;

        // Recalculate total XP from all logs
        const newTotalXp = Math.max(0, (userData.xp || 0) + xpDelta);
        const newLevel = Math.floor(Math.sqrt(newTotalXp / 100));

        transaction.set(completionRef, {
          ...completionData,
          completions: updatedDayCompletions,
          xpEarned: (completionData.xpEarned || 0) + xpDelta
        });

        // Streak logic
        let newHabitStreak = habitData.currentStreak || 0;
        let lastCompletedDate = habitData.lastCompletedDate;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

        if (dateStr === todayStr) {
          if (isAdding) {
            if (lastCompletedDate === yesterdayStr) {
              newHabitStreak += 1;
            } else if (lastCompletedDate !== todayStr) {
              newHabitStreak = 1;
            }
            lastCompletedDate = todayStr;
          } else {
            newHabitStreak = Math.max(0, newHabitStreak - 1);
            lastCompletedDate = yesterdayStr; 
          }
        }
        const newBestStreak = Math.max(habitData.bestStreak || 0, newHabitStreak);

        const userUpdates = {
          xp: newTotalXp,
          level: newLevel,
          totalCompletions: Math.max(0, (userData.totalCompletions || 0) + (isAdding ? 1 : -1)),
          lastActive: Date.now()
        };

        transaction.update(userRef, userUpdates);
        transaction.update(nestedUserRef, userUpdates);

        transaction.update(habitRef, {
          currentStreak: newHabitStreak,
          bestStreak: newBestStreak,
          lastCompletedDate: lastCompletedDate || ''
        });

        if (isAdding && dateStr === todayStr) {
          setFeedback({ xp: habitData.xpValue, streak: newHabitStreak, habitId });
          setTimeout(() => setFeedback(null), 3000);
        }
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, dateStr);
    }
  };

  // Weekly Consistency Calculation (Count-Based)
  const totalPossibleHabitCompletions = habits.length * 7;
  let completedHabitCount = 0;
  
  Object.values(weekCompletions).forEach((day: DayCompletion) => {
    if (day.completions) {
      habits.forEach(h => {
        if (day.completions[h.id]) {
          completedHabitCount++;
        }
      });
    }
  });

  const weeklyConsistency = totalPossibleHabitCompletions > 0 ? completedHabitCount / totalPossibleHabitCompletions : 0;

  const missedHabitCount = Math.max(0, totalPossibleHabitCompletions - completedHabitCount);

  const performanceChartData = [
    { name: 'Completed', value: completedHabitCount, color: '#3B82F6' },
    { name: 'Missed', value: missedHabitCount, color: 'rgba(255,255,255,0.05)' }
  ].filter(d => d.value > 0 || totalPossibleHabitCompletions === 0);

  const chartData = currentWeekDays.map(d => {
    const ds = format(d, 'yyyy-MM-dd');
    const dayComp = weekCompletions[ds];
    
    let dayCompletedCount = 0;
    if (dayComp && dayComp.completions) {
      habits.forEach(h => {
        if (dayComp.completions[h.id]) {
          dayCompletedCount++;
        }
      });
    }

    return {
      name: format(d, 'EEE'),
      progress: habits.length > 0 ? Math.round((dayCompletedCount / habits.length) * 100) : 0
    };
  });

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
              <span className="text-base sm:text-2xl font-black text-accent italic leading-none">{Math.round(weeklyConsistency * 100)}%</span>
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
          <Leaderboard groupId={profile.groupId} />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 2xl:col-span-3">
          <HabitRegistry 
            habits={habits}
            todayCompletions={weekCompletions[format(new Date(), 'yyyy-MM-dd')]?.completions || {}}
            onAddHabit={handleAddHabit}
            onUpdateHabit={handleUpdateHabit}
            onDeleteHabit={handleDeleteHabit}
            onToggleHabit={(id, e) => handleToggleHabit(id, format(new Date(), 'yyyy-MM-dd'), e)}
          />
        </div>
        <div className="xl:col-span-8 2xl:col-span-9">
          <HabitGrid 
            habits={habits}
            days={weekCompletions}
            onToggleCell={(id, date) => handleToggleHabit(id, date)}
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
