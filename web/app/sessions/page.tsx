'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import type { Database } from '../../../shared/types/database';
import { SkeletonRow } from '@/components/skeleton';
import { getDisplayScore } from '@/lib/scoring';

type TrainingSession = Database['public']['Tables']['training_sessions']['Row'];

type PeriodOption = { label: string; days: number | null };

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: 'All Time', days: null },
  { label: '7 Days',   days: 7   },
  { label: '15 Days',  days: 15  },
  { label: '30 Days',  days: 30  },
  { label: '60 Days',  days: 60  },
  { label: '90 Days',  days: 90  },
];

const SCENARIO_LABELS: Record<string, { label: string; color: string }> = {
  homeowner_inbound:             { label: 'Inbound Call',              color: 'bg-sky-500/15 text-sky-400' },
  homeowner_facetime:            { label: 'Door Knock',                color: 'bg-violet-500/15 text-violet-400' },
  plumber_lead:                  { label: 'Plumber Lead',              color: 'bg-orange-500/15 text-orange-400' },
  property_manager:              { label: 'Residential PM',            color: 'bg-teal-500/15 text-teal-400' },
  commercial_property_manager:   { label: 'Commercial PM',             color: 'bg-teal-500/15 text-teal-400' },
  insurance_broker:              { label: 'Insurance Broker',          color: 'bg-blue-500/15 text-blue-400' },
  plumber_bd:                    { label: 'Plumber BD',                color: 'bg-amber-500/15 text-amber-400' },
  property_manager_discovery:    { label: 'Residential PM · Discovery', color: 'bg-indigo-500/15 text-indigo-400' },
  commercial_pm_discovery:       { label: 'Commercial PM · Discovery',  color: 'bg-indigo-500/15 text-indigo-400' },
  insurance_broker_discovery:    { label: 'Insurance · Discovery',      color: 'bg-indigo-500/15 text-indigo-400' },
  plumber_bd_discovery:          { label: 'Plumber · Discovery',        color: 'bg-indigo-500/15 text-indigo-400' },
};

interface Insights {
  sessionCount: number;
  avgScore: number | null;
  topStrengths: string[];
  topImprovements: string[];
  summary: string | null;
  period: string;
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'Ongoing';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getScore(session: TrainingSession): number | null {
  const a = session.assessment as any;
  if (!a) return null;
  const s = typeof a === 'string' ? JSON.parse(a) : a;
  if (typeof s?.score !== 'number') return null;
  return getDisplayScore(s).score;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-300';
  if (score >= 60) return 'bg-yellow-500/20 text-yellow-300';
  return 'bg-red-500/20 text-red-300';
}

function scoreBarColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#fbbf24';
  return '#f87171';
}

// ─── Score Trend Chart ────────────────────────────────────────────────────────

