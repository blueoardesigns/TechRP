import { useEffect, useState } from 'react';
import { SectionList, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Playbook } from '../../../lib/types';
import { getScenarioConfig } from '../../../lib/scenarios';
import { colors, spacing, radius } from '../../../lib/theme';

export default function PlaybooksListScreen() {
  const [sections, setSections] = useState<Array<{ title: string; data: Playbook[] }>>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase
      .from('playbooks')
      .select('id, scenario_type, name, is_active')
      .eq('is_active', true)
      .then(({ data }) => {
        const playbooks = (data ?? []) as Playbook[];
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
      });
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <SectionList
      style={styles.list}
      contentContainerStyle={sections.length === 0 ? styles.empty : styles.content}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      ListEmptyComponent={
        <Text style={styles.emptyText}>No playbooks available yet.</Text>
      }
      renderItem={({ item }) => {
        const scenario = getScenarioConfig(item.scenario_type ?? '');
        return (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push({ pathname: '/(tabs)/playbooks/[id]', params: { id: item.id } })}
          >
            <Text style={styles.icon}>{scenario?.icon ?? '📖'}</Text>
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
  content: { padding: spacing.lg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  sectionHeader: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
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
  },
  icon: { fontSize: 20, marginRight: spacing.md },
  label: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  chevron: { color: colors.textMuted, fontSize: 20 },
});
