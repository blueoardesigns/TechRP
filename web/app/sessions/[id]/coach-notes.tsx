'use client';

import { useEffect, useState, useRef } from 'react';

interface Note {
  id?: string;
  content: string;
  is_shared?: boolean;
  updated_at?: string;
}

export function CoachNotes({ sessionId }: { sessionId: string }) {
  const [note, setNote] = useState<Note | null>(null);
  const [isCoach, setIsCoach] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/notes`)
      .then(r => r.json())
      .then(d => {
        setIsCoach(d.isCoach);
        setNote(d.note);
        setDraft(d.note?.content ?? '');
      });
  }, [sessionId]);

  function scheduleSave(text: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNote(text), 1500);
  }

  async function saveNote(text: string) {
    setSaving(true);
    const res = await fetch(`/api/sessions/${sessionId}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });
    const d = await res.json();
    if (d.note) {
      setNote(d.note);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  async function toggleShare() {
    if (!note) return;
    setToggling(true);
    const res = await fetch(`/api/sessions/${sessionId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_shared: !note.is_shared }),
    });
    const d = await res.json();
    if (d.note) setNote(d.note);
    setToggling(false);
  }

  // Coach view
  if (isCoach) {
    return (
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coach Notes</p>
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs text-gray-600">Saving…</span>}
            {saved && <span className="text-xs text-emerald-500">Saved</span>}
            {note && (
              <button
                onClick={toggleShare}
                disabled={toggling || !draft.trim()}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors disabled:opacity-40 ${
                  note.is_shared
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-red-500/20 hover:text-red-400'
                    : 'bg-gray-800 text-gray-400 hover:bg-blue-500/20 hover:text-blue-400'
                }`}
              >
                {toggling ? '…' : note.is_shared ? 'Shared ✓ (click to unshare)' : 'Share with technician'}
              </button>
            )}
          </div>
        </div>
        <textarea
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            scheduleSave(e.target.value);
          }}
          onBlur={() => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            if (draft !== (note?.content ?? '')) saveNote(draft);
          }}
          placeholder="Add coaching notes for this session… (auto-saved)"
          className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none h-32"
        />
        {note?.is_shared && (
          <p className="text-xs text-emerald-500/80">
            Technician can see these notes. They received a notification.
          </p>
        )}
      </div>
    );
  }

  // User view — only show if shared
  if (!note) return null;

  return (
    <div className="bg-gray-900 border border-blue-500/30 rounded-2xl p-5 space-y-3">
      <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Coaching Feedback</p>
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
      {note.updated_at && (
        <p className="text-xs text-gray-600">
          {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}
