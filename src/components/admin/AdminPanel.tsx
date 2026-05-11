import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Users, 
  Zap, 
  Flame, 
  Target, 
  Timer, 
  Trash2, 
  RotateCcw, 
  Search, 
  MoreHorizontal, 
  X, 
  AlertTriangle,
  ChevronRight,
  Activity,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';
import Avatar from '../Avatar';
import { UserProfile, Habit, FocusSession } from '../../types';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'global'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userHabits, setUserHabits] = useState<Habit[]>([]);
  const [userFocus, setUserFocus] = useState<FocusSession[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const isAdmin = localStorage.getItem('iron_admin') === 'true';
    const expiry = localStorage.getItem('iron_admin_expiry');
    if (!isAdmin || !expiry || Date.now() > parseInt(expiry)) {
      localStorage.removeItem('iron_admin');
      localStorage.removeItem('iron_admin_expiry');
      navigate('/admin/login');
    }
  }, [navigate]);

  const fetchUsers = async () => {
    setIsRefreshing(true);
    try {
      const q = query(collection(db, 'users'), orderBy('xp', 'desc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('iron_admin');
    localStorage.removeItem('iron_admin_expiry');
    navigate('/admin/login');
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const inspectUser = async (user: UserProfile) => {
    setSelectedUser(user);
    // Fetch habits and focus sessions
    const habitsPath = `groups/${user.groupId}/users/${user.uid}/habits`;
    const focusPath = `groups/${user.groupId}/users/${user.uid}/focusSessions`;
    
    try {
      const habitSnap = await getDocs(collection(db, habitsPath));
      setUserHabits(habitSnap.docs.map(d => ({ ...d.data(), id: d.id } as Habit)));
      
      const focusSnap = await getDocs(collection(db, focusPath));
      setUserFocus(focusSnap.docs.map(d => ({ ...d.data(), id: d.id } as FocusSession)));
    } catch (e) {
      console.error(e);
    }
  };

  const updateUserStat = async (uid: string, field: string, value: any) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { [field]: value });
      
      // Update local state
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, [field]: value } : u));
      if (selectedUser?.uid === uid) {
        setSelectedUser({ ...selectedUser, [field]: value });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteUser = async (uid: string, groupId: string) => {
    if (!window.confirm('CRITICAL: Permanently purge this user and all associated data?')) return;
    
    try {
      const batch = writeBatch(db);
      
      // Delete habits
      const habitsRef = collection(db, `groups/${groupId}/users/${uid}/habits`);
      const habitSnap = await getDocs(habitsRef);
      habitSnap.docs.forEach(d => batch.delete(d.ref));
      
      // Delete focus sessions
      const focusRef = collection(db, `groups/${groupId}/users/${uid}/focusSessions`);
      const focusSnap = await getDocs(focusRef);
      focusSnap.docs.forEach(d => batch.delete(d.ref));

      // Delete group-nested profile
      batch.delete(doc(db, `groups/${groupId}/users/${uid}`));
      
      // Delete main profile
      batch.delete(doc(db, 'users', uid));
      
      await batch.commit();
      
      setUsers(prev => prev.filter(u => u.uid !== uid));
      setSelectedUser(null);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteHabit = async (habitId: string) => {
    if (!selectedUser) return;
    try {
      const path = `groups/${selectedUser.groupId}/users/${selectedUser.uid}/habits/${habitId}`;
      await deleteDoc(doc(db, path));
      setUserHabits(prev => prev.filter(h => h.id !== habitId));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteFocusSession = async (sessionId: string) => {
    if (!selectedUser) return;
    try {
      const path = `groups/${selectedUser.groupId}/users/${selectedUser.uid}/focusSessions/${sessionId}`;
      await deleteDoc(doc(db, path));
      setUserFocus(prev => prev.filter(s => s.id !== sessionId));
    } catch (e) {
      console.error(e);
    }
  };

  const resetAllHabits = async () => {
     if (!window.confirm("WIPE ALL HABITS ACROSS ALL USERS? This is destructive.")) return;
     // Implementation would involve crawling all users and deleting subcollections.
     // For safety in this demo, let's just alert that it's a massive operation.
     alert("Operation aborted. This requires a Cloud Function for scale.");
  };

  return (
    <div className="min-h-screen bg-bg-main text-white relative flex flex-col">
      {/* Header */}
      <header className="h-20 border-b border-white/5 bg-black/40 backdrop-blur-3xl px-8 flex items-center justify-between sticky top-0 z-[60]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center border border-accent/20">
            <Shield className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter">Command Center</h1>
            <p className="text-[10px] font-black text-accent uppercase tracking-widest">Protocol v2.1 • SuperAdmin</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'users' ? "bg-accent text-white shadow-lg" : "text-text-dim hover:text-white"
              )}
            >
              Intelligence
            </button>
            <button 
              onClick={() => setActiveTab('global')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'global' ? "bg-accent text-white shadow-lg" : "text-text-dim hover:text-white"
              )}
            >
              Control
            </button>
          </nav>
          
          <div className="w-px h-8 bg-white/10" />
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all border border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Terminate</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full p-8 overflow-y-auto">
        {activeTab === 'users' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* User List Sidebar */}
            <div className="lg:col-span-5 space-y-6">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-text-dim group-focus-within:text-accent transition-colors" />
                <input 
                  type="text"
                  placeholder="SEARCH SECTOR PERSONNEL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/5 rounded-[2rem] pl-16 pr-8 py-5 text-sm font-bold placeholder:text-white/10 focus:outline-none focus:border-accent/40 shadow-2xl transition-all"
                />
              </div>

              <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-2 no-scrollbar">
                {loading ? (
                  <div className="py-20 text-center animate-pulse opacity-50 text-[10px] uppercase font-black tracking-widest">Scanning Grid...</div>
                ) : filteredUsers.map(user => (
                  <motion.button
                    key={user.uid}
                    layoutId={`user-${user.uid}`}
                    onClick={() => inspectUser(user)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-3xl border transition-all text-left group",
                      selectedUser?.uid === user.uid 
                        ? "bg-accent/10 border-accent/40 shadow-[0_0_30px_rgba(59,130,246,0.1)]" 
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                    )}
                  >
                    <Avatar avatar={user.avatar} name={user.displayName} size="md" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black uppercase italic tracking-tighter truncate">{user.displayName}</h4>
                      <p className="text-[10px] font-black text-text-dim uppercase tracking-widest">@{user.username}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[10px] font-black text-accent uppercase">{user.xp?.toLocaleString()} XP</div>
                      <div className="flex items-center gap-1">
                        <Flame className={cn("w-3 h-3", (user.globalStreak || 0) > 0 ? "text-orange-500 fill-current" : "text-white/10")} />
                        <span className="text-[9px] font-black opacity-40 italic">{user.globalStreak || 0}</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Inspection Panel */}
            <div className="lg:col-span-7">
              <AnimatePresence mode="wait">
                {selectedUser ? (
                  <motion.div 
                    key={selectedUser.uid}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="glass-card rounded-[3rem] p-10 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-8">
                       <button onClick={() => setSelectedUser(null)} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 text-white/40"><X className="w-5 h-5" /></button>
                    </div>

                    <div className="flex items-start gap-8 mb-12">
                      <div className="relative">
                        <Avatar avatar={selectedUser.avatar} name={selectedUser.displayName} size="xl" className="shadow-2xl" />
                        <div className="absolute -bottom-2 -right-2 bg-accent shadow-xl p-2 rounded-xl border border-white/20">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div className="pt-2">
                        <div className="flex items-center gap-4 mb-2">
                          <h2 className="text-3xl font-black italic uppercase tracking-tighter">{selectedUser.displayName}</h2>
                          <span className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-[10px] font-black tracking-widest opacity-40">UID: {selectedUser.uid.slice(0, 8)}...</span>
                        </div>
                        <p className="text-accent font-black text-sm uppercase tracking-[0.2em]">@{selectedUser.username}</p>
                        <div className="mt-4 flex gap-4">
                           <div className="text-center bg-white/[0.03] px-6 py-3 rounded-2xl border border-white/5 min-w-[100px]">
                              <div className="text-[8px] font-black text-text-dim uppercase tracking-widest mb-1">XP Level</div>
                              <div className="text-xl font-black italic text-white leading-none">{selectedUser.level || 0}</div>
                           </div>
                           <div className="text-center bg-white/[0.03] px-6 py-3 rounded-2xl border border-white/5 min-w-[100px]">
                              <div className="text-[8px] font-black text-text-dim uppercase tracking-widest mb-1">Streak</div>
                              <div className="text-xl font-black italic text-orange-500 leading-none">{selectedUser.globalStreak || 0}</div>
                           </div>
                        </div>
                      </div>
                    </div>

                    {/* Controls Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                      <section className="space-y-4">
                        <h5 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] pl-2">System Attributes</h5>
                        <div className="space-y-3">
                          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-text-dim">
                              <Zap className="w-5 h-5" />
                              <span className="text-[10px] font-black uppercase tracking-widest">XP Reservoir</span>
                            </div>
                            <div className="flex items-center gap-3">
                               <button 
                                 onClick={() => updateUserStat(selectedUser.uid, 'xp', Math.max(0, (selectedUser.xp || 0) - 100))}
                                 className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center font-black">-</button>
                               <span className="text-sm font-black w-20 text-center">{selectedUser.xp?.toLocaleString()}</span>
                               <button 
                                 onClick={() => updateUserStat(selectedUser.uid, 'xp', (selectedUser.xp || 0) + 100)}
                                 className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center font-black">+</button>
                            </div>
                          </div>
                          
                          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-text-dim">
                              <Flame className="w-5 h-5" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Active Streak</span>
                            </div>
                            <div className="flex items-center gap-3">
                               <button 
                                 onClick={() => updateUserStat(selectedUser.uid, 'globalStreak', Math.max(0, (selectedUser.globalStreak || 0) - 1))}
                                 className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center font-black">-</button>
                               <span className="text-sm font-black w-10 text-center">{selectedUser.globalStreak || 0}</span>
                               <button 
                                 onClick={() => updateUserStat(selectedUser.uid, 'globalStreak', (selectedUser.globalStreak || 0) + 1)}
                                 className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center font-black">+</button>
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h5 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] pl-2">Critical Actions</h5>
                        <div className="grid grid-cols-2 gap-3">
                           <button 
                             onClick={() => updateUserStat(selectedUser.uid, 'xp', 0)}
                             className="flex flex-col items-center justify-center gap-2 p-5 bg-white/[0.02] hover:bg-white/10 border border-white/5 rounded-3xl transition-all group"
                           >
                              <RotateCcw className="w-5 h-5 text-accent group-hover:rotate-[-45deg] transition-transform" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-text-dim">Reset XP</span>
                           </button>
                           <button 
                             onClick={() => deleteUser(selectedUser.uid, selectedUser.groupId)}
                             className="flex flex-col items-center justify-center gap-2 p-5 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-3xl transition-all group"
                           >
                              <Trash2 className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-red-500/60">Purge User</span>
                           </button>
                        </div>
                      </section>
                    </div>

                    {/* Data Lists */}
                    <div className="space-y-8">
                       <section>
                          <div className="flex items-center justify-between mb-4 pl-2">
                             <h5 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Habit Manifestation</h5>
                             <span className="text-[8px] font-black text-accent uppercase tracking-widest">{userHabits.length} Active Protocols</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                             {userHabits.map(habit => (
                               <div key={habit.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between group">
                                  <div className="min-w-0">
                                     <div className="text-xs font-black uppercase italic tracking-tighter truncate">{habit.name}</div>
                                     <div className="text-[8px] font-black text-text-dim/60 uppercase tracking-widest mt-1">{habit.type} • {habit.difficulty}</div>
                                  </div>
                                  <button 
                                    onClick={() => deleteHabit(habit.id)}
                                    className="p-2 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg text-red-500 hover:bg-red-500/20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                               </div>
                             ))}
                             {userHabits.length === 0 && <div className="col-span-full py-6 text-center text-[10px] text-white/10 uppercase font-black tracking-widest border border-dashed border-white/5 rounded-2xl">No Habits Logged</div>}
                          </div>
                       </section>

                       <section>
                          <div className="flex items-center justify-between mb-4 pl-2">
                             <h5 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Focus Logs</h5>
                             <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">{userFocus.length} Deep Sessions</span>
                          </div>
                          <div className="space-y-2">
                             {userFocus.slice(0, 5).map(session => (
                               <div key={session.id} className="px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between group">
                                  <div className="flex items-center gap-4">
                                     <Timer className="w-3.5 h-3.5 text-cyan-400" />
                                     <div>
                                        <div className="text-xs font-black uppercase tracking-widest text-white/80">{session.duration}m Focus Session</div>
                                        <div className="text-[8px] font-black text-text-dim/40 uppercase tracking-widest">{new Date(session.createdAt).toLocaleString()}</div>
                                     </div>
                                  </div>
                                  <button 
                                    onClick={() => deleteFocusSession(session.id)}
                                    className="p-2 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg text-red-500 hover:bg-red-500/20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                               </div>
                             ))}
                             {userFocus.length > 5 && <div className="text-[8px] font-black text-center text-text-dim/20 uppercase tracking-[0.5em] py-2">Additional {userFocus.length - 5} Sessions Encrypted</div>}
                             {userFocus.length === 0 && <div className="py-6 text-center text-[10px] text-white/10 uppercase font-black tracking-widest border border-dashed border-white/5 rounded-2xl">No Focus Activity</div>}
                          </div>
                       </section>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none px-12">
                     <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-10 border border-white/10">
                        <Users className="w-12 h-12 text-white/20" />
                     </div>
                     <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-4">Command Awaiting Input</h3>
                     <p className="text-sm font-medium leading-relaxed max-w-sm mx-auto">Select a sector personnel from the intelligence grid to inspect neural status and system protocols.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto py-12">
             <div className="flex items-center gap-6 mb-12">
                <div className="w-20 h-20 bg-accent/20 rounded-[2rem] flex items-center justify-center border border-accent/20 shadow-2xl">
                   <Activity className="w-10 h-10 text-accent" />
                </div>
                <div>
                   <h2 className="text-4xl font-black italic uppercase tracking-tighter">Global Control</h2>
                   <p className="text-text-dim font-bold uppercase tracking-[0.2em] mt-1">High-Altitude System Orchestration</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="glass-card rounded-[3rem] p-8 sm:p-10 border-white/10">
                   <div className="flex items-center gap-4 mb-8">
                      <Target className="w-6 h-6 text-accent" />
                      <h4 className="text-lg font-black uppercase italic italic tracking-tight">System Integrity</h4>
                   </div>
                   <div className="space-y-4">
                      <button 
                        onClick={() => fetchUsers()}
                        className="w-full h-20 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl flex items-center justify-between px-8 transition-all group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20 group-hover:rotate-180 transition-transform duration-500">
                               <RefreshCw className="w-5 h-5 text-accent" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Refresh Intelligence</span>
                         </div>
                         <ChevronRight className="w-4 h-4 text-white/20 group-hover:translate-x-1 transition-all" />
                      </button>
                      
                      <button 
                        onClick={() => resetAllHabits()}
                        className="w-full h-20 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-3xl flex items-center justify-between px-8 transition-all group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
                               <RotateCcw className="w-5 h-5 text-red-500" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500/80">Mass Habit Reset</span>
                         </div>
                         <AlertTriangle className="w-4 h-4 text-red-500/20" />
                      </button>
                   </div>
                </section>

                <section className="glass-card rounded-[3rem] p-8 sm:p-10 border-white/10">
                   <div className="flex items-center gap-4 mb-8">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                      <h4 className="text-lg font-black uppercase italic italic tracking-tight">Emergency Protocols</h4>
                   </div>
                   <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl mb-6">
                      <p className="text-[10px] font-medium leading-relaxed text-red-400/80 uppercase tracking-wider mb-0 text-center">Caution: Actions in this sector bypass standard neural safety parameters. Purge logic is absolute.</p>
                   </div>
                   <button className="w-full py-6 bg-white/5 border border-white/5 rounded-3xl flex items-center justify-center gap-3 opacity-20 cursor-not-allowed">
                      <Shield className="w-5 h-5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Sector Lockdown</span>
                   </button>
                </section>
             </div>
          </div>
        )}
      </main>

      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-[1000px] pointer-events-none overflow-hidden blur-[120px] opacity-20 z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-accent/30 rounded-full" />
          <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-purple-500/20 rounded-full" />
      </div>
    </div>
  );
}
