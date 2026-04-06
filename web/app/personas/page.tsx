'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { SCENARIOS, type ScenarioGroup, type ScenarioType } from '@/lib/personas';

interface DBPersona {
  id: string;
  scenario_type: ScenarioType;
  name: string;
  personality_type: string;
  brief_description: string;
  speaker_label: string;
  first_message: string;
  system_prompt: string;
  is_default: boolean;
  created_at: string;
}

const BLANK_FORM = {
  name: '',
  personality_type: '',
  brief_description: '',
  speaker_label: '',
  first_message: '',
  system_prompt: '',
};

const GROUP_LABELS: Record<ScenarioGroup, string> = {
  technician: 'Technician Scenarios',
  bizdev: 'Business Development',
};

const SPEAKER_LABEL_MAP: Record<ScenarioType, string> = {
  homeowner_inbound:             'Homeowner',
  homeowner_facetime:            'Homeowner',
  plumber_lead:                  'Homeowner',
  property_manager:              'Property Manager',
  commercial_property_manager:   'Commercial PM',
  insurance_broker:              'Insurance Broker',
  plumber_bd:                    'Plumber',
  property_manager_discovery:    'Property Manager',
  commercial_pm_discovery:       'Property Manager',
  insurance_broker_discovery:    'Insurance Broker',
  plumber_bd_discovery:          'Plumber',
};

// ─── Field component ─────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-600 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls = "w-full bg-gray-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/60 transition-colors";

