'use client';

import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';

export interface RecordingPlayerHandle {
  seekTo: (seconds: number) => void;
}

export const RecordingPlayer = forwardRef<RecordingPlayerHandle, {
  sessionId: string;
  vapiCallId: string | null;
  initialUrl: string | null;
}>(function RecordingPlayer({ sessionId, vapiCallId, initialUrl }, ref) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [loading, setLoading] = useState(!initialUrl && !!vapiCallId);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      const audio = audioRef.current;
      if (!audio || !url) return;
      audio.currentTime = seconds;
      audio.play().catch(() => {});
    },
  }), [url]);

  useEffect(() => {
    if (initialUrl || !vapiCallId) return;
    fetch('/api/recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: vapiCallId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.recordingUrl) {
          setUrl(d.recordingUrl);
          fetch(`/api/sessions/${sessionId}/recording`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recording_url: d.recordingUrl }),
          }).catch(() => {});
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId, vapiCallId, initialUrl]);

  if (loading) {
    return <p className="text-sm text-slate-500 animate-pulse">Fetching recording…</p>;
  }

  if (url) {
    return (
      <div className="space-y-3">
        <audio
          ref={audioRef}
          controls
          className="w-full rounded-lg [color-scheme:dark]"
          style={{ colorScheme: 'dark' }}
        >
          <source src={url} type="audio/mpeg" />
          <source src={url} type="audio/wav" />
        </audio>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
        >
          Download recording →
        </a>
      </div>
    );
  }

  return (
    <p className="text-sm text-slate-500">
      {error ? 'Recording unavailable (may have expired).' : 'No recording available.'}
    </p>
  );
});
