import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { sendConnectionAccepted, sendConnectionDeclined } from '@/lib/connection-emails';

/**
 * Coach-connection accept/decline.
 *
 * Historically this was a GET endpoint, but email-link prefetchers (Outlook
 * Safe Links, Slack unfurl, antivirus scanners) auto-fetched those URLs and
 * silently triggered accept/decline. The flow now uses a confirmation page
 * (`/coach/connections/[token]/confirm`) which POSTs here after a real click.
 *
 * Body: { action: 'accept' | 'decline' }
 * URL param `connectionId` is the per-invite approval_token.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  let action: string | null = null;
  try {
    const body = await request.json();
    action = body?.action ?? null;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: conn } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, organization_id, coach_instance_id, status, permission_level')
    .eq('approval_token', params.connectionId)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }
  if ((conn as any).status !== 'pending') {
    return NextResponse.json({
      error: `This request has already been ${(conn as any).status}.`,
      status: (conn as any).status,
    }, { status: 409 });
  }

  if (action === 'accept') {
    const { error: updateError } = await (supabase as any)
      .from('company_coach_connections')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', (conn as any).id);
    if (updateError) {
      return NextResponse.json({ error: 'Failed to accept connection' }, { status: 500 });
    }

    const [{ data: org }, { data: adminUser }, { data: coachUser }] = await Promise.all([
      (supabase as any).from('organizations').select('name').eq('id', (conn as any).organization_id).maybeSingle(),
      (supabase as any).from('users').select('id, full_name, email').eq('organization_id', (conn as any).organization_id).eq('app_role', 'company_admin').maybeSingle(),
      (supabase as any).from('users').select('full_name').eq('coach_instance_id', (conn as any).coach_instance_id).eq('app_role', 'coach').maybeSingle(),
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

    if (adminUser && (adminUser as any).id) {
      await (supabase as any).from('notifications').insert({
        user_id: (adminUser as any).id,
        type: 'coach_assigned',
        title: `${(coachUser as any)?.full_name ?? 'Your coach'} accepted the connection`,
        body: `They now have access to ${(org as any)?.name ?? 'your company'}'s data on TechRP.`,
        data: { link: '/playbooks' },
      });
    }

    return NextResponse.json({
      success: true,
      action: 'accepted',
      companyName: (org as any)?.name ?? null,
    });
  }

  // decline
  const { error: declineError } = await (supabase as any)
    .from('company_coach_connections')
    .update({ status: 'declined' })
    .eq('id', (conn as any).id);
  if (declineError) {
    return NextResponse.json({ error: 'Failed to decline connection' }, { status: 500 });
  }

  const [{ data: org }, { data: adminUser }, { data: coachUser }] = await Promise.all([
    (supabase as any).from('organizations').select('name').eq('id', (conn as any).organization_id).maybeSingle(),
    (supabase as any).from('users').select('full_name, email').eq('organization_id', (conn as any).organization_id).eq('app_role', 'company_admin').maybeSingle(),
    (supabase as any).from('users').select('full_name').eq('coach_instance_id', (conn as any).coach_instance_id).eq('app_role', 'coach').maybeSingle(),
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

  return NextResponse.json({
    success: true,
    action: 'declined',
    companyName: (org as any)?.name ?? null,
  });
}

/**
 * GET — preview info for the confirmation page (read-only).
 *  Does NOT mutate state, so link prefetchers can't accept/decline.
 *  Used by /coach/connections/[token]/confirm to render org/coach context.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  const supabase = createServiceRoleClient();
  const { data: conn } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, organization_id, coach_instance_id, status, permission_level')
    .eq('approval_token', params.connectionId)
    .maybeSingle();
  if (!conn) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const [{ data: org }, { data: coachUser }] = await Promise.all([
    (supabase as any).from('organizations').select('name').eq('id', (conn as any).organization_id).maybeSingle(),
    (supabase as any).from('users').select('full_name').eq('coach_instance_id', (conn as any).coach_instance_id).eq('app_role', 'coach').maybeSingle(),
  ]);

  return NextResponse.json({
    status: (conn as any).status,
    companyName: (org as any)?.name ?? null,
    coachName: (coachUser as any)?.full_name ?? null,
    permissionLevel: (conn as any).permission_level ?? null,
  });
}
