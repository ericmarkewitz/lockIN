import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

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
  it('keeps the custom exercise input inside a keyboard-avoiding container', async () => {
    await open();
    expect(await screen.findByLabelText('New exercise name')).toBeTruthy();
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

  it('says so when a muscle group has no exercises yet', async () => {
    await open();
    await fireEvent.press(await screen.findByLabelText('Subcategory Core'));
    expect(screen.getByText('No Core exercises yet.')).toBeTruthy();
  });

  it('shows Other only when there are uncategorized lifts', async () => {
    const db = await createTestDb();
    await open(db);
    expect(screen.queryByLabelText('Subcategory Other')).toBeNull();
    screen.unmount();

    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    await addExercise(db, lifts.id, 'Farmer Carry');
    await open(db);
    await fireEvent.press(await screen.findByLabelText('Subcategory Other'));
    expect(screen.getByLabelText('Add Farmer Carry')).toBeTruthy();
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
    expect(screen.getByPlaceholderText('New Chest exercise')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('New exercise name'), 'Cable Fly');
    await fireEvent.press(screen.getByText('Create'));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const created = onPick.mock.calls[0][0];
    expect(created).toMatchObject({ name: 'Cable Fly', subcategory: 'Chest' });
    expect((await findExercise(db, created.id))?.subcategory).toBe('Chest');
  });

  it('shows an animation on built-in exercise cards but not on custom ones', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    await addExercise(db, lifts.id, 'Farmer Carry');
    await open(db);
    expect(await screen.findByTestId('motion-Bench Press', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Add Farmer Carry')).toBeTruthy();
    expect(screen.queryByTestId('motion-Farmer Carry', { includeHiddenElements: true })).toBeNull();
  });

  it('previews an exercise in motion when its stick figure is tapped, without adding it', async () => {
    const { onPick } = await open();
    await fireEvent.press(await screen.findByLabelText('Show how to do Bench Press'));
    expect(screen.getByRole('header', { name: 'Bench Press' })).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();

    expect(screen.getByLabelText('Cancel preview')).toHaveTextContent('Cancel');
    await fireEvent.press(screen.getByLabelText('Cancel preview'));
    expect(screen.queryByRole('header', { name: 'Bench Press' })).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('puts a small info button on built-in cards, separate from the card', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    await addExercise(db, lifts.id, 'Farmer Carry');
    await open(db);
    const info = await screen.findByLabelText('Show how to do Bench Press');
    expect(within(info).getByText('i')).toBeTruthy();
    expect(within(info).queryByTestId('motion-Bench Press', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByLabelText('Show how to do Farmer Carry')).toBeNull();
  });

  // Stacking a second Modal on the picker crashed iOS when Add dismissed both at once.
  it('shows the preview inside the picker sheet rather than as a second modal', async () => {
    await open();
    await fireEvent.press(await screen.findByLabelText('Show how to do Bench Press'));
    const sheet = screen.getByTestId('picker-sheet');
    expect(within(sheet).getByTestId('exercise-preview')).toBeTruthy();
    expect(within(sheet).getByRole('header', { name: 'Bench Press' })).toBeTruthy();
  });

  it('closes the preview, not the picker, on the Android back button', async () => {
    const onClose = jest.fn();
    const db = await createTestDb();
    await renderWithDb(<ExercisePicker visible onPick={jest.fn()} onClose={onClose} />, db);
    await fireEvent.press(await screen.findByLabelText('Show how to do Bench Press'));
    await fireEvent(screen.getByTestId('picker-sheet').parent!, 'requestClose');
    expect(screen.queryByTestId('exercise-preview')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('adds the previewed exercise from the preview', async () => {
    const { onPick } = await open();
    await fireEvent.press(await screen.findByLabelText('Show how to do Squat'));
    await fireEvent.press(screen.getByText('Add'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Squat' }));
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
    await addExercise(db, lifts.id, 'Farmer Carry');
    const { onPick } = await open(db);
    await fireEvent.press(await screen.findByLabelText(chip));
    await fireEvent.changeText(screen.getByLabelText('New exercise name'), 'Sled Push');
    await fireEvent.press(screen.getByText('Create'));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(onPick.mock.calls[0][0]).toMatchObject({ name: 'Sled Push', subcategory: null });
  });
});
