"use client";

import { useEffect, useState, useRef } from "react";
import { LedgerClient } from "@/kernel/bridge/ledger-client";
import { TraceMetadata } from "@/types/trace";
import { NetworkObserver } from "@/kernel/observers/network";
import { FiberObserver } from "@/kernel/observers/fiber";
import { AlertCircle, Activity, Box, Search, RefreshCw, XCircle, Code, ShieldAlert, Cpu } from "lucide-react";

export default function BugBouncerDashboard() {
  const [traces, setTraces] = useState<TraceMetadata[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  
  const ledgerRef = useRef<LedgerClient | null>(null);

  useEffect(() => {
    let active = true;

    const initKernel = async () => {
      try {
        const ledger = new LedgerClient();
        await ledger.ready();
        
        if (!active) return;

        ledgerRef.current = ledger;
        setIsReady(true);

        // Activate Observers for testing locally
        const network_obs = new NetworkObserver(ledger);
        network_obs.activate();
        
        const fiber_obs = new FiberObserver(ledger);
        fiber_obs.activate();

        // Initial fetch
        refreshData();
      } catch (err) {
        console.error("Failed to initialize Kernel:", err);
      }
    };

    initKernel();

    return () => {
      active = false;
      if (ledgerRef.current) {
        ledgerRef.current.destroy();
      }
    };
  }, []);

  const refreshData = async () => {
    if (!ledgerRef.current) return;
    try {
      const { traces: recent_traces } = await ledgerRef.current.query_traces();
      setTraces(recent_traces);
      
      const st = await ledgerRef.current.status();
      setStatus(st);
    } catch (e) {
      console.error(e);
    }
  };

  const simulateNetwork = () => {
    fetch("https://jsonplaceholder.typicode.com/todos/1")
      .then(res => res.json())
      .then(() => refreshData());
  };

  const simulateError = () => {
    fetch("https://httpstat.us/500")
      .catch(() => refreshData())
      .finally(() => refreshData());
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans p-6 selection:bg-emerald-500/30">
      <header className="flex justify-between items-center pb-6 border-b border-zinc-800/50 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">BugBouncer Kernel</h1>
        </div>
        <div className="flex gap-4 items-center">
          {status && (
            <div className="flex gap-4 text-xs font-mono text-zinc-500 bg-zinc-900 px-4 py-2 rounded-md border border-zinc-800">
              <span>Traces: {status.row_count}</span>
              <span>Size: {(status.db_size_bytes / 1024).toFixed(1)}KB</span>
              <span className={status.is_encrypted ? "text-emerald-400" : "text-amber-400"}>
                {status.is_encrypted ? "AES-256-GCM" : "UNENCRYPTED"}
              </span>
            </div>
          )}
          <button 
            onClick={refreshData}
            className="p-2 hover:bg-zinc-800 rounded-md transition-colors border border-zinc-800"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto space-y-8">
        {/* Test Controls */}
        <div className="flex gap-4 mb-8">
          <button onClick={simulateNetwork} className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded text-sm font-medium transition-colors flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            Fire Fetch Request
          </button>
          <button onClick={simulateError} className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded text-sm font-medium transition-colors flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            Fire 500 Error
          </button>
        </div>

        {/* Trace List (Ghost Hooks style) */}
        <div className="space-y-6">
          {!isReady && (
            <div className="flex justify-center items-center h-32">
              <span className="text-zinc-500 font-mono text-sm animate-pulse">Initializing Causal Ledger...</span>
            </div>
          )}
          
          {traces.length === 0 && isReady && (
            <div className="flex flex-col justify-center items-center h-48 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
              <Cpu className="w-8 h-8 text-zinc-600 mb-3" />
              <span className="text-zinc-500 font-mono text-sm">Waiting for causal traces...</span>
            </div>
          )}

          {traces.map((trace) => (
            <GhostCard key={trace.trace_id + trace.span_id} trace={trace} />
          ))}
        </div>
      </main>
    </div>
  );
}

function GhostCard({ trace }: { trace: TraceMetadata }) {
  const is_error = trace.stability_score < 1.0;
  const is_network = trace.event_type === "network_request";
  
  return (
    <div className="relative w-full bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl overflow-hidden group hover:border-zinc-700 transition-colors">
      {/* Engineered Glow Line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-${is_error ? 'red' : 'emerald'}-500/80 to-transparent opacity-50`} />
      
      <div className="px-6 py-5 border-b border-zinc-800/50 flex justify-between items-start bg-zinc-900/50">
        <div>
          <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2 mb-1">
            {is_error ? <XCircle className="w-4 h-4 text-red-400" /> : <Box className="w-4 h-4 text-emerald-400" />}
            {is_network ? "Network Intercept" : "Fiber Commit"}
            {trace.is_panic_event && <span className="text-[10px] uppercase font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded tracking-wider ml-2">Panic</span>}
          </h3>
          <div className="font-mono text-xs text-zinc-500 flex gap-3">
            <span>Trace ID: {trace.trace_id.split("-")[0]}</span>
            <span>Span ID: {trace.span_id}</span>
            <span>Type: {trace.event_type}</span>
          </div>
        </div>
        <div className="font-mono text-[10px] text-zinc-500 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
          Cmd+Z to eject
        </div>
      </div>

      <div className="p-6 flex gap-6">
        <div className="flex-1">
          <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
            {is_network 
              ? `Causal interception of ${trace.payload.request_method} request to ${trace.payload.request_url}.`
              : `Component re-render traced via React DevTools hook.`}
          </p>
          
          {/* Logic Graph Placeholder */}
          <div className="w-full h-28 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-center relative overflow-hidden">
             {/* Fake connection lines */}
             <svg className="absolute inset-0 w-full h-full opacity-20" aria-hidden="true">
               <path d="M 50 50 Q 150 50 150 80 T 250 80" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className={is_error ? "text-red-500" : "text-emerald-500"} />
             </svg>
             <div className="flex items-center gap-4 z-10">
               <div className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs font-mono text-zinc-300 shadow-lg">Parent Trace</div>
               <div className={`w-8 h-[1px] ${is_error ? 'bg-red-500/50' : 'bg-emerald-500/50'}`}></div>
               <div className={`px-3 py-1.5 bg-zinc-900 border ${is_error ? 'border-red-500/50' : 'border-emerald-500/50'} rounded text-xs font-mono text-zinc-100 shadow-[0_0_10px_rgba(16,185,129,0.1)]`}>
                 {is_network ? trace.payload.request_type : trace.payload.component_name}
               </div>
             </div>
          </div>
        </div>

        {/* Payload / Context Data */}
        <div className="w-[300px] shrink-0 bg-zinc-950 rounded-lg border border-zinc-800/80 p-4 font-mono text-xs overflow-auto max-h-[160px] custom-scrollbar">
          <pre className="text-zinc-400">
            {JSON.stringify(trace.payload, null, 2)}
          </pre>
        </div>
      </div>

      <div className="px-6 py-3 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-3">
        <button className="px-4 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
          View Diff (Zen Mode)
        </button>
        <button className="px-4 py-1.5 text-sm font-semibold bg-zinc-100 text-zinc-900 rounded hover:bg-white transition-colors shadow-sm">
          Apply Fix (Cmd+Enter)
        </button>
      </div>
    </div>
  );
}
