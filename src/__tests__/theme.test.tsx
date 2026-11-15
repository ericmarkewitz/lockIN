import { screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { setAppearance, setThemeId, THEME_IDS } from '@/data/settings';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { accentGradient, mix, THEMES, ThemeProvider, useTheme } from '../theme';

function Probe() {
  const t = useTheme();
  return <Text testID="probe">{`${t.primary} ${t.bg}`}</Text>;
}

describe('THEMES', () => {
  it.each(THEME_IDS)('%s defines every color in light and dark as 6-digit hex', (id) => {
    const { light, dark } = THEMES[id];
    const keys = Object.keys(THEMES.cobalt.light).sort();
    for (const palette of [light, dark]) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      // tint() appends an alpha byte, so every color must be #rrggbb.
      for (const value of Object.values(palette)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keeps cobalt identical to the original colors', () => {
    expect(THEMES.cobalt.light.primary).toBe('#2563eb');
    expect(THEMES.cobalt.dark.primary).toBe('#60a5fa');
  });
});

describe('useTheme', () => {
  it('uses cobalt for the system scheme without a provider', async () => {
    const db = await createTestDb();
    await renderWithDb(<Probe />, db);
    expect(screen.getByTestId('probe').props.children).toBe(`${THEMES.cobalt.light.primary} ${THEMES.cobalt.light.bg}`);
  });

  it('uses the saved theme', async () => {
    const db = await createTestDb();
    await setThemeId(db, 'ember');
    await renderWithDb(<ThemeProvider><Probe /></ThemeProvider>, db);
    const { primary, bg } = THEMES.ember.light;
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe(`${primary} ${bg}`));
  });

  it('uses the dark palette when appearance is forced dark', async () => {
    const db = await createTestDb();
    await setThemeId(db, 'volt');
    await setAppearance(db, 'dark');
    await renderWithDb(<ThemeProvider><Probe /></ThemeProvider>, db);
    const { primary, bg } = THEMES.volt.dark;
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe(`${primary} ${bg}`));
  });
});

describe('mix', () => {
  it('blends two colors by the given share of the second', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#0000ff', 0.25)).toBe('#bf0040');
  });

  it('returns 6-digit hex so tint() still works on the result', () => {
    expect(mix('#2563eb', '#000000', 0.3)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('accentGradient', () => {
  it('sweeps from the accent into a deeper shade of it', () => {
    const t = THEMES.cobalt.light;
    expect(accentGradient(t)).toBe(`linear-gradient(135deg, ${t.primary} 0%, ${mix(t.primary, '#000000', 0.25)} 100%)`);
  });
});
