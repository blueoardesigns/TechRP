import { Platform } from 'react-native';
// Design tokens — OLED dark, sky-blue accent

export const colors = {
  // OLED-optimized backgrounds
  bg:           '#000000',
  surface:      '#0D0D0D',
  surfaceAlt:   '#141414',
  surfaceHigh:  '#1C1C1E',

  // Brand / CTA
  accent:       '#0EA5E9',           // sky-500
  accentDark:   '#0284C7',           // sky-600 — pressed
  accentLight:  '#38BDF8',           // sky-400 — highlights
  accentGlow:   'rgba(14,165,233,0.18)',

  // Text
  text:         '#FFFFFF',
  textMuted:    '#8E8E93',           // iOS system gray
  textDim:      '#3A3A3C',

  // Borders
  border:       'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.16)',
  borderAccent: 'rgba(14,165,233,0.35)',

  // Semantic
  scoreGreen:   '#30D158',           // iOS green
  scoreYellow:  '#FFD60A',           // iOS yellow
  scoreRed:     '#FF453A',           // iOS red
  danger:       '#FF453A',

  // Tab bar
  tabActive:    '#0EA5E9',
  tabInactive:  '#3A3A3C',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  14,
  lg:  20,
  xl:  28,
  xxl: 44,
};

export const radius = {
  sm:  8,
  md:  14,
  lg:  20,
  xl:  28,
  full: 999,
};

export const typography = {
  title:   { fontSize: 28, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.3 },
  heading: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  body:    { fontSize: 15, color: colors.text, lineHeight: 22 },
  caption: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  label:   { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.8, fontWeight: '600' as const },
};

export function shadow(elevation: number) {
  if (Platform.OS === 'android') return { elevation };
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: Math.ceil(elevation / 2) },
    shadowOpacity: 0.12 + elevation * 0.015,
    shadowRadius: elevation,
  };
}

export function accentShadow(elevation: number, color = colors.accent) {
  if (Platform.OS === 'android') return { elevation };
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: Math.ceil(elevation / 2) },
    shadowOpacity: 0.35,
    shadowRadius: elevation * 1.5,
  };
}
