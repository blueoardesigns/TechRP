import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { DEFAULT_PLAYBOOKS } from '@/lib/default-playbooks';
import { ALL_PERSONAS_EXTENDED as ALL_PERSONAS } from '@/lib/all-personas';

// POST /api/seed
// Seeds default playbooks and all 150 personas.
// Safe to call multiple times — skips records that already exist.
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const results: Record<string, any> = {};

    // ── Seed scenario playbooks ────────────────────────────────────────────────
    const playbookResults = [];
    for (const pb of DEFAULT_PLAYBOOKS) {
      const { data: existing } = await (supabase
        .from('playbooks' as any)
        .select('id')
        .eq('scenario_type', pb.scenarioType)
        .limit(1) as any);

      if (existing && existing.length > 0) {
        playbookResults.push({ name: pb.name, status: 'skipped (already exists)' });
        continue;
      }

      const { error } = await (supabase
        .from('playbooks' as any)
        .insert({
          organization_id: '00000000-0000-0000-0000-000000000001',
          name: pb.name,
          content: pb.content,
          scenario_type: pb.scenarioType,
          file_url: null,
          uploaded_by: '00000000-0000-0000-0000-000000000001',
        }) as any);

      playbookResults.push({ name: pb.name, status: error ? `error: ${error.message}` : 'created' });
    }
    results.playbooks = playbookResults;

    // ── Seed personas ──────────────────────────────────────────────────────────
    // Insert in batches of 25 to avoid request size limits
    const personaResults = { created: 0, skipped: 0, errors: 0 };

    // Check how many personas already exist
    const { count } = await (supabase
      .from('personas' as any)
      .select('*', { count: 'exact', head: true })
      .eq('is_default', true) as any);

    if (count && count >= ALL_PERSONAS.length) {
      personaResults.skipped = ALL_PERSONAS.length;
    } else {
      // Get existing personas by name+scenario_type to avoid duplicates
      const { data: existingPersonas } = await (supabase
        .from('personas' as any)
        .select('name, scenario_type')
        .eq('is_default', true) as any);

      const existingKeys = new Set(
        (existingPersonas || []).map((p: any) => `${p.scenario_type}::${p.name}`)
      );

      const toInsert = ALL_PERSONAS
        .filter(p => !existingKeys.has(`${p.scenarioType}::${p.name}`))
        .map(p => ({
          // omit id — let Supabase generate a UUID
          organization_id: '00000000-0000-0000-0000-000000000001',
          scenario_type: p.scenarioType,
          name: p.name,
          personality_type: p.personalityType,
          brief_description: p.briefDescription,
          speaker_label: p.speakerLabel,
          first_message: p.firstMessage,
          system_prompt: p.systemPrompt,
          gender: p.gender ?? 'female',
          is_default: true,
          is_active: true,
        }));

      // Insert in batches of 25
      const BATCH = 25;
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH);
        const { error } = await (supabase
          .from('personas' as any)
          .insert(batch) as any);

        if (error) {
          personaResults.errors += batch.length;
          console.error('Persona batch insert error:', error);
        } else {
          personaResults.created += batch.length;
        }
      }
    }
    results.personas = personaResults;

    return NextResponse.json({
      success: true,
      results,
      message: 'Seed complete.',
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to seed default playbooks and 150 personas.',
  });
}
