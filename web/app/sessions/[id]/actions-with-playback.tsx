'use client';

import { useRef } from 'react';
import { RecordingPlayer, type RecordingPlayerHandle } from './recording-player';

interface Action {
  ai_said: string;
  suggested_response: string;
  technique?: string;
  offset_seconds?: number;
}

export function ActionsWithPlayback({
  actions,
  personaName,
  sessionId,
  vapiCallId,
  recordingUrl,
}: {
  actions: Action[];
  personaName: string | null;
  sessionId: string;
  vapiCallId: string | null;
  recordingUrl: string | null;
}) {
  const playerRef = useRef<RecordingPlayerHandle>(null);

  const hasRecording = !!(recordingUrl || vapiCallId);
  const hasTimestamps = actions.some(a => typeof a.offset_seconds === 'number');

  const formatOffset = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Actions list */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Actions to Take</p>
        <ol className="space-y-4">
          {actions.map((a, i) => (
            <li key={i} className="text-sm text-slate-300">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 mb-1">
                    {i + 1}. When <span className="font-semibold text-white">{personaName || 'they'}</span> said:
                  </p>
                  <p className="italic text-slate-400 border-l-2 border-slate-700 pl-3 mb-2">&ldquo;{a.ai_said}&rdquo;</p>
                </div>
                {hasRecording && typeof a.offset_seconds === 'number' && (
                  <button
                    onClick={() => playerRef.current?.seekTo(a.offset_seconds!)}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/20 hover:bg-sky-500/25 transition-colors group"
                    title={`Jump to ${formatOffset(a.offset_seconds)}`}
                  >
                    <svg className="w-3 h-3 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span className="text-[10px] font-mono text-sky-400">{formatOffset(a.offset_seconds)}</span>
                  </button>
                )}
              </div>
              <p className="text-slate-300">
                <span className="text-sky-400 font-semibold">You could have said:</span> &ldquo;{a.suggested_response}&rdquo;
              </p>
              {a.technique && (
                <p className="text-[10px] uppercase tracking-wide text-sky-400/70 mt-1">{a.technique}</p>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Integrated recording player */}
      {hasRecording && hasTimestamps && (
        <div className="sticky bottom-4 bg-slate-900/95 backdrop-blur border border-white/10 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Recording</p>
          <RecordingPlayer
            ref={playerRef}
            sessionId={sessionId}
            vapiCallId={vapiCallId}
            initialUrl={recordingUrl}
          />
        </div>
      )}
    </div>
  );
}
