import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../lib/theme';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  speakerLabel: string;
}

export default function TranscriptMessage({ role, content, speakerLabel }: Props) {
  const isUser = role === 'user';
  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <Text style={[styles.label, isUser ? styles.userLabel : styles.assistantLabel]}>
        {isUser ? 'You' : speakerLabel}
      </Text>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser && styles.userText]}>{content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
    maxWidth: '86%',
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
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  userLabel: { color: colors.accentLight },
  assistantLabel: { color: colors.textMuted },

  bubble: {
    borderRadius: radius.md,
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
    lineHeight: 21,
  },
  userText: {
    color: '#fff',
  },
});
