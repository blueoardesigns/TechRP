# PDF → AI Chat → Playbook Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let coaches upload a PDF or Word doc, have Claude ask one question at a time to fill in the playbook inputs, then auto-generate a playbook draft using the existing generation pipeline.

**Architecture:** Two new API routes (`/api/playbook/upload` for file extraction, `/api/playbook/chat` for stateless AI Q&A). Client holds conversation state in React state — no DB storage needed. When Claude has enough info it emits a `__READY__` marker with JSON inputs; the client calls the existing `/api/playbook/generate` and redirects to the edit page. A new "Upload Document" mode is added to the existing playbook create wizard.

**Tech Stack:** `pdf-parse`, `mammoth`, Claude API (`claude-sonnet-4-20250514`), Next.js API routes, React state

---

## File Map

| File | Change |
|---|---|
| `web/package.json` | Add `pdf-parse`, `mammoth` |
| `web/app/api/playbook/upload/route.ts` | New — extract text from PDF/DOCX |
| `web/app/api/playbook/chat/route.ts` | New — stateless AI Q&A |
| `web/app/playbooks/create/page.tsx` | Add "Upload Document" mode with upload + chat UI |

---

### Task 1: Install dependencies

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install pdf-parse and mammoth**

```bash
cd /Users/TinierTim/TBDev/techrp/web && npm install pdf-parse mammoth
npm install --save-dev @types/pdf-parse @types/mammoth
```

Expected output: packages added to node_modules and package.json.

---

### Task 2: Create the file upload route

**Files:**
- Create: `web/app/api/playbook/upload/route.ts`

- [ ] **Step 1: Create the route file**

Create `web/app/api/playbook/upload/route.ts` with this content:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  // Auth check — coaches only
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let extractedText = '';

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx');

  if (isPdf) {
    try {
      const result = await pdf(buffer);
      extractedText = result.text;
    } catch {
      return NextResponse.json({ error: 'Failed to read PDF. Make sure it is not password-protected.' }, { status: 422 });
    }
  } else if (isDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } catch {
      return NextResponse.json({ error: 'Failed to read Word document.' }, { status: 422 });
    }
  } else {
    return NextResponse.json(
      { error: 'Unsupported file type. Please upload a PDF (.pdf) or Word document (.docx).' },
      { status: 400 }
    );
  }

  if (!extractedText.trim()) {
    return NextResponse.json(
      { error: 'No readable text found in the document. The file may be image-based or empty.' },
      { status: 422 }
    );
  }

  // Truncate to ~12,000 chars to stay within a reasonable token budget
  const truncated = extractedText.slice(0, 12000);

  return NextResponse.json({ extractedText: truncated });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors on the new file.

- [ ] **Step 3: Test the upload route with curl**

```bash
cd web && npm run dev &
sleep 3
# Create a simple test PDF — use any small PDF file on your machine
curl -X POST http://localhost:3000/api/playbook/upload \
  -F "file=@/path/to/test.pdf" \
  -H "Cookie: YOUR_AUTH_COOKIE"
```

Expected response:
```json
{"extractedText": "... extracted text content ..."}
```

---

### Task 3: Create the AI chat route

**Files:**
- Create: `web/app/api/playbook/chat/route.ts`

- [ ] **Step 1: Create the route file**

