# Company–Coach Connections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let company admins invite consulting coaches via invite code, with scoped permissions (edit playbooks vs. read-only). Coach approves via email before access is granted. Both parties can remove the connection.

**Architecture:** New `company_coach_connections` table (junction with status + permission_level + approval_token). Company admin submits coach's invite token → system creates a pending connection + emails the coach. Coach clicks Accept/Decline in email → connection becomes active or declined. Access enforcement adds a check for active connections when coaches access company sessions/playbooks. All email via Resend (already in use). New "Coaches" tab in company admin dashboard; new "Connected Companies" section in coach dashboard.

**Tech Stack:** Supabase, Next.js API routes, Resend, TypeScript, existing coach dashboard (`web/app/coach/page.tsx`), existing company admin dashboard (find path in Task 6)

---

## File Map

| File | Change |
|---|---|
| `web/supabase/company-coach-connections-migration.sql` | New — creates connections table + RLS |
| `web/app/api/company/coaches/route.ts` | New — GET list + POST create connection |
| `web/app/api/company/coaches/[id]/route.ts` | New — DELETE remove connection |
| `web/app/api/coach/connections/route.ts` | New — GET coach's connections |
| `web/app/api/coach/connections/[id]/route.ts` | New — DELETE coach removes connection |
| `web/app/api/coach/connections/[token]/respond/route.ts` | New — email approval handler |
| `web/lib/connection-emails.ts` | New — Resend email helpers for connection flow |
| `web/app/coach/page.tsx` | Add "Connected Companies" section |
| Company admin page (find in Task 6) | Add "Coaches" tab |

---

### Task 1: Create and run the database migration

**Files:**
- Create: `web/supabase/company-coach-connections-migration.sql`

- [ ] **Step 1: Create the migration file**

Create `web/supabase/company-coach-connections-migration.sql`:

```sql
-- ============================================================
-- Company–Coach Connections
-- Allows companies to invite consulting coaches with scoped
-- permissions. Separate from coach-owned companies.
--
-- Run AFTER all previous migrations.
-- ============================================================

CREATE TABLE IF NOT EXISTS company_coach_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  coach_instance_id UUID NOT NULL REFERENCES coach_instances(id) ON DELETE CASCADE,
  permission_level  TEXT NOT NULL
                    CHECK (permission_level IN ('edit_playbooks', 'readonly')),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'declined')),
  approval_token    TEXT UNIQUE NOT NULL
                    DEFAULT encode(gen_random_bytes(32), 'hex'),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at       TIMESTAMPTZ,
  UNIQUE(organization_id, coach_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_ccc_org    ON company_coach_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_ccc_coach  ON company_coach_connections(coach_instance_id);
CREATE INDEX IF NOT EXISTS idx_ccc_token  ON company_coach_connections(approval_token);
CREATE INDEX IF NOT EXISTS idx_ccc_status ON company_coach_connections(status);

-- RLS
ALTER TABLE company_coach_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccc: service role bypass"
  ON company_coach_connections FOR ALL
  USING (auth.role() = 'service_role');

-- Company admins can read their org's connections
CREATE POLICY "ccc: company_admin select"
  ON company_coach_connections FOR SELECT
  USING (organization_id = _my_org_id());

-- Coaches can read connections for their instance
CREATE POLICY "ccc: coach select"
  ON company_coach_connections FOR SELECT
  USING (coach_instance_id = _my_coach_instance_id());
```

- [ ] **Step 2: Run the migration**

