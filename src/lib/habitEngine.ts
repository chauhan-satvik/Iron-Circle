import { format, subDays, differenceInDays, parseISO, isSameDay } from 'date-fns';
import { Habit, DayCompletion, FocusSession } from '../types';

/**
 * Calculates current streak for a daily habit.
 */
export function calculateHabitStreak(habitId: string, history: DayCompletion[], todayDate: Date): number {
  if (history.length === 0) return 0;

  const todayStr = format(todayDate, 'yyyy-MM-dd');
  const completionMap: Record<string, boolean> = {};
  history.forEach(day => {
    if (day.completions && day.completions[habitId]) {
      completionMap[day.date] = true;
    }
  });

  let streak = 0;
  let checkDate = new Date(todayDate);

  const todayCompleted = completionMap[todayStr];
  
  if (!todayCompleted) {
    // If not completed today, streak is either broken or we are still checking yesterday
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
 * Calculates how many times a habit was completed in the current week (Sunday-Saturday).
 */
export function calculateWeeklyProgress(habitId: string, history: DayCompletion[], weekDays: Date[]): number {
  const weekDateStrs = weekDays.map(d => format(d, 'yyyy-MM-dd'));
  let count = 0;
  
  history.forEach(day => {
    if (weekDateStrs.includes(day.date) && day.completions && day.completions[habitId]) {
      count++;
    }
  });
  
  return count;
}

/**
 * Calculates consistency: total completions / days since habit created.
 */
export function calculateConsistency(habitId: string, history: DayCompletion[], createdAt: number, todayStr: string): number {
  const startDate = new Date(createdAt);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = parseISO(todayStr);
  const totalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
  
  let completedDays = 0;
  history.forEach(day => {
    if (day.completions && day.completions[habitId]) {
      completedDays++;
    }
  });
  
  return Math.min(100, Math.round((completedDays / totalDays) * 100));
}

/**
 * Calculates global streak: consecutive days where at least one habit was completed.
 */
export function calculateGlobalStreak(history: DayCompletion[], todayDate: Date): number {
  if (history.length === 0) return 0;

  const todayStr = format(todayDate, 'yyyy-MM-dd');
  const completionMap: Record<string, boolean> = {};
  history.forEach(day => {
    const hasAnyCompletion = day.completions && Object.values(day.completions).some(v => v === true);
    if (hasAnyCompletion) {
      completionMap[day.date] = true;
    }
  });

  let streak = 0;
  let checkDate = new Date(todayDate);

  if (!completionMap[todayStr]) {
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
 * Calculates total XP based on all historic data.
 */
export function calculateUserXP(habits: Habit[], history: DayCompletion[], focusSessions: FocusSession[]): number {
  let total = 0;

  // Habit XP
  history.forEach(day => {
    if (day.completions) {
      Object.entries(day.completions).forEach(([habitId, completed]) => {
        if (completed) {
          const habit = habits.find(h => h.id === habitId);
          // Use difficulty-based XP if habit found, else fallback to 10
          if (habit) {
            total += (habit.xpValue || 10);
          } else {
            total += 10;
          }
        }
      });
    }
  });

  // Focus Session XP
  focusSessions.forEach(session => {
    if (session.completed) {
      total += (session.duration * 2);
    }
  });

  return total;
}
