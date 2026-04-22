import { NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

// POST /api/admin/seed-demo
// Seeds demo team members, candidates, and coach connections for the calling superuser.
// Creates a demo org if the user lacks one. Idempotent via email/token uniqueness.
export async function POST() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: caller } = await (supabase as any)
    .from('users')
    .select('id, app_role, organization_id, full_name, email')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!caller || (caller as any).app_role !== 'superuser') {
    return NextResponse.json({ error: 'Superuser only' }, { status: 403 });
  }

  let orgId: string = (caller as any).organization_id;

  // Create a demo org if the superuser doesn't have one
  if (!orgId) {
    const inviteToken = randomBytes(8).toString('hex');
    const { data: org, error: orgError } = await (supabase as any)
      .from('organizations')
      .insert({
        name: 'Demo Company',
        invite_token: inviteToken,
      })
      .select('id')
      .single();

    if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });

    orgId = (org as any).id;

    await (supabase as any)
      .from('users')
      .update({ organization_id: orgId })
      .eq('id', (caller as any).id);
  }

  const results: Record<string, any> = {};

  // ── Seed team members ────────────────────────────────────────────────────────
  const demoMembers = [
    { full_name: 'Jake Morrison',   email: 'jake.morrison@democorp.com',   status: 'approved', scenario_access: ['technician', 'property_manager'] },
    { full_name: 'Sarah Chen',      email: 'sarah.chen@democorp.com',      status: 'approved', scenario_access: ['plumber_bd'] },
    { full_name: 'Marcus Williams', email: 'marcus.williams@democorp.com', status: 'approved', scenario_access: ['technician', 'insurance'] },
    { full_name: 'Priya Patel',     email: 'priya.patel@democorp.com',     status: 'pending',  scenario_access: [] },
    { full_name: 'Tom Bradley',     email: 'tom.bradley@democorp.com',     status: 'rejected', scenario_access: ['technician'] },
  ];

  const memberResults: string[] = [];
  for (const m of demoMembers) {
    const { data: existing } = await (supabase as any)
      .from('users').select('id').eq('email', m.email).single();
    if (existing) { memberResults.push(`${m.full_name} — skipped (exists)`); continue; }

    const fakeAuthId = randomBytes(16).toString('hex');
    const { error } = await (supabase as any).from('users').insert({
      auth_user_id: fakeAuthId,
      full_name: m.full_name,
      email: m.email,
      app_role: 'individual',
      status: m.status,
      organization_id: orgId,
      scenario_access: m.scenario_access,
    });
    memberResults.push(`${m.full_name} — ${error ? `error: ${error.message}` : 'created'}`);
  }
  results.members = memberResults;

  // ── Seed candidate invites ───────────────────────────────────────────────────
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const demoCandidates = [
    { email: 'alex.johnson@hiring.com',    full_name: 'Alex Johnson',    status: 'pending',     assigned: [{ scenario_type: 'technician', count: 2 }] },
    { email: 'nina.torres@hiring.com',     full_name: 'Nina Torres',     status: 'signed_up',   assigned: [{ scenario_type: 'property_manager', count: 2 }, { scenario_type: 'insurance', count: 1 }] },
    { email: 'dan.kowalski@hiring.com',    full_name: 'Dan Kowalski',    status: 'in_progress', assigned: [{ scenario_type: 'plumber_bd', count: 3 }] },
    { email: 'lisa.huang@hiring.com',      full_name: 'Lisa Huang',      status: 'complete',    assigned: [{ scenario_type: 'technician', count: 2 }, { scenario_type: 'plumber_bd', count: 1 }] },
    { email: 'ryan.oconnor@hiring.com',    full_name: 'Ryan O\'Connor',  status: 'upgraded',    assigned: [{ scenario_type: 'insurance', count: 2 }] },
  ];

  const candidateResults: string[] = [];
  for (const c of demoCandidates) {
    const { data: existing } = await (supabase as any)
      .from('candidate_invites').select('id').eq('email', c.email).eq('organization_id', orgId).single();
    if (existing) { candidateResults.push(`${c.full_name} — skipped (exists)`); continue; }

    const personal_token = randomBytes(16).toString('hex');
    const expires_at = new Date(Date.now() + 30 * 86400_000).toISOString();
    const { error } = await (supabase as any).from('candidate_invites').insert({
      email: c.email,
      full_name: c.full_name,
      personal_token,
      invited_by_user_id: (caller as any).id,
      organization_id: orgId,
      assigned_scenarios: c.assigned,
      status: c.status,
      expires_at,
    });
    candidateResults.push(`${c.full_name} — ${error ? `error: ${error.message}` : 'created (invite: ${APP_URL}/signup?candidate=${personal_token})'}`);
  }
  results.candidates = candidateResults;

  // ── Seed coach connections ───────────────────────────────────────────────────
  // Fetch two coach instances to connect as demo coaches
  const { data: coachInstances } = await (supabase as any)
    .from('coach_instances')
    .select('id')
    .limit(2);

  const coachResults: string[] = [];
  if (coachInstances && (coachInstances as any[]).length > 0) {
    const statuses = ['pending', 'active'];
    for (let i = 0; i < Math.min((coachInstances as any[]).length, 2); i++) {
      const ci = (coachInstances as any[])[i];
      const { data: existing } = await (supabase as any)
        .from('company_coach_connections')
        .select('id')
        .eq('organization_id', orgId)
        .eq('coach_instance_id', ci.id)
        .single();
      if (existing) { coachResults.push(`coach ${ci.id} — skipped`); continue; }

      const approval_token = randomBytes(16).toString('hex');
      const { error } = await (supabase as any).from('company_coach_connections').insert({
        organization_id: orgId,
        coach_instance_id: ci.id,
        permission_level: i === 0 ? 'readonly' : 'edit_playbooks',
        status: statuses[i],
        approval_token,
      });
      coachResults.push(`coach ${ci.id} — ${error ? `error: ${error.message}` : statuses[i]}`);
    }
  } else {
    coachResults.push('no coach instances found — skipped');
  }
  results.coaches = coachResults;

  return NextResponse.json({ ok: true, orgId, results });
}
