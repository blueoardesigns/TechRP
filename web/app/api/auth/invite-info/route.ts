import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const coachToken     = searchParams.get('coach');
  const orgToken       = searchParams.get('org');
  const candidateToken = searchParams.get('candidate');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (candidateToken) {
    const { data } = await (supabase as any)
      .from('candidate_invites')
      .select('email, full_name, assigned_scenarios, expires_at, status')
      .eq('personal_token', candidateToken)
      .single();
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if ((data as any).status !== 'pending') {
      return NextResponse.json({ error: 'This invite has already been used.' }, { status: 400 });
    }
    const expiresAt = (data as any).expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This invite link has expired.' }, { status: 400 });
    }
    return NextResponse.json({
      email: (data as any).email,
      full_name: (data as any).full_name,
      assigned_scenarios: (data as any).assigned_scenarios,
    });
  }

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
