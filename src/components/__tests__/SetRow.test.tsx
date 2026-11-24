import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { SetHeader, SetRow } from '../SetRow';
import type { WorkoutSet } from '@/data/types';

const set: WorkoutSet = {
  id: 1, setNumber: 2, targetReps: 10, reps: null, weight: null, durationMin: null, distance: null,
  count: null, elevation: null, score: null, difficulty: null,
  weightUnit: null, distanceUnit: null, completed: false, isLogged: false,
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
  // Cardio, yoga and mobility log one entry per exercise rather than numbered sets.
  const entry = { ...set, setNumber: 1, targetReps: null };

  const pick = async (wheel: string, value: string) =>
    fireEvent.press(within(screen.getByLabelText(wheel)).getByText(value));

  it('records duration and distance instead of weight/reps', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={entry} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    expect(screen.queryByLabelText('Weight for set 2')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Running duration'));
    await pick('Minutes', '30');
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ durationMin: 30 });
  });

  it('picks hours, minutes and seconds, storing minutes', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={entry} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Running duration'));
    await pick('Hours', '1');
    await pick('Minutes', '5');
    await pick('Seconds', '30');
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ durationMin: 65.5 });
  });

  it('shows a logged duration and opens the wheels on it', async () => {
    await render(<SetRow kind="cardio" exerciseName="Running" set={{ ...entry, durationMin: 65.5 }} unit="lb" onChange={jest.fn()} onRemove={jest.fn()} />);
    expect(within(screen.getByLabelText('Running duration')).getByText('1h 5m 30s')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Running duration'));
    expect(screen.getByLabelText('Hours').props.accessibilityValue).toEqual({ text: '1' });
    expect(screen.getByLabelText('Minutes').props.accessibilityValue).toEqual({ text: '5' });
    expect(screen.getByLabelText('Seconds').props.accessibilityValue).toEqual({ text: '30' });
  });

  it('counts every minute and second, with no blank row', async () => {
    await render(<SetRow kind="cardio" exerciseName="Running" set={entry} unit="lb" onChange={jest.fn()} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Running duration'));
    const seconds = within(screen.getByLabelText('Seconds'));
    expect(seconds.getByText('0')).toBeTruthy();
    expect(seconds.getByText('7')).toBeTruthy();
    expect(seconds.getByText('59')).toBeTruthy();
    expect(seconds.queryByText('–')).toBeNull();
  });

  it('clears a logged duration when the wheels are set to zero', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={{ ...entry, durationMin: 30 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Running duration'));
    await pick('Minutes', '0');
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ durationMin: null });
  });

  it('does not save when nothing changed, even for a value more precise than a second', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={{ ...entry, durationMin: 1.2345 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Running duration'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not log an empty wheel accepted as it opened', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={entry} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Running duration'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens duration on the target, which Done then logs', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={entry} targetDurationMin={45} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    const field = screen.getByLabelText('Running duration');
    expect(within(field).getByText('45 min')).toBeTruthy();
    expect(field.props.accessibilityValue).toEqual({ text: 'Not logged, target 45 min' });
    await fireEvent.press(field);
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ durationMin: 45 });
  });

  it('types distance in the selected unit', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={entry} unit="lb" distanceUnit="mi" onChange={onChange} onRemove={jest.fn()} />);
    const dist = screen.getByLabelText('Running distance');
    await fireEvent.changeText(dist, '3.1');
    await fireEvent(dist, 'blur');
    expect(onChange).toHaveBeenCalledWith({ distance: 3.1 });
    expect(screen.getByLabelText('Running distance unit').props.accessibilityValue).toEqual({ text: 'mi' });
  });

  it('shows stored miles in kilometres and stores a km entry as miles', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={{ ...entry, distance: 3.1 }} unit="lb" distanceUnit="km" onChange={onChange} onRemove={jest.fn()} />);
    const dist = screen.getByLabelText('Running distance');
    expect(dist.props.value).toBe('4.99');
    await fireEvent.changeText(dist, '5');
    await fireEvent(dist, 'blur');
    expect(onChange).toHaveBeenCalledWith({ distance: expect.closeTo(3.10686, 5) });
  });

  it('does not re-save a distance whose displayed value is unchanged', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={{ ...entry, distance: 3.1 }} unit="lb" distanceUnit="km" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent(screen.getByLabelText('Running distance'), 'blur');
    await fireEvent.changeText(screen.getByLabelText('Running distance'), '4.99');
    await fireEvent(screen.getByLabelText('Running distance'), 'blur');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('switches one set to km, keeping the typed number', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={entry} unit="lb" distanceUnit="mi" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Running distance'), '5');
    await fireEvent.press(screen.getByLabelText('Running distance unit'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ distanceUnit: 'km', distance: expect.closeTo(3.10686, 5) });
  });

  it('shows a set in the unit it was entered in', async () => {
    await render(
      <SetRow kind="cardio" exerciseName="Running" set={{ ...entry, distance: 5 / 1.609344, distanceUnit: 'km' }} unit="lb" distanceUnit="mi" onChange={jest.fn()} onRemove={jest.fn()} />,
    );
    expect(screen.getByLabelText('Running distance').props.value).toBe('5');
    expect(screen.getByLabelText('Running distance unit').props.accessibilityValue).toEqual({ text: 'km' });
  });

  it('has no set number and is labelled by the exercise', async () => {
    await render(<SetRow kind="cardio" exerciseName="Running" set={entry} unit="lb" onChange={jest.fn()} />);
    expect(screen.queryByText('1')).toBeNull();
    expect(screen.queryByLabelText(/set 1/)).toBeNull();
    expect(screen.getByLabelText('Mark Running done')).toBeTruthy();
  });

  it('cannot be removed on its own; the exercise is removed instead', async () => {
    await render(<SetRow kind="cardio" exerciseName="Running" set={entry} unit="lb" onChange={jest.fn()} />);
    expect(screen.queryByLabelText(/Remove/)).toBeNull();
  });

  it('numbers extra entries kept from before, so they stay distinct and removable', async () => {
    const onRemove = jest.fn();
    await render(<SetRow kind="cardio" exerciseName="Running" set={{ ...entry, setNumber: 2 }} unit="lb" onChange={jest.fn()} onRemove={onRemove} />);
    expect(screen.getByLabelText('Running 2 duration')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Remove Running 2'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('has no distance for yoga and mobility', async () => {
    await render(<SetRow kind="mindbody" exerciseName="Vinyasa" set={entry} unit="lb" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Vinyasa duration')).toBeTruthy();
    expect(screen.queryByLabelText('Vinyasa distance')).toBeNull();
  });
});

