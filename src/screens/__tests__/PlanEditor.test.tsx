import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { getPlan, isPlanComplete } from '@/data/plan';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { PlanEditor } from '../PlanEditor';

describe('PlanEditor', () => {
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
    await fireEvent.changeText(await screen.findByLabelText('1 Bench Press sets'), '4');
    await fireEvent.changeText(screen.getByLabelText('1 Bench Press reps'), '6');

    await fireEvent.press(screen.getByLabelText('Add exercise to Wednesday'));
    await fireEvent.press(await screen.findByLabelText('Category Cardio'));
    await fireEvent.press(await screen.findByLabelText('Add Running'));
    await fireEvent.changeText(await screen.findByLabelText('3 Running minutes'), '30');

    await fireEvent(screen.getByLabelText('Sunday rest day'), 'valueChange', true);
    await fireEvent.press(screen.getByText('Save plan'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const plan = await getPlan(db);
    expect(plan.find((d) => d.weekday === 1)!.items[0]).toMatchObject({ exerciseName: 'Bench Press', targetSets: 4, targetReps: 6 });
    expect(plan.find((d) => d.weekday === 3)!.items[0]).toMatchObject({ exerciseName: 'Running', targetDurationMin: 30 });
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
    await fireEvent.changeText(await screen.findByLabelText('1 Lunge sets'), '5');

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
