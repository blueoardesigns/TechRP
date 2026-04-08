import { checkCandidateCompletion } from '@/lib/candidate-completion';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-server';

// Depends on increment_sessions_used RPC — see web/supabase/session-limit-migration.sql

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

    // Increment sessions_used and auto-suspend if limit reached
    const userId = body.user_id;
    if (userId) {
      const { error: rpcError } = await (supabase as any).rpc('increment_sessions_used', { target_user_id: userId });
      if (rpcError) {
        console.error('Failed to increment sessions_used for user', userId, rpcError);
      }

      const { data: userRow } = await (supabase as any)
        .from('users')
        .select('sessions_used, session_limit, user_type')
        .eq('id', userId)
        .single();

      if (
        userRow &&
        userRow.session_limit !== null &&
        userRow.sessions_used >= userRow.session_limit
      ) {
        await (supabase as any)
          .from('users')
          .update({ status: 'suspended' })
          .eq('id', userId);
      }

      // Candidate-specific completion check (fires email + in-app notification)
      if (userRow?.user_type === 'candidate') {
        checkCandidateCompletion(userId).catch(err =>
          console.error('Candidate completion check failed:', err)
        );
      }
    }

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
