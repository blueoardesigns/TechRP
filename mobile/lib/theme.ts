export const colors = {
  bg: '#1a1a2e',
  surface: '#16213e',
  surfaceAlt: '#0f3460',
  accent: '#e94560',
  text: '#ffffff',
  textMuted: '#aaaaaa',
  textDim: '#555555',
  border: '#0f3460',
  scoreGreen: '#22c55e',
  scoreYellow: '#eab308',
  scoreRed: '#ef4444',
  tabActive: '#e94560',
  tabInactive: '#555555',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
};

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 14, color: colors.text },
  caption: { fontSize: 12, color: colors.textMuted },
  label: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
};
