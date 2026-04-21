'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';

interface Metrics {
  totalSessions: number;
  avgScore: string | null;
  activeUsers: number;
  byScenario: Record<string, number>;
}

const SCENARIO_LABELS: Record<string, string> = {
  homeowner_inbound: 'Inbound Call', homeowner_facetime: 'Door Knock',
  plumber_lead: 'Plumber Lead', property_manager: 'Residential PM',
  commercial_property_manager: 'Commercial PM', insurance_broker: 'Insurance',
  plumber_bd: 'Plumber BD', property_manager_discovery: 'Residential PM · Discovery',
  commercial_pm_discovery: 'Commercial PM · Discovery', insurance_broker_discovery: 'Insurance · Discovery',
  plumber_bd_discovery: 'Plumber · Discovery',
};

export default function InsightsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    fetch('/api/insights')
      .then(r => r.json())
      .then(d => setMetrics(d.metrics ?? null))
      .catch(() => setMetrics({ totalSessions: 0, avgScore: null, activeUsers: 0, byScenario: {} }));
  }, []);

  const STAT_CARDS = metrics ? [
    { label: 'Total Sessions', value: metrics.totalSessions },
    { label: 'Avg Score',      value: metrics.avgScore ? `${metrics.avgScore}/100` : '—' },
    { label: 'Active (30d)',   value: metrics.activeUsers },
  ] : [];

  const scenarioEntries = metrics
    ? Object.entries(metrics.byScenario).sort(([, a], [, b]) => b - a)
    : [];
  const maxCount = scenarioEntries.length ? Math.max(...scenarioEntries.map(([, c]) => c)) : 1;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-8">
        <h1 className="text-2xl font-bold">Analytics</h1>

        {!metrics ? (
          <p className="text-gray-500 py-20 text-center">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STAT_CARDS.map(card => (
                <div key={card.label} className="bg-gray-900 border border-white/10 rounded-2xl p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{card.label}</p>
                  <p className="text-3xl font-bold">{card.value}</p>
                </div>
              ))}
            </div>

            {scenarioEntries.length > 0 && (
              <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-300">Sessions by Scenario</h2>
                {scenarioEntries.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-48 shrink-0">{SCENARIO_LABELS[type] ?? type}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {scenarioEntries.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-10">No session data yet.</p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
