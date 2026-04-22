// ─── Design tokens — aligned with web (slate-950 bg, sky-600 CTA) ────────────

export const colors = {
  // Backgrounds
  bg:          '#020617',           // slate-950 — page/screen bg
  surface:     '#0f172a',           // slate-900 — card / input bg
  surfaceAlt:  '#1e293b',           // slate-800 — elevated surface, tab bar

  // Brand / CTA
  accent:      '#0284c7',           // sky-600 — primary CTA
  accentDark:  '#0369a1',           // sky-700 — pressed state
  accentLight: '#38bdf8',           // sky-400 — active tint / highlights

  // Text
  text:        '#f8fafc',           // slate-50 — primary text
  textMuted:   '#94a3b8',           // slate-400 — secondary text
  textDim:     '#475569',           // slate-600 — placeholder / disabled

  // Borders
  border:      'rgba(255,255,255,0.08)',   // default border
  borderStrong:'rgba(255,255,255,0.18)',   // focused / highlighted

  // Semantic
  scoreGreen:  '#22c55e',
  scoreYellow: '#eab308',
  scoreRed:    '#ef4444',
  danger:      '#ef4444',           // destructive / end-call

  // Tab bar
  tabActive:   '#38bdf8',           // sky-400
  tabInactive: '#64748b',           // slate-500
};

// Larger than before — better breathing room on mobile
export const spacing = {
  xs:  4,
  sm:  8,
  md:  14,
  lg:  20,
  xl:  28,
  xxl: 40,
};

// Rounder corners match web cards
export const radius = {
  sm:  6,
  md:  12,
  lg:  16,
  xl:  24,
};

// Larger base sizes so text is readable outdoors / on the go
export const typography = {
  title:   { fontSize: 26, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 19, fontWeight: '600' as const, color: colors.text },
  body:    { fontSize: 15, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
  label:   { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
};
