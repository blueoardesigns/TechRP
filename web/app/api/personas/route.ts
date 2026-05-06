import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceRoleClient } from '@/lib/supabase';

// GET /api/personas?scenario_type=homeowner_inbound
// GET /api/personas  (all)
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = createServerSupabase();
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser();

    const supabase = createServiceRoleClient();
    let coachInstanceId: string | null = null;
    let appRole: string = '';

    if (authUser) {
      const { data: profile } = await (supabase as any)
        .from('users').select('coach_instance_id, app_role').eq('auth_user_id', authUser.id).single();
      coachInstanceId = (profile as any)?.coach_instance_id ?? null;
      appRole = (profile as any)?.app_role ?? '';
    }

    const { searchParams } = new URL(request.url);
    const scenarioType = searchParams.get('scenario_type');

    let query;
    // Superusers see all default (global) personas
    if (appRole === 'superuser') {
      query = (supabase as any).from('personas').select('*')
        .is('coach_instance_id', null)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');
    } else if (coachInstanceId) {
      const { data: inst } = await (supabase as any)
        .from('coach_instances').select('global_personas_enabled').eq('id', coachInstanceId).single();
      const globalEnabled = (inst as any)?.global_personas_enabled ?? false;

      if (globalEnabled) {
        query = (supabase as any).from('personas').select('*')
          .or(`coach_instance_id.eq.${coachInstanceId},coach_instance_id.is.null`)
          .eq('is_active', true)
          .order('name');
      } else {
        // Instance-only first; if none exist, fall back to global defaults so
        // the app works out-of-the-box before custom personas are created.
        const instanceQuery = (supabase as any).from('personas').select('*')
          .eq('coach_instance_id', coachInstanceId)
          .eq('is_active', true)
          .order('name');
        const instanceFilter = scenarioType ? instanceQuery.eq('scenario_type', scenarioType) : instanceQuery;
        const { data: instanceData } = await instanceFilter;
        if (instanceData && instanceData.length > 0) {
          return NextResponse.json({ personas: instanceData });
        }
        // No custom personas — serve global defaults
        query = (supabase as any).from('personas').select('*')
          .is('coach_instance_id', null)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .order('name');
      }
    } else {
      query = (supabase as any).from('personas').select('*')
        .is('coach_instance_id', null)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');
    }

    if (scenarioType) {
      query = query.eq('scenario_type', scenarioType);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching personas:', error);
      return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 });
    }

    return NextResponse.json({ personas: data || [] });
  } catch (error) {
    console.error('Error in GET /api/personas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/personas — create a new persona (coach / company_admin / superuser only)
// Personas are written into the caller's coach_instance scope; superusers can
// create global default personas via { make_default: true }.
export async function POST(request: NextRequest) {
  const { requireUser } = await import('@/lib/api-auth');
  const auth = await requireUser({ roles: ['coach', 'company_admin', 'superuser'] });
  if (!auth.ok) return auth.response;
  const { user, service: supabase } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    scenario_type,
    name,
    personality_type,
    brief_description,
    speaker_label,
    first_message,
    system_prompt,
    make_default,
  } = body as Record<string, unknown>;

  if (!scenario_type || !name || !personality_type || !first_message || !system_prompt) {
    return NextResponse.json(
      { error: 'Missing required fields: scenario_type, name, personality_type, first_message, system_prompt' },
      { status: 400 }
    );
  }

  // Length guards
  if (String(name).length > 255) return NextResponse.json({ error: 'Name too long (max 255 characters).' }, { status: 400 });
  if (String(personality_type).length > 255) return NextResponse.json({ error: 'Personality type too long (max 255 characters).' }, { status: 400 });
  if (String(first_message).length > 2000) return NextResponse.json({ error: 'First message too long (max 2000 characters).' }, { status: 400 });
  if (String(system_prompt).length > 20000) return NextResponse.json({ error: 'System prompt too long (max 20000 characters).' }, { status: 400 });

  // Only superusers may create global (coach_instance_id = null) defaults.
  const wantsDefault = make_default === true && user.appRole === 'superuser';
  const coachInstanceId = wantsDefault ? null : user.coachInstanceId;

  const { data, error } = await (supabase as any)
    .from('personas')
    .insert({
      organization_id: '00000000-0000-0000-0000-000000000001',
      coach_instance_id: coachInstanceId,
      scenario_type,
      name,
      personality_type,
      brief_description: brief_description || '',
      speaker_label: speaker_label || 'Contact',
      first_message,
      system_prompt,
      is_default: wantsDefault,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating persona:', error);
    return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 });
  }

  return NextResponse.json({ persona: data }, { status: 201 });
}

// POST /api/personas/seed — bulk insert default personas (called once)
