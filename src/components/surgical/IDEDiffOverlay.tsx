import React from 'react';
import { X, Code, FileText, Activity } from 'lucide-react';
import { TraceMetadata } from '@/types/trace';

interface IDEDiffOverlayProps {
  trace: TraceMetadata | null;
  onClose: () => void;
}

export const IDEDiffOverlay: React.FC<IDEDiffOverlayProps> = ({ trace, onClose }) => {
  if (!trace) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
      {/* 900x600px container */}
      <div className="w-full max-w-[900px] h-[600px] bg-zinc-950 border border-zinc-800 shadow-2xl rounded-xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="h-12 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <Code className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-zinc-200">
              Diagnostic Mode <span className="text-zinc-600 mx-2">|</span> {trace.trace_id.split('-')[0]}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-md transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Split Pane */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Pane: Diagnostic Sidebar */}
          <div className="w-[300px] border-r border-zinc-800 bg-zinc-900/30 flex flex-col shrink-0">
            <div className="p-4 border-b border-zinc-800/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
                <Activity className="w-3 h-3" />
                Causal Context
              </h3>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Event</span>
                  <span className="text-zinc-300">{trace.event_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Stability</span>
                  <span className={trace.stability_score === 1.0 ? 'text-emerald-400' : 'text-red-400'}>
                    {(trace.stability_score * 100).toFixed(0)}%
                  </span>
                </div>
                {trace.payload.component_name && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Component</span>
                    <span className="text-zinc-300">{trace.payload.component_name as string}</span>
                  </div>
                )}
                {trace.payload.request_url && (
                  <div className="flex flex-col mt-2">
                    <span className="text-zinc-500">Target URL</span>
                    <span className="text-zinc-300 text-xs truncate" title={trace.payload.request_url as string}>
                      {trace.payload.request_url as string}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Payload Dump
              </h3>
              <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap word-break">
                {JSON.stringify(trace.payload, null, 2)}
              </pre>
            </div>
          </div>

          {/* Right Pane: Diff View */}
          <div className="flex-1 bg-[#0d0d0f] flex flex-col overflow-hidden relative">
            <div className="h-8 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center px-4">
              <span className="text-xs font-mono text-zinc-500">ghost_hook_suggestion.patch</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm custom-scrollbar relative">
              {trace.stability_score === 1.0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 italic">
                  No structural diff required. State is stable.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-zinc-500">@@ -15,7 +15,7 @@</div>
                  <div className="text-zinc-300 ml-4">export function DataView(&#123; data &#125;) &#123;</div>
                  
                  {/* FAKE DIFF GENERATION BASED ON TRACE TYPE */}
                  {trace.event_type === "network_request" ? (
                    <>
                      <div className="text-red-400 bg-red-950/30 px-2 py-0.5 border-l-2 border-red-500/50">
                        -  const response = await fetch(&apos;/api/data&apos;);
                      </div>
                      <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 border-l-2 border-emerald-500/50">
                        +  const response = await fetch(&apos;/api/data&apos;, &#123; next: &#123; revalidate: 60 &#125; &#125;);
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-red-400 bg-red-950/30 px-2 py-0.5 border-l-2 border-red-500/50">
                        -  const [state, setState] = useState(data);
                      </div>
                      <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 border-l-2 border-emerald-500/50">
                        +  const state = useMemo(() =&gt; processData(data), [data]);
                      </div>
                    </>
                  )}
                  
                  <div className="text-zinc-300 ml-4">   return &lt;div&gt;&#123;state.value&#125;&lt;/div&gt;;</div>
                  <div className="text-zinc-300 ml-4">&#125;</div>
                </div>
              )}
            </div>
            
            {/* Action Bar */}
            <div className="absolute bottom-6 right-6 flex gap-3">
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm font-medium hover:bg-zinc-800 transition-colors shadow-lg text-zinc-300"
              >
                Discard
              </button>
              <button className="px-4 py-2 bg-emerald-500 text-emerald-950 rounded text-sm font-bold hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                Apply Fix (Cmd+Enter)
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
