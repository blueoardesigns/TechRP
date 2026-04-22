import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { colors, spacing, radius } from '../../../lib/theme';

const ROLE_LABELS: Record<string, string> = {
  individual: 'Individual',
  company_admin: 'Company Admin',
  coach: 'Coach',
  superuser: 'Superuser',
};

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

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
        {profile?.app_role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{ROLE_LABELS[profile.app_role] ?? profile.app_role}</Text>
          </View>
        ) : null}
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <InfoRow label="Email" value={profile?.email ?? '—'} />
        <InfoRow label="Role" value={ROLE_LABELS[profile?.app_role ?? ''] ?? profile?.app_role ?? '—'} last />
      </View>

      {/* Sign out — danger */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>TechRP Mobile · v1.0.0</Text>
    </ScrollView>
  );
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

  // Info card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 52,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: colors.textMuted, fontSize: 14 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  // Logout
  logoutButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    minHeight: 52,
    justifyContent: 'center',
  },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '700' },

  version: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
});