Supabase Dashboard → SQL Editor → New query. Paste contents of `company-coach-connections-migration.sql`. Click Run.

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify the table**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'company_coach_connections'
ORDER BY ordinal_position;
```

Expected columns: `id`, `organization_id`, `coach_instance_id`, `permission_level`, `status`, `approval_token`, `requested_at`, `accepted_at`.

---

### Task 2: Create Resend email helpers for the connection flow

**Files:**
- Create: `web/lib/connection-emails.ts`

- [ ] **Step 1: Find the BASE_URL used in existing email links**

```bash
grep -r "BASE_URL\|NEXT_PUBLIC_APP_URL\|APP_URL\|vercel.app\|localhost:3000" web/lib web/app/api/auth --include="*.ts" | head -10
```

Note the env var or hardcoded URL used for email links in existing email-sending code.

- [ ] **Step 2: Create connection-emails.ts**

Create `web/lib/connection-emails.ts`:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'TechRP <noreply@blueoardesigns.com>';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendCoachApprovalRequest({
  coachEmail,
  coachName,
  companyName,
  permissionLevel,
  approvalToken,
}: {
  coachEmail: string;
  coachName: string;
  companyName: string;
  permissionLevel: 'edit_playbooks' | 'readonly';
  approvalToken: string;
}) {
  const acceptUrl = `${BASE_URL}/api/coach/connections/${approvalToken}/respond?action=accept`;
  const declineUrl = `${BASE_URL}/api/coach/connections/${approvalToken}/respond?action=decline`;

  const permissionText =
    permissionLevel === 'edit_playbooks'
      ? 'view their users, training sessions, recordings, <strong>and edit their playbooks</strong>'
      : 'view their users, training sessions, and recordings (read-only)';

  await resend.emails.send({
    from: FROM,
    to: coachEmail,
    subject: `${companyName} wants to connect with you on TechRP`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
        <h2 style="margin-bottom:8px">Connection Request</h2>
        <p>Hi ${coachName},</p>
        <p><strong>${companyName}</strong> has requested to connect with you on TechRP.</p>
        <p>If you accept, you will be able to ${permissionText} for this company.</p>
        <div style="margin:32px 0;display:flex;gap:12px">
          <a href="${acceptUrl}"
             style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:12px">
            Accept
          </a>
          <a href="${declineUrl}"
             style="background:#4b5563;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Decline
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px">
          If you did not expect this request, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendConnectionAccepted({
  companyAdminEmail,
  companyName,
  coachName,
}: {
  companyAdminEmail: string;
  companyName: string;
  coachName: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: companyAdminEmail,
    subject: `${coachName} has accepted your connection request`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
        <h2>Connection Accepted</h2>
        <p><strong>${coachName}</strong> has accepted your connection request for <strong>${companyName}</strong>.</p>
        <p>They now have access to your account. You can manage this connection from your dashboard.</p>
      </div>
    `,
  });
}

