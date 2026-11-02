import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { getWeightUnit } from '@/data/settings';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { SettingsScreen } from '../SettingsScreen';

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

  it('explains that existing weights are relabeled, not converted', async () => {
    const db = await createTestDb();
    await renderWithDb(<SettingsScreen />, db);
    expect(await screen.findByText(/not converted/i)).toBeTruthy();
  });
});
