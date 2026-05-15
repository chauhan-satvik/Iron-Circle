import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User,
  reauthenticateWithPopup,
  deleteUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  collection, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  runTransaction
} from 'firebase/firestore';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { UserProfile, Group, Habit, FocusSession } from '../types';
import { format, isSameDay } from 'date-fns';
import WeeklyDashboard from './WeeklyDashboard';
import FocusTimer from './FocusTimer';
import Avatar from './Avatar';
import ProfilePanel from './ProfilePanel';
import HelpTour from './HelpTour';
import AdminLogin from './admin/AdminLogin';
import AdminPanel from './admin/AdminPanel';
import { SystemInfo } from './SystemInfo';
import ProfilePage from './ProfilePage';
import { calculateUserXP, calculateGlobalStreak } from '../lib/habitEngine';
import { LogIn, LogOut, Shield, Trash2, X, AlertTriangle, User as UserIcon, Hash, Palette, Flame, LayoutDashboard, Timer, Clock, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center p-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <Link 
        to="/"
        className={cn(
          "flex items-center gap-2 px-6 py-3 rounded-[1.5rem] transition-all duration-300",
          location.pathname === '/' ? "bg-accent text-white shadow-lg" : "text-text-dim hover:text-white"
        )}
      >
        <LayoutDashboard className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Tactical Grid</span>
      </Link>
      <div className="w-px h-4 bg-white/10 mx-2" />
      <Link 
        to="/focus"
        className={cn(
          "flex items-center gap-2 px-6 py-3 rounded-[1.5rem] transition-all duration-300",
          location.pathname === '/focus' ? "bg-accent text-white shadow-lg" : "text-text-dim hover:text-white"
        )}
      >
        <Timer className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Focus Chamber</span>
      </Link>
    </nav>
  );
}

