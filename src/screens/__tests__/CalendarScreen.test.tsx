import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { setPlanDay } from '@/data/plan';
import { updateSet, ensureWorkout } from '@/data/workouts';
import { findByName } from '@/test/helpers';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { CalendarScreen } from '../CalendarScreen';

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

const mockPush = jest.fn();
function useMockFocusEffect(cb: () => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cb, []);
}
const mockUseFocusEffect = useMockFocusEffect;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useFocusEffect: (cb: () => void) => mockUseFocusEffect(cb),
}));

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
  it('keeps the day view inputs above the keyboard', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    expect(await screen.findByTestId('keyboard-avoider')).toBeTruthy();
    expect(screen.getByTestId('calendar-scroll').props).toMatchObject({
      automaticallyAdjustKeyboardInsets: true,
      keyboardShouldPersistTaps: 'handled',
    });
  });

  it('opens settings', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('opens the history screen', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    await fireEvent.press(screen.getByLabelText('History'));
    expect(mockPush).toHaveBeenCalledWith('/history');
  });

  it('opens the plan and export screens', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    await fireEvent.press(screen.getByLabelText('Plan'));
    expect(mockPush).toHaveBeenCalledWith('/setup');
    await fireEvent.press(screen.getByLabelText('Export'));
    expect(mockPush).toHaveBeenCalledWith('/export');
  });

  it('defaults to the current week, showing each day of the plan', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    expect(await screen.findByText('Nov 2 – Nov 8')).toBeTruthy();
    const monday = within(await screen.findByLabelText('Open 2026-11-02'));
    expect(monday.getByText('Mon')).toBeTruthy();
    expect(monday.getByText('2')).toBeTruthy();
    expect(monday.getByText('Lifts')).toBeTruthy();
    expect(monday.getByText('1 exercise')).toBeTruthy();
    expect(within(screen.getByLabelText('Open 2026-11-04')).getByText('Cardio')).toBeTruthy();
    expect(within(screen.getByLabelText('Open 2026-11-03')).getByText('Rest day')).toBeTruthy();
    expect(screen.getAllByText('Nothing planned').length).toBe(4);
  });

  it('summarises how many of the week\'s workouts are done', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    expect(await screen.findByLabelText('0 of 2 workouts done')).toBeTruthy();
    const w = await ensureWorkout(db, '2026-11-02');
    for (const s of w.exercises[0].sets) await updateSet(db, s.id, { completed: true });
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(await screen.findByLabelText('Go to today'));
    expect(await screen.findByLabelText('1 of 2 workouts done')).toBeTruthy();
  });

  it('highlights today with a call to start the workout', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    const today = within(await screen.findByLabelText('Open 2026-11-04'));
    expect(today.getByText('Today')).toBeTruthy();
    expect(today.getByText('Start workout')).toBeTruthy();
    expect(within(screen.getByLabelText('Open 2026-11-02')).queryByText('Start workout')).toBeNull();
  });

  it('offers a way back to today only when viewing another period', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    expect(await screen.findByText('Nov 2 – Nov 8')).toBeTruthy();
    expect(screen.queryByLabelText('Go to today')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(await screen.findByText('Nov 9 – Nov 15')).toBeTruthy();
    // Worded as an action so it can't be misread as a label saying the shown day is today.
    expect(screen.getByText('Back to today')).toBeTruthy();
    expect(screen.queryByText('Today')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Go to today'));
    expect(await screen.findByText('Nov 2 – Nov 8')).toBeTruthy();
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

  it('stretches the month grid to fill the screen, one row per week', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    await fireEvent.press(screen.getByLabelText('Month'));
    expect(await screen.findByText('November 2026')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('calendar-scroll').props.contentContainerStyle)).toMatchObject({ flexGrow: 1 });
    expect(StyleSheet.flatten(screen.getByTestId('month-view').props.style)).toMatchObject({ flex: 1 });
    const weeks = screen.getAllByTestId('month-week');
    expect(weeks).toHaveLength(6); // Nov 2026 starts on a Sunday, so it spans six Monday-first rows
    for (const w of weeks) expect(StyleSheet.flatten(w.props.style)).toMatchObject({ flex: 1 });
  });

  it('fits the week and month on screen without scrolling; only the day view scrolls', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    const scroll = () => screen.getByTestId('calendar-scroll');
    // Safe areas come from the wrapper, not scroll insets that would push a full-height view past the bottom.
    expect(screen.getByTestId('calendar-safe-area')).toBeTruthy();
    expect(scroll().props.contentInsetAdjustmentBehavior).toBe('never');

    expect(await screen.findByText('Nov 2 – Nov 8')).toBeTruthy();
    expect(scroll().props.scrollEnabled).toBe(false);
    expect(StyleSheet.flatten(screen.getByTestId('week-view').props.style)).toMatchObject({ flex: 1 });
    for (const d of ['2026-11-02', '2026-11-04', '2026-11-08']) {
      const row = StyleSheet.flatten(screen.getByLabelText(`Open ${d}`).props.style);
      expect(row).toMatchObject({ flex: 1 });
      expect(row.minHeight).toBeUndefined();
    }

    await fireEvent.press(screen.getByLabelText('Month'));
    expect(await screen.findByText('November 2026')).toBeTruthy();
    expect(scroll().props.scrollEnabled).toBe(false);
    for (const w of screen.getAllByTestId('month-week')) expect(StyleSheet.flatten(w.props.style).minHeight).toBeUndefined();

    await fireEvent.press(screen.getByLabelText('Day'));
    expect(await screen.findByText('Wednesday, Nov 4')).toBeTruthy();
    expect(scroll().props.scrollEnabled).toBe(true);
  });

  it('shows what kind of workout each month day holds', async () => {
    const db = await setup();
    await renderWithDb(<CalendarScreen today={TODAY} />, db);
    await fireEvent.press(screen.getByLabelText('Month'));
    const day = async (label: string) => within(await screen.findByLabelText(label));
    expect((await day('2026-11-02 Missed')).getByTestId('kind-strength')).toBeTruthy();
    expect((await day('2026-11-04 Planned')).getByTestId('kind-cardio')).toBeTruthy();
    expect((await day('2026-11-03 Rest')).getByTestId('kind-rest')).toBeTruthy();
    expect((await day('2026-11-05')).queryByTestId(/^kind-/)).toBeNull();
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
