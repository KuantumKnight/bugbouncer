"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { LedgerClient } from "@/kernel/bridge/ledger-client";
import { TraceMetadata } from "@/types/trace";
import type { FuzzerAnomaly } from "@/kernel/fuzzer/types";
import { NetworkObserver } from "@/kernel/observers/network";
import { FiberObserver } from "@/kernel/observers/fiber";
import { 
  Activity, 
  Search, 
  RefreshCw,
  ShieldAlert,
  Cpu,
  XCircle,
  Box,
  Award
} from "lucide-react";
import { TerminalView, ScanResult } from "@/components/surgical/TerminalView";
import { IDEDiffOverlay } from "@/components/surgical/IDEDiffOverlay";
import { StabilityPulse } from "@/components/surgical/StabilityPulse";
import { UserButton, useUser } from "@clerk/nextjs";
import { causal_context } from "@/kernel/context";
import { CertificationModal } from "@/components/surgical/CertificationModal";

interface LedgerStatus {
  row_count: number;
  db_size_bytes: number;
  is_encrypted: boolean;
}

const INITIAL_ANOMALIES: FuzzerAnomaly[] = [
  {
    anomaly_type: 'hydration_mismatch',
    component_name: 'AuthButton',
    fiber_id: 'fib_auth',
    expected_state: '{"user":"sarvesh.m@vitstudent.ac.in"}',
    actual_state: '{"user":null}',
    schema_hash: 'sh_hash',
    timestamp: 1715951600000
  },
  {
    anomaly_type: 'coherence_failure',
    dependency_id: 'supabase_client',
    affected_fibers: ['fib_db_1', 'fib_db_2'],
    divergence_delta_ms: 120,
    timestamp: 1715951600000
  },
  {
    anomaly_type: 'url_state_rot',
    original_url: 'http://localhost:3000/dashboard?tab=analytics&user=sarvesh.m%45vitstudent.ac.in&token=sb_secret_key_123',
    mutated_url: 'http://localhost:3000/dashboard?tab=analytics&user=sarvesh.m%45vitstudent.ac.in&token=sb_secret_key_123',
    dropped_params: [],
    timestamp: 1715951600000
  }
];

const INITIAL_RESOLVED_ANOMALIES: { anomaly: FuzzerAnomaly; fix_applied: string }[] = [
  {
    anomaly: {
      anomaly_type: 'void_payload',
      target_field: 'api_token',
      regex_pattern: '.*',
      injected_value: 'sk_live_abcdef1234567890abcdef12',
      timestamp: 1715951600000
    },
    fix_applied: 'usePayloadSanitizer'
  },
  {
    anomaly: {
      anomaly_type: 'orphaned_action',
      request_url: 'http://localhost:3000/api/actions/submit',
      payload: null,
      simulated_failure: 'timeout',
      timestamp: 1715951600000
    },
    fix_applied: 'useSafeAction'
  }
];