export default function AuthWrapper() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempUsername, setTempUsername] = useState('');
  const [tempMood, setTempMood] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [today, setToday] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setToday(prev => {
        if (!isSameDay(now, prev)) {
          return now;
        }
        return prev;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkAdminSession = () => {
      const isAdmin = localStorage.getItem('iron_admin') === 'true';
      const expiry = localStorage.getItem('iron_admin_expiry');
      if (isAdmin && expiry && Date.now() > parseInt(expiry)) {
        localStorage.removeItem('iron_admin');
        localStorage.removeItem('iron_admin_expiry');
        // If we are on an admin route, the component themselves handle the redirect
      }
    };
    checkAdminSession();
    const interval = setInterval(checkAdminSession, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setHabits([]);
        setFocusSessions([]);
        setShowNameModal(false);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    let unsubProfile: (() => void) | undefined;
    let unsubHabits: (() => void) | undefined;
    let unsubFocus: (() => void) | undefined;

    const setupListeners = async () => {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      let groupId = 'default-circle';

      if (userSnap.exists()) {
        const profileData = userSnap.data() as UserProfile;
        setProfile(profileData);
        groupId = profileData.groupId || 'default-circle';
        
        if (!profileData.displayName || profileData.displayName === 'Anon' || !profileData.username) {
          setShowNameModal(true);
          setTempName(profileData.displayName || '');
          setTempUsername(profileData.username || '');
          setSelectedColor(profileData.avatar?.color || '#3B82F6');
        }

        const nestedUserRef = doc(db, 'groups', groupId, 'users', user.uid);
        await setDoc(userRef, { lastActive: Date.now() }, { merge: true });
        await setDoc(nestedUserRef, { lastActive: Date.now() }, { merge: true });
      } else {
        setShowNameModal(true);
      }

      unsubProfile = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
          if (data.displayName && data.displayName !== 'Anon' && data.username) {
            setShowNameModal(false);
          }
        }
      });

      const habitsRef = collection(db, 'groups', groupId, 'users', user.uid, 'habits');
      unsubHabits = onSnapshot(habitsRef, (snap) => {
        setHabits(snap.docs.map(d => ({ ...d.data(), id: d.id } as Habit)));
      });

      const focusRef = collection(db, 'groups', groupId, 'users', user.uid, 'focusSessions');
      unsubFocus = onSnapshot(focusRef, (snap) => {
        setFocusSessions(snap.docs.map(d => ({ ...d.data(), id: d.id } as FocusSession)));
      });

      setLoading(false);
    };

    setupListeners();

    return () => {
      unsubProfile?.();
      unsubHabits?.();
      unsubFocus?.();
    };
  }, [user]);

  const handleSaveName = async () => {
    if (!user || !tempName.trim() || !tempUsername.trim()) return;
    setIsSavingName(true);
    
    const userRef = doc(db, 'users', user.uid);
    const groupId = 'default-circle';

    try {
      const userSnap = await getDoc(userRef);
      const now = Date.now();
      
      const identityData = {
        displayName: tempName.trim(),
        name: tempName.trim(),
        username: tempUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        avatar: {
          type: 'initials',
          value: tempName.trim().split(/\s+/).map(n => n ? n[0] : '').filter(Boolean).join('').toUpperCase().slice(0, 2) || '?',
          color: selectedColor
        },
        lastActive: now,
        updatedAt: now,
        mood: tempMood
      };

      if (!userSnap.exists()) {
        const newProfile: UserProfile = {
          uid: user.uid,
          ...identityData,
          email: user.email || '',
          xp: 0,
          level: 0,
          globalStreak: 0,
          totalCompletions: 0,
          groupId: groupId,
          createdAt: now
        } as UserProfile;
        
        await setDoc(userRef, newProfile);
        
        // Save to nested path as well
        const nestedUserRef = doc(db, 'groups', groupId, 'users', user.uid);
        await setDoc(nestedUserRef, newProfile);

        setProfile(newProfile);

        // Ensure group exists and join
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        if (!groupSnap.exists()) {
          await setDoc(groupRef, {
            id: groupId,
            name: 'The Iron Circle',
            members: [user.uid]
          });
        } else {
          const groupData = groupSnap.data() as Group;
          if (!groupData.members.includes(user.uid)) {
            await setDoc(groupRef, {
              ...groupData,
              members: [...groupData.members, user.uid]
            });
          }
        }
      } else {
        const profileData = userSnap.data() as UserProfile;
        const currentGroupId = profileData.groupId || groupId;
        const nestedUserRef = doc(db, 'groups', currentGroupId, 'users', user.uid);

        await setDoc(userRef, identityData, { merge: true });
        await setDoc(nestedUserRef, identityData, { merge: true });
      }
      
      setShowNameModal(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, userRef.path);
    } finally {
      setIsSavingName(false);
    }
  };

  const login = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        setAuthError(error.message);
      }
      console.warn("Sign-in cancelled or interrupted");
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = () => signOut(auth);

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== 'DELETE') return;
    
    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      // 1. Re-authenticate
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(user, provider);

      // 2. Data Cleanup
      const userRef = doc(db, 'users', user.uid);
      const profileData = profile;

      if (profileData?.groupId) {
        // Delete all habits for the user (contains completions)
        const habitsRef = collection(db, 'groups', profileData.groupId, 'users', user.uid, 'habits');
        const habitsSnap = await getDocs(habitsRef);
        for (const habitDoc of habitsSnap.docs) {
          await deleteDoc(habitDoc.ref);
        }

        // Delete all focus sessions
        const focusRef = collection(db, 'groups', profileData.groupId, 'users', user.uid, 'focusSessions');
        const focusSnap = await getDocs(focusRef);
        for (const focusDoc of focusSnap.docs) {
          await deleteDoc(focusDoc.ref);
        }

        // Remove from nested user profile
        const nestedUserRef = doc(db, 'groups', profileData.groupId, 'users', user.uid);
        await deleteDoc(nestedUserRef);

        // Remove from group members
        const groupRef = doc(db, 'groups', profileData.groupId);
        await runTransaction(db, async (transaction) => {
          const groupSnap = await transaction.get(groupRef);
          if (groupSnap.exists()) {
            const data = groupSnap.data() as Group;
            const newMembers = data.members.filter(m => m !== user.uid);
            transaction.update(groupRef, { members: newMembers });
          }
        });
      }

      // Delete Profile 
      await deleteDoc(userRef);

      // 3. Delete Auth User
      await deleteUser(user);
      
      setShowDeleteModal(false);
      setUser(null);
      setProfile(null);
    } catch (error: any) {
      console.error("Account deletion failed:", error);
      setDeleteError(error.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const derivedXp = calculateUserXP(habits, focusSessions);
  const derivedGlobalStreak = calculateGlobalStreak(habits, today);
  const derivedLevel = Math.floor(Math.sqrt(derivedXp / 100));

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-bg-main text-[#F1F5F9] font-sans selection:bg-accent/30 overflow-x-hidden">
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={
            <AnimatePresence mode="wait">
              {!user ? (
                <motion.div 
                  key="login"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative flex flex-col items-center justify-center min-h-screen p-6 text-center overflow-hidden"
                >
                  {/* Background elements */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-accent/5 blur-[120px] rounded-full -mt-48" />
                  <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 blur-[100px] rounded-full" />
                  
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                    className="relative z-10 w-24 h-24 bg-accent/10 rounded-[2rem] flex items-center justify-center mb-10 border border-accent/20 shadow-[0_0_50px_rgba(59,130,246,0.1)]"
                  >
                    <Shield className="w-12 h-12 text-accent drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="relative z-10"
                  >
                    <h1 className="text-7xl font-black tracking-tighter text-white mb-6 uppercase italic">
                      Iron Circle<span className="text-accent underline underline-offset-8">.</span>
                    </h1>
                    <p className="text-text-dim max-w-lg mx-auto mb-12 text-lg font-medium leading-relaxed opacity-80">
                      A high-fidelity social accountability system. Forge habits, compete in circles, and ascend through consistent daily output.
                    </p>
                    
                    {authError && (
                      <div className="mb-8 px-6 py-3 bg-red-400/10 border border-red-400/20 rounded-2xl">
                        <p className="text-red-400 text-xs font-bold uppercase tracking-wider">{authError}</p>
                      </div>
                    )}

                    <button 
                      onClick={login}
                      disabled={isSigningIn}
                      className="group relative flex items-center gap-4 px-10 py-5 bg-accent hover:opacity-90 disabled:opacity-50 text-white font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-[0_20px_40px_rgba(59,130,246,0.3)]"
                    >
                      <LogIn className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                      <span className="uppercase tracking-[0.1em]">{isSigningIn ? 'Securing Connection...' : 'Initialize Session'}</span>
                    </button>

                    <p className="mt-12 text-[10px] font-black text-white/10 uppercase tracking-[0.5em]">
                      Protocol Alpha-2 • v2.0 Ready
                    </p>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div 
                  key="app"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full"
                >
                  <header className="max-w-screen-2xl mx-auto px-4 sm:px-8 h-20 sm:h-24 flex items-center justify-between sticky top-0 bg-bg-main/60 backdrop-blur-2xl z-50 border-b border-white/[0.03]">
                    <div 
                      className="flex items-center gap-3 sm:gap-6 cursor-pointer group"
                      onClick={() => setIsProfileOpen(true)}
                    >
                      <div className="relative">
                        <Avatar 
                          avatar={profile?.avatar} 
                          name={profile?.displayName} 
                          size="md" 
                          mood={profile?.mood}
                          className="ring-2 ring-white/5 group-hover:ring-accent/40 transition-all"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-accent p-1 rounded-full shadow-lg sm:hidden">
                          <Hash className="w-2 h-2 text-white" />
                        </div>
                      </div>
                      
                      <div className="hidden xs:block min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 sm:mb-1 overflow-hidden">
                          <span className="text-[10px] font-black text-text-dim/40 uppercase tracking-widest truncate">{profile?.username || 'GUEST'}</span>
                          <div className="w-1 h-1 rounded-full bg-accent/40 animate-pulse shrink-0" />
                        </div>
                        <h3 className="text-sm sm:text-lg font-black text-white italic tracking-tighter uppercase group-hover:text-accent transition-colors truncate">
                          {profile?.displayName || profile?.name || 'Anon'}
                        </h3>
                      </div>
                    </div>

                      <div className="flex items-center gap-2 sm:gap-6">
                        <button 
                          onClick={() => setIsHelpOpen(true)}
                          className="p-2 sm:p-3 bg-white/[0.02] hover:bg-white/10 text-text-dim hover:text-white border border-white/5 rounded-xl sm:rounded-2xl transition-all duration-300 active:scale-90"
                          title="System Protocol Help"
                        >
                          <Info className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>

                      <div className="hidden lg:flex flex-col items-end gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-text-dim/60 uppercase tracking-wider tabular-nums">
                            {derivedXp.toLocaleString()} XP
                          </span>
                          <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${derivedXp % 100}%` }}
                              className="h-full bg-accent shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3">
                        {derivedGlobalStreak > 0 && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg sm:rounded-xl shrink-0"
                          >
                            <Flame className="w-3 sm:w-4 h-3 sm:h-4 text-orange-500 fill-current animate-pulse" />
                            <span className="text-[9px] sm:text-xs font-black text-orange-500 italic uppercase">{derivedGlobalStreak}</span>
                          </motion.div>
                        )}
                        <div className="w-px h-6 sm:h-8 bg-white/5 mx-0.5 sm:mx-1 hidden sm:block" />
                        <button 
                          onClick={() => setShowDeleteModal(true)}
                          className="hidden sm:flex p-2 sm:p-3 bg-white/[0.02] hover:bg-red-500/10 text-text-dim hover:text-red-400 border border-white/5 hover:border-red-500/20 rounded-xl sm:rounded-2xl transition-all duration-300 active:scale-90"
                          title="Account Settings"
                        >
                          <Trash2 className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>
                        <button 
                          onClick={logout}
                          className="hidden xs:flex p-2 sm:p-3 bg-white/[0.02] hover:bg-red-500/10 text-text-dim hover:text-red-400 border border-white/5 hover:border-red-500/20 rounded-xl sm:rounded-2xl transition-all duration-300 active:scale-90"
                          title="Terminate Session"
                        >
                          <LogOut className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  </header>

                  <main className="max-w-screen-2xl mx-auto p-4 sm:p-8 text-[#F1F5F9]">
                    {(profile && profile.displayName && profile.displayName !== 'Anon') ? (
                      <>
                        <Routes>
                          <Route path="/" element={<WeeklyDashboard profile={profile} today={today} />} />
                          <Route path="/focus" element={<FocusTimer profile={profile} today={today} />} />
                          <Route path="/profile/:uid" element={<ProfilePage />} />
                        </Routes>
                        <Navigation />
                        <ProfilePanel 
                          profile={profile} 
                          habits={habits}
                          focusSessions={focusSessions}
                          derivedXp={derivedXp}
                          derivedLevel={derivedLevel}
                          globalStreak={derivedGlobalStreak}
                          today={today}
                          isOpen={isProfileOpen} 
                          onClose={() => setIsProfileOpen(false)} 
                          onLogout={logout}
                          onDeleteRequested={() => {
                            setIsProfileOpen(false);
                            setShowDeleteModal(true);
                          }}
                        />
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 animate-pulse opacity-50">
                        <div className="text-[10px] tracking-[0.4em] font-black uppercase">Establishing Neural Link...</div>
                      </div>
                    )}
                  </main>

                  <footer className="max-w-screen-2xl mx-auto px-8 py-12 pb-32 border-t border-white/[0.03] opacity-40">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
                          <Shield className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-white">Iron Circle <span className="text-accent/50 ml-1">v2.0</span></div>
                          <div className="text-[8px] font-medium text-text-dim uppercase tracking-wider">Tactical Habit Protocol</div>
                        </div>
                      </div>

                      <SystemInfo />

                      <div className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">
                        © 2026 Neural Grid Labs
                      </div>
                    </div>
                  </footer>
                </motion.div>
              )}
            </AnimatePresence>
          } />
        </Routes>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-24">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeletingAccount && setShowDeleteModal(false)}
              className="absolute inset-0 bg-bg-main/90 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg glass-card rounded-[2.5rem] p-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0" />
              
              <div className="flex justify-between items-start mb-8">
                <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <button 
                  disabled={isDeletingAccount}
                  onClick={() => setShowDeleteModal(false)}
                  className="p-2 hover:bg-white/5 rounded-xl text-text-dim transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <h2 className="text-3xl font-black text-white tracking-tighter mb-4 italic uppercase">
                Terminate Output Cycle?
              </h2>
              <p className="text-text-dim leading-relaxed mb-8">
                You are about to permanently delete your <span className="text-white font-bold">Iron Circle</span> identity. 
                All XP, levels, habit historical data, and group standings will be <span className="text-red-400 font-bold underline decoration-red-400/30 underline-offset-4">wiped from the sector</span>. This action is non-reversible.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-text-dim/60 uppercase tracking-[0.2em] block mb-3 pl-1">
                    Confirm identity deletion by typing <span className="text-red-400">DELETE</span>
                  </label>
                  <input 
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    disabled={isDeletingAccount}
                    placeholder="Enter command..."
                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-6 py-4 text-white font-bold tracking-widest uppercase focus:outline-none focus:border-red-500/40 focus:ring-4 focus:ring-red-500/5 transition-all text-center mb-4"
                  />
                </div>

                {deleteError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-xs font-bold text-center uppercase tracking-wider">{deleteError}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button 
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeletingAccount}
                    className="flex-1 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all uppercase tracking-widest text-xs"
                  >
                    Abort
                  </button>
                  <button 
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount || deleteConfirmText !== 'DELETE'}
                    className="flex-[1.5] px-8 py-4 bg-red-500 hover:bg-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all uppercase tracking-[0.1em] text-xs shadow-[0_15px_30px_rgba(239,68,68,0.2)] flex items-center justify-center gap-3"
                  >
                    {isDeletingAccount ? (
                      <>
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full"
                        />
                        <span>Purging...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Confirm Deletion</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Identity Setup Modal */}
      <AnimatePresence>
        {showNameModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bg-main/95 backdrop-blur-3xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-xl glass-card rounded-[3rem] p-12 text-center"
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                <Avatar 
                  avatar={{ 
                    type: 'initials', 
                    value: tempName.trim().split(/\s+/).map(n => n ? n[0] : '').filter(Boolean).join('').toUpperCase().slice(0, 2) || '?', 
                    color: selectedColor 
                  }}
                  name={tempName}
                  mood={tempMood}
                  size="xl"
                  className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-bg-main"
                />
              </div>

              <h2 className="text-4xl font-black text-white tracking-tighter mb-2 italic uppercase mt-8">
                Forge Identity
              </h2>
              <p className="text-text-dim mb-10 font-medium">
                Establish your digital presence in the Circle.
              </p>

              <div className="space-y-8 text-left">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-2">
                    <UserIcon className="w-3 h-3" /> Callsign
                  </label>
                  <input 
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="E.g. Ghost Operator"
                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-2">
                    <Hash className="w-3 h-3" /> Unique ID
                  </label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-accent font-black">@</span>
                    <input 
                      type="text"
                      value={tempUsername}
                      onChange={(e) => setTempUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="username"
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-10 pr-6 py-4 text-white font-bold focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-2">
                    <Palette className="w-3 h-3" /> Neural Color
                  </label>
                  <div className="flex flex-wrap justify-center gap-3">
                    {colors.map(color => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={cn(
                          "w-10 h-10 rounded-xl transition-all duration-300 transform hover:scale-110",
                          selectedColor === color ? "ring-4 ring-white scale-110 shadow-lg" : "opacity-40 hover:opacity-100"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleSaveName}
                  disabled={isSavingName || !tempName.trim() || !tempUsername.trim()}
                  className="w-full py-5 bg-accent hover:opacity-90 disabled:opacity-20 text-white font-black rounded-2xl transition-all uppercase tracking-widest shadow-[0_20px_40px_rgba(59,130,246,0.3)] flex items-center justify-center gap-3 mt-4"
                >
                  {isSavingName ? 'Syncing Neural Link...' : 'Initialize Session'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <HelpTour isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
    </Router>
  );
}
