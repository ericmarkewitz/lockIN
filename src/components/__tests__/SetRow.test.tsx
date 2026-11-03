import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { SetRow } from '../SetRow';
import type { WorkoutSet } from '@/data/types';

const set: WorkoutSet = {
  id: 1, setNumber: 2, targetReps: 10, reps: null, weight: null, durationMin: null, distance: null, completed: false,
};

describe('SetRow weight units', () => {
  it('shows a stored pound weight in kilograms', async () => {
    await render(<SetRow kind="strength" set={{ ...set, weight: 135 }} unit="kg" onChange={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByLabelText('Weight for set 2').props.value).toBe('61.23');
    expect(screen.getByText('kg')).toBeTruthy();
  });

  it('stores a weight typed in kilograms as pounds', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={set} unit="kg" onChange={onChange} onRemove={jest.fn()} />);
    const input = screen.getByLabelText('Weight for set 2');
    await fireEvent.changeText(input, '100');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith({ weight: expect.closeTo(220.462262185, 6) });
  });

  it('does not re-save when the displayed kg value is unchanged', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={{ ...set, weight: 220.462262185 }} unit="kg" onChange={onChange} onRemove={jest.fn()} />);
    const input = screen.getByLabelText('Weight for set 2');
    await fireEvent.changeText(input, '100');
    await fireEvent(input, 'blur');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SetRow (strength)', () => {
  it('shows the set number and the rep target while reps are unlogged', async () => {
    await render(<SetRow kind="strength" set={set} unit="lb" onChange={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(within(screen.getByLabelText('Reps for set 2')).getByText('10')).toBeTruthy();
    expect(screen.getByLabelText('Reps for set 2').props.accessibilityValue).toEqual({ text: 'Not logged, target 10' });
  });

  it('commits weight on blur as a number', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={set} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    const input = screen.getByLabelText('Weight for set 2');
    await fireEvent.changeText(input, '135');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith({ weight: 135 });
  });

  it('picks reps on the wheel and saves them on Done', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={{ ...set, reps: 8 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Reps for set 2'));
    await fireEvent.press(within(screen.getByLabelText('Reps')).getByText('12'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ reps: 12 });
    expect(screen.queryByLabelText('Done')).toBeNull();
  });

  it('logs the target when the wheel is accepted as it opened', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={set} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Reps for set 2'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ reps: 10 });
  });

  it('allows zero reps for a failed set', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={{ ...set, reps: 8 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Reps for set 2'));
    await fireEvent.press(within(screen.getByLabelText('Reps')).getByText('0'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ reps: 0 });
  });

  it('clears logged reps with the blank row', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={{ ...set, reps: 8 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Reps for set 2'));
    await fireEvent.press(within(screen.getByLabelText('Reps')).getByText('–'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ reps: null });
  });

  it('does not save reps when the wheel is cancelled or left unchanged', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={{ ...set, reps: 8 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Reps for set 2'));
    await fireEvent.press(screen.getByLabelText('Cancel'));
    await fireEvent.press(screen.getByLabelText('Reps for set 2'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not fire onChange when nothing changed', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={{ ...set, weight: 100 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent(screen.getByLabelText('Weight for set 2'), 'blur');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggles completion', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={set} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Mark set 2 done'));
    expect(onChange).toHaveBeenCalledWith({ completed: true });
  });

  it('removes a set', async () => {
    const onRemove = jest.fn();
    await render(<SetRow kind="strength" set={set} unit="lb" onChange={jest.fn()} onRemove={onRemove} />);
    await fireEvent.press(screen.getByLabelText('Remove set 2'));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('SetRow (cardio)', () => {
  const pick = async (wheel: string, value: string) =>
    fireEvent.press(within(screen.getByLabelText(wheel)).getByText(value));

  it('records duration and distance instead of weight/reps', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" set={set} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    expect(screen.queryByLabelText('Weight for set 2')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Duration for set 2'));
    await pick('Minutes', '30');
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ durationMin: 30 });
  });

  it('picks hours, minutes and seconds, storing minutes', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" set={set} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Duration for set 2'));
    await pick('Hours', '1');
    await pick('Minutes', '5');
    await pick('Seconds', '30');
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ durationMin: 65.5 });
  });

  it('shows a logged duration and opens the wheels on it', async () => {
    await render(<SetRow kind="cardio" set={{ ...set, durationMin: 65.5 }} unit="lb" onChange={jest.fn()} onRemove={jest.fn()} />);
    expect(within(screen.getByLabelText('Duration for set 2')).getByText('1h 5m 30s')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Duration for set 2'));
    expect(screen.getByLabelText('Hours').props.accessibilityValue).toEqual({ text: '1' });
    expect(screen.getByLabelText('Minutes').props.accessibilityValue).toEqual({ text: '5' });
    expect(screen.getByLabelText('Seconds').props.accessibilityValue).toEqual({ text: '30' });
  });

  it('counts every minute and second, with no blank row', async () => {
    await render(<SetRow kind="cardio" set={set} unit="lb" onChange={jest.fn()} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Duration for set 2'));
    const seconds = within(screen.getByLabelText('Seconds'));
    expect(seconds.getByText('0')).toBeTruthy();
    expect(seconds.getByText('7')).toBeTruthy();
    expect(seconds.getByText('59')).toBeTruthy();
    expect(seconds.queryByText('–')).toBeNull();
  });

  it('clears a logged duration when the wheels are set to zero', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" set={{ ...set, durationMin: 30 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Duration for set 2'));
    await pick('Minutes', '0');
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ durationMin: null });
  });

  it('does not save when nothing changed, even for a value more precise than a second', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" set={{ ...set, durationMin: 1.2345 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Duration for set 2'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not log an empty wheel accepted as it opened', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" set={set} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Duration for set 2'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens duration on the target, which Done then logs', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" set={set} targetDurationMin={45} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    const field = screen.getByLabelText('Duration for set 2');
    expect(within(field).getByText('45 min')).toBeTruthy();
    expect(field.props.accessibilityValue).toEqual({ text: 'Not logged, target 45 min' });
    await fireEvent.press(field);
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ durationMin: 45 });
  });

  it('still types distance', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" set={set} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    const dist = screen.getByLabelText('Distance for set 2');
    await fireEvent.changeText(dist, '3.1');
    await fireEvent(dist, 'blur');
    expect(onChange).toHaveBeenCalledWith({ distance: 3.1 });
  });
});