describe('SetRow weight in the other unit', () => {
  it('switches one set to kg, keeping the typed number', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={{ ...set, weight: 20 }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    const toggle = screen.getByLabelText('Weight unit for set 2');
    expect(toggle.props.accessibilityValue).toEqual({ text: 'lb' });
    await fireEvent.press(toggle);
    expect(onChange).toHaveBeenCalledWith({ weightUnit: 'kg', weight: expect.closeTo(44.0925, 4) });
  });

  it('uses what is being typed when switching', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={set} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Weight for set 2'), '60');
    await fireEvent.press(screen.getByLabelText('Weight unit for set 2'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ weightUnit: 'kg', weight: expect.closeTo(132.277, 3) });
  });

  it('shows and edits a kg set in kg while the setting is lb', async () => {
    const onChange = jest.fn();
    const kgSet = { ...set, weight: 20 * 2.20462262185, weightUnit: 'kg' as const };
    await render(<SetRow kind="strength" set={kgSet} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    const input = screen.getByLabelText('Weight for set 2');
    expect(input.props.value).toBe('20');
    expect(screen.getByLabelText('Weight unit for set 2').props.accessibilityValue).toEqual({ text: 'kg' });
    await fireEvent.changeText(input, '22.5');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith({ weight: expect.closeTo(49.604, 3) });
  });

  it('switches back to lb', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" set={{ ...set, weightUnit: 'kg' }} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Weight unit for set 2'));
    expect(onChange).toHaveBeenCalledWith({ weightUnit: 'lb', weight: null });
  });
});

