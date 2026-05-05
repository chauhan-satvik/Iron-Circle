import React, { useState } from 'react';
import { UserProfile, Group } from '../types';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import Avatar from './Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Flame, 
  Zap, 
  User, 
  Hash, 
  Palette, 
  ChevronRight,
  ShieldCheck,
  LogOut,
  X,
  Twitter,
  Github,
  Globe,
  Edit2
} from 'lucide-react';
import { cn } from '../lib/utils';

const PREDEFINED_AVATARS = [
  '⚡', '🛡️', '🧠', '⚔️', '🔮', '🧬', '🌌', '🌋', '🌊', '🌪️', '🦾', '👾', '🚀', '🔭', '📡', '💎', '🔥', '☄️'
];

interface ProfilePanelProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onDeleteRequested: () => void;
}

export default function ProfilePanel({ profile, isOpen, onClose, onLogout, onDeleteRequested }: ProfilePanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(profile.displayName);
  const [tempUsername, setTempUsername] = useState(profile.username);
  const [tempBio, setTempBio] = useState(profile.bio || '');
  const [tempTwitter, setTempTwitter] = useState(profile.socialLinks?.twitter || '');
  const [tempGithub, setTempGithub] = useState(profile.socialLinks?.github || '');
  const [tempWebsite, setTempWebsite] = useState(profile.socialLinks?.website || '');
  const [tempAvatarType, setTempAvatarType] = useState<UserProfile['avatar']['type']>(profile.avatar?.type || 'initials');
  const [tempAvatarValue, setTempAvatarValue] = useState(profile.avatar?.value || '');
  const [selectedColor, setSelectedColor] = useState(profile.avatar?.color || '#3B82F6');
  const [isSaving, setIsSaving] = useState(false);

  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
  const xpInLevel = (profile.xp || 0) % 1000;
  const progress = (xpInLevel / 1000) * 100;

  const handleSave = async () => {
    setIsSaving(true);
    const userRef = doc(db, 'users', profile.uid);
    const groupMemberRef = doc(db, 'groups', profile.groupId, 'users', profile.uid);
    
    try {
      const avatarValue = tempAvatarType === 'initials' 
        ? tempName.trim().split(/\s+/).map(n => n ? n[0] : '').filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
        : tempAvatarValue;

      const updates = {
        displayName: tempName,
        username: tempUsername.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        bio: tempBio,
        socialLinks: {
          twitter: tempTwitter,
          github: tempGithub,
          website: tempWebsite
        },
        avatar: {
          type: tempAvatarType,
          color: selectedColor,
          value: avatarValue
        },
        updatedAt: Date.now()
      };

      await setDoc(userRef, updates, { merge: true });
      await setDoc(groupMemberRef, updates, { merge: true });
      setIsEditing(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, userRef.path);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-bg-main border-l border-white/5 z-[201] shadow-2xl overflow-y-auto no-scrollbar"
          >
            {/* Header */}
            <div className="p-6 sm:p-8 pb-0 flex items-center justify-between">
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-dim hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-[10px] sm:text-sm font-black text-white/40 uppercase tracking-[0.3em]">Operator Profile</h2>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  isEditing ? "bg-accent text-white" : "bg-white/5 text-text-dim hover:text-white"
                )}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-8 sm:space-y-10">
              {/* Identity Section */}
              <div className="text-center space-y-4">
                <Avatar 
                  avatar={profile.avatar}
                  name={profile.displayName}
                  size="xl"
                  className="mx-auto"
                />
                <div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{profile.displayName}</h3>
                  <p className="text-accent font-black text-sm tracking-widest mt-1">@{profile.username}</p>
                </div>
                
                {profile.bio && (
                  <p className="text-sm text-text-dim max-w-xs mx-auto leading-relaxed">{profile.bio}</p>
                )}

                <div className="flex items-center justify-center gap-4">
                  {profile.socialLinks?.twitter && (
                    <a href={`https://twitter.com/${profile.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-xl text-text-dim hover:text-[#1DA1F2] hover:bg-white/10 transition-all">
                      <Twitter className="w-4 h-4" />
                    </a>
                  )}
                  {profile.socialLinks?.github && (
                    <a href={`https://github.com/${profile.socialLinks.github}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-xl text-text-dim hover:text-white hover:bg-white/10 transition-all">
                      <Github className="w-4 h-4" />
                    </a>
                  )}
                  {profile.socialLinks?.website && (
                    <a href={profile.socialLinks.website.startsWith('http') ? profile.socialLinks.website : `https://${profile.socialLinks.website}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-xl text-text-dim hover:text-accent hover:bg-white/10 transition-all">
                      <Globe className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2 text-orange-500">
                    <Flame className="w-4 h-4 fill-current" />
                    <span className="text-2xl font-black italic tracking-tighter">{profile.globalStreak}</span>
                  </div>
                  <div className="text-[10px] font-black text-text-dim uppercase tracking-widest">Active Streak</div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2 text-accent">
                    <ShieldCheck className="w-4 h-4 fill-current" />
                    <span className="text-2xl font-black italic tracking-tighter">{profile.level}</span>
                  </div>
                  <div className="text-[10px] font-black text-text-dim uppercase tracking-widest">Security Level</div>
                </div>
              </div>

              {/* Progress Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent fill-current" />
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Progress to Level {profile.level + 1}</span>
                  </div>
                  <span className="text-[10px] font-black text-accent">{xpInLevel.toLocaleString()} / 1,000 XP</span>
                </div>
                <div className="h-4 bg-white/5 rounded-full p-1 border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-accent rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  />
                </div>
              </div>

              {/* Edit Form */}
              <AnimatePresence>
                {isEditing && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="space-y-6 pt-6 border-t border-white/5"
                  >
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Display Name</label>
                        <input 
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Username</label>
                        <input 
                          type="text"
                          value={tempUsername}
                          onChange={(e) => setTempUsername(e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Bio</label>
                        <textarea 
                          value={tempBio}
                          onChange={(e) => setTempBio(e.target.value)}
                          placeholder="Your neural mission statement..."
                          rows={3}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-accent resize-none text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-2">Twitter</label>
                          <input 
                            type="text"
                            value={tempTwitter}
                            onChange={(e) => setTempTwitter(e.target.value)}
                            placeholder="username"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-2">GitHub</label>
                          <input 
                            type="text"
                            value={tempGithub}
                            onChange={(e) => setTempGithub(e.target.value)}
                            placeholder="username"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-2">Web</label>
                          <input 
                            type="text"
                            value={tempWebsite}
                            onChange={(e) => setTempWebsite(e.target.value)}
                            placeholder="url"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Avatar Manifestation</label>
                        <div className="grid grid-cols-6 gap-2">
                          <button 
                            onClick={() => setTempAvatarType('initials')}
                            className={cn(
                              "aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all",
                              tempAvatarType === 'initials' ? "bg-accent text-white scale-110 shadow-lg" : "bg-white/5 text-text-dim hover:bg-white/10"
                            )}
                          >
                            TX
                          </button>
                          {PREDEFINED_AVATARS.map(avatar => (
                            <button 
                              key={avatar}
                              onClick={() => {
                                setTempAvatarType('selection');
                                setTempAvatarValue(avatar);
                              }}
                              className={cn(
                                "aspect-square rounded-xl flex items-center justify-center text-lg transition-all",
                                tempAvatarType === 'selection' && tempAvatarValue === avatar ? "bg-accent text-white scale-110 shadow-lg" : "bg-white/5 text-text-dim hover:bg-white/10"
                              )}
                            >
                              {avatar}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Neural Link Color</label>
                        <div className="flex flex-wrap gap-2">
                          {colors.map(color => (
                            <button 
                              key={color}
                              onClick={() => setSelectedColor(color)}
                              className={cn(
                                "w-10 h-10 rounded-xl transition-all",
                                selectedColor === color ? "ring-4 ring-white scale-110" : "opacity-40"
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full py-5 bg-accent text-white font-black rounded-2xl uppercase tracking-widest shadow-xl hover:opacity-90 disabled:opacity-50"
                    >
                      {isSaving ? 'Syncing...' : 'Save Identity'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Account Actions - Visible on mobile only if header is hidden, or just always here for convenience */}
              <div className="pt-6 border-t border-white/5 space-y-4">
                <button 
                  onClick={onLogout}
                  className="w-full py-4 bg-white/[0.02] border border-white/5 text-text-dim hover:text-white hover:bg-white/[0.05] font-black rounded-2xl uppercase tracking-widest transition-all flex items-center justify-center gap-3"
                >
                  <LogOut className="w-5 h-5" />
                  Terminate Session
                </button>
                <button 
                  onClick={onDeleteRequested}
                  className="w-full py-4 text-red-500/40 hover:text-red-500 font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] sm:text-xs transition-all"
                >
                  Self Destruct Sequence
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
