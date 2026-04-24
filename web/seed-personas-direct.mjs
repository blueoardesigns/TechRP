/**
 * seed-personas-direct.mjs
 * Seeds all personas from all-personas.ts directly to Supabase
 * without going through the Next.js server (bypasses module cache).
 *
 * Usage: node seed-personas-direct.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY'];

async function sbRequest(endpoint, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${endpoint}: ${res.status} ${err.slice(0, 200)}`);
  }
  return res;
}

async function main() {
  // Parse all-personas.ts to extract persona count
  const content = fs.readFileSync(path.join(__dirname, 'lib/all-personas.ts'), 'utf-8');

  // Extract persona objects using regex
  const typeMatches = content.match(/scenarioType: "([^"]+)" as ScenarioType/g) || [];
  console.log(`Personas in file: ${typeMatches.length}`);

  // Get existing personas from DB
  const existRes = await fetch(
    `${SUPABASE_URL}/rest/v1/personas?is_default=eq.true&select=name,scenario_type`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      }
    }
  );
  const existing = await existRes.json();
  const existingSet = new Set(existing.map(p => `${p.scenario_type}::${p.name}`));
  console.log(`Existing personas in DB: ${existing.length}`);

  // Parse personas from file using a different approach - evaluate the TS file
  // We'll use a regex to extract all persona objects
  const personaBlocks = [];

  // Match each persona object (simplified extraction)
  const idRegex = /id: "([^"]+)"/g;
  const nameRegex = /name: "([^"]+)"/g;
  const typeRegex = /scenarioType: "([^"]+)" as ScenarioType/g;
  const genderRegex = /gender: "([^"]+)"/g;
  const personalityRegex = /personalityType: "([^"]+)"/g;
  const briefRegex = /briefDescription: "([^"]+)"/g;
  const speakerRegex = /speakerLabel: "([^"]+)"/g;
  const firstMsgRegex = /firstMessage: "([^"]+)"/g;

  let idMatch, nameMatch, typeMatch, genderMatch, personalityMatch, briefMatch, speakerMatch, firstMsgMatch;

  const ids = [], names = [], types = [], genders = [], personalities = [], briefs = [], speakers = [];

  while ((idMatch = idRegex.exec(content)) !== null) ids.push(idMatch[1]);
  while ((nameMatch = nameRegex.exec(content)) !== null) names.push(nameMatch[1]);
  while ((typeMatch = typeRegex.exec(content)) !== null) types.push(typeMatch[1]);
  while ((genderMatch = genderRegex.exec(content)) !== null) genders.push(genderMatch[1]);
  while ((personalityMatch = personalityRegex.exec(content)) !== null) personalities.push(personalityMatch[1]);
  while ((briefMatch = briefRegex.exec(content)) !== null) briefs.push(briefMatch[1]);
  while ((speakerMatch = speakerRegex.exec(content)) !== null) speakers.push(speakerMatch[1]);

  console.log(`Parsed: ${ids.length} ids, ${names.length} names, ${types.length} types`);

  // Extract systemPrompts - these are more complex (can use backticks or quotes)
  // We'll extract them by finding the pattern systemPrompt: `...` or "..."
  const systemPrompts = [];
  let pos = 0;
  const spSearchStr = 'systemPrompt: ';
  while (pos < content.length) {
    const idx = content.indexOf(spSearchStr, pos);
    if (idx === -1) break;
    const start = idx + spSearchStr.length;
    const char = content[start];
    if (char === '`') {
      // Template literal - find matching backtick
      let depth = 0;
      let i = start + 1;
      while (i < content.length) {
        if (content[i] === '`' && content[i-1] !== '\\') {
          break;
        }
        i++;
      }
      systemPrompts.push(content.slice(start + 1, i));
      pos = i + 1;
    } else if (char === '"') {
      // Regular string - find end quote
      let i = start + 1;
      while (i < content.length) {
        if (content[i] === '"' && content[i-1] !== '\\') break;
        i++;
      }
      systemPrompts.push(content.slice(start + 1, i));
      pos = i + 1;
    } else {
      pos = start + 1;
    }
  }

  console.log(`Extracted ${systemPrompts.length} system prompts`);

  // Also extract firstMessages - they're simpler (quoted strings)
  const firstMessages = [];
  pos = 0;
  const fmSearch = 'firstMessage: ';
  while (pos < content.length) {
    const idx = content.indexOf(fmSearch, pos);
    if (idx === -1) break;
    const start = idx + fmSearch.length;
    const char = content[start];
    if (char === '"') {
      let i = start + 1;
      while (i < content.length) {
        if (content[i] === '"' && content[i-1] !== '\\') break;
        i++;
      }
      firstMessages.push(content.slice(start + 1, i));
      pos = i + 1;
    } else {
      pos = start + 1;
    }
  }

  console.log(`Extracted ${firstMessages.length} first messages`);

  // Build personas array
  const count = Math.min(ids.length, names.length, types.length, systemPrompts.length, firstMessages.length);
  console.log(`Building ${count} personas`);

  const toInsert = [];
  for (let i = 0; i < count; i++) {
    const key = `${types[i]}::${names[i]}`;
    if (existingSet.has(key)) continue;
    if (!types[i] || types[i] === 'undefined') continue;

    toInsert.push({
      organization_id: '00000000-0000-0000-0000-000000000001',
      scenario_type: types[i],
      name: names[i],
      personality_type: personalities[i] || '',
      brief_description: briefs[i] || '',
      speaker_label: speakers[i] || 'Homeowner',
      first_message: firstMessages[i] || '',
      system_prompt: systemPrompts[i] || '',
      gender: genders[i] || 'female',
      is_default: true,
      is_active: true,
      coach_instance_id: null,
    });
  }

  console.log(`New personas to insert: ${toInsert.length}`);

  if (toInsert.length === 0) {
    console.log('Nothing to insert.');
    return;
  }

  // Insert in batches of 25
  let created = 0;
  let errors = 0;
  const BATCH = 25;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    try {
      await sbRequest('/personas', 'POST', batch);
      created += batch.length;
      process.stdout.write(`\r  Inserted ${created}/${toInsert.length}`);
    } catch (e) {
      errors += batch.length;
      console.error(`\n  Error batch ${i}-${i+BATCH}:`, e.message.slice(0, 100));
    }
  }

  console.log(`\n✅ Done. Created: ${created}, Errors: ${errors}`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