describe('SetRow for exercises that record something else', () => {
  const entry = { ...set, setNumber: 1, targetReps: null };

  it('logs a weighted hold as weight and time, with no reps', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" fields={['weight', 'duration']} set={set} targetDurationMin={1} unit="lb" onChange={onChange} onRemove={jest.fn()} />);
    expect(screen.queryByLabelText('Reps for set 2')).toBeNull();
    expect(screen.getByLabelText('Weight for set 2')).toBeTruthy();
    const time = screen.getByLabelText('Time for set 2');
    expect(time.props.accessibilityValue).toEqual({ text: 'Not logged, target 1 min' });
    await fireEvent.press(time);
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ durationMin: 1 });
  });

  it('heads the columns with what the lift records', async () => {
    await render(<SetHeader fields={['weight', 'duration']} />);
    expect(screen.getByText('Weight', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Time', { includeHiddenElements: true })).toBeTruthy();
  });


  it('types a carry distance in yards or meters, stored as miles', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="strength" fields={['weight', 'shortDistance']} set={set} unit="lb" distanceUnit="km" onChange={onChange} onRemove={jest.fn()} />);
    const input = screen.getByLabelText('Distance for set 2');
    await fireEvent.changeText(input, '40');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith({ distance: expect.closeTo(40 / 1609.344, 9) });
    expect(screen.getByLabelText('Distance unit for set 2').props.accessibilityValue).toEqual({ text: 'm' });
  });

  it('switches a short distance between yards and meters, keeping the typed number', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" fields={['duration', 'shortDistance']} exerciseName="Swimming" set={entry} unit="lb" distanceUnit="mi" onChange={onChange} />);
    await fireEvent.changeText(screen.getByLabelText('Swimming distance'), '500');
    await fireEvent.press(screen.getByLabelText('Swimming distance unit'));
    expect(onChange).toHaveBeenCalledWith({ distanceUnit: 'km', distance: expect.closeTo(500 / 1609.344, 9) });
  });

  it('logs steps as a whole number', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" fields={['duration', 'distance', 'steps']} exerciseName="Walking" set={entry} unit="lb" onChange={onChange} />);
    const steps = screen.getByLabelText('Walking steps');
    await fireEvent.changeText(steps, '8500.6');
    await fireEvent(steps, 'blur');
    expect(onChange).toHaveBeenCalledWith({ count: 8501 });
    expect(screen.getByText('steps')).toBeTruthy();
  });

  it('shows the elevation unit of the distance beside it, switched with the distance', async () => {
    await render(
      <SetRow kind="cardio" fields={['duration', 'distance', 'elevation']} exerciseName="Hiking" set={{ ...entry, elevation: 1000 }} unit="lb" distanceUnit="km" onChange={jest.fn()} />,
    );
    expect(screen.getByLabelText('Hiking elevation').props.value).toBe('304.8');
    expect(screen.getByText('m')).toBeTruthy();
    expect(screen.queryByLabelText('Hiking elevation unit')).toBeNull();
  });

  it('can switch elevation units itself when there is no distance', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" fields={['duration', 'elevation', 'runs']} exerciseName="Downhill Skiing" set={entry} unit="lb" distanceUnit="mi" onChange={onChange} />);
    await fireEvent.changeText(screen.getByLabelText('Downhill Skiing elevation'), '600');
    await fireEvent.press(screen.getByLabelText('Downhill Skiing elevation unit'));
    expect(onChange).toHaveBeenCalledWith({ distanceUnit: 'km', elevation: expect.closeTo(600 / 0.3048, 6) });
  });

  it('rates difficulty from 1 to 10 on a wheel', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" fields={['duration', 'routes', 'difficulty']} exerciseName="Climbing" set={entry} unit="lb" onChange={onChange} />);
    const field = screen.getByLabelText('Climbing difficulty');
    expect(field.props.accessibilityValue).toEqual({ text: 'Not logged' });
    await fireEvent.press(field);
    const wheel = within(screen.getByLabelText('Difficulty'));
    expect(wheel.queryByText('0')).toBeNull();
    expect(wheel.getByText('10')).toBeTruthy();
    await fireEvent.press(wheel.getByText('7'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ difficulty: 7 });
  });

  it('counts routes climbed', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" fields={['duration', 'routes', 'difficulty']} exerciseName="Climbing" set={entry} unit="lb" onChange={onChange} />);
    await fireEvent.changeText(screen.getByLabelText('Climbing routes'), '9');
    await fireEvent(screen.getByLabelText('Climbing routes'), 'blur');
    expect(onChange).toHaveBeenCalledWith({ count: 9 });
  });

  it('logs a golf score', async () => {
    const onChange = jest.fn();
    await render(<SetRow kind="cardio" fields={['duration', 'holes', 'score']} exerciseName="Golf" set={entry} unit="lb" onChange={onChange} />);
    await fireEvent.changeText(screen.getByLabelText('Golf score'), '84');
    await fireEvent(screen.getByLabelText('Golf score'), 'blur');
    expect(onChange).toHaveBeenCalledWith({ score: 84 });
    expect(screen.getByLabelText('Golf holes')).toBeTruthy();
  });
});
