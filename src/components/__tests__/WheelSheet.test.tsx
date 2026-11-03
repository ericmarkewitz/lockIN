import { fireEvent, render, screen, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { WHEEL_ROW_HEIGHT, WheelSheet } from '../WheelSheet';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

const columns = [
  { label: 'Sets', options: [null, 1, 2, 3, 4], value: 3 },
  { label: 'Reps', options: [null, 8, 9, 10], value: 10 },
];

const setup = async (visible = true) => {
  const onDone = jest.fn();
  const onCancel = jest.fn();
  await render(<WheelSheet visible={visible} title="Bench Press" columns={columns} onDone={onDone} onCancel={onCancel} />);
  return { onDone, onCancel };
};

const scrollTo = async (wheel: string, y: number) => {
  const scroller = screen.getByTestId(`${wheel} wheel scroller`);
  await fireEvent(scroller, 'scrollBeginDrag');
  await fireEvent.scroll(scroller, { nativeEvent: { contentOffset: { x: 0, y } } });
};

describe('WheelSheet', () => {
  it('renders nothing while closed', async () => {
    await setup(false);
    expect(screen.queryByText('Bench Press')).toBeNull();
  });

  it('opens on the current values, and Done returns them unchanged', async () => {
    const { onDone } = await setup();
    expect(screen.getByLabelText('Sets').props.accessibilityValue).toEqual({ text: '3' });
    expect(screen.getByLabelText('Reps').props.accessibilityValue).toEqual({ text: '10' });
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledWith([3, 10]);
  });

  it('positions each wheel so the current value is under the selection band', async () => {
    await setup();
    expect(screen.getByTestId('Sets wheel scroller').props.contentOffset).toEqual({ x: 0, y: 3 * WHEEL_ROW_HEIGHT });
    expect(screen.getByTestId('Reps wheel scroller').props.contentOffset).toEqual({ x: 0, y: 3 * WHEEL_ROW_HEIGHT });
  });

  it('selects the row a drag settles on', async () => {
    const { onDone } = await setup();
    await scrollTo('Sets', 4 * WHEEL_ROW_HEIGHT);
    await scrollTo('Reps', 1 * WHEEL_ROW_HEIGHT);
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledWith([4, 8]);
  });

  it('ignores scroll events the user did not start', async () => {
    // Some platforms report offset 0 while applying the initial offset.
    const { onDone } = await setup();
    await fireEvent.scroll(screen.getByTestId('Sets wheel scroller'), { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledWith([3, 10]);
  });

  it('follows scrolling without a drag on web, where a mouse wheel fires no drag events', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const { onDone } = await setup();
      await fireEvent.scroll(screen.getByTestId('Sets wheel scroller'), { nativeEvent: { contentOffset: { x: 0, y: WHEEL_ROW_HEIGHT } } });
      await fireEvent.press(screen.getByLabelText('Done'));
      expect(onDone).toHaveBeenCalledWith([1, 10]);
    } finally {
      os.restore();
    }
  });

  it('selects a row when it is tapped', async () => {
    const { onDone } = await setup();
    await fireEvent.press(within(screen.getByLabelText('Reps')).getByText('9'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledWith([3, 9]);
  });

  it('can clear a value with the blank row', async () => {
    const { onDone } = await setup();
    await scrollTo('Reps', 0);
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledWith([3, null]);
  });

  it('steps with screen-reader increment and decrement, stopping at the ends', async () => {
    const { onDone } = await setup();
    const action = (actionName: string) =>
      fireEvent(screen.getByLabelText('Sets'), 'accessibilityAction', { nativeEvent: { actionName } });
    await action('increment');
    await action('increment');
    expect(screen.getByLabelText('Sets').props.accessibilityValue).toEqual({ text: '4' });
    await action('decrement');
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledWith([3, 10]);
  });

  describe('haptics', () => {
    const tick = jest.mocked(Haptics.selectionAsync);
    beforeEach(() => tick.mockClear());

    it('stays still until the selection changes', async () => {
      await setup();
      const scroller = screen.getByTestId('Sets wheel scroller');
      await fireEvent(scroller, 'scrollBeginDrag');
      await fireEvent.scroll(scroller, { nativeEvent: { contentOffset: { x: 0, y: 3 * WHEEL_ROW_HEIGHT + 5 } } });
      expect(tick).not.toHaveBeenCalled();
    });

    it('ticks once for each row a drag lands on', async () => {
      await setup();
      await scrollTo('Sets', 4 * WHEEL_ROW_HEIGHT);
      await scrollTo('Sets', 4 * WHEEL_ROW_HEIGHT + 3);
      expect(tick).toHaveBeenCalledTimes(1);
      await scrollTo('Sets', 3 * WHEEL_ROW_HEIGHT);
      expect(tick).toHaveBeenCalledTimes(2);
    });

    it('ticks when a row is tapped', async () => {
      await setup();
      await fireEvent.press(within(screen.getByLabelText('Reps')).getByText('9'));
      expect(tick).toHaveBeenCalledTimes(1);
    });

    it('still selects when haptics are unavailable', async () => {
      tick.mockRejectedValueOnce(new Error('unavailable'));
      const { onDone } = await setup();
      await scrollTo('Sets', 4 * WHEEL_ROW_HEIGHT);
      await fireEvent.press(screen.getByLabelText('Done'));
      expect(onDone).toHaveBeenCalledWith([4, 10]);
    });
  });

  it.each([
    ['Cancel button', () => screen.getByLabelText('Cancel')],
    ['backdrop', () => screen.getByTestId('wheel-backdrop')],
  ])('dismisses from the %s without returning values', async (_, target) => {
    const { onDone, onCancel } = await setup();
    await scrollTo('Sets', 0);
    await fireEvent.press(target());
    expect(onCancel).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
