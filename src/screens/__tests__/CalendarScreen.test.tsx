import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { setPlanDay } from '@/data/plan';
import { updateSet, ensureWorkout } from '@/data/workouts';
import { findByName } from '@/test/helpers';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { CalendarScreen } from '../CalendarScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn() }),
    useFocusEffect: (cb: () => void) => React.useEffect(cb, []),
  };
});

const TODAY = '2026-11-04'; // Wednesday

async function setup() {
  const db = await createTestDb();
  const bench = await findByName(db, 'Bench Press');
  const run = await findByName(db, 'Running');
  await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: bench, targetSets: 2, targetReps: 10 }] });
  await setPlanDay(db, 3, { isRest: false, items: [{ exerciseId: run, targetDurationMin: 30 }] });
  await setPlanDay(db, 2, { isRest: true, items: [] });
  return db;
}

beforeEach(() => mockPush.mockClear());

describe('CalendarScreen', () => {
  it('defaults to the current week, showing each day of the plan', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    expect(await screen.findByText('Nov 2 – Nov 8')).toBeTruthy();
    expect(await screen.findByText('Monday 2')).toBeTruthy();
    expect(await screen.findByText('Lifts · 1 exercise')).toBeTruthy();
    expect(screen.getByText('Cardio · 1 exercise')).toBeTruthy();
    expect(screen.getByText('Rest day')).toBeTruthy();
    expect(screen.getAllByText('Nothing planned').length).toBe(4);
  });

  it('shows Missed for past planned days and Done for finished ones', async () => {
    const db = await setup();
    const w = await ensureWorkout(db, '2026-11-02');
    for (const s of w.exercises[0].sets) await updateSet(db, s.id, { completed: true });
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    expect(await screen.findByText('Done')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Previous'));
    expect(await screen.findByText('Oct 26 – Nov 1')).toBeTruthy();
    expect((await screen.findAllByText('Missed')).length).toBeGreaterThan(0);
  });

  it('opens a day from the week view', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    await fireEvent.press(await screen.findByLabelText('Open 2026-11-04'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/day/[date]', params: { date: '2026-11-04' } });
  });

  it('switches to the month view and marks days with workouts', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    await fireEvent.press(screen.getByLabelText('Month'));
    expect(await screen.findByText('November 2026')).toBeTruthy();
    expect(await screen.findByLabelText('2026-11-04 Planned')).toBeTruthy();
    expect(screen.getByLabelText('2026-11-03 Rest')).toBeTruthy();
    expect(screen.getByLabelText('2026-11-05')).toBeTruthy(); // nothing planned: no status
  });

  it('drills from month into a day and shows the workout', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    await fireEvent.press(screen.getByLabelText('Month'));
    await fireEvent.press(await screen.findByLabelText('2026-11-09 Planned'));
    expect(await screen.findByText('Monday, Nov 9')).toBeTruthy();
    expect(await screen.findByText('Bench Press')).toBeTruthy();
  });

  it('day view shows today, with navigation', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    await fireEvent.press(screen.getByLabelText('Day'));
    expect(await screen.findByText('Wednesday, Nov 4')).toBeTruthy();
    expect(await screen.findByText('Running')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next'));
    await waitFor(() => expect(screen.getByText('Thursday, Nov 5')).toBeTruthy());
  });
});
