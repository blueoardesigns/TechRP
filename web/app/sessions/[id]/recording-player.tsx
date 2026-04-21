'use client';

import { useEffect, useState } from 'react';

export function RecordingPlayer({ sessionId, vapiCallId, initialUrl }: {
  sessionId: string;
  vapiCallId: string | null;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [loading, setLoading] = useState(!initialUrl && !!vapiCallId);
  const [error, setError] = useState(false);

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
          // Persist to DB so next load is instant
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
}
