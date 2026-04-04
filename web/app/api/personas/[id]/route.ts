import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';

// PUT /api/personas/:id — update a persona
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceRoleClient();
    const { id } = params;
    const body = await request.json();

    const {
      name,
      personality_type,
      brief_description,
      speaker_label,
      first_message,
      system_prompt,
    } = body;

    const { data, error } = await (supabase as any)
      .from('personas')
      .update({
        name,
        personality_type,
        brief_description,
        speaker_label,
        first_message,
        system_prompt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating persona:', error);
      return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 });
    }

    return NextResponse.json({ persona: data });
  } catch (error) {
    console.error('Error in PUT /api/personas/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/personas/:id — soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceRoleClient();
    const { id } = params;

    const { error } = await (supabase as any)
      .from('personas')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting persona:', error);
      return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/personas/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
