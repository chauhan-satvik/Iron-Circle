export type HabitDifficulty = 'easy' | 'medium' | 'hard';
export type HabitType = 'daily' | 'weekly';

export interface Habit {
  id: string;
  name: string;
  difficulty: HabitDifficulty;
  type: HabitType;
  target: number; // For weekly, target days per week
  xpValue: number;
  currentStreak: number;
  bestStreak: number;
  createdAt: number;
  lastCompletedDate?: string;
}

export interface DayCompletion {
  id?: string;
  date: string; // ISO string YYYY-MM-DD
  completions: Record<string, boolean>; // habitId -> boolean
  xpEarned: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  avatar: {
    type: 'initials' | 'emoji' | 'image';
    value: string;
    color: string;
  };
  xp: number;
  level: number;
  globalStreak: number;
  totalCompletions: number;
  lastActive: number;
  groupId: string;
  createdAt: number;
}

export interface WeeklyStats {
  userId: string;
  displayName: string;
  username?: string;
  avatar?: UserProfile['avatar'];
  days: Record<string, DayCompletion>; // key is YYYY-MM-DD
  weeklyProgress: number;
  totalXp: number;
}

export interface Group {
  id: string;
  name: string;
  members: string[];
}
