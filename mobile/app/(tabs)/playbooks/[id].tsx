import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Playbook } from '../../../lib/types';
import { getScenarioConfig } from '../../../lib/scenarios';
import { colors, spacing, radius } from '../../../lib/theme';

// Strip HTML tags so playbook content (saved as HTML from the web editor) renders as plain text
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function PlaybookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('playbooks')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setPlaybook(data as Playbook | null);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!playbook) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>📖</Text>
        <Text style={styles.errorText}>Playbook not found.</Text>
      </View>
    );
  }

  const scenario = getScenarioConfig(playbook.scenario_type ?? '');
  const bodyText = playbook.content
    ? (playbook.content.trim().startsWith('<') ? stripHtml(playbook.content) : playbook.content)
    : '';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.scenarioPill}>
        <Text style={styles.scenarioPillText}>{scenario?.label ?? playbook.scenario_type}</Text>
      </View>
      {playbook.name && <Text style={styles.title}>{playbook.name}</Text>}

      {/* Content card */}
      <View style={styles.contentCard}>
        <Text style={styles.body}>{bodyText}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  errorIcon: { fontSize: 36 },
  errorText: { color: colors.textMuted, fontSize: 14 },

  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  scenarioPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(2,132,199,0.12)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
  },
  scenarioPillText: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  contentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 26,
  },
});
