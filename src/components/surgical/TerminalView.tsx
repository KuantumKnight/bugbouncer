"use client";

import React, { useState } from 'react';
import { Terminal, ShieldAlert, ShieldCheck, Shield } from 'lucide-react';

export interface ScanResult {
  id: string;
  timestamp: number;
  message: string;
  confidence: 'High' | 'Medium' | 'Low';
  type: 'mismatch' | 'orphaned' | 'void' | 'success';
}

interface TerminalViewProps {
  results: ScanResult[];
  onCommandSubmit?: (command: string) => void;
}

const ConfidenceBadge = ({ confidence }: { confidence: 'High' | 'Medium' | 'Low' }) => {
  // The globals.css has --color-accent-red, we can use `text-[var(--color-accent-red)]` if needed. Let's use arbitrary for safety.
  const customColors = {
    High: 'bg-[var(--color-accent-red)]/20 text-[var(--color-accent-red)] border-[var(--color-accent-red)]/50',
    Medium: 'bg-[var(--color-zinc-500)]/20 text-[var(--color-zinc-300)] border-[var(--color-zinc-500)]/50',
    Low: 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)] border-[var(--color-accent-green)]/50',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-mono border rounded-full ${customColors[confidence]}`}>
      {confidence}
    </span>
  );
};

export const TerminalView: React.FC<TerminalViewProps> = ({ results, onCommandSubmit }) => {
  const [command, setCommand] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim() && onCommandSubmit) {
      onCommandSubmit(command);
      setCommand('');
    }
  };

  return (
    <div className="w-full max-w-[600px] border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/80 backdrop-blur-md shadow-2xl flex flex-col font-mono text-sm">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <Terminal className="w-4 h-4 text-zinc-400 mr-2" />
        <span className="text-zinc-300 font-medium">BugBouncer Kernel</span>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto max-h-[400px] p-2 space-y-1 custom-scrollbar">
        {results.length === 0 ? (
          <div className="text-zinc-500 p-4 text-center italic">No scan results...</div>
        ) : (
          results.map((res) => (
            <div
              key={res.id}
              onClick={() => setSelectedId(res.id)}
              className={`p-3 rounded flex flex-col gap-2 cursor-pointer transition-colors ${
                selectedId === res.id ? 'bg-zinc-800/80 ring-1 ring-zinc-700' : 'hover:bg-zinc-900/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {res.type === 'success' ? (
                    <ShieldCheck className="w-4 h-4 text-[var(--color-accent-green)]" />
                  ) : res.type === 'void' ? (
                    <Shield className="w-4 h-4 text-[var(--color-zinc-500)]" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-[var(--color-accent-red)]" />
                  )}
                  <span className="text-zinc-200">{res.message}</span>
                </div>
                <ConfidenceBadge confidence={res.confidence} />
              </div>
              <div className="text-zinc-500 text-xs">
                {new Date(res.timestamp).toISOString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Command Palette */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/80">
        <form onSubmit={handleSubmit} className="flex items-center">
          <span className="text-[var(--color-accent-green)] mr-2">❯</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Enter command..."
            className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-600 font-mono"
            spellCheck={false}
          />
        </form>
      </div>
    </div>
  );
};
