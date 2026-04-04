import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const coachToken = searchParams.get('coach');
  const orgToken   = searchParams.get('org');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (coachToken) {
    const { data } = await (supabase as any)
      .from('coach_instances')
      .select('name')
      .eq('invite_token', coachToken)
      .single();
    return NextResponse.json(data ?? { error: 'Not found' });
  }

  if (orgToken) {
    const { data } = await (supabase as any)
      .from('organizations')
      .select('name')
      .eq('invite_token', orgToken)
      .single();
    return NextResponse.json(data ?? { error: 'Not found' });
  }

  return NextResponse.json({ error: 'No token' }, { status: 400 });
}
