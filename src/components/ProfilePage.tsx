import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  doc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, Habit, FocusSession } from '../types';
import { 
  Shield, 
  Zap, 
  Flame, 
  Timer, 
  Trophy, 
  Target, 
  Calendar, 
  ArrowLeft,
  Edit3,
  Github,
  Instagram,
  Twitter,
  Globe,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getDaysOfWeek } from '../lib/utils';
import Avatar from './Avatar';
import { format, subDays, startOfDay } from 'date-fns';
import { calculateUserXP, calculateWeeklyConsistency, calculateGlobalStreak } from '../lib/habitEngine';
import ProfileEditModal from './ProfileEditModal';

export default function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const currentWeekDays = useMemo(() => getDaysOfWeek(today), [today]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    // We first need to find which group this user is in if we don't know it.
    // However, for simplicity in this app, we assume we either have the group or can find it.
    // Let's first try to find the user in the global users collection if it exists,
    // or assume they are in the same group as the current user for now if we can't find them elsewhere.
    // BUT we have a groupId in the current user's profile.
    
    const fetchFullProfile = async () => {
      try {
        // First get the user's group ID. We might need a root user doc or a way to discover groups.
        // For this app, let's assume all users of interest are in 'community' or the current user's group.
        let groupId = 'community';
        
        // Try to fetch from root users first to get their profile and groupId
        const rootUserRef = doc(db, 'users', uid);
        const rootUserSnap = await getDoc(rootUserRef);
        
        if (rootUserSnap.exists()) {
          const data = rootUserSnap.data() as UserProfile;
          groupId = data.groupId || 'community';
          setProfile({ ...data, uid });
        } else {
          // If not in root, maybe they are just in the group
          // We'd need to search groups, which is expensive.
          // Let's assume we can fetch from the group context.
          // Actually, in our current setup, Auth.tsx stores current user's profile which has groupId.
          // For now, let's look in all groups the current user is aware of? 
          // Re-using the logic from Leaderboard where we know the groupId.
        }

        // Once we have a possible groupId, set up listeners
        const groupUserRef = doc(db, 'groups', groupId, 'users', uid);
        const unsubscribeProfile = onSnapshot(groupUserRef, (doc) => {
          if (doc.exists()) {
            setProfile({ ...(doc.data() as UserProfile), uid });
          }
        });

        const habitsRef = collection(db, 'groups', groupId, 'users', uid, 'habits');
        const unsubscribeHabits = onSnapshot(habitsRef, (s) => {
          setHabits(s.docs.map(d => ({ id: d.id, ...d.data() } as Habit)));
        });

        const focusRef = collection(db, 'groups', groupId, 'users', uid, 'focusSessions');
        const focusQuery = query(focusRef, where('source', '!=', 'offline'));
        const unsubscribeFocus = onSnapshot(focusQuery, (s) => {
          setFocusSessions(s.docs.map(d => ({ id: d.id, ...d.data() } as FocusSession)));
          setLoading(false);
        });

        return () => {
          unsubscribeProfile();
          unsubscribeHabits();
          unsubscribeFocus();
        };
      } catch (error) {
        console.error("Error fetching profile:", error);
        setLoading(false);
      }
    };

    fetchFullProfile();
  }, [uid]);

  const stats = useMemo(() => {
    if (!profile) return null;
    const xp = calculateUserXP(habits, focusSessions);
    const level = Math.floor(Math.sqrt(xp / 100));
    const streak = calculateGlobalStreak(habits, today);
    const consistency = calculateWeeklyConsistency(habits, currentWeekDays);
    const totalFocusMinutes = focusSessions.reduce((acc, s) => acc + (s.completed ? s.duration : 0), 0);
    const totalCompletions = habits.reduce((acc, h) => acc + Object.values(h.completions || {}).filter(v => v).length, 0);

    return { xp, level, streak, consistency, totalFocusMinutes, totalCompletions };
  }, [profile, habits, focusSessions, today, currentWeekDays]);

  const isOwnProfile = auth.currentUser?.uid === uid;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Shield className="w-12 h-12 text-accent" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-text-dim">Retrieving Dossier...</span>
        </div>
      </div>
    );
  }

  if (!profile || !stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <Shield className="w-16 h-16 text-red-500/20 mb-6" />
        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white mb-4">Subject Not Found</h1>
        <p className="text-text-dim max-w-md mb-8 uppercase text-xs font-bold tracking-widest leading-relaxed">
          The requested identity does not exist within the active Iron Circle grid or has been purged from the records.
        </p>
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-white font-black uppercase tracking-widest transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Grid
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-32">
      {/* Header Navigation */}
      <div className="flex items-center justify-between mb-12">
        <button 
          onClick={() => navigate(-1)}
          className="group flex items-center gap-3 px-6 py-3 bg-white/[0.02] hover:bg-white/10 rounded-2xl border border-white/5 text-text-dim hover:text-white transition-all overflow-hidden"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Back to Sector</span>
        </button>

        {isOwnProfile && (
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="group flex items-center gap-3 px-6 py-3 bg-accent/10 hover:bg-accent border border-accent/20 text-accent hover:text-white rounded-2xl transition-all shadow-lg active:scale-95"
          >
            <Edit3 className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Modify Protocol</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Core Identity */}
        <div className="lg:col-span-5 space-y-12">
          <div className="relative">
            {/* Profile Card */}
            <div className="glass-card rounded-[3.5rem] p-10 sm:p-12 border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[80px] rounded-full -mr-32 -mt-32 transition-colors group-hover:bg-accent/10" />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative mb-8">
                  <Avatar 
                    avatar={profile.avatar}
                    name={profile.displayName}
                    size="2xl"
                    mood={profile.mood}
                    className="ring-4 ring-white/5 group-hover:ring-accent/40 transition-all duration-700"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-accent shadow-2xl p-2 rounded-2xl border-4 border-bg-card">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="text-center mb-10">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-[10px] font-black text-text-dim/60 uppercase tracking-[0.4em] leading-none">
                      @{profile.username || 'anon'}
                    </span>
                    <div className="w-1 h-1 rounded-full bg-accent/40" />
                    <span className="text-[10px] font-black text-accent uppercase tracking-[0.4em] leading-none">
                      LVL {stats.level}
                    </span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter text-white">
                    {profile.displayName || 'Unnamed Operator'}
                  </h1>
                </div>

                {profile.bio && (
                  <div className="w-full bg-white/[0.03] border border-white/5 rounded-3xl p-6 mb-8 text-center sm:text-left">
                    <p className="text-sm font-medium leading-relaxed text-text-dim/80 italic">
                      "{profile.bio}"
                    </p>
                  </div>
                )}

                {/* Social Links Bar */}
                <div className="flex items-center gap-4">
                  {profile.github && (
                    <SocialLink href={`https://github.com/${profile.github}`} icon={<Github className="w-5 h-5" />} color="hover:text-white" />
                  )}
                  {profile.twitter && (
                    <SocialLink href={`https://twitter.com/${profile.twitter}`} icon={<Twitter className="w-5 h-5" />} color="hover:text-sky-400" />
                  )}
                  {profile.instagram && (
                    <SocialLink href={`https://instagram.com/${profile.instagram}`} icon={<Instagram className="w-5 h-5" />} color="hover:text-pink-500" />
                  )}
                  {profile.discord && (
                    <div className="p-3 bg-white/5 rounded-2xl text-text-dim hover:text-indigo-400 transition-all cursor-default" title={profile.discord}>
                      <MessageSquare className="w-5 h-5" />
                    </div>
                  )}
                  {profile.website && (
                    <SocialLink href={profile.website} icon={<Globe className="w-5 h-5" />} color="hover:text-emerald-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Tactical Stats Footer Grid */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-6 flex flex-col items-center justify-center gap-2 group transition-all hover:bg-orange-500/10 active:scale-95">
                <Flame className="w-6 h-6 text-orange-500 animate-pulse fill-orange-500/20" />
                <span className="text-2xl font-black italic text-orange-500 leading-none">{stats.streak}</span>
                <span className="text-[8px] font-black text-orange-500/60 uppercase tracking-widest leading-none">DAY STREAK</span>
              </div>
              <div className="bg-accent/5 border border-accent/10 rounded-3xl p-6 flex flex-col items-center justify-center gap-2 group transition-all hover:bg-accent/10 active:scale-95">
                <Zap className="w-6 h-6 text-accent animate-pulse fill-accent/20" />
                <span className="text-2xl font-black italic text-accent leading-none">{stats.xp.toLocaleString()}</span>
                <span className="text-[8px] font-black text-accent/60 uppercase tracking-widest leading-none">TOTAL XP</span>
              </div>
            </div>
          </div>

          {/* Placeholder for Future Features: Achievements & Badges */}
          <div className="glass-card rounded-[3rem] p-8 border-white/5 opacity-50 relative overflow-hidden grayscale group hover:grayscale-0 transition-all duration-700">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                   <Award className="w-5 h-5 text-accent" />
                   <h4 className="text-sm font-black uppercase tracking-widest text-white">Honor Medals</h4>
                </div>
                <div className="text-[8px] font-black px-3 py-1 bg-white/5 rounded-full text-text-dim uppercase tracking-widest">Locked</div>
             </div>
             <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="aspect-square bg-white/[0.05] rounded-2xl flex items-center justify-center border border-dashed border-white/10 group-hover:border-accent/40 transition-colors">
                    <Shield className="w-6 h-6 text-white/5 group-hover:text-accent/20 transition-colors" />
                  </div>
                ))}
             </div>
             <p className="mt-6 text-[9px] font-bold text-text-dim/60 uppercase tracking-widest text-center italic">
               Establishing neural link for achievement verification...
             </p>
          </div>
        </div>

        {/* Right Column: Tactical Intelligence */}
        <div className="lg:col-span-7 space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <StatDetailCard 
              icon={<Target className="w-6 h-6 text-accent" />}
              label="Weekly Consistency"
              value={`${Math.round(stats.consistency)}%`}
              color="text-accent"
              subValue={`${Math.ceil((stats.consistency/100) * 7)}/7 Days`}
            />
            <StatDetailCard 
              icon={<Timer className="w-6 h-6 text-emerald-400" />}
              label="Deep Work Output"
              value={`${Math.floor(stats.totalFocusMinutes / 60)}h ${stats.totalFocusMinutes % 60}m`}
              color="text-emerald-400"
              subValue={`${focusSessions.length} Successful Cycles`}
            />
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-accent" />
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white leading-none">Routine Persistence</h3>
              </div>
              <span className="text-[9px] font-black text-text-dim/40 uppercase tracking-widest">{habits.length} Active Protocols</span>
            </div>

            <div className="space-y-4">
              {habits.length > 0 ? habits.map(habit => (
                <div key={habit.id} className="glass-card rounded-3xl p-6 border-white/5 flex items-center justify-between group hover:bg-white/[0.02] transition-colors relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-1 bg-accent/20 rounded-full" />
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-black text-white italic uppercase tracking-tight">{habit.name}</span>
                      <span className={cn(
                        "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                        habit.difficulty === 'hard' ? "bg-red-500/10 text-red-500" :
                        habit.difficulty === 'medium' ? "bg-orange-500/10 text-orange-500" :
                        "bg-emerald-500/10 text-emerald-500"
                      )}>
                        {habit.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-text-dim/40 uppercase tracking-widest">{habit.xpValue} XP Per Run</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-white italic leading-none">
                      {Object.values(habit.completions || {}).filter(v => v).length}
                    </div>
                    <div className="text-[8px] font-black text-text-dim/20 uppercase tracking-widest mt-1">TOTAL HITS</div>
                  </div>
                </div>
              )) : (
                <div className="py-12 bg-white/[0.02] border border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                  <Shield className="w-8 h-8 text-text-dim/20 mb-4" />
                  <p className="text-[10px] font-black text-text-dim/40 uppercase tracking-widest italic">Identity has no active habit protocols</p>
                </div>
              )}
            </div>
          </div>

          {/* Placeholder for Titles, Banners, Cosmetics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
             <div className="glass-card rounded-[2.5rem] p-8 border-white/5 opacity-50 pointer-events-none relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-6">
                   <Shield className="w-4 h-4 text-accent" />
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Callsigns</h4>
                </div>
                <div className="space-y-3">
                   <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
                   <div className="h-10 bg-white/5 rounded-xl opacity-50" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-bg-main/40 backdrop-blur-[2px]">
                   <span className="text-[8px] font-black text-white uppercase tracking-[0.5em] italic">Vanguard Rewards Only</span>
                </div>
             </div>

             <div className="glass-card rounded-[2.5rem] p-8 border-white/5 opacity-50 pointer-events-none relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-6">
                   <Zap className="w-4 h-4 text-accent" />
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Neural Skins</h4>
                </div>
                <div className="flex gap-3">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="w-full aspect-square bg-white/5 rounded-2xl animate-pulse" />
                   ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-bg-main/40 backdrop-blur-[2px]">
                   <span className="text-[8px] font-black text-white uppercase tracking-[0.5em] italic">Elite Cosmetics Coming</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      <ProfileEditModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
      />
    </div>
  );
}

function StatDetailCard({ icon, label, value, color, subValue }: { icon: React.ReactNode, label: string, value: string, color: string, subValue: string }) {
  return (
    <div className="glass-card rounded-[2.5rem] p-8 border-white/5 relative overflow-hidden group transition-all hover:bg-white/[0.02]">
      <div className="absolute -top-4 -right-4 p-8 bg-white/5 blur-2xl rounded-full transition-all group-hover:scale-150" />
      <div className="relative z-10">
        <div className="mb-6">{icon}</div>
        <div className="text-3xl font-black italic tracking-tighter text-white mb-2">{value}</div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-text-dim/60 leading-tight">{label}</span>
          <span className={cn("text-[9px] font-black uppercase tracking-widest opacity-80", color)}>{subValue}</span>
        </div>
      </div>
    </div>
  );
}

function SocialLink({ href, icon, color }: { href: string, icon: React.ReactNode, color: string }) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className={cn(
        "p-3 bg-white/5 rounded-2xl text-text-dim transition-all active:scale-95 hover:bg-white/10 hover:shadow-xl",
        color
      )}
    >
      {icon}
    </a>
  );
}
