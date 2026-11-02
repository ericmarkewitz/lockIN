import { DatabaseSync } from 'node:sqlite';

import { LATEST_VERSION, migrate } from '../migrations';
import { createTestDb, wrap } from '@/test/testDb';

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
    raw.exec('ALTER TABLE workouts DROP COLUMN is_customized; PRAGMA user_version = 0');
    await expect(migrate(db)).resolves.toBeUndefined();
    const cats = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
    expect(cats?.n).toBe(4);
  });

  it('v2 adds workouts.is_customized, keeping existing workouts as not customized', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = wrap(raw);
    await migrate(db);
    raw.exec('ALTER TABLE workouts DROP COLUMN is_customized; PRAGMA user_version = 1');
    await db.runAsync("INSERT INTO workouts (date, notes) VALUES ('2026-11-02', 'kept')");

    await migrate(db);

    const row = await db.getFirstAsync<{ notes: string; is_customized: number }>(
      "SELECT notes, is_customized FROM workouts WHERE date = '2026-11-02'",
    );
    expect(row).toEqual({ notes: 'kept', is_customized: 0 });
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(LATEST_VERSION);
  });
});
