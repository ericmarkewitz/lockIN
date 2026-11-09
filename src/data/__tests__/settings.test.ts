import { createTestDb } from '@/test/testDb';
import { findByName } from '@/test/helpers';
import { setPlanDay } from '../plan';
import { getDistanceUnit, getUnits, getWeightUnit, setDistanceUnit, setWeightUnit } from '../settings';
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

describe('distance unit setting', () => {
  it('defaults to mi', async () => {
    expect(await getDistanceUnit(await createTestDb())).toBe('mi');
  });

  it('persists a change to km and back, independently of the weight unit', async () => {
    const db = await createTestDb();
    await setDistanceUnit(db, 'km');
    expect(await getDistanceUnit(db)).toBe('km');
    expect(await getWeightUnit(db)).toBe('lb');
    await setDistanceUnit(db, 'mi');
    expect(await getDistanceUnit(db)).toBe('mi');
  });

  it('rejects an unknown unit', async () => {
    const db = await createTestDb();
    await expect(setDistanceUnit(db, 'yd' as never)).rejects.toThrow('Unsupported distance unit');
    expect(await getDistanceUnit(db)).toBe('mi');
  });

  it('falls back to mi if the stored value is invalid', async () => {
    const db = await createTestDb();
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('distance_unit', 'furlong')");
    expect(await getDistanceUnit(db)).toBe('mi');
  });

  it('getUnits reads both units', async () => {
    const db = await createTestDb();
    await setWeightUnit(db, 'kg');
    await setDistanceUnit(db, 'km');
    expect(await getUnits(db)).toEqual({ weight: 'kg', distance: 'km' });
  });
});
