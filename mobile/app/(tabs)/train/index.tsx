import { SectionList, View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { getSectionedScenarios } from '../../../lib/scenarios';
import { Persona, ScenarioConfig } from '../../../lib/types';
import { colors, spacing, radius } from '../../../lib/theme';

// Fallback org — where global/default personas are seeded
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export default function ScenarioPickerScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const sections = getSectionedScenarios();

  const handleSelectScenario = async (scenario: ScenarioConfig) => {
    setLoading(true);

    const orgId = profile?.organization_id ?? DEFAULT_ORG_ID;

    const { data, error } = await supabase
      .from('personas')
      .select('id, name, scenario_type, personality_type, brief_description, speaker_label, gender, system_prompt, first_message')
      .eq('scenario_type', scenario.type)
      .eq('is_active', true)
      .eq('organization_id', orgId)
      .limit(20);

    if (error) {
      console.error('[personas] query error:', JSON.stringify(error));
    }

    if (error || !data || data.length === 0) {
      if (orgId !== DEFAULT_ORG_ID) {
        const { data: fallback, error: fallbackErr } = await supabase
          .from('personas')
          .select('id, name, scenario_type, personality_type, brief_description, speaker_label, gender, system_prompt, first_message')
          .eq('scenario_type', scenario.type)
          .eq('is_active', true)
          .eq('organization_id', DEFAULT_ORG_ID)
          .limit(20);

        if (fallbackErr) console.error('[personas] fallback error:', JSON.stringify(fallbackErr));

        if (fallback && fallback.length > 0) {
          setLoading(false);
          const persona: Persona = fallback[Math.floor(Math.random() * fallback.length)];
          router.push({ pathname: '/(tabs)/train/pre-call', params: { scenarioType: scenario.type, personaId: persona.id } });
          return;
        }
      }

      setLoading(false);
      Alert.alert('No personas available', 'No active personas are set up for this scenario. Contact your manager.');
      return;
    }

    const persona: Persona = data[Math.floor(Math.random() * data.length)];
    setLoading(false);
    router.push({
      pathname: '/(tabs)/train/pre-call',
      params: { scenarioType: scenario.type, personaId: persona.id },
    });
  };

  return (
    <SectionList
      style={styles.list}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item) => item.type}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>{section.title}</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => handleSelectScenario(item)}
          disabled={loading}
          activeOpacity={0.75}
        >
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{item.icon}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          </View>
          {loading
            ? <ActivityIndicator color={colors.accentLight} size="small" />
            : <Text style={styles.chevron}>›</Text>
          }
        </TouchableOpacity>
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Choose a Scenario</Text>
          <Text style={styles.screenSubtitle}>Pick a training situation to practice</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  header: { marginBottom: spacing.sm },
  screenTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  screenSubtitle: { fontSize: 13, color: colors.textMuted },

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
    minHeight: 72,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(2,132,199,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: { fontSize: 22 },
  rowText: { flex: 1, gap: 4 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  chevron: { color: colors.textDim, fontSize: 22, marginLeft: spacing.sm },
});
