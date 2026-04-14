# Per-Company Playbook Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let coaches control which of their playbooks each connected company can access, using a whitelist model — no rows means all playbooks visible (preserves current behavior).

**Architecture:** New `playbook_company_access` junction table (playbook_id, organization_id). When a company_admin or their users fetch playbooks, the route applies whitelist filtering if any rows exist for their org. Coach gets a new "Playbook Access" panel in their company detail view. All writes go through service role client.

**Tech Stack:** Supabase (PostgreSQL), Next.js API routes, TypeScript, existing coach dashboard at `web/app/coach/page.tsx`

---

## File Map

| File | Change |
|---|---|
| `web/supabase/playbook-company-access-migration.sql` | New — creates junction table + RLS |
| `web/app/api/playbooks/route.ts` | Modify GET — apply whitelist for company_admin/individual callers |
| `web/app/api/coach/companies/[orgId]/playbooks/route.ts` | New — GET/PUT whitelist for a company |
| `web/app/coach/page.tsx` | Add "Playbook Access" panel to company list |

---

### Task 1: Create and run the database migration

**Files:**
- Create: `web/supabase/playbook-company-access-migration.sql`

- [ ] **Step 1: Create the migration file**

Create `web/supabase/playbook-company-access-migration.sql`:

```sql
-- ============================================================
-- Playbook Company Access — Per-company playbook visibility
-- Whitelist model: rows present = restrict to those playbooks
--                  no rows for an org = see all coach playbooks
--
-- Run in Supabase SQL Editor after all previous migrations.
-- ============================================================

CREATE TABLE IF NOT EXISTS playbook_company_access (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id      UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(playbook_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_pca_org ON playbook_company_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_pca_playbook ON playbook_company_access(playbook_id);

-- RLS
ALTER TABLE playbook_company_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pca: service role bypass"
  ON playbook_company_access FOR ALL
  USING (auth.role() = 'service_role');

-- Coaches can read whitelist rows for playbooks in their instance
CREATE POLICY "pca: coach select"
  ON playbook_company_access FOR SELECT
  USING (
    playbook_id IN (
      SELECT id FROM playbooks WHERE coach_instance_id = _my_coach_instance_id()
    )
  );

-- Company admins can read their own org's whitelist
CREATE POLICY "pca: company_admin select"
  ON playbook_company_access FOR SELECT
  USING (organization_id = _my_org_id());
```

- [ ] **Step 2: Run the migration**

Go to Supabase Dashboard → SQL Editor → New query. Paste the full contents of `web/supabase/playbook-company-access-migration.sql` and click Run.

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify the table exists**

In the SQL Editor run:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'playbook_company_access'
ORDER BY ordinal_position;
```

Expected columns: `id`, `playbook_id`, `organization_id`, `created_at`.

---

### Task 2: Update GET /api/playbooks to apply whitelist for company callers

**Files:**
- Modify: `web/app/api/playbooks/route.ts`

- [ ] **Step 1: Read the current GET handler**

```bash
cat web/app/api/playbooks/route.ts
```

Note the current flow: it reads `coach_instance_id` and `app_role` from the user profile, then queries playbooks accordingly.

- [ ] **Step 2: Add whitelist filtering for company_admin and individual roles**

Find the final `else` branch of the GET handler — the one that runs when the user has no `coach_instance_id` (i.e., company_admin and individual users). It currently returns only global playbooks (`coach_instance_id IS NULL`).

Replace that final branch with the following so it also returns the coach's playbooks that are whitelisted for their org:

```typescript
// company_admin, individual, or users with no coach_instance — apply whitelist
const { data: orgProfile } = await (supabase as any)
  .from('users')
  .select('organization_id')
  .eq('auth_user_id', authUser.id)
  .single();

const orgId = (orgProfile as any)?.organization_id ?? null;

// Get the coach_instance_id for this org (if any)
let coachInstanceForOrg: string | null = null;
if (orgId) {
  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('coach_instance_id')
    .eq('id', orgId)
    .single();
  coachInstanceForOrg = (org as any)?.coach_instance_id ?? null;
}

// Always include global playbooks
let allPlaybooks: any[] = [];

const { data: globalPlaybooks } = await (supabase as any)
  .from('playbooks')
  .select('*')
  .is('coach_instance_id', null)
  .order('created_at', { ascending: false });

allPlaybooks = globalPlaybooks ?? [];

