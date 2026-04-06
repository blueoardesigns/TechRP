'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import type { Database } from '../../../../shared/types/database';

type Playbook = Database['public']['Tables']['playbooks']['Row'];

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

type FormatType = 'bold' | 'italic' | 'h2' | 'bullet' | 'numbered';

function applyFormatting(
  type: FormatType,
  content: string,
  selStart: number,
  selEnd: number
): { value: string; cursorStart: number; cursorEnd: number } {
  const lineStart = content.lastIndexOf('\n', selStart - 1) + 1;

  switch (type) {
    case 'bold': {
      const sel = content.slice(selStart, selEnd) || 'bold text';
      const out = `**${sel}**`;
      return {
        value: content.slice(0, selStart) + out + content.slice(selEnd),
        cursorStart: selStart + 2,
        cursorEnd: selStart + 2 + sel.length,
      };
    }
    case 'italic': {
      const sel = content.slice(selStart, selEnd) || 'italic text';
      const out = `*${sel}*`;
      return {
        value: content.slice(0, selStart) + out + content.slice(selEnd),
        cursorStart: selStart + 1,
        cursorEnd: selStart + 1 + sel.length,
      };
    }
    case 'h2': {
      const prefix = '## ';
      return {
        value: content.slice(0, lineStart) + prefix + content.slice(lineStart),
        cursorStart: selStart + prefix.length,
        cursorEnd: selEnd + prefix.length,
      };
    }
    case 'bullet': {
      const prefix = '- ';
      return {
        value: content.slice(0, lineStart) + prefix + content.slice(lineStart),
        cursorStart: selStart + prefix.length,
        cursorEnd: selEnd + prefix.length,
      };
    }
    case 'numbered': {
      const prefix = '1. ';
      return {
        value: content.slice(0, lineStart) + prefix + content.slice(lineStart),
        cursorStart: selStart + prefix.length,
        cursorEnd: selEnd + prefix.length,
      };
    }
  }
}

const QUICK_ACTIONS = [
  'Add bullet points',
  'Summarize',
  'Make more concise',
  'Expand with examples',
  'Add objection handling',
] as const;

function AIRewritePanel({ content, onRewrite }: { content: string; onRewrite: (c: string) => void }) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [rewriting, setRewriting] = useState(false);

  const runRewrite = async (prompt: string) => {
    if (!prompt.trim() || rewriting) return;
    setRewriting(true);
    try {
      const res = await fetch('/api/ai/rewrite-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, prompt }),
      });
      const data = await res.json();
      if (data.content) onRewrite(data.content);
      else console.error('AI rewrite error:', data.error);
    } catch (e) {
      console.error('AI rewrite failed:', e);
    } finally {
      setRewriting(false);
    }
  };

  return (
    <div className="border border-white/10 rounded-xl p-4 bg-gray-900/50 space-y-3 mt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Rewrite</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action}
            type="button"
            onClick={() => runRewrite(action)}
            disabled={rewriting}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-blue-500/50 hover:text-blue-400 transition-colors disabled:opacity-40"
          >
            {rewriting ? '…' : action}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { runRewrite(customPrompt); setCustomPrompt(''); } }}
          placeholder="Custom instruction… (e.g. rewrite for plumbers)"
          disabled={rewriting}
          className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/60 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => { runRewrite(customPrompt); setCustomPrompt(''); }}
          disabled={rewriting || !customPrompt.trim()}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
        >
          {rewriting ? '…' : 'Rewrite'}
        </button>
      </div>
    </div>
  );
}

