import { DatabaseSync } from 'node:sqlite';

import { LATEST_VERSION, SEED_V1, migrate } from '../migrations';
import { syncCatalog } from '../catalog';
import type { Db } from '../types';
import { LIFT_SUBCATEGORIES } from '@/data/exercises';
import { setPlanDay } from '@/data/plan';
import { getRangeSummary } from '@/data/workouts';
import { createTestDb, wrap } from '@/test/testDb';

// Undo later migrations so a test can replay the upgrade from an older schema.
const UNDO_V2 = 'ALTER TABLE workouts DROP COLUMN is_customized';
const UNDO_V3 = 'ALTER TABLE exercises DROP COLUMN subcategory';
const UNDO_V5 = 'ALTER TABLE sets DROP COLUMN weight_unit; ALTER TABLE sets DROP COLUMN distance_unit';
const UNDO_V6 = 'DROP TABLE plan_history';
const UNDO_V7 = 'DROP TABLE exercise_subcategories';
const UNDO_V8 = 'ALTER TABLE exercises DROP COLUMN is_hidden';
const UNDO_V12 = `UPDATE categories SET name = 'Yoga & Mobility' WHERE name = 'Mind & Body';
  UPDATE exercises SET name = 'Pilates', subcategory = 'Yoga' WHERE name = 'Mat Pilates' AND is_custom = 0;
  DELETE FROM exercises WHERE name = 'Reformer Pilates' AND is_custom = 0`;
