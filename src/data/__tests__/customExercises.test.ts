import type { Db } from '@/db/types';
import { weekdayOf } from '@/lib/dates';
import { findByName } from '@/test/helpers';
import { createTestDb } from '@/test/testDb';
import {
  addExercise, findExercise, getExerciseUsage, listCategoriesWithExercises, removeExercise, setDefaultFields, updateExercise,
} from '../exercises';
import { getPlan, getPlanHistory, markPlanComplete, setPlanDay } from '../plan';
import { ensureWorkout, getWorkout, updateSet } from '../workouts';

const TODAY = '2026-11-15';
const PAST = '2026-11-10';
const FUTURE = '2026-11-18';

async function liftsId(db: Db) {
  return (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!.id;
}

const listed = async (db: Db) => (await listCategoriesWithExercises(db)).flatMap((c) => c.exercises.map((e) => e.name));

/** Plans the exercise on `date`'s weekday, then logs one set of it that day. */
async function logOn(db: Db, exerciseId: number, date: string) {
  await setPlanDay(db, weekdayOf(date), { isRest: false, items: [{ exerciseId, targetSets: 1 }] });
  const w = await ensureWorkout(db, date);
  await updateSet(db, w.exercises[0].sets[0].id, { reps: 5, weight: 100 });
}

describe('removeExercise', () => {
  it('deletes a custom exercise that was never used, along with its muscle groups', async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await liftsId(db), 'Rack Pull', 'Back', ['Legs']);
    expect(await removeExercise(db, ex.id, TODAY)).toBe('deleted');
    expect(await findExercise(db, ex.id)).toBeNull();
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM exercise_subcategories WHERE exercise_id = ?', [ex.id])).toEqual({ n: 0 });
  });

  it('keeps a logged exercise on its workouts but hides it from the list', async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await liftsId(db), 'Rack Pull', 'Back');
    await logOn(db, ex.id, PAST);

    expect(await removeExercise(db, ex.id, TODAY)).toBe('hidden');

    expect(await listed(db)).not.toContain('Rack Pull');
    const logged = (await getWorkout(db, PAST))!.exercises;
    expect(logged.map((e) => e.exerciseName)).toEqual(['Rack Pull']);
    expect(logged[0].sets[0]).toMatchObject({ reps: 5, weight: 100 });
    expect(await findExercise(db, ex.id)).toMatchObject({ name: 'Rack Pull' });
  });

  it('takes it out of the weekly plan and records the plan from today', async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await liftsId(db), 'Rack Pull', 'Back');
    const squat = await findByName(db, 'Squat');
    const day = weekdayOf(FUTURE);
    await setPlanDay(db, day, { isRest: false, items: [{ exerciseId: ex.id }, { exerciseId: squat }] });
    await markPlanComplete(db, '2026-11-01');

    await removeExercise(db, ex.id, TODAY);

    expect((await getPlan(db)).find((d) => d.weekday === day)!.items.map((i) => i.exerciseName)).toEqual(['Squat']);
    const fromToday = (await getPlanHistory(db)).filter((h) => h.effectiveFrom === TODAY);
    expect(fromToday.find((h) => h.weekday === day)).toMatchObject({ exerciseCount: 1 });
  });

  it("doesn't start a plan history while the plan is still being set up", async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await liftsId(db), 'Rack Pull', 'Back');
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: ex.id }] });
    await removeExercise(db, ex.id, TODAY);
    expect(await getPlanHistory(db)).toEqual([]);
  });

  it('drops it from upcoming workouts nothing was logged on, so they follow the new plan', async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await liftsId(db), 'Rack Pull', 'Back');
    await setPlanDay(db, weekdayOf(FUTURE), { isRest: false, items: [{ exerciseId: ex.id }] });
    await ensureWorkout(db, FUTURE);

    expect(await removeExercise(db, ex.id, TODAY)).toBe('deleted');
    expect((await ensureWorkout(db, FUTURE)).exercises).toEqual([]);
  });

  it('refuses a built-in exercise', async () => {
    const db = await createTestDb();
    await expect(removeExercise(db, await findByName(db, 'Squat'), TODAY)).rejects.toThrow(/built-in/i);
    expect(await listed(db)).toContain('Squat');
  });
});