function ScoreChart({ sessions }: { sessions: TrainingSession[] }) {
  const scored = sessions
    .filter(s => getScore(s) !== null)
    .slice(0, 30)
    .reverse();

  if (scored.length < 2) return null;

  const scores = scored.map(s => getScore(s) as number);
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  const maxScore = 100;
  const chartH = 80;
  const barW = Math.max(8, Math.min(24, Math.floor(340 / scored.length) - 3));
  const gap = 3;
  const totalW = scored.length * (barW + gap) - gap;

  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Score Trend</h2>
          <p className="text-xs text-gray-500 mt-0.5">Last {scored.length} scored sessions</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{avg}<span className="text-sm font-normal text-gray-500">/100</span></p>
          <p className="text-xs text-gray-500">avg score</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={Math.max(totalW, 300)}
          height={chartH + 20}
          className="block"
        >
          {/* Avg line */}
          <line
            x1={0} y1={chartH - (avg / maxScore) * chartH}
            x2={totalW} y2={chartH - (avg / maxScore) * chartH}
            stroke="#4b5563" strokeWidth="1" strokeDasharray="4 3"
          />

          {/* Bars */}
          {scores.map((score, i) => {
            const x = i * (barW + gap);
            const barH = Math.max(4, (score / maxScore) * chartH);
            const y = chartH - barH;
            return (
              <g key={i}>
                <rect
                  x={x} y={y} width={barW} height={barH}
                  rx={3}
                  fill={scoreBarColor(score)}
                  opacity={0.85}
                />
                {/* Score label on hover via title */}
                <title>{scored[i] ? formatDate(scored[i].started_at) + ' · ' + score + '/100' : ''}</title>
              </g>
            );
          })}

          {/* X-axis baseline */}
          <line x1={0} y1={chartH} x2={totalW} y2={chartH} stroke="#374151" strokeWidth="1" />
        </svg>
      </div>

      <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> 80–100</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 60–79</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;60</span>
        <span className="flex items-center gap-1.5 ml-auto"><span className="inline-block w-5 border-t border-dashed border-gray-500" /> avg</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [insightsOpen, setInsightsOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>(PERIOD_OPTIONS[0]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const [scenarioFilter, setScenarioFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(({ sessions }) => {
        setSessions(sessions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadInsights = useCallback(async (period: PeriodOption) => {
    setInsightsLoading(true);
    setInsights(null);
    try {
      const url = period.days ? `/api/insights?days=${period.days}` : '/api/insights';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInsights(data);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (insightsOpen) loadInsights(selectedPeriod);
  }, [insightsOpen, selectedPeriod, loadInsights]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-white transition-colors">
            ← TechRP
          </button>
          <h1 className="text-sm font-semibold text-white">Training Sessions</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 space-y-6">

        {/* ── Score chart ─────────────────────────────────────────────────────── */}
        {!loading && <ScoreChart sessions={sessions} />}

        {/* ── Insights panel ──────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
          <button
            onClick={() => setInsightsOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🧠</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">AI Training Insights</p>
                <p className="text-xs text-gray-500">Patterns across your sessions, analyzed by AI</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">{insightsOpen ? '▲ Hide' : '▼ Show'}</span>
          </button>

          {insightsOpen && (
            <div className="border-t border-white/10 px-6 pb-6">
              {/* Period picker */}
              <div className="flex items-center gap-2 pt-4 pb-4 flex-wrap">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setSelectedPeriod(opt)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedPeriod.label === opt.label
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {insightsLoading ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Analyzing your training history…
                </div>
              ) : insights ? (
                insights.sessionCount === 0 ? (
                  <p className="text-center py-8 text-gray-500 text-sm">No assessed sessions in this period.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-6 py-3 px-4 bg-blue-600/10 border border-blue-500/20 rounded-xl">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">{insights.sessionCount}</div>
                        <div className="text-xs text-blue-500">Sessions</div>
                      </div>
                      {insights.avgScore !== null && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">{insights.avgScore}<span className="text-xs font-normal text-blue-500">/100</span></div>
                          <div className="text-xs text-blue-500">Avg Score</div>
                        </div>
                      )}
                      <div className="ml-auto text-xs text-gray-500">{insights.period}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4">
                        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">Consistent Strengths</p>
                        <ul className="space-y-2">
                          {insights.topStrengths.map((s, i) => (
                            <li key={i} className="text-sm text-gray-300 flex gap-2">
                              <span className="text-emerald-500 font-semibold shrink-0">{i + 1}.</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4">
                        <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-3">Focus Areas</p>
                        <ul className="space-y-2">
                          {insights.topImprovements.map((s, i) => (
                            <li key={i} className="text-sm text-gray-300 flex gap-2">
                              <span className="text-yellow-500 font-semibold shrink-0">{i + 1}.</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {insights.summary && (
                      <div className="border border-white/10 rounded-xl p-4 bg-white/5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Coaching Note</p>
                        <p className="text-sm text-gray-300 leading-relaxed italic">&quot;{insights.summary}&quot;</p>
                      </div>
                    )}
                  </div>
                )
              ) : null}
            </div>
          )}
        </div>

        {/* ── Sessions list ────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">All Sessions</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/recordings')}
                className="text-xs bg-white/10 hover:bg-white/20 text-gray-300 font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                ↑ Upload Recording
              </button>
              <button
                onClick={() => router.push('/training')}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                + New Session
              </button>
            </div>
          </div>

          {/* ── Filters ── */}
          {!loading && sessions.length > 0 && (() => {
            const presentTypes = Array.from(new Set(sessions.map(s => (s as any).persona_scenario_type).filter(Boolean))) as string[];
            return (
              <div className="px-6 py-3 border-b border-white/5 space-y-2">
                {/* Scenario type filter */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setScenarioFilter('all')}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      scenarioFilter === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                    }`}
                  >
                    All Types
                  </button>
                  {presentTypes.map(type => {
                    const meta = SCENARIO_LABELS[type];
                    if (!meta) return null;
                    return (
                      <button
                        key={type}
                        onClick={() => setScenarioFilter(scenarioFilter === type ? 'all' : type)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          scenarioFilter === type ? meta.color + ' ring-1 ring-inset ring-current/30' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                {/* Date filter */}
                <div className="flex gap-1.5">
                  {(['all', '7d', '30d', '90d'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setDateFilter(f)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        dateFilter === f ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                      }`}
                    >
                      {f === 'all' ? 'All Time' : f === '7d' ? 'Last 7 Days' : f === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {loading ? (
            <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
              {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm mb-4">No training sessions yet.</p>
              <button
                onClick={() => router.push('/training')}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl transition-colors"
              >
                Start your first session
              </button>
            </div>
          ) : (() => {
            // Apply filters
            const now = Date.now();
            const dayMs = 86400000;
            const filtered = sessions.filter(s => {
              if (scenarioFilter !== 'all' && (s as any).persona_scenario_type !== scenarioFilter) return false;
              if (dateFilter !== 'all') {
                const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
                if (now - new Date(s.started_at).getTime() > days * dayMs) return false;
              }
              return true;
            });

            return (
              <div className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 text-sm">No sessions match the selected filters.</div>
                ) : filtered.map(session => {
                  const score = getScore(session);
                  const scenarioType = (session as any).persona_scenario_type as string | undefined;
                  const scenarioMeta = scenarioType ? SCENARIO_LABELS[scenarioType] : undefined;
                  return (
                    <div
                      key={session.id}
                      onClick={() => router.push(`/sessions/${session.id}`)}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 px-5 py-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {scenarioMeta && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${scenarioMeta.color}`}>
                              {scenarioMeta.label}
                            </span>
                          )}
                          {score !== null && (
                            <span className={`text-xs font-bold ${score >= 70 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {score}/100
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs mt-1">{formatDate(session.started_at)}</p>
                        {(session as any).persona_name && (
                          <p className="text-xs text-gray-600 mt-0.5">{(session as any).persona_name}</p>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 sm:ml-4 sm:text-right">
                        {formatDuration(session.started_at, session.ended_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
}
