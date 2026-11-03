import { LIFT_SUBCATEGORIES, addExercise, findExercise, groupBySubcategory, listCategoriesWithExercises } from '../exercises';
import { createTestDb } from '@/test/testDb';

describe('exercises', () => {
  it('groups exercises under categories', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    expect(cats.map((c) => c.name)).toEqual(expect.arrayContaining(['Lifts', 'Cardio', 'Yoga']));
    const cardio = cats.find((c) => c.name === 'Cardio')!;
    expect(cardio.kind).toBe('cardio');
    expect(cardio.exercises.map((e) => e.name)).toContain('Running');
  });

  it('adds a custom exercise to a category', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    const lifts = cats.find((c) => c.name === 'Lifts')!;
    const ex = await addExercise(db, lifts.id, '  Hip Thrust ');
    expect(ex.name).toBe('Hip Thrust');
    expect(ex.isCustom).toBe(true);
    expect((await findExercise(db, ex.id))?.categoryKind).toBe('strength');
  });

  it('offers muscle groups as subcategories for lifts only', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    expect(cats.find((c) => c.name === 'Lifts')!.subcategories).toEqual(LIFT_SUBCATEGORIES);
    for (const name of ['Cardio', 'Yoga', 'Mobility']) {
      expect(cats.find((c) => c.name === name)!.subcategories).toEqual([]);
    }
  });

  it('returns the subcategory with each exercise', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    const lifts = cats.find((c) => c.name === 'Lifts')!;
    expect(lifts.exercises.find((e) => e.name === 'Bench Press')!.subcategory).toBe('Chest');
    expect(cats.find((c) => c.name === 'Cardio')!.exercises[0].subcategory).toBeNull();
  });

  it('adds a custom exercise to a subcategory, defaulting to none', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    expect((await addExercise(db, lifts.id, 'Cable Fly', 'Chest')).subcategory).toBe('Chest');
    expect((await addExercise(db, lifts.id, 'Farmer Carry')).subcategory).toBeNull();
  });

  describe('groupBySubcategory', () => {
    it('orders groups by subcategory, skips empty ones and puts uncategorized lifts last', async () => {
      const db = await createTestDb();
      const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
      await addExercise(db, lifts.id, 'Farmer Carry');
      const reloaded = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;

      const groups = groupBySubcategory(reloaded);

      expect(groups.map((g) => g.title)).toEqual(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Other']);
      expect(groups[0].exercises.map((e) => e.name)).toEqual(['Bench Press', 'Incline Bench Press']);
      expect(groups[5].exercises.map((e) => e.name)).toEqual(['Farmer Carry']);
    });

    it('has no Other group when every lift is categorized', async () => {
      const db = await createTestDb();
      const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
      expect(groupBySubcategory(lifts).map((g) => g.title)).not.toContain('Other');
    });

    it('returns one untitled group for a category without subcategories', async () => {
      const db = await createTestDb();
      const cardio = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Cardio')!;
      expect(groupBySubcategory(cardio)).toEqual([{ title: null, exercises: cardio.exercises }]);
    });
  });

  it('rejects blank and duplicate names (case-insensitive)', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    await expect(addExercise(db, lifts.id, '   ')).rejects.toThrow(/name/i);
    await expect(addExercise(db, lifts.id, 'bench press')).rejects.toThrow(/exists/i);
  });
});
