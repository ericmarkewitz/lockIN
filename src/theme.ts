import { useColorScheme } from 'react-native';

const light = {
  bg: '#f6f7f9', card: '#ffffff', text: '#111418', muted: '#6b7280', border: '#e2e5ea',
  primary: '#2563eb', onPrimary: '#ffffff', success: '#16a34a', warn: '#d97706', danger: '#dc2626', rest: '#8b5cf6',
};
const dark: typeof light = {
  bg: '#0e1013', card: '#181b20', text: '#f3f4f6', muted: '#9aa1ac', border: '#2a2e35',
  primary: '#60a5fa', onPrimary: '#0b1220', success: '#4ade80', warn: '#fbbf24', danger: '#f87171', rest: '#a78bfa',
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? dark : light);
