import { CATALOG, type CatalogCategory, type LiftSubcategory } from '@/data/catalog';
import { LIFT_SUBCATEGORIES, SUBCATEGORIES } from '@/data/exercises';
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

  it('files every exercise under one of its category\'s subcategories, if the category has them', () => {
    for (const c of CATALOG) {
      for (const e of c.exercises) {
        if (SUBCATEGORIES[c.kind].length) expect(SUBCATEGORIES[c.kind]).toContain(e.subcategory);
        else expect(e.subcategory).toBeUndefined();
      }
    }
  });

  it('keeps yoga, pilates and mobility in one category, as subcategories', () => {
    const mindBody = CATALOG.filter((c) => c.kind === 'mindbody');
    expect(mindBody.map((c) => c.name)).toEqual(['Mind & Body']);
    const sub = (name: string) => mindBody[0].exercises.find((e) => e.name === name)?.subcategory;
    expect(sub('Vinyasa')).toBe('Yoga');
    expect(sub('Mat Pilates')).toBe('Pilates');
    expect(sub('Stretching')).toBe('Mobility');
  });

  it('only gives lifts extra muscle groups, each known, distinct and not the main one', () => {
    for (const c of CATALOG) {
      for (const e of c.exercises) {
        if (!e.also) continue;
        expect(c.kind).toBe('strength');
        expect(e.also.length).toBeGreaterThan(0);
        expect(new Set(e.also).size).toBe(e.also.length);
        expect(e.also).not.toContain(e.subcategory);
        for (const s of e.also) expect(LIFT_SUBCATEGORIES).toContain(s);
      }
    }
  });

  it('names exercises without the equipment, so a lift is the same whether done with a barbell or dumbbells', () => {
    for (const c of CATALOG) for (const e of c.exercises) expect(e.name).not.toMatch(/barbell|dumbbell/i);
  });

  it.each([
    ['Lifts', 'Hack Squat', 'Legs'], ['Lifts', 'Kelso Shrug', 'Back'], ['Lifts', 'Dip', 'Chest'],
    ['Lifts', 'Chest Press', 'Chest'], ['Lifts', 'Seated Shoulder Press', 'Shoulders'],
    ['Lifts', 'Incline Curl', 'Arms'], ['Lifts', 'Hammer Curl', 'Arms'],
    ['Lifts', 'Russian Twist', 'Core'], ['Lifts', 'Crunch', 'Core'], ['Lifts', 'Cable Crunch', 'Core'],
    ['Lifts', 'Straight-Leg Sit-up', 'Core'], ['Lifts', 'Ab Wheel Rollout', 'Core'], ['Lifts', 'Bird Dog', 'Core'],
    ['Lifts', 'Dead Bug', 'Core'], ['Lifts', 'Pallof Press', 'Core'],
    ['Cardio', 'Stair Stepper', undefined], ['Cardio', 'Elliptical', undefined], ['Cardio', 'HIIT', undefined],
    ['Cardio', 'Golf', undefined], ['Mind & Body', 'Mat Pilates', 'Pilates'],
    ['Mind & Body', 'Reformer Pilates', 'Pilates'], ['Mind & Body', 'Meditation', 'Mindfulness'],
  ])('includes %s: %s', (category, name, subcategory) => {
    const found = CATALOG.find((c) => c.name === category)!.exercises.find((e) => e.name === name);
    expect(found?.subcategory).toBe(subcategory);
  });

  it('files a deadlift under legs as well as back', () => {
    const deadlift = CATALOG[0].exercises.find((e) => e.name === 'Deadlift')!;
    expect(deadlift.subcategory).toBe('Back');
    expect(deadlift.also).toContain('Legs');
  });
});

const extraGroups = (db: Db) =>
  db.getAllAsync<{ name: string; subcategory: string; is_custom: number }>(
    `SELECT e.name, s.subcategory, e.is_custom FROM exercise_subcategories s
     JOIN exercises e ON e.id = s.exercise_id ORDER BY e.id, s.subcategory`,
  );

/** The shipped catalog with extra muscle groups set on one built-in. */
const withAlso = (name: string, also: LiftSubcategory[]): CatalogCategory[] =>
  CATALOG.map((c) => ({ ...c, exercises: c.exercises.map((e) => (e.name === name ? { ...e, also } : e)) }));

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
    await syncCatalog(db, withExtra('Lifts', 'Sled Push', 'Legs'));
    const after = await builtIns(db);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.slice(before.length)).toEqual([
      { cat: 'Lifts', kind: 'strength', name: 'Sled Push', subcategory: 'Legs', is_custom: 0 },
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

  it('gives a fresh install exactly the catalog\'s extra muscle groups', async () => {
    const db = await createTestDb();
    const expected = CATALOG.flatMap((c) => c.exercises.flatMap((e) => (e.also ?? []).map((s) => [e.name, s])));
    expect((await extraGroups(db)).map((r) => [r.name, r.subcategory]).sort()).toEqual(expected.sort());
  });

  it('adds a muscle group new to the catalog to a built-in already installed', async () => {
    const db = await createTestDb();
    await syncCatalog(db, withAlso('Squat', ['Core']));
    expect((await extraGroups(db)).filter((r) => r.name === 'Squat')).toEqual([
      { name: 'Squat', subcategory: 'Core', is_custom: 0 },
    ]);
  });

  it("doesn't add muscle groups to a custom exercise with a built-in's name", async () => {
    const db = await createTestDb();
    await db.runAsync(
      "INSERT INTO exercises (category_id, name, is_custom) VALUES ((SELECT id FROM categories WHERE name = 'Lifts'), 'sled drag', 1)",
    );
    await syncCatalog(db, withExtra('Lifts', 'Sled Drag', 'Legs').map((c) => ({
      ...c, exercises: c.exercises.map((e) => (e.name === 'Sled Drag' ? { ...e, also: ['Back' as const] } : e)),
    })));
    expect((await extraGroups(db)).filter((r) => r.name.toLowerCase() === 'sled drag')).toEqual([]);
  });

  it('is idempotent', async () => {
    const db = await createTestDb();
    const before = await builtIns(db);
    const groupsBefore = await extraGroups(db);
    await syncCatalog(db);
    await syncCatalog(db);
    expect(await builtIns(db)).toEqual(before);
    expect(await extraGroups(db)).toEqual(groupsBefore);
  });
});
