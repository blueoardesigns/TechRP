// web/app/admin/notifications/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

interface BroadcastRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  recipient_count: number;
  created_at: string;
}

export default function BroadcastPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'superuser') router.replace('/');
  }, [user, router]);

  const loadHistory = async () => {
    const res = await fetch('/api/admin/notifications/broadcast');
    if (res.ok) {
      const data = await res.json();
      setHistory(data.history ?? []);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) return;
    if (!confirm(`Send this notification to ALL approved users?`)) return;
    setBusy(true);
    const res = await fetch('/api/admin/notifications/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, link: link || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setToast(`Sent to ${data.recipient_count} users`);
      setTimeout(() => setToast(null), 3000);
      setTitle(''); setBody(''); setLink('');
      loadHistory();
    } else {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      setToast(`Error: ${err.error}`);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (!user || user.role !== 'superuser') {
    return <div className="min-h-screen bg-gray-950 text-white p-10">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <header>
          <h1 className="text-2xl font-bold">Global Broadcast</h1>
          <p className="text-sm text-gray-400 mt-1">Send a notification to every approved TechRP user.</p>
        </header>

        <section className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
              placeholder="What's happening?"
              maxLength={120}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm h-24"
              placeholder="More details..."
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Link (optional)</label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
              placeholder="/playbooks or https://..."
            />
          </div>
          <button
            onClick={send}
            disabled={busy || !title.trim() || !body.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {busy ? 'Sending...' : 'Send to all approved users'}
          </button>
          {toast && <p className="text-xs text-emerald-400">{toast}</p>}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">History</h2>
          {history.length === 0 ? (
            <p className="text-xs text-gray-600">No broadcasts yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="bg-gray-900 border border-white/10 rounded-xl p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{h.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{h.body}</p>
                      {h.link && <p className="text-[10px] text-blue-400 mt-1">→ {h.link}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">{new Date(h.created_at).toLocaleDateString()}</p>
                      <p className="text-[10px] text-gray-600">{h.recipient_count} users</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