// Add coach playbooks filtered by whitelist (if org has a coach)
if (orgId && coachInstanceForOrg) {
  // Check if whitelist rows exist for this org
  const { data: whitelistRows } = await (supabase as any)
    .from('playbook_company_access')
    .select('playbook_id')
    .eq('organization_id', orgId);

  if (whitelistRows && whitelistRows.length > 0) {
    // Whitelist active — fetch only whitelisted playbooks from coach's instance
    const allowedIds = (whitelistRows as any[]).map((r) => r.playbook_id);
    const { data: coachPlaybooks } = await (supabase as any)
      .from('playbooks')
      .select('*')
      .eq('coach_instance_id', coachInstanceForOrg)
      .in('id', allowedIds)
      .order('created_at', { ascending: false });
    allPlaybooks = [...allPlaybooks, ...(coachPlaybooks ?? [])];
  } else {
    // No whitelist — show all coach playbooks
    const { data: coachPlaybooks } = await (supabase as any)
      .from('playbooks')
      .select('*')
      .eq('coach_instance_id', coachInstanceForOrg)
      .order('created_at', { ascending: false });
    allPlaybooks = [...allPlaybooks, ...(coachPlaybooks ?? [])];
  }
}

return NextResponse.json({ playbooks: allPlaybooks });
```

- [ ] **Step 3: Verify build**

```bash
cd web && npm run build 2>&1 | tail -20
```

---

### Task 3: Create the coach playbook visibility API routes

**Files:**
- Create: `web/app/api/coach/companies/[orgId]/playbooks/route.ts`

- [ ] **Step 1: Create the directory and route file**

```bash
mkdir -p web/app/api/coach/companies/\[orgId\]/playbooks
```

Create `web/app/api/coach/companies/[orgId]/playbooks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
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

// GET /api/coach/companies/[orgId]/playbooks
// Returns all coach playbooks with visible:boolean for this org
export async function GET(
  _request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();

  // Verify this org belongs to this coach's instance
  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('id, name')
    .eq('id', params.orgId)
    .eq('coach_instance_id', profile.coach_instance_id)
    .single();

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  // Get all playbooks for this coach's instance
  const { data: playbooks } = await (supabase as any)
    .from('playbooks')
    .select('id, name, scenario_type, created_at')
    .eq('coach_instance_id', profile.coach_instance_id)
    .order('created_at', { ascending: false });

  // Get existing whitelist rows for this org
  const { data: whitelistRows } = await (supabase as any)
    .from('playbook_company_access')
    .select('playbook_id')
    .eq('organization_id', params.orgId);

  const whitelistSet = new Set((whitelistRows ?? []).map((r: any) => r.playbook_id));
  const hasWhitelist = whitelistSet.size > 0;

  const result = (playbooks ?? []).map((p: any) => ({
    ...p,
    // If no whitelist exists, all are visible by default
    visible: hasWhitelist ? whitelistSet.has(p.id) : true,
  }));

  return NextResponse.json({ playbooks: result, hasWhitelist });
}

// PUT /api/coach/companies/[orgId]/playbooks
// Body: { playbookIds: string[] } — full replacement of whitelist
// If all playbooks selected → delete all rows (revert to "show all")
export async function PUT(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();

  // Verify org belongs to this coach
  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('id')
    .eq('id', params.orgId)
    .eq('coach_instance_id', profile.coach_instance_id)
    .single();

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { playbookIds } = await request.json();
  if (!Array.isArray(playbookIds)) {
    return NextResponse.json({ error: 'playbookIds must be an array' }, { status: 400 });
  }

  // Verify all submitted IDs belong to this coach's instance
  const { data: allCoachPlaybooks } = await (supabase as any)
    .from('playbooks')
    .select('id')
    .eq('coach_instance_id', profile.coach_instance_id);

  const allIds = new Set((allCoachPlaybooks ?? []).map((p: any) => p.id));
  const validIds = playbookIds.filter((id) => allIds.has(id));

  // Delete existing whitelist for this org
  await (supabase as any)
    .from('playbook_company_access')
    .delete()
    .eq('organization_id', params.orgId)
    .in('playbook_id', Array.from(allIds)); // only delete rows owned by this coach

  // If all playbooks selected, leave empty (show all = no rows needed)
  if (validIds.length === 0 || validIds.length === allIds.size) {
    return NextResponse.json({ ok: true, hasWhitelist: false });
  }

  // Insert new whitelist rows
  const rows = validIds.map((id: string) => ({
    playbook_id: id,
    organization_id: params.orgId,
  }));

  const { error } = await (supabase as any)
    .from('playbook_company_access')
    .insert(rows);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, hasWhitelist: true });
}
```

- [ ] **Step 2: Verify build**

```bash
cd web && npm run build 2>&1 | tail -20
```

---

### Task 4: Add Playbook Access panel to coach dashboard

**Files:**
- Modify: `web/app/coach/page.tsx`

- [ ] **Step 1: Read the current coach dashboard to understand the companies tab structure**

```bash
grep -n "Companies\|companies\|orgId\|company" web/app/coach/page.tsx | head -30
```

Identify where each company is rendered in the Companies tab. There should be a list of company cards or rows. You'll add an expandable "Playbook Access" section to each one.

- [ ] **Step 2: Add state for playbook visibility management**

Inside the component, alongside existing state, add:

```typescript
const [playbookAccessOrgId, setPlaybookAccessOrgId] = React.useState<string | null>(null);
const [orgPlaybooks, setOrgPlaybooks] = React.useState<{ id: string; name: string; scenario_type: string | null; visible: boolean }[]>([]);
const [playbookAccessLoading, setPlaybookAccessLoading] = React.useState(false);
const [playbookAccessSaving, setPlaybookAccessSaving] = React.useState(false);
```

- [ ] **Step 3: Add the loadOrgPlaybooks and saveOrgPlaybooks functions**

```typescript
async function loadOrgPlaybooks(orgId: string) {
  setPlaybookAccessLoading(true);
  setPlaybookAccessOrgId(orgId);
  try {
    const res = await fetch(`/api/coach/companies/${orgId}/playbooks`);
    const data = await res.json();
    setOrgPlaybooks(data.playbooks ?? []);
  } finally {
    setPlaybookAccessLoading(false);
  }
}