describe('getExerciseUsage', () => {
  it('lists the weekdays it is planned on and counts the workouts it was logged in', async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await liftsId(db), 'Rack Pull', 'Back');
    expect(await getExerciseUsage(db, ex.id)).toEqual({ plannedWeekdays: [], loggedWorkouts: 0 });
    await logOn(db, ex.id, PAST);
    await setPlanDay(db, 5, { isRest: false, items: [{ exerciseId: ex.id }] });
    expect(await getExerciseUsage(db, ex.id)).toEqual({ plannedWeekdays: [weekdayOf(PAST), 5].sort(), loggedWorkouts: 1 });
  });
});

describe('addExercise after a removal', () => {
  it('brings back a removed exercise of the same name, history and all', async () => {
    const db = await createTestDb();
    const lifts = await liftsId(db);
    const ex = await addExercise(db, lifts, 'Rack Pull', 'Back');
    await logOn(db, ex.id, PAST);
    await removeExercise(db, ex.id, TODAY);

    const back = await addExercise(db, lifts, 'rack pull', 'Legs', ['Back']);

    expect(back).toMatchObject({ id: ex.id, name: 'rack pull', subcategory: 'Legs', alsoIn: ['Back'] });
    expect(await listed(db)).toContain('rack pull');
    expect((await getWorkout(db, PAST))!.exercises[0].sets[0].reps).toBe(5);
  });
});

describe('updateExercise', () => {
  it('renames a custom exercise and changes its muscle groups, logged workouts included', async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await liftsId(db), 'Rak Pull', 'Back', ['Arms']);
    await logOn(db, ex.id, PAST);

    const updated = await updateExercise(db, ex.id, { name: '  Rack Pull ', subcategory: 'Legs', alsoIn: ['Back', 'Legs'] });

    expect(updated).toMatchObject({ id: ex.id, name: 'Rack Pull', subcategory: 'Legs', alsoIn: ['Back'] });
    expect(await findExercise(db, ex.id)).toEqual(updated);
    expect((await getWorkout(db, PAST))!.exercises[0].exerciseName).toBe('Rack Pull');
  });

  it('can change only the case of its own name', async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await liftsId(db), 'rack pull');
    expect((await updateExercise(db, ex.id, { name: 'Rack Pull', subcategory: null, alsoIn: [] })).name).toBe('Rack Pull');
  });

  it('rejects a blank name, a name already in the category and a built-in', async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await liftsId(db), 'Rack Pull');
    const edit = (name: string, id = ex.id) => updateExercise(db, id, { name, subcategory: null, alsoIn: [] });
    await expect(edit('  ')).rejects.toThrow(/name/i);
    await expect(edit('squat')).rejects.toThrow(/exists/i);
    await expect(edit('Back Squat', await findByName(db, 'Squat'))).rejects.toThrow(/built-in/i);
    expect((await findExercise(db, ex.id))!.name).toBe('Rack Pull');
  });

  it('says so when the name belongs to an exercise that was removed', async () => {
    const db = await createTestDb();
    const lifts = await liftsId(db);
    const old = await addExercise(db, lifts, 'Sled Push');
    await logOn(db, old.id, PAST);
    await removeExercise(db, old.id, TODAY);
    const ex = await addExercise(db, lifts, 'Sled Drag');
    await expect(updateExercise(db, ex.id, { name: 'sled push', subcategory: null, alsoIn: [] })).rejects.toThrow(/removed/i);
  });
});

