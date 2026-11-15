import { useEffect } from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { DayScreen } from '../DayScreen';

function useMockFocusEffect(cb: () => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cb, []);
}
const mockUseFocusEffect = useMockFocusEffect;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (cb: () => void) => mockUseFocusEffect(cb),
}));

describe('DayScreen', () => {
  it('shows the workout in a keyboard-aware scroll view', async () => {
    await renderWithDb(<DayScreen date="2026-11-02" />, await createTestDb());
    expect(await screen.findByLabelText('Workout notes')).toBeTruthy();
    expect(screen.getByTestId('keyboard-avoider')).toBeTruthy();
    expect(screen.getByTestId('day-scroll').props).toMatchObject({
      automaticallyAdjustKeyboardInsets: true,
      keyboardShouldPersistTaps: 'handled',
    });
  });
});
