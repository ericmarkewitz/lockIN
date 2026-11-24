import { fireEvent, screen } from '@testing-library/react-native';

import { setPlanDay } from '@/data/plan';
import { getStatsRange, setDistanceUnit, setStatsRange, setWeightUnit } from '@/data/settings';
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
    await fireEvent.press(await screen.findByLabelText('Workouts'));
    const rows = await screen.findAllByLabelText(/^Open 2026-/);
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual(['Open 2026-11-02', 'Open 2026-10-26']);
    expect(screen.getAllByText(/Bench Press/).length).toBeGreaterThan(0);
  });

  it('opens a workout from the list', async () => {
    const db = await setup();
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Workouts'));
    await fireEvent.press(await screen.findByLabelText('Open 2026-10-26'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/day/[date]', params: { date: '2026-10-26' } });
  });

  it('shows an empty state when nothing is logged', async () => {
    const db = await setup(false);
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Workouts'));
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

  it('formats a session duration that includes seconds', async () => {
    const db = await createTestDb();
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDurationMin: 30 }] });
    const w = await ensureWorkout(db, '2026-11-02');
    await updateSet(db, w.exercises[0].sets[0].id, { durationMin: 1 + 20 / 60, completed: true });
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Exercises'));
    await fireEvent.press(await screen.findByLabelText('Running history'));
    expect(await screen.findByText('1m 20s')).toBeTruthy();
  });

  it('shows session distance with the selected unit', async () => {
    const db = await createTestDb();
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDurationMin: 30 }] });
    const w = await ensureWorkout(db, '2026-11-02');
    await updateSet(db, w.exercises[0].sets[0].id, { durationMin: 30, distance: 3.2, completed: true });
    await setDistanceUnit(db, 'km');
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Exercises'));
    await fireEvent.press(await screen.findByLabelText('Running history'));
    expect(await screen.findByText('30 min · 5.15 km')).toBeTruthy();
  });

  it('does not talk about sets for cardio', async () => {
    const db = await createTestDb();
    await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, 'Running'), targetDurationMin: 30 }] });
    const w = await ensureWorkout(db, '2026-11-02');
    await updateSet(db, w.exercises[0].sets[0].id, { completed: true });
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Workouts'));
    expect(await screen.findByText('Running')).toBeTruthy();
    expect(screen.queryByText(/set/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Exercises'));
    await fireEvent.press(await screen.findByLabelText('Running history'));
    expect(await screen.findByText('Done')).toBeTruthy();
  });

  it('uses the selected weight unit', async () => {
    const db = await setup();
    await setWeightUnit(db, 'kg');
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Exercises'));
    await fireEvent.press(await screen.findByLabelText('Bench Press history'));
    expect(await screen.findByText('Best 63.5 kg × 5 · Est. 1RM 74.07 kg')).toBeTruthy();
  });

  it('returns from an exercise to the exercise list', async () => {
    const db = await setup();
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Exercises'));
    await fireEvent.press(await screen.findByLabelText('Bench Press history'));
    await fireEvent.press(await screen.findByLabelText('Back to exercises'));
    expect(await screen.findByLabelText('Bench Press history')).toBeTruthy();
  });

  describe('Stats', () => {
    // Ranges count back from today; pin it so the logged dates stay inside them.
    beforeEach(() => jest.useFakeTimers({ now: new Date(2026, 10, 15, 12), advanceTimers: true }));
    afterEach(() => jest.useRealTimers());

    /** Logs one set of `exercise` on each date (all Mondays), using a one-item Monday plan. */
    async function logOn(db: Awaited<ReturnType<typeof setup>>, exercise: string, sets: [string, number, number][]) {
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, exercise), targetSets: 1 }] });
      for (const [date, weight, reps] of sets) {
        const w = await ensureWorkout(db, date);
        await updateSet(db, w.exercises[0].sets[0].id, { weight, reps, completed: true });
      }
    }

    it('is the tab History opens on', async () => {
      const db = await setup();
      await renderWithDb(<HistoryScreen />, db);
      expect(await screen.findByLabelText('Total volume: 2,000 lb')).toBeTruthy();
      expect(screen.getByLabelText('Stats').props.accessibilityState).toEqual({ selected: true });
    });

    it('shows lifetime totals', async () => {
      const db = await setup();
      await renderWithDb(<HistoryScreen />, db);
      // 130 × 10 + 140 × 5
      expect(await screen.findByLabelText('Total volume: 2,000 lb')).toBeTruthy();
      expect(screen.getByLabelText('Sets: 2')).toBeTruthy();
      expect(screen.getByLabelText('Workouts: 2')).toBeTruthy();
      expect(screen.getByLabelText('Unique exercises: 1')).toBeTruthy();
      expect(screen.getByText('All time')).toBeTruthy();
    });

    it('shows volume in the selected weight unit', async () => {
      const db = await setup();
      await setWeightUnit(db, 'kg');
      await renderWithDb(<HistoryScreen />, db);
      expect(await screen.findByLabelText('Total volume: 907 kg')).toBeTruthy();
    });

    it('charts the estimated 1RM of a lift logged more than once', async () => {
      const db = await setup();
      await renderWithDb(<HistoryScreen />, db);
      expect(await screen.findByLabelText('Bench Press estimated 1RM, 2 sessions, from 173.3 to 163.3 lb')).toBeTruthy();
      expect(screen.getByText('-10 lb since Oct 26')).toBeTruthy();
    });

    it('switches the chart between tracked lifts', async () => {
      const db = await setup();
      await logOn(db, 'Squat', [['2026-10-19', 200, 1], ['2026-11-09', 225, 1]]);
      await renderWithDb(<HistoryScreen />, db);
      await fireEvent.press(await screen.findByLabelText('Chart Squat'));
      expect(await screen.findByLabelText('Squat estimated 1RM, 2 sessions, from 200 to 225 lb')).toBeTruthy();
      expect(screen.getByText('+25 lb since Oct 19')).toBeTruthy();
    });

    it('explains the empty state', async () => {
      const db = await setup(false);
      await renderWithDb(<HistoryScreen />, db);
      expect(await screen.findByLabelText('Total volume: 0 lb')).toBeTruthy();
      expect(screen.getByText('Log a lift on two different days to see its progress.')).toBeTruthy();
    });

    it('starts on three months of weekly volume', async () => {
      const db = await setup();
      await renderWithDb(<HistoryScreen />, db);
      expect(await screen.findByText('Per week')).toBeTruthy();
      expect(screen.getByLabelText('3M').props.accessibilityState).toEqual({ selected: true });
      expect(screen.getByLabelText('10/26: 1,300 lb')).toBeTruthy();
    });

    it('changes both charts with the range and remembers it', async () => {
      const db = await setup();
      await logOn(db, 'Bench Press', [['2026-06-01', 100, 1]]);
      await renderWithDb(<HistoryScreen />, db);
      expect(await screen.findByLabelText(/^Bench Press estimated 1RM, 2 sessions/)).toBeTruthy();

      await fireEvent.press(screen.getByLabelText('6M'));
      expect(await screen.findByLabelText(/^Bench Press estimated 1RM, 3 sessions, from 100 to/)).toBeTruthy();
      expect(screen.getByText('Per month')).toBeTruthy();
      expect(screen.getByLabelText('Jun: 100 lb')).toBeTruthy();
      expect(await getStatsRange(db)).toBe('6m');
    });

    it('opens on the saved range', async () => {
      const db = await setup();
      await setStatsRange(db, '1y');
      await renderWithDb(<HistoryScreen />, db);
      expect(await screen.findByText('Per month')).toBeTruthy();
      expect(screen.getByLabelText('1Y').props.accessibilityState).toEqual({ selected: true });
    });

    it('says when a lift has too few sessions in the range', async () => {
      const db = await createTestDb();
      await logOn(db, 'Deadlift', [['2026-06-01', 300, 1], ['2026-06-08', 310, 1]]);
      await renderWithDb(<HistoryScreen />, db);
      expect(await screen.findByText('Not enough Deadlift sessions in this range.')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('All'));
      expect(await screen.findByLabelText('Deadlift estimated 1RM, 2 sessions, from 300 to 310 lb')).toBeTruthy();
    });
  });

  it('charts progress on a lift\'s history page', async () => {
    const db = await setup();
    await renderWithDb(<HistoryScreen />, db);
    await fireEvent.press(await screen.findByLabelText('Exercises'));
    await fireEvent.press(await screen.findByLabelText('Bench Press history'));
    expect(await screen.findByLabelText('Bench Press estimated 1RM, 2 sessions, from 173.3 to 163.3 lb')).toBeTruthy();
  });

  describe('exercises that record something else', () => {
    async function loggedOnce(name: string, patches: Parameters<typeof updateSet>[2][], targets: { targetSets?: number } = {}) {
      const db = await createTestDb();
      await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: await findByName(db, name), ...targets }] });
      const w = await ensureWorkout(db, '2026-11-02');
      for (const [i, patch] of patches.entries()) await updateSet(db, w.exercises[0].sets[i].id, { ...patch, completed: true });
      await renderWithDb(<HistoryScreen />, db);
      await fireEvent.press(await screen.findByLabelText('Exercises'));
      await fireEvent.press(await screen.findByLabelText(`${name} history`));
    }

    it('sums up a climbing session as time, routes and difficulty', async () => {
      await loggedOnce('Climbing', [{ durationMin: 90, count: 9, difficulty: 6 }]);
      expect(await screen.findByText('1h 30m · 9 routes · Difficulty 6/10')).toBeTruthy();
    });

    it('sums up a walk with its steps and a hike with its elevation', async () => {
      await loggedOnce('Walking', [{ durationMin: 40, count: 6500 }]);
      expect(await screen.findByText('40 min · 6,500 steps')).toBeTruthy();
    });

    it('shows a swim in yards or meters', async () => {
      await loggedOnce('Swimming', [{ durationMin: 30, distance: 1000 / 1760 }]);
      expect(await screen.findByText('30 min · 1,000 yd')).toBeTruthy();
    });

    it("sums up a plank by its heaviest weight and longest hold, with no 1RM chart", async () => {
      await loggedOnce('Weighted Plank', [{ weight: 25, durationMin: 1 }, { weight: 45, durationMin: 0.75 }], { targetSets: 2 });
      expect(await screen.findByText('Heaviest 45 lb · Longest 1 min')).toBeTruthy();
      expect(screen.queryByLabelText(/estimated 1RM/)).toBeNull();
    });
  });
});

