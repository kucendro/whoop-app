// Design tokens for a minimalistic dark-first WHOOP app
// Palette: #191C21 (bg), #252932 (elevated), #195962 (teal accent), #F56F6C (coral), #FFFFFF (text)
export const colors = {
  // Backgrounds
  bg: '#191C21',
  bgElevated: '#252932',
  bgCard: '#191C21', // Same as app bg — cards differentiated by border only
  bgCardHover: '#1E2128',
  bgInput: '#1E2128',

  // Borders
  border: '#2E333D',
  borderSubtle: '#252932',
  borderFocus: '#3A4050',

  // Text
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  textInverse: '#191C21',

  // Accent — teal from WHOOP palette
  accent: '#195962',
  accentBright: '#1F7A85', // Slightly brighter teal for active states
  accentDim: '#19596222',
  accentMuted: '#19596244',

  // Semantic
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F56F6C', // Coral from palette — doubles as error / high-HR
  info: '#60A5FA',

  // Heart rate zones (teal→coral spectrum)
  hrRest: '#195962', // Teal — resting
  hrLight: '#34D399', // Green — light activity
  hrModerate: '#FBBF24', // Amber — moderate
  hrHard: '#F59E0B', // Orange — hard
  hrMax: '#F56F6C', // Coral — max / alert

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
