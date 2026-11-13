import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance as RNAppearance, useColorScheme } from 'react-native';

import {
  getThemeSettings, setAppearance as saveAppearance, setThemeId as saveThemeId,
  type Appearance, type ThemeId, type ThemeSettings,
} from '@/data/settings';
import { useDb } from '@/db/DbContext';

export type Theme = {
  bg: string; card: string; surface: string; text: string; muted: string; border: string;
  primary: string; onPrimary: string; success: string; warn: string; danger: string; rest: string;
};

export type ThemeDef = { name: string; tag: string; light: Theme; dark: Theme };

/**
 * Every palette defines the same 12 colors as 6-digit hex (tint() relies on that). Some themes move a status
 * color (done, in progress, missed, rest) so it never blends into that theme's accent.
 */
export const THEMES: Record<ThemeId, ThemeDef> = {
  cobalt: {
    name: 'Cobalt', tag: 'Original',
    light: { bg: '#f4f5f8', card: '#ffffff', surface: '#e8ebf0', text: '#111418', muted: '#6b7280', border: '#e2e5ea', primary: '#2563eb', onPrimary: '#ffffff', success: '#16a34a', warn: '#d97706', danger: '#dc2626', rest: '#8b5cf6' },
    dark: { bg: '#0b0d10', card: '#16191e', surface: '#22262d', text: '#f3f4f6', muted: '#9aa1ac', border: '#2a2e35', primary: '#60a5fa', onPrimary: '#0b1220', success: '#4ade80', warn: '#fbbf24', danger: '#f87171', rest: '#a78bfa' },
  },
  volt: {
    name: 'Volt', tag: 'High energy',
    light: { bg: '#f5f6f1', card: '#ffffff', surface: '#e7eae0', text: '#12150f', muted: '#636b5c', border: '#dfe3d6', primary: '#4d7c0f', onPrimary: '#ffffff', success: '#0f9f8a', warn: '#c27c0e', danger: '#e11d48', rest: '#7c3aed' },
    dark: { bg: '#0a0b0a', card: '#151714', surface: '#20231f', text: '#f2f5ee', muted: '#9ba394', border: '#262a24', primary: '#c8f05a', onPrimary: '#11160a', success: '#34d3b4', warn: '#fbbf24', danger: '#fb7185', rest: '#a78bfa' },
  },
  ember: {
    name: 'Ember', tag: 'Warm',
    light: { bg: '#faf6f2', card: '#ffffff', surface: '#f0e8e0', text: '#1c1410', muted: '#7a6a5f', border: '#ebe0d6', primary: '#ea580c', onPrimary: '#ffffff', success: '#16a34a', warn: '#ca8a04', danger: '#dc2626', rest: '#8b5cf6' },
    dark: { bg: '#120d0a', card: '#1c1613', surface: '#2a211c', text: '#f7efe9', muted: '#ab9a8e', border: '#33281f', primary: '#fb8c3c', onPrimary: '#1a0d04', success: '#4ade80', warn: '#facc15', danger: '#f87171', rest: '#a78bfa' },
  },
  midnight: {
    name: 'Midnight', tag: 'Calm',
    light: { bg: '#f4f4fb', card: '#ffffff', surface: '#e6e6f5', text: '#14142b', muted: '#6b6b8a', border: '#e0e0ef', primary: '#4f46e5', onPrimary: '#ffffff', success: '#059669', warn: '#d97706', danger: '#e11d48', rest: '#db2777' },
    dark: { bg: '#0b0c1a', card: '#15162b', surface: '#212240', text: '#eeeefc', muted: '#9a9bc0', border: '#262848', primary: '#8b8cf8', onPrimary: '#0b0c1a', success: '#34d399', warn: '#fbbf24', danger: '#fb7185', rest: '#f472b6' },
  },
  mono: {
    name: 'Mono', tag: 'Minimal',
    light: { bg: '#f5f5f4', card: '#ffffff', surface: '#e7e7e5', text: '#0c0c0c', muted: '#737373', border: '#e5e5e5', primary: '#0c0c0c', onPrimary: '#ffffff', success: '#16a34a', warn: '#d97706', danger: '#dc2626', rest: '#64748b' },
    dark: { bg: '#000000', card: '#121212', surface: '#1f1f1f', text: '#fafafa', muted: '#a3a3a3', border: '#262626', primary: '#fafafa', onPrimary: '#0a0a0a', success: '#4ade80', warn: '#fbbf24', danger: '#f87171', rest: '#94a3b8' },
  },
  tide: {
    name: 'Tide', tag: 'Fresh',
    light: { bg: '#f2f7f7', card: '#ffffff', surface: '#e1ecec', text: '#0d1a1b', muted: '#5e7476', border: '#dbe7e7', primary: '#0d9488', onPrimary: '#ffffff', success: '#65a30d', warn: '#d97706', danger: '#dc2626', rest: '#7c3aed' },
    dark: { bg: '#071213', card: '#0f1d1f', surface: '#1a2c2e', text: '#e8f4f4', muted: '#8fa9ab', border: '#1f3436', primary: '#2dd4bf', onPrimary: '#042f2c', success: '#a3e635', warn: '#fbbf24', danger: '#f87171', rest: '#a78bfa' },
  },
  trophy: {
    name: 'Trophy', tag: 'Bold',
    light: { bg: '#f7f5ef', card: '#ffffff', surface: '#ebe6d8', text: '#16140f', muted: '#6f6a5c', border: '#e6e0d0', primary: '#a16207', onPrimary: '#ffffff', success: '#15803d', warn: '#ea580c', danger: '#dc2626', rest: '#6d28d9' },
    dark: { bg: '#0b0a08', card: '#17150f', surface: '#24211a', text: '#f6f2e7', muted: '#a8a08c', border: '#2c2820', primary: '#f2c14e', onPrimary: '#1a1405', success: '#4ade80', warn: '#fb923c', danger: '#f87171', rest: '#a78bfa' },
  },
  sakura: {
    name: 'Sakura', tag: 'Playful',
    light: { bg: '#fbf5f7', card: '#ffffff', surface: '#f3e4ea', text: '#1f1418', muted: '#806670', border: '#f0dfe6', primary: '#db2777', onPrimary: '#ffffff', success: '#059669', warn: '#d97706', danger: '#b91c1c', rest: '#0284c7' },
    dark: { bg: '#140b0f', card: '#1f1318', surface: '#2e1c24', text: '#fbeef3', muted: '#b693a1', border: '#36222b', primary: '#f472b6', onPrimary: '#2a0716', success: '#34d399', warn: '#fbbf24', danger: '#ef4444', rest: '#38bdf8' },
  },
  trail: {
    name: 'Trail', tag: 'Earthy',
    light: { bg: '#f4f2ea', card: '#fffdf7', surface: '#e7e3d4', text: '#1a1c14', muted: '#6b6d5a', border: '#e1dccb', primary: '#2f6b3a', onPrimary: '#ffffff', success: '#0f9f8a', warn: '#b45309', danger: '#dc2626', rest: '#7c3aed' },
    dark: { bg: '#0d0f0b', card: '#171a14', surface: '#23271e', text: '#eeefe6', muted: '#a2a593', border: '#2a2e24', primary: '#8fce7a', onPrimary: '#0d1a08', success: '#2dd4bf', warn: '#fbbf24', danger: '#f87171', rest: '#a78bfa' },
  },
};

