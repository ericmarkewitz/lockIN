import { useEffect } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { setDistanceUnit, setWeightUnit } from '@/data/settings';
import { setPlanDay } from '@/data/plan';
import { addExercise, listCategoriesWithExercises } from '@/data/exercises';
import { addExerciseToWorkout, getWorkout, setRestDay, updateSet, ensureWorkout } from '@/data/workouts';
import { findByName } from '@/test/helpers';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { WorkoutView } from '../WorkoutView';

const mockPush = jest.fn();
/** Call to simulate the screen regaining focus, e.g. returning from workout mode. */
const mockFocus = { current: () => {} };
function useMockFocusEffect(cb: () => void) {
  // Runs once on mount, like a screen gaining focus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cb, []);
}
const mockUseFocusEffect = useMockFocusEffect;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => {
    mockFocus.current = cb;
    mockUseFocusEffect(cb);
  },
}));

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

describe('WorkoutView', () => {
  it('labels weights with the selected unit', async () => {
    const db = await setup();
    await setWeightUnit(db, 'kg');
    await renderWithDb(<WorkoutView date={MON} />, db);
    await screen.findByText('Bench Press');
    expect(screen.getAllByText('kg').length).toBeGreaterThan(0);
    expect(screen.queryByText('lb')).toBeNull();
  });

  it('shows last performance in the selected unit', async () => {
    const db = await setup();
    await setWeightUnit(db, 'kg');
    const prev = await ensureWorkout(db, '2026-10-26');
    await updateSet(db, prev.exercises[0].sets[0].id, { weight: 135, reps: 10, completed: true });
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByText('Last (2026-10-26): 61.23×10')).toBeTruthy();
  });

  it('shows stored pounds in kilograms and stores kg entries as pounds', async () => {
    const db = await setup();
    await setWeightUnit(db, 'kg');
    const w = await ensureWorkout(db, MON);
    await updateSet(db, w.exercises[0].sets[0].id, { weight: 135 });
    await renderWithDb(<WorkoutView date={MON} />, db);
    const [first, second] = await screen.findAllByLabelText(/Weight for set/);
    expect(first.props.value).toBe('61.23');
    await fireEvent.changeText(second, '100');
    await fireEvent(second, 'blur');
    await waitFor(async () => {
      const sets = (await getWorkout(db, MON))!.exercises[0].sets;
      expect(sets[1].weight).toBeCloseTo(220.462262185, 6);
      expect(sets[0].weight).toBe(135); // untouched
    });
  });

  it('summarises the day by exercises done, counting one only once all its sets are', async () => {
    const db = await setup();
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByLabelText('0 of 2 exercises done')).toBeTruthy();
    expect(screen.getByText('exercises done')).toBeTruthy();
    expect(within(screen.getByTestId('exercise-Bench Press')).getByText('0/2')).toBeTruthy();
    // One of Bench Press's two sets: the set count moves, the exercise count doesn't.
    await fireEvent.press(screen.getAllByLabelText('Mark set 1 done')[0]);
    expect(await within(screen.getByTestId('exercise-Bench Press')).findByText('1/2')).toBeTruthy();
    expect(screen.getByLabelText('0 of 2 exercises done')).toBeTruthy();
    // Squat's only set finishes Squat.
    await fireEvent.press(within(screen.getByTestId('exercise-Squat')).getByLabelText('Mark set 1 done'));
    expect(await screen.findByLabelText('1 of 2 exercises done')).toBeTruthy();
  });

  it('calls the workout done once every exercise is', async () => {
    const db = await setup();
    const w = await ensureWorkout(db, MON);
    for (const e of w.exercises) for (const s of e.sets) await updateSet(db, s.id, { completed: true });
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByLabelText('2 of 2 exercises done')).toBeTruthy();
    expect(screen.getByText('Workout complete')).toBeTruthy();
  });

  it('shows the full plan with a row per set', async () => {
    const db = await setup();
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByText('Bench Press')).toBeTruthy();
    expect(screen.getByText('Squat')).toBeTruthy();
    expect(screen.getByLabelText('Weight for set 2')).toBeTruthy();
  });

  it('shows the muscle group of a lift next to its category', async () => {
    const db = await setup();
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByText('Lifts · Chest · 2×10')).toBeTruthy();
    expect(screen.getByText('Lifts · Legs · 1×5')).toBeTruthy();
  });

  it('shows the stick figure for built-in exercises', async () => {
    const db = await setup();
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByTestId('motion-Bench Press', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('motion-Squat', { includeHiddenElements: true })).toBeTruthy();
  });

  it('leaves the muscle group out for exercises without one', async () => {
    const db = await createTestDb();
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDurationMin: 30 }] });
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByText('Cardio · 30 min')).toBeTruthy();
  });

  it('formats target and last durations that include seconds', async () => {
    const db = await createTestDb();
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDurationMin: 1 + 20 / 60 }] });
    const prev = await ensureWorkout(db, '2026-10-26');
    await updateSet(db, prev.exercises[0].sets[0].id, { durationMin: 65.5, distance: 3 });
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByText('Cardio · 1m 20s')).toBeTruthy();
    expect(screen.getByText('Last (2026-10-26): 1h 5m 30s 3 mi')).toBeTruthy();
  });

  it('shows target and last distances in the selected unit', async () => {
    const db = await createTestDb();
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDurationMin: 30, targetDistance: 3.1 }] });
    const prev = await ensureWorkout(db, '2026-10-26');
    await updateSet(db, prev.exercises[0].sets[0].id, { durationMin: 30, distance: 3.2 });
    await setDistanceUnit(db, 'km');
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByText('Cardio · 30 min · 4.99 km')).toBeTruthy();
    expect(screen.getByText('Last (2026-10-26): 30 min 5.15 km')).toBeTruthy();
    expect(screen.getByLabelText('Running distance unit').props.accessibilityValue).toEqual({ text: 'km' });
  });

  it('logs a set in kg while the setting is lb', async () => {
    const db = await setup();
    await renderWithDb(<WorkoutView date={MON} />, db);
    await fireEvent.press((await screen.findAllByLabelText('Weight unit for set 1'))[0]);
    await waitFor(() => expect(screen.getAllByLabelText('Weight unit for set 1')[0].props.accessibilityValue).toEqual({ text: 'kg' }));
    const input = screen.getAllByLabelText('Weight for set 1')[0];
    await fireEvent.changeText(input, '20');
    await fireEvent(input, 'blur');
    await waitFor(async () => {
      const [first, second] = (await getWorkout(db, MON))!.exercises[0].sets;
      expect(first.weightUnit).toBe('kg');
      expect(first.weight).toBeCloseTo(44.0925, 4);
      expect(second.weightUnit).toBeNull();
    });
  });

  it('shows a set logged in kg in the selected unit in last performance', async () => {
    const db = await setup();
    const prev = await ensureWorkout(db, '2026-10-26');
    await updateSet(db, prev.exercises[0].sets[0].id, { weight: 20 * 2.20462262185, weightUnit: 'kg', reps: 10, completed: true });
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByText('Last (2026-10-26): 44.09×10')).toBeTruthy();
  });

  describe('cardio, yoga and mobility', () => {
    async function mixed() {
      const db = await createTestDb();
      await setPlanDay(db, 1, {
        isRest: false,
        items: [
          { exerciseId: await findByName(db, 'Bench Press'), targetSets: 2, targetReps: 10 },
          { exerciseId: await findByName(db, 'Running'), targetDurationMin: 30 },
          { exerciseId: await findByName(db, 'Vinyasa'), targetDurationMin: 45 },
        ],
      });
      await renderWithDb(<WorkoutView date={MON} />, db);
      await screen.findByLabelText('Running duration');
      return db;
    }

    it('log one entry with no sets to add, count or number', async () => {
      await mixed();
      expect(screen.getByLabelText('Add set to Bench Press')).toBeTruthy();
      expect(screen.queryByLabelText('Add set to Running')).toBeNull();
      expect(screen.queryByLabelText('Add set to Vinyasa')).toBeNull();
      expect(within(screen.getByTestId('exercise-Bench Press')).getByText('0/2')).toBeTruthy();
      expect(within(screen.getByTestId('exercise-Running')).queryByText('0/1')).toBeNull();
      expect(within(screen.getByTestId('exercise-Running')).queryByText('Set')).toBeNull();
      expect(screen.queryByLabelText('Vinyasa distance')).toBeNull();
    });

    it('count as one exercise in the day progress', async () => {
      await mixed();
      expect(screen.getByLabelText('0 of 3 exercises done')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Mark Running done'));
      expect(await screen.findByLabelText('1 of 3 exercises done')).toBeTruthy();
    });

    it('do not talk about sets when removing the exercise', async () => {
      const db = await mixed();
      const w = (await getWorkout(db, MON))!;
      await updateSet(db, w.exercises[1].sets[0].id, { durationMin: 30 });
      await fireEvent.press(screen.getByLabelText('Mark Vinyasa done'));
      await fireEvent.press(await screen.findByLabelText('Remove Vinyasa'));
      expect(screen.getByText("What you logged will be deleted. This can't be undone.")).toBeTruthy();
    });
  });

  it('logs the planned duration from the wheel', async () => {
    const db = await createTestDb();
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDurationMin: 30 }] });
    await renderWithDb(<WorkoutView date={MON} />, db);
    await fireEvent.press(await screen.findByLabelText('Running duration'));
    await fireEvent.press(screen.getByLabelText('Done'));
    await waitFor(async () => expect((await getWorkout(db, MON))!.exercises[0].sets[0].durationMin).toBe(30));
  });

  it('persists a logged weight and completion', async () => {
    const db = await setup();
    await renderWithDb(<WorkoutView date={MON} />, db);
    const input = (await screen.findAllByLabelText('Weight for set 1'))[0];
    await fireEvent.changeText(input, '135');
    await fireEvent(input, 'blur');
    await waitFor(async () => expect((await getWorkout(db, MON))!.exercises[0].sets[0].weight).toBe(135));
    await fireEvent.press(screen.getAllByLabelText('Mark set 1 done')[0]);
    await waitFor(async () => expect((await getWorkout(db, MON))!.exercises[0].sets[0].completed).toBe(true));
  });

  it('adds a set and removes an exercise', async () => {
    const db = await setup();
    await renderWithDb(<WorkoutView date={MON} />, db);
    await fireEvent.press(await screen.findByLabelText('Add set to Squat'));
    await waitFor(async () => expect((await getWorkout(db, MON))!.exercises[1].sets).toHaveLength(2));
    await fireEvent.press(screen.getByLabelText('Remove Squat'));
    await waitFor(() => expect(screen.queryByText('Squat')).toBeNull());
  });

  describe('removing', () => {
    const benchSets = async (db: Awaited<ReturnType<typeof setup>>) => (await getWorkout(db, MON))!.exercises[0].sets;

    it('removes an empty set in one tap', async () => {
      const db = await setup();
      await renderWithDb(<WorkoutView date={MON} />, db);
      await fireEvent.press((await screen.findAllByLabelText('Remove set 2'))[0]);
      expect(screen.queryByText('Remove set 2?')).toBeNull();
      await waitFor(async () => expect(await benchSets(db)).toHaveLength(1));
    });

    it('keeps a logged set until the removal is confirmed', async () => {
      const db = await setup();
      const w = await ensureWorkout(db, MON);
      await updateSet(db, w.exercises[0].sets[0].id, { weight: 135, reps: 10 });
      await renderWithDb(<WorkoutView date={MON} />, db);
      await fireEvent.press((await screen.findAllByLabelText('Remove set 1'))[0]);
      expect(screen.getByText('Remove set 1?')).toBeTruthy();
      expect(await benchSets(db)).toHaveLength(2);
      await fireEvent.press(screen.getByLabelText('Remove'));
      await waitFor(async () => expect(await benchSets(db)).toHaveLength(1));
      expect(screen.queryByText('Remove set 1?')).toBeNull();
      expect((await benchSets(db))[0].weight).toBeNull();
    });

    it('keeps a logged set when the removal is cancelled', async () => {
      const db = await setup();
      const w = await ensureWorkout(db, MON);
      await updateSet(db, w.exercises[0].sets[0].id, { weight: 135 });
      await renderWithDb(<WorkoutView date={MON} />, db);
      await fireEvent.press((await screen.findAllByLabelText('Remove set 1'))[0]);
      await fireEvent.press(screen.getByLabelText('Cancel'));
      expect(screen.queryByText('Remove set 1?')).toBeNull();
      expect(await benchSets(db)).toHaveLength(2);
    });

    it('asks before removing a set that was only ticked off', async () => {
      const db = await setup();
      const w = await ensureWorkout(db, MON);
      await updateSet(db, w.exercises[0].sets[0].id, { completed: true });
      await renderWithDb(<WorkoutView date={MON} />, db);
      await fireEvent.press((await screen.findAllByLabelText('Remove set 1'))[0]);
      expect(screen.getByText('Remove set 1?')).toBeTruthy();
    });

    it('asks once a set is logged during the session', async () => {
      const db = await setup();
      await renderWithDb(<WorkoutView date={MON} />, db);
      await fireEvent.press((await screen.findAllByLabelText('Mark set 1 done'))[0]);
      await waitFor(async () => expect((await benchSets(db))[0].completed).toBe(true));
      await screen.findAllByLabelText('Mark set 1 not done');
      await fireEvent.press(screen.getAllByLabelText('Remove set 1')[0]);
      expect(screen.getByText('Remove set 1?')).toBeTruthy();
    });

    it('removes an exercise with nothing logged in one tap', async () => {
      const db = await setup();
      await renderWithDb(<WorkoutView date={MON} />, db);
      await fireEvent.press(await screen.findByLabelText('Remove Squat'));
      expect(screen.queryByText('Remove Squat?')).toBeNull();
      await waitFor(() => expect(screen.queryByText('Squat')).toBeNull());
    });

    it('keeps an exercise with logged sets until the removal is confirmed', async () => {
      const db = await setup();
      const w = await ensureWorkout(db, MON);
      await updateSet(db, w.exercises[0].sets[1].id, { reps: 8 });
      await renderWithDb(<WorkoutView date={MON} />, db);
      await fireEvent.press(await screen.findByLabelText('Remove Bench Press'));
      expect(screen.getByText('Remove Bench Press?')).toBeTruthy();
      expect((await getWorkout(db, MON))!.exercises).toHaveLength(2);
      await fireEvent.press(screen.getByLabelText('Remove'));
      await waitFor(async () => expect((await getWorkout(db, MON))!.exercises.map((e) => e.exerciseName)).toEqual(['Squat']));
    });

    it('keeps an exercise with logged sets when the removal is cancelled', async () => {
      const db = await setup();
      const w = await ensureWorkout(db, MON);
      await updateSet(db, w.exercises[0].sets[0].id, { reps: 8 });
      await renderWithDb(<WorkoutView date={MON} />, db);
      await fireEvent.press(await screen.findByLabelText('Remove Bench Press'));
      await fireEvent.press(screen.getByLabelText('Cancel'));
      expect(screen.queryByText('Remove Bench Press?')).toBeNull();
      expect((await getWorkout(db, MON))!.exercises).toHaveLength(2);
    });
  });

  it('hints at the previous performance', async () => {
    const db = await setup();
    const prev = await ensureWorkout(db, '2026-10-26');
    await updateSet(db, prev.exercises[0].sets[0].id, { weight: 130, reps: 10, completed: true });
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByText('Last (2026-10-26): 130×10')).toBeTruthy();
  });

  it('rest day hides the exercises', async () => {
    const db = await setup();
    await renderWithDb(<WorkoutView date={MON} />, db);
    await fireEvent(await screen.findByLabelText('Rest day'), 'valueChange', true);
    expect(await screen.findByText(/Rest and recover/)).toBeTruthy();
    expect(screen.queryByText('Bench Press')).toBeNull();
  });

  it('keeps logged exercises visible on a rest day and hides the rest', async () => {
    const db = await setup();
    const w = await ensureWorkout(db, MON);
    await updateSet(db, w.exercises[0].sets[0].id, { weight: 135, reps: 10 });
    await renderWithDb(<WorkoutView date={MON} />, db);
    await fireEvent(await screen.findByLabelText('Rest day'), 'valueChange', true);
    expect(await screen.findByText(/Logged sets stay in your history/)).toBeTruthy();
    expect(screen.queryByText(/Rest and recover/)).toBeNull();
    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.queryByText('Squat')).toBeNull();
    expect(screen.queryByLabelText('Add exercise')).toBeNull();
  });

  it('brings every exercise back when the rest day is turned off', async () => {
    const db = await setup();
    const w = await ensureWorkout(db, MON);
    await updateSet(db, w.exercises[0].sets[0].id, { weight: 135, reps: 10 });
    await setRestDay(db, MON, true);
    await renderWithDb(<WorkoutView date={MON} />, db);
    await fireEvent(await screen.findByLabelText('Rest day'), 'valueChange', false);
    expect(await screen.findByText('Squat')).toBeTruthy();
    expect(screen.getByText('Bench Press')).toBeTruthy();
  });

  it('adds an exercise from the picker', async () => {
    const db = await setup();
    await renderWithDb(<WorkoutView date={MON} />, db);
    await fireEvent.press(await screen.findByLabelText('Add exercise'));
    await fireEvent.press(await screen.findByLabelText('Category Cardio'));
    await fireEvent.press(await screen.findByLabelText('Add Hiking'));
    expect(await screen.findByText('Hiking')).toBeTruthy();
    expect((await getWorkout(db, MON))!.exercises.map((e) => e.exerciseName)).toContain('Hiking');
  });

  it('shows a custom exercise by its new name after it is edited from the picker', async () => {
    const db = await setup();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    const ex = await addExercise(db, lifts.id, 'Rak Pull', 'Back');
    const w = await ensureWorkout(db, MON);
    await addExerciseToWorkout(db, w.id, ex.id, { targetSets: 1 });
    await renderWithDb(<WorkoutView date={MON} />, db);
    expect(await screen.findByText('Rak Pull')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Add exercise'));
    await fireEvent(await screen.findByLabelText('Add Rak Pull'), 'longPress');
    await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'Rack Pull');
    await fireEvent.press(screen.getByLabelText('Save exercise'));

    expect(await screen.findByTestId('exercise-Rack Pull')).toBeTruthy();
  });

  describe('workout mode', () => {
    beforeEach(() => mockPush.mockClear());

    it('starts workout mode for the day', async () => {
      const db = await setup();
      await renderWithDb(<WorkoutView date={MON} />, db);
      await fireEvent.press(await screen.findByLabelText('Start workout'));
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/workout/[date]', params: { date: MON } });
    });

    it('resumes once something is logged', async () => {
      const db = await setup();
      const w = await ensureWorkout(db, MON);
      await updateSet(db, w.exercises[0].sets[0].id, { completed: true });
      await renderWithDb(<WorkoutView date={MON} />, db);
      expect(await screen.findByLabelText('Resume workout')).toBeTruthy();
      expect(screen.queryByLabelText('Start workout')).toBeNull();
    });

    it('is not offered once everything is done, on a rest day or with nothing planned', async () => {
      const db = await setup();
      const w = await ensureWorkout(db, MON);
      for (const e of w.exercises) for (const x of e.sets) await updateSet(db, x.id, { completed: true });
      await renderWithDb(<WorkoutView date={MON} />, db);
      await screen.findByText('Workout complete');
      expect(screen.queryByLabelText(/(Start|Resume) workout/)).toBeNull();

      await setRestDay(db, '2026-11-09', true);
      await renderWithDb(<WorkoutView date="2026-11-09" />, db);
      await screen.findByText('Rest and recover. 😴');
      expect(screen.queryByLabelText(/(Start|Resume) workout/)).toBeNull();

      await renderWithDb(<WorkoutView date="2026-11-03" />, db);
      await screen.findByText('No exercises yet');
      expect(screen.queryByLabelText(/(Start|Resume) workout/)).toBeNull();
    });

    it('shows what workout mode logged on the way back', async () => {
      const db = await setup();
      await renderWithDb(<WorkoutView date={MON} />, db);
      await screen.findByLabelText('0 of 2 exercises done');
      const w = (await getWorkout(db, MON))!;
      await updateSet(db, w.exercises[1].sets[0].id, { completed: true });
      await act(async () => mockFocus.current());
      expect(await screen.findByLabelText('1 of 2 exercises done')).toBeTruthy();
    });

    it('no longer splits the day into full plan and current lift', async () => {
      const db = await setup();
      await renderWithDb(<WorkoutView date={MON} />, db);
      await screen.findByText('Bench Press');
      expect(screen.queryByLabelText('Current lift')).toBeNull();
      expect(screen.queryByLabelText('Full plan')).toBeNull();
      expect(screen.getByText('Squat')).toBeTruthy();
    });
  });
  describe('reordering', () => {
    const reorder = (label: string, actionName: 'moveUp' | 'moveDown') =>
      fireEvent(screen.getByLabelText(label), 'accessibilityAction', { nativeEvent: { actionName } });
    const names = async (db: Awaited<ReturnType<typeof setup>>) => (await getWorkout(db, MON))!.exercises.map((e) => e.exerciseName);
    const shown = () => screen.getAllByTestId(/^exercise-/).map((v) => v.props.testID);
    const openDay = async (db: Awaited<ReturnType<typeof setup>>) => {
      await renderWithDb(<WorkoutView date={MON} />, db);
      await screen.findByText('Bench Press');
    };

    it('puts the grab handle at the start of the card header, away from remove', async () => {
      const db = await setup();
      await openDay(db);
      const card = screen.getByTestId('exercise-Bench Press');
      const labels = within(card).queryAllByLabelText(/Bench Press$/).map((v) => v.props.accessibilityLabel);
      expect(labels.slice(0, 2)).toEqual(['Reorder Bench Press', 'Remove Bench Press']);
    });

    it('moves an exercise down and saves the new order for the day', async () => {
      const db = await setup();
      await openDay(db);
      await reorder('Reorder Bench Press', 'moveDown');
      await waitFor(async () => expect(await names(db)).toEqual(['Squat', 'Bench Press']));
      expect(shown()).toEqual(['exercise-Squat', 'exercise-Bench Press']);
    });

    it('moves an exercise up, and ignores moves past the ends', async () => {
      const db = await setup();
      await openDay(db);
      await reorder('Reorder Bench Press', 'moveUp');
      await reorder('Reorder Squat', 'moveUp');
      await waitFor(async () => expect(await names(db)).toEqual(['Squat', 'Bench Press']));
      await reorder('Reorder Bench Press', 'moveDown');
      expect(await names(db)).toEqual(['Squat', 'Bench Press']);
    });

    it('has nothing to reorder with a single exercise', async () => {
      const db = await createTestDb();
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Squat'), targetSets: 1, targetReps: 5 }] });
      await renderWithDb(<WorkoutView date={MON} />, db);
      await screen.findByText('Squat');
      expect(screen.queryByLabelText('Reorder Squat')).toBeNull();
    });
  });

  describe('exercises that record something else', () => {
    it('logs steps for a walk and shows its step target', async () => {
      const db = await createTestDb();
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Walking'), targetDurationMin: 45, targetCount: 8000 }] });
      await renderWithDb(<WorkoutView date={MON} />, db);
      expect(await screen.findByText('Cardio · 45 min · 8,000 steps')).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText('Walking steps'), '9200');
      await fireEvent(screen.getByLabelText('Walking steps'), 'blur');
      await waitFor(async () => expect((await getWorkout(db, MON))!.exercises[0].sets[0].count).toBe(9200));
    });

    it('logs a plank as weight and time per set, without reps', async () => {
      const db = await createTestDb();
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Weighted Plank'), targetSets: 2, targetDurationMin: 1 }] });
      await renderWithDb(<WorkoutView date={MON} />, db);
      expect(await screen.findByText('Lifts · Core · 2 sets · 1 min')).toBeTruthy();
      expect(screen.getByLabelText('Time for set 2')).toBeTruthy();
      expect(screen.queryByLabelText('Reps for set 1')).toBeNull();
      expect(screen.getAllByText('Time', { includeHiddenElements: true }).length).toBeGreaterThan(0);
    });

    it('shows last time in what the exercise records', async () => {
      const db = await createTestDb();
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Climbing') }] });
      const prev = await ensureWorkout(db, '2026-10-26');
      await updateSet(db, prev.exercises[0].sets[0].id, { durationMin: 90, count: 9, difficulty: 6 });
      await renderWithDb(<WorkoutView date={MON} />, db);
      expect(await screen.findByText('Last (2026-10-26): 1h 30m 9 routes Difficulty 6/10')).toBeTruthy();
      expect(screen.getByLabelText('Climbing routes')).toBeTruthy();
      expect(screen.getByLabelText('Climbing difficulty')).toBeTruthy();
    });

    it('plans sets but no reps for a lift added from the picker that has none', async () => {
      const db = await setup();
      await renderWithDb(<WorkoutView date={MON} />, db);
      await fireEvent.press(await screen.findByLabelText('Add exercise'));
      await fireEvent.press((await screen.findAllByLabelText('Add Weighted Plank'))[0]);
      await screen.findByText('Weighted Plank');
      const plank = (await getWorkout(db, MON))!.exercises.find((e) => e.exerciseName === 'Weighted Plank')!;
      expect(plank).toMatchObject({ targetSets: 3, targetReps: null });
      expect(plank.sets).toHaveLength(3);
    });
  });
});

