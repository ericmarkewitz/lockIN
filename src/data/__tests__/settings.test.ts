import { createTestDb } from '@/test/testDb';
import { findByName } from '@/test/helpers';
import { setPlanDay } from '../plan';
import { getWeightUnit, setWeightUnit } from '../settings';
import { ensureWorkout, getWorkout, updateSet } from '../workouts';

describe('weight unit setting', () => {
  it('defaults to lb', async () => {
    expect(await getWeightUnit(await createTestDb())).toBe('lb');
  });

  it('persists a change to kg and back', async () => {
    const db = await createTestDb();
    await setWeightUnit(db, 'kg');
    expect(await getWeightUnit(db)).toBe('kg');
    await setWeightUnit(db, 'lb');
    expect(await getWeightUnit(db)).toBe('lb');
  });

  it('rejects an unknown unit', async () => {
    const db = await createTestDb();
    await expect(setWeightUnit(db, 'stone' as never)).rejects.toThrow('Unsupported weight unit');
    expect(await getWeightUnit(db)).toBe('lb');
  });

  it('falls back to lb if the stored value is invalid', async () => {
    const db = await createTestDb();
    await db.runAsync("UPDATE settings SET value = 'oz' WHERE key = 'weight_unit'");
    expect(await getWeightUnit(db)).toBe('lb');
  });

  it('does not rewrite logged weights', async () => {
    const db = await createTestDb();
    const bench = await findByName(db, 'Bench Press');
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: bench, targetSets: 1, targetReps: 5 }] });
    const w = await ensureWorkout(db, '2026-11-02');
    await updateSet(db, w.exercises[0].sets[0].id, { weight: 135 });
    await setWeightUnit(db, 'kg');
    expect((await getWorkout(db, '2026-11-02'))!.exercises[0].sets[0].weight).toBe(135);
  });
});
