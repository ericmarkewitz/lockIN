import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { DisclaimerScreen } from '../DisclaimerScreen';

describe('DisclaimerScreen', () => {
  it('says the app is a log, not advice, and to check with a doctor', async () => {
    const db = await createTestDb();
    await renderWithDb(<DisclaimerScreen onAccept={jest.fn()} />, db);
    expect(screen.getByText(/doesn't give medical, fitness or training advice/i)).toBeTruthy();
    expect(screen.getByText(/check with a doctor/i)).toBeTruthy();
    expect(screen.getByText(/stop if anything hurts/i)).toBeTruthy();
  });

  it('accepts only when the button is pressed', async () => {
    const db = await createTestDb();
    const onAccept = jest.fn();
    await renderWithDb(<DisclaimerScreen onAccept={onAccept} />, db);
    expect(onAccept).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('I understand'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('offers no way to decline or dismiss', async () => {
    const db = await createTestDb();
    await renderWithDb(<DisclaimerScreen onAccept={jest.fn()} />, db);
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['I understand']);
  });
});
