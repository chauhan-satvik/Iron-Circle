import React from 'react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';

interface AvatarProps {
  avatar?: UserProfile['avatar'];
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showStatus?: boolean;
  isOnline?: boolean;
  mood?: string;
}

export default function Avatar({ 
  avatar, 
  name, 
  size = 'md', 
  className,
  showStatus = false,
  isOnline = false,
  mood
}: AvatarProps) {
  const sizes = {
    xs: 'w-6 h-6 text-[8px]',
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-2xl',
  };

  const initials = typeof name === 'string' && name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .map((n) => n ? n[0] : '')
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className={cn("relative inline-block", className)}>
      <div 
        className={cn(
          "rounded-2xl border flex items-center justify-center font-black transition-transform duration-500 overflow-hidden",
          sizes[size],
          !avatar?.color && "bg-white/5 border-white/10 text-white/40"
        )}
        style={{ 
          backgroundColor: avatar?.color ? `${avatar.color}20` : undefined,
          borderColor: avatar?.color ? `${avatar.color}40` : undefined,
          color: avatar?.color || undefined
        }}
      >
        {(avatar?.type === 'initials' || avatar?.type === 'selection') && (
          <span style={{ color: avatar.color }}>{avatar.value || initials}</span>
        )}
        {avatar?.type === 'emoji' && (
          <span>{avatar.value}</span>
        )}
        {avatar?.type === 'image' && (
          <img src={avatar.value} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        )}
        {!avatar && <span>{initials}</span>}
      </div>

      {showStatus && (
        <div className={cn(
          "absolute -bottom-1 -right-1 rounded-full border-4 border-bg-main",
          size === 'xs' || size === 'sm' ? "w-3 h-3 border-2" : "w-4 h-4",
          isOnline ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-white/20"
        )} />
      )}

      {mood && !showStatus && (
        <div className={cn(
          "absolute -bottom-1 -right-1 flex items-center justify-center bg-bg-card border border-white/10 rounded-full shadow-lg",
          size === 'xs' || size === 'sm' ? "w-4 h-4 text-[8px] border-[0.5px]" : size === 'md' ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs"
        )}>
          {mood}
        </div>
      )}
    </div>
  );
}
