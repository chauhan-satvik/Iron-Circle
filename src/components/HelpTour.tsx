import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Zap, 
  Flame, 
  Shield, 
  Timer, 
  Target,
  Layers,
  Activity,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  image?: string;
}

const steps: Step[] = [
  {
    title: "Neural Grid Protocol",
    description: "Welcome to the Iron Circle. This is your tactical dashboard for human optimization. Habits aren't just tasks—they are core protocols for your neural OS.",
    icon: <Shield className="w-6 h-6" />,
    color: "text-accent"
  },
  {
    title: "Mission Profiles",
    description: "Daily habits require constant maintenance—miss one day, and your streak resets to zero. Weekly habits (like the Gym) have targets—complete them any time within the 7-day cycle to maintain consistency.",
    icon: <Target className="w-6 h-6" />,
    color: "text-red-400"
  },
  {
    title: "XP & Leveling",
    description: "Every completion grants Experience Points (XP) based on difficulty. Easy = 10XP, Medium = 25XP, Hard = 50XP. Scale your level by maintaining total system integrity.",
    icon: <Zap className="w-6 h-6" />,
    color: "text-yellow-400"
  },
  {
    title: "Focus Protocol",
    description: "Use the Deep Work Timer to log focus sessions. Every minute of dedicated concentration generates +2 XP. This integrates directly into your neural performance stats.",
    icon: <Timer className="w-6 h-6" />,
    color: "text-cyan-400"
  },
  {
    title: "Consistency Logic",
    description: "The Leaderboard calculates your 'Consistency' globally. It's the ratio of completed protocols vs expected logs since deployment. Stunted performance leads to rank decay. Stay sharp.",
    icon: <Activity className="w-6 h-6" />,
    color: "text-green-400"
  }
];

interface HelpTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpTour({ isOpen, onClose }: HelpTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="help-tour-overlay" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-xl bg-bg-card border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-8 pb-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl bg-white/5", steps[currentStep].color)}>
                  {steps[currentStep].icon}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight uppercase italic">{steps[currentStep].title}</h2>
                  <div className="flex gap-1 mt-1">
                    {steps.map((_, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "h-1 rounded-full transition-all duration-300",
                          i === currentStep ? "w-6 bg-accent" : "w-2 bg-white/10"
                        )} 
                      />
                    ))}
                  </div>
                </div>
              </div>
              <button 
                id="close-tour-btn"
                onClick={onClose}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-text-dim hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 pt-6">
              <div className="min-h-[120px]">
                <p className="text-lg text-text-dim leading-relaxed font-medium">
                  {steps[currentStep].description}
                </p>
              </div>

              <div className="mt-10 flex items-center justify-between">
                <button 
                  id="prev-step-btn"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all",
                    currentStep === 0 ? "opacity-0 pointer-events-none" : "bg-white/5 hover:bg-white/10 text-text-dim"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>

                <button 
                  id="next-step-btn"
                  onClick={nextStep}
                  className="flex items-center gap-2 px-8 py-3 bg-accent hover:bg-accent-light text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all group"
                >
                  {currentStep === steps.length - 1 ? "Initialize Protocol" : "Next Segment"}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Subtle Grid Pattern Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
