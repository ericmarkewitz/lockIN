import { DatabaseSync } from 'node:sqlite';

import { LATEST_VERSION, migrate } from '../migrations';
import type { Db } from '../types';
import { LIFT_SUBCATEGORIES } from '@/data/exercises';
import { createTestDb, wrap } from '@/test/testDb';

// Undo later migrations so a test can replay the upgrade from an older schema.
const UNDO_V2 = 'ALTER TABLE workouts DROP COLUMN is_customized';
const UNDO_V3 = 'ALTER TABLE exercises DROP COLUMN subcategory';

describe('migrations', () => {
  it('creates the schema and records the version', async () => {
    const db = await createTestDb();
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(LATEST_VERSION);
    const tables = (
      await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
    ).map((t) => t.name);
    for (const t of ['categories', 'exercises', 'plan_days', 'plan_items', 'workouts', 'workout_exercises', 'sets', 'settings']) {
      expect(tables).toContain(t);
    }
  });

  it('is idempotent', async () => {
    const db = wrap(new DatabaseSync(':memory:'));
    await migrate(db);
    await migrate(db);
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
    expect(n?.n).toBeGreaterThan(0);
  });

  it('seeds Lifts, Cardio and Yoga categories with subcategories', async () => {
    const db = await createTestDb();
    const rows = await db.getAllAsync<{ cat: string; name: string }>(
      'SELECT c.name AS cat, e.name FROM exercises e JOIN categories c ON c.id = e.category_id',
    );
    const by = (c: string) => rows.filter((r) => r.cat === c).map((r) => r.name);
    expect(by('Lifts')).toEqual(expect.arrayContaining(['Bench Press', 'Squat', 'Deadlift']));
    expect(by('Cardio')).toEqual(expect.arrayContaining(['Running', 'Biking', 'Hiking', 'Skiing']));
    expect(by('Yoga').length).toBeGreaterThan(0);
  });

  it('seeds all 7 plan days as non-rest and enforces foreign keys', async () => {
    const db = await createTestDb();
    const days = await db.getAllAsync('SELECT * FROM plan_days');
    expect(days).toHaveLength(7);
    await expect(
      db.runAsync('INSERT INTO plan_items (weekday, exercise_id, position) VALUES (1, 99999, 0)'),
    ).rejects.toThrow();
  });

  it('survives concurrent calls on the same connection (e.g. onInit firing twice)', async () => {
    const db = wrap(new DatabaseSync(':memory:'));
    await Promise.all([migrate(db), migrate(db), migrate(db)]);
    const cats = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
    expect(cats?.n).toBe(4); // seeded exactly once
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(LATEST_VERSION);
  });

  it('recovers when tables exist but user_version was never recorded', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = wrap(raw);
    await migrate(db);
    // Simulate a half-applied earlier run, which can only have the v1 schema.
    raw.exec(`${UNDO_V3}; ${UNDO_V2}; PRAGMA user_version = 0`);
    await expect(migrate(db)).resolves.toBeUndefined();
    const cats = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
    expect(cats?.n).toBe(4);
  });

  it('v2 adds workouts.is_customized, keeping existing workouts as not customized', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = wrap(raw);
    await migrate(db);
    raw.exec(`${UNDO_V3}; ${UNDO_V2}; PRAGMA user_version = 1`);
    await db.runAsync("INSERT INTO workouts (date, notes) VALUES ('2026-11-02', 'kept')");

    await migrate(db);

    const row = await db.getFirstAsync<{ notes: string; is_customized: number }>(
      "SELECT notes, is_customized FROM workouts WHERE date = '2026-11-02'",
    );
    expect(row).toEqual({ notes: 'kept', is_customized: 0 });
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(LATEST_VERSION);
  });

  describe('v3 exercises.subcategory', () => {
    async function upgradeFromV2(prepare: (db: Db) => Promise<void>) {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec(`${UNDO_V3}; PRAGMA user_version = 2`);
      await prepare(db);
      await migrate(db);
      return db;
    }

    const subcategoryOf = async (db: Db, name: string) =>
      (await db.getFirstAsync<{ subcategory: string | null }>('SELECT subcategory FROM exercises WHERE name = ?', [name]))?.subcategory;

    it('gives every seeded lift a muscle group from the known list', async () => {
      const db = await upgradeFromV2(async () => {});
      const lifts = await db.getAllAsync<{ name: string; subcategory: string | null }>(
        `SELECT e.name, e.subcategory FROM exercises e JOIN categories c ON c.id = e.category_id WHERE c.name = 'Lifts'`,
      );
      expect(lifts).toHaveLength(15);
      for (const lift of lifts) expect(LIFT_SUBCATEGORIES).toContain(lift.subcategory);
      expect(await subcategoryOf(db, 'Bench Press')).toBe('Chest');
      expect(await subcategoryOf(db, 'Barbell Row')).toBe('Back');
      expect(await subcategoryOf(db, 'Overhead Press')).toBe('Shoulders');
      expect(await subcategoryOf(db, 'Dumbbell Curl')).toBe('Arms');
      expect(await subcategoryOf(db, 'Squat')).toBe('Legs');
    });

    it('leaves custom lifts and other categories uncategorized', async () => {
      const db = await upgradeFromV2(async (d) => {
        await d.runAsync(
          `INSERT INTO exercises (category_id, name, is_custom)
           VALUES ((SELECT id FROM categories WHERE name = 'Lifts'), 'Hip Thrust', 1)`,
        );
      });
      expect(await subcategoryOf(db, 'Hip Thrust')).toBeNull();
      expect(await subcategoryOf(db, 'Running')).toBeNull();
      expect(await subcategoryOf(db, 'Vinyasa')).toBeNull();
    });

    it('keeps logged sets attached to their exercise', async () => {
      const db = await upgradeFromV2(async (d) => {
        const { lastInsertRowId: workoutId } = await d.runAsync("INSERT INTO workouts (date) VALUES ('2026-11-02')");
        const { lastInsertRowId: weId } = await d.runAsync(
          "INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, (SELECT id FROM exercises WHERE name = 'Squat'), 0)",
          [workoutId],
        );
        await d.runAsync('INSERT INTO sets (workout_exercise_id, set_number, reps, weight) VALUES (?, 1, 5, 225)', [weId]);
      });
      const row = await db.getFirstAsync(
        `SELECT e.name, s.reps, s.weight FROM sets s
         JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN exercises e ON e.id = we.exercise_id`,
      );
      expect(row).toEqual({ name: 'Squat', reps: 5, weight: 225 });
    });
  });
});
