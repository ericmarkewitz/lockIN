import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { getPlan, isPlanComplete } from '@/data/plan';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { PlanEditor } from '../PlanEditor';

const pickTargets = async (field: string, sets: number, reps: number) => {
  await fireEvent.press(await screen.findByLabelText(field));
  await fireEvent.press(within(screen.getByLabelText('Sets')).getByText(String(sets)));
  await fireEvent.press(within(screen.getByLabelText('Reps')).getByText(String(reps)));
  await fireEvent.press(screen.getByLabelText('Done'));
};

describe('PlanEditor', () => {
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
    await fireEvent.changeText(await screen.findByLabelText('New exercise name'), 'Hip Thrust');
    await fireEvent.press(screen.getByText('Create'));
    expect(await screen.findByText('Hip Thrust')).toBeTruthy();
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
});
