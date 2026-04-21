'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getDisplayScore } from '@/lib/scoring';

type Stage = 'idle' | 'uploading' | 'transcribing' | 'assessing' | 'done' | 'error';

interface Assessment {
  score: number;
  strengths: string[];
  improvements: string[];
  summary: string;
}

interface UploadResult {
  session: { id: string };
  assessment: Assessment;
  transcript: string;
}

function ScoreBadge({ score }: { score: number }) {
  const display = getDisplayScore({ score });
  const color = display.score >= 80 ? 'text-emerald-400 border-emerald-500/40' : display.score >= 60 ? 'text-yellow-400 border-yellow-500/40' : 'text-red-400 border-red-500/40';
  return (
    <div className={`w-24 h-24 rounded-full border-2 ${color} flex flex-col items-center justify-center shrink-0`}>
      <span className={`text-4xl font-bold ${color.split(' ')[0]}`}>{display.score}</span>
      <span className="text-xs text-gray-600">/100</span>
    </div>
  );
}

function stageLabel(stage: Stage): string {
  switch (stage) {
    case 'uploading':    return 'Uploading recording…';
    case 'transcribing': return 'Transcribing audio…';
    case 'assessing':    return 'Analyzing performance…';
    default:             return '';
  }
}

export default function RecordingsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile]         = useState<File | null>(null);
  const [consent, setConsent]   = useState(false);
  const [stage, setStage]       = useState<Stage>('idle');
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<UploadResult | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const busy = stage === 'uploading' || stage === 'transcribing' || stage === 'assessing';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
    setResult(null);
    setStage('idle');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !consent) return;

    setError(null);
    setResult(null);
    setStage('uploading');

    const form = new FormData();
    form.append('audio', file, file.name);
    form.append('consent', 'true');

    try {
      setStage('transcribing');
      const res = await fetch('/api/recordings/upload', { method: 'POST', body: form });
      setStage('assessing');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setResult(data);
      setStage('done');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setStage('error');
    }
  }

  const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : null;

  return (
    <AppShell>

      {/* Header */}
      <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
          <button onClick={() => router.push('/sessions')} className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Sessions
          </button>
          <h1 className="text-sm font-semibold text-white">Analyze Field Recording</h1>
          <div className="w-24" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">

        {stage !== 'done' && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1">Upload a Field Recording</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Upload a real call or knock-and-talk recording. We&apos;ll transcribe the audio and give you an AI-powered performance assessment — just like a live training session.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* File picker */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Recording File</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                    file
                      ? 'border-blue-500/50 bg-blue-500/5'
                      : 'border-white/15 hover:border-white/30 hover:bg-white/5'
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/m4a"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={busy}
                  />
                  {file ? (
                    <div>
                      <p className="text-base font-semibold text-white">{file.name}</p>
                      <p className="text-sm text-gray-500 mt-1">{fileSizeMB} MB · Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-4xl mb-3">🎤</p>
                      <p className="text-sm font-medium text-gray-300">Click to select a recording</p>
                      <p className="text-xs text-gray-600 mt-1">MP3, WAV, or M4A · max 50 MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Consent checkbox */}
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={e => setConsent(e.target.checked)}
                    disabled={busy}
                    className="mt-0.5 w-4 h-4 rounded border-amber-500/50 bg-gray-800 accent-amber-500 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-amber-300 mb-1">Recording Consent</p>
                    <p className="text-sm text-amber-200/70 leading-relaxed">
                      I confirm that all parties recorded in this audio file have given their consent to be recorded, or that this recording was made in a one-party consent state where I am a participant in the conversation. I understand this recording will be transcribed and analyzed by AI.
                    </p>
                  </div>
                </label>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Progress */}
              {busy && (
                <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="text-sm text-blue-300">{stageLabel(stage)}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!file || !consent || busy}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
              >
                {busy ? 'Processing…' : 'Transcribe & Analyze'}
              </button>
            </form>
          </>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {stage === 'done' && result && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <div>
                <h2 className="text-2xl font-bold text-white">Assessment Complete</h2>
                <p className="text-sm text-gray-500 mt-0.5">{file?.name}</p>
              </div>
            </div>

            {/* Score + summary */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <ScoreBadge score={result.assessment.score} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coaching Note</p>
                <p className="text-sm text-gray-300 leading-relaxed italic">&ldquo;{result.assessment.summary}&rdquo;</p>
              </div>
            </div>

            {/* Strengths / Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-emerald-500/20 rounded-2xl p-5">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">Strengths</p>
                <ul className="space-y-2">
                  {result.assessment.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-300">
                      <span className="text-emerald-500 font-semibold shrink-0">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gray-900 border border-yellow-500/20 rounded-2xl p-5">
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-3">Focus Areas</p>
                <ul className="space-y-2">
                  {result.assessment.improvements.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-300">
                      <span className="text-yellow-500 font-semibold shrink-0">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Transcript toggle */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowTranscript(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">📝</span>
                  <p className="text-sm font-semibold text-white">Transcript</p>
                </div>
                <span className="text-xs text-gray-500">{showTranscript ? '▲ Hide' : '▼ Show'}</span>
              </button>
              {showTranscript && (
                <div className="border-t border-white/10 px-6 py-5">
                  <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{result.transcript}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push(`/sessions/${result.session.id}`)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors text-center"
              >
                View Full Session →
              </button>
              <button
                onClick={() => {
                  setFile(null);
                  setConsent(false);
                  setStage('idle');
                  setResult(null);
                  setError(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="flex-1 bg-white/10 hover:bg-white/15 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors text-center"
              >
                Analyze Another Recording
              </button>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
