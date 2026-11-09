import { CATALOG, type CatalogCategory, type LiftSubcategory } from '@/data/catalog';
import { LIFT_SUBCATEGORIES } from '@/data/exercises';
import { createTestDb } from '@/test/testDb';
import { syncCatalog } from '../catalog';
import type { Db } from '../types';

const builtIns = (db: Db) =>
  db.getAllAsync<{ cat: string; kind: string; name: string; subcategory: string | null; is_custom: number }>(
    `SELECT c.name AS cat, c.kind, e.name, e.subcategory, e.is_custom
     FROM exercises e JOIN categories c ON c.id = e.category_id ORDER BY e.id`,
  );

/** The shipped catalog with one more exercise added to a category. */
const withExtra = (category: string, name: string, subcategory?: LiftSubcategory): CatalogCategory[] =>
  CATALOG.map((c) => (c.name === category ? { ...c, exercises: [...c.exercises, { name, subcategory }] } : c));

describe('CATALOG', () => {
  it('names each exercise once per category', () => {
    for (const c of CATALOG) {
      const names = c.exercises.map((e) => e.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('files every lift under a known muscle group, and only lifts have one', () => {
    for (const c of CATALOG) {
      for (const e of c.exercises) {
        if (c.kind === 'strength') expect(LIFT_SUBCATEGORIES).toContain(e.subcategory);
        else expect(e.subcategory).toBeUndefined();
      }
    }
  });
});

describe('syncCatalog', () => {
  it('leaves a fresh install with exactly the catalog as built-ins, in their subcategories', async () => {
    const db = await createTestDb();
    const rows = (await builtIns(db)).filter((r) => !r.is_custom);
    for (const c of CATALOG) {
      const got = rows.filter((r) => r.cat === c.name);
      expect(got.every((r) => r.kind === c.kind)).toBe(true);
      expect(got.map((r) => [r.name, r.subcategory]).sort()).toEqual(
        c.exercises.map((e) => [e.name, e.subcategory ?? null]).sort(),
      );
    }
    expect(new Set(rows.map((r) => r.cat))).toEqual(new Set(CATALOG.map((c) => c.name)));
  });

  it('adds an exercise new to the catalog to an existing database, after the ones already there', async () => {
    const db = await createTestDb();
    const before = await builtIns(db);
    await syncCatalog(db, withExtra('Lifts', 'Hip Thrust', 'Legs'));
    const after = await builtIns(db);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.slice(before.length)).toEqual([
      { cat: 'Lifts', kind: 'strength', name: 'Hip Thrust', subcategory: 'Legs', is_custom: 0 },
    ]);
  });

  it('adds a category new to the catalog', async () => {
    const db = await createTestDb();
    await syncCatalog(db, [...CATALOG, { name: 'Sports', kind: 'cardio', exercises: [{ name: 'Tennis' }] }]);
    expect((await builtIns(db)).filter((r) => r.cat === 'Sports')).toEqual([
      { cat: 'Sports', kind: 'cardio', name: 'Tennis', subcategory: null, is_custom: 0 },
    ]);
  });

  it("skips a name the user already has as a custom exercise, whatever its case", async () => {
    const db = await createTestDb();
    await db.runAsync(
      "INSERT INTO exercises (category_id, name, is_custom) VALUES ((SELECT id FROM categories WHERE name = 'Cardio'), 'pickleball', 1)",
    );
    await syncCatalog(db, withExtra('Cardio', 'Pickleball'));
    expect((await builtIns(db)).filter((r) => r.name.toLowerCase() === 'pickleball')).toEqual([
      { cat: 'Cardio', kind: 'cardio', name: 'pickleball', subcategory: null, is_custom: 1 },
    ]);
  });

  it('is idempotent', async () => {
    const db = await createTestDb();
    const before = await builtIns(db);
    await syncCatalog(db);
    await syncCatalog(db);
    expect(await builtIns(db)).toEqual(before);
  });
});
