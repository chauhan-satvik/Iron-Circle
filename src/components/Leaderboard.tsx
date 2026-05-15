import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  doc,
  getDoc,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, Habit, Group, FocusSession } from '../types';
import { Trophy, Crown, Zap, Flame, Shield, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getDaysOfWeek } from '../lib/utils';
import Avatar from './Avatar';
import { format, startOfDay } from 'date-fns';

import { calculateUserXP, calculateWeeklyConsistency, calculateGlobalStreak } from '../lib/habitEngine';

interface LeaderboardProps {
  groupId: string;
  today: Date;
}

interface UserState {
  profile: UserProfile;
  habits: Habit[];
  focusSessions: FocusSession[];
}

export default function Leaderboard({ groupId, today }: LeaderboardProps) {
  const [userStates, setUserStates] = useState<Record<string, UserState>>({});
  const [loading, setLoading] = useState(true);
  const currentWeekDays = useMemo(() => getDaysOfWeek(today), [today]);
  const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  useEffect(() => {
    setLoading(true);
    const usersRef = collection(db, 'groups', groupId, 'users');
    const unsubMap: Record<string, () => void> = {};

    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const profile = change.doc.data() as UserProfile;
        const uid = profile?.uid || change.doc.id;

        if (!uid) return;

        if (change.type === 'added') {
          // Initialize state
          setUserStates(prev => ({
            ...prev,
            [uid]: { profile: { ...profile, uid }, habits: [], focusSessions: [] }
          }));

          // Set up habits listener
          const habitsRef = collection(db, 'groups', groupId, 'users', uid, 'habits');
          const habitsUnsub = onSnapshot(habitsRef, (s) => {
            const habits = s.docs.map(d => ({ id: d.id, ...d.data() } as Habit));
            setUserStates(prev => {
              if (!prev[uid]) return prev;
              return {
                ...prev,
                [uid]: { ...prev[uid], habits }
              };
            });
          }, (error) => console.error("Leaderboard habits error:", error));
          unsubMap[`${uid}_habits`] = habitsUnsub;

          // Set up focus sessions listener
          const focusRef = collection(db, 'groups', groupId, 'users', uid, 'focusSessions');
          // Important: Query only non-offline sessions to avoid permission errors and preserve privacy
          const focusQuery = query(focusRef, where('source', '!=', 'offline'));
          const focusUnsub = onSnapshot(focusQuery, (s) => {
            const focusSessions = s.docs.map(d => ({ id: d.id, ...d.data() } as FocusSession));
            setUserStates(prev => {
              if (!prev[uid]) return prev;
              return {
                ...prev,
                [uid]: { ...prev[uid], focusSessions }
              };
            });
          }, (error) => console.error("Leaderboard focus error:", error));
          unsubMap[`${uid}_focus`] = focusUnsub;
        }

        if (change.type === 'modified' && profile) {
          setUserStates(prev => {
            if (!prev[uid]) return prev;
            return {
              ...prev,
              [uid]: { ...prev[uid], profile: { ...profile, uid } }
            };
          });
        }

        if (change.type === 'removed') {
          if (unsubMap[`${uid}_habits`]) {
            unsubMap[`${uid}_habits`]();
            delete unsubMap[`${uid}_habits`];
          }
          if (unsubMap[`${uid}_focus`]) {
            unsubMap[`${uid}_focus`]();
            delete unsubMap[`${uid}_focus`];
          }
          setUserStates(prev => {
            const next = { ...prev };
            delete next[uid];
            return next;
          });
        }
      });
      
      setLoading(false);
    });

    return () => {
      unsubscribeUsers();
      Object.values(unsubMap).forEach(unsub => unsub());
    };
  }, [groupId]);

  const sortedEntries = useMemo(() => {
    return (Object.entries(userStates) as [string, UserState][])
      .map(([uid, state]) => {
        if (!state || !state.profile) return null;
        
        // Calculate dynamic values for each user
        const habits = state.habits || [];
        const focusSessions = state.focusSessions || [];
        
        const weeklyConsistency = calculateWeeklyConsistency(habits, currentWeekDays);

        return {
          ...state.profile,
          uid: state.profile.uid || uid,
          calculatedXp: calculateUserXP(habits, focusSessions),
          consistency: weeklyConsistency,
          calculatedStreak: calculateGlobalStreak(habits, today)
        };
      })
      .filter((entry): entry is any => entry !== null)
      .sort((a, b) => (b.calculatedXp || 0) - (a.calculatedXp || 0) || (b.consistency || 0) - (a.consistency || 0));
  }, [userStates, today]);


  if (loading && sortedEntries.length === 0) return (
    <div className="bg-bg-card rounded-xl border border-border-main p-8 flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-3 animate-pulse opacity-50">
        <Shield className="w-8 h-8 text-text-dim" />
        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Calibrating Matrix...</span>
      </div>
    </div>
  );

  const topThree = sortedEntries.slice(0, 3);
  const others = sortedEntries.slice(3);

  return (
    <div className="w-full bg-bg-card rounded-[2.5rem] border border-border-main flex flex-col shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-24 bg-accent/10 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none" />
      
      <div className="p-6 sm:p-8 border-b border-white/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-accent drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
            <div>
              <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Hall of Valor</h3>
              <p className="text-[9px] text-text-dim/40 uppercase tracking-[0.3em] font-black">Tactical Consistency Ranks</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] rounded-2xl border border-white/5 backdrop-blur-md">
            <Zap className="w-3.5 h-3.5 text-accent animate-pulse fill-accent" />
            <span className="text-[10px] font-black text-accent uppercase tracking-widest leading-none">Live</span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-6">
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {topThree.map((entry, index) => {
              const rank = index + 1;
              const isRank1 = rank === 1;
              const isOnline = Date.now() - (entry.lastActive || 0) < 300000;

              return (
                <motion.div
                  key={entry.uid}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "relative group rounded-[2rem] border transition-all duration-700 p-5",
                    isRank1 
                      ? "bg-accent/[0.08] border-accent/40 shadow-[0_20px_50px_rgba(59,130,246,0.15)] shadow-accent/5" 
                      : "bg-white/[0.02] border-white/5 hover:border-accent/30"
                  )}
                >
                  {isRank1 && (
                    <div className="absolute -top-4 -right-2 z-10 rotate-12">
                      <Crown className="w-10 h-10 text-accent fill-accent/20 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center sm:items-center gap-5">
                    <div className="relative shrink-0">
                      <Avatar 
                        avatar={entry.avatar}
                        name={entry.displayName || entry.name}
                        size={isRank1 ? 'xl' : 'lg'}
                        showStatus
                        isOnline={isOnline}
                        mood={entry.mood}
                        className="transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className={cn(
                        "absolute -bottom-2 -left-2 w-8 h-8 rounded-xl border-4 border-bg-card flex items-center justify-center text-xs font-black italic shadow-xl",
                        isRank1 ? "bg-accent text-white" : "bg-white/10 text-white/50"
                      )}>
                        {rank}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                      <h4 className="text-lg font-black tracking-tighter truncate italic uppercase text-white mb-0.5">
                        {entry.displayName || entry.name || 'Unknown Operator'}
                      </h4>
                      <div className="flex items-center justify-center sm:justify-start gap-3">
                        <span className="text-[10px] font-black text-accent uppercase tracking-widest">{entry.calculatedXp.toLocaleString()} XP</span>
                        <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-orange-500/10 rounded-md border border-orange-500/20">
                          <Flame className="w-3 h-3 text-orange-500 fill-current" />
                          <span className="text-[9px] font-black text-orange-500 italic">{entry.calculatedStreak || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center sm:items-end w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-0 border-white/5">
                      <div className="text-2xl font-black text-white/80 italic leading-none">{Math.round(entry.consistency)}%</div>
                      <div className="text-[8px] font-black text-text-dim/20 uppercase tracking-widest mt-1">CONSISTENCY</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {others.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 px-2 mb-4">
              <div className="h-px flex-1 bg-white/[0.05]" />
              <div className="text-[9px] font-black text-text-dim/20 uppercase tracking-[0.4em]">The Sentinels</div>
              <div className="h-px flex-1 bg-white/[0.05]" />
            </div>
            
            {others.map((entry, index) => {
              const rank = index + 4;
              return (
                <div key={entry.uid} className="relative group flex flex-col sm:flex-row items-center gap-4 p-4 bg-white/[0.01] border border-white/5 rounded-2xl hover:bg-white/[0.03] transition-all">
                  <div className="flex items-center w-full sm:w-auto gap-4">
                    <span className="w-4 text-[10px] font-black text-text-dim/10 italic shrink-0">{rank}</span>
                    <Avatar avatar={entry.avatar} name={entry.displayName || entry.name} mood={entry.mood} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between sm:justify-start sm:gap-4">
                        <span className="text-sm font-black text-white/80 uppercase italic truncate">{entry.displayName || entry.name || 'Unknown'}</span>
                        <span className="text-[10px] font-black text-accent">{entry.calculatedXp.toLocaleString()} XP</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between w-full sm:w-1/3 sm:ml-auto gap-4">
                    <div className="flex-1 h-1 bg-white/[0.03] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent/30 rounded-full" 
                        style={{ width: `${entry.consistency}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-text-dim/40 w-8 text-right">{Math.round(entry.consistency)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

