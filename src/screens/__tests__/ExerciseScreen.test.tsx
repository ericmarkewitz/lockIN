import { screen } from '@testing-library/react-native';

import { addExercise, listCategoriesWithExercises } from '@/data/exercises';
import { findByName } from '@/test/helpers';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { ExerciseScreen } from '../ExerciseScreen';

describe('ExerciseScreen', () => {
  it('plays the animation of a built-in exercise with its name and muscle group', async () => {
    const db = await createTestDb();
    await renderWithDb(<ExerciseScreen id={await findByName(db, 'Bench Press')} />, db);
    expect(await screen.findByRole('header', { name: 'Bench Press' })).toBeTruthy();
    expect(screen.getByText('Lifts · Chest')).toBeTruthy();
    expect(screen.getByTestId('motion-Bench Press', { includeHiddenElements: true })).toBeTruthy();
  });

  it('says a custom exercise has no animation', async () => {
    const db = await createTestDb();
    const lifts = (await listCategoriesWithExercises(db)).find((c) => c.name === 'Lifts')!;
    const sled = await addExercise(db, lifts.id, 'Sled Push');
    await renderWithDb(<ExerciseScreen id={sled.id} />, db);
    expect(await screen.findByRole('header', { name: 'Sled Push' })).toBeTruthy();
    expect(screen.getByText('Custom exercises have no animation.')).toBeTruthy();
  });

  it('says so when the exercise does not exist', async () => {
    const db = await createTestDb();
    await renderWithDb(<ExerciseScreen id={9999} />, db);
    expect(await screen.findByText('Exercise not found.')).toBeTruthy();
  });
});
