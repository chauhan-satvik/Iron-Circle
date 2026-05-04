import React, { useState } from 'react';
import { Habit } from '../types';
import { Flame, Star, Zap, TrendingUp, CheckCircle2, MoreVertical, Trash2, Edit2, Calendar, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface HabitItemProps {
  habit: Habit;
  onToggleToday: (e: React.MouseEvent) => void;
  isCompletedToday: boolean;
  onUpdate: (updates: Partial<Habit>) => void;
  onDelete: () => void;
  key?: React.Key;
}

export default function HabitItem({ habit, onToggleToday, isCompletedToday, onUpdate, onDelete }: HabitItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const difficultyColors = {
    easy: 'text-green-400 bg-green-400/10 border-green-400/20',
    medium: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    hard: 'text-red-400 bg-red-400/10 border-red-400/20'
  };

  return (
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
          <span className={cn(
            "text-[7px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded border whitespace-nowrap",
            difficultyColors[habit.difficulty]
          )}>
            {habit.difficulty}
          </span>
          <div className={cn(
            "flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border text-[7px] font-black uppercase tracking-widest whitespace-nowrap",
            habit.type === 'daily' ? "bg-blue-400/10 border-blue-400/20 text-blue-400" : "bg-purple-400/10 border-purple-400/20 text-purple-400"
          )}>
            {habit.type === 'daily' ? <Calendar className="w-2.5 h-2.5" /> : <Layers className="w-2.5 h-2.5" />}
            {habit.type} {habit.type === 'weekly' && `(${habit.target}/wk)`}
          </div>
          <div className="flex items-center gap-1 text-accent/60 ml-auto">
            <Zap className="w-3 h-3 fill-current" />
            <span className="text-[9px] font-black whitespace-nowrap">{habit.xpValue} XP</span>
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
                animate={{ width: `${Math.min(100, (habit.currentStreak / habit.target) * 100)}%` }}
                className="h-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.5)]"
              />
            </div>
            <span className="text-[8px] font-black text-white/30 tracking-tighter">
              {habit.currentStreak}/{habit.target}
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
                    const next = prompt("NEW NAME?", habit.name);
                    if (next) onUpdate({ name: next });
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black text-white/40 hover:text-white hover:bg-white/5 rounded-lg uppercase tracking-widest"
                >
                  <Edit2 className="w-3.5 h-3.5" /> EDIT
                </button>
                <button 
                  onClick={() => {
                    if (confirm("TERMINATE PROTOCOL?")) onDelete();
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
          habit.currentStreak > 0 ? "bg-orange-500/10 border-orange-500/20 text-orange-500" : "bg-white/5 border-white/5 text-white/20"
        )}>
          <Flame className={cn("w-3.5 h-3.5", habit.currentStreak > 0 && "fill-current animate-pulse")} />
          <span className="text-xs font-black italic">{habit.currentStreak}</span>
        </div>
      </div>
    </motion.div>
  );
}
