/**
 * Force-updates existing default personas in Supabase with the current
 * system prompts, first messages, brief descriptions, and personality types
 * from all-personas.ts.
 *
 * Usage (from web/):
 *   npx tsx scripts/force-update-personas.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { ALL_PERSONAS_EXTENDED as ALL_PERSONAS } from '../lib/all-personas';

// Load .env.local — check worktree first, fall back to main repo
const envPath = [
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../../../../../web/.env.local'),
].find(p => { try { require('fs').accessSync(p); return true; } catch { return false; } });

if (!envPath) {
  console.error('Could not find .env.local. Run from the worktree web/ directory or ensure web/.env.local exists.');
  process.exit(1);
}
config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log(`Loading ${ALL_PERSONAS.length} personas from all-personas.ts...`);

  // Fetch all existing default personas
  const { data: existing, error: fetchError } = await supabase
    .from('personas')
    .select('id, name, scenario_type')
    .eq('is_default', true);

  if (fetchError) {
    console.error('Failed to fetch existing personas:', fetchError.message);
    process.exit(1);
  }

  const existingMap = new Map<string, string>(
    (existing || []).map((p: any) => [`${p.scenario_type}::${p.name}`, p.id])
  );

  console.log(`Found ${existingMap.size} existing personas in DB.`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const p of ALL_PERSONAS) {
    const key = `${p.scenarioType}::${p.name}`;
    const id = existingMap.get(key);

    if (!id) {
      console.warn(`  NOT FOUND in DB: ${key}`);
      notFound++;
      continue;
    }

    const { error } = await supabase
      .from('personas')
      .update({
        personality_type: p.personalityType,
        brief_description: p.briefDescription,
        first_message: p.firstMessage,
        system_prompt: p.systemPrompt,
      })
      .eq('id', id);

    if (error) {
      console.error(`  ERROR updating ${key}:`, error.message);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Errors:    ${errors}`);
}

main();
