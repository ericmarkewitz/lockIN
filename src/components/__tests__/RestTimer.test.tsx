import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { formatRest, RestTimer } from '../RestTimer';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

describe('formatRest', () => {
  it('shows minutes and seconds, rounding partial seconds up', () => {
    expect(formatRest(90_000)).toBe('1:30');
    expect(formatRest(4_200)).toBe('0:05');
    expect(formatRest(0)).toBe('0:00');
    expect(formatRest(-500)).toBe('0:00');
  });
});

describe('RestTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 2, 9, 0, 0));
  });
  afterEach(() => jest.useRealTimers());

  const renderTimer = async () => {
    const handlers = { onAdjust: jest.fn(), onSkip: jest.fn(), onFinish: jest.fn() };
    await render(<RestTimer endsAt={Date.now() + 90_000} {...handlers} />);
    return handlers;
  };

  it('counts down to the end of the rest', async () => {
    await renderTimer();
    expect(screen.getByLabelText('Rest, 1:30 left')).toBeTruthy();
    await act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByLabelText('Rest, 1:00 left')).toBeTruthy();
  });

  it('buzzes and finishes once the time is up', async () => {
    const { onFinish } = await renderTimer();
    await act(() => jest.advanceTimersByTime(90_000));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('adds or takes away 15 seconds, and can be skipped', async () => {
    const { onAdjust, onSkip } = await renderTimer();
    await fireEvent.press(screen.getByLabelText('Add 15 seconds'));
    expect(onAdjust).toHaveBeenLastCalledWith(15);
    await fireEvent.press(screen.getByLabelText('Take away 15 seconds'));
    expect(onAdjust).toHaveBeenLastCalledWith(-15);
    await fireEvent.press(screen.getByLabelText('Skip rest'));
    expect(onSkip).toHaveBeenCalled();
  });
});
