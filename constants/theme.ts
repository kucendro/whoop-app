// Design tokens for a minimalistic dark-first WHOOP app
export const colors = {
  // Backgrounds
  bg: '#000000',
  bgElevated: '#0A0A0A',
  bgCard: '#111111',
  bgCardHover: '#1A1A1A',
  bgInput: '#0D0D0D',

  // Borders
  border: '#1C1C1C',
  borderSubtle: '#141414',
  borderFocus: '#333333',

  // Text
  text: '#F5F5F5',
  textSecondary: '#8A8A8A',
  textTertiary: '#555555',
  textInverse: '#000000',

  // Accent - a clean green inspired by WHOOP
  accent: '#00D26A',
  accentDim: '#00D26A22',
  accentMuted: '#00D26A44',

  // Semantic
  success: '#00D26A',
  warning: '#FFB020',
  error: '#EF4444',
  info: '#3B82F6',

  // Heart rate zones
  hrRest: '#3B82F6',
  hrLight: '#00D26A',
  hrModerate: '#FFB020',
  hrHard: '#F97316',
  hrMax: '#EF4444',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  xxxl: 48,
  display: 64,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
