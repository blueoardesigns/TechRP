import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

// GET /api/personas?scenario_type=homeowner_inbound
// GET /api/personas  (all)
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = createServerSupabase();
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser();

    const supabase = createServiceSupabase();
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
        query = (supabase as any).from('personas').select('*')
          .eq('coach_instance_id', coachInstanceId)
          .eq('is_active', true)
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

// POST /api/personas — create a new persona
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceSupabase();
    const body = await request.json();

    const {
      scenario_type,
      name,
      personality_type,
      brief_description,
      speaker_label,
      first_message,
      system_prompt,
    } = body;

    if (!scenario_type || !name || !personality_type || !first_message || !system_prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: scenario_type, name, personality_type, first_message, system_prompt' },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase as any)
      .from('personas')
      .insert({
        organization_id: '00000000-0000-0000-0000-000000000001',
        scenario_type,
        name,
        personality_type,
        brief_description: brief_description || '',
        speaker_label: speaker_label || 'Contact',
        first_message,
        system_prompt,
        is_default: false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating persona:', error);
      return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 });
    }

    return NextResponse.json({ persona: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/personas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/personas/seed — bulk insert default personas (called once)
