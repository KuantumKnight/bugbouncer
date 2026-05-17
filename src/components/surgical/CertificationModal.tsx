"use client";

import React, { useState, useEffect } from 'react';
import type { FuzzerAnomaly } from '@/kernel/fuzzer/types';
import { 
  X, 
  Copy, 
  Download, 
  Check, 
  Clock, 
  Trash2, 
  Award, 
  RefreshCw,
  FileCode
} from 'lucide-react';

interface AuditRecord {
  audit_id: string;
  timestamp: string;
  stability_score: number;
  schema_coverage: number;
  total_anomalies: number;
  resolved_anomalies: number;
  report_markdown: string;
}

interface ResolvedAnomalyRecord {
  anomaly: FuzzerAnomaly;
  fix_applied: string;
}

interface CertificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  anomalies: FuzzerAnomaly[];
  resolvedAnomalies: ResolvedAnomalyRecord[];
  schemaCoverage: number;
}

const getAnomalyFixPrompt = (anomaly: FuzzerAnomaly): string => {
  let relative_file = 'src/app/page.tsx';
  let fix_instruction = '';
  let target_symbol = 'MyComponent';

  if (anomaly.anomaly_type === 'hydration_mismatch') {
    relative_file = `src/components/${anomaly.component_name}.tsx`;
    target_symbol = anomaly.component_name || 'MyComponent';
    fix_instruction = `Use React's \`useHydrationSafe\` hook or check for browser-only globals (such as \`window\` or \`localStorage\`) during SSR.\nWrap the dynamic rendering segments in a Client-Side checking hook or use standard \`useEffect\` state checks.`;
  } else if (anomaly.anomaly_type === 'coherence_failure') {
    relative_file = `src/hooks/useSharedState.ts`;
    target_symbol = `useCoherenceLock`;
    fix_instruction = `Enforce synchronization by lock-subscribing inside a conditional \`PhaseLockedRendering\` block.\nUse a localized mutex key \`coherence_lock_${anomaly.dependency_id}\` to synchronize parallel hooks.`;
  } else if (anomaly.anomaly_type === 'orphaned_action') {
    relative_file = `src/actions/serverActions.ts`;
    target_symbol = `submitServerAction`;
    fix_instruction = `Guard against premature network disconnects by wrapping the server action invocation in a client-side \`useSafeAction\` boundary that tracks promise execution lifecycle and gracefully rolls back states.`;
  } else if (anomaly.anomaly_type === 'void_payload') {
    relative_file = `src/kernel/fuzzer/shadow_data.ts`;
    target_symbol = `sanitizePayload`;
    fix_instruction = `Introduce shadow data verification filters checking that field \`${anomaly.target_field}\` satisfies regex patterns prior to serialization.`;
  } else if (anomaly.anomaly_type === 'url_state_rot') {
    relative_file = `src/app/page.tsx`;
    target_symbol = `useUrlState`;
    fix_instruction = `Wrap query parameter changes inside transaction gates to prevent state parameters from being dropped or desynced under high network stress.`;
  }

  return `AI Composer: Please apply a Zero-Edit Refactor to fix the ${anomaly.anomaly_type.replace('_', ' ')} in [${relative_file}](${relative_file}).

Step 1. Identify the target symbol \`${target_symbol}\`.
Step 2. Apply this fix strategy:
${fix_instruction}

Ensure that no original types are mutated, and no new external dependencies are imported, maintaining full eligibility for high-performance ejects.`;
};

interface AnomalyQuickFixRowProps {
  anomaly: FuzzerAnomaly;
  index: number;
}

