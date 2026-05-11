import { format, subDays, differenceInDays, parseISO, startOfDay } from 'date-fns';
import { Habit, FocusSession } from '../types';

/**
 * Difficulty-based XP Mapping
 */
export const XP_MAP = {
  easy: 10,
  medium: 25,
  hard: 50
};

/**
 * Calculates current streak for a single habit.
 */
export function calculateHabitStreak(habit: Habit, todayDate: Date): number {
  const completionMap = habit.completions || {};
  const todayStr = format(todayDate, 'yyyy-MM-dd');
  
  let streak = 0;
  let checkDate = new Date(todayDate);

  if (!completionMap[todayStr]) {
    // If not completed today, streak is still alive if completed yesterday
    const yesterdayStr = format(subDays(checkDate, 1), 'yyyy-MM-dd');
    if (!completionMap[yesterdayStr]) {
      return 0;
    }
    checkDate = subDays(checkDate, 1);
  }

  while (true) {
    const dateKey = format(checkDate, 'yyyy-MM-dd');
    if (completionMap[dateKey]) {
      streak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculates weekly progress for a habit within the given week cycle.
 */
export function calculateWeeklyProgress(habit: Habit, weekDays: Date[]): number {
  const completionMap = habit.completions || {};
  const weekDateStrs = weekDays.map(d => format(d, 'yyyy-MM-dd'));
  
  let count = 0;
  weekDateStrs.forEach(dateStr => {
    if (completionMap[dateStr]) count++;
  });
  
  return count;
}

/**
 * Calculates consistency for the CURRENT week based on expected vs completed actions.
 * Daily habits: 7 expected/week.
 * Weekly habits: target expected/week.
 * Returns value 0-100.
 */
export function calculateWeeklyConsistency(habits: Habit[], weekDays: Date[]): number {
  if (habits.length === 0) return 0;

  let totalExpected = 0;
  let totalCompleted = 0;

  habits.forEach(habit => {
    if (habit.type === 'daily') {
      totalExpected += 7;
    } else {
      totalExpected += habit.target || 1;
    }
    totalCompleted += calculateWeeklyProgress(habit, weekDays);
  });

  if (totalExpected === 0) return 0;
  
  // Consistency capped at 100% even if they do more than target for weekly in some UI contexts
  // but for raw calculation we follow the formula.
  return Math.min(100, Math.round((totalCompleted / totalExpected) * 100));
}

/**
 * Returns the raw counts for expected vs completed this week.
 * Useful for distribution charts.
 */
export function getWeeklyStats(habits: Habit[], weekDays: Date[]) {
  let totalExpected = 0;
  let totalCompleted = 0;

  habits.forEach(habit => {
    if (habit.type === 'daily') {
      totalExpected += 7;
    } else {
      totalExpected += habit.target || 1;
    }
    totalCompleted += calculateWeeklyProgress(habit, weekDays);
  });

  return { totalExpected, totalCompleted, totalMissed: Math.max(0, totalExpected - totalCompleted) };
}

/**
 * Calculates consistency for a SPECIFIC day.
 * Formula: completed habits today / daily-eligible habits today.
 * Returns value 0-100.
 */
export function calculateDailyConsistency(habits: Habit[], targetDate: Date): number {
  if (habits.length === 0) return 0;

  const dateStr = format(targetDate, 'yyyy-MM-dd');
  let completedCount = 0;
  
  habits.forEach(habit => {
    if (habit.completions && habit.completions[dateStr]) {
      completedCount++;
    }
  });

  return Math.min(100, Math.round((completedCount / habits.length) * 100));
}

/**
 * Calculates consistency for a single habit: completed / expected days (LIFETIME).
 * Keeping this as a legacy helper but primary logic should be Weekly.
 */
export function calculateHabitConsistency(habit: Habit, todayDate: Date): number {
  const startDate = startOfDay(new Date(habit.createdAt));
  const endDate = startOfDay(new Date(todayDate));
  const totalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
  
  const completionMap = habit.completions || {};
  const completedDays = Object.values(completionMap).filter(v => v === true).length;
  
  return Math.min(100, Math.round((completedDays / totalDays) * 100));
}

/**
 * Calculates user's total XP from habits and focus sessions.
 */
export function calculateUserXP(habits: Habit[], focusSessions: FocusSession[]): number {
  let total = 0;

  // Habit XP
  habits.forEach(habit => {
    const completionsCount = Object.values(habit.completions || {}).filter(v => v === true).length;
    const xpPerCompletion = XP_MAP[habit.difficulty] || 10;
    total += completionsCount * xpPerCompletion;
  });

  // Focus Session XP
  focusSessions.forEach(session => {
    if (session.completed) {
      total += (session.duration * 2);
    }
  });

  return total;
}


/**
 * Calculates global streak (at least one habit completed per day).
 */
export function calculateGlobalStreak(habits: Habit[], todayDate: Date): number {
  if (habits.length === 0) return 0;

  // Create a combined map of all completions
  const globalCompletionMap: Record<string, boolean> = {};
  habits.forEach(habit => {
    Object.entries(habit.completions || {}).forEach(([date, completed]) => {
      if (completed) globalCompletionMap[date] = true;
    });
  });

  const todayStr = format(todayDate, 'yyyy-MM-dd');
  let streak = 0;
  let checkDate = new Date(todayDate);

  if (!globalCompletionMap[todayStr]) {
    const yesterdayStr = format(subDays(checkDate, 1), 'yyyy-MM-dd');
    if (!globalCompletionMap[yesterdayStr]) return 0;
    checkDate = subDays(checkDate, 1);
  }

  while (true) {
    const dateKey = format(checkDate, 'yyyy-MM-dd');
    if (globalCompletionMap[dateKey]) {
      streak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  return streak;
}
