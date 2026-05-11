import React, { useState } from 'react';
import { Habit } from '../types';
import { Flame, Star, Zap, TrendingUp, CheckCircle2, MoreVertical, Trash2, Edit2, Calendar, Layers } from 'lucide-react';
import { cn, getDaysOfWeek } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { calculateHabitStreak, calculateWeeklyProgress, XP_MAP } from '../lib/habitEngine';

interface HabitItemProps {
  habit: Habit;
  onToggleToday: (e: React.MouseEvent) => void;
  isCompletedToday: boolean;
  today: Date;
  onUpdate: (updates: Partial<Habit>) => void;
  onDelete: () => void;
  key?: React.Key;
}

export default function HabitItem({ 
  habit, 
  onToggleToday, 
  isCompletedToday, 
  today,
  onUpdate, 
  onDelete 
}: HabitItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const derivedStreak = calculateHabitStreak(habit, today);
  const weeklyProgress = calculateWeeklyProgress(habit, getDaysOfWeek(today));
  const [editData, setEditData] = useState({
    name: habit.name,
    difficulty: habit.difficulty,
    type: habit.type,
    target: habit.target
  });

  const difficultyStyles = {
    easy: {
      colors: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      glow: '',
      label: 'EASY'
    },
    medium: {
      colors: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      glow: '',
      label: 'MEDIUM'
    },
    hard: {
      colors: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
      glow: 'shadow-[0_0_15px_rgba(244,63,94,0.3)]',
      label: 'HARD'
    }
  };

  const currentDiff = difficultyStyles[habit.difficulty];

  const handleSave = () => {
    if (editData.name.trim()) {
      onUpdate({ 
        name: editData.name,
        difficulty: editData.difficulty,
        type: editData.type,
        target: editData.target,
        xpValue: XP_MAP[editData.difficulty]
      });
    }
    setShowEditModal(false);
  };

  const handleDelete = () => {
    onDelete();
    setShowDeleteModal(false);
  };

  return (
    <>
      <motion.div 
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300",
          isCompletedToday 
            ? "bg-accent/[0.08] border-accent/30 pr-6" 
            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
        )}
      >
        <button 
          onClick={onToggleToday}
          className={cn(
            "w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-500 shrink-0",
            isCompletedToday 
              ? "bg-accent border-accent text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]" 
              : "bg-white/5 border-white/10 text-white/20 group-hover:border-white/30 group-hover:text-white/40"
          )}
        >
          <CheckCircle2 className={cn("w-6 h-6 transition-transform", isCompletedToday ? "scale-110" : "scale-90 opacity-0 group-hover:opacity-100")} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 overflow-x-auto no-scrollbar">
            <motion.span 
              animate={habit.difficulty === 'hard' ? {
                boxShadow: [
                  '0 0 0px rgba(244,63,94,0)',
                  '0 0 12px rgba(244,63,94,0.4)',
                  '0 0 0px rgba(244,63,94,0)'
                ]
              } : {}}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className={cn(
                "text-[7px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded border whitespace-nowrap",
                currentDiff.colors
              )}
            >
              {currentDiff.label}
            </motion.span>
            <div className={cn(
              "flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border text-[7px] font-black uppercase tracking-widest whitespace-nowrap",
              habit.type === 'daily' ? "bg-blue-400/10 border-blue-400/20 text-blue-400" : "bg-purple-400/10 border-purple-400/20 text-purple-400"
            )}>
              {habit.type === 'daily' ? <Calendar className="w-2.5 h-2.5" /> : <Layers className="w-2.5 h-2.5" />}
              {habit.type} {habit.type === 'weekly' && `(${habit.target}/wk)`}
            </div>
            <div className="flex items-center gap-1 text-accent/60 ml-auto">
              <Zap className="w-3 h-3 fill-current" />
              <span className="text-[9px] font-black whitespace-nowrap">{XP_MAP[habit.difficulty]} XP</span>
            </div>
          </div>
          <h3 className={cn(
            "text-sm font-black tracking-widest uppercase transition-all truncate",
            isCompletedToday ? "text-accent italic" : "text-white/80"
          )}>
            {habit.name}
          </h3>
          
          {habit.type === 'weekly' && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${Math.min(100, (weeklyProgress / habit.target) * 100)}%` }}
                   className="h-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                />
              </div>
              <span className="text-[8px] font-black text-white/30 tracking-tighter">
                {weeklyProgress}/{habit.target}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0 relative">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/5 rounded-md transition-all mb-1"
          >
            <MoreVertical className="w-4 h-4 text-text-dim/40" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)} 
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  className="absolute right-0 top-8 z-50 bg-[#1A1D23] border border-white/5 rounded-xl shadow-2xl p-1.5 min-w-[120px]"
                >
                  <button 
                    onClick={() => {
                      setShowEditModal(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black text-white/40 hover:text-white hover:bg-white/5 rounded-lg uppercase tracking-widest"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> EDIT
                  </button>
                  <button 
                    onClick={() => {
                      setShowDeleteModal(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black text-red-500/40 hover:text-red-500 hover:bg-red-500/5 rounded-lg uppercase tracking-widest"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> DELETE
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-lg border",
            derivedStreak > 0 ? "bg-orange-500/10 border-orange-500/20 text-orange-500" : "bg-white/5 border-white/5 text-white/20"
          )}>
            <Flame className={cn("w-3.5 h-3.5", derivedStreak > 0 && "fill-current animate-pulse")} />
            <span className="text-xs font-black italic">{derivedStreak}</span>
          </div>
        </div>
      </motion.div>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-[#111318] border border-white/10 rounded-3xl p-8 shadow-[0_32px_64px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Edit2 className="w-5 h-5 text-accent" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Edit Protocol</h2>
              </div>
              
              <div className="space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar pr-2">
                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3 block">Protocol Name</label>
                  <input 
                    autoFocus
                    value={editData.name}
                    onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-accent/40 focus:bg-accent/5 transition-all outline-none"
                    placeholder="ENTER NAME..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3 block text-center">Difficulty</label>
                    <div className="flex flex-col gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setEditData(prev => ({ ...prev, difficulty: d }))}
                          className={cn(
                            "py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                            editData.difficulty === d 
                              ? "bg-accent border-accent text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)]" 
                              : "bg-white/[0.02] border-white/5 text-white/30 hover:border-white/20"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3 block text-center">Schedule</label>
                    <div className="flex flex-col gap-2">
                      {(['daily', 'weekly'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setEditData(prev => ({ ...prev, type: t }))}
                          className={cn(
                            "py-2.5 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2",
                            editData.type === t 
                              ? "bg-accent border-accent text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)]" 
                              : "bg-white/[0.02] border-white/5 text-white/30 hover:border-white/20"
                          )}
                        >
                          {t === 'daily' ? <Calendar className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {editData.type === 'weekly' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3 block">Weekly Target</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="range"
                          min="1"
                          max="7"
                          value={editData.target}
                          onChange={(e) => setEditData(prev => ({ ...prev, target: parseInt(e.target.value) }))}
                          className="flex-1 accent-accent"
                        />
                        <span className="w-12 text-center text-sm font-black text-accent bg-accent/10 border border-accent/20 py-1 rounded-lg">
                          {editData.target}x
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => {
                      setShowEditModal(false);
                      setEditData({
                        name: habit.name,
                        difficulty: habit.difficulty,
                        type: habit.type,
                        target: habit.target
                      });
                    }}
                    className="flex-1 py-4 text-[10px] font-black text-white/30 hover:text-white uppercase tracking-widest transition-colors"
                  >
                    Abort
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={!editData.name.trim()}
                    className="flex-1 bg-accent py-4 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest shadow-[0_10px_30px_rgba(59,130,246,0.3)] hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
                  >
                    Update
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-[#111318] border border-white/10 rounded-3xl p-8 shadow-[0_32px_64px_rgba(0,0,0,0.8)]"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Terminate Protocol?</h2>
              </div>
              
              <div className="space-y-8">
                <p className="text-xs text-white/40 leading-relaxed">
                  This action will permanently delete <span className="text-white font-black italic">"{habit.name}"</span> and all associated completion data. This cannot be undone.
                </p>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 py-4 text-[10px] font-black text-white/30 hover:text-white uppercase tracking-widest transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex-1 bg-red-500 py-4 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest shadow-[0_10px_30px_rgba(239,68,68,0.3)] hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