export default function BugBouncerDashboard() {
  const { user, isLoaded } = useUser();
  const [traces, setTraces] = useState<TraceMetadata[]>([]);
  const [status, setStatus] = useState<LedgerStatus | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeTrace, setActiveTrace] = useState<TraceMetadata | null>(null);
  
  // Certification Center State
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [anomalies] = useState<FuzzerAnomaly[]>(INITIAL_ANOMALIES);
  const [resolvedAnomalies] = useState(INITIAL_RESOLVED_ANOMALIES);
  const schemaCoverage = 95;

  const ledgerRef = useRef<LedgerClient | null>(null);

  const refreshData = useCallback(async () => {
    if (!ledgerRef.current || !isLoaded) return;
    try {
      const { traces: recent_traces } = await ledgerRef.current.query_traces({
        user_id: user?.id ?? null
      });
      setTraces(recent_traces);
      
      const st = await ledgerRef.current.status();
      setStatus(st);
    } catch (e) {
      console.error(e);
    }
  }, [isLoaded, user]);

  useEffect(() => {
    let active = true;

    const initKernel = async () => {
      try {
        const ledger = new LedgerClient();
        await ledger.ready();
        
        if (!active) return;

        ledgerRef.current = ledger;
        setIsReady(true);

        const network_obs = new NetworkObserver(ledger);
        network_obs.activate();
        
        const fiber_obs = new FiberObserver(ledger);
        fiber_obs.activate();

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
  }, [isLoaded, refreshData]);

  useEffect(() => {
    if (!isLoaded) return;
    if (user?.id) {
      causal_context.set_user_id(user.id);
    } else {
      causal_context.set_user_id(null);
    }
    if (isReady) {
      refreshData();
    }
  }, [isLoaded, user?.id, isReady, refreshData]);

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

  const handleDriftCheck = async (url: string, key: string, local_path?: string) => {
    if (!ledgerRef.current) return;
    try {
      const res = await fetch("/api/drift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supabase_url: url, supabase_key: key, schema_file_path: local_path })
      });
      const data = await res.json();
      
      const has_error = !res.ok || data.error || data.has_drift;
      
      // Manually insert a trace into the ledger
      await ledgerRef.current.insert_trace({
        trace_id: "drift-" + Date.now(),
        span_id: "span-" + Date.now(),
        timestamp_nanos: Date.now() * 1000000,
        event_type: "error", // Using error as it's the closest allowed type for drift mismatch
        payload: {
          request_type: "Drift Check",
          error_message: data.error || (data.has_drift ? `Drift detected: ${(data.mismatches || []).length} mismatches across ${data.scanned_tables_count ?? 0} tables` : undefined),
          error_stack: data.has_drift ? JSON.stringify(data.mismatches || []) : undefined
        },
        stability_score: has_error ? 0.0 : 1.0,
        is_panic_event: !!data.error,
        user_id: user?.id ?? undefined
      });
      
      refreshData();
    } catch (e) {
      console.error("Drift check failed:", e);
    }
  };

  const handleCommand = (cmd: string) => {
    const args = cmd.trim().split(" ");
    switch (args[0]) {
      case "clear":
        setTraces([]);
        break;
      case "refresh":
        refreshData();
        break;
      case "sim:net":
        simulateNetwork();
        break;
      case "sim:err":
        simulateError();
        break;
      case "check:drift":
        if (args.length < 3) {
          console.warn("Usage: check:drift <supabase_url> <supabase_key> [local_schema_path]");
        } else {
          handleDriftCheck(args[1], args[2], args[3]);
        }
        break;
      default:
        console.warn(`Unknown command: ${cmd}`);
    }
  };

  const scanResults: ScanResult[] = traces.map(t => ({
    id: t.trace_id + "-" + t.span_id,
    timestamp: t.timestamp_nanos / 1_000_000,
    message: t.event_type === "network_request" ? `Intercepted ${t.payload.request_method} to ${t.payload.request_url}` :
             t.event_type === "fiber_update" ? `Fiber update on ${t.payload.component_name}` :
             `Event: ${t.event_type}`,
    confidence: t.stability_score > 0.8 ? 'High' : t.stability_score > 0.4 ? 'Medium' : 'Low',
    type: t.stability_score === 1.0 ? 'success' : t.stability_score < 0.5 ? 'mismatch' : 'void'
  }));

  const globalStability = traces.length > 0 
    ? Math.round((traces.reduce((acc, t) => acc + t.stability_score, 0) / traces.length) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans p-6 selection:bg-emerald-500/30">
      <header className="flex justify-between items-center pb-6 border-b border-zinc-800/50 mb-8 max-w-7xl mx-auto">
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
          <div className="pl-2 border-l border-zinc-800 ml-2">
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[600px_1fr] gap-8">
        {/* Left Column: Terminal & Stats */}
        <div className="flex flex-col gap-6">
          <StabilityPulse score={globalStability} />

          {/* Stability Certification Center Quick Action Card */}
          <div className="p-6 bg-zinc-900/40 rounded-2xl border border-zinc-800/80 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <Award className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Stability Certification Center</h3>
                <p className="text-xs text-zinc-500 font-mono">Verify Grade A authority & export Cursor-compatible fix scripts.</p>
              </div>
            </div>
            <div className="flex justify-between items-center bg-zinc-950 px-4 py-2.5 rounded-lg border border-zinc-900">
              <div className="flex gap-4 font-mono text-[10px] text-zinc-400">
                <span>Outstanding: <strong className="text-red-400">{anomalies.length}</strong></span>
                <span>Stabilized: <strong className="text-emerald-400">{resolvedAnomalies.length}</strong></span>
              </div>
              <button 
                onClick={() => setIsCertModalOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-bold rounded transition-colors shadow-[0_0_15px_rgba(16,185,129,0.1)]"
              >
                Open Auditor
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={simulateNetwork} className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded text-sm font-medium transition-colors flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-400" />
              sim:net
            </button>
            <button onClick={simulateError} className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded text-sm font-medium transition-colors flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              sim:err
            </button>
          </div>
          
          <TerminalView results={scanResults} onCommandSubmit={handleCommand} />
        </div>

        {/* Right Column: Ghost Cards */}
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
            <GhostCard 
              key={trace.trace_id + "-" + trace.span_id} 
              trace={trace} 
              onViewDiff={() => setActiveTrace(trace)} 
            />
          ))}
        </div>
      </main>

      <IDEDiffOverlay trace={activeTrace} onClose={() => setActiveTrace(null)} />
      
      <CertificationModal 
        isOpen={isCertModalOpen} 
        onClose={() => setIsCertModalOpen(false)} 
        anomalies={anomalies}
        resolvedAnomalies={resolvedAnomalies}
        schemaCoverage={schemaCoverage}
      />
    </div>
  );
}

function GhostCard({ trace, onViewDiff }: { trace: TraceMetadata, onViewDiff: () => void }) {
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
        <button onClick={onViewDiff} className="px-4 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
          View Diff (Zen Mode)
        </button>
        <button className="px-4 py-1.5 text-sm font-semibold bg-zinc-100 text-zinc-900 rounded hover:bg-white transition-colors shadow-sm">
          Apply Fix (Cmd+Enter)
        </button>
      </div>
    </div>
  );
}
