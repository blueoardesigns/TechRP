'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Database } from '../../../shared/types/database';
import { getDisplayScore } from '@/lib/scoring';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard, StatStrip } from '@/components/ui/stat-card';
import { ScoreBadge } from '@/components/ui/score-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, Column } from '@/components/ui/data-table';

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

function formatRelativeDate(d: string): string {
  const now = Date.now();
  const then = new Date(d).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 2) return 'Yesterday';
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getScore(session: TrainingSession): number | null {
  const a = session.assessment as any;
  if (!a) return null;
  const s = typeof a === 'string' ? JSON.parse(a) : a;
  if (typeof s?.score !== 'number') return null;
  return getDisplayScore(s).score;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>(PERIOD_OPTIONS[0]);
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(({ sessions }) => {
        setSessions(sessions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadInsights = useCallback(async () => {
    setInsights(null);
    try {
      const url = selectedPeriod.days ? `/api/insights?days=${selectedPeriod.days}` : '/api/insights';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInsights(data);
    } catch (err) {
      console.error('Failed to load insights:', err);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const filteredSessions = selectedPeriod.days == null
    ? sessions
    : sessions.filter(s => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - selectedPeriod.days!);
        return new Date(s.started_at) >= cutoff;
      });

  return (
    <AppShell>
      <PageHeader
        title="Sessions"
        action={
          <Link
            href="/training"
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Start Training
          </Link>
        }
      />

      <StatStrip>
        <StatCard
          label="Total Sessions"
          value={insights?.sessionCount ?? sessions.length}
        />
        <StatCard
          label="Avg Score"
          value={insights?.avgScore != null ? `${insights.avgScore}` : '—'}
          color={
            insights?.avgScore == null ? 'default' :
            insights.avgScore >= 80 ? 'emerald' :
            insights.avgScore >= 60 ? 'amber' : 'red'
          }
        />
        <StatCard
          label="This Month"
          value={sessions.filter(s => {
            const d = new Date(s.started_at);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }).length}
        />
      </StatStrip>

      {/* Period filter */}
      <div className="px-6 py-3 flex gap-2 flex-wrap border-b border-white/[0.06]">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setSelectedPeriod(opt)}
            className={[
              'px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
              selectedPeriod.label === opt.label
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-500 hover:text-white border border-transparent',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="px-6 py-12 text-center text-slate-500 text-sm animate-pulse">Loading sessions…</div>
      ) : (
        <DataTable
          columns={[
            {
              key: 'scenario',
              header: 'Scenario',
              render: (s) => {
                const meta = SCENARIO_LABELS[s.persona_scenario_type ?? ''] ?? { label: s.persona_scenario_type ?? '—', color: 'bg-slate-800 text-slate-400' };
                return (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>
                    {meta.label}
                  </span>
                );
              },
            },
            {
              key: 'persona',
              header: 'Persona',
              render: (s) => <span className="text-slate-300">{s.persona_name ?? '—'}</span>,
            },
            {
              key: 'date',
              header: 'Date',
              render: (s) => <span className="text-slate-400 text-xs">{formatRelativeDate(s.started_at)}</span>,
            },
            {
              key: 'duration',
              header: 'Duration',
              render: (s) => <span className="text-slate-400 text-xs font-mono">{formatDuration(s.started_at, s.ended_at)}</span>,
            },
            {
              key: 'score',
              header: 'Score',
              render: (s) => {
                const score = getScore(s);
                return score != null ? <ScoreBadge score={score} /> : <span className="text-slate-600 text-xs">—</span>;
              },
            },
            {
              key: 'arrow',
              header: '',
              width: '32px',
              render: () => <span className="text-slate-600">›</span>,
            },
          ] as Column<TrainingSession>[]}
          rows={filteredSessions}
          getKey={(s) => s.id}
          onRowClick={(s) => router.push(`/sessions/${s.id}`)}
          emptyState={
            <EmptyState
              title="No sessions yet"
              description="Start your first training call to see results here."
              action={
                <Link href="/training" className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors">
                  Start Training
                </Link>
              }
            />
          }
        />
      )}
    </AppShell>
  );
}
