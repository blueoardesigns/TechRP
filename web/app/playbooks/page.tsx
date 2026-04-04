'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SCENARIOS, type ScenarioType } from '@/lib/personas';
import type { Database } from '../../../shared/types/database';

type Playbook = Database['public']['Tables']['playbooks']['Row'];

// Scenario metadata — icon + color badge
const SCENARIO_META: Record<string, { icon: string; color: string }> = {
  homeowner_inbound:           { icon: '📞', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  homeowner_facetime:          { icon: '🚪', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
  plumber_lead:                { icon: '🔧', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
  property_manager:            { icon: '🏠', color: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
  commercial_property_manager: { icon: '🏢', color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  insurance_broker:            { icon: '🤝', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  plumber_bd:                  { icon: '🪠', color: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
}

// Ordered scenario types per group (matches training page order)
const TECHNICIAN_TYPES      = SCENARIOS.filter(s => s.group === 'technician').map(s => s.type);
const BIZDEV_COLD_TYPES     = SCENARIOS.filter(s => s.group === 'bizdev' && s.callType === 'cold_call').map(s => s.type);
const BIZDEV_DISCOVERY_TYPES = SCENARIOS.filter(s => s.group === 'bizdev' && s.callType === 'discovery').map(s => s.type);

export default function PlaybooksPage() {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/playbooks')
      .then(r => r.json())
      .then(d => {
        setPlaybooks(d.playbooks ?? []);
        setLoading(false);
      });
  }, []);

  // Group and order playbooks by scenario group, then scenario order
  const byScenario = (types: ScenarioType[]) =>
    types.flatMap(type => playbooks.filter(pb => (pb as any).scenario_type === type));

  const techPlaybooks      = byScenario(TECHNICIAN_TYPES);
  const bizdevColdPlaybooks = byScenario(BIZDEV_COLD_TYPES);
  const bizdevDiscPlaybooks = byScenario(BIZDEV_DISCOVERY_TYPES);
  // Ungrouped (custom playbooks with no scenario_type or unknown types)
  const grouped = new Set([...TECHNICIAN_TYPES, ...BIZDEV_COLD_TYPES, ...BIZDEV_DISCOVERY_TYPES]);
  const otherPlaybooks = playbooks.filter(pb => !grouped.has((pb as any).scenario_type));

  const PlaybookCard = ({ pb }: { pb: Playbook }) => {
    const scenarioType = (pb as any).scenario_type as string | undefined;
    const scenarioConfig = scenarioType ? SCENARIOS.find(s => s.type === scenarioType) : null;
    const meta = scenarioType ? SCENARIO_META[scenarioType] : null;
    const preview = stripMarkdown(pb.content || '');

    return (
      <div
        onClick={() => router.push(`/playbooks/${pb.id}`)}
        className="group bg-gray-900 border border-white/10 hover:border-white/25 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl"
      >
        <div className="flex items-start gap-3 mb-3">
          {meta && (
            <span className="text-2xl leading-none mt-0.5">{meta.icon}</span>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors leading-snug">
              {scenarioConfig?.label ?? pb.name}
            </h2>
            {scenarioConfig && (
              <p className="text-xs text-gray-600 mt-0.5">{scenarioConfig.description}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
          {preview ? preview.slice(0, 140) + (preview.length > 140 ? '…' : '') : 'No content yet.'}
        </p>

        <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
          <span className="text-xs text-gray-600">Updated {formatDate(pb.updated_at)}</span>
          <span className="text-xs text-blue-400 font-medium">View →</span>
        </div>
      </div>
    );
  };

  const Section = ({ label, items }: { label: string; items: Playbook[] }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-4">{label}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(pb => <PlaybookCard key={pb.id} pb={pb} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-white transition-colors">
            ← TechRP
          </button>
          <h1 className="text-sm font-semibold text-white">Playbooks</h1>
          <a
            href={`mailto:tim@blueoardesigns.com?subject=New%20Playbook%20Suggestion&body=Hi%20Tim%2C%0A%0AI%20would%20like%20to%20request%20a%20new%20playbook%20for%20the%20following%20scenario%3A%0A%0A[Describe%20the%20type%20of%20playbook%20you%20need]%0A%0AThanks!`}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium px-3 py-1.5 rounded-lg transition-colors border border-white/10"
          >
            Request Playbook
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-1">Playbooks</h2>
          <p className="text-sm text-gray-500">
            Assessments are graded against the active playbook for each scenario type. Edit them to match how your company sells.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500 text-sm">Loading…</div>
        ) : playbooks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-sm">No playbooks available yet.</p>
          </div>
        ) : (
          <>
            <Section label="Technician Scenarios"                   items={techPlaybooks} />
            <Section label="Business Development — Cold Call"        items={bizdevColdPlaybooks} />
            <Section label="Business Development — Discovery Meeting" items={bizdevDiscPlaybooks} />
            <Section label="Other"                                   items={otherPlaybooks} />
          </>
        )}
      </div>
    </div>
  );
}
