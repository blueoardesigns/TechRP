import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const APPROVAL_SECRET = process.env.APPROVAL_SECRET ?? 'change-me-in-env';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  const { fullName, email, password, role, companyName, scenarioAccess } = await req.json();

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
    email_confirm: true, // skip confirmation email — we approve manually
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

  // 2. Determine organization — create one for company_admin, use default for individual
  let organizationId = '00000000-0000-0000-0000-000000000001';
  if (role === 'company_admin' && companyName) {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: companyName })
      .select('id')
      .single();

    if (!orgError && org) organizationId = org.id;
  }

  // 3. Insert user profile
  const { error: profileError } = await supabase.from('users').insert({
    auth_user_id: authUserId,
    organization_id: organizationId,
    name: fullName,
    full_name: fullName,
    email,
    role: role === 'company_admin' ? 'admin' : 'technician',
    app_role: role,
    status: 'pending',
    scenario_access: scenarioAccess ?? [],
    tos_accepted_at: new Date().toISOString(),
  } as any);

  if (profileError) {
    // Clean up auth user if profile insert failed
    await supabase.auth.admin.deleteUser(authUserId);
    console.error('Profile insert error:', profileError);
    return NextResponse.json({ error: 'Failed to create user profile.' }, { status: 500 });
  }

  // 4. Send approval notification email to Tim
  const approveUrl = `${APP_URL}/api/auth/approve?userId=${authUserId}&key=${APPROVAL_SECRET}`;
  const rejectUrl  = `${APP_URL}/api/auth/approve?userId=${authUserId}&key=${APPROVAL_SECRET}&action=reject`;
  const moduleList = Array.isArray(scenarioAccess) ? scenarioAccess.join(', ') : 'all';

  try {
    await resend.emails.send({
      from: 'TechRP <noreply@blueoardesigns.com>',
      to: 'tim@blueoardesigns.com',
      subject: `New TechRP Signup — ${fullName}`,
      html: `
        <h2>New Account Request</h2>
        <table>
          <tr><td><strong>Name:</strong></td><td>${fullName}</td></tr>
          <tr><td><strong>Email:</strong></td><td>${email}</td></tr>
          <tr><td><strong>Type:</strong></td><td>${role === 'company_admin' ? `Company Admin${companyName ? ` — ${companyName}` : ''}` : 'Individual'}</td></tr>
          <tr><td><strong>Modules:</strong></td><td>${moduleList}</td></tr>
        </table>
        <br/>
        <p>
          <a href="${approveUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin-right:12px;">✅ Approve</a>
          <a href="${rejectUrl}" style="background:#dc2626;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">❌ Reject</a>
        </p>
      `,
    });
  } catch (emailErr) {
    // Don't fail the signup if email fails — log and continue
    console.error('Failed to send approval email:', emailErr);
  }

  return NextResponse.json({ success: true });
}
