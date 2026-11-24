import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { createGestureController, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { addExercise, listCategoriesWithExercises } from '@/data/exercises';
import { getPlan, isPlanComplete, setPlanDay } from '@/data/plan';
import { setDistanceUnit } from '@/data/settings';
import { findByName } from '@/test/helpers';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { PlanEditor } from '../PlanEditor';

const pickTargets = async (field: string, sets: number, reps: number) => {
  await fireEvent.press(await screen.findByLabelText(field));
  await fireEvent.press(within(screen.getByLabelText('Sets')).getByText(String(sets)));
  await fireEvent.press(within(screen.getByLabelText('Reps')).getByText(String(reps)));
  await fireEvent.press(screen.getByLabelText('Done'));
};

/** Adds the exercise just picked, when it asks what to record, keeping what the sheet starts on. */
const confirmRecords = async () => fireEvent.press(await screen.findByLabelText(/ to the plan$/));

describe('PlanEditor', () => {
  it('sums up the week above the days and keeps it in step with edits', async () => {
    const db = await createTestDb();
    const squat = await findByName(db, 'Squat');
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: squat, targetSets: 3, targetReps: 5 }] });
    await setPlanDay(db, 2, { isRest: true, items: [] });
    await renderWithDb(<PlanEditor onSaved={jest.fn()} />, db);
    expect(await screen.findByLabelText('Week: 1 training day, 1 rest day')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Sunday rest day'), 'valueChange', true);
    expect(await screen.findByLabelText('Week: 1 training day, 2 rest days')).toBeTruthy();
  });

  it('keeps plan inputs above the keyboard', async () => {
    await renderWithDb(<PlanEditor onSaved={jest.fn()} />, await createTestDb());
    expect(await screen.findByTestId('keyboard-avoider')).toBeTruthy();
    expect(screen.getByTestId('plan-scroll').props).toMatchObject({
      automaticallyAdjustKeyboardInsets: true,
      keyboardShouldPersistTaps: 'handled',
    });
  });

  it('shows sets and reps together, and keeps them when the wheels are cancelled', async () => {
    const db = await createTestDb();
    await renderWithDb(<PlanEditor onSaved={jest.fn()} />, db);
    await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
    await fireEvent.press(await screen.findByLabelText('Add Squat'));
    const field = await screen.findByLabelText('1 Squat sets and reps');
    expect(within(field).getByText('3 × 10')).toBeTruthy();

    await fireEvent.press(field);
    await fireEvent.press(within(screen.getByLabelText('Sets')).getByText('5'));
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(within(screen.getByLabelText('1 Squat sets and reps')).getByText('3 × 10')).toBeTruthy();
  });

  it('sets a target duration in hours, minutes and seconds', async () => {
    const db = await createTestDb();
    const onSaved = jest.fn();
    await renderWithDb(<PlanEditor onSaved={onSaved} />, db);
    await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
    await fireEvent.press(await screen.findByLabelText('Category Cardio'));
    await fireEvent.press(await screen.findByLabelText('Add Running'));
    await fireEvent.press(await screen.findByLabelText('1 Running minutes'));
    await fireEvent.press(within(screen.getByLabelText('Hours')).getByText('1'));
    await fireEvent.press(within(screen.getByLabelText('Seconds')).getByText('20'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(within(screen.getByLabelText('1 Running minutes')).getByText('1h 20s')).toBeTruthy();
    await fireEvent.press(screen.getByText('Save plan'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const item = (await getPlan(db)).find((d) => d.weekday === 1)!.items[0];
    expect(item.targetDurationMin).toBeCloseTo(60 + 20 / 60, 10);
  });

  it('can leave sets and reps blank with the blank row', async () => {
    const db = await createTestDb();
    const onSaved = jest.fn();
    await renderWithDb(<PlanEditor onSaved={onSaved} />, db);
    await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
    await fireEvent.press(await screen.findByLabelText('Add Squat'));
    await fireEvent.press(await screen.findByLabelText('1 Squat sets and reps'));
    await fireEvent.press(within(screen.getByLabelText('Reps')).getByText('–'));
    await fireEvent.press(screen.getByLabelText('Done'));
    await fireEvent.press(screen.getByText('Save plan'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const item = (await getPlan(db)).find((d) => d.weekday === 1)!.items[0];
    expect(item).toMatchObject({ targetSets: 3, targetReps: null });
  });

  it('lists all seven days starting Monday', async () => {
    const db = await createTestDb();
    await renderWithDb(<PlanEditor onSaved={jest.fn()} />, db);
    expect(await screen.findByText('Monday')).toBeTruthy();
    expect(screen.getByText('Sunday')).toBeTruthy();
  });

  it('summarises each day under its name', async () => {
    const db = await createTestDb();
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Squat'), targetSets: 3, targetReps: 5 }] });
    await setPlanDay(db, 0, { isRest: true, items: [] });
    await renderWithDb(<PlanEditor onSaved={jest.fn()} />, db);
    expect(within(await screen.findByTestId('plan-day-1')).getByText('1 exercise')).toBeTruthy();
    expect(within(screen.getByTestId('plan-day-0')).getByText('Rest day')).toBeTruthy();
    expect(within(screen.getByTestId('plan-day-2')).getByText('Nothing planned')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add exercise to Monday'));
    await fireEvent.press(await screen.findByLabelText('Add Lunge'));
    expect(within(screen.getByTestId('plan-day-1')).getByText('2 exercises')).toBeTruthy();
  });

  it('keeps Save plan in a footer outside the scrolling list', async () => {
    await renderWithDb(<PlanEditor onSaved={jest.fn()} onCancel={jest.fn()} />, await createTestDb());
    const footer = within(await screen.findByTestId('plan-footer'));
    expect(footer.getByText('Save plan')).toBeTruthy();
    expect(footer.getByText('Cancel')).toBeTruthy();
    expect(within(screen.getByTestId('plan-scroll')).queryByText('Save plan')).toBeNull();
  });

  it('builds a plan with a lift day, a cardio day and a rest day, then saves', async () => {
    const db = await createTestDb();
    const onSaved = jest.fn();
    await renderWithDb(<PlanEditor onSaved={onSaved} />, db);

    await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
    await fireEvent.press(await screen.findByLabelText('Add Bench Press'));
    await pickTargets('1 Bench Press sets and reps', 4, 6);

    await fireEvent.press(screen.getByLabelText('Add exercise to Wednesday'));
    await fireEvent.press(await screen.findByLabelText('Category Cardio'));
    await fireEvent.press(await screen.findByLabelText('Add Running'));
    await fireEvent.press(await screen.findByLabelText('3 Running minutes'));
    await fireEvent.press(within(screen.getByLabelText('Minutes')).getByText('30'));
    await fireEvent.press(screen.getByLabelText('Done'));
    await fireEvent.changeText(screen.getByLabelText('3 Running distance'), '3.1');

    await fireEvent(screen.getByLabelText('Sunday rest day'), 'valueChange', true);
    await fireEvent.press(screen.getByText('Save plan'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const plan = await getPlan(db);
    expect(plan.find((d) => d.weekday === 1)!.items[0]).toMatchObject({ exerciseName: 'Bench Press', targetSets: 4, targetReps: 6 });
    expect(plan.find((d) => d.weekday === 3)!.items[0]).toMatchObject({ exerciseName: 'Running', targetDurationMin: 30, targetDistance: 3.1 });
    expect(plan.find((d) => d.weekday === 0)!.isRest).toBe(true);
    expect(await isPlanComplete(db)).toBe(true);
  });

  it('can create a custom exercise from the picker', async () => {
    const db = await createTestDb();
    await renderWithDb(<PlanEditor onSaved={jest.fn()} />, db);
    await fireEvent.press(await screen.findByLabelText('Add exercise to Friday'));
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Sled Push');
    await fireEvent.press(screen.getByLabelText('Create Sled Push'));
    await confirmRecords();
    expect(await screen.findByText('Sled Push')).toBeTruthy();
  });

  it('follows a custom exercise edited or removed from the picker', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    await addExercise(db, lifts.id, 'Rak Pull', 'Back');
    await addExercise(db, lifts.id, 'Sled Push', 'Legs');
    await renderWithDb(<PlanEditor onSaved={jest.fn()} />, db);
    await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
    await fireEvent.press(await screen.findByLabelText('Add Rak Pull'));
    await confirmRecords();
    await fireEvent.press(screen.getByLabelText('Add exercise to Monday'));
    await fireEvent.press(await screen.findByLabelText('Add Sled Push'));
    await confirmRecords();

    await fireEvent.press(screen.getByLabelText('Add exercise to Tuesday'));
    await fireEvent(await screen.findByLabelText('Add Rak Pull'), 'longPress');
    await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'Rack Pull');
    await fireEvent.press(screen.getByLabelText('Save exercise'));
    await fireEvent(await screen.findByLabelText('Add Sled Push'), 'longPress');
    await fireEvent.press(screen.getByLabelText('Remove exercise'));
    await fireEvent.press(screen.getByLabelText('Remove'));
    await waitFor(() => expect(screen.queryByLabelText('Exercise name')).toBeNull());
    await fireEvent.press(screen.getAllByLabelText('Cancel')[0]);

    expect(await screen.findByLabelText('Remove Rack Pull from Monday')).toBeTruthy();
    expect(screen.queryByLabelText('Remove Sled Push from Monday')).toBeNull();
    await fireEvent.press(screen.getByText('Save plan'));
    await waitFor(async () =>
      expect((await getPlan(db)).find((d) => d.weekday === 1)!.items.map((i) => i.exerciseName)).toEqual(['Rack Pull']));
  });

  it('removes an exercise from a day', async () => {
    const db = await createTestDb();
    await renderWithDb(<PlanEditor onSaved={jest.fn()} />, db);
    await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
    await fireEvent.press(await screen.findByLabelText('Add Squat'));
    await fireEvent.press(await screen.findByLabelText('Remove Squat from Monday'));
    expect(screen.queryByLabelText('Remove Squat from Monday')).toBeNull();
  });

  it('reorders exercises via the drag handle accessibility actions, keeping targets, and saves the order', async () => {
    const db = await createTestDb();
    const onSaved = jest.fn();
    await renderWithDb(<PlanEditor onSaved={onSaved} />, db);
    for (const name of ['Squat', 'Leg Press', 'Lunge']) {
      await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
      await fireEvent.press(await screen.findByLabelText(`Add ${name}`));
    }
    await pickTargets('1 Lunge sets and reps', 5, 10);

    const act = (label: string, actionName: string) =>
      fireEvent(screen.getByLabelText(label), 'accessibilityAction', { nativeEvent: { actionName } });
    await act('Reorder Lunge on Monday', 'moveUp'); // Squat, Lunge, Leg Press
    await act('Reorder Squat on Monday', 'moveDown'); // Lunge, Squat, Leg Press
    await fireEvent.press(screen.getByText('Save plan'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const items = (await getPlan(db)).find((d) => d.weekday === 1)!.items;
    expect(items.map((i) => i.exerciseName)).toEqual(['Lunge', 'Squat', 'Leg Press']);
    expect(items[0]).toMatchObject({ targetSets: 5 });
  });

  it('keeps the page where it is while an exercise is dragged', async () => {
    const db = await createTestDb();
    await renderWithDb(<PlanEditor onSaved={jest.fn()} />, db);
    for (const name of ['Squat', 'Lunge']) {
      await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
      await fireEvent.press(await screen.findByLabelText(`Add ${name}`));
    }
    // Holding the handle stops the scroll view's own gesture from starting.
    const relations = () => (getByGestureTestId('drag-Squat-1') as { gestureRelations?: { blocksHandlers: number[] } }).gestureRelations;
    await waitFor(() => expect(relations()?.blocksHandlers).toHaveLength(1));

    const drag = createGestureController('drag-Squat-1');
    await act(() => {
      drag.begin();
      drag.activate({ translationY: 0 });
    });
    // Toggling scrolling under the large title makes iOS jump the page.
    expect(screen.getByTestId('plan-scroll').props.scrollEnabled).not.toBe(false);
    await act(() => drag.end({ translationY: 0 }));
  });

  it('ignores moves past either end of the list', async () => {
    const db = await createTestDb();
    const onSaved = jest.fn();
    await renderWithDb(<PlanEditor onSaved={onSaved} />, db);
    for (const name of ['Squat', 'Lunge']) {
      await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
      await fireEvent.press(await screen.findByLabelText(`Add ${name}`));
    }
    await fireEvent(screen.getByLabelText('Reorder Squat on Monday'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    await fireEvent(screen.getByLabelText('Reorder Lunge on Monday'), 'accessibilityAction', { nativeEvent: { actionName: 'moveDown' } });
    await fireEvent.press(screen.getByText('Save plan'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const items = (await getPlan(db)).find((d) => d.weekday === 1)!.items;
    expect(items.map((i) => i.exerciseName)).toEqual(['Squat', 'Lunge']);
  });

  describe('target distance units', () => {
    async function setup(targetDistance: number) {
      const db = await createTestDb();
      await setDistanceUnit(db, 'km');
      await setPlanDay(db, 3, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDistance }] });
      const onSaved = jest.fn();
      await renderWithDb(<PlanEditor onSaved={onSaved} />, db);
      const save = async () => {
        await fireEvent.press(screen.getByText('Save plan'));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        return (await getPlan(db)).find((d) => d.weekday === 3)!.items[0].targetDistance;
      };
      return save;
    }

    it('shows the target in the selected unit and stores a typed km target as miles', async () => {
      const save = await setup(3.1);
      const field = await screen.findByLabelText('3 Running distance');
      expect(field.props.value).toBe('4.99');
      expect(screen.getByLabelText('3 Running distance unit').props.accessibilityValue).toEqual({ text: 'km' });
      await fireEvent.changeText(field, '10');
      expect(await save()).toBeCloseTo(10 / 1.609344, 6);
    });

    it('keeps an untouched target exactly, despite rounding for display', async () => {
      const save = await setup(3.1);
      await screen.findByLabelText('3 Running distance');
      expect(await save()).toBe(3.1);
    });

    it('can enter a target in the other unit', async () => {
      const save = await setup(3.1);
      await fireEvent.changeText(await screen.findByLabelText('3 Running distance'), '3');
      await fireEvent.press(screen.getByLabelText('3 Running distance unit'));
      expect(screen.getByLabelText('3 Running distance unit').props.accessibilityValue).toEqual({ text: 'mi' });
      expect(screen.getByLabelText('3 Running distance').props.value).toBe('3');
      expect(await save()).toBe(3);
    });
  });

  describe('targets for exercises that record something else', () => {
    async function planned(name: string, targets: Record<string, number> = {}) {
      const db = await createTestDb();
      await setPlanDay(db, 3, { isRest: false, items: [{ exerciseId: await findByName(db, name), ...targets }] });
      const onSaved = jest.fn();
      await renderWithDb(<PlanEditor onSaved={onSaved} />, db);
      await screen.findByText(name);
      const save = async () => {
        await fireEvent.press(screen.getByText('Save plan'));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        return (await getPlan(db)).find((d) => d.weekday === 3)!.items[0];
      };
      return save;
    }

    it('plans a step count for a walk, alongside time and distance', async () => {
      const save = await planned('Walking', { targetCount: 8000 });
      expect(screen.getByLabelText('3 Walking minutes')).toBeTruthy();
      expect(screen.getByLabelText('3 Walking distance')).toBeTruthy();
      const steps = screen.getByLabelText('3 Walking steps');
      expect(steps.props.value).toBe('8000');
      await fireEvent.changeText(steps, '10000');
      expect(await save()).toMatchObject({ targetCount: 10000 });
    });

    it('plans routes but no distance for climbing', async () => {
      const save = await planned('Climbing');
      expect(screen.queryByLabelText('3 Climbing distance')).toBeNull();
      await fireEvent.changeText(screen.getByLabelText('3 Climbing routes'), '12');
      expect(await save()).toMatchObject({ targetCount: 12, targetDistance: null });
    });

    it('plans sets and a hold time for a plank, with no reps', async () => {
      const save = await planned('Weighted Plank', { targetSets: 3, targetReps: 10 });
      expect(screen.queryByLabelText('3 Weighted Plank sets and reps')).toBeNull();
      expect(within(screen.getByLabelText('3 Weighted Plank sets')).getByText('3 sets')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('3 Weighted Plank minutes'));
      await fireEvent.press(within(screen.getByLabelText('Minutes')).getByText('1'));
      await fireEvent.press(screen.getByLabelText('Done'));
      expect(await save()).toMatchObject({ targetSets: 3, targetReps: null, targetDurationMin: 1 });
    });

    it('plans a swim distance in yards or meters', async () => {
      const save = await planned('Swimming');
      expect(screen.getByLabelText('3 Swimming distance unit').props.accessibilityValue).toEqual({ text: 'yd' });
      await fireEvent.changeText(screen.getByLabelText('3 Swimming distance'), '880');
      expect((await save()).targetDistance).toBeCloseTo(0.5, 9);
    });

    it('adds an exercise with an obvious default without asking', async () => {
      await renderWithDb(<PlanEditor onSaved={jest.fn()} />, await createTestDb());
      await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
      await fireEvent.press(await screen.findByLabelText('Add Squat'));
      expect(await screen.findByLabelText('1 Squat sets and reps')).toBeTruthy();
      expect(screen.queryByText('What to record')).toBeNull();
    });

    it('asks for a custom exercise', async () => {
      await renderWithDb(<PlanEditor onSaved={jest.fn()} />, await createTestDb());
      await fireEvent.press(await screen.findByLabelText('Add exercise to Friday'));
      await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Bouldering');
      await fireEvent.press(screen.getByLabelText('Category Cardio'));
      await fireEvent.press(screen.getByLabelText('Create Bouldering'));
      expect(await screen.findByText('What to record')).toBeTruthy();
    });

    it('changes what any plan item records from its row', async () => {
      const db = await createTestDb();
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDurationMin: 30 }] });
      const onSaved = jest.fn();
      await renderWithDb(<PlanEditor onSaved={onSaved} />, db);
      await fireEvent.press(await screen.findByLabelText('Change what Running records on Monday'));
      await fireEvent.press(screen.getByLabelText('Record Elevation gain'));
      await fireEvent.press(screen.getByLabelText('Save Running'));
      await fireEvent.press(screen.getByText('Save plan'));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect((await getPlan(db)).find((d) => d.weekday === 1)!.items[0]).toMatchObject({
        ownFields: ['duration', 'distance', 'elevation'], targetDurationMin: 30,
      });
    });

    it('starts a newly added plank on 3 sets and no reps', async () => {
      const db = await createTestDb();
      await renderWithDb(<PlanEditor onSaved={jest.fn()} />, db);
      await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
      await fireEvent.press((await screen.findAllByLabelText('Add Weighted Plank'))[0]);
      expect(within(await screen.findByLabelText('1 Weighted Plank sets')).getByText('3 sets')).toBeTruthy();
    });
  });

  describe('asking what to record when adding an exercise', () => {
    async function pickWalking() {
      const db = await createTestDb();
      const onSaved = jest.fn();
      await renderWithDb(<PlanEditor onSaved={onSaved} />, db);
      await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
      await fireEvent.press(await screen.findByLabelText('Category Cardio'));
      await fireEvent.press(await screen.findByLabelText('Add Walking'));
      expect(await screen.findByText('What to record')).toBeTruthy();
      return { db, onSaved };
    }

    it("starts on the exercise's default and plans what's picked", async () => {
      const { db, onSaved } = await pickWalking();
      expect(screen.getByLabelText('Record Steps').props.accessibilityState).toMatchObject({ selected: true });
      await fireEvent.press(screen.getByLabelText('Record Distance (mi/km)'));
      await fireEvent.press(screen.getByLabelText('Add Walking to the plan'));
      expect(await screen.findByLabelText('1 Walking steps')).toBeTruthy();
      expect(screen.queryByLabelText('1 Walking distance')).toBeNull();
      await fireEvent.press(screen.getByText('Save plan'));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect((await getPlan(db)).find((d) => d.weekday === 1)!.items[0]).toMatchObject({ ownFields: ['duration', 'steps'] });
    });

    it('adds nothing when cancelled', async () => {
      await pickWalking();
      await fireEvent.press(screen.getByText('Cancel'));
      expect(screen.queryByText('What to record')).toBeNull();
      expect(screen.queryByLabelText('1 Walking minutes')).toBeNull();
    });

    it('keeps what a saved item records when the plan is opened again', async () => {
      const db = await createTestDb();
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Walking'), fields: ['duration', 'steps'] }] });
      const onSaved = jest.fn();
      await renderWithDb(<PlanEditor onSaved={onSaved} />, db);
      expect(await screen.findByLabelText('1 Walking steps')).toBeTruthy();
      expect(screen.queryByLabelText('1 Walking distance')).toBeNull();
      await fireEvent.press(screen.getByText('Save plan'));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect((await getPlan(db)).find((d) => d.weekday === 1)!.items[0].ownFields).toEqual(['duration', 'steps']);
    });
  });
});

