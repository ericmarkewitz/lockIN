import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { setWeightUnit } from '@/data/settings';
import { setPlanDay } from '@/data/plan';
import { getWorkout, setRestDay, updateSet, ensureWorkout } from '@/data/workouts';
import { findByName } from '@/test/helpers';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { WorkoutView } from '../WorkoutView';

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
    expect(screen.getByText('Last (2026-10-26): 1h 5m 30s 3')).toBeTruthy();
  });

  it('logs the planned duration from the wheel', async () => {
    const db = await createTestDb();
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDurationMin: 30 }] });
    await renderWithDb(<WorkoutView date={MON} />, db);
    await fireEvent.press(await screen.findByLabelText('Duration for set 1'));
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

  it('focus mode shows one lift at a time', async () => {
    const db = await setup();
    await renderWithDb(<WorkoutView date={MON} />, db);
    await fireEvent.press(await screen.findByLabelText('Current lift'));
    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.queryByText('Squat')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Next ›'));
    expect(screen.getByText('Squat')).toBeTruthy();
    expect(screen.queryByText('Bench Press')).toBeNull();
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
    expect(screen.queryByText('+ Add exercise')).toBeNull();
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
    await fireEvent.press(await screen.findByText('+ Add exercise'));
    await fireEvent.press(await screen.findByLabelText('Category Cardio'));
    await fireEvent.press(await screen.findByLabelText('Add Hiking'));
    expect(await screen.findByText('Hiking')).toBeTruthy();
    expect((await getWorkout(db, MON))!.exercises.map((e) => e.exerciseName)).toContain('Hiking');
  });
});
