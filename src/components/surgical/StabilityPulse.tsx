"use client";

import React from 'react';
import { Activity } from 'lucide-react';

interface StabilityPulseProps {
  score: number; // 0 to 100
  label?: string;
}

export const StabilityPulse: React.FC<StabilityPulseProps> = ({ score, label = "System Stability" }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  
  const getStatusColor = (s: number) => {
    if (s >= 90) return 'text-emerald-400';
    if (s >= 70) return 'text-blue-400';
    if (s >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getStatusGlow = (s: number) => {
    if (s >= 90) return 'shadow-[0_0_20px_rgba(16,185,129,0.3)] border-emerald-500/30';
    if (s >= 70) return 'shadow-[0_0_20px_rgba(59,130,246,0.3)] border-blue-500/30';
    if (s >= 40) return 'shadow-[0_0_20px_rgba(245,158,11,0.3)] border-amber-500/30';
    return 'shadow-[0_0_20px_rgba(239,68,68,0.3)] border-red-500/30';
  };

  const colorClass = getStatusColor(score);
  const glowClass = getStatusGlow(score);

  return (
    <div className={`p-6 bg-zinc-900/50 backdrop-blur-md border rounded-2xl flex items-center gap-6 transition-all duration-500 ${glowClass}`}>
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Background Circle */}
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            className="stroke-zinc-800 fill-none"
            strokeWidth="8"
          />
          {/* Progress Circle */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            className={`fill-none transition-all duration-1000 ease-out ${colorClass.replace('text-', 'stroke-')}`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold font-mono tracking-tighter ${colorClass}`}>
            {score}%
          </span>
        </div>
        
        {/* Pulse Effect */}
        <div className={`absolute inset-0 rounded-full animate-ping opacity-20 pointer-events-none ${colorClass.replace('text-', 'bg-')}`} />
      </div>

      <div className="flex flex-col">
        <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-1 flex items-center gap-2">
          <Activity className="w-3 h-3" />
          {label}
        </span>
        <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">
          {score >= 90 ? 'Grade A Authority' : 
           score >= 70 ? 'Operational Drift' :
           score >= 40 ? 'High Fragility' : 'Critical Instability'}
        </h2>
        <p className="text-zinc-500 text-xs mt-1 font-mono">
          Fuzzer Seeds: 1,024 | Schema Coverage: {score}%
        </p>
      </div>
    </div>
  );
};
