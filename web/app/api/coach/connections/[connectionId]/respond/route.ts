import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-server';
import { sendConnectionAccepted, sendConnectionDeclined } from '@/lib/connection-emails';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  const action = request.nextUrl.searchParams.get('action');

  if (action !== 'accept' && action !== 'decline') {
    return new NextResponse('Invalid action', { status: 400 });
  }

  const supabase = createServiceSupabase();

  const { data: conn } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, organization_id, coach_instance_id, status, permission_level')
    .eq('approval_token', params.connectionId)
    .single();

  if (!conn) {
    return new NextResponse(
      '<html><body style="font-family:sans-serif;padding:40px"><h2>Link not found or already used.</h2></body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  if ((conn as any).status !== 'pending') {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px"><h2>This request has already been ${(conn as any).status}.</h2></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (action === 'accept') {
    const { error: updateError } = await (supabase as any)
      .from('company_coach_connections')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', (conn as any).id);

    if (updateError) {
      return new NextResponse(
        '<html><body style="font-family:sans-serif;padding:40px"><h2>Something went wrong. Please try again later.</h2></body></html>',
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const [{ data: org }, { data: adminUser }, { data: coachUser }] = await Promise.all([
      (supabase as any).from('organizations').select('name').eq('id', (conn as any).organization_id).single(),
      (supabase as any).from('users').select('id, full_name, email').eq('organization_id', (conn as any).organization_id).eq('app_role', 'company_admin').single(),
      (supabase as any).from('users').select('full_name').eq('coach_instance_id', (conn as any).coach_instance_id).eq('app_role', 'coach').single(),
    ]);

    if ((adminUser as any)?.email) {
      try {
        await sendConnectionAccepted({
          companyAdminEmail: (adminUser as any).email,
          companyName: (org as any)?.name ?? 'the company',
          coachName: (coachUser as any)?.full_name ?? 'The coach',
        });
      } catch (e) {
        console.error('Failed to send acceptance email:', e);
      }
    }

    // In-app notification to the company admin.
    if (adminUser && (adminUser as any).id) {
      await (supabase as any).from('notifications').insert({
        user_id: (adminUser as any).id,
        type: 'coach_assigned',
        title: `${(coachUser as any)?.full_name ?? 'Your coach'} accepted the connection`,
        body: `They now have access to ${(org as any)?.name ?? 'your company'}'s data on TechRP.`,
        data: { link: '/playbooks' },
      });
    }

    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;max-width:480px">
        <h2 style="color:#16a34a">&#10003; Connection Accepted</h2>
        <p>You now have access to <strong>${escapeHtml((org as any)?.name ?? 'the company')}</strong>'s data on TechRP.</p>
        <a href="${APP_URL}/coach" style="color:#2563eb">Go to your dashboard &rarr;</a>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } else {
    const { error: declineError } = await (supabase as any)
      .from('company_coach_connections')
      .update({ status: 'declined' })
      .eq('id', (conn as any).id);

    if (declineError) {
      return new NextResponse(
        '<html><body style="font-family:sans-serif;padding:40px"><h2>Something went wrong. Please try again later.</h2></body></html>',
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const [{ data: org }, { data: adminUser }, { data: coachUser }] = await Promise.all([
      (supabase as any).from('organizations').select('name').eq('id', (conn as any).organization_id).single(),
      (supabase as any).from('users').select('full_name, email').eq('organization_id', (conn as any).organization_id).eq('app_role', 'company_admin').single(),
      (supabase as any).from('users').select('full_name').eq('coach_instance_id', (conn as any).coach_instance_id).eq('app_role', 'coach').single(),
    ]);

    if ((adminUser as any)?.email) {
      try {
        await sendConnectionDeclined({
          companyAdminEmail: (adminUser as any).email,
          companyName: (org as any)?.name ?? 'the company',
          coachName: (coachUser as any)?.full_name ?? 'The coach',
        });
      } catch (e) {
        console.error('Failed to send decline email:', e);
      }
    }

    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;max-width:480px">
        <h2>Request Declined</h2>
        <p>You have declined the connection request from <strong>${escapeHtml((org as any)?.name ?? 'the company')}</strong>.</p>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
