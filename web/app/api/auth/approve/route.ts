import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const APPROVAL_SECRET = process.env.APPROVAL_SECRET ?? 'change-me-in-env';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get('userId');
  const key    = searchParams.get('key');
  const action = searchParams.get('action') ?? 'approve';

  if (!userId || key !== APPROVAL_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const newStatus = action === 'reject' ? 'rejected' : 'approved';

  // Update user status
  const { data: updated, error } = await supabase
    .from('users')
    .update({ status: newStatus } as any)
    .eq('auth_user_id', userId)
    .select('email, name, full_name')
    .single();

  if (error || !updated) {
    return new NextResponse('User not found', { status: 404 });
  }

  const userEmail = (updated as any).email;
  const userName  = (updated as any).full_name ?? (updated as any).name ?? 'there';

  // Send notification email to the user
  if (userEmail) {
    try {
      if (newStatus === 'approved') {
        await resend.emails.send({
          from: 'TechRP <noreply@blueoardesigns.com>',
          to: userEmail,
          subject: "You're approved — welcome to TechRP!",
          html: `
            <h2>Welcome to TechRP, ${userName}!</h2>
            <p>Your account has been approved. You can now sign in and start training.</p>
            <br/>
            <a href="${APP_URL}/login" style="background:#2563eb;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Sign In →
            </a>
          `,
        });
      } else {
        await resend.emails.send({
          from: 'TechRP <noreply@blueoardesigns.com>',
          to: userEmail,
          subject: 'TechRP — Account Request Update',
          html: `
            <p>Hi ${userName},</p>
            <p>Unfortunately your TechRP account request was not approved at this time. If you believe this is an error, please reply to this email.</p>
          `,
        });
      }
    } catch (emailErr) {
      console.error('Failed to send notification email:', emailErr);
    }
  }

  // Return a simple HTML confirmation page Tim sees after clicking
  const html = newStatus === 'approved'
    ? `<html><body style="font-family:sans-serif;padding:40px;background:#f9fafb">
        <h2 style="color:#16a34a">✅ Approved</h2>
        <p><strong>${userName}</strong> (${userEmail}) has been approved. They'll receive a confirmation email.</p>
        </body></html>`
    : `<html><body style="font-family:sans-serif;padding:40px;background:#f9fafb">
        <h2 style="color:#dc2626">❌ Rejected</h2>
        <p><strong>${userName}</strong> (${userEmail}) has been rejected. They'll receive a notification email.</p>
        </body></html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
