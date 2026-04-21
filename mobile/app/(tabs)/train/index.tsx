import { SectionList, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
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

    // Use the user's own org; fall back to the global seed org so default
    // personas are always visible even if RLS isn't yet narrowed by coach instance.
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
      // If org-scoped query returns nothing, try the global default org as a fallback
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
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => handleSelectScenario(item)}
          disabled={loading}
        >
          <Text style={styles.icon}>{item.icon}</Text>
          <View style={styles.rowText}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
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
  icon: { fontSize: 24, marginRight: spacing.md },
  rowText: { flex: 1 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  description: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  chevron: { color: colors.textMuted, fontSize: 20, marginLeft: spacing.sm },
});
