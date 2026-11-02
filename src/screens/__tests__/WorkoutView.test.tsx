import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { setWeightUnit } from '@/data/settings';
import { setPlanDay } from '@/data/plan';
import { getWorkout, updateSet, ensureWorkout } from '@/data/workouts';
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
