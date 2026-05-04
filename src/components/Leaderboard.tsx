import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, DayCompletion } from '../types';
import { Trophy, Crown, Zap, Flame, Shield, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getWeekId, getDaysOfWeek } from '../lib/utils';
import Avatar from './Avatar';
import { format } from 'date-fns';

interface LeaderboardProps {
  groupId: string;
}

interface LeaderboardEntry extends UserProfile {
  weeklyConsistency: number;
}

export default function Leaderboard({ groupId }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const currentWeekDays = getDaysOfWeek(new Date());

  useEffect(() => {
    // We still use root users for finding who belongs to the group, 
    // OR we can use the nested users collection in the group.
    // Given the request, it's safer to use the nested one if we are moving everything there.
    const groupUsersCollection = collection(db, 'groups', groupId, 'users');
    
    const unsubscribeUsers = onSnapshot(groupUsersCollection, (userSnap) => {
      const users = userSnap.docs.map(doc => doc.data() as UserProfile);
      
      const entryPromises = users.map(async (user) => {
        const completionsPath = `groups/${groupId}/users/${user.uid}/completions`;
        const completionsSnap = await getDocs(collection(db, completionsPath));
        
        const weekDateStrs = currentWeekDays.map(d => format(d, 'yyyy-MM-dd'));
        const weekCompletions = completionsSnap.docs
          .filter(d => weekDateStrs.includes(d.id))
          .map(d => d.data() as DayCompletion);

        // Consistency = days with at least one completion / 7
        const activeDays = weekCompletions.filter(d => d.completions && Object.keys(d.completions).length > 0).length;
        const consistency = activeDays / 7;

        return {
          ...user,
          xp: user.xp || 0,
          globalStreak: user.globalStreak || 0,
          level: user.level || 0,
          weeklyConsistency: consistency * 100
        } as LeaderboardEntry;
      });

      Promise.all(entryPromises).then(results => {
        // Rank by XP primarily, then consistency, then streak
        const sorted = results.sort((a, b) => 
          (b.xp || 0) - (a.xp || 0) || 
          (b.weeklyConsistency || 0) - (a.weeklyConsistency || 0) || 
          (b.globalStreak || 0) - (a.globalStreak || 0)
        );
        setEntries(sorted);
        setLoading(false);
      });
    });

    return () => unsubscribeUsers();
  }, [groupId]);

  if (loading && entries.length === 0) return (
    <div className="bg-bg-card rounded-xl border border-border-main p-8 flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-3 animate-pulse opacity-50">
        <Shield className="w-8 h-8 text-text-dim" />
        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Calibrating Matrix...</span>
      </div>
    </div>
  );

  const topThree = entries.slice(0, 3);
  const others = entries.slice(3);

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
                  
                  <div className="flex items-center gap-5">
                    <div className="relative shrink-0">
                      <Avatar 
                        avatar={entry.avatar}
                        name={entry.displayName}
                        size={isRank1 ? 'xl' : 'lg'}
                        showStatus
                        isOnline={isOnline}
                        className="transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className={cn(
                        "absolute -bottom-2 -left-2 w-8 h-8 rounded-xl border-4 border-bg-card flex items-center justify-center text-xs font-black italic shadow-xl",
                        isRank1 ? "bg-accent text-white" : "bg-white/10 text-white/50"
                      )}>
                        {rank}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-black tracking-tighter truncate italic uppercase text-white mb-0.5">
                        {entry.displayName}
                      </h4>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-accent uppercase tracking-widest">{(entry.xp || 0).toLocaleString()} XP</span>
                        <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-orange-500/10 rounded-md border border-orange-500/20">
                          <Flame className="w-3 h-3 text-orange-500 fill-current" />
                          <span className="text-[9px] font-black text-orange-500 italic">{entry.globalStreak || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black text-white/80 italic leading-none">{Math.round(entry.weeklyConsistency)}%</div>
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
                <div key={entry.uid} className="flex items-center gap-4 p-4 bg-white/[0.01] border border-white/5 rounded-2xl hover:bg-white/[0.03] transition-all">
                  <span className="w-4 text-[10px] font-black text-text-dim/10 italic">{rank}</span>
                  <Avatar avatar={entry.avatar} name={entry.displayName} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-black text-white/80 uppercase italic truncate">{entry.displayName}</span>
                      <span className="text-[10px] font-black text-accent">{(entry.xp || 0).toLocaleString()} XP</span>
                    </div>
                    <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent/30 rounded-full" 
                        style={{ width: `${entry.weeklyConsistency}%` }}
                      />
                    </div>
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

