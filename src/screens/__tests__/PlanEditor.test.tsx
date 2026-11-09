import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

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

describe('PlanEditor', () => {
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
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Hip Thrust');
    await fireEvent.press(screen.getByLabelText('Create Hip Thrust'));
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
});
