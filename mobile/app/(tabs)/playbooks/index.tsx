import { useEffect, useState } from 'react';
import { SectionList, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { Playbook } from '../../../lib/types';
import { getScenarioConfig } from '../../../lib/scenarios';
import { colors, spacing, radius } from '../../../lib/theme';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export default function PlaybooksListScreen() {
  const [sections, setSections] = useState<Array<{ title: string; data: Playbook[] }>>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!profile) return;
    const orgId = profile.organization_id ?? DEFAULT_ORG_ID;

    const load = async () => {
      const { data, error } = await supabase
        .from('playbooks')
        .select('id, scenario_type, name, is_active')
        .eq('is_active', true)
        .eq('organization_id', orgId);

      if (error) {
        console.error('[playbooks] query error:', JSON.stringify(error));
      }

      let playbooks = (data ?? []) as Playbook[];

      if (playbooks.length === 0 && orgId !== DEFAULT_ORG_ID) {
        const { data: fallback, error: fallbackErr } = await supabase
          .from('playbooks')
          .select('id, scenario_type, name, is_active')
          .eq('is_active', true)
          .eq('organization_id', DEFAULT_ORG_ID);
        if (fallbackErr) console.error('[playbooks] fallback error:', JSON.stringify(fallbackErr));
        playbooks = (fallback ?? []) as Playbook[];
      }

      const map = new Map<string, Playbook[]>();
      playbooks.forEach(p => {
        const key = p.scenario_type ?? 'other';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p);
      });
      const built = Array.from(map.entries()).map(([type, items]) => ({
        title: getScenarioConfig(type)?.label ?? type,
        data: items,
      }));
      setSections(built);
      setLoading(false);
    };

    load();
  }, [profile]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <SectionList
      style={styles.list}
      contentContainerStyle={sections.length === 0 ? styles.empty : styles.content}
      sections={sections}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        sections.length > 0 ? (
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Playbooks</Text>
            <Text style={styles.screenSubtitle}>Your scenario guides and best practices</Text>
          </View>
        ) : null
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>{section.title}</Text>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.emptyContent}>
          <Text style={styles.emptyIcon}>📖</Text>
          <Text style={styles.emptyTitle}>No playbooks yet</Text>
          <Text style={styles.emptyText}>Playbooks will appear here once your manager adds them.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const scenario = getScenarioConfig(item.scenario_type ?? '');
        return (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push({ pathname: '/(tabs)/playbooks/[id]', params: { id: item.id } })}
            activeOpacity={0.75}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{scenario?.icon ?? '📖'}</Text>
            </View>
            <Text style={styles.label}>{item.name ?? scenario?.label ?? item.scenario_type}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1 },

  header: { marginBottom: spacing.sm },
  screenTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  screenSubtitle: { fontSize: 13, color: colors.textMuted },

  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 },

  sectionHeaderRow: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionHeader: {
    color: colors.accentLight,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 60,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: { fontSize: 18 },
  label: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  chevron: { color: colors.textDim, fontSize: 22 },
});
