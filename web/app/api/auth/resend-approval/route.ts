import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const APPROVAL_SECRET = process.env.APPROVAL_SECRET ?? 'change-me-in-env';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required.' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user, error } = await supabase
    .from('users')
    .select('auth_user_id, name, full_name, email, app_role, scenario_access')
    .eq('email', email)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const authUserId  = (user as any).auth_user_id;
  const fullName    = (user as any).full_name ?? (user as any).name ?? email;
  const role        = (user as any).app_role ?? 'individual';
  const modules     = ((user as any).scenario_access ?? []).join(', ');

  const approveUrl = `${APP_URL}/api/auth/approve?userId=${authUserId}&key=${APPROVAL_SECRET}`;
  const rejectUrl  = `${APP_URL}/api/auth/approve?userId=${authUserId}&key=${APPROVAL_SECRET}&action=reject`;

  await resend.emails.send({
    from: 'TechRP <noreply@blueoardesigns.com>',
    to: 'tim@blueoardesigns.com',
    subject: `New TechRP Signup — ${fullName}`,
    html: `
      <h2>New Account Request</h2>
      <table>
        <tr><td><strong>Name:</strong></td><td>${fullName}</td></tr>
        <tr><td><strong>Email:</strong></td><td>${email}</td></tr>
        <tr><td><strong>Type:</strong></td><td>${role === 'company_admin' ? 'Company Admin' : 'Individual'}</td></tr>
        <tr><td><strong>Modules:</strong></td><td>${modules || 'all'}</td></tr>
      </table>
      <br/>
      <p>
        <a href="${approveUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin-right:12px;">✅ Approve</a>
        <a href="${rejectUrl}" style="background:#dc2626;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">❌ Reject</a>
      </p>
    `,
  });

  return NextResponse.json({ success: true });
}
