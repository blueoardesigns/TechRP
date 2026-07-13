import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { fetchXP, XPProfile } from '../../../lib/xp';
import { colors, spacing, radius } from '../../../lib/theme';

interface BillingInfo {
  planId: string | null;
  status: string | null;
  minutesUsed: number;
  minutesPool: number;
  bonusMinutes: number;
  trialEnd: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  individual: 'Individual',
  company_admin: 'Company Admin',
  coach: 'Coach',
  superuser: 'Superuser',
};

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [xp, setXP] = useState<XPProfile | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    fetchXP(profile.id).then(p => {
      if (!cancelled && p) setXP(p);
    });
    return () => { cancelled = true; };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const { data: u } = await supabase
        .from('users')
        .select('minutes_used, bonus_minutes, trial_ends_at, plan_id')
        .eq('id', profile.id)
        .single();

      if (profile.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('plan_id, minutes_pool, bonus_minutes, subscription_status')
          .eq('id', profile.organization_id)
          .single();
        setBilling({
          planId: (org as any)?.plan_id ?? (u as any)?.plan_id ?? null,
          status: (org as any)?.subscription_status ?? null,
          minutesUsed: (u as any)?.minutes_used ?? 0,
          minutesPool: (org as any)?.minutes_pool ?? 0,
          bonusMinutes: (org as any)?.bonus_minutes ?? (u as any)?.bonus_minutes ?? 0,
          trialEnd: (u as any)?.trial_ends_at ?? null,
        });
      } else {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('plan_id, status, trial_end')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        setBilling({
          planId: (sub as any)?.plan_id ?? (u as any)?.plan_id ?? null,
          status: (sub as any)?.status ?? null,
          minutesUsed: (u as any)?.minutes_used ?? 0,
          minutesPool: 0,
          bonusMinutes: (u as any)?.bonus_minutes ?? 0,
          trialEnd: (sub as any)?.trial_end ?? (u as any)?.trial_ends_at ?? null,
        });
      }
      setBillingLoading(false);
    };
    load();
  }, [profile]);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
      ],
    );
  };

  const initial = profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : '?';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Avatar / Name */}
      <View style={styles.avatarBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? 'Unknown User'}</Text>
        <Text style={styles.email}>{profile?.email ?? ''}</Text>
        <View style={styles.badgeRow}>
          {profile?.app_role ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{ROLE_LABELS[profile.app_role] ?? profile.app_role}</Text>
            </View>
          ) : null}
          {xp && (
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>Level {xp.level} · {xp.rank}</Text>
            </View>
          )}
        </View>
      </View>

      {/* XP progress */}
      {xp && (
        <>
          <Text style={styles.sectionLabel}>Progress</Text>
          <View style={styles.card}>
            <View style={styles.xpCard}>
              <View style={styles.xpHeaderRow}>
                <Text style={styles.xpTotal}>{xp.totalXP.toLocaleString()} XP</Text>
                <Text style={styles.xpToNext}>
                  {(xp.levelProgress.need - xp.levelProgress.have).toLocaleString()} XP to Level {xp.level + 1}
                </Text>
              </View>
              <View style={styles.xpTrack}>
                <View
                  style={[
                    styles.xpFill,
                    { width: `${Math.min(100, (xp.levelProgress.have / xp.levelProgress.need) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        </>
      )}

      {/* Info card */}
      <View style={styles.card}>
        <InfoRow label="Email" value={profile?.email ?? '—'} />
        <InfoRow label="Role" value={ROLE_LABELS[profile?.app_role ?? ''] ?? profile?.app_role ?? '—'} last />
      </View>

      {/* Subscription */}
      <Text style={styles.sectionLabel}>Subscription</Text>
      <View style={styles.card}>
        {billingLoading ? (
          <View style={styles.billingLoader}>
            <ActivityIndicator color={colors.accent} size="small" />
          </View>
        ) : (
          <>
            <InfoRow label="Plan" value={formatPlan(billing?.planId)} />
            <InfoRow label="Status" value={formatStatus(billing?.status)} />
            {billing?.trialEnd && (
              <InfoRow
                label="Trial ends"
                value={new Date(billing.trialEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              />
            )}
            <InfoRow
              label="Minutes used"
              value={String(billing?.minutesUsed ?? 0)}
            />
            {(billing?.minutesPool ?? 0) > 0 && (
              <InfoRow
                label="Minutes remaining"
                value={String(Math.max(0, (billing!.minutesPool + billing!.bonusMinutes) - billing!.minutesUsed))}
                last
              />
            )}
            {(billing?.minutesPool ?? 0) === 0 && (
              <InfoRow label="Bonus minutes" value={String(billing?.bonusMinutes ?? 0)} last />
            )}
          </>
        )}
      </View>

      {/* Sign out — danger */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>TechRP Mobile · v1.0.0</Text>
    </ScrollView>
  );
}

function formatPlan(planId: string | null | undefined): string {
  if (!planId) return 'Free Trial';
  const map: Record<string, string> = {
    starter: 'Starter',
    pro: 'Pro',
    team: 'Team',
    enterprise: 'Enterprise',
  };
  return map[planId] ?? planId;
}

function formatStatus(status: string | null | undefined): string {
  if (!status) return '—';
  const map: Record<string, string> = {
    active: 'Active',
    trialing: 'Trial',
    inactive: 'Inactive',
    canceled: 'Canceled',
    past_due: 'Past Due',
  };
  return map[status] ?? status;
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  // Avatar block
  avatarBlock: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarInitial: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  email: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  roleBadge: {
    backgroundColor: 'rgba(2,132,199,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roleText: { color: colors.accentLight, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  rankBadge: {
    backgroundColor: 'rgba(191,90,242,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(191,90,242,0.25)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  rankText: { color: '#BF5AF2', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },

  // XP progress card
  xpCard: { padding: spacing.lg, gap: spacing.sm },
  xpHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  xpTotal: { color: colors.text, fontSize: 18, fontWeight: '700' },
  xpToNext: { color: colors.textMuted, fontSize: 12 },
  xpTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#BF5AF2',
  },

  sectionLabel: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  billingLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },

  // Info card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    minHeight: 52,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: colors.textMuted, fontSize: 14 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  // Logout
  logoutButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,69,58,0.4)',
    minHeight: 52,
    justifyContent: 'center',
  },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '700' },

  version: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
});
