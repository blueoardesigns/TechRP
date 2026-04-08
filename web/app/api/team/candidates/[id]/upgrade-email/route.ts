import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: admin } = await (supabase as any)
    .from('users')
    .select('organization_id, app_role')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!admin || (admin as any).app_role !== 'company_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: invite } = await (supabase as any)
    .from('candidate_invites')
    .select('organization_id, status, personal_token, email, full_name')
    .eq('id', params.id)
    .single();

  if (!invite || (invite as any).organization_id !== (admin as any).organization_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if ((invite as any).status !== 'complete') {
    return NextResponse.json({ error: 'Candidate has not completed their assessment yet.' }, { status: 400 });
  }

  const upgradeUrl = `${APP_URL}/upgrade?token=${(invite as any).personal_token}`;
  const candidateName = (invite as any).full_name ?? (invite as any).email;

  try {
    await resend.emails.send({
      from: 'TechRP <noreply@blueoardesigns.com>',
      to: (invite as any).email,
      subject: "You've been invited to create a full TechRP account",
      html: `
        <h2>Great work, ${candidateName}!</h2>
        <p>You've completed your candidate assessment. You've been invited to create a full TechRP account to continue your training.</p>
        <p>
          <a href="${upgradeUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Activate Full Account →
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;">This link is personal to you. Do not share it.</p>
      `,
    });
  } catch (err) {
    console.error('Failed to send upgrade email:', err);
    return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
