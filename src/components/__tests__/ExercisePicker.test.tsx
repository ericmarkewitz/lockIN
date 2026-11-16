import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { addExercise, findExercise, listCategoriesWithExercises } from '@/data/exercises';
import type { Db } from '@/db/types';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { ExercisePicker } from '../ExercisePicker';

async function open(db?: Db, onPick = jest.fn()) {
  const database = db ?? (await createTestDb());
  await renderWithDb(<ExercisePicker visible onPick={onPick} onClose={jest.fn()} />, database);
  await screen.findByLabelText('Category Lifts');
  return { db: database, onPick };
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
