import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../lib/theme';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  speakerLabel: string;
}

export default function TranscriptMessage({ role, content, speakerLabel }: Props) {
  const isUser = role === 'user';
  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <Text style={styles.label}>{isUser ? 'You' : speakerLabel}</Text>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={styles.text}>{content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
    maxWidth: '85%',
  },
  userContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  userBubble: {
    backgroundColor: colors.accent,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
