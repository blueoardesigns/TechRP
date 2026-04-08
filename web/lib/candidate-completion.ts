import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface AssignedScenario {
  scenario_type: string;
  count: number;
}

/**
 * Called after every session save for a candidate user.
 * Fires completion notification + auto-suspend when all quotas met.
 */
export async function checkCandidateCompletion(userId: string): Promise<void> {
  const supabase = serviceClient();

  // Load user + invite in one shot
  const { data: user } = await (supabase as any)
    .from('users')
    .select('user_type, candidate_invite_id, full_name, email, organization_id')
    .eq('id', userId)
    .single();

  if (!user || (user as any).user_type !== 'candidate' || !(user as any).candidate_invite_id) return;

  const { data: invite } = await (supabase as any)
    .from('candidate_invites')
    .select('id, assigned_scenarios, status, notification_sent_at, invited_by_user_id, personal_token')
    .eq('id', (user as any).candidate_invite_id)
    .single();

  if (!invite || (invite as any).notification_sent_at) return;  // already notified

  // Count completed sessions per scenario type for this user
  const { data: sessions } = await (supabase as any)
    .from('training_sessions')
    .select('persona_scenario_type')
    .eq('user_id', userId);

  const counts: Record<string, number> = {};
  ((sessions ?? []) as any[]).forEach((s) => {
    const t = s.persona_scenario_type;
    if (t) counts[t] = (counts[t] ?? 0) + 1;
  });

  // Update status to in_progress if still signed_up
  if ((invite as any).status === 'signed_up') {
    await (supabase as any)
      .from('candidate_invites')
      .update({ status: 'in_progress' })
      .eq('id', (invite as any).id);
  }

  // Check if all quotas met
  const assigned: AssignedScenario[] = (invite as any).assigned_scenarios ?? [];
  const allComplete = assigned.length > 0 && assigned.every(
    ({ scenario_type, count }) => (counts[scenario_type] ?? 0) >= count
  );
  if (!allComplete) return;

  // --- All quotas met: atomically claim the completion notification ---
  // Use conditional update (WHERE notification_sent_at IS NULL) to prevent duplicate
  // notifications if two sessions complete at nearly the same time.
  const { data: claimed } = await (supabase as any)
    .from('candidate_invites')
    .update({ status: 'complete', notification_sent_at: new Date().toISOString() })
    .eq('id', (invite as any).id)
    .is('notification_sent_at', null)  // only if not already stamped — race condition guard
    .select('id')
    .single();

  if (!claimed) return;  // another concurrent call already handled completion

  // 2. Auto-suspend candidate
  await (supabase as any)
    .from('users')
    .update({ status: 'suspended' })
    .eq('id', userId);

  // 3. Create in-app notification for company admin
  await (supabase as any).from('notifications').insert({
    user_id: (invite as any).invited_by_user_id,
    type: 'candidate_complete',
    title: `${(user as any).full_name ?? (user as any).email} completed their assessment`,
    body: 'View their session results in the Candidates tab.',
    data: {
      candidate_invite_id: (invite as any).id,
      candidate_user_id: userId,
    },
  });

  // 4. Send email to company admin
  const { data: adminUser } = await (supabase as any)
    .from('users')
    .select('email, full_name')
    .eq('id', (invite as any).invited_by_user_id)
    .single();

  if (adminUser) {
    const candidateName = (user as any).full_name ?? (user as any).email;
    const resultsUrl = `${APP_URL}/team`;
    try {
      await resend.emails.send({
        from: 'TechRP <noreply@blueoardesigns.com>',
        to: (adminUser as any).email,
        subject: `${candidateName} completed their assessment`,
        html: `
          <h2>Candidate Assessment Complete</h2>
          <p><strong>${candidateName}</strong> has completed all ${assigned.reduce((a, s) => a + s.count, 0)} assigned sessions.</p>
          <p>
            <a href="${resultsUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
              View Results →
            </a>
          </p>
        `,
      });
    } catch (err) {
      console.error('Failed to send candidate completion email:', err);
    }
  }
}
