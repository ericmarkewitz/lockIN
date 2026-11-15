import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Keyboard, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FORM_TIPS } from '@/data/formTips';
import { setPlanDay } from '@/data/plan';
import { setRestSeconds, setWeightUnit } from '@/data/settings';
import { ensureWorkout, getWorkout, updateSet } from '@/data/workouts';
import { findByName } from '@/test/helpers';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { WorkoutMode } from '../WorkoutMode';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));

const MON = '2026-11-02';

async function setup() {
  const db = await createTestDb();
  const bench = await findByName(db, 'Bench Press');
  const squat = await findByName(db, 'Squat');
  await setPlanDay(db, 1, {
    isRest: false,
    items: [{ exerciseId: bench, targetSets: 2, targetReps: 10 }, { exerciseId: squat, targetSets: 1, targetReps: 5 }],
  });
  return db;
}

const open = async (db: Awaited<ReturnType<typeof createTestDb>>) => {
  await renderWithDb(<WorkoutMode date={MON} />, db);
  await screen.findByText('Set 1 of 2');
};
const sets = async (db: Awaited<ReturnType<typeof createTestDb>>) => (await getWorkout(db, MON))!.exercises.flatMap((e) => e.sets);

describe('WorkoutMode', () => {
  beforeEach(() => mockBack.mockClear());

  it('opens on the first set with the target reps filled in', async () => {
    const db = await setup();
    await open(db);
    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.getByText('Exercise 1 of 2')).toBeTruthy();
    expect(screen.getByLabelText('Weight').props.value).toBe('');
    expect(screen.getByLabelText('Reps').props.value).toBe('10');
    expect(screen.getByLabelText('0 of 3 sets done')).toBeTruthy();
    expect(screen.getByLabelText('Next: Squat')).toBeTruthy();
  });

  it('shows the stick figure for a built-in exercise', async () => {
    await open(await setup());
    expect(screen.getByTestId('motion-Bench Press', { includeHiddenElements: true })).toBeTruthy();
  });

  it('logs the set on Done and moves on with the same weight', async () => {
    const db = await setup();
    await setRestSeconds(db, 0);
    await open(db);
    await fireEvent.changeText(screen.getByLabelText('Weight'), '135');
    await fireEvent.press(screen.getByLabelText('Done with set 1'));
    expect(await screen.findByText('Set 2 of 2')).toBeTruthy();
    expect((await sets(db))[0]).toMatchObject({ weight: 135, reps: 10, completed: true });
    expect(screen.getByLabelText('Weight').props.value).toBe('135');
    expect(screen.getByLabelText('1 of 3 sets done')).toBeTruthy();
  });

  it('logs fewer reps when you did fewer', async () => {
    const db = await setup();
    await setRestSeconds(db, 0);
    await open(db);
    await fireEvent.press(screen.getByLabelText('Fewer reps'));
    await fireEvent.press(screen.getByLabelText('Fewer reps'));
    await fireEvent.press(screen.getByLabelText('Done with set 1'));
    await screen.findByText('Set 2 of 2');
    expect((await sets(db))[0]).toMatchObject({ reps: 8, completed: true });
  });

  it('steps the weight by 5 lb, or 2.5 kg', async () => {
    const db = await setup();
    await open(db);
    await fireEvent.press(screen.getByLabelText('More weight'));
    await fireEvent.press(screen.getByLabelText('More weight'));
    expect(screen.getByLabelText('Weight').props.value).toBe('10');
    await fireEvent.press(screen.getByLabelText('Less weight'));
    expect(screen.getByLabelText('Weight').props.value).toBe('5');
    await fireEvent.press(screen.getByLabelText('Weight unit'));
    expect(screen.getByText('kg')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('More weight'));
    expect(screen.getByLabelText('Weight').props.value).toBe('7.5');
  });

  it('stores a kg entry in pounds, in the unit it was entered', async () => {
    const db = await setup();
    await setRestSeconds(db, 0);
    await setWeightUnit(db, 'kg');
    await open(db);
    await fireEvent.changeText(screen.getByLabelText('Weight'), '60');
    await fireEvent.press(screen.getByLabelText('Done with set 1'));
    await screen.findByText('Set 2 of 2');
    const s = (await sets(db))[0];
    expect(s.weight).toBeCloseTo(132.28, 1);
    expect(screen.getByLabelText('Weight').props.value).toBe('60');
  });

  it('suggests the weight from last time', async () => {
    const db = await setup();
    const prev = await ensureWorkout(db, '2026-10-26');
    await updateSet(db, prev.exercises[0].sets[0].id, { weight: 125, reps: 10, completed: true });
    await open(db);
    expect(screen.getByLabelText('Weight').props.value).toBe('125');
    expect(screen.getByText('Last time: 125×10')).toBeTruthy();
  });

  it('skips a set without logging it', async () => {
    const db = await setup();
    await open(db);
    await fireEvent.press(screen.getByLabelText('Skip set 1'));
    expect(await screen.findByText('Set 2 of 2')).toBeTruthy();
    expect((await sets(db))[0]).toMatchObject({ completed: false, weight: null, reps: null });
  });

  it('moves to the next exercise after its last set', async () => {
    const db = await setup();
    await setRestSeconds(db, 0);
    await open(db);
    await fireEvent.press(screen.getByLabelText('Done with set 1'));
    await fireEvent.press(await screen.findByLabelText('Done with set 2'));
    expect(await screen.findByText('Squat')).toBeTruthy();
    expect(screen.getByText('Exercise 2 of 2')).toBeTruthy();
    expect(screen.getByText('Set 1 of 1')).toBeTruthy();
    expect(screen.getByLabelText('Reps').props.value).toBe('5');
    expect(screen.queryByLabelText(/^Next:/)).toBeNull();
  });

  it('resumes at the first set not done', async () => {
    const db = await setup();
    const w = await ensureWorkout(db, MON);
    await updateSet(db, w.exercises[0].sets[0].id, { weight: 135, reps: 10, completed: true });
    await renderWithDb(<WorkoutMode date={MON} />, db);
    expect(await screen.findByText('Set 2 of 2')).toBeTruthy();
  });

  it('goes back to a finished set to fix it, keeping it done', async () => {
    const db = await setup();
    await setRestSeconds(db, 0);
    await open(db);
    await fireEvent.changeText(screen.getByLabelText('Weight'), '135');
    await fireEvent.press(screen.getByLabelText('Done with set 1'));
    await fireEvent.press(await screen.findByLabelText('Previous set'));
    expect(await screen.findByText('Set 1 of 2')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Weight'), '130');
    await fireEvent.press(screen.getByLabelText('Save set 1'));
    expect(await screen.findByText('Set 2 of 2')).toBeTruthy();
    expect((await sets(db))[0]).toMatchObject({ weight: 130, completed: true });
  });

  describe('rest timer', () => {
    it('starts after a set when another follows', async () => {
      const db = await setup();
      await open(db);
      await fireEvent.press(screen.getByLabelText('Done with set 1'));
      expect(await screen.findByLabelText('Rest, 1:30 left')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Skip rest'));
      expect(screen.queryByLabelText(/^Rest,/)).toBeNull();
    });

    it('takes the place of the set until it is over', async () => {
      const db = await setup();
      await open(db);
      await fireEvent.changeText(screen.getByLabelText('Weight'), '135');
      await fireEvent.press(screen.getByLabelText('Done with set 1'));
      await screen.findByLabelText('Rest, 1:30 left');
      expect(screen.queryByLabelText('Weight')).toBeNull();
      expect(screen.queryByLabelText('Done with set 2')).toBeNull();
      expect(screen.queryByLabelText('Skip set 2')).toBeNull();
      expect(screen.getByText('Up next: Set 2 of 2 · 135 lb × 10')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Skip rest'));
      expect(screen.getByLabelText('Weight').props.value).toBe('135');
      expect(screen.getByLabelText('Done with set 2')).toBeTruthy();
    });

    it('names the next exercise when resting between lifts', async () => {
      const db = await setup();
      await open(db);
      await fireEvent.press(screen.getByLabelText('Done with set 1'));
      await fireEvent.press(await screen.findByLabelText('Skip rest'));
      await fireEvent.press(screen.getByLabelText('Done with set 2'));
      await screen.findByLabelText('Rest, 1:30 left');
      expect(screen.getByText('Up next: Squat · Set 1 of 1 · 5 reps')).toBeTruthy();
    });

    it('uses the rest from settings, and none when it is off', async () => {
      const db = await setup();
      await setRestSeconds(db, 0);
      await open(db);
      await fireEvent.press(screen.getByLabelText('Done with set 1'));
      await screen.findByText('Set 2 of 2');
      expect(screen.queryByLabelText(/^Rest,/)).toBeNull();
    });

    it('does not start after a skipped set', async () => {
      const db = await setup();
      await open(db);
      await fireEvent.press(screen.getByLabelText('Skip set 1'));
      await screen.findByText('Set 2 of 2');
      expect(screen.queryByLabelText(/^Rest,/)).toBeNull();
    });
  });

  describe('finishing', () => {
    it('celebrates a finished workout and returns to the day', async () => {
      const db = await setup();
      await setRestSeconds(db, 0);
      await open(db);
      await fireEvent.changeText(screen.getByLabelText('Weight'), '100');
      await fireEvent.press(screen.getByLabelText('Done with set 1'));
      await fireEvent.press(await screen.findByLabelText('Done with set 2'));
      await fireEvent.press(await screen.findByLabelText('Done with set 1'));
      expect(await screen.findByText('Workout complete')).toBeTruthy();
      expect(screen.getByLabelText('Sets: 3/3')).toBeTruthy();
      expect(screen.getByLabelText('Volume (lb): 2,000')).toBeTruthy();
      expect(screen.getByLabelText('Exercises: 2')).toBeTruthy();
      expect(screen.queryByLabelText(/^Rest,/)).toBeNull();
      await fireEvent.press(screen.getByLabelText('Finish workout'));
      expect(mockBack).toHaveBeenCalled();
    });

    it('offers to go back to skipped sets', async () => {
      const db = await setup();
      await setRestSeconds(db, 0);
      await open(db);
      await fireEvent.press(screen.getByLabelText('Skip set 1'));
      await fireEvent.press(await screen.findByLabelText('Done with set 2'));
      await fireEvent.press(await screen.findByLabelText('Done with set 1'));
      expect(await screen.findByText('1 set not done')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Go to skipped sets'));
      expect(await screen.findByText('Set 1 of 2')).toBeTruthy();
      expect(screen.getByText('Bench Press')).toBeTruthy();
    });

    it('saves workout notes', async () => {
      const db = await setup();
      const w = await ensureWorkout(db, MON);
      for (const e of w.exercises) for (const s of e.sets) await updateSet(db, s.id, { completed: true });
      await renderWithDb(<WorkoutMode date={MON} />, db);
      const notes = await screen.findByLabelText('Workout notes');
      await fireEvent(notes, 'endEditing', { nativeEvent: { text: 'Felt strong' } });
      await waitFor(async () => expect((await getWorkout(db, MON))!.notes).toBe('Felt strong'));
    });
  });

  it('fills the screen edge to edge, keeping clear of the status bar and home indicator', async () => {
    const db = await setup();
    const metrics = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } };
    await renderWithDb(<SafeAreaProvider initialMetrics={metrics}><WorkoutMode date={MON} /></SafeAreaProvider>, db);
    await screen.findByText('Set 1 of 2');
    const style = StyleSheet.flatten(screen.getByTestId('workout-screen').props.style);
    expect(style).toMatchObject({ paddingTop: 59 + 8, paddingBottom: 34 + 8 });
    // The card is the screen: nothing between it and the sides but its own padding.
    expect(style.marginHorizontal ?? 0).toBe(0);
    expect(style.borderRadius ?? 0).toBe(0);
  });

  it('ends workout mode from the top of the card', async () => {
    await open(await setup());
    await fireEvent.press(screen.getByLabelText('End workout'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('puts the keyboard away when you tap the picture', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    await open(await setup());
    await fireEvent.press(screen.getByTestId('exercise-picture'));
    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });

  it('hides the form tips button for an exercise without tips', async () => {
    await open(await setup());
    expect(screen.queryByLabelText('Form tips')).toBeNull();
  });

  it('shows form tips on request', async () => {
    FORM_TIPS['Bench Press'] = ['Pinch your shoulder blades together.'];
    try {
      await open(await setup());
      expect(screen.queryByText(/shoulder blades/i)).toBeNull();
      await fireEvent.press(screen.getByLabelText('Form tips'));
      expect(screen.getByText(/shoulder blades/i)).toBeTruthy();
      expect(screen.getByLabelText('Form tips').props.accessibilityState).toMatchObject({ expanded: true });
      await fireEvent.press(screen.getByLabelText('Close form tips'));
      expect(screen.queryByText(/shoulder blades/i)).toBeNull();
      // The set is still there to log.
      expect(screen.getByLabelText('Done with set 1')).toBeTruthy();
    } finally {
      delete FORM_TIPS['Bench Press'];
    }
  });

  it('logs cardio as one entry with the planned time', async () => {
    const db = await createTestDb();
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDurationMin: 30, targetDistance: 3 }] });
    await renderWithDb(<WorkoutMode date={MON} />, db);
    expect(await screen.findByText('Running')).toBeTruthy();
    expect(screen.queryByLabelText('Reps')).toBeNull();
    expect(screen.queryByText(/^Set /)).toBeNull();
    expect(screen.getByLabelText('Distance').props.value).toBe('3');
    await fireEvent.press(screen.getByLabelText('Done with Running'));
    expect(await screen.findByText('Workout complete')).toBeTruthy();
    expect(screen.queryByLabelText(/^Volume/)).toBeNull();
    expect((await sets(db))[0]).toMatchObject({ durationMin: 30, distance: 3, completed: true });
  });

  it('has nothing to do on an empty day', async () => {
    await renderWithDb(<WorkoutMode date={MON} />, await createTestDb());
    expect(await screen.findByText('Nothing planned')).toBeTruthy();
  });
});
