import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../../lib/theme';

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
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {/* Avatar / Name */}
      <View style={styles.avatarBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? 'Unknown User'}</Text>
        <Text style={styles.email}>{profile?.email ?? ''}</Text>
        {profile?.app_role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{ROLE_LABELS[profile.app_role] ?? profile.app_role}</Text>
          </View>
        ) : null}
      </View>

      {/* Info rows */}
      <View style={styles.card}>
        <InfoRow label="Email" value={profile?.email ?? '—'} />
        <InfoRow label="Role" value={ROLE_LABELS[profile?.app_role ?? ''] ?? profile?.app_role ?? '—'} />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>TechRP Mobile · v1.0.0</Text>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  avatarBlock: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarInitial: { color: '#fff', fontSize: 30, fontWeight: '700' },
  name: { ...typography.title, fontSize: 20, marginBottom: spacing.xs },
  email: { ...typography.caption, marginBottom: spacing.sm },
  roleBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roleText: { color: colors.accent, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

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
  },
  infoLabel: { color: colors.textMuted, fontSize: 14 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  logoutButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  version: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
});
