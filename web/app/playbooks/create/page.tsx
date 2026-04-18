'use client';

import { useState, useRef } from 'react';
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

  // Upload / chat mode state
  const [createMode, setCreateMode] = useState<'choose' | 'manual' | 'upload'>('choose');
  const [uploadedText, setUploadedText] = useState<string>('');
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadLoading(true);
    setUploadFileName(file.name);
    const fd = new FormData();
    fd.append('file', file);
    try {
      // Step 1: extract text
      const uploadRes = await fetch('/api/playbook/upload', { method: 'POST', body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      // Step 2: parse into wizard fields
      const parseRes = await fetch('/api/playbook/parse-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedText: uploadData.extractedText }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || 'Parse failed');

      // Step 3: pre-fill wizard and switch to manual mode
      const w = parseData.wizardData;
      setFormData({
        name: w.name ?? '',
        description: w.description ?? '',
        openingLine: w.openingLine ?? '',
        first30Seconds: w.first30Seconds ?? '',
        objections: Array.isArray(w.objections) && w.objections.length ? w.objections : [{ objection: '', response: '' }],
        mustMention: Array.isArray(w.mustMention) && w.mustMention.length ? w.mustMention : [''],
        neverSay: Array.isArray(w.neverSay) && w.neverSay.length ? w.neverSay : [''],
        closingAsk: w.closingAsk ?? '',
        idealOutcome: w.idealOutcome ?? '',
      });
      setStep(1);
      setCreateMode('manual');
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploadLoading(false);
    }
  }

  async function sendChatMessage(
    text: string,
    existingMessages: { role: 'user' | 'assistant'; content: string }[],
    userMessage: string
  ) {
    const newMessages = [...existingMessages, { role: 'user' as const, content: userMessage }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const res = await fetch('/api/playbook/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, extractedText: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      const updated = [...newMessages, { role: 'assistant' as const, content: data.message }];
      setChatMessages(updated);
      if (data.ready && data.generateInputs) {
        await generateFromInputs(data.generateInputs);
      }
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}. Please try again.` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function generateFromInputs(inputs: Record<string, unknown>) {
    try {
      const res = await fetch('/api/playbook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      const saveRes = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inputs.name, content: data.content }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Save failed');
      router.push(`/playbooks/${saveData.playbook.id}`);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error generating playbook: ${err.message}` },
      ]);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6">

          {/* Mode selector */}
          {createMode === 'choose' && (
            <div className="flex flex-col items-center gap-6 py-12">
              <h1 className="text-2xl font-bold text-white">Create a Playbook</h1>
              <p className="text-gray-400 text-center max-w-md">
                Build a playbook manually using our step-by-step wizard, or upload an existing document and let AI help you build it.
              </p>
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => setCreateMode('manual')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Build Manually
                </button>
                <button
                  onClick={() => setCreateMode('upload')}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Upload Document
                </button>
              </div>
            </div>
          )}

          {/* Manual wizard */}
          {createMode === 'manual' && (
            <div>
              <div className="mb-4">
                <button
                  onClick={() => setCreateMode('choose')}
                  className="text-gray-500 hover:text-white transition-colors text-sm"
                >
                  ← Back
                </button>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold">Create Playbook</h1>
                  <p className="text-gray-600">Step {step} of {STEPS.length}</p>
                </div>
                <button
                  onClick={() => router.push('/playbooks')}
                  className="text-gray-500 hover:text-white text-sm transition-colors"
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
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-gray-800 text-gray-500'
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
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Playbook Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Water Damage Equipment Drop-off"
                      className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Brief Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder="Short summary of the playbook's purpose"
                      className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 h-24"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      What&apos;s the ideal opening line when meeting a homeowner?
                    </label>
                    <textarea
                      value={formData.openingLine}
                      onChange={(e) => updateField('openingLine', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 h-24"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      What should techs establish in the first 30 seconds?
                    </label>
                    <textarea
                      value={formData.first30Seconds}
                      onChange={(e) => updateField('first30Seconds', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 h-24"
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
                    <div key={index} className="border border-white/10 rounded-xl p-4 space-y-3 bg-gray-800">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Objection
                        </label>
                        <input
                          type="text"
                          value={item.objection}
                          onChange={(e) => updateObjection(index, 'objection', e.target.value)}
                          placeholder="I need to think about it"
                          className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Best Response
                        </label>
                        <textarea
                          value={item.response}
                          onChange={(e) => updateObjection(index, 'response', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 h-20"
                        />
                      </div>
                      {formData.objections.length > 1 && (
                        <button
                          onClick={() => removeObjection(index)}
                          className="text-sm text-red-400 hover:text-red-300"
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
                          className="flex-1 px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                        {formData.mustMention.length > 1 && (
                          <button
                            onClick={() => removeListItem('mustMention', index)}
                            className="text-sm text-red-400 hover:text-red-300"
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
                          className="flex-1 px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                        {formData.neverSay.length > 1 && (
                          <button
                            onClick={() => removeListItem('neverSay', index)}
                            className="text-sm text-red-400 hover:text-red-300"
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
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      How should techs ask for the commitment?
                    </label>
                    <textarea
                      value={formData.closingAsk}
                      onChange={(e) => updateField('closingAsk', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 h-24"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      What&apos;s the ideal outcome of the conversation?
                    </label>
                    <textarea
                      value={formData.idealOutcome}
                      onChange={(e) => updateField('idealOutcome', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 h-24"
                    />
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-6">
                  <div className="border border-white/10 rounded-xl p-4 bg-gray-800">
                    <h2 className="text-xl font-semibold mb-3">Review</h2>
                    <div className="space-y-4 text-sm text-gray-300">
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
                    <div className="text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
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
                  className="px-4 py-2 border border-white/10 rounded-lg text-gray-300 disabled:opacity-50 hover:bg-gray-800 transition-colors"
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
          )}

          {/* Upload + chat mode */}
          {createMode === 'upload' && (
            <div className="max-w-2xl mx-auto py-8 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setCreateMode('choose'); setChatMessages([]); setUploadedText(''); setUploadFileName(''); }}
                  className="text-gray-500 hover:text-white transition-colors text-sm"
                >
                  ← Back
                </button>
                <h1 className="text-2xl font-bold text-white">Upload Document</h1>
              </div>

              {!uploadedText && (
                <div className="border-2 border-dashed border-gray-600 rounded-xl p-10 flex flex-col items-center gap-4">
                  <p className="text-gray-400 text-center">Upload a PDF or Word document (.docx) to base your playbook on.</p>
                  <label className="cursor-pointer px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                    {uploadLoading ? 'Reading document...' : 'Choose File'}
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadLoading}
                    />
                  </label>
                  {uploadError && <p className="text-red-400 text-sm">{uploadError}</p>}
                </div>
              )}

              {uploadedText && (
                <>
                  <p className="text-gray-400 text-sm">📄 {uploadFileName}</p>
                  <div className="flex flex-col gap-4 min-h-[300px] max-h-[500px] overflow-y-auto pr-1">
                    {chatMessages
                      .filter((m) => m.role === 'assistant' || (m.role === 'user' && m.content !== 'Hi, please analyze this document and start building the playbook.'))
                      .map((m, i) => (
                        <div
                          key={i}
                          className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                            m.role === 'assistant'
                              ? 'bg-gray-800 text-gray-100 self-start max-w-[85%]'
                              : 'bg-blue-600 text-white self-end max-w-[85%]'
                          }`}
                        >
                          {m.content}
                        </div>
                      ))}
                    {chatLoading && (
                      <div className="bg-gray-800 text-gray-400 rounded-xl px-4 py-3 text-sm self-start">
                        Thinking...
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && chatInput.trim() && !chatLoading) {
                          e.preventDefault();
                          const msg = chatInput.trim();
                          setChatInput('');
                          sendChatMessage(uploadedText, chatMessages, msg);
                        }
                      }}
                      placeholder="Answer the question above..."
                      disabled={chatLoading}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                    <button
                      onClick={() => {
                        if (!chatInput.trim() || chatLoading) return;
                        const msg = chatInput.trim();
                        setChatInput('');
                        sendChatMessage(uploadedText, chatMessages, msg);
                      }}
                      disabled={!chatInput.trim() || chatLoading}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

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
