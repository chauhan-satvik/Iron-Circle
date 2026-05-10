import React, { useState } from 'react';
import { Habit, HabitDifficulty, HabitType, DayCompletion } from '../types';
import { Plus, Target, Hash } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import HabitItem from './HabitItem';
import { format } from 'date-fns';

interface HabitRegistryProps {
  habits: Habit[];
  onAddHabit: (name: string, difficulty: HabitDifficulty, type: HabitType, target: number) => void;
  onUpdateHabit: (habitId: string, updates: Partial<Habit>) => void;
  onDeleteHabit: (habitId: string) => void;
  onToggleHabit: (habitId: string, e: React.MouseEvent) => void;
  completions: DayCompletion[];
  today: Date;
}

export default function HabitRegistry({ 
  habits, 
  onAddHabit, 
  onUpdateHabit, 
  onDeleteHabit, 
  onToggleHabit, 
  completions,
  today 
}: HabitRegistryProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [difficulty, setDifficulty] = useState<HabitDifficulty>('medium');
  const [type, setType] = useState<HabitType>('daily');
  const [target, setTarget] = useState(3);

  const todayStr = format(today, 'yyyy-MM-dd');
  const todayCompletions = completions.find(c => c.date === todayStr)?.completions || {};

  const MAX_HABITS = 6;
  const canAdd = habits.length < MAX_HABITS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && canAdd) {
      onAddHabit(newName.trim(), difficulty, type, type === 'daily' ? 7 : target);
      setNewName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-black text-white/40 uppercase tracking-[0.3em]">Habit Registry</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-[9px] font-black uppercase tracking-widest",
            canAdd ? "text-white/20" : "text-red-500/60"
          )}>
            {habits.length}/{MAX_HABITS}
          </span>
          <button 
            disabled={!canAdd && !isAdding}
            onClick={() => setIsAdding(!isAdding)}
            className={cn(
              "p-2 rounded-xl transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
              isAdding ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-accent/10 text-accent hover:bg-accent/20"
            )}
          >
            <Plus className={cn("w-5 h-5 transition-transform", isAdding && "rotate-45")} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleSubmit}
            className="overflow-hidden space-y-4"
          >
            <div className="p-5 sm:p-6 bg-white/[0.03] border border-white/5 rounded-3xl space-y-5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 bg-accent/5 blur-[40px] rounded-full -mr-6 -mt-6" />
              
              <div className="space-y-4 relative z-10">
                <div>
                  <label className="text-[8px] font-black text-text-dim/40 uppercase tracking-[0.2em] mb-2 block">Protocol Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="DEFINE HABIT..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-xs font-black tracking-widest focus:outline-none focus:border-accent/40 transition-all uppercase placeholder:text-text-dim/10"
                    autoFocus
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[8px] font-black text-text-dim/40 uppercase tracking-[0.2em] mb-2 block">Habit Type</label>
                    <div className="flex gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5">
                      {(['daily', 'weekly'] as HabitType[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={cn(
                            "flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all",
                            type === t ? "bg-accent text-white shadow-lg" : "text-text-dim/40 hover:text-text-dim"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  {type === 'weekly' && (
                    <div>
                      <label className="text-[8px] font-black text-text-dim/40 uppercase tracking-[0.2em] mb-2 block">Target Days/Wk</label>
                      <div className="flex items-center gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                        <button 
                          type="button" 
                          onClick={() => setTarget(Math.max(1, target - 1))}
                          className="w-8 h-8 flex items-center justify-center text-text-dim hover:text-white"
                        >-</button>
                        <span className="flex-1 text-center text-[10px] font-black text-accent">{target}</span>
                        <button 
                          type="button" 
                          onClick={() => setTarget(Math.min(6, target + 1))}
                          className="w-8 h-8 flex items-center justify-center text-text-dim hover:text-white"
                        >+</button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[8px] font-black text-text-dim/40 uppercase tracking-[0.2em] mb-2 block">Difficulty Magnitude</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['easy', 'medium', 'hard'] as HabitDifficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={cn(
                          "py-2 text-[8px] font-black uppercase tracking-widest rounded-xl border transition-all",
                          difficulty === d 
                            ? "bg-accent border-accent text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                            : "bg-white/5 border-white/10 text-text-dim hover:border-white/20"
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-accent text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-accent/90 transition-all shadow-xl disabled:opacity-50 relative z-10"
                disabled={!newName.trim()}
              >
                INITIALIZE HABIT
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {habits.length === 0 ? (
          <div className="p-12 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-4">
            <Hash className="w-8 h-8 text-white/5" />
            <p className="text-[10px] font-black text-text-dim/20 uppercase tracking-widest max-w-[150px]">
              No active habits in neural pathway.
            </p>
          </div>
        ) : (
          habits.map(habit => (
            <HabitItem 
              key={habit.id} 
              habit={habit}
              isCompletedToday={!!todayCompletions[habit.id]}
              completions={completions}
              today={today}
              onToggleToday={(e) => onToggleHabit(habit.id, e)}
              onUpdate={(updates) => onUpdateHabit(habit.id, updates)}
              onDelete={() => onDeleteHabit(habit.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