const UNDO_V10 = `UPDATE exercises SET name = 'Dumbbell Curl' WHERE name = 'Bicep Curl' AND is_custom = 0;
  UPDATE exercises SET name = 'Barbell Row' WHERE name = 'Bent-Over Row' AND is_custom = 0`;

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

  it('seeds Lifts, Cardio and Mind & Body categories with subcategories', async () => {
    const db = await createTestDb();
    const rows = await db.getAllAsync<{ cat: string; name: string }>(
      'SELECT c.name AS cat, e.name FROM exercises e JOIN categories c ON c.id = e.category_id',
    );
    const by = (c: string) => rows.filter((r) => r.cat === c).map((r) => r.name);
    expect(by('Lifts')).toEqual(expect.arrayContaining(['Bench Press', 'Squat', 'Deadlift']));
    expect(by('Cardio')).toEqual(expect.arrayContaining(['Running', 'Biking', 'Hiking', 'Downhill Skiing']));
    expect(by('Mind & Body')).toEqual(expect.arrayContaining(['Vinyasa', 'Stretching']));
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
    expect(cats?.n).toBe(3); // seeded exactly once (Yoga and Mobility are one since v9)
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(LATEST_VERSION);
  });

  it('recovers when tables exist but user_version was never recorded', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = wrap(raw);
    await migrate(db);
    // Simulate a half-applied earlier run, which can only have the v1 schema.
    raw.exec(`${UNDO_V12}; ${UNDO_V10}; ${UNDO_V8}; ${UNDO_V7}; ${UNDO_V6}; ${UNDO_V5}; ${UNDO_V3}; ${UNDO_V2}; PRAGMA user_version = 0`);
    await expect(migrate(db)).resolves.toBeUndefined();
    const cats = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
    expect(cats?.n).toBe(3);
  });

  it('v2 adds workouts.is_customized, keeping existing workouts as not customized', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = wrap(raw);
    await migrate(db);
    raw.exec(`${UNDO_V12}; ${UNDO_V10}; ${UNDO_V8}; ${UNDO_V7}; ${UNDO_V6}; ${UNDO_V5}; ${UNDO_V3}; ${UNDO_V2}; PRAGMA user_version = 1`);
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
      raw.exec(`${UNDO_V12}; ${UNDO_V10}; ${UNDO_V8}; ${UNDO_V7}; ${UNDO_V6}; ${UNDO_V5}; ${UNDO_V3}; PRAGMA user_version = 2`);
      // A v2 install only has the v1 seed; drop what syncCatalog has added since.
      const seeded = SEED_V1.flatMap((c) => c.exercises);
      await db.runAsync(`DELETE FROM exercises WHERE name NOT IN (${seeded.map(() => '?').join(', ')})`, seeded);
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
      expect(lifts.length).toBeGreaterThan(15);
      for (const lift of lifts) expect(LIFT_SUBCATEGORIES).toContain(lift.subcategory);
      expect(await subcategoryOf(db, 'Bench Press')).toBe('Chest');
      expect(await subcategoryOf(db, 'Bent-Over Row')).toBe('Back');
      expect(await subcategoryOf(db, 'Overhead Press')).toBe('Shoulders');
      expect(await subcategoryOf(db, 'Bicep Curl')).toBe('Arms');
      expect(await subcategoryOf(db, 'Squat')).toBe('Legs');
    });

    it('leaves custom lifts and other categories uncategorized', async () => {
      const db = await upgradeFromV2(async (d) => {
        await d.runAsync(
          `INSERT INTO exercises (category_id, name, is_custom)
           VALUES ((SELECT id FROM categories WHERE name = 'Lifts'), 'Sled Push', 1)`,
        );
      });
      expect(await subcategoryOf(db, 'Sled Push')).toBeNull();
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

  describe('v4 splits skiing and adds snow and climbing cardio', () => {
    async function upgradeFromV3(prepare: (db: Db) => Promise<void>) {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      // Put the catalog back the way v3 left it.
      raw.exec(`DELETE FROM exercises WHERE name IN ('Ski Touring', 'Cross-Country Skiing', 'Snowshoeing', 'Climbing');
        UPDATE exercises SET name = 'Skiing' WHERE name = 'Downhill Skiing';
        ${UNDO_V8}; ${UNDO_V7}; ${UNDO_V6}; ${UNDO_V5};
        PRAGMA user_version = 3`);
      await prepare(db);
      await migrate(db);
      return db;
    }

    const cardio = async (db: Db) =>
      (await db.getAllAsync<{ name: string; is_custom: number }>(
        `SELECT e.name, e.is_custom FROM exercises e JOIN categories c ON c.id = e.category_id
         WHERE c.name = 'Cardio' ORDER BY e.id`,
      ));

    it('renames Skiing to Downhill Skiing and adds the new built-ins', async () => {
      const db = await upgradeFromV3(async () => {});
      const names = (await cardio(db)).map((r) => r.name);
      expect(names).not.toContain('Skiing');
      expect(names).toEqual(expect.arrayContaining([
        'Downhill Skiing', 'Ski Touring', 'Cross-Country Skiing', 'Snowshoeing', 'Climbing',
      ]));
      expect((await cardio(db)).every((r) => r.is_custom === 0)).toBe(true);
    });

    it('keeps logged skiing sets on the renamed exercise', async () => {
      const db = await upgradeFromV3(async (d) => {
        const { lastInsertRowId: workoutId } = await d.runAsync("INSERT INTO workouts (date) VALUES ('2026-01-10')");
        const { lastInsertRowId: weId } = await d.runAsync(
          "INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, (SELECT id FROM exercises WHERE name = 'Skiing'), 0)",
          [workoutId],
        );
        await d.runAsync('INSERT INTO sets (workout_exercise_id, set_number, duration_min) VALUES (?, 1, 120)', [weId]);
      });
      const row = await db.getFirstAsync(
        `SELECT e.name, s.duration_min FROM sets s
         JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN exercises e ON e.id = we.exercise_id`,
      );
      expect(row).toEqual({ name: 'Downhill Skiing', duration_min: 120 });
    });

    it("leaves a user's custom exercise with a new name alone", async () => {
      const db = await upgradeFromV3(async (d) => {
        await d.runAsync(
          `INSERT INTO exercises (category_id, name, is_custom)
           VALUES ((SELECT id FROM categories WHERE name = 'Cardio'), 'Climbing', 1),
                  ((SELECT id FROM categories WHERE name = 'Cardio'), 'Downhill Skiing', 1)`,
        );
      });
      const rows = await cardio(db);
      expect(rows.filter((r) => r.name === 'Climbing')).toEqual([{ name: 'Climbing', is_custom: 1 }]);
      // The built-in can't take a name the user already has, so it stays as it was.
      expect(rows.filter((r) => r.name === 'Downhill Skiing')).toEqual([{ name: 'Downhill Skiing', is_custom: 1 }]);
      expect(rows.map((r) => r.name)).toContain('Skiing');
      expect(rows.map((r) => r.name)).toContain('Snowshoeing');
    });
  });

  describe('v5 records the unit each set was entered in', () => {
    async function upgradeFromV4(prepare: (db: Db) => Promise<void>) {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec(`${UNDO_V12}; ${UNDO_V10}; ${UNDO_V8}; ${UNDO_V7}; ${UNDO_V6}; ${UNDO_V5}; PRAGMA user_version = 4`);
      await prepare(db);
      await migrate(db);
      return db;
    }

    it('keeps existing weights and distances, with no entered unit so they follow the setting', async () => {
      const db = await upgradeFromV4(async (d) => {
        const { lastInsertRowId: workoutId } = await d.runAsync("INSERT INTO workouts (date) VALUES ('2026-01-10')");
        const { lastInsertRowId: weId } = await d.runAsync(
          "INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, (SELECT id FROM exercises WHERE name = 'Running'), 0)",
          [workoutId],
        );
        await d.runAsync('INSERT INTO sets (workout_exercise_id, set_number, weight, distance) VALUES (?, 1, 135, 3.1)', [weId]);
      });
      // Distances logged before v5 had no unit; they are read as miles, the stored unit.
      expect(await db.getFirstAsync('SELECT weight, distance, weight_unit, distance_unit FROM sets')).toEqual({
        weight: 135, distance: 3.1, weight_unit: null, distance_unit: null,
      });
    });

    it('only accepts known units', async () => {
      const db = await createTestDb();
      const { lastInsertRowId: workoutId } = await db.runAsync("INSERT INTO workouts (date) VALUES ('2026-01-10')");
      const { lastInsertRowId: weId } = await db.runAsync(
        "INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, (SELECT id FROM exercises WHERE name = 'Running'), 0)",
        [workoutId],
      );
      await expect(db.runAsync("INSERT INTO sets (workout_exercise_id, set_number, weight_unit) VALUES (?, 1, 'st')", [weId])).rejects.toThrow();
      await expect(db.runAsync("INSERT INTO sets (workout_exercise_id, set_number, distance_unit) VALUES (?, 1, 'yd')", [weId])).rejects.toThrow();
      await db.runAsync("INSERT INTO sets (workout_exercise_id, set_number, weight_unit, distance_unit) VALUES (?, 1, 'kg', 'km')", [weId]);
    });
  });

  describe('v6 keeps a history of the weekly plan', () => {
    /** An install from before v6 with Bench Press planned on Mondays. */
    async function upgradeFromV5(prepare: (db: Db) => Promise<void>) {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec(`${UNDO_V12}; ${UNDO_V10}; ${UNDO_V8}; ${UNDO_V7}; ${UNDO_V6}; PRAGMA user_version = 5`);
      const bench = (await db.getFirstAsync<{ id: number }>("SELECT id FROM exercises WHERE name = 'Bench Press'"))!.id;
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: bench, targetSets: 3 }] });
      await db.runAsync("UPDATE settings SET value = '1' WHERE key = 'plan_complete'");
      await prepare(db);
      await migrate(db);
      return db;
    }
    const monday = async (db: Db) => (await getRangeSummary(db, '2026-11-02', '2026-11-02', '2026-11-11'))[0];

    it('starts the history when the plan was first saved', async () => {
      const db = await upgradeFromV5(async (d) => { await d.runAsync("INSERT INTO settings (key, value) VALUES ('plan_started', '2026-11-01')"); });
      expect((await monday(db)).status).toBe('missed');
    });

    it('starts it at the first workout when that is earlier', async () => {
      const db = await upgradeFromV5(async (d) => {
        await d.runAsync("INSERT INTO settings (key, value) VALUES ('plan_started', '2026-11-10')");
        await d.runAsync("INSERT INTO workouts (date) VALUES ('2026-10-30')");
      });
      expect((await monday(db)).status).toBe('missed');
    });

    it('records nothing when there is no start to go by', async () => {
      const db = await upgradeFromV5(async () => {});
      expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM plan_history')).toEqual({ n: 0 });
      expect((await monday(db)).status).toBe('none');
    });
  });

  describe('v7 lets an exercise count toward more muscle groups', () => {
    const deadliftId = async (db: Db) =>
      (await db.getFirstAsync<{ id: number }>("SELECT id FROM exercises WHERE name = 'Deadlift'"))!.id;

    it('stores each extra group once per exercise', async () => {
      const db = await createTestDb();
      const id = await deadliftId(db);
      await expect(
        db.runAsync("INSERT INTO exercise_subcategories (exercise_id, subcategory) VALUES (?, 'Legs')", [id]),
      ).rejects.toThrow();
      await expect(
        db.runAsync("INSERT INTO exercise_subcategories (exercise_id, subcategory) VALUES (99999, 'Legs')"),
      ).rejects.toThrow();
    });

    it('drops the groups along with their exercise', async () => {
      const db = await createTestDb();
      const id = await deadliftId(db);
      await db.runAsync('DELETE FROM exercises WHERE id = ?', [id]);
      expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM exercise_subcategories WHERE exercise_id = ?', [id])).toEqual({ n: 0 });
    });

    it('tags the built-ins on an install upgrading from v6', async () => {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec(`${UNDO_V12}; ${UNDO_V10}; ${UNDO_V8}; ${UNDO_V7}; PRAGMA user_version = 6`);
      await migrate(db);
      expect(
        await db.getFirstAsync("SELECT subcategory FROM exercise_subcategories WHERE exercise_id = ?", [await deadliftId(db)]),
      ).toEqual({ subcategory: 'Legs' });
    });
  });

  describe('v8 can hide a removed exercise', () => {
    it('keeps every existing exercise shown', async () => {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec(`${UNDO_V8}; PRAGMA user_version = 7`);
      await db.runAsync("INSERT INTO exercises (category_id, name, is_custom) VALUES (1, 'Sled Push', 1)");
      await migrate(db);
      expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM exercises WHERE is_hidden != 0')).toEqual({ n: 0 });
      expect(await db.getFirstAsync("SELECT is_hidden FROM exercises WHERE name = 'Sled Push'")).toEqual({ is_hidden: 0 });
    });
  });

  describe('v9 puts yoga and mobility in one category', () => {
    /** Upgrades from v8, where Yoga and Mobility were separate categories with no subcategories. */
    async function upgradeFromV8(prepare: (db: Db) => Promise<void>) {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec(`${UNDO_V12};
        UPDATE categories SET name = 'Yoga' WHERE name = 'Yoga & Mobility';
        INSERT INTO categories (name, kind) VALUES ('Mobility', 'mindbody');
        UPDATE exercises SET category_id = (SELECT id FROM categories WHERE name = 'Mobility')
          WHERE subcategory = 'Mobility';
        UPDATE exercises SET subcategory = NULL
          WHERE category_id IN (SELECT id FROM categories WHERE kind = 'mindbody');
        PRAGMA user_version = 8`);
      await prepare(db);
      await migrate(db);
      return db;
    }
    const catId = async (db: Db, name: string) =>
      (await db.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE name = ?', [name]))!.id;
    const addCustom = (db: Db, category: string, name: string) =>
      db.runAsync(
        'INSERT INTO exercises (category_id, name, is_custom) VALUES ((SELECT id FROM categories WHERE name = ?), ?, 1)',
        [category, name],
      );
    /** Logs one 20 minute entry of `name` in `category` on `date`. */
    async function log(db: Db, category: string, name: string, date: string) {
      const { lastInsertRowId: workoutId } = await db.runAsync('INSERT INTO workouts (date) VALUES (?)', [date]);
      const { lastInsertRowId: weId } = await db.runAsync(
        `INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES
           (?, (SELECT e.id FROM exercises e JOIN categories c ON c.id = e.category_id WHERE c.name = ? AND e.name = ?), 0)`,
        [workoutId, category, name],
      );
      await db.runAsync('INSERT INTO sets (workout_exercise_id, set_number, duration_min) VALUES (?, 1, 20)', [weId]);
    }
    const mindBody = (db: Db) =>
      db.getAllAsync<{ cat: string; name: string; subcategory: string | null; is_custom: number }>(
        `SELECT c.name AS cat, e.name, e.subcategory, e.is_custom FROM exercises e
         JOIN categories c ON c.id = e.category_id WHERE c.kind = 'mindbody' ORDER BY e.id`,
      );

    it('files each exercise under the category it came from', async () => {
      const db = await upgradeFromV8(async (d) => {
        await addCustom(d, 'Yoga', 'Kundalini');
        await addCustom(d, 'Mobility', 'Band Work');
      });
      const cats = (await db.getAllAsync<{ name: string }>("SELECT name FROM categories WHERE kind = 'mindbody'")).map((c) => c.name);
      expect(cats).toEqual(['Mind & Body']);
      const rows = await mindBody(db);
      expect(rows.every((r) => r.cat === 'Mind & Body')).toBe(true);
      const sub = (name: string) => rows.find((r) => r.name === name)?.subcategory;
      expect(sub('Vinyasa')).toBe('Yoga');
      expect(sub('Kundalini')).toBe('Yoga');
      expect(sub('Stretching')).toBe('Mobility');
      expect(sub('Band Work')).toBe('Mobility');
      expect(rows.filter((r) => r.name === 'Stretching')).toHaveLength(1);
    });

    it('keeps the category where Yoga was in the list', async () => {
      const yogaId = await catId(await createTestDb(), 'Mind & Body');
      const db = await upgradeFromV8(async () => {});
      expect(await catId(db, 'Mind & Body')).toBe(yogaId);
    });

    it('keeps logged sets and planned items on their exercise', async () => {
      const db = await upgradeFromV8(async (d) => {
        await log(d, 'Mobility', 'Foam Rolling', '2026-11-02');
        await d.runAsync(
          `INSERT INTO plan_items (weekday, exercise_id, position)
           VALUES (1, (SELECT id FROM exercises WHERE name = 'Stretching'), 0)`,
        );
      });
      expect(await db.getFirstAsync(
        `SELECT c.name AS cat, e.name, s.duration_min FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
         JOIN exercises e ON e.id = we.exercise_id JOIN categories c ON c.id = e.category_id`,
      )).toEqual({ cat: 'Mind & Body', name: 'Foam Rolling', duration_min: 20 });
      expect(await db.getFirstAsync(
        'SELECT e.name, e.subcategory FROM plan_items p JOIN exercises e ON e.id = p.exercise_id',
      )).toEqual({ name: 'Stretching', subcategory: 'Mobility' });
    });

    it('merges an exercise both had into one listed under both, keeping every log', async () => {
      const db = await upgradeFromV8(async (d) => {
        await addCustom(d, 'Yoga', 'stretching');
        await log(d, 'Yoga', 'stretching', '2026-11-02');
        await log(d, 'Mobility', 'Stretching', '2026-11-03');
      });
      const rows = (await mindBody(db)).filter((r) => r.name.toLowerCase() === 'stretching');
      expect(rows).toEqual([{ cat: 'Mind & Body', name: 'stretching', subcategory: 'Yoga', is_custom: 1 }]);
      const logged = await db.getAllAsync<{ date: string; name: string }>(
        `SELECT w.date, e.name FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
         JOIN exercises e ON e.id = we.exercise_id ORDER BY w.date`,
      );
      expect(logged).toEqual([{ date: '2026-11-02', name: 'stretching' }, { date: '2026-11-03', name: 'stretching' }]);
      expect(await db.getAllAsync(
        "SELECT s.subcategory FROM exercise_subcategories s JOIN exercises e ON e.id = s.exercise_id WHERE e.name = 'stretching'",
      )).toEqual([{ subcategory: 'Mobility' }]);
    });
  });

  describe('v10 drops the equipment from lift names', () => {
    /** Upgrades from v9, where the built-ins were Dumbbell Curl and Barbell Row. */
    async function upgradeFromV9(prepare: (db: Db) => Promise<void>) {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec(`${UNDO_V12}; ${UNDO_V10}; PRAGMA user_version = 9`);
      await prepare(db);
      await migrate(db);
      return db;
    }
    const lifts = (db: Db) =>
      db.getAllAsync<{ id: number; name: string; is_custom: number }>(
        `SELECT e.id, e.name, e.is_custom FROM exercises e JOIN categories c ON c.id = e.category_id
         WHERE c.name = 'Lifts' ORDER BY e.id`,
      );

    it('renames Dumbbell Curl and Barbell Row in place, keeping their ids', async () => {
      let before: { id: number; name: string }[] = [];
      const db = await upgradeFromV9(async (d) => {
        before = (await lifts(d)).filter((r) => ['Dumbbell Curl', 'Barbell Row'].includes(r.name));
      });
      const after = await lifts(db);
      const names = after.map((r) => r.name);
      expect(names).not.toContain('Dumbbell Curl');
      expect(names).not.toContain('Barbell Row');
      expect(after.find((r) => r.id === before.find((b) => b.name === 'Dumbbell Curl')!.id)?.name).toBe('Bicep Curl');
      expect(after.find((r) => r.id === before.find((b) => b.name === 'Barbell Row')!.id)?.name).toBe('Bent-Over Row');
      expect(names.filter((n) => n === 'Bicep Curl')).toHaveLength(1);
    });

    it('keeps logged sets on the renamed exercise', async () => {
      const db = await upgradeFromV9(async (d) => {
        const { lastInsertRowId: workoutId } = await d.runAsync("INSERT INTO workouts (date) VALUES ('2026-11-02')");
        const { lastInsertRowId: weId } = await d.runAsync(
          "INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, (SELECT id FROM exercises WHERE name = 'Barbell Row'), 0)",
          [workoutId],
        );
        await d.runAsync('INSERT INTO sets (workout_exercise_id, set_number, reps, weight) VALUES (?, 1, 8, 135)', [weId]);
      });
      expect(await db.getFirstAsync(
        `SELECT e.name, s.reps, s.weight FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
         JOIN exercises e ON e.id = we.exercise_id`,
      )).toEqual({ name: 'Bent-Over Row', reps: 8, weight: 135 });
    });

    it("leaves a lift alone when the user already has a custom one with the new name", async () => {
      const db = await upgradeFromV9(async (d) => {
        await d.runAsync(
          "INSERT INTO exercises (category_id, name, is_custom) VALUES ((SELECT id FROM categories WHERE name = 'Lifts'), 'bicep curl', 1)",
        );
      });
      const rows = await lifts(db);
      expect(rows.filter((r) => r.name.toLowerCase() === 'bicep curl')).toEqual([expect.objectContaining({ name: 'bicep curl', is_custom: 1 })]);
      expect(rows.map((r) => r.name)).toContain('Dumbbell Curl');
      expect(rows.map((r) => r.name)).toContain('Bent-Over Row');
    });
  });

  describe('v11 folds back a Yoga or Mobility category an older build re-added', () => {
    /** At v10, then opened by a build from before v9, whose catalog sync re-adds both categories. */
    async function upgradeAfterOldBuild(prepare: (db: Db) => Promise<void>) {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec(`${UNDO_V12}; PRAGMA user_version = 10`);
      await syncCatalog(db, [
        { name: 'Yoga', kind: 'mindbody', exercises: ['Vinyasa', 'Hatha', 'Yin', 'Power Yoga'].map((name) => ({ name })) },
        { name: 'Mobility', kind: 'mindbody', exercises: ['Stretching', 'Foam Rolling'].map((name) => ({ name })) },
      ]);
      await prepare(db);
      await migrate(db);
      return db;
    }
    const exId = async (db: Db, category: string, name: string) =>
      (await db.getFirstAsync<{ id: number }>(
        'SELECT e.id FROM exercises e JOIN categories c ON c.id = e.category_id WHERE c.name = ? AND e.name = ?',
        [category, name],
      ))!.id;
    async function log(db: Db, exerciseId: number, date: string) {
      const { lastInsertRowId: workoutId } = await db.runAsync('INSERT INTO workouts (date) VALUES (?)', [date]);
      const { lastInsertRowId: weId } = await db.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
        [workoutId, exerciseId],
      );
      await db.runAsync('INSERT INTO sets (workout_exercise_id, set_number, duration_min) VALUES (?, 1, 20)', [weId]);
    }
    const mindBody = (db: Db) =>
      db.getAllAsync<{ cat: string; name: string; subcategory: string | null; is_custom: number }>(
        `SELECT c.name AS cat, e.name, e.subcategory, e.is_custom FROM exercises e
         JOIN categories c ON c.id = e.category_id WHERE c.kind = 'mindbody' ORDER BY e.id`,
      );

    it('leaves one Mind & Body category with one of each built-in', async () => {
      const db = await upgradeAfterOldBuild(async () => {});
      const cats = await db.getAllAsync<{ name: string }>("SELECT name FROM categories WHERE kind = 'mindbody'");
      expect(cats).toEqual([{ name: 'Mind & Body' }]);
      const names = (await mindBody(db)).map((r) => r.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names).toEqual(expect.arrayContaining(['Vinyasa', 'Stretching', 'Mat Pilates']));
    });

    it('moves sets and plan items logged against a re-added copy onto the original', async () => {
      let original = 0;
      const db = await upgradeAfterOldBuild(async (d) => {
        original = await exId(d, 'Yoga & Mobility', 'Stretching');
        await log(d, original, '2026-11-01');
        await log(d, await exId(d, 'Mobility', 'Stretching'), '2026-11-02');
        await d.runAsync('INSERT INTO plan_items (weekday, exercise_id, position) VALUES (1, ?, 0)', [await exId(d, 'Yoga', 'Yin')]);
      });
      const logged = await db.getAllAsync<{ date: string; exercise_id: number }>(
        'SELECT w.date, we.exercise_id FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id ORDER BY w.date',
      );
      expect(logged).toEqual([{ date: '2026-11-01', exercise_id: original }, { date: '2026-11-02', exercise_id: original }]);
      expect(await db.getFirstAsync(
        'SELECT c.name AS cat, e.name FROM plan_items p JOIN exercises e ON e.id = p.exercise_id JOIN categories c ON c.id = e.category_id',
      )).toEqual({ cat: 'Mind & Body', name: 'Yin' });
    });

    it('keeps a custom exercise added in the old build, filed under the subcategory it came from', async () => {
      const db = await upgradeAfterOldBuild(async (d) => {
        await d.runAsync(
          "INSERT INTO exercises (category_id, name, is_custom) VALUES ((SELECT id FROM categories WHERE name = 'Mobility'), 'Band Work', 1)",
        );
      });
      expect((await mindBody(db)).find((r) => r.name === 'Band Work')).toEqual(
        { cat: 'Mind & Body', name: 'Band Work', subcategory: 'Mobility', is_custom: 1 },
      );
    });

    it('changes nothing on an install that never ran an older build', async () => {
      const db = await createTestDb();
      await db.execAsync(`${UNDO_V12}; PRAGMA user_version = 11`);
      await migrate(db);
      const before = await mindBody(db);
      const raw = db as unknown as Db;
      await raw.execAsync(`${UNDO_V12}; PRAGMA user_version = 10`);
      await migrate(raw);
      expect(await mindBody(db)).toEqual(before);
    });
  });

  describe('v12 renames Yoga & Mobility to Mind & Body and gives Pilates its own subcategory', () => {
    /** Upgrades from v11, where Pilates was one exercise filed under Yoga. */
    async function upgradeFromV11(prepare: (db: Db) => Promise<void>) {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec(`${UNDO_V12}; PRAGMA user_version = 11`);
      await prepare(db);
      await migrate(db);
      return db;
    }
    const catId = async (db: Db, name: string) =>
      (await db.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE name = ?', [name]))?.id;
    const mindBody = (db: Db) =>
      db.getAllAsync<{ id: number; cat: string; name: string; subcategory: string | null; is_custom: number }>(
        `SELECT e.id, c.name AS cat, e.name, e.subcategory, e.is_custom FROM exercises e
         JOIN categories c ON c.id = e.category_id WHERE c.kind = 'mindbody' ORDER BY e.id`,
      );

    it('renames the category in place, keeping its id', async () => {
      let before: number | undefined;
      const db = await upgradeFromV11(async (d) => { before = await catId(d, 'Yoga & Mobility'); });
      expect(before).toBeDefined();
      expect(await catId(db, 'Yoga & Mobility')).toBeUndefined();
      expect(await catId(db, 'Mind & Body')).toBe(before);
    });

    it('turns Pilates into Mat Pilates under Pilates, keeping its logged sets, and adds Reformer Pilates', async () => {
      let pilatesId = 0;
      const db = await upgradeFromV11(async (d) => {
        pilatesId = (await d.getFirstAsync<{ id: number }>("SELECT id FROM exercises WHERE name = 'Pilates'"))!.id;
        const { lastInsertRowId: workoutId } = await d.runAsync("INSERT INTO workouts (date) VALUES ('2026-11-03')");
        await d.runAsync('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)', [workoutId, pilatesId]);
      });
      const rows = await mindBody(db);
      expect(rows.find((r) => r.id === pilatesId)).toMatchObject({ cat: 'Mind & Body', name: 'Mat Pilates', subcategory: 'Pilates' });
      expect(rows.map((r) => r.name)).not.toContain('Pilates');
      expect(rows.find((r) => r.name === 'Reformer Pilates')).toMatchObject({ subcategory: 'Pilates', is_custom: 0 });
      expect(await db.getFirstAsync('SELECT exercise_id FROM workout_exercises')).toEqual({ exercise_id: pilatesId });
    });

    it("leaves a user's custom Mat Pilates alone", async () => {
      const db = await upgradeFromV11(async (d) => {
        await d.runAsync(
          "INSERT INTO exercises (category_id, name, is_custom) VALUES ((SELECT id FROM categories WHERE name = 'Yoga & Mobility'), 'mat pilates', 1)",
        );
      });
      const rows = await mindBody(db);
      expect(rows.filter((r) => r.name.toLowerCase() === 'mat pilates')).toEqual([expect.objectContaining({ name: 'mat pilates', is_custom: 1 })]);
      expect(rows.find((r) => r.name === 'Pilates')).toMatchObject({ is_custom: 0 });
    });
  });

  describe('v13 clears days opened before the plan existed', () => {
    /** Upgrades from v12 with a plan first saved on Wednesday Nov 18. */
    async function upgradeFromV12(prepare: (db: Db) => Promise<void>) {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec('PRAGMA user_version = 12');
      await db.runAsync(
        "INSERT INTO plan_history (effective_from, weekday, is_rest, exercise_count, kinds) VALUES ('2026-11-18', 1, 0, 1, 'strength')",
      );
      await prepare(db);
      await migrate(db);
      return db;
    }
    const bench = async (db: Db) => (await db.getFirstAsync<{ id: number }>("SELECT id FROM exercises WHERE name = 'Bench Press'"))!.id;
    async function workout(db: Db, date: string, extra: { notes?: string; customized?: boolean; logged?: boolean } = {}) {
      const { lastInsertRowId: id } = await db.runAsync('INSERT INTO workouts (date, notes, is_customized) VALUES (?, ?, ?)', [
        date, extra.notes ?? null, extra.customized ? 1 : 0,
      ]);
      const { lastInsertRowId: we } = await db.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)', [id, await bench(db)],
      );
      await db.runAsync('INSERT INTO sets (workout_exercise_id, set_number, reps, weight, completed) VALUES (?, 1, ?, ?, ?)', [
        we, extra.logged ? 5 : null, extra.logged ? 100 : null, extra.logged ? 1 : 0,
      ]);
    }
    const dates = async (db: Db) => (await db.getAllAsync<{ date: string }>('SELECT date FROM workouts ORDER BY date')).map((r) => r.date);

    it('drops untouched workouts from before the plan, so they are no longer missed', async () => {
      const db = await upgradeFromV12(async (d) => {
        await workout(d, '2026-11-16'); // Monday, opened after the plan was saved
        await workout(d, '2026-11-23'); // after the plan: kept
      });
      expect(await dates(db)).toEqual(['2026-11-23']);
      const [mon] = await getRangeSummary(db, '2026-11-16', '2026-11-16', '2026-11-20');
      expect(mon).toMatchObject({ status: 'none', beforePlan: true });
    });

    it('keeps days before the plan that were logged, noted or changed by hand', async () => {
      const db = await upgradeFromV12(async (d) => {
        await workout(d, '2026-11-14', { logged: true });
        await workout(d, '2026-11-15', { notes: 'sore' });
        await workout(d, '2026-11-16', { customized: true });
      });
      expect(await dates(db)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
    });

    it('leaves workouts alone when no plan was ever saved', async () => {
      const raw = new DatabaseSync(':memory:');
      const db = wrap(raw);
      await migrate(db);
      raw.exec('PRAGMA user_version = 12');
      await workout(db, '2026-11-16');
      await migrate(db);
      expect(await dates(db)).toEqual(['2026-11-16']);
    });
  });
});
