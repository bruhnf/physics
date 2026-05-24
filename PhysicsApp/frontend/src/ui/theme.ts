import { Platform } from 'react-native';

export const colors = {
  bg: '#0d1117',
  surface: '#161B22',
  surfaceAlt: '#1F2630',
  border: '#2A3340',

  primary: '#378ADD',
  primaryDeep: '#185FA5',
  primaryLight: '#B5D4F4',

  success: '#1D9E75',
  warning: '#E0A23A',
  failure: '#E0563A',

  textPrimary: '#E6EDF3',
  textSecondary: '#8B98A7',
  textDim: '#5A6473',
  textInverse: '#0d1117',
} as const;

export const spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
  eight: 64,
} as const;

export const radii = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
} as const;

export const fonts = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!,
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' })!,
} as const;

export const letterSpacing = {
  hud: 1.2,
  label: 0.8,
  normal: 0,
} as const;
