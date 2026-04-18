import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceRoleClient } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { recording_url } = await req.json();
  if (!recording_url) return NextResponse.json({ error: 'recording_url required' }, { status: 400 });

  const supabase = createServiceRoleClient();
  await (supabase as any)
    .from('training_sessions')
    .update({ recording_url })
    .eq('id', params.id);

  return NextResponse.json({ ok: true });
}
