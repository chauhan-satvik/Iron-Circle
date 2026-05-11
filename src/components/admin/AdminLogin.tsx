import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const isAdmin = localStorage.getItem('iron_admin') === 'true';
    const expiry = localStorage.getItem('iron_admin_expiry');
    if (isAdmin && expiry && Date.now() < parseInt(expiry)) {
      navigate('/admin');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Artificial delay for cinematic feel
    await new Promise(resolve => setTimeout(resolve, 800));

    const expectedUser = import.meta.env.VITE_ADMIN_USER;
    const expectedPass = import.meta.env.VITE_ADMIN_PASS;

    if (username === expectedUser && password === expectedPass) {
      localStorage.setItem('iron_admin', 'true');
      localStorage.setItem('iron_admin_expiry', (Date.now() + 1000 * 60 * 60).toString());
      navigate('/admin');
    } else {
      setError('Invalid tactical credentials. Access denied.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/5 blur-[120px] rounded-full -mt-40 pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center mb-6 border border-accent/20 shadow-2xl relative group">
            <Shield className="w-10 h-10 text-accent group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute inset-0 rounded-3xl bg-accent/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
            Command Center
          </h1>
          <p className="text-text-dim text-sm font-bold uppercase tracking-[0.2em] mt-2 opacity-60">
            Sector Authorization Required
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-text-dim group-focus-within:text-accent transition-colors">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="USERNAME"
                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                required
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-text-dim group-focus-within:text-accent transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="PASSWORD"
                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all outline-none"
                required
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-xs font-black uppercase tracking-widest leading-relaxed">
                {error}
              </p>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full py-5 bg-accent text-white font-black rounded-2xl transition-all uppercase tracking-[0.2em] shadow-2xl relative overflow-hidden group",
              isLoading ? "opacity-50 cursor-wait" : "hover:scale-[1.02] active:scale-95"
            )}
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              {isLoading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Authorizing...
                </>
              ) : (
                'Gain Access'
              )}
            </span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          </button>
        </form>

        <p className="mt-12 text-center text-[10px] font-black text-white/5 uppercase tracking-[0.5em]">
          Restricted to System Administrators Only
        </p>
      </motion.div>
    </div>
  );
}
