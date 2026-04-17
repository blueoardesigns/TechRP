import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { applyReferral, generateReferralCode, type ReferralSource } from '@/lib/referral';

const resend = new Resend(process.env.RESEND_API_KEY);

const APPROVAL_SECRET = process.env.APPROVAL_SECRET ?? 'change-me-in-env';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  const { fullName, email, password, role, companyName, scenarioAccess, coachToken, orgToken, candidateToken, marketingConsent, refCode, refSource } = await req.json();

  if (!fullName || !email || !password || !role) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  // Use service role to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    // SKIP_EMAIL_CONFIRM=false in production to require email verification.
    // Defaults to true (skip verification) to preserve current behaviour.
    email_confirm: process.env.SKIP_EMAIL_CONFIRM !== 'false',
  });

  if (authError || !authData.user) {
    const msg = authError?.message ?? 'Failed to create account.';
    // Surface duplicate email cleanly
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const authUserId = authData.user.id;

  // 2. Resolve invite context (coach/org tokens)
  let resolvedCoachInstanceId: string | null = null;
  let organizationId: string | null = null;
  let autoApprove = false;
  let approverEmail = 'tim@blueoardesigns.com';
  let finalScenarioAccess = scenarioAccess ?? [];

  if (orgToken) {
    // Individual joining a company via org invite link
    const { data: org } = await (supabase as any)
      .from('organizations')
      .select('id, coach_instance_id')
      .eq('invite_token', orgToken)
      .single();
    if (!org) {
      await supabase.auth.admin.deleteUser(authUserId);
      return NextResponse.json({ error: 'Invalid invite link.' }, { status: 400 });
    }
    if (org) {
      organizationId = (org as any).id;
      resolvedCoachInstanceId = (org as any).coach_instance_id;
      // Inherit scenario_access from the org's company admin
      const { data: admin } = await (supabase as any)
        .from('users')
        .select('scenario_access')
        .eq('organization_id', (org as any).id)
        .eq('app_role', 'company_admin')
        .single();
      if (admin) finalScenarioAccess = (admin as any).scenario_access ?? [];
      // Check coach instance auto-approve setting
      if (resolvedCoachInstanceId) {
        const { data: inst } = await (supabase as any)
          .from('coach_instances')
          .select('auto_approve_users, coach_user_id')
          .eq('id', resolvedCoachInstanceId)
          .single();
        if (inst) {
          autoApprove = (inst as any).auto_approve_users;
          const { data: coachUser } = await (supabase as any)
            .from('users').select('email').eq('id', (inst as any).coach_user_id).single();
          if (coachUser) approverEmail = (coachUser as any).email;
        }
      }
    }
  } else if (coachToken) {
    // Signing up via coach invite link
    const { data: inst } = await (supabase as any)
      .from('coach_instances')
      .select('id, auto_approve_users, coach_user_id')
      .eq('invite_token', coachToken)
      .single();
    if (!inst) {
      await supabase.auth.admin.deleteUser(authUserId);
      return NextResponse.json({ error: 'Invalid invite link.' }, { status: 400 });
    }
    if (inst) {
      resolvedCoachInstanceId = (inst as any).id;
      autoApprove = (inst as any).auto_approve_users;
      const { data: coachUser } = await (supabase as any)
        .from('users').select('email').eq('id', (inst as any).coach_user_id).single();
      if (coachUser) approverEmail = (coachUser as any).email;
      // If company_admin invite, create org
      if (role === 'company_admin' && companyName) {
        const { randomBytes } = await import('crypto');
        const orgInviteToken = randomBytes(6).toString('hex');
        const { data: newOrg } = await (supabase as any)
          .from('organizations')
          .insert({ name: companyName, coach_instance_id: resolvedCoachInstanceId, invite_token: orgInviteToken })
          .select('id')
          .single();
        if (newOrg) organizationId = (newOrg as any).id;
      }
    }
  } else if (candidateToken) {
    // Candidate signing up via personal invite link
    const { data: invite } = await (supabase as any)
      .from('candidate_invites')
      .select('id, email, organization_id, coach_instance_id, assigned_scenarios, status, expires_at, invited_by_user_id')
      .eq('personal_token', candidateToken)
      .single();

    if (!invite || (invite as any).status !== 'pending') {
      await supabase.auth.admin.deleteUser(authUserId);
      return NextResponse.json({ error: 'Invalid or already-used invite link.' }, { status: 400 });
    }
    if ((invite as any).expires_at && new Date((invite as any).expires_at) < new Date()) {
      await supabase.auth.admin.deleteUser(authUserId);
      return NextResponse.json({ error: 'This invite link has expired.' }, { status: 400 });
    }

    organizationId = (invite as any).organization_id;
    resolvedCoachInstanceId = (invite as any).coach_instance_id;
    autoApprove = true; // candidates skip the approval queue

    // Compute session_limit and scenario_access from assigned_scenarios
    const assigned: { scenario_type: string; count: number }[] = (invite as any).assigned_scenarios ?? [];
    const sessionLimit = assigned.reduce((sum, s) => sum + s.count, 0);
    finalScenarioAccess = [...new Set(assigned.map(s => s.scenario_type))];

    // Insert user profile with candidate-specific fields
    const { error: candidateProfileError } = await (supabase as any).from('users').insert({
      auth_user_id: authUserId,
      organization_id: organizationId,
      coach_instance_id: resolvedCoachInstanceId,
      name: fullName,
      full_name: fullName,
      email: (invite as any).email, // use invite email, not form email
      role: 'technician',
      app_role: 'individual',
      status: 'approved',
      scenario_access: finalScenarioAccess,
      session_limit: sessionLimit,
      user_type: 'candidate',
      marketing_consent: marketingConsent ?? false,
      tos_accepted_at: new Date().toISOString(),
      referral_code: generateReferralCode(),
    });

    if (candidateProfileError) {
      await supabase.auth.admin.deleteUser(authUserId);
      console.error('Candidate profile insert error:', candidateProfileError);
      return NextResponse.json({ error: 'Failed to create candidate profile.' }, { status: 500 });
    }

    // Get new user's id to link invite
    const { data: newUser } = await (supabase as any)
      .from('users').select('id').eq('auth_user_id', authUserId).single();

    // Update invite to signed_up
    if (newUser) {
      await (supabase as any)
        .from('candidate_invites')
        .update({ status: 'signed_up', signed_up_user_id: (newUser as any).id })
        .eq('id', (invite as any).id);

      // Link user back to invite
      await (supabase as any)
        .from('users')
        .update({ candidate_invite_id: (invite as any).id })
        .eq('id', (newUser as any).id);

      // Notify company admin that candidate signed up
      await (supabase as any).from('notifications').insert({
        user_id: (invite as any).invited_by_user_id,
        type: 'candidate_signed_up',
        title: `${fullName} accepted your candidate invite`,
        body: 'They can now begin their assigned sessions.',
        data: { candidate_invite_id: (invite as any).id, candidate_user_id: (newUser as any).id },
      });
    }

    // Return early — skip the default profile insert below
    return NextResponse.json({ success: true, autoApproved: true });
  } else if (role === 'company_admin' && companyName) {
    // Direct TechRP signup — create org
    const { data: org } = await (supabase as any)
      .from('organizations')
      .insert({ name: companyName })
      .select('id')
      .single();
    if (org) organizationId = (org as any).id;
  }

  // 3. Insert user profile
  const newReferralCode = generateReferralCode();
  const { data: profileData, error: profileError } = await (supabase as any).from('users').insert({
    auth_user_id: authUserId,
    organization_id: organizationId,
    coach_instance_id: resolvedCoachInstanceId,
    name: fullName,
    full_name: fullName,
    email,
    role: role === 'company_admin' ? 'admin' : 'technician',
    app_role: role,
    status: 'approved',
    scenario_access: finalScenarioAccess,
    tos_accepted_at: new Date().toISOString(),
    referral_code: newReferralCode,
  }).select('id, organization_id').single();

  if (profileError) {
    // Clean up auth user if profile insert failed
    await supabase.auth.admin.deleteUser(authUserId);
    console.error('Profile insert error:', profileError);
    return NextResponse.json({ error: 'Failed to create user profile.' }, { status: 500 });
  }

  // Coach invite token — create coach_referrals row for pricing discounts/affiliates
  const pricingCoachToken = req.nextUrl?.searchParams.get('coach')
  if (pricingCoachToken && organizationId) {
    const { verifyCoachToken } = await import('@/lib/coach-token')
    const coachPayload = verifyCoachToken(pricingCoachToken)
    if (coachPayload) {
      await (supabase as any).from('coach_referrals').insert({
        coach_id: coachPayload.coachId,
        org_id: organizationId,
        type: coachPayload.type,
        percentage: coachPayload.percentage,
      }).then(() => {}) // fire-and-forget, don't fail signup
    }
  }

  // Apply referral credit if the user signed up via a referral link.
  if (refCode) {
    const { data: newUser } = await (supabase as any)
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();
    if (newUser) {
      await applyReferral(
        refCode,
        (newUser as any).id,
        fullName,
        (refSource === 'share_page' ? 'share_page' : 'signup_link') as ReferralSource,
      );
    }
  }

  return NextResponse.json({
    success: true,
    autoApproved: autoApprove,
    userId: profileData?.id ?? null,
    orgId: profileData?.organization_id ?? null,
  });
}
