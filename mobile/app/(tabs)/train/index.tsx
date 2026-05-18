import { SectionList, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { getSectionedScenarios } from '../../../lib/scenarios';
import { Persona, ScenarioConfig } from '../../../lib/types';
import { colors, spacing, radius } from '../../../lib/theme';
import { Touchable } from '../../../components/Touchable';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

// Accent color per section index for visual variety
const SECTION_ACCENTS = [
  'rgba(14,165,233,0.15)',
  'rgba(48,209,88,0.12)',
  'rgba(255,149,0,0.12)',
  'rgba(191,90,242,0.12)',
];

export default function ScenarioPickerScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const sections = getSectionedScenarios();

  const handleSelectScenario = async (scenario: ScenarioConfig) => {
    setLoading(true);
    setSelectedType(scenario.type);

    const orgId = profile?.organization_id ?? DEFAULT_ORG_ID;

    const { data, error } = await supabase
      .from('personas')
      .select('id, name, scenario_type, personality_type, brief_description, speaker_label, gender, system_prompt, first_message')
      .eq('scenario_type', scenario.type)
      .eq('is_active', true)
      .eq('organization_id', orgId)
      .limit(20);

    if (error) console.error('[personas] query error:', JSON.stringify(error));

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
          setSelectedType(null);
          const persona: Persona = fallback[Math.floor(Math.random() * fallback.length)];
          router.push({ pathname: '/(tabs)/train/pre-call', params: { scenarioType: scenario.type, personaId: persona.id } });
          return;
        }
      }

      setLoading(false);
      setSelectedType(null);
      const { Alert } = require('react-native');
      Alert.alert('No personas available', 'No active personas are set up for this scenario. Contact your manager.');
      return;
    }

    const persona: Persona = data[Math.floor(Math.random() * data.length)];
    setLoading(false);
    setSelectedType(null);
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
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section, index }: { section: any; index: number }) => (
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>{section.title}</Text>
        </View>
      )}
      renderItem={({ item, index, section }: { item: ScenarioConfig; index: number; section: any }) => {
        const sectionIndex = sections.indexOf(section);
        const accentBg = SECTION_ACCENTS[sectionIndex % SECTION_ACCENTS.length];
        const isLoading = loading && selectedType === item.type;
        return (
          <Touchable
            style={styles.row}
            onPress={() => handleSelectScenario(item)}
            disabled={loading}
            
          >
            <View style={[styles.iconWrap, { backgroundColor: accentBg }]}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
            </View>
            {isLoading
              ? <ActivityIndicator color={colors.accentLight} size="small" />
              : <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            }
          </Touchable>
        );
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Choose a Scenario</Text>
          <Text style={styles.screenSubtitle}>Pick a situation to practice</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },

  header: { marginBottom: spacing.lg },
  screenTitle: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.3, marginBottom: 4 },
  screenSubtitle: { fontSize: 14, color: colors.textMuted },

  sectionHeaderRow: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionHeader: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
    minHeight: 68,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  icon: { fontSize: 22 },
  rowText: { flex: 1, gap: 3 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  description: { color: colors.textMuted, fontSize: 13 },
});
