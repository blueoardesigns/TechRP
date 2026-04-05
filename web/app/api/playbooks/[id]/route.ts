import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-server';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceSupabase();
  const { data, error } = await (supabase as any)
    .from('playbooks').select('*').eq('id', params.id).single();
  if (error || !data) return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
  return NextResponse.json({ playbook: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { name, content } = await req.json();
  const supabase = createServiceSupabase();
  const { data, error } = await (supabase as any)
    .from('playbooks').update({ name, content }).eq('id', params.id).select().single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to save' }, { status: 500 });
  return NextResponse.json({ playbook: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceSupabase();
  const { error } = await (supabase as any).from('playbooks').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
