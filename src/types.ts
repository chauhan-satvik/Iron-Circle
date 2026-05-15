export type HabitDifficulty = 'easy' | 'medium' | 'hard';
export type HabitType = 'daily' | 'weekly';

export interface Habit {
  id: string;
  name: string;
  difficulty: HabitDifficulty;
  type: HabitType;
  target: number; // For weekly, target days per week
  xpValue: number;
  createdAt: number;
  completions: Record<string, boolean>; // key is YYYY-MM-DD
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
    type: 'initials' | 'emoji' | 'image' | 'selection';
    value: string;
    color: string;
  };
  bio?: string;
  status?: string;
  mood?: string;
  github?: string;
  instagram?: string;
  twitter?: string;
  website?: string;
  discord?: string;
  lastActive: number;
  groupId: string;
  defaultFocusDuration?: number;
  defaultBreakDuration?: number;
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

export interface FocusSession {
  id: string;
  userId: string;
  duration: number; // minutes
  date: string; // YYYY-MM-DD
  completed: boolean;
  source?: 'timer' | 'offline';
  rewardEligible?: boolean;
  subject?: string;
  notes?: string;
  createdAt: number;
}
