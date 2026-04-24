/**
 * update-playbooks.mjs
 * Updates existing global playbooks in Supabase with the current content
 * from default-playbooks.ts (force update, idempotent).
 *
 * Usage: node update-playbooks.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function sbPatch(endpoint, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PATCH ${endpoint}: ${res.status} ${err.slice(0, 200)}`);
  }
}

async function sbGet(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    }
  });
  return res.json();
}

async function main() {
  // Parse default-playbooks.ts to extract playbook objects
  const content = fs.readFileSync(path.join(__dirname, 'lib/default-playbooks.ts'), 'utf-8');

  // Simple extraction: find each { scenarioType, name, content: `...` } block
  const playbookData = [];

  // Match scenarioType and name pairs
  const scenarioMatches = [...content.matchAll(/scenarioType:\s*'([^']+)'/g)];
  const nameMatches = [...content.matchAll(/name:\s*'([^']+)'/g)];

  console.log(`Found ${scenarioMatches.length} playbooks in file`);

  // Extract content for each playbook using backtick template literal
  // The content field uses: content: `...`
  let pos = 0;
  const playbookContents = [];
  const contentSearch = 'content: `';
  while (pos < content.length) {
    const idx = content.indexOf(contentSearch, pos);
    if (idx === -1) break;
    const start = idx + contentSearch.length;
    let i = start;
    while (i < content.length) {
      if (content[i] === '`' && content[i-1] !== '\\') break;
      i++;
    }
    playbookContents.push(content.slice(start, i));
    pos = i + 1;
  }

  console.log(`Extracted ${playbookContents.length} playbook contents`);

  const count = Math.min(scenarioMatches.length, nameMatches.length, playbookContents.length);

  // Get existing playbooks from DB
  const existing = await sbGet('/playbooks?coach_instance_id=is.null&select=id,scenario_type,name');
  const existingMap = new Map(existing.map(p => [p.scenario_type, p.id]));

  console.log(`Existing playbooks in DB: ${existing.length}`);

  for (let i = 0; i < count; i++) {
    const scenarioType = scenarioMatches[i][1];
    const name = nameMatches[i][1];
    const pbContent = playbookContents[i];
    const id = existingMap.get(scenarioType);

    if (id) {
      await sbPatch(`/playbooks?id=eq.${id}`, { content: pbContent, name });
      console.log(`  Updated: ${name} (${scenarioType})`);
    } else {
      console.log(`  Not found in DB: ${scenarioType} — skipping (run /api/seed first)`);
    }
  }

  console.log('\n✅ Playbook update complete.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