Create `web/app/api/playbook/chat/route.ts` with this content:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const CHAT_SYSTEM_PROMPT = `You are helping a sales coach build a training playbook from a document they uploaded. Your job is to extract the information needed to generate a playbook by asking one focused question at a time.

The playbook needs these inputs:
- name: a short title for this playbook (e.g. "Homeowner Inbound Call")
- description: one sentence describing the scenario this playbook covers
- openingLine: the ideal first words the technician says when starting the call
- first30Seconds: what the technician should accomplish in the first 30 seconds
- objections: 3–5 common objections and the best response to each
- mustMention: 3–5 key talking points the technician must always cover
- neverSay: 2–4 phrases or approaches the technician should always avoid
- closingAsk: the exact ask used to close — what the technician asks for at the end
- idealOutcome: what a successful call looks like (e.g. "Homeowner agrees to a free inspection today")

INSTRUCTIONS:
1. On the first message, analyze the uploaded document carefully. Extract what you can already determine with confidence, then identify the most important gap.
2. Ask ONE specific, conversational question at a time to fill that gap. Reference the document when relevant.
3. After each user answer, either ask the next most important missing question OR — if you have enough for all fields — output the completion signal below.
4. When you have solid values for all fields, output EXACTLY this (nothing after the JSON):
__READY__
{"name":"...","description":"...","openingLine":"...","first30Seconds":"...","objections":[{"objection":"...","response":"..."}],"mustMention":["...","..."],"neverSay":["...","..."],"closingAsk":"...","idealOutcome":"..."}

Keep questions short and specific. Do not ask about multiple things in one message.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  // Auth check
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { messages: ChatMessage[]; extractedText: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { messages, extractedText } = body;

  if (!messages || !Array.isArray(messages) || !extractedText) {
    return NextResponse.json({ error: 'messages array and extractedText are required' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const systemWithDoc = `${CHAT_SYSTEM_PROMPT}\n\n---\nDOCUMENT CONTENT:\n${extractedText}`;

  let responseText: string;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemWithDoc,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    responseText = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (err) {
    console.error('Playbook chat error:', err);
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
  }

  const isReady = responseText.includes('__READY__');
  let generateInputs: Record<string, unknown> | null = null;

  if (isReady) {
    const jsonMatch = responseText.match(/__READY__\s*\n([\s\S]+)/);
    if (jsonMatch) {
      try {
        generateInputs = JSON.parse(jsonMatch[1].trim());
      } catch {
        // Malformed JSON — continue chatting rather than failing
      }
    }
  }

  return NextResponse.json({
    message: isReady
      ? (responseText.split('__READY__')[0].trim() || "I have everything I need. Generating your playbook now...")
      : responseText,
    ready: isReady && !!generateInputs,
    generateInputs,
  });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

---

### Task 4: Add "Upload Document" mode to the playbook create page

**Files:**
- Modify: `web/app/playbooks/create/page.tsx`

- [ ] **Step 1: Read the current create page to understand the file structure**

```bash
head -60 web/app/playbooks/create/page.tsx
```

Note the existing state variables, the wizard step logic, and the outer JSX container — you'll add a mode selector before the wizard.

- [ ] **Step 2: Add import for the new upload/chat flow**

At the top of `web/app/playbooks/create/page.tsx`, add these imports alongside the existing ones:

```typescript
import { useRef } from 'react';
```

(Only add if `useRef` isn't already imported.)

- [ ] **Step 3: Add upload/chat state variables inside the component**

Inside the component function, alongside the existing state variables, add:

```typescript
// Upload → Chat → Generate mode
const [createMode, setCreateMode] = React.useState<'choose' | 'manual' | 'upload'>('choose');
const [uploadedText, setUploadedText] = React.useState<string>('');
const [uploadFileName, setUploadFileName] = React.useState<string>('');
const [chatMessages, setChatMessages] = React.useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
const [chatInput, setChatInput] = React.useState('');
const [chatLoading, setChatLoading] = React.useState(false);
const [uploadLoading, setUploadLoading] = React.useState(false);
const [uploadError, setUploadError] = React.useState('');
const chatBottomRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 4: Add the handleFileUpload function**

Inside the component, add:

```typescript
async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;

  setUploadError('');
  setUploadLoading(true);
  setUploadFileName(file.name);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/playbook/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    setUploadedText(data.extractedText);
    // Kick off the first chat message automatically
    setChatMessages([]);
    await sendChatMessage(data.extractedText, [], 'Hi, please analyze this document and start building the playbook.');
  } catch (err: any) {
    setUploadError(err.message || 'Upload failed');
  } finally {
    setUploadLoading(false);
  }
}
```

- [ ] **Step 5: Add the sendChatMessage function**

```typescript
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
      // Auto-generate the playbook
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
```

- [ ] **Step 6: Add the generateFromInputs function**

