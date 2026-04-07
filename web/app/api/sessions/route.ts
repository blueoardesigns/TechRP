import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-server';

const FALLBACK_ORG = '00000000-0000-0000-0000-000000000001';

export async function GET() {
  try {
    const supabase = createServiceSupabase();
    const { data, error } = await (supabase as any)
      .from('training_sessions')
      .select('*')
      .order('started_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sessions: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // organization_id is NOT NULL — fall back to placeholder if user has no org
    if (!body.organization_id) body.organization_id = FALLBACK_ORG;
    const supabase = createServiceSupabase();
    const { data, error } = await (supabase as any)
      .from('training_sessions')
      .insert(body)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = createServiceSupabase();
    const { data, error } = await (supabase as any)
      .from('training_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
