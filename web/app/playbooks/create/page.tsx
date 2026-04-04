'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';

type ObjectionItem = {
  objection: string;
  response: string;
};

type WizardData = {
  name: string;
  description: string;
  openingLine: string;
  first30Seconds: string;
  objections: ObjectionItem[];
  mustMention: string[];
  neverSay: string[];
  closingAsk: string;
  idealOutcome: string;
};

const STEPS = [
  'Basic Info',
  'Opening & Introduction',
  'Common Objections',
  'Key Talking Points',
  'Closing',
  'Review & Generate',
];

export default function CreatePlaybookPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPersonaConfirm, setShowPersonaConfirm] = useState(false);
  const [suggestedScenarios, setSuggestedScenarios] = useState<string[]>([]);
  const [savedPlaybookName, setSavedPlaybookName] = useState('');
  const [savedPlaybookContent, setSavedPlaybookContent] = useState('');

  const [formData, setFormData] = useState<WizardData>({
    name: '',
    description: '',
    openingLine: '',
    first30Seconds: '',
    objections: [{ objection: '', response: '' }],
    mustMention: [''],
    neverSay: [''],
    closingAsk: '',
    idealOutcome: '',
  });

  const updateField = (field: keyof WizardData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateObjection = (index: number, field: keyof ObjectionItem, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.objections];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, objections: updated };
    });
  };

  const addObjection = () => {
    setFormData((prev) => ({
      ...prev,
      objections: [...prev.objections, { objection: '', response: '' }],
    }));
  };

  const removeObjection = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      objections: prev.objections.filter((_, i) => i !== index),
    }));
  };

  const updateListItem = (
    listKey: 'mustMention' | 'neverSay',
    index: number,
    value: string
  ) => {
    setFormData((prev) => {
      const updated = [...prev[listKey]];
      updated[index] = value;
      return { ...prev, [listKey]: updated };
    });
  };

  const addListItem = (listKey: 'mustMention' | 'neverSay') => {
    setFormData((prev) => ({
      ...prev,
      [listKey]: [...prev[listKey], ''],
    }));
  };

  const removeListItem = (listKey: 'mustMention' | 'neverSay', index: number) => {
    setFormData((prev) => ({
      ...prev,
      [listKey]: prev[listKey].filter((_, i) => i !== index),
    }));
  };

  const handleGeneratePlaybook = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/playbook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate playbook');
      }

      const { content } = await response.json();

      const { data, error: saveError } = await (supabase as any)
        .from('playbooks')
        .insert({
          organization_id: user?.organizationId ?? null,
          name: formData.name,
          content: content,
          file_url: null,
          uploaded_by: user?.id ?? null,
        })
        .select()
        .single();

      if (saveError || !data) {
        throw new Error(saveError?.message || 'Failed to save playbook');
      }

      // If coach, offer to seed personas based on AI analysis
      if (user?.role === 'coach') {
        setSavedPlaybookName(formData.name);
        setSavedPlaybookContent(content);
        const res = await fetch('/api/coach/generate-personas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playbookName: formData.name, playbookContent: content }),
        });
        const genData = await res.json();
        if (genData.suggestedTypes?.length) {
          setSuggestedScenarios(genData.suggestedTypes);
          setShowPersonaConfirm(true);
          return; // don't navigate yet
        }
      }

      router.push('/playbooks');
    } catch (err) {
      console.error('Error generating playbook:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Create Playbook</h1>
              <p className="text-gray-600">Step {step} of {STEPS.length}</p>
            </div>
            <button
              onClick={() => router.push('/playbooks')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:underline"
            >
              ← Back to Playbooks
            </button>
          </div>

          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {STEPS.map((label, index) => (
                <div
                  key={label}
                  className={`px-3 py-1 rounded-full text-sm ${
                    index + 1 === step
                      ? 'bg-blue-600 text-white'
                      : index + 1 < step
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {index + 1}. {label}
                </div>
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Playbook Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Water Damage Equipment Drop-off"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brief Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Short summary of the playbook's purpose"
                  className="w-full px-3 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What&apos;s the ideal opening line when meeting a homeowner?
                </label>
                <textarea
                  value={formData.openingLine}
                  onChange={(e) => updateField('openingLine', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What should techs establish in the first 30 seconds?
                </label>
                <textarea
                  value={formData.first30Seconds}
                  onChange={(e) => updateField('first30Seconds', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Common Objections</h2>
                <button
                  onClick={addObjection}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Add Objection
                </button>
              </div>
              {formData.objections.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Objection
                    </label>
                    <input
                      type="text"
                      value={item.objection}
                      onChange={(e) => updateObjection(index, 'objection', e.target.value)}
                      placeholder="I need to think about it"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Best Response
                    </label>
                    <textarea
                      value={item.response}
                      onChange={(e) => updateObjection(index, 'response', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg h-20 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {formData.objections.length > 1 && (
                    <button
                      onClick={() => removeObjection(index)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">What must techs always mention?</h2>
                  <button
                    onClick={() => addListItem('mustMention')}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    + Add
                  </button>
                </div>
                {formData.mustMention.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateListItem('mustMention', index, e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {formData.mustMention.length > 1 && (
                      <button
                        onClick={() => removeListItem('mustMention', index)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">What should techs never say?</h2>
                  <button
                    onClick={() => addListItem('neverSay')}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    + Add
                  </button>
                </div>
                {formData.neverSay.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateListItem('neverSay', index, e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {formData.neverSay.length > 1 && (
                      <button
                        onClick={() => removeListItem('neverSay', index)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  How should techs ask for the commitment?
                </label>
                <textarea
                  value={formData.closingAsk}
                  onChange={(e) => updateField('closingAsk', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What&apos;s the ideal outcome of the conversation?
                </label>
                <textarea
                  value={formData.idealOutcome}
                  onChange={(e) => updateField('idealOutcome', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <div className="border rounded-lg p-4 bg-gray-50">
                <h2 className="text-xl font-semibold mb-3">Review</h2>
                <div className="space-y-4 text-sm text-gray-800">
                  <div>
                    <div className="font-semibold">Playbook Name</div>
                    <div>{formData.name || '—'}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Description</div>
                    <div>{formData.description || '—'}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Opening Line</div>
                    <div>{formData.openingLine || '—'}</div>
                  </div>
                  <div>
                    <div className="font-semibold">First 30 Seconds</div>
                    <div>{formData.first30Seconds || '—'}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Objections</div>
                    <ul className="list-disc list-inside">
                      {formData.objections.map((item, index) => (
                        <li key={index}>
                          <strong>{item.objection || '—'}</strong> — {item.response || '—'}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold">Must Mention</div>
                    <ul className="list-disc list-inside">
                      {formData.mustMention.map((item, index) => (
                        <li key={index}>{item || '—'}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold">Never Say</div>
                    <ul className="list-disc list-inside">
                      {formData.neverSay.map((item, index) => (
                        <li key={index}>{item || '—'}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold">Closing Ask</div>
                    <div>{formData.closingAsk || '—'}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Ideal Outcome</div>
                    <div>{formData.idealOutcome || '—'}</div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handleGeneratePlaybook}
                disabled={isGenerating}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
              >
                {isGenerating ? 'Generating Playbook...' : 'Generate Playbook'}
              </button>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep((prev) => Math.max(1, prev - 1))}
              disabled={step === 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
            >
              Back
            </button>
            {step < STEPS.length && (
              <button
                onClick={() => setStep((prev) => Math.min(STEPS.length, prev + 1))}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>

      {showPersonaConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">Seed Personas?</h2>
            <p className="text-sm text-gray-400">
              This playbook maps to: <strong className="text-white">{suggestedScenarios.join(', ')}</strong>.
              Would you like to seed AI personas for these scenarios in your instance?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowPersonaConfirm(false); router.push('/playbooks'); }}
                className="flex-1 border border-white/10 text-gray-400 hover:text-white rounded-lg py-2.5 text-sm transition-colors"
              >
                Skip
              </button>
              <button
                onClick={async () => {
                  await fetch('/api/seed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scenarioTypes: suggestedScenarios, coachInstanceId: user?.coachInstanceId }),
                  });
                  setShowPersonaConfirm(false);
                  router.push('/playbooks');
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                Seed Personas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

