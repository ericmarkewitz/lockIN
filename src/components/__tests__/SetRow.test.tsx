import { fireEvent, render, screen } from '@testing-library/react-native';

import { SetRow } from '../SetRow';
import type { WorkoutSet } from '@/data/types';

const set: WorkoutSet = {
  id: 1, setNumber: 2, targetReps: 10, reps: null, weight: null, durationMin: null, distance: null, completed: false,
};

describe('SetRow (strength)', () => {
  it('shows the set number and rep target as placeholder', async () => {
    await render(<SetRow kind="strength" set={set} unit="lb" onChange={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByPlaceholderText('10')).toBeTruthy();
  });

  it('commits weight on blur as a number', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={set} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    const input = screen.getByLabelText('Weight for set 2');
    await fireEvent.changeText(input, '135');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith({ weight: 135 });
  });

  it('commits reps on blur, and null when cleared', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={{ ...set, reps: 8 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    const input = screen.getByLabelText('Reps for set 2');
    await fireEvent.changeText(input, '');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith({ reps: null });
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
  it('records duration and distance instead of weight/reps', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" set={set} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    expect(screen.queryByLabelText('Weight for set 2')).toBeNull();
    const dur = screen.getByLabelText('Duration for set 2');
    await fireEvent.changeText(dur, '30');
    await fireEvent(dur, 'blur');
    expect(onChange).toHaveBeenCalledWith({ durationMin: 30 });
  });
});
