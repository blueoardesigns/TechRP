// web/app/sessions/[id]/share-dialog.tsx
'use client';

import { useState } from 'react';

export function ShareDialog({ sessionId, initialToken }: { sessionId: string; initialToken: string | null }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/session/${token}`
    : null;

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    const res = await fetch(`/api/sessions/${sessionId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      const data = await res.json();
      setToken(data.token ?? null);
    }
    setBusy(false);
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const linkedInUrl = url
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-blue-300 hover:text-blue-200 border border-blue-500/40 rounded-md px-3 py-1.5 transition-colors"
      >
        Share
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Share this session</h3>
            <p className="text-xs text-gray-400 mb-5">
              Creates a public link showing the score, feedback, and actions to take. The transcript and recording are not included.
            </p>

            {token && url ? (
              <>
                <div className="flex gap-2 mb-3">
                  <input
                    readOnly
                    value={url}
                    className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200"
                  />
                  <button
                    onClick={copy}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <a
                  href={linkedInUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-[#0A66C2] hover:bg-[#0959a8] text-white text-sm font-semibold rounded-lg py-2.5 mb-3 transition-colors"
                >
                  Share on LinkedIn
                </a>
                <button
                  onClick={() => toggle(false)}
                  disabled={busy}
                  className="w-full text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  {busy ? 'Working...' : 'Revoke public link'}
                </button>
              </>
            ) : (
              <button
                onClick={() => toggle(true)}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors"
              >
                {busy ? 'Creating link...' : 'Create public link'}
              </button>
            )}

            <button
              onClick={() => setOpen(false)}
              className="w-full text-xs text-gray-500 hover:text-gray-300 mt-4 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
