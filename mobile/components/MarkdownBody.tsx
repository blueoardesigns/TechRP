import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../lib/theme';

interface Props {
  content: string;
}

/**
 * Lightweight markdown renderer for playbook content.
 * Handles: # headings, **bold**, *italic*, - / * bullets, 1. numbered lists.
 */
export default function MarkdownBody({ content }: Props) {
  // Strip HTML tags first if content starts with <
  let text = content;
  if (text.trim().startsWith('<')) {
    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"');
  }

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      elements.push(<View key={key++} style={styles.spacer} />);
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      elements.push(
        <Text key={key++} style={[
          styles.heading,
          level === 1 && styles.h1,
          level === 2 && styles.h2,
          level === 3 && styles.h3,
        ]}>
          {renderInline(headingText)}
        </Text>
      );
      continue;
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        <View key={key++} style={styles.listItem}>
          <Text style={styles.bullet}>{'•'}</Text>
          <Text style={styles.listText}>{renderInline(bulletMatch[1])}</Text>
        </View>
      );
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      elements.push(
        <View key={key++} style={styles.listItem}>
          <Text style={styles.listNum}>{numMatch[1]}.</Text>
          <Text style={styles.listText}>{renderInline(numMatch[2])}</Text>
        </View>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <Text key={key++} style={styles.paragraph}>{renderInline(trimmed)}</Text>
    );
  }

  return <View>{elements}</View>;
}

/** Render **bold** and *italic* inline */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split on **bold** and *italic* patterns
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match;
  let k = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2]) {
      // bold
      parts.push(<Text key={k++} style={styles.bold}>{match[2]}</Text>);
    } else if (match[3]) {
      // italic
      parts.push(<Text key={k++} style={styles.italic}>{match[3]}</Text>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts.length > 0 ? parts : [text];
}

const styles = StyleSheet.create({
  spacer: { height: 8 },
  heading: { color: colors.text, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  h1: { fontSize: 20 },
  h2: { fontSize: 17 },
  h3: { fontSize: 15, color: colors.accentLight },
  paragraph: { color: colors.text, fontSize: 15, lineHeight: 24, marginBottom: 4 },
  listItem: { flexDirection: 'row', marginBottom: 4, paddingRight: spacing.md },
  bullet: { color: colors.accentLight, fontSize: 15, lineHeight: 24, width: 18 },
  listNum: { color: colors.accentLight, fontSize: 15, lineHeight: 24, width: 22 },
  listText: { color: colors.text, fontSize: 15, lineHeight: 24, flex: 1 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
});