type ThemeContextValue = ThemeSettings & {
  setThemeId: (id: ThemeId) => Promise<void>;
  setAppearance: (appearance: Appearance) => Promise<void>;
};

const noop = async () => {};
const ThemeContext = createContext<ThemeContextValue>({
  themeId: 'cobalt', appearance: 'system', setThemeId: noop, setAppearance: noop,
});

/** Loads the saved theme and appearance, and saves changes. Must sit inside <DbProvider>. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const [settings, setSettings] = useState<ThemeSettings | null>(null);

  useEffect(() => {
    let live = true;
    getThemeSettings(db).then((s) => live && setSettings(s));
    return () => { live = false; };
  }, [db]);

  // Forcing light or dark natively too keeps the status bar, alerts and system controls in step with the colors.
  const appearance = settings?.appearance;
  useEffect(() => {
    if (appearance) RNAppearance.setColorScheme(appearance === 'system' ? 'unspecified' : appearance);
  }, [appearance]);

  // Render nothing until the saved theme is read (a few ms) so the app never flashes the default colors.
  if (!settings) return null;

  const value: ThemeContextValue = {
    ...settings,
    setThemeId: async (themeId) => {
      await saveThemeId(db, themeId);
      setSettings((s) => s && { ...s, themeId });
    },
    setAppearance: async (next) => {
      await saveAppearance(db, next);
      setSettings((s) => s && { ...s, appearance: next });
    },
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The selected theme and appearance, with setters that save them. */
export const useThemeSettings = () => useContext(ThemeContext);

/** The light or dark scheme currently in effect. */
export function useScheme(): 'light' | 'dark' {
  const { appearance } = useContext(ThemeContext);
  const system = useColorScheme();
  if (appearance !== 'system') return appearance;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme(): Theme {
  const { themeId } = useContext(ThemeContext);
  return THEMES[themeId][useScheme()];
}

/** A theme color (6-digit hex) at the given opacity, for soft fills behind accents. */
export const tint = (hex: string, alpha: number) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
