'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import ReactMarkdown from 'react-markdown';
import { marked } from 'marked';
import type { Database } from '../../../../shared/types/database';

type Playbook = Database['public']['Tables']['playbooks']['Row'];

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Convert legacy markdown to HTML for TipTap. Returns HTML as-is if already HTML. */
function toHtml(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) return trimmed; // already HTML
  return marked.parse(trimmed) as string;
}

/** Determine whether content is HTML or markdown for display purposes */
function isHtml(content: string) {
  return content.trim().startsWith('<');
}

const QUICK_ACTIONS = [
  'Add bullet points',
  'Summarize key points',
  'Make more concise',
  'Expand with examples',
  'Add objection handling',
  'Make more persuasive',
] as const;

// ── AI Rewrite Panel ────────────────────────────────────────────────────────

interface AIRewritePanelProps {
  content: string;
  onAccept: (newContent: string) => void;
}

function AIRewritePanel({ content, onAccept }: AIRewritePanelProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [rewriting, setRewriting] = useState(false);
  const [proposal, setProposal] = useState<string | null>(null);
  const [prevContent, setPrevContent] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [error, setError] = useState('');

  const runRewrite = async (prompt: string) => {
    if (!prompt.trim() || rewriting) return;
    setError('');
    setRewriting(true);
    try {
      const res = await fetch('/api/ai/rewrite-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, prompt }),
      });
      const data = await res.json();
      if (!res.ok || !data.content) throw new Error(data.error || 'Rewrite failed');
      setProposal(toHtml(data.content));
    } catch (e: any) {
      setError(e.message || 'AI rewrite failed');
    } finally {
      setRewriting(false);
    }
  };

  const handleAccept = () => {
    if (!proposal) return;
    setPrevContent(content);
    onAccept(proposal);
    setProposal(null);
    setCanUndo(true);
  };

  const handleReject = () => {
    setProposal(null);
  };

  const handleUndo = () => {
    if (prevContent) {
      onAccept(prevContent);
      setPrevContent(null);
      setCanUndo(false);
    }
  };

  return (
    <div className="border border-white/10 rounded-xl bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">✦ AI Rewrite</span>
          {rewriting && (
            <span className="text-xs text-sky-400 animate-pulse">Generating…</span>
          )}
        </div>
        {canUndo && !proposal && (
          <button
            type="button"
            onClick={handleUndo}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            ↺ Undo last rewrite
          </button>
        )}
      </div>

      {/* Quick actions + custom prompt */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action}
              type="button"
              onClick={() => runRewrite(action)}
              disabled={rewriting}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:border-sky-500/50 hover:text-sky-400 transition-colors disabled:opacity-40"
            >
              {action}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { runRewrite(customPrompt); setCustomPrompt(''); } }}
            placeholder="Custom instruction… (e.g. rewrite for plumber referral partners)"
            disabled={rewriting}
            className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-sky-500/60 disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() => { runRewrite(customPrompt); setCustomPrompt(''); }}
            disabled={rewriting || !customPrompt.trim()}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            {rewriting ? '…' : 'Rewrite'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Side-by-side proposal */}
      {proposal !== null && (
        <div className="border-t border-white/10">
          <div className="grid grid-cols-2 divide-x divide-white/10">
            {/* Original */}
            <div className="p-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Original</p>
              <div
                className="dark-prose text-sm max-h-[300px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
            {/* Proposal */}
            <div className="p-4 bg-sky-500/5">
              <p className="text-[10px] font-semibold text-sky-500 uppercase tracking-widest mb-3">AI Proposal</p>
              <div
                className="dark-prose text-sm max-h-[300px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: proposal }}
              />
            </div>
          </div>
          {/* Accept / Reject */}
          <div className="px-5 py-3 border-t border-white/10 flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleReject}
              className="px-4 py-1.5 text-sm text-slate-400 hover:text-white border border-white/10 rounded-lg transition-colors"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="px-4 py-1.5 text-sm bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition-colors"
            >
              Accept changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PlaybookDetailPage() {
  const router = useRouter();
  const params = useParams();
  const playbookId = params?.id as string;

  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');  // HTML while editing
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playbookId) return;
    fetch(`/api/playbooks/${playbookId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.playbook) { setError('Playbook not found'); }
        else {
          setPlaybook(d.playbook);
          setName(d.playbook.name);
          setContent(toHtml(d.playbook.content));
        }
        setLoading(false);
      })
      .catch(() => { setError('Playbook not found'); setLoading(false); });
  }, [playbookId]);

  const handleCancel = () => {
    setName(playbook?.name || '');
    setContent(toHtml(playbook?.content || ''));
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!playbook) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/playbooks/${playbook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content }),
    });
    const d = await res.json();
    if (!res.ok || !d.playbook) {
      setError(d.error || 'Failed to save');
    } else {
      setPlaybook(d.playbook);
      setIsEditing(false);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!playbook) return;
    if (!window.confirm(`Delete "${playbook.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/playbooks/${playbook.id}`, { method: 'DELETE' });
    if (!res.ok) { setError('Failed to delete'); setDeleting(false); }
    else router.push('/playbooks');
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh] text-slate-500 text-sm">
          Loading…
        </div>
      </AppShell>
    );
  }

  if (!playbook) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-slate-400 mb-4">{error || 'Playbook not found'}</p>
            <button onClick={() => router.push('/playbooks')} className="text-sm text-sky-400 hover:text-sky-300">
              ← Back to Playbooks
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>

      {/* ── Sticky header ────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-[#020617]/90 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="max-w-5xl mx-auto px-8 h-14 flex items-center gap-4">
          <button
            onClick={() => isEditing ? handleCancel() : router.push('/playbooks')}
            className="text-sm text-slate-400 hover:text-white transition-colors shrink-0"
          >
            ← {isEditing ? 'Cancel' : 'Playbooks'}
          </button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-white placeholder-slate-600 outline-none border-b border-white/20 focus:border-sky-500 pb-0.5 transition-colors"
                placeholder="Playbook name…"
              />
            ) : (
              <h1 className="text-sm font-semibold text-white truncate">{playbook.name}</h1>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 text-slate-500 hover:text-red-400 text-sm transition-colors disabled:opacity-40"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="max-w-5xl mx-auto px-8 pt-4 w-full">
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      {isEditing ? (
        <div className="max-w-5xl mx-auto w-full px-8 py-6 space-y-5">
          {/* AI Rewrite Panel — full width, at the top */}
          <AIRewritePanel content={content} onAccept={setContent} />

          {/* Rich text editor */}
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Write your playbook here…"
            minHeight="calc(100vh - 28rem)"
          />
        </div>
      ) : (
        /* Read-only view */
        <div className="flex-1 max-w-4xl mx-auto w-full px-8 py-8">
          <p className="text-xs text-slate-600 mb-6">Last updated {formatDate(playbook.updated_at)}</p>
          <div className="bg-slate-900 border border-white/10 rounded-2xl px-8 py-7">
            {isHtml(playbook.content) ? (
              <div
                className="dark-prose"
                dangerouslySetInnerHTML={{ __html: playbook.content }}
              />
            ) : (
              <div className="dark-prose">
                <ReactMarkdown>{playbook.content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}

    </AppShell>
  );
}