```typescript
async function generateFromInputs(inputs: Record<string, unknown>) {
  try {
    const res = await fetch('/api/playbook/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed');

    // Save the playbook and navigate to edit page
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
```

Task 5 adds `POST /api/playbooks` — complete that task before testing this function end-to-end.

- [ ] **Step 7: Add the mode selector UI and upload/chat UI**

Find where the existing wizard JSX starts (the outer `<div>` or `<main>` container). Wrap the existing wizard in a conditional, and add the mode selector and upload/chat UI before it:

```tsx
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

{/* Upload + Chat UI */}
{createMode === 'upload' && (
  <div className="max-w-2xl mx-auto py-8 flex flex-col gap-6">
    <div className="flex items-center gap-3">
      <button
        onClick={() => { setCreateMode('choose'); setChatMessages([]); setUploadedText(''); setUploadFileName(''); }}
        className="text-gray-400 hover:text-white transition-colors text-sm"
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

        {/* Chat messages */}
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

        {/* Input */}
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

{/* Existing manual wizard — only show in manual mode */}
{createMode === 'manual' && (
  /* existing wizard JSX goes here */
)}
```

- [ ] **Step 8: Wrap the existing wizard JSX in the manual mode conditional**

Find the existing wizard container div and wrap it: the JSX that was previously always rendered should now only render when `createMode === 'manual'`. Add a "← Back" button at the top of the manual mode view:

```tsx
{createMode === 'manual' && (
  <div>
    <div className="mb-4">
      <button
        onClick={() => setCreateMode('choose')}
        className="text-gray-400 hover:text-white transition-colors text-sm"
      >
        ← Back
      </button>
    </div>
    {/* ... existing wizard JSX unchanged ... */}
  </div>
)}
```

- [ ] **Step 9: Verify build**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: builds without errors.

---

### Task 5: Ensure POST /api/playbooks exists for saving a generated playbook

**Files:**
- Modify: `web/app/api/playbooks/route.ts`

- [ ] **Step 1: Check if POST is already defined**

```bash
grep -n "^export async function POST" web/app/api/playbooks/route.ts
```

If it returns a result, skip this task. If nothing is returned, add the POST handler.

- [ ] **Step 2: Add POST handler to /api/playbooks/route.ts**

Open `web/app/api/playbooks/route.ts` and add after the existing `GET` function:

```typescript
export async function POST(request: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!profile || !['coach', 'company_admin', 'superuser'].includes((profile as any).app_role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, content, scenario_type } = await request.json();
  if (!name || !content) {
    return NextResponse.json({ error: 'name and content are required' }, { status: 400 });
  }

  const { data, error } = await (supabase as any)
    .from('playbooks')
    .insert({
      name,
      content,
      scenario_type: scenario_type ?? null,
      coach_instance_id: (profile as any).coach_instance_id ?? null,
      uploaded_by: (profile as any).id,
    })
    .select('id, name, scenario_type, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ playbook: data }, { status: 201 });
}
```

Also add `NextRequest` to the import if not already present:
```typescript
import { NextRequest, NextResponse } from 'next/server';
```

- [ ] **Step 3: Verify build**

```bash
cd web && npm run build 2>&1 | tail -20
```

---

### Task 6: Manual end-to-end test and commit

- [ ] **Step 1: Manual end-to-end test**

```bash
cd web && npm run dev
```

1. Log in as a coach
2. Go to `/playbooks/create`
3. Verify the mode selector appears ("Build Manually" / "Upload Document")
4. Click "Upload Document", upload a PDF
5. Verify the chat starts automatically with Claude's first question
6. Answer 4–6 questions
7. Verify that when Claude has enough info, it generates and redirects to the edit page with a draft playbook

- [ ] **Step 2: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/app/api/playbook/upload/route.ts \
        web/app/api/playbook/chat/route.ts \
        web/app/api/playbooks/route.ts \
        web/app/playbooks/create/page.tsx \
        web/package.json \
        web/package-lock.json
git commit -m "feat: add PDF/doc upload with AI chat wizard for playbook creation"
```