export default function PlaybookDetailPage() {
  const router = useRouter();
  const params = useParams();
  const playbookId = params?.id as string;

  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFormat = (type: FormatType) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { value, cursorStart, cursorEnd } = applyFormatting(
      type, content, ta.selectionStart, ta.selectionEnd
    );
    setContent(value);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  useEffect(() => {
    if (!playbookId) return;
    fetch(`/api/playbooks/${playbookId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.playbook) { setError('Playbook not found'); }
        else {
          setPlaybook(d.playbook);
          setName(d.playbook.name);
          setContent(d.playbook.content);
        }
        setLoading(false);
      })
      .catch(() => { setError('Playbook not found'); setLoading(false); });
  }, [playbookId]);

  const handleCancel = () => {
    setName(playbook?.name || '');
    setContent(playbook?.content || '');
    setIsEditing(false);
    setError(null);
    setPreviewTab('edit');
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
      setPreviewTab('edit');
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!playbook) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">{error || 'Playbook not found'}</p>
          <button onClick={() => router.push('/playbooks')} className="text-sm text-blue-400 hover:text-blue-300">
            ← Back to Playbooks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Sticky header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-gray-950/90 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="max-w-6xl mx-auto px-8 h-14 flex items-center gap-4">
          <button
            onClick={() => isEditing ? handleCancel() : router.push('/playbooks')}
            className="text-sm text-gray-400 hover:text-white transition-colors shrink-0"
          >
            ← {isEditing ? 'Cancel' : 'Playbooks'}
          </button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-white placeholder-gray-600 outline-none border-b border-white/20 focus:border-blue-500 pb-0.5 transition-colors"
                placeholder="Playbook name…"
              />
            ) : (
              <h1 className="text-sm font-semibold text-white truncate">{playbook.name}</h1>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <>
                {/* Mobile: tab toggle */}
                <div className="flex items-center bg-gray-900 border border-white/10 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setPreviewTab('edit')}
                    className={`px-3 py-1 rounded-md transition-colors ${previewTab === 'edit' ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setPreviewTab('preview')}
                    className={`px-3 py-1 rounded-md transition-colors ${previewTab === 'preview' ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                  >
                    Preview
                  </button>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 text-gray-500 hover:text-red-400 text-sm transition-colors disabled:opacity-40"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="max-w-6xl mx-auto px-8 pt-4 w-full">
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────────────── */}
      {isEditing ? (
        /* Split editor — editor left, live preview right */
        <div className="flex-1 flex overflow-hidden max-w-6xl w-full mx-auto px-8 py-6 gap-6">

          {/* Editor panel */}
          <div className={`flex flex-col flex-1 min-w-0 ${previewTab === 'preview' ? 'hidden lg:flex' : 'flex'}`}>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Markdown</p>
            {/* Formatting toolbar */}
            <div className="flex items-center gap-1 mb-2">
              {([
                { type: 'bold'     as FormatType, label: 'B',  title: 'Bold'          },
                { type: 'italic'   as FormatType, label: 'I',  title: 'Italic'        },
                { type: 'h2'       as FormatType, label: 'H2', title: 'Heading'       },
                { type: 'bullet'   as FormatType, label: '•',  title: 'Bullet list'   },
                { type: 'numbered' as FormatType, label: '1.', title: 'Numbered list' },
              ]).map(({ type, label, title }) => (
                <button
                  key={type}
                  type="button"
                  title={title}
                  onMouseDown={e => { e.preventDefault(); handleFormat(type); }}
                  className="px-2.5 py-1 text-xs font-mono font-semibold text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 border border-white/10 hover:border-white/25 rounded-lg transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              className="flex-1 w-full bg-gray-900 border border-white/10 rounded-xl px-5 py-4 font-mono text-sm text-gray-200 leading-relaxed resize-none outline-none focus:border-blue-500/50 transition-colors placeholder-gray-700 min-h-[calc(100vh-12rem)]"
              placeholder="Write your playbook in Markdown…"
              spellCheck={false}
            />
            <AIRewritePanel content={content} onRewrite={setContent} />
          </div>

          {/* Preview panel */}
          <div className={`flex flex-col flex-1 min-w-0 ${previewTab === 'edit' ? 'hidden lg:flex' : 'flex'}`}>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Preview</p>
            <div className="flex-1 bg-gray-900 border border-white/10 rounded-xl px-6 py-5 overflow-y-auto min-h-[calc(100vh-12rem)]">
              <div className="dark-prose">
                <ReactMarkdown>{content || '*Nothing to preview yet…*'}</ReactMarkdown>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Read-only view */
        <div className="flex-1 max-w-4xl mx-auto w-full px-8 py-8">
          <p className="text-xs text-gray-600 mb-6">Last updated {formatDate(playbook.updated_at)}</p>
          <div className="bg-gray-900 border border-white/10 rounded-2xl px-8 py-7">
            <div className="dark-prose">
              <ReactMarkdown>{playbook.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
