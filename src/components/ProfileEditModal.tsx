import React, { useState } from 'react';
import { X, Save, User, AtSign, FileText, Github, Instagram, Twitter, Globe, MessageSquare, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
}

export default function ProfileEditModal({ isOpen, onClose, profile }: ProfileEditModalProps) {
  const [formData, setFormData] = useState({
    displayName: profile.displayName || '',
    username: profile.username || '',
    bio: profile.bio || '',
    photoURL: profile.avatar?.value && profile.avatar.type === 'image' ? profile.avatar.value : '',
    github: profile.github || '',
    instagram: profile.instagram || '',
    twitter: profile.twitter || '',
    website: profile.website || '',
    discord: profile.discord || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const userRef = doc(db, 'groups', profile.groupId, 'users', profile.uid);
      const rootUserRef = doc(db, 'users', profile.uid);
      
      // Construct update object
      const updates: any = {
        displayName: formData.displayName,
        username: formData.username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        bio: formData.bio,
        github: formData.github,
        instagram: formData.instagram,
        twitter: formData.twitter,
        website: formData.website,
        discord: formData.discord,
      };

      // Handle avatar change if photoURL is provided
      if (formData.photoURL && formData.photoURL !== (profile.avatar?.value || '')) {
        updates.avatar = {
          ...profile.avatar,
          type: 'image',
          value: formData.photoURL
        };
      }

      await updateDoc(userRef, updates);
      await updateDoc(rootUserRef, updates);
      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg-main/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl glass-card rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-8 sm:p-10 border-b border-white/[0.03] flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Edit Protocol</h2>
                <p className="text-[10px] font-black text-text-dim/60 uppercase tracking-[0.3em] mt-1">Identity Modification Surface</p>
              </div>
              <button 
                onClick={onClose}
                className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 text-text-dim hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 sm:p-10 space-y-8 custom-scrollbar">
              {/* Basic Info */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-accent" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Core Identity</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-text-dim uppercase tracking-widest ml-2">Display Name</label>
                    <input 
                      type="text"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleChange}
                      placeholder="e.g. Ghost Operator"
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-text-dim uppercase tracking-widest ml-2">Username</label>
                    <div className="relative group">
                      <AtSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-accent transition-colors" />
                      <input 
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="username"
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-text-dim uppercase tracking-widest ml-2">Bio / Narrative</label>
                  <div className="relative group">
                    <FileText className="absolute left-5 top-5 w-4 h-4 text-text-dim group-focus-within:text-accent transition-colors" />
                    <textarea 
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      placeholder="Transmission your purpose..."
                      rows={3}
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-text-dim uppercase tracking-widest ml-2">Avatar URL (External Image)</label>
                  <div className="relative group">
                    <Camera className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-accent transition-colors" />
                    <input 
                      type="url"
                      name="photoURL"
                      value={formData.photoURL}
                      onChange={handleChange}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-accent" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Neural Connections</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="relative group">
                    <Github className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-white transition-colors" />
                    <input 
                      type="text"
                      name="github"
                      value={formData.github}
                      onChange={handleChange}
                      placeholder="GitHub username"
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                    />
                  </div>
                  <div className="relative group">
                    <Instagram className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-pink-400 transition-colors" />
                    <input 
                      type="text"
                      name="instagram"
                      value={formData.instagram}
                      onChange={handleChange}
                      placeholder="Instagram handle"
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                    />
                  </div>
                  <div className="relative group">
                    <Twitter className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-sky-400 transition-colors" />
                    <input 
                      type="text"
                      name="twitter"
                      value={formData.twitter}
                      onChange={handleChange}
                      placeholder="Twitter handle"
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                    />
                  </div>
                  <div className="relative group">
                    <MessageSquare className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-indigo-400 transition-colors" />
                    <input 
                      type="text"
                      name="discord"
                      value={formData.discord}
                      onChange={handleChange}
                      placeholder="Discord username"
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                    />
                  </div>
                </div>
                
                <div className="relative group">
                  <Globe className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim group-focus-within:text-emerald-400 transition-colors" />
                  <input 
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="Personal website URL"
                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                  />
                </div>
              </div>
            </form>

            <div className="p-8 sm:p-10 border-t border-white/[0.03] bg-white/[0.01] shrink-0">
              <div className="flex gap-4">
                <button 
                  onClick={onClose}
                  className="flex-1 py-4 bg-white/5 text-text-dim font-black rounded-2xl uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-[2] py-4 bg-accent text-white font-black rounded-2xl uppercase tracking-widest hover:scale-[1.02] active:scale-95 shadow-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <Save className="w-5 h-5" />
                  {isSaving ? 'Synchronizing...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