const AnomalyQuickFixRow: React.FC<AnomalyQuickFixRowProps> = ({ anomaly, index }) => {
  const [copied, setCopied] = useState(false);
  const handleCopyFix = () => {
    const prompt = getAnomalyFixPrompt(anomaly);
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="p-2 rounded bg-zinc-950 border border-zinc-900 flex justify-between items-center text-[10px] font-mono hover:border-zinc-800 transition-colors">
      <div className="truncate pr-2">
        <span className="text-red-400 font-semibold">Issue #{index}:</span>
        <span className="text-zinc-400 block truncate capitalize">
          {anomaly.anomaly_type.replace('_', ' ')}
        </span>
      </div>
      <button 
        onClick={handleCopyFix}
        className="shrink-0 p-1.5 hover:bg-zinc-850 hover:text-emerald-400 text-zinc-400 rounded transition-colors"
        title="Copy Cursor Composer prompt"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 animate-bounce" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

export const CertificationModal: React.FC<CertificationModalProps> = ({
  isOpen,
  onClose,
  anomalies,
  resolvedAnomalies,
  schemaCoverage
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [currentRecord, setCurrentRecord] = useState<AuditRecord | null>(null);
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/certification');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.sort((a: AuditRecord, b: AuditRecord) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }
    } catch (err) {
      console.error('Failed to fetch audit history:', err);
    }
  };
  const clearHistory = async () => {
    if (!confirm('Are you sure you want to clear your local audit history? This action is permanent.')) return;
    try {
      const res = await fetch('/api/certification', { method: 'DELETE' });
      if (res.ok) {
        setHistory([]);
        if (activeTab === 'history') {
          setReport(null);
          setCurrentRecord(null);
        }
      }
    } catch (err) {
      console.error('Failed to clear audit history:', err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadData = async () => {
      // Generate report
      setLoading(true);
      try {
        const res = await fetch('/api/certification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: 'proj_bugbouncer_causal',
            framework: 'Next.js 16',
            auth_provider: 'Clerk v6',
            database_provider: 'Supabase Schema',
            anomalies,
            resolved_anomalies: resolvedAnomalies,
            schema_coverage: schemaCoverage,
            seed: 'seed-' + Math.floor(Math.random() * 1000000)
          })
        });

        if (res.ok && !cancelled) {
          const data = await res.json();
          setReport(data.report);
          setCurrentRecord(data.record);
        }
      } catch (err) {
        console.error('Failed to generate certification report:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Fetch history
      if (!cancelled) {
        await fetchHistory();
      }
    };

    loadData();

    return () => { cancelled = true; };
  }, [isOpen, anomalies, resolvedAnomalies, schemaCoverage]);

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!report || !currentRecord) return;
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bugbouncer-stability-certification-${currentRecord.audit_id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleExportWorkspace = async () => {
    if (!report || !currentRecord) return;
    setExporting(true);
    try {
      const res = await fetch('/api/certification/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audit_id: currentRecord.audit_id,
          report_markdown: report
        })
      });
      if (res.ok) {
        setExported(true);
        setTimeout(() => setExported(false), 2000);
      } else {
        console.error('Failed to export composer instructions');
      }
    } catch (err) {
      console.error('Error exporting composer instructions:', err);
    } finally {
      setExporting(false);
    }
  };

  const selectHistoryRecord = (record: AuditRecord) => {
    setReport(record.report_markdown);
    setCurrentRecord(record);
    setActiveTab('current');
  };

  if (!isOpen) return null;

  // Simple parser to make the raw markdown beautiful in our clinical UI
  const renderFormattedMarkdown = (md: string) => {
    const lines = md.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-xl font-bold text-zinc-100 mt-6 mb-3 pb-2 border-b border-zinc-800 tracking-tight flex items-center gap-2">🏆 {line.substring(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        const text = line.substring(3);
        let icon = "📋";
        if (text.includes("Outstanding")) icon = "⚠️";
        if (text.includes("Resolved")) icon = "🛠️";
        if (text.includes("AI Composer")) icon = "🤖";
        if (text.includes("Recommended")) icon = "📋";
        return <h2 key={idx} className="text-md font-semibold text-zinc-200 mt-5 mb-2 flex items-center gap-2">{icon} {text}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-sm font-semibold text-zinc-300 mt-4 mb-2">{line.substring(4)}</h3>;
      }
      if (line.startsWith('> ')) {
        const content = line.substring(2);
        let glowClass = "border-zinc-800 bg-zinc-900/30 text-zinc-400";
        if (content.includes("APPROVED") || content.includes("GRADE A")) {
          glowClass = "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 font-bold shadow-[0_0_15px_rgba(16,185,129,0.05)] animate-pulse";
        } else if (content.includes("ATTENTION REQUIRED") || content.includes("GRADE F")) {
          glowClass = "border-red-500/30 bg-red-500/5 text-red-400 font-bold shadow-[0_0_15px_rgba(239,68,68,0.05)]";
        }
        return (
          <div key={idx} className={`p-3 my-2 border-l-2 rounded-r-md text-xs font-mono ${glowClass}`}>
            {content}
          </div>
        );
      }
      if (line.startsWith('|') && idx > 0 && lines[idx - 1].startsWith('|')) {
        // Table line
        if (line.includes('---')) return null; // skip divider line
        const cols = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        const isHeader = idx === 0 || (idx > 0 && lines[idx - 1].startsWith('#') || lines[idx - 2]?.startsWith('#'));
        return (
          <div key={idx} className={`grid grid-cols-2 py-2 px-4 text-xs font-mono border-b border-zinc-900 ${isHeader ? 'bg-zinc-900/50 text-zinc-400' : 'text-zinc-300'}`}>
            <span>{cols[0]}</span>
            <span className="text-right font-semibold text-zinc-100">{cols[1]}</span>
          </div>
        );
      }
      if (line.startsWith('- [ ]')) {
        return (
          <div key={idx} className="flex items-center gap-2 py-1 text-xs text-zinc-400 font-mono">
            <input type="checkbox" disabled className="rounded border-zinc-800 bg-zinc-950 text-emerald-500" />
            <span>{line.substring(5).trim()}</span>
          </div>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <div key={idx} className="flex items-start gap-2 py-1 text-xs text-zinc-400 font-mono pl-2">
            <span className="text-zinc-600">•</span>
            <span>{line.substring(2)}</span>
          </div>
        );
      }
      if (line.startsWith('```')) {
        if (line.length > 3) {
          // starting code block
          return null; // let the content print cleanly
        }
        return null;
      }
      if (line.trim() === '') return <div key={idx} className="h-2" />;
      
      return <p key={idx} className="text-xs text-zinc-400 leading-relaxed font-mono py-0.5">{line}</p>;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 backdrop-blur-md p-4">
      {/* Container 950px wide, beautiful clinical style matching IDE overlays */}
      <div className="w-full max-w-[950px] h-[650px] bg-zinc-950 border border-zinc-850 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="h-14 border-b border-zinc-900 bg-zinc-900/40 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              <Award className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <span className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                Stability Certification Center
              </span>
              <p className="text-[10px] text-zinc-500 font-mono">FR15 • Notion & Cursor Compatible Auditor</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800/80 rounded-lg transition-all text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="h-11 border-b border-zinc-900/60 bg-zinc-900/15 flex items-center justify-between px-6 shrink-0 text-xs font-mono">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-4 py-2 border-b-2 font-medium transition-all ${
                activeTab === 'current' 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <FileCode className="inline w-3.5 h-3.5 mr-1.5" />
              Certification Report
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 border-b-2 font-medium transition-all ${
                activeTab === 'history' 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Clock className="inline w-3.5 h-3.5 mr-1.5" />
              Audit Log History ({history.length})
            </button>
          </div>
          
          {history.length > 0 && (
            <button 
              onClick={clearHistory}
              className="text-[10px] text-red-500/70 hover:text-red-400 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/10 border border-red-900/20 hover:bg-red-950/20"
            >
              <Trash2 className="w-3 h-3" />
              Clear Local History
            </button>
          )}
        </div>

        {/* Body content */}
        <div className="flex flex-1 overflow-hidden">
          {activeTab === 'current' ? (
            <div className="flex flex-1 overflow-hidden">
              {/* Left sidebar: Quick stats summary of the report */}
              <div className="w-[280px] border-r border-zinc-900 bg-zinc-900/20 p-5 flex flex-col shrink-0">
                {currentRecord && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                      <div className={`absolute top-0 left-0 right-0 h-[2px] ${
                        currentRecord.stability_score >= 90 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />
                      <span className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">Stability score</span>
                      <span className={`text-4xl font-extrabold font-mono tracking-tighter ${
                        currentRecord.stability_score >= 90 ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {currentRecord.stability_score}%
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono mt-2 px-2.5 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                        {currentRecord.stability_score >= 90 ? 'Grade A Certified' : 'Operational Warning'}
                      </span>
                    </div>

                    <div className="space-y-3 font-mono text-[11px]">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Metrics Summary</h4>
                      <div className="flex justify-between border-b border-zinc-900 pb-2">
                        <span className="text-zinc-500">Report ID:</span>
                        <span className="text-zinc-300 font-semibold">{currentRecord.audit_id}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-900 pb-2">
                        <span className="text-zinc-500">Schema Coverage:</span>
                        <span className="text-zinc-300">{currentRecord.schema_coverage}%</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-900 pb-2">
                        <span className="text-zinc-500">Resolved Mismatches:</span>
                        <span className="text-emerald-400 font-semibold">{currentRecord.resolved_anomalies}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-900 pb-2">
                        <span className="text-zinc-500">Unresolved Issues:</span>
                        <span className="text-red-400 font-semibold">{currentRecord.total_anomalies}</span>
                      </div>
                      <div className="flex flex-col gap-1 border-b border-zinc-900 pb-2">
                        <span className="text-zinc-500">Generated Timestamp:</span>
                        <span className="text-zinc-400 text-[10px]">
                          {new Date(currentRecord.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Quick Fix Section rendered inside the left sidebar when anomalies are present */}
                    {anomalies.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                          <span>AI Fix Composer</span>
                          <span className="text-red-400">({anomalies.length})</span>
                        </h4>
                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                          {anomalies.map((anomaly, idx) => (
                            <AnomalyQuickFixRow 
                              key={idx} 
                              anomaly={anomaly} 
                              index={idx + 1} 
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-auto pt-6 flex flex-col gap-2">
                  <button 
                    onClick={handleCopy}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-200 transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 animate-bounce" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                    {copied ? 'Copied to Clipboard' : 'Copy Full Markdown'}
                  </button>

                  <button 
                    onClick={handleExportWorkspace}
                    disabled={exporting}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-200 transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98] disabled:opacity-50"
                    title="Export Cursor/Bolt composer instructions directly to .bugbouncer/composer_instructions.md"
                  >
                    {exported ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                    ) : exporting ? (
                      <RefreshCw className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                    {exported ? 'Instructions Exported' : exporting ? 'Exporting...' : 'Export to Workspace'}
                  </button>
                  
                  <button 
                    onClick={handleDownload}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-[0.98]"
                  >
                    {downloaded ? <Check className="w-3.5 h-3.5 text-emerald-950 animate-bounce" /> : <Download className="w-3.5 h-3.5 text-emerald-950" />}
                    {downloaded ? 'Downloaded Report' : 'Download .md File'}
                  </button>
                </div>
              </div>

              {/* Right main area: Rich markdown report preview */}
              <div className="flex-1 bg-[#09090b] flex flex-col overflow-hidden">
                <div className="h-8 border-b border-zinc-900 bg-zinc-950/40 flex items-center justify-between px-4 shrink-0 font-mono text-[10px] text-zinc-500">
                  <span>STABILITY_REPORT.md</span>
                  <span>Notion Compatible Preview</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                      <span className="text-zinc-500 font-mono text-xs animate-pulse">Running full fuzzer scan and generating certification report...</span>
                    </div>
                  ) : report ? (
                    <div className="max-w-[650px] mx-auto prose prose-invert prose-xs selection:bg-emerald-500/20">
                      {renderFormattedMarkdown(report)}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 italic font-mono text-xs">
                      No report loaded. Click generate to construct report.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* History view list */
            <div className="flex-1 bg-zinc-950 flex flex-col overflow-hidden p-6">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <span className="text-xs font-mono text-zinc-500">Audit execution ledger residing at `.bugbouncer/audit_history.json`</span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 italic font-mono text-xs border border-dashed border-zinc-900 rounded-2xl bg-zinc-900/10">
                    <Clock className="w-6 h-6 text-zinc-700 mb-2" />
                    No stability history recorded. Run your first audit scan!
                  </div>
                ) : (
                  history.map((record) => (
                    <div 
                      key={record.audit_id}
                      onClick={() => selectHistoryRecord(record)}
                      className="group p-4 bg-zinc-900/35 hover:bg-zinc-900/70 border border-zinc-900 hover:border-zinc-800 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-300 shadow-md hover:translate-x-0.5"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-xs shadow-sm border ${
                          record.stability_score >= 90 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                          {record.stability_score}%
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100 transition-colors font-mono">
                              {record.audit_id}
                            </span>
                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded font-mono ${
                              record.stability_score >= 90
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/10'
                            }`}>
                              Grade {record.stability_score >= 90 ? 'A' : record.stability_score >= 80 ? 'B' : record.stability_score >= 70 ? 'C' : 'F'}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(record.timestamp).toLocaleString()} • Coverage {record.schema_coverage}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 font-mono text-[11px] text-zinc-400 pr-2">
                        <div className="flex flex-col text-right">
                          <span className="text-zinc-500 text-[9px] uppercase tracking-wider">Unresolved</span>
                          <span className={record.total_anomalies > 0 ? 'text-red-400 font-semibold' : 'text-zinc-500'}>
                            {record.total_anomalies}
                          </span>
                        </div>
                        <div className="flex flex-col text-right border-l border-zinc-800/80 pl-4">
                          <span className="text-zinc-500 text-[9px] uppercase tracking-wider">Stabilized</span>
                          <span className="text-emerald-400 font-semibold">{record.resolved_anomalies}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
