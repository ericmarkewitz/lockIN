import { screen } from '@testing-library/react-native';

import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { ExercisePicker } from '../ExercisePicker';

describe('ExercisePicker', () => {
  it('keeps the custom exercise input inside a keyboard-avoiding container', async () => {
    const db = await createTestDb();
    await renderWithDb(<ExercisePicker visible onPick={jest.fn()} onClose={jest.fn()} />, db);
    expect(await screen.findByLabelText('New exercise name')).toBeTruthy();
    expect(screen.getByTestId('picker-keyboard-avoider')).toBeTruthy();
  });
});
