import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';

// GET /api/personas?scenario_type=homeowner_inbound
// GET /api/personas  (all)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const scenarioType = searchParams.get('scenario_type');

    let query = supabase
      .from('personas' as any)
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name');

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
    const supabase = createServiceRoleClient();
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

    const { data, error } = await supabase
      .from('personas' as any)
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
