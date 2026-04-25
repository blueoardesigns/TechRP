/**
 * seed-coached-teams.mjs
 * Seeds demo "coached team" companies in Supabase connected to Tim's coach instance.
 * This populates the /coach page "Client Companies" tab for demo/video purposes.
 *
 * Usage: node seed-coached-teams.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY  = envVars['SUPABASE_SERVICE_ROLE_KEY'];

// Tim's coach_instance_id (from CLAUDE.md)
const TIM_COACH_INSTANCE_ID = '8debc49b-fe07-4270-9b29-2768dfbe5535';

async function sbGet(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return res.json();
}

async function sbPost(endpoint, body, returnRep = false) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: returnRep ? 'return=representation' : 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${endpoint}: ${res.status} ${err.slice(0, 400)}`);
  }
  return returnRep ? res.json() : null;
}

// Format random bytes as a proper UUID (8-4-4-4-12)
function randomUUID() {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// Demo companies to create
const DEMO_COMPANIES = [
  {
    name: 'Apex Restoration Co.',
    members: [
      { full_name: 'Jake Morrison',   email: 'jake.morrison@apexrestoration.demo',   app_role: 'company_admin', status: 'approved' },
      { full_name: 'Sarah Chen',      email: 'sarah.chen@apexrestoration.demo',      app_role: 'individual',    status: 'approved' },
      { full_name: 'Marcus Williams', email: 'marcus.williams@apexrestoration.demo', app_role: 'individual',    status: 'approved' },
      { full_name: 'Priya Patel',     email: 'priya.patel@apexrestoration.demo',     app_role: 'individual',    status: 'approved' },
      { full_name: 'Tom Bradley',     email: 'tom.bradley@apexrestoration.demo',     app_role: 'individual',    status: 'approved' },
    ],
    connectionStatus: 'active',
    permissionLevel: 'edit_playbooks',
  },
  {
    name: 'BlueWave Drying Services',
    members: [
      { full_name: 'Lisa Huang',      email: 'lisa.huang@bluewave.demo',      app_role: 'company_admin', status: 'approved' },
      { full_name: 'Ryan O\'Connor',  email: 'ryan.oconnor@bluewave.demo',    app_role: 'individual',    status: 'approved' },
      { full_name: 'Dana Kim',        email: 'dana.kim@bluewave.demo',        app_role: 'individual',    status: 'approved' },
    ],
    connectionStatus: 'active',
    permissionLevel: 'readonly',
  },
  {
    name: 'Summit Property Restore',
    members: [
      { full_name: 'Alex Johnson',    email: 'alex.johnson@summitrestore.demo',   app_role: 'company_admin', status: 'approved' },
      { full_name: 'Nina Torres',     email: 'nina.torres@summitrestore.demo',    app_role: 'individual',    status: 'approved' },
    ],
    connectionStatus: 'pending',
    permissionLevel: 'readonly',
  },
];

async function main() {
  console.log('Seeding coached team companies for Tim\'s coach dashboard...\n');

  // Get Tim's organization_id so we can exclude it from filtering
  const timUsers = await sbGet('/users?email=eq.tim%40blueoardesigns.com&select=id,organization_id,coach_instance_id');
  const tim = Array.isArray(timUsers) ? timUsers[0] : null;
  if (tim) console.log(`Tim's org_id: ${tim.organization_id}, coach_instance_id: ${tim.coach_instance_id}`);

  for (const company of DEMO_COMPANIES) {
    console.log(`\n── ${company.name} ──`);

    // Check if org already exists
    const existing = await sbGet(`/organizations?name=eq.${encodeURIComponent(company.name)}&select=id,name`);
    let orgId;

    if (Array.isArray(existing) && existing.length > 0) {
      orgId = existing[0].id;
      console.log(`  Org exists: ${orgId}`);
    } else {
      const inviteToken = randomBytes(8).toString('hex');
      const created = await sbPost('/organizations', {
        name: company.name,
        invite_token: inviteToken,
      }, true);
      orgId = created[0].id;
      console.log(`  Created org: ${orgId}`);
    }

    // Seed members
    let created = 0, skipped = 0;
    for (const m of company.members) {
      const existing = await sbGet(`/users?email=eq.${encodeURIComponent(m.email)}&select=id`);
      if (Array.isArray(existing) && existing.length > 0) { skipped++; continue; }

      // Note: auth_user_id omitted — demo users have no real auth.users entry
      // 'role' and 'name' are the original NOT NULL columns from the base schema
      await sbPost('/users', {
        role: m.app_role === 'company_admin' ? 'manager' : 'technician',
        name: m.full_name,
        full_name: m.full_name,
        email: m.email,
        app_role: m.app_role,
        status: m.status,
        organization_id: orgId,
        coach_instance_id: TIM_COACH_INSTANCE_ID,
      });
      created++;
    }
    console.log(`  Members: ${created} created, ${skipped} skipped`);

    // Create company_coach_connection if not already there
    const existingConn = await sbGet(
      `/company_coach_connections?organization_id=eq.${orgId}&coach_instance_id=eq.${TIM_COACH_INSTANCE_ID}&select=id`
    );

    if (Array.isArray(existingConn) && existingConn.length > 0) {
      console.log(`  Connection: already exists (${existingConn[0].id})`);
    } else {
      const approval_token = randomUUID();
      await sbPost('/company_coach_connections', {
        organization_id: orgId,
        coach_instance_id: TIM_COACH_INSTANCE_ID,
        permission_level: company.permissionLevel,
        status: company.connectionStatus,
        approval_token,
      });
      console.log(`  Connection: created (${company.connectionStatus}, ${company.permissionLevel})`);
    }
  }

  console.log('\n✅ Done. Reload /coach to see the coached teams.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
