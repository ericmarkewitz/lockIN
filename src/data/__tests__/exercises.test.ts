import { LIFT_SUBCATEGORIES, addExercise, findExercise, groupBySubcategory, listCategoriesWithExercises, searchExercises } from '../exercises';
import { createTestDb } from '@/test/testDb';
import { CATALOG } from '../catalog';

describe('exercises', () => {
  it('groups exercises under categories', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    expect(cats.map((c) => c.name)).toEqual(expect.arrayContaining(['Lifts', 'Cardio', 'Mind & Body']));
    const cardio = cats.find((c) => c.name === 'Cardio')!;
    expect(cardio.kind).toBe('cardio');
    expect(cardio.exercises.map((e) => e.name)).toContain('Running');
  });

  it('adds a custom exercise to a category', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    const lifts = cats.find((c) => c.name === 'Lifts')!;
    const ex = await addExercise(db, lifts.id, '  Sled Push ');
    expect(ex.name).toBe('Sled Push');
    expect(ex.isCustom).toBe(true);
    expect((await findExercise(db, ex.id))?.categoryKind).toBe('strength');
  });

  it('offers muscle groups for lifts, yoga and mobility for mind-body, and none for cardio', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    expect(cats.find((c) => c.name === 'Lifts')!.subcategories).toEqual(LIFT_SUBCATEGORIES);
    expect(cats.find((c) => c.name === 'Mind & Body')!.subcategories).toEqual(['Yoga', 'Pilates', 'Mobility']);
    expect(cats.find((c) => c.name === 'Cardio')!.subcategories).toEqual([]);
  });

  it('groups yoga and mobility exercises apart', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    const groups = groupBySubcategory(cats.find((c) => c.name === 'Mind & Body')!);
    expect(groups.map((g) => g.title)).toEqual(['Yoga', 'Pilates', 'Mobility']);
    expect(groups[0].exercises.map((e) => e.name)).toEqual(['Vinyasa', 'Hatha', 'Yin', 'Power Yoga']);
    expect(groups[1].exercises.map((e) => e.name)).toEqual(['Mat Pilates', 'Reformer Pilates']);
    expect(groups[2].exercises.map((e) => e.name)).toEqual(['Stretching', 'Foam Rolling']);
  });

  it('returns the subcategory with each exercise', async () => {
    const db = await createTestDb();
    const cats = await listCategoriesWithExercises(db);
    const lifts = cats.find((c) => c.name === 'Lifts')!;
    expect(lifts.exercises.find((e) => e.name === 'Bench Press')!.subcategory).toBe('Chest');
    expect(cats.find((c) => c.name === 'Cardio')!.exercises[0].subcategory).toBeNull();
  });

  it('returns the extra muscle groups with each exercise', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    const deadlift = lifts.exercises.find((e) => e.name === 'Deadlift')!;
    expect(deadlift.alsoIn).toEqual(['Legs']);
    expect(lifts.exercises.find((e) => e.name === 'Squat')!.alsoIn).toEqual([]);
    expect((await findExercise(db, deadlift.id))!.alsoIn).toEqual(['Legs']);
  });

  it('adds a custom exercise to extra muscle groups too, ignoring repeats and its main group', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    const ex = await addExercise(db, lifts.id, 'Rack Pull', 'Back', ['Legs', 'Back', 'Arms', 'Legs']);
    expect(ex).toMatchObject({ subcategory: 'Back', alsoIn: ['Arms', 'Legs'] });
    expect((await addExercise(db, lifts.id, 'Sandbag Carry')).alsoIn).toEqual([]);
  });

  it("adds nothing when the name is taken, even with extra muscle groups", async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    const before = await db.getFirstAsync('SELECT COUNT(*) AS n FROM exercise_subcategories');
    await expect(addExercise(db, lifts.id, 'squat', 'Legs', ['Core'])).rejects.toThrow(/exists/i);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM exercise_subcategories')).toEqual(before);
  });

  it('adds a custom exercise to a subcategory, defaulting to none', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    expect((await addExercise(db, lifts.id, 'Cable Fly', 'Chest')).subcategory).toBe('Chest');
    expect((await addExercise(db, lifts.id, 'Sandbag Carry')).subcategory).toBeNull();
  });

  describe('groupBySubcategory', () => {
    it('orders groups by subcategory, skips empty ones and puts uncategorized lifts last', async () => {
      const db = await createTestDb();
      const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
      await addExercise(db, lifts.id, 'Sandbag Carry');
      await db.runAsync("DELETE FROM exercises WHERE subcategory = 'Core'");
      const reloaded = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;

      const groups = groupBySubcategory(reloaded);

      expect(groups.map((g) => g.title)).toEqual(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Other']);
      expect(groups[0].exercises.map((e) => e.name)).toEqual(
        ['Bench Press', 'Incline Bench Press', 'Close-Grip Bench Press', 'Pec Fly', 'Push-up', 'Dip', 'Chest Press', 'Lat Pullover'],
      );
      expect(groups[5].exercises.map((e) => e.name)).toEqual(['Sandbag Carry']);
    });

    it('lists an exercise under each of its muscle groups', async () => {
      const db = await createTestDb();
      const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
      const groups = groupBySubcategory(lifts);
      const titlesWith = (name: string) => groups.filter((g) => g.exercises.some((e) => e.name === name)).map((g) => g.title);
      expect(titlesWith('Deadlift')).toEqual(['Back', 'Legs']);
      expect(titlesWith('Squat')).toEqual(['Legs']);
    });

    it('files a lift with no main group under Other as well as its extra groups', async () => {
      const db = await createTestDb();
      const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
      const ex = await addExercise(db, lifts.id, 'Sandbag Carry');
      await db.runAsync("INSERT INTO exercise_subcategories (exercise_id, subcategory) VALUES (?, 'Arms')", [ex.id]);
      const groups = groupBySubcategory((await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!);
      const titlesWith = groups.filter((g) => g.exercises.some((e) => e.name === 'Sandbag Carry')).map((g) => g.title);
      expect(titlesWith).toEqual(['Arms', 'Other']);
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

  describe('searchExercises', () => {
    const names = (es: { name: string }[]) => es.map((e) => e.name);

    it('matches names case-insensitively within the active category, and lists other categories apart', async () => {
      const db = await createTestDb();
      const cats = await listCategoriesWithExercises(db);
      const lifts = cats.find((c) => c.name === 'Lifts')!;
      const r = searchExercises(cats, lifts.id, '  PRESS ');
      expect(names(r.here)).toEqual([
        'Bench Press', 'Incline Bench Press', 'Overhead Press', 'Leg Press', 'Close-Grip Bench Press', 'Chest Press',
        'Arnold Press', 'Seated Shoulder Press', 'Pallof Press',
      ]);
      expect(r.elsewhere).toEqual([]);
      expect(names(searchExercises(cats, lifts.id, 'run').elsewhere)).toEqual(['Running']);
    });

    it('matches a muscle group, so "legs" finds every leg lift', async () => {
      const db = await createTestDb();
      const cats = await listCategoriesWithExercises(db);
      const lifts = cats.find((c) => c.name === 'Lifts')!;
      expect(names(searchExercises(cats, lifts.id, 'legs').here).sort()).toEqual(
        CATALOG[0].exercises.filter((e) => e.subcategory === 'Legs' || e.also?.includes('Legs')).map((e) => e.name).sort(),
      );
      expect(names(searchExercises(cats, lifts.id, 'legs').here)).toContain('Deadlift');
    });

    it('reports whether the query is already an exercise in the active category', async () => {
      const db = await createTestDb();
      const cats = await listCategoriesWithExercises(db);
      const lifts = cats.find((c) => c.name === 'Lifts')!;
      expect(searchExercises(cats, lifts.id, 'bench press ').exact).toBe(true);
      expect(searchExercises(cats, lifts.id, 'bench').exact).toBe(false);
      expect(searchExercises(cats, lifts.id, 'running').exact).toBe(false); // exists, but not in Lifts
    });
  });

  it('rejects blank and duplicate names (case-insensitive)', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    await expect(addExercise(db, lifts.id, '   ')).rejects.toThrow(/name/i);
    await expect(addExercise(db, lifts.id, 'bench press')).rejects.toThrow(/exists/i);
  });
});
