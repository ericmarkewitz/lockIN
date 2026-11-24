import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { addExercise, findExercise, listCategoriesWithExercises } from '@/data/exercises';
import { setPlanDay } from '@/data/plan';
import { ensureWorkout, updateSet } from '@/data/workouts';
import type { Db } from '@/db/types';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { ExercisePicker } from '../ExercisePicker';

async function open(db?: Db, onPick = jest.fn(), more: { onEdited?: jest.Mock; onRemoved?: jest.Mock } = {}) {
  const database = db ?? (await createTestDb());
  await renderWithDb(<ExercisePicker visible onPick={onPick} onClose={jest.fn()} {...more} />, database);
  await screen.findByLabelText('Category Lifts');
  return { db: database, onPick };
}

/** A database with a custom Rack Pull filed under Back and Legs. */
async function withRackPull() {
  const db = await createTestDb();
  const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
  const ex = await addExercise(db, lifts.id, 'Rack Pull', 'Back', ['Legs']);
  return { db, ex };
}

describe('ExercisePicker', () => {
  it('keeps the search field inside a keyboard-avoiding container', async () => {
    await open();
    expect(await screen.findByLabelText('Search exercises')).toBeTruthy();
    expect(screen.getByTestId('picker-keyboard-avoider')).toBeTruthy();
  });

  it('lists every lift grouped under muscle-group headers by default', async () => {
    await open();
    expect(await screen.findByRole('header', { name: 'Chest' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Legs' })).toBeTruthy();
    expect(screen.getByLabelText('Add Bench Press')).toBeTruthy();
    expect(screen.getByLabelText('Add Squat')).toBeTruthy();
    expect(screen.getByLabelText('Show all exercises').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('filters the list to the selected muscle group', async () => {
    await open();
    await fireEvent.press(await screen.findByLabelText('Subcategory Chest'));
    expect(screen.getByLabelText('Add Bench Press')).toBeTruthy();
    expect(screen.queryByLabelText('Add Squat')).toBeNull();
    expect(screen.getByLabelText('Subcategory Chest').props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByLabelText('Show all exercises'));
    expect(screen.getByLabelText('Add Squat')).toBeTruthy();
  });

  it('shows an exercise under each muscle group it works', async () => {
    await open();
    expect(await screen.findAllByLabelText('Add Deadlift')).toHaveLength(2); // under Back and under Legs
    await fireEvent.press(screen.getByLabelText('Subcategory Legs'));
    expect(screen.getByLabelText('Add Deadlift')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Subcategory Chest'));
    expect(screen.queryByLabelText('Add Deadlift')).toBeNull();
  });

  it('says so when a muscle group has no exercises yet', async () => {
    const db = await createTestDb();
    await db.runAsync("DELETE FROM exercises WHERE subcategory = 'Core'");
    await open(db);
    await fireEvent.press(await screen.findByLabelText('Subcategory Core'));
    expect(screen.getByText('No Core exercises yet.')).toBeTruthy();
  });

  it('shows Other only when there are uncategorized lifts', async () => {
    const db = await createTestDb();
    await open(db);
    expect(screen.queryByLabelText('Subcategory Other')).toBeNull();
    screen.unmount();

    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    await addExercise(db, lifts.id, 'Sandbag Carry');
    await open(db);
    await fireEvent.press(await screen.findByLabelText('Subcategory Other'));
    expect(screen.getByLabelText('Add Sandbag Carry')).toBeTruthy();
    expect(screen.queryByLabelText('Add Bench Press')).toBeNull();
  });

  it('shows a flat list with no subcategory chips for other categories', async () => {
    await open();
    await fireEvent.press(await screen.findByLabelText('Category Cardio'));
    expect(screen.getByLabelText('Add Running')).toBeTruthy();
    expect(screen.queryByLabelText('Subcategory Chest')).toBeNull();
    expect(screen.queryByLabelText('Show all exercises')).toBeNull();
    expect(screen.queryByRole('header', { name: 'Other' })).toBeNull();
  });

  it('forgets the muscle group after switching category', async () => {
    await open();
    await fireEvent.press(await screen.findByLabelText('Subcategory Chest'));
    await fireEvent.press(screen.getByLabelText('Category Cardio'));
    await fireEvent.press(screen.getByLabelText('Category Lifts'));
    expect(screen.getByLabelText('Add Squat')).toBeTruthy();
  });

  it('adds a custom lift to the selected muscle group', async () => {
    const { db, onPick } = await open();
    await fireEvent.press(await screen.findByLabelText('Subcategory Chest'));
    await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Cable Fly');
    expect(screen.getByText('in Lifts · Chest')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Create Cable Fly'));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const created = onPick.mock.calls[0][0];
    expect(created).toMatchObject({ name: 'Cable Fly', subcategory: 'Chest' });
    expect((await findExercise(db, created.id))?.subcategory).toBe('Chest');
  });

  describe('muscle groups for a new lift', () => {
    const chip = (s: string) => screen.getByLabelText(`Muscle group ${s}`);

    it("starts with the tab's muscle group picked and adds any others tapped", async () => {
      const { db, onPick } = await open();
      await fireEvent.press(await screen.findByLabelText('Subcategory Back'));
      await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Rack Pull');
      expect(chip('Back').props.accessibilityState).toMatchObject({ selected: true });
      expect(chip('Legs').props.accessibilityState).toMatchObject({ selected: false });
      await fireEvent.press(chip('Legs'));
      expect(screen.getByText('in Lifts · Back, Legs')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Create Rack Pull'));
      await waitFor(() => expect(onPick).toHaveBeenCalled());
      expect(await findExercise(db, onPick.mock.calls[0][0].id)).toMatchObject({ subcategory: 'Back', alsoIn: ['Legs'] });
    });

    it('makes the first group picked the main one', async () => {
      const { onPick } = await open();
      await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Sled Push');
      await fireEvent.press(chip('Legs'));
      await fireEvent.press(chip('Chest'));
      expect(screen.getByText('in Lifts · Legs, Chest')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Create Sled Push'));
      await waitFor(() => expect(onPick).toHaveBeenCalled());
      expect(onPick.mock.calls[0][0]).toMatchObject({ subcategory: 'Legs', alsoIn: ['Chest'] });
    });

    it("can drop the tab's group, leaving the lift uncategorized", async () => {
      const { onPick } = await open();
      await fireEvent.press(await screen.findByLabelText('Subcategory Chest'));
      await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Cable Fly');
      await fireEvent.press(chip('Chest'));
      expect(screen.getByText('in Lifts')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Create Cable Fly'));
      await waitFor(() => expect(onPick).toHaveBeenCalled());
      expect(onPick.mock.calls[0][0]).toMatchObject({ subcategory: null, alsoIn: [] });
    });

    it('starts over for the next exercise', async () => {
      const { onPick } = await open();
      await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Sled Push');
      await fireEvent.press(chip('Legs'));
      await fireEvent.press(screen.getByLabelText('Create Sled Push'));
      await waitFor(() => expect(onPick).toHaveBeenCalled());
      await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Sled Drag');
      expect(chip('Legs').props.accessibilityState).toMatchObject({ selected: false });
    });

    it('offers no muscle groups outside lifts', async () => {
      await open();
      await fireEvent.press(await screen.findByLabelText('Category Cardio'));
      await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Pickleball');
      expect(screen.getByLabelText('Create Pickleball')).toBeTruthy();
      expect(screen.queryByLabelText('Muscle group Legs')).toBeNull();
    });
  });

  describe('yoga and mobility', () => {
    const chip = (s: string) => screen.getByLabelText(`Type ${s}`);
    const openYogaMobility = async (db?: Db) => {
      const r = await open(db);
      await fireEvent.press(await screen.findByLabelText('Category Mind & Body'));
      return r;
    };

    it('are one category, split into Yoga and Mobility', async () => {
      await openYogaMobility();
      expect(screen.queryByLabelText('Category Yoga')).toBeNull();
      expect(screen.queryByLabelText('Category Mobility')).toBeNull();
      expect(screen.getByRole('header', { name: 'Yoga' })).toBeTruthy();
      expect(screen.getByRole('header', { name: 'Mobility' })).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Subcategory Mobility'));
      expect(screen.getByLabelText('Add Stretching')).toBeTruthy();
      expect(screen.queryByLabelText('Add Vinyasa')).toBeNull();
    });

    it('files a new exercise under the tab it was created from', async () => {
      const { db, onPick } = await openYogaMobility();
      await fireEvent.press(screen.getByLabelText('Subcategory Mobility'));
      await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Band Work');
      expect(chip('Mobility').props.accessibilityState).toMatchObject({ selected: true });
      expect(chip('Yoga').props.accessibilityState).toMatchObject({ selected: false });
      expect(screen.queryByLabelText('Muscle group Legs')).toBeNull();
      await fireEvent.press(screen.getByLabelText('Create Band Work'));
      await waitFor(() => expect(onPick).toHaveBeenCalled());
      expect(await findExercise(db, onPick.mock.calls[0][0].id)).toMatchObject({ subcategory: 'Mobility', alsoIn: [] });
    });

    it('moves a custom exercise between yoga and mobility when edited', async () => {
      const db = await createTestDb();
      const cat = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Mind & Body')!;
      const ex = await addExercise(db, cat.id, 'Kundalini', 'Mobility');
      const onEdited = jest.fn();
      await renderWithDb(<ExercisePicker visible onPick={jest.fn()} onClose={jest.fn()} onEdited={onEdited} />, db);
      await fireEvent.press(await screen.findByLabelText('Category Mind & Body'));
      await fireEvent(screen.getByLabelText('Add Kundalini'), 'longPress');
      expect(screen.getByText('Types · the first is its main one')).toBeTruthy();
      await fireEvent.press(chip('Mobility'));
      await fireEvent.press(chip('Yoga'));
      await fireEvent.press(screen.getByLabelText('Save exercise'));
      await waitFor(() => expect(onEdited).toHaveBeenCalled());
      expect(await findExercise(db, ex.id)).toMatchObject({ subcategory: 'Yoga', alsoIn: [] });
    });
  });

  describe('editing a custom exercise', () => {
    const hold = async (name: string) => fireEvent(screen.getAllByLabelText(`Add ${name}`)[0], 'longPress');
    const chip = (s: string) => screen.getByLabelText(`Muscle group ${s}`);

    it('tells you a custom card can be held to edit, and only a custom one', async () => {
      const { db } = await withRackPull();
      await open(db);
      expect(screen.getAllByLabelText('Add Rack Pull')[0].props.accessibilityHint).toBe('Hold to edit');
      expect(screen.getAllByText('Hold to edit').length).toBeGreaterThan(0);
      await fireEvent(screen.getByLabelText('Add Squat'), 'longPress');
      expect(screen.queryByLabelText('Exercise name')).toBeNull();
    });

    it('renames it and changes its muscle groups', async () => {
      const { db, ex } = await withRackPull();
      const onEdited = jest.fn();
      await open(db, jest.fn(), { onEdited });
      await hold('Rack Pull');
      expect(screen.getByLabelText('Exercise name').props.value).toBe('Rack Pull');
      expect(chip('Back').props.accessibilityState).toMatchObject({ selected: true });
      expect(chip('Legs').props.accessibilityState).toMatchObject({ selected: true });

      await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'Block Pull');
      await fireEvent.press(chip('Back'));
      await fireEvent.press(chip('Core'));
      await fireEvent.press(screen.getByLabelText('Save exercise'));

      await waitFor(() => expect(onEdited).toHaveBeenCalled());
      expect(await findExercise(db, ex.id)).toMatchObject({ name: 'Block Pull', subcategory: 'Legs', alsoIn: ['Core'] });
      expect(screen.queryByLabelText('Exercise name')).toBeNull();
      expect((await screen.findAllByLabelText('Add Block Pull')).length).toBeGreaterThan(0);
      expect(screen.queryByLabelText('Add Rack Pull')).toBeNull();
    });


    it("shows why a name can't be used, and keeps the sheet open", async () => {
      const { db } = await withRackPull();
      await open(db);
      await hold('Rack Pull');
      await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'squat');
      await fireEvent.press(screen.getByLabelText('Save exercise'));
      expect(await screen.findByText('"squat" already exists in this category')).toBeTruthy();
      expect(screen.getByLabelText('Exercise name')).toBeTruthy();
    });

    it('closes without changes on Cancel', async () => {
      const { db, ex } = await withRackPull();
      await open(db);
      await hold('Rack Pull');
      await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'Block Pull');
      await fireEvent.press(screen.getByLabelText('Cancel editing'));
      expect(screen.queryByLabelText('Exercise name')).toBeNull();
      expect((await findExercise(db, ex.id))!.name).toBe('Rack Pull');
    });

    it('removes an unused exercise after asking', async () => {
      const { db, ex } = await withRackPull();
      const onRemoved = jest.fn();
      await open(db, jest.fn(), { onRemoved });
      await hold('Rack Pull');
      await fireEvent.press(screen.getByLabelText('Remove exercise'));
      expect(screen.getByText('Remove Rack Pull?')).toBeTruthy();
      expect(screen.getByText("It isn't in your plan and hasn't been logged.")).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Remove'));
      await waitFor(() => expect(onRemoved).toHaveBeenCalledWith(ex.id));
      expect(await findExercise(db, ex.id)).toBeNull();
      expect(screen.queryByLabelText('Add Rack Pull')).toBeNull();
      expect(screen.queryByLabelText('Exercise name')).toBeNull();
    });

    it('says what happens to the plan and to logged workouts', async () => {
      const { db, ex } = await withRackPull();
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: ex.id, targetSets: 1 }] });
      await setPlanDay(db, 4, { isRest: false, items: [{ exerciseId: ex.id, targetSets: 1 }] });
      const w = await ensureWorkout(db, '2026-11-02');
      await updateSet(db, w.exercises[0].sets[0].id, { reps: 5 });
      await open(db);
      await hold('Rack Pull');
      await fireEvent.press(screen.getByLabelText('Remove exercise'));
      expect(screen.getByText(
        'It comes off your plan on Monday and Thursday. The 1 workout you logged it in keeps it.',
      )).toBeTruthy();
    });

    it('keeps the exercise when the removal is cancelled', async () => {
      const { db, ex } = await withRackPull();
      await open(db);
      await hold('Rack Pull');
      await fireEvent.press(screen.getByLabelText('Remove exercise'));
      await fireEvent.press(screen.getAllByLabelText('Cancel').at(-1)!); // the dialog's
      expect(screen.queryByText('Remove Rack Pull?')).toBeNull();
      expect(screen.getByLabelText('Exercise name')).toBeTruthy();
      expect(await findExercise(db, ex.id)).not.toBeNull();
    });
  });

  it('shows a stick figure on built-in exercise cards but not on custom ones', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    await addExercise(db, lifts.id, 'Sandbag Carry');
    await open(db);
    expect(await screen.findByTestId('motion-Bench Press', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Add Sandbag Carry')).toBeTruthy();
    expect(screen.queryByTestId('motion-Sandbag Carry', { includeHiddenElements: true })).toBeNull();
  });

  it('adds an exercise when its card is tapped', async () => {
    const { onPick } = await open();
    await fireEvent.press(await screen.findByLabelText('Add Bench Press'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bench Press' }));
  });

  it('lays exercises out as cards in two columns', async () => {
    await open();
    const grid = (await screen.findAllByTestId('exercise-grid'))[0];
    expect(grid).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(screen.getByLabelText('Add Bench Press')).toHaveStyle({ width: '48%' });
  });

  it.each(['Show all exercises', 'Subcategory Other'])('leaves a custom lift uncategorized when created from %s', async (chip) => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    await addExercise(db, lifts.id, 'Sandbag Carry');
    const { onPick } = await open(db);
    await fireEvent.press(await screen.findByLabelText(chip));
    await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Sled Push');
    expect(screen.getByText('in Lifts')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Create Sled Push'));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(onPick.mock.calls[0][0]).toMatchObject({ name: 'Sled Push', subcategory: null });
  });

  describe('search', () => {
    it('filters the current category as you type', async () => {
      await open();
      await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'press');
      expect(screen.getByLabelText('Add Bench Press')).toBeTruthy();
      expect(screen.getByLabelText('Add Leg Press')).toBeTruthy();
      expect(screen.queryByLabelText('Add Squat')).toBeNull();
    });

    it('hides the muscle-group tabs while searching and brings them back when cleared', async () => {
      await open();
      await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'press');
      expect(screen.queryByLabelText('Subcategory Chest')).toBeNull();
      await fireEvent.press(screen.getByLabelText('Clear search'));
      expect(screen.getByLabelText('Subcategory Chest')).toBeTruthy();
      expect(screen.getByLabelText('Add Squat')).toBeTruthy();
    });

    it('shows matches from other categories in their own section', async () => {
      const { onPick } = await open();
      await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'run');
      expect(screen.getByRole('header', { name: 'Other categories' })).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Add Running'));
      expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Running' }));
    });

    it('offers to create the typed name only when it is not already an exercise here', async () => {
      await open();
      await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'bench press');
      expect(screen.queryByLabelText('Create bench press')).toBeNull();
      await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Cable Fly');
      expect(screen.getByLabelText('Create Cable Fly')).toBeTruthy();
      expect(screen.getByText('No matches in Lifts.')).toBeTruthy();
    });

    it('creates the exercise in the category being browsed', async () => {
      const { onPick } = await open();
      await fireEvent.press(await screen.findByLabelText('Category Cardio'));
      await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Kayaking');
      expect(screen.getByText('in Cardio')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Create Kayaking'));
      await waitFor(() => expect(onPick).toHaveBeenCalled());
      expect(onPick.mock.calls[0][0]).toMatchObject({ name: 'Kayaking', categoryName: 'Cardio', isCustom: true });
    });
  });
});