async function saveOrgPlaybooks(orgId: string) {
  setPlaybookAccessSaving(true);
  try {
    const selectedIds = orgPlaybooks.filter((p) => p.visible).map((p) => p.id);
    await fetch(`/api/coach/companies/${orgId}/playbooks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playbookIds: selectedIds }),
    });
    setPlaybookAccessOrgId(null);
  } finally {
    setPlaybookAccessSaving(false);
  }
}
```

- [ ] **Step 4: Add the Playbook Access UI to each company card**

Find the JSX where each company is rendered (in the Companies tab). After the existing company info (name, user count, invite token), add:

```tsx
{/* Playbook Access toggle */}
<div className="mt-3 border-t border-gray-700 pt-3">
  {playbookAccessOrgId === company.id ? (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-300">Playbook Access</p>
      {playbookAccessLoading ? (
        <p className="text-xs text-gray-500">Loading...</p>
      ) : orgPlaybooks.length === 0 ? (
        <p className="text-xs text-gray-500">No playbooks in your instance yet.</p>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {orgPlaybooks.every((p) => p.visible) ? 'All playbooks visible (default)' : `${orgPlaybooks.filter((p) => p.visible).length} of ${orgPlaybooks.length} playbooks visible`}
          </p>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {orgPlaybooks.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.visible}
                  onChange={(e) =>
                    setOrgPlaybooks((prev) =>
                      prev.map((pb) => pb.id === p.id ? { ...pb, visible: e.target.checked } : pb)
                    )
                  }
                  className="accent-blue-500"
                />
                {p.name}
                {p.scenario_type && (
                  <span className="text-xs text-gray-500">({p.scenario_type})</span>
                )}
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => saveOrgPlaybooks(company.id)}
              disabled={playbookAccessSaving}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
            >
              {playbookAccessSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setPlaybookAccessOrgId(null)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  ) : (
    <button
      onClick={() => loadOrgPlaybooks(company.id)}
      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
    >
      Manage Playbook Access →
    </button>
  )}
</div>
```

- [ ] **Step 5: Verify build**

```bash
cd web && npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Manual test**

```bash
cd web && npm run dev
```

1. Log in as a coach
2. Go to `/coach`, open the Companies tab
3. Click "Manage Playbook Access" on a company
4. Verify the playbook checklist appears with all checked by default
5. Uncheck one playbook, click Save
6. Log in as a company_admin for that company
7. Go to `/playbooks` — verify the unchecked playbook is not visible
8. Log back in as coach, re-check it, save — verify it reappears for the company

- [ ] **Step 7: Commit**

```bash
cd /Users/TinierTim/TBDev/techrp
git add web/supabase/playbook-company-access-migration.sql \
        web/app/api/playbooks/route.ts \
        "web/app/api/coach/companies/[orgId]/playbooks/route.ts" \
        web/app/coach/page.tsx
git commit -m "feat: per-company playbook visibility whitelist for coaches"
```
