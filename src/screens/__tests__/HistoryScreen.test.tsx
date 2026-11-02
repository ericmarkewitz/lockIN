import { fireEvent, screen } from '@testing-library/react-native';

import { setPlanDay } from '@/data/plan';
import { ensureWorkout, updateSet } from '@/data/workouts';
import { findByName } from '@/test/helpers';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { HistoryScreen } from '../HistoryScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

async function setup(logged = true) {
  const db = await createTestDb();
  const bench = await findByName(db, 'Bench Press');
  await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: bench, targetSets: 1, targetReps: 5 }] });
  if (logged) {
    for (const [date, weight, reps] of [['2026-10-26', 130, 10], ['2026-11-02', 140, 5]] as const) {
      const w = await ensureWorkout(db, date);
      await updateSet(db, w.exercises[0].sets[0].id, { weight, reps, completed: true });
    }
  }
  return db;
}

beforeEach(() => mockPush.mockClear());

describe('HistoryScreen', () => {
  it('lists logged workouts newest first', async () => {
    const db = await setup();
    await renderWithDb(<HistoryScreen />, db);
    const rows = await screen.findAllByLabelText(/^Open 2026-/);
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual(['Open 2026-11-02', 'Open 2026-10-26']);
    expect(screen.getAllByText(/Bench Press/).length).toBeGreaterThan(0);
  });

  it('opens a workout from the list', async () => {
    const db = await setup();
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Open 2026-10-26'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/day/[date]', params: { date: '2026-10-26' } });
  });

  it('shows an empty state when nothing is logged', async () => {
    const db = await setup(false);
    await renderWithDb(<HistoryScreen />, db);
    expect(await screen.findByText('No logged workouts yet.')).toBeTruthy();
  });

  it('shows per-session best set and estimated 1RM for an exercise', async () => {
    const db = await setup();
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Exercises'));
    await fireEvent.press(await screen.findByLabelText('Bench Press history'));
    expect(await screen.findByText('2026-11-02')).toBeTruthy();
    expect(screen.getByText('Best 140 lb × 5 · Est. 1RM 163.3 lb')).toBeTruthy();
    expect(screen.getByText('Best 130 lb × 10 · Est. 1RM 173.3 lb')).toBeTruthy();
  });

  it('returns from an exercise to the exercise list', async () => {
    const db = await setup();
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Exercises'));
    await fireEvent.press(await screen.findByLabelText('Bench Press history'));
    await fireEvent.press(await screen.findByLabelText('Back to exercises'));
    expect(await screen.findByLabelText('Bench Press history')).toBeTruthy();
  });
});