export async function sendConnectionDeclined({
  companyAdminEmail,
  companyName,
  coachName,
}: {
  companyAdminEmail: string;
  companyName: string;
  coachName: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: companyAdminEmail,
    subject: `${coachName} declined your connection request`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
        <h2>Connection Declined</h2>
        <p><strong>${coachName}</strong> has declined the connection request for <strong>${companyName}</strong>.</p>
        <p>You can reach out to them directly to discuss access.</p>
      </div>
    `,
  });
}

export async function sendConnectionRemoved({
  recipientEmail,
  recipientName,
  removerName,
  companyName,
}: {
  recipientEmail: string;
  recipientName: string;
  removerName: string;
  companyName: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `Connection with ${companyName} has been removed`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
        <h2>Connection Removed</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${removerName}</strong> has removed the coaching connection for <strong>${companyName}</strong>.</p>
        <p>Access to this company's data has been revoked.</p>
      </div>
    `,
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

---

### Task 3: Create company-side API routes

**Files:**
- Create: `web/app/api/company/coaches/route.ts`
- Create: `web/app/api/company/coaches/[id]/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p web/app/api/company/coaches/\[id\]
```

- [ ] **Step 2: Create GET + POST handler**

Create `web/app/api/company/coaches/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { sendCoachApprovalRequest } from '@/lib/connection-emails';

async function getCompanyAdminProfile() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceSupabase();
  const { data } = await (supabase as any)
    .from('users')
    .select('id, app_role, organization_id, full_name, email')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'company_admin') return null;
  return data as any;
}

// GET /api/company/coaches — list connections for this company
export async function GET() {
  const profile = await getCompanyAdminProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: connections } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, coach_instance_id, permission_level, status, requested_at, accepted_at')
    .eq('organization_id', profile.organization_id)
    .neq('status', 'declined')
    .order('requested_at', { ascending: false });

  // Enrich with coach names
  const enriched = await Promise.all(
    (connections ?? []).map(async (conn: any) => {
      const { data: coachUser } = await (supabase as any)
        .from('users')
        .select('full_name, email')
        .eq('coach_instance_id', conn.coach_instance_id)
        .eq('app_role', 'coach')
        .single();
      return {
        ...conn,
        coachName: (coachUser as any)?.full_name ?? 'Unknown Coach',
        coachEmail: (coachUser as any)?.email ?? '',
      };
    })
  );

  return NextResponse.json({ connections: enriched });
}

// POST /api/company/coaches — submit coach invite token, create pending connection
export async function POST(request: NextRequest) {
  const profile = await getCompanyAdminProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { inviteToken, permissionLevel } = await request.json();

  if (!inviteToken || !permissionLevel) {
    return NextResponse.json({ error: 'inviteToken and permissionLevel are required' }, { status: 400 });
  }

  if (!['edit_playbooks', 'readonly'].includes(permissionLevel)) {
    return NextResponse.json({ error: 'permissionLevel must be edit_playbooks or readonly' }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  // Look up coach instance by invite token
  const { data: coachInstance } = await (supabase as any)
    .from('coach_instances')
    .select('id, name')
    .eq('invite_token', inviteToken.trim())
    .single();

  if (!coachInstance) {
    return NextResponse.json({ error: 'Coach not found. Check the invite code and try again.' }, { status: 404 });
  }

  // Prevent connecting to the coach that owns this company (if any)
  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('coach_instance_id, name')
    .eq('id', profile.organization_id)
    .single();

  if ((org as any)?.coach_instance_id === (coachInstance as any).id) {
    return NextResponse.json({ error: 'This coach already manages your company.' }, { status: 409 });
  }

  // Check for duplicate
  const { data: existing } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, status')
    .eq('organization_id', profile.organization_id)
    .eq('coach_instance_id', (coachInstance as any).id)
    .single();

  if (existing) {
    if ((existing as any).status === 'active') {
      return NextResponse.json({ error: 'This coach is already connected to your company.' }, { status: 409 });
    }
    if ((existing as any).status === 'pending') {
      return NextResponse.json({ error: 'A connection request is already pending for this coach.' }, { status: 409 });
    }
    // Declined — allow re-request by deleting old row
    await (supabase as any)
      .from('company_coach_connections')
      .delete()
      .eq('id', (existing as any).id);
  }

  // Create connection
  const { data: connection, error: insertError } = await (supabase as any)
    .from('company_coach_connections')
    .insert({
      organization_id: profile.organization_id,
      coach_instance_id: (coachInstance as any).id,
      permission_level: permissionLevel,
    })
    .select('id, approval_token')
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Get coach user details for email
  const { data: coachUser } = await (supabase as any)
    .from('users')
    .select('full_name, email')
    .eq('coach_instance_id', (coachInstance as any).id)
    .eq('app_role', 'coach')
    .single();

  if ((coachUser as any)?.email) {
    try {
      await sendCoachApprovalRequest({
        coachEmail: (coachUser as any).email,
        coachName: (coachUser as any).full_name ?? 'Coach',
        companyName: (org as any)?.name ?? 'A company',
        permissionLevel: permissionLevel as 'edit_playbooks' | 'readonly',
        approvalToken: (connection as any).approval_token,
      });
    } catch (emailError) {
      console.error('Failed to send coach approval email:', emailError);
      // Don't fail the request — connection is created, email is best-effort
    }
  }

  return NextResponse.json({ ok: true, connectionId: (connection as any).id }, { status: 201 });
}
```

- [ ] **Step 3: Create DELETE handler**

Create `web/app/api/company/coaches/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { sendConnectionRemoved } from '@/lib/connection-emails';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('id, app_role, organization_id, full_name, email')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!profile || (profile as any).app_role !== 'company_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch connection to verify ownership and get coach details
  const { data: conn } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, organization_id, coach_instance_id, status')
    .eq('id', params.id)
    .single();

  if (!conn || (conn as any).organization_id !== (profile as any).organization_id) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  await (supabase as any).from('company_coach_connections').delete().eq('id', params.id);

  // Get org name and coach email for notification
  const [{ data: org }, { data: coachUser }] = await Promise.all([
    (supabase as any).from('organizations').select('name').eq('id', (conn as any).organization_id).single(),
    (supabase as any).from('users').select('full_name, email').eq('coach_instance_id', (conn as any).coach_instance_id).eq('app_role', 'coach').single(),
  ]);

  if ((coachUser as any)?.email) {
    try {
      await sendConnectionRemoved({
        recipientEmail: (coachUser as any).email,
        recipientName: (coachUser as any).full_name ?? 'Coach',
        removerName: (profile as any).full_name ?? 'Company Admin',
        companyName: (org as any)?.name ?? 'the company',
      });
    } catch (e) {
      console.error('Failed to send removal email to coach:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify build**

```bash
cd web && npm run build 2>&1 | tail -20
```

---

### Task 4: Create coach-side API routes

**Files:**
- Create: `web/app/api/coach/connections/route.ts`
- Create: `web/app/api/coach/connections/[id]/route.ts`
- Create: `web/app/api/coach/connections/[token]/respond/route.ts`

- [ ] **Step 1: Create directories**

```bash
mkdir -p web/app/api/coach/connections/\[id\]
mkdir -p web/app/api/coach/connections/\[token\]/respond
```

- [ ] **Step 2: Create GET connections route**

Create `web/app/api/coach/connections/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

async function getCoachProfile() {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return null;
  const supabase = createServiceSupabase();
  const { data } = await (supabase as any)
    .from('users')
    .select('id, app_role, coach_instance_id')
    .eq('auth_user_id', authUser.id)
    .single();
  if (!data || (data as any).app_role !== 'coach') return null;
  return data as any;
}

export async function GET() {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: connections } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, organization_id, permission_level, status, requested_at, accepted_at')
    .eq('coach_instance_id', profile.coach_instance_id)
    .neq('status', 'declined')
    .order('requested_at', { ascending: false });

  const enriched = await Promise.all(
    (connections ?? []).map(async (conn: any) => {
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('name')
        .eq('id', conn.organization_id)
        .single();
      const { data: admin } = await (supabase as any)
        .from('users')
        .select('full_name, email')
        .eq('organization_id', conn.organization_id)
        .eq('app_role', 'company_admin')
        .single();
      return {
        ...conn,
        companyName: (org as any)?.name ?? 'Unknown Company',
        adminName: (admin as any)?.full_name ?? '',
        adminEmail: (admin as any)?.email ?? '',
      };
    })
  );

  return NextResponse.json({ connections: enriched });
}
```

- [ ] **Step 3: Create DELETE coach connections route**

Create `web/app/api/coach/connections/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { sendConnectionRemoved } from '@/lib/connection-emails';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('id, app_role, coach_instance_id, full_name')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!profile || (profile as any).app_role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: conn } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, organization_id, coach_instance_id')
    .eq('id', params.id)
    .single();

  if (!conn || (conn as any).coach_instance_id !== (profile as any).coach_instance_id) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  await (supabase as any).from('company_coach_connections').delete().eq('id', params.id);

  // Notify company admin
  const [{ data: org }, { data: adminUser }] = await Promise.all([
    (supabase as any).from('organizations').select('name').eq('id', (conn as any).organization_id).single(),
    (supabase as any).from('users').select('full_name, email').eq('organization_id', (conn as any).organization_id).eq('app_role', 'company_admin').single(),
  ]);

  if ((adminUser as any)?.email) {
    try {
      await sendConnectionRemoved({
        recipientEmail: (adminUser as any).email,
        recipientName: (adminUser as any).full_name ?? 'Admin',
        removerName: (profile as any).full_name ?? 'Your coach',
        companyName: (org as any)?.name ?? 'your company',
      });
    } catch (e) {
      console.error('Failed to send removal email to company admin:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create the email approval handler**

Create `web/app/api/coach/connections/[token]/respond/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-server';
import { sendConnectionAccepted, sendConnectionDeclined } from '@/lib/connection-emails';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const action = request.nextUrl.searchParams.get('action');

  if (action !== 'accept' && action !== 'decline') {
    return new NextResponse('Invalid action', { status: 400 });
  }

  const supabase = createServiceSupabase();

  const { data: conn } = await (supabase as any)
    .from('company_coach_connections')
    .select('id, organization_id, coach_instance_id, status, permission_level')
    .eq('approval_token', params.token)
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
    await (supabase as any)
      .from('company_coach_connections')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', (conn as any).id);

    // Get names for notification email
    const [{ data: org }, { data: adminUser }, { data: coachUser }] = await Promise.all([
      (supabase as any).from('organizations').select('name').eq('id', (conn as any).organization_id).single(),
      (supabase as any).from('users').select('full_name, email').eq('organization_id', (conn as any).organization_id).eq('app_role', 'company_admin').single(),
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

    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;max-width:480px">
        <h2 style="color:#16a34a">✓ Connection Accepted</h2>
        <p>You now have access to <strong>${(org as any)?.name ?? 'the company'}</strong>'s data on TechRP.</p>
        <a href="${APP_URL}/coach" style="color:#2563eb">Go to your dashboard →</a>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } else {
    await (supabase as any)
      .from('company_coach_connections')
      .update({ status: 'declined' })
      .eq('id', (conn as any).id);

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
        <p>You have declined the connection request from <strong>${(org as any)?.name ?? 'the company'}</strong>.</p>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
```

- [ ] **Step 5: Verify build**

```bash
cd web && npm run build 2>&1 | tail -20
```

---

### Task 5: Add "Connected Companies" section to coach dashboard

**Files:**
- Modify: `web/app/coach/page.tsx`

- [ ] **Step 1: Identify where to add the connected companies section**

```bash
grep -n "tab\|Tab\|Companies\|companies\|Content\|Users" web/app/coach/page.tsx | head -30
```

The coach dashboard has tabs: Companies, Users, Content. Add a new "Connections" tab (or add a section within the Companies tab). Adding a new "Connections" tab is cleaner.

- [ ] **Step 2: Add state for connections**

Inside the component, alongside existing state, add:

```typescript
const [connections, setConnections] = React.useState<{
  id: string;
  companyName: string;
  adminEmail: string;
  permissionLevel: 'edit_playbooks' | 'readonly';
  status: 'pending' | 'active';
  requestedAt: string;
}[]>([]);
const [connectionsLoading, setConnectionsLoading] = React.useState(false);
const [removingConnectionId, setRemovingConnectionId] = React.useState<string | null>(null);
```

- [ ] **Step 3: Add loadConnections function**

```typescript
async function loadConnections() {
  setConnectionsLoading(true);
  try {
    const res = await fetch('/api/coach/connections');
    const data = await res.json();
    setConnections(
      (data.connections ?? []).map((c: any) => ({
        id: c.id,
        companyName: c.companyName,
        adminEmail: c.adminEmail,
        permissionLevel: c.permission_level,
        status: c.status,
        requestedAt: c.requestedAt ?? c.requested_at,
      }))
    );
  } finally {
    setConnectionsLoading(false);
  }
}
```

- [ ] **Step 4: Load connections on mount via useEffect**

Find the existing `useEffect` in the coach dashboard that loads initial data (companies, users, etc.). Add `loadConnections()` to it so connections load when the page mounts:

```typescript
useEffect(() => {
  // existing loads...
  loadConnections();
}, []);
```

The Connections tab button in Step 5 also calls `loadConnections()` on click to refresh — both are needed.

- [ ] **Step 5: Add the Connections tab button**

Find where the existing tab buttons are rendered (Companies, Users, Content). Add:

```tsx
<button
  onClick={() => { setActiveTab('connections'); loadConnections(); }}
  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    activeTab === 'connections'
      ? 'bg-blue-600 text-white'
      : 'text-gray-400 hover:text-white'
  }`}
>
  Connections
</button>
```

- [ ] **Step 6: Add the Connections tab content**

Find where the existing tab content panels are rendered (conditional on `activeTab`). Add:

```tsx
{activeTab === 'connections' && (
  <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-white">Company Connections</h2>
      <p className="text-sm text-gray-400">Companies that have invited you as a consulting coach</p>
    </div>

    {connectionsLoading ? (
      <p className="text-gray-500 text-sm">Loading...</p>
    ) : connections.length === 0 ? (
      <div className="text-center py-12 text-gray-500">
        <p>No company connections yet.</p>
        <p className="text-sm mt-1">Share your invite code with a company admin to get started.</p>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {connections.map((conn) => (
          <div key={conn.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-white font-medium">{conn.companyName}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  conn.status === 'active'
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-yellow-900/50 text-yellow-400'
                }`}>
                  {conn.status === 'active' ? 'Active' : 'Pending approval'}
                </span>
                <span className="text-xs text-gray-500">
                  {conn.permissionLevel === 'edit_playbooks' ? 'Edit playbooks' : 'View only'}
                </span>
              </div>
            </div>
            <button
              onClick={async () => {
                if (!confirm(`Remove connection with ${conn.companyName}? This cannot be undone.`)) return;
                setRemovingConnectionId(conn.id);
                await fetch(`/api/coach/connections/${conn.id}`, { method: 'DELETE' });
                setConnections((prev) => prev.filter((c) => c.id !== conn.id));
                setRemovingConnectionId(null);
              }}
              disabled={removingConnectionId === conn.id}
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
            >
              {removingConnectionId === conn.id ? 'Removing...' : 'Disconnect'}
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7: Verify build**

```bash
cd web && npm run build 2>&1 | tail -20
```

---

### Task 6: Add "Coaches" tab to company admin dashboard

**Files:**
- Modify: `web/app/team/page.tsx` (company admin dashboard — has an `app_role !== 'company_admin'` guard around line 61, tabs for 'employees' and 'candidates' around line 197)

- [ ] **Step 1: Add 'coaches' to the Tab type**

Find the `Tab` type definition near the top of `web/app/team/page.tsx`. It currently looks like:
```typescript
type Tab = 'employees' | 'candidates';
```
Replace with:
```typescript
type Tab = 'employees' | 'candidates' | 'coaches';
```

- [ ] **Step 2: Add state for the coaches panel**

Inside the company admin dashboard component, add:

```typescript
const [coachConnections, setCoachConnections] = React.useState<{
  id: string;
  coachName: string;
  coachEmail: string;
  permissionLevel: 'edit_playbooks' | 'readonly';
  status: 'pending' | 'active';
}[]>([]);
const [coachesLoading, setCoachesLoading] = React.useState(false);
const [showAddCoach, setShowAddCoach] = React.useState(false);
const [coachInviteToken, setCoachInviteToken] = React.useState('');
const [coachPermission, setCoachPermission] = React.useState<'edit_playbooks' | 'readonly'>('readonly');
const [addingCoach, setAddingCoach] = React.useState(false);
const [addCoachError, setAddCoachError] = React.useState('');
const [removingCoachId, setRemovingCoachId] = React.useState<string | null>(null);
```

- [ ] **Step 3: Add data functions**

```typescript
async function loadCoachConnections() {
  setCoachesLoading(true);
  try {
    const res = await fetch('/api/company/coaches');
    const data = await res.json();
    setCoachConnections(
      (data.connections ?? []).map((c: any) => ({
        id: c.id,
        coachName: c.coachName,
        coachEmail: c.coachEmail,
        permissionLevel: c.permission_level,
        status: c.status,
      }))
    );
  } finally {
    setCoachesLoading(false);
  }
}

async function handleAddCoach() {
  if (!coachInviteToken.trim()) return;
  setAddingCoach(true);
  setAddCoachError('');
  try {
    const res = await fetch('/api/company/coaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteToken: coachInviteToken.trim(), permissionLevel: coachPermission }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send request');
    setShowAddCoach(false);
    setCoachInviteToken('');
    await loadCoachConnections();
  } catch (err: any) {
    setAddCoachError(err.message);
  } finally {
    setAddingCoach(false);
  }
}
```

- [ ] **Step 4: Add the Coaches tab button**

The tab buttons are rendered around line 197 of `web/app/team/page.tsx` using a map over `(['employees', 'candidates'] as Tab[])`. Replace that array with:
```tsx
{(['employees', 'candidates', 'coaches'] as Tab[]).map(t => (
```
The button label for 'coaches' will render as "coaches" via `capitalize` — that's fine.

Also call `loadCoachConnections()` in the existing `useEffect` alongside the existing `fetch('/api/team/members')` call (around line 67–74), so it loads on mount:
```typescript
loadCoachConnections();
```

- [ ] **Step 5: Add the Coaches tab content**

The tab content is rendered at the bottom of the JSX as a conditional (around line 211). After the candidates tab block, add a `coaches` case:

```tsx
) : tab === 'coaches' ? (
  // ── Coaches Tab ─────────────────────────────────────────────────────
  <div className="flex flex-col gap-4 py-4">
```

Then paste the full Coaches UI block below:

```tsx
{/* Coaches Section */}
<div className="flex flex-col gap-4">
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-lg font-semibold text-white">Coaches</h2>
      <p className="text-sm text-gray-400">Invite a coach to access your team's sessions and playbooks</p>
    </div>
    <button
      onClick={() => { setShowAddCoach(true); loadCoachConnections(); }}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
    >
      + Add Coach
    </button>
  </div>

  {/* Add Coach Form */}
  {showAddCoach && (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-4 border border-gray-700">
      <h3 className="text-white font-medium">Add a Consulting Coach</h3>

      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 text-sm text-yellow-300">
        <strong>Before you continue:</strong> The coach will be able to view your users, training sessions, and recordings.
        {coachPermission === 'edit_playbooks' && ' They will also be able to edit your playbooks.'}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-400">Coach Invite Code</label>
        <input
          type="text"
          value={coachInviteToken}
          onChange={(e) => setCoachInviteToken(e.target.value)}
          placeholder="Paste the coach's invite code here"
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <p className="text-xs text-gray-500">Ask your coach to share their invite code from their dashboard.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-400">Permission Level</label>
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="permission"
              value="readonly"
              checked={coachPermission === 'readonly'}
              onChange={() => setCoachPermission('readonly')}
              className="mt-0.5 accent-blue-500"
            />
            <div>
              <p className="text-sm text-white">View only</p>
              <p className="text-xs text-gray-400">Coach can view sessions and recordings but cannot edit playbooks</p>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="permission"
              value="edit_playbooks"
              checked={coachPermission === 'edit_playbooks'}
              onChange={() => setCoachPermission('edit_playbooks')}
              className="mt-0.5 accent-blue-500"
            />
            <div>
              <p className="text-sm text-white">Edit playbooks</p>
              <p className="text-xs text-gray-400">Coach can view sessions, recordings, and edit your custom playbooks</p>
            </div>
          </label>
        </div>
      </div>

      {addCoachError && <p className="text-red-400 text-sm">{addCoachError}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleAddCoach}
          disabled={addingCoach || !coachInviteToken.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {addingCoach ? 'Sending Request...' : 'Send Request'}
        </button>
        <button
          onClick={() => { setShowAddCoach(false); setAddCoachError(''); setCoachInviteToken(''); }}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )}

  {/* Connections list */}
  {coachesLoading ? (
    <p className="text-gray-500 text-sm">Loading...</p>
  ) : coachConnections.length === 0 ? (
    <p className="text-gray-500 text-sm">No coaches connected yet.</p>
  ) : (
    <div className="flex flex-col gap-2">
      {coachConnections.map((conn) => (
        <div key={conn.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-white font-medium">{conn.coachName}</p>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                conn.status === 'active'
                  ? 'bg-green-900/50 text-green-400'
                  : 'bg-yellow-900/50 text-yellow-400'
              }`}>
                {conn.status === 'active' ? 'Active' : 'Awaiting coach approval'}
              </span>
              <span className="text-xs text-gray-500">
                {conn.permissionLevel === 'edit_playbooks' ? 'Can edit playbooks' : 'View only'}
              </span>
            </div>
          </div>
          <button
            onClick={async () => {
              if (!confirm(`Remove ${conn.coachName}? They will lose access immediately.`)) return;
              setRemovingCoachId(conn.id);
              await fetch(`/api/company/coaches/${conn.id}`, { method: 'DELETE' });
              setCoachConnections((prev) => prev.filter((c) => c.id !== conn.id));
              setRemovingCoachId(null);
            }}
            disabled={removingCoachId === conn.id}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
          >
            {removingCoachId === conn.id ? 'Removing...' : 'Remove'}
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Verify build**

```bash
cd web && npm run build 2>&1 | tail -20
```

---

### Task 7: Manual end-to-end test and commit

- [ ] **Step 1: Full end-to-end test**

```bash
cd web && npm run dev
```

Test flow:
1. Log in as a coach → go to `/coach` → open Connections tab → note the invite code shown somewhere in the dashboard (or go to the Settings/Instance view and copy it)
2. Log in as a company_admin → find the Coaches section → click "Add Coach"
3. Paste the coach's invite code, select "View only", click "Send Request"
4. Verify the connection shows as "Awaiting coach approval"
5. Check the coach's email inbox for the approval email
6. Click "Accept" in the email
7. Verify the connection shows as "Active" for both coach and company admin
8. Verify the company admin can see "Remove" button and it works
9. Verify the coach can see the company in their Connections tab and can disconnect

- [ ] **Step 2: Test decline flow**

1. Create another pending connection
2. Click "Decline" in the email
3. Verify company admin receives decline notification
4. Verify the connection disappears from the company admin's list

- [ ] **Step 3: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/supabase/company-coach-connections-migration.sql \
        web/lib/connection-emails.ts \
        web/app/api/company/coaches/route.ts \
        "web/app/api/company/coaches/[id]/route.ts" \
        web/app/api/coach/connections/route.ts \
        "web/app/api/coach/connections/[id]/route.ts" \
        "web/app/api/coach/connections/[token]/respond/route.ts" \
        web/app/coach/page.tsx
# Also add the company admin page file once identified
git commit -m "feat: company-coach connections with email approval and scoped permissions"
```
