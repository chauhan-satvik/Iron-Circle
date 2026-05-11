import React from 'react';
import { Habit } from '../types';
import { format, isSameDay } from 'date-fns';
import { cn, getDaysOfWeek } from '../lib/utils';
import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { calculateHabitStreak } from '../lib/habitEngine';

interface HabitGridProps {
  habits: Habit[];
  onToggleCell: (habitId: string, date: string) => void;
  today: Date;
}

export default function HabitGrid({ habits, onToggleCell, today }: HabitGridProps) {
  const currentWeekDays = getDaysOfWeek(today);

  return (
    <div className="w-full bg-bg-card rounded-[2.5rem] border border-border-main overflow-hidden shadow-2xl">
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/[0.03]">
              <th className="p-6 text-left border-r border-white/[0.03] min-w-[180px]">
                <span className="text-[10px] font-black text-text-dim/40 uppercase tracking-[0.3em]">Habit Protocol</span>
              </th>
              {currentWeekDays.map(date => {
                const isToday = isSameDay(date, today);
                return (
                  <th key={date.toString()} className="p-4 min-w-[80px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest",
                        isToday ? "text-accent" : "text-text-dim/60"
                      )}>
                        {format(date, 'EEE')}
                      </span>
                      <span className={cn(
                        "text-sm font-black italic",
                        isToday ? "text-white" : "text-white/40"
                      )}>
                        {format(date, 'd')}
                      </span>
                      {isToday && (
                        <div className="w-1 h-1 rounded-full bg-accent animate-pulse mt-0.5" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {habits.map((habit, habitIndex) => (
              <tr 
                key={habit.id} 
                className={cn(
                  "border-b border-white/[0.03] group/row hover:bg-white/[0.01] transition-colors",
                  habitIndex === habits.length - 1 && "border-b-0"
                )}
              >
                <td className="p-6 border-r border-white/[0.03]">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-black text-white/80 uppercase tracking-widest group-hover/row:text-accent transition-colors">
                      {habit.name}
                    </span>
                    <div className="flex items-center gap-2">
                       <motion.div 
                        animate={habit.difficulty === 'hard' ? {
                          scale: [1, 1.3, 1],
                          opacity: [0.6, 1, 0.6]
                        } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          habit.difficulty === 'easy' ? 'bg-emerald-400' : habit.difficulty === 'medium' ? 'bg-amber-400' : 'bg-rose-400'
                        )} 
                       />
                       <span className="text-[8px] font-black text-text-dim/40 uppercase tracking-tighter">
                         {habit.difficulty} • {calculateHabitStreak(habit, today)}D STREAK
                       </span>
                    </div>
                  </div>
                </td>
                {currentWeekDays.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const isCompleted = !!habit.completions?.[dateStr];
                  const isToday = isSameDay(date, today);
                  const isFuture = date > today && !isToday;
                  const isPast = date < today && !isToday;
                  const isMissed = isPast && !isCompleted;

                  return (
                    <td key={dateStr} className={cn(
                      "p-1 sm:p-2 transition-all duration-500", 
                      isToday && "bg-accent/[0.03] relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-accent after:rounded-full"
                    )}>
                      <div className="flex justify-center p-1 sm:p-2">
                        <motion.button
                          whileHover={isToday ? { scale: 1.1, backgroundColor: 'rgba(255,255,255,0.05)' } : {}}
                          whileTap={isToday ? { scale: 0.95 } : {}}
                          disabled={!isToday}
                          onClick={() => onToggleCell(habit.id, dateStr)}
                          className={cn(
                            "w-8 h-8 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center transition-all duration-500 relative group/cell overflow-hidden",
                            isCompleted 
                              ? "bg-accent border-accent text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                              : isMissed 
                                ? "bg-red-500/[0.05] border-red-500/20 text-red-500/10"
                                : "bg-white/[0.02] border-white/5 text-transparent",
                            !isToday && "opacity-20 cursor-not-allowed border-dashed grayscale",
                            isToday && !isCompleted && "border-accent/40 ring-1 ring-accent/20 animate-pulse hover:border-white/20"
                          )}
                        >
                          {isCompleted ? (
                            <motion.div
                              initial={{ scale: 0, rotate: -45 }}
                              animate={{ scale: 1, rotate: 0 }}
                            >
                              <Check className="w-5 h-5 sm:w-6 h-6 stroke-[3]" />
                            </motion.div>
                          ) : (
                            isToday && (
                              <div className="text-[8px] font-black opacity-0 group-hover/cell:opacity-100 transition-all uppercase tracking-tighter transform translate-y-1 group-hover/cell:translate-y-0 text-white/20">
                                SYNC
                              </div>
                            )
                          )}
                        </motion.button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
