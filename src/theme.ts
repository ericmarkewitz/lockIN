import { useColorScheme } from 'react-native';

const light = {
  bg: '#f4f5f8', card: '#ffffff', surface: '#e8ebf0', text: '#111418', muted: '#6b7280', border: '#e2e5ea',
  primary: '#2563eb', onPrimary: '#ffffff', success: '#16a34a', warn: '#d97706', danger: '#dc2626', rest: '#8b5cf6',
};
const dark: typeof light = {
  bg: '#0b0d10', card: '#16191e', surface: '#22262d', text: '#f3f4f6', muted: '#9aa1ac', border: '#2a2e35',
  primary: '#60a5fa', onPrimary: '#0b1220', success: '#4ade80', warn: '#fbbf24', danger: '#f87171', rest: '#a78bfa',
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? dark : light);

/** A theme color (6-digit hex) at the given opacity, for soft fills behind accents. */
export const tint = (hex: string, alpha: number) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