describe('what an exercise records by default', () => {
  const cardioId = async (db: Db) => (await listCategoriesWithExercises(db)).find((c) => c.name === 'Cardio')!.id;

  it("starts a custom exercise on its category's default", async () => {
    const db = await createTestDb();
    expect((await addExercise(db, await liftsId(db), 'Rack Pull', 'Back')).fields).toEqual(['weight', 'reps']);
    expect((await addExercise(db, await cardioId(db), 'Rucking')).fields).toEqual(['duration', 'distance']);
  });

  it('lists built-ins with the fields the catalog gives them', async () => {
    const db = await createTestDb();
    const all = (await listCategoriesWithExercises(db)).flatMap((c) => c.exercises);
    expect(all.find((e) => e.name === 'Walking')!.fields).toEqual(['duration', 'distance', 'steps']);
    expect(all.find((e) => e.name === 'Bench Press')!.fields).toEqual(['weight', 'reps']);
  });

  it("changes a built-in's default, in standard order, and can put it back", async () => {
    const db = await createTestDb();
    const walk = await findByName(db, 'Walking');
    expect((await setDefaultFields(db, walk, ['steps', 'duration'])).fields).toEqual(['duration', 'steps']);
    expect((await findExercise(db, walk))!.fields).toEqual(['duration', 'steps']);
    expect((await setDefaultFields(db, walk, null)).fields).toEqual(['duration', 'distance', 'steps']);
  });

  it("changes a custom exercise's default, keeping what was already logged", async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await liftsId(db), 'Sled Push', 'Legs');
    await logOn(db, ex.id, PAST);
    expect((await setDefaultFields(db, ex.id, ['weight', 'shortDistance'])).fields).toEqual(['weight', 'shortDistance']);
    expect((await getWorkout(db, PAST))!.exercises[0].sets[0]).toMatchObject({ reps: 5, weight: 100 });
  });

  it("refuses a field the category doesn't offer, or none", async () => {
    const db = await createTestDb();
    const bench = await findByName(db, 'Bench Press');
    await expect(setDefaultFields(db, bench, ['steps'])).rejects.toThrow('Steps is not available');
    await expect(setDefaultFields(db, bench, [])).rejects.toThrow('Pick at least one thing to record');
    expect((await findExercise(db, bench))!.fields).toEqual(['weight', 'reps']);
  });

  it('leaves workouts already logged recording what they did, and moves the rest to the new default', async () => {
    const db = await createTestDb();
    const walk = await findByName(db, 'Walking');
    await logOn(db, walk, PAST);
    const nextWeek = '2026-11-17'; // the same weekday as PAST, so planned too
    await ensureWorkout(db, nextWeek);
    await setDefaultFields(db, walk, ['duration', 'steps']);
    expect((await getWorkout(db, PAST))!.exercises[0].fields).toEqual(['duration', 'distance', 'steps']);
    expect((await getWorkout(db, nextWeek))!.exercises[0].fields).toEqual(['duration', 'steps']);
  });

  it('asks what to record for custom exercises and the built-ins without an obvious default, until a default is set', async () => {
    const db = await createTestDb();
    const all = (await listCategoriesWithExercises(db)).flatMap((c) => c.exercises);
    expect(all.find((e) => e.name === 'Walking')!.asksWhatToRecord).toBe(true);
    expect(all.find((e) => e.name === 'Bench Press')!.asksWhatToRecord).toBe(false);
    expect(all.find((e) => e.name === 'Climbing')!.asksWhatToRecord).toBe(false);
    const ruck = await addExercise(db, await cardioId(db), 'Rucking');
    expect(ruck.asksWhatToRecord).toBe(true);
    expect((await setDefaultFields(db, ruck.id, ['duration', 'elevation'])).asksWhatToRecord).toBe(false);
    const walk = await findByName(db, 'Walking');
    expect((await setDefaultFields(db, walk, ['duration', 'steps'])).asksWhatToRecord).toBe(false);
    expect((await setDefaultFields(db, walk, null)).asksWhatToRecord).toBe(true);
  });

  it('keeps the default across a rename', async () => {
    const db = await createTestDb();
    const ex = await addExercise(db, await cardioId(db), 'Rucking');
    await setDefaultFields(db, ex.id, ['duration', 'steps']);
    expect((await updateExercise(db, ex.id, { name: 'Ruck', subcategory: null, alsoIn: [] })).fields).toEqual(['duration', 'steps']);
  });
});