// ─── AI Rewrite Panel ─────────────────────────────────────────────────────────

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
          placeholder="Custom instruction… (e.g. make more aggressive)"
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PersonasPage() {
  const router = useRouter();

  const [personasByScenario, setPersonasByScenario] = useState<Record<string, DBPersona[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());

  const [expandedPersonaId, setExpandedPersonaId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<DBPersona | null>(null);
  const [modalScenarioType, setModalScenarioType] = useState<ScenarioType | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPersonas = useCallback(async () => {
    try {
      const res = await fetch('/api/personas');
      const data = await res.json();
      const personas: DBPersona[] = data.personas || [];
      const grouped: Record<string, DBPersona[]> = {};
      SCENARIOS.forEach(s => { grouped[s.type] = []; });
      personas.forEach(p => {
        if (grouped[p.scenario_type]) grouped[p.scenario_type].push(p);
        else grouped[p.scenario_type] = [p];
      });
      setPersonasByScenario(grouped);
    } catch (err) {
      console.error('Failed to load personas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPersonas(); }, [loadPersonas]);

  const toggleScenario = (type: string) => {
    setExpandedScenarios(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const openAdd = (scenarioType: ScenarioType) => {
    setEditingPersona(null);
    setModalScenarioType(scenarioType);
    setForm({ ...BLANK_FORM, speaker_label: SPEAKER_LABEL_MAP[scenarioType] });
    setModalOpen(true);
  };

  const openEdit = (persona: DBPersona) => {
    setEditingPersona(persona);
    setModalScenarioType(persona.scenario_type);
    setForm({
      name: persona.name,
      personality_type: persona.personality_type,
      brief_description: persona.brief_description,
      speaker_label: persona.speaker_label,
      first_message: persona.first_message,
      system_prompt: persona.system_prompt,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPersona(null);
    setModalScenarioType(null);
    setForm(BLANK_FORM);
  };

  const handleSave = async () => {
    if (!form.name || !form.personality_type || !form.first_message || !form.system_prompt) return;
    setSaving(true);
    try {
      if (editingPersona) {
        await fetch(`/api/personas/${editingPersona.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/personas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, scenario_type: modalScenarioType }),
        });
      }
      closeModal();
      await loadPersonas();
    } catch (err) {
      console.error('Failed to save persona:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (persona: DBPersona) => {
    if (!confirm(`Delete "${persona.name}"?`)) return;
    setDeletingId(persona.id);
    try {
      await fetch(`/api/personas/${persona.id}`, { method: 'DELETE' });
      await loadPersonas();
    } catch (err) {
      console.error('Failed to delete persona:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const groups: ScenarioGroup[] = ['technician', 'bizdev'];

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-white transition-colors">
            ← TechRP
          </button>
          <h1 className="text-sm font-semibold text-white">Training Personas</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Training Personas</h2>
          <p className="text-sm text-gray-500">
            AI characters used in voice training calls. Expand a scenario to view or manage its personas.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-600 text-sm">Loading personas…</div>
        ) : (
          <div className="space-y-10">
            {groups.map(group => {
              const groupScenarios = SCENARIOS.filter(s => s.group === group);
              return (
                <div key={group}>
                  <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-4">
                    {GROUP_LABELS[group]}
                  </p>

                  <div className="space-y-2">
                    {groupScenarios.map(scenario => {
                      const personas = personasByScenario[scenario.type] || [];
                      const isExpanded = expandedScenarios.has(scenario.type);

                      return (
                        <div key={scenario.type} className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">

                          {/* Scenario row */}
                          <div className="flex items-center gap-3 px-5 py-3.5">
                            <button
                              className="flex items-center gap-3 flex-1 text-left min-w-0"
                              onClick={() => toggleScenario(scenario.type)}
                            >
                              <span className="text-xl shrink-0">{scenario.icon}</span>
                              <span className="font-semibold text-white text-sm">{scenario.label}</span>
                              <span className="text-xs text-gray-600 bg-white/5 px-2 py-0.5 rounded-full shrink-0">
                                {personas.length}
                              </span>
                              <span className="ml-auto text-gray-600 text-xs shrink-0 pr-2">
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); openAdd(scenario.type); }}
                              className="shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/60 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              + Add
                            </button>
                          </div>

                          {/* Expanded grid */}
                          {isExpanded && (
                            <div className="border-t border-white/10 p-4">
                              {personas.length === 0 ? (
                                <div className="text-center py-8 text-gray-600 text-sm">
                                  No personas yet.{' '}
                                  <button onClick={() => openAdd(scenario.type)} className="text-blue-400 hover:text-blue-300">
                                    Add the first one →
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {personas.map(persona => {
                                    const isPersonaExpanded = expandedPersonaId === persona.id;
                                    return (
                                    <div
                                      key={persona.id}
                                      className="bg-gray-800 border border-white/8 rounded-xl p-4 hover:border-white/20 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <h4 className="text-sm font-semibold text-white leading-tight">{persona.name}</h4>
                                        {persona.is_default && (
                                          <span className="text-xs text-gray-600 shrink-0">default</span>
                                        )}
                                      </div>
                                      <span className="inline-block text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full mb-2">
                                        {persona.personality_type}
                                      </span>
                                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
                                        {persona.brief_description}
                                      </p>

                                      {/* Expanded details */}
                                      {isPersonaExpanded && (
                                        <div className="mb-3 space-y-2 border-t border-white/10 pt-3">
                                          <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Speaker Label</p>
                                            <p className="text-xs text-gray-400">{persona.speaker_label}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Opening Line</p>
                                            <p className="text-xs text-gray-300 italic leading-relaxed">&ldquo;{persona.first_message}&rdquo;</p>
                                          </div>
                                        </div>
                                      )}

                                      <div className="flex gap-3 pt-2.5 border-t border-white/8">
                                        <button
                                          onClick={() => setExpandedPersonaId(isPersonaExpanded ? null : persona.id)}
                                          className="text-xs text-gray-400 hover:text-white font-medium transition-colors"
                                        >
                                          {isPersonaExpanded ? 'Less ▲' : 'Details ▼'}
                                        </button>
                                        <button
                                          onClick={() => openEdit(persona)}
                                          className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDelete(persona)}
                                          disabled={deletingId === persona.id}
                                          className="text-xs text-gray-600 hover:text-red-400 font-medium transition-colors disabled:opacity-40"
                                        >
                                          {deletingId === persona.id ? 'Deleting…' : 'Delete'}
                                        </button>
                                      </div>
                                    </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 pt-8 border-t border-white/10 flex justify-center">
          <button
            onClick={() => router.push('/training')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Start Training →
          </button>
        </div>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/15 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-bold text-white">
                  {editingPersona ? 'Edit Persona' : 'Add Persona'}
                </h2>
                {modalScenarioType && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {SCENARIOS.find(s => s.type === modalScenarioType)?.icon}{' '}
                    {SCENARIOS.find(s => s.type === modalScenarioType)?.label}
                  </p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-white text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-5">
              <Field label="Full Name *">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Linda Chen"
                  className={inputCls}
                />
              </Field>

              <Field label="Personality Type *">
                <input
                  type="text"
                  value={form.personality_type}
                  onChange={e => setForm(f => ({ ...f, personality_type: e.target.value }))}
                  placeholder="e.g. Panicked First-Timer, The Skeptic"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Speaker Label">
                  <input
                    type="text"
                    value={form.speaker_label}
                    onChange={e => setForm(f => ({ ...f, speaker_label: e.target.value }))}
                    placeholder="e.g. Homeowner"
                    className={inputCls}
                  />
                </Field>
                <Field label="Internal Notes">
                  <input
                    type="text"
                    value={form.brief_description}
                    onChange={e => setForm(f => ({ ...f, brief_description: e.target.value }))}
                    placeholder="Brief description"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Opening Line *" hint="What this persona says first when the call connects">
                <textarea
                  value={form.first_message}
                  onChange={e => setForm(f => ({ ...f, first_message: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Hi, yes — I found water in my basement and I don't know what to do..."
                  className={inputCls + ' resize-none'}
                />
              </Field>

              <Field label="System Prompt *" hint="Full AI roleplay instructions — personality, objections, behavior. Not shown to the trainee.">
                <textarea
                  value={form.system_prompt}
                  onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                  rows={12}
                  placeholder="You are playing the role of..."
                  className={inputCls + ' font-mono text-xs leading-relaxed resize-y'}
                />
              </Field>
              <AIRewritePanel
                content={form.system_prompt}
                onRewrite={val => setForm(f => ({ ...f, system_prompt: val }))}
              />
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-gray-900/50">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.personality_type || !form.first_message || !form.system_prompt}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : editingPersona ? 'Save Changes' : 'Add Persona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
