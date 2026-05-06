// web/lib/referral.ts
import { createServiceSupabase } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

/**
 * Generate an 8-character base32 code. Caller is responsible for collision retry.
 */
export function generateReferralCode(): string {
  // Crockford base32 alphabet (no I/L/O/U to avoid ambiguity)
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % 32];
  }
  return out;
}

export type ReferralSource = 'share_page' | 'signup_link';

/**
 * Look up a referrer by code, insert the referral, credit the referrer,
 * and fire a `referral_signup` notification.
 * Silent no-op if the code is invalid. Never throws.
 */
export async function applyReferral(
  referrerCode: string | null | undefined,
  referredUserId: string,
  referredName: string,
  source: ReferralSource,
): Promise<void> {
  if (!referrerCode) return;
  const supabase = createServiceSupabase();

  const { data: referrer } = await (supabase as any)
    .from('users')
    .select('id')
    .eq('referral_code', referrerCode.toUpperCase())
    .single();

  if (!referrer) return;

  const referrerId = (referrer as any).id;

  // Insert referral (UNIQUE on referred_id — ignore error if already exists).
  const { error: referralError } = await (supabase as any)
    .from('referrals')
    .insert({
      referrer_id: referrerId,
      referred_id: referredUserId,
      source,
      credited_minutes: 60,
    });

  if (referralError) {
    // Most likely duplicate — already credited.
    console.warn('Referral insert skipped:', referralError.message);
    return;
  }

  // Atomically credit the referrer +60 minutes via RPC (eliminates read-modify-write race).
  const { error: creditError } = await (supabase as any)
    .rpc('apply_referral_credit', { target_user_id: referrerId, delta_minutes: 60 });

  if (creditError) {
    console.error('apply_referral_credit RPC error:', creditError);
    return;
  }

  // Fire notification to referrer.
  await (supabase as any).from('notifications').insert({
    user_id: referrerId,
    type: 'referral_signup',
    title: `${referredName} joined TechRP with your link`,
    body: 'You earned 60 bonus minutes for when you hit your session cap.',
    data: { link: '/account', referred_user_id: referredUserId },
  });
}
