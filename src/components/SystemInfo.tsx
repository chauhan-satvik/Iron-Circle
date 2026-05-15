import React, { useEffect, useState } from 'react';
import { Clock, GitCommit, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';

interface CommitInfo {
  hash: string;
  message: string;
  date: Date;
  url: string;
}

export const SystemInfo: React.FC = () => {
  const [commit, setCommit] = useState<CommitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchCommit = async () => {
      const repo = import.meta.env.VITE_GITHUB_REPO || 'satvikjansari/iron-circle';
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        
        if (data && data[0]) {
          const latest = data[0];
          setCommit({
            hash: latest.sha.substring(0, 7),
            message: latest.commit.message,
            date: new Date(latest.commit.author.date),
            url: latest.html_url
          });
        }
      } catch (err) {
        console.error('Error fetching git commit:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCommit();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-full animate-pulse">
        <Clock className="w-3 h-3 text-accent" />
        <span className="text-[9px] font-black uppercase tracking-tighter text-text-dim">
          Synchronizing Protocol...
        </span>
      </div>
    );
  }

  if (error || !commit) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-full">
        <Clock className="w-3 h-3 text-red-400" />
        <span className="text-[9px] font-black uppercase tracking-tighter text-red-400/60">
          Source Link Offline
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border border-white/5 rounded-lg group transition-all">
        <Clock className="w-3 h-3 text-accent/60" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim/60">
          Sync <span className="text-white/40">{formatDistanceToNow(commit.date)} ago</span>
        </span>
      </div>

      <a 
        href={commit.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-3 py-1.5 bg-white/[0.02] border border-white/5 rounded-lg hover:bg-white/[0.05] transition-all group"
      >
        <GitCommit className="w-3 h-3 text-accent/60" />
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-[9px] font-bold uppercase tracking-tight text-white/40 truncate max-w-[100px] sm:max-w-[180px] group-hover:text-white/60 transition-colors">
            {commit.message}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-accent/30" />
            <span className="text-[8px] font-mono font-black text-accent/40 uppercase tracking-tighter">
              {commit.hash}
            </span>
          </div>
        </div>
        <ExternalLink className="w-2.5 h-2.5 text-white/5 group-hover:text-accent/40 transition-colors" />
      </a>
    </div>
  );
};
