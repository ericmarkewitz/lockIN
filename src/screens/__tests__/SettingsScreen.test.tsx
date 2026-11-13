import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { getAppearance, getDistanceUnit, getThemeId, getWeightUnit } from '@/data/settings';
import { ThemeProvider } from '@/theme';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { SettingsScreen } from '../SettingsScreen';

const themed = () => <ThemeProvider><SettingsScreen /></ThemeProvider>;

describe('SettingsScreen', () => {
  it('shows the current unit as selected', async () => {
    const db = await createTestDb();
    await renderWithDb(<SettingsScreen />, db);
    await waitFor(() => expect(screen.getByLabelText('Pounds (lb)').props.accessibilityState).toMatchObject({ selected: true }));
    expect(screen.getByLabelText('Kilograms (kg)').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('saves the unit when toggled to kg', async () => {
    const db = await createTestDb();
    await renderWithDb(<SettingsScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Kilograms (kg)'));
    await waitFor(async () => expect(await getWeightUnit(db)).toBe('kg'));
    expect(screen.getByLabelText('Kilograms (kg)').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('explains that weights are stored once and converted for display', async () => {
    const db = await createTestDb();
    await renderWithDb(<SettingsScreen />, db);
    expect(await screen.findByText(/converted for display/i)).toBeTruthy();
  });

  it('saves the distance unit when toggled to km', async () => {
    const db = await createTestDb();
    await renderWithDb(<SettingsScreen />, db);
    await waitFor(() => expect(screen.getByLabelText('Miles (mi)').props.accessibilityState).toMatchObject({ selected: true }));
    await fireEvent.press(screen.getByLabelText('Kilometers (km)'));
    await waitFor(async () => expect(await getDistanceUnit(db)).toBe('km'));
    expect(screen.getByLabelText('Kilometers (km)').props.accessibilityState).toMatchObject({ selected: true });
    expect(await getWeightUnit(db)).toBe('lb');
  });

  it('explains how to log a single set in the other unit', async () => {
    const db = await createTestDb();
    await renderWithDb(<SettingsScreen />, db);
    expect(await screen.findByText(/tap the unit next to its weight/i)).toBeTruthy();
  });

  it('shows the original theme as selected by default', async () => {
    const db = await createTestDb();
    await renderWithDb(themed(), db);
    expect((await screen.findByLabelText('Cobalt theme')).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Ember theme').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('saves and applies a new theme when one is picked', async () => {
    const db = await createTestDb();
    await renderWithDb(themed(), db);
    await fireEvent.press(await screen.findByLabelText('Ember theme'));
    await waitFor(async () => expect(await getThemeId(db)).toBe('ember'));
    await waitFor(() => expect(screen.getByLabelText('Ember theme').props.accessibilityState).toMatchObject({ selected: true }));
    expect(screen.getByLabelText('Cobalt theme').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('saves the appearance when forced to dark', async () => {
    const db = await createTestDb();
    await renderWithDb(themed(), db);
    await waitFor(() => expect(screen.getByLabelText('System').props.accessibilityState).toMatchObject({ selected: true }));
    await fireEvent.press(screen.getByLabelText('Dark'));
    await waitFor(async () => expect(await getAppearance(db)).toBe('dark'));
    await waitFor(() => expect(screen.getByLabelText('Dark').props.accessibilityState).toMatchObject({ selected: true }));
    expect(await getThemeId(db)).toBe('cobalt');
  });
});
