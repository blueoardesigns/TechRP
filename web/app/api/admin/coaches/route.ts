import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/coaches — list all coaches
export async function GET() {
  const supabase = adminSupabase();
  const { data, error } = await (supabase as any)
    .from('users')
    .select(`
      id, full_name, email, status, created_at,
      coach_instances ( id, name, invite_token )
    `)
    .eq('app_role', 'coach')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coaches: data });
}

// POST /api/admin/coaches — create a coach
export async function POST(req: NextRequest) {
  const { fullName, email, instanceName } = await req.json();
  if (!fullName || !email || !instanceName) {
    return NextResponse.json({ error: 'fullName, email, instanceName required' }, { status: 400 });
  }

  const supabase = adminSupabase();

  // 1. Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Auth create failed' }, { status: 400 });
  }

  // 2. Insert user row
  const { data: userRow, error: userError } = await (supabase as any)
    .from('users')
    .insert({
      auth_user_id: authData.user.id,
      full_name: fullName,
      name: fullName,
      email,
      app_role: 'coach',
      role: 'manager',
      status: 'approved',
      scenario_access: ['homeowner_inbound', 'homeowner_facetime', 'plumber_lead',
        'property_manager', 'commercial_property_manager', 'insurance_broker', 'plumber_bd'],
    })
    .select('id')
    .single();

  if (userError || !userRow) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
  }

  // 3. Create coach instance
  const inviteToken = randomBytes(6).toString('hex');
  const { data: instance, error: instanceError } = await (supabase as any)
    .from('coach_instances')
    .insert({
      coach_user_id: (userRow as any).id,
      name: instanceName,
      invite_token: inviteToken,
    })
    .select('id, invite_token')
    .single();

  if (instanceError) {
    return NextResponse.json({ error: 'Failed to create coach instance' }, { status: 500 });
  }

  // 4. Link user to their instance
  const { error: linkError } = await (supabase as any)
    .from('users')
    .update({ coach_instance_id: (instance as any).id })
    .eq('id', (userRow as any).id);
  if (linkError) {
    console.error('Failed to link user to coach instance:', linkError);
  }

  // 5. Send welcome email with magic link
  try {
    const { data: linkData } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
    await resend.emails.send({
      from: 'TechRP <noreply@blueoardesigns.com>',
      to: email,
      subject: "You've been added as a TechRP Coach",
      html: `
        <h2>Welcome to TechRP, ${fullName}!</h2>
        <p>Your coach account has been created for <strong>${instanceName}</strong>.</p>
        <p>Click below to set up your password and access your dashboard:</p>
        <br/>
        <a href="${(linkData as any)?.properties?.action_link ?? APP_URL + '/login'}"
           style="background:#2563eb;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Set Up My Account →
        </a>
        <br/><br/>
        <p>Your invite link for clients: <code>${APP_URL}/signup?coach=${inviteToken}</code></p>
      `,
    });
  } catch (e) {
    console.error('Welcome email failed:', e);
  }

  return NextResponse.json({
    success: true,
    inviteUrl: `${APP_URL}/signup?coach=${inviteToken}`,
    coachId: (userRow as any).id,
  });
}

// PATCH /api/admin/coaches — deactivate a coach
export async function PATCH(req: NextRequest) {
  const { coachId } = await req.json();
  if (!coachId) return NextResponse.json({ error: 'coachId required' }, { status: 400 });
  const supabase = adminSupabase();
  const { error } = await (supabase as any).from('users').update({ status: 'rejected' }).eq('id', coachId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
