import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';

import { setPlanDay } from '@/data/plan';
import { ensureWorkout, updateSet } from '@/data/workouts';
import { findByName } from '@/test/helpers';
import { renderWithDb } from '@/test/render';
import { createTestDb } from '@/test/testDb';
import { ExportScreen } from '../ExportScreen';

const mockWrite = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: jest.fn().mockImplementation((_dir: string, name: string) => ({
    uri: `file:///cache/${name}`, create: jest.fn(), write: (...a: unknown[]) => mockWrite(...a),
  })),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn().mockResolvedValue(undefined) }));

async function setup() {
  const db = await createTestDb();
  const bench = await findByName(db, 'Bench Press');
  await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: bench, targetSets: 1, targetReps: 10 }] });
  const w = await ensureWorkout(db, '2026-10-26');
  await updateSet(db, w.exercises[0].sets[0].id, { weight: 135, reps: 10, completed: true });
  return db;
}

beforeEach(() => { mockWrite.mockClear(); (Sharing.shareAsync as jest.Mock).mockClear(); });

describe('ExportScreen', () => {
  it('previews the matching row count', async () => {
    const db = await setup();
    await renderWithDb(<ExportScreen today="2026-11-04" />, db);
    await fireEvent.press(screen.getByText('Preview'));
    expect(await screen.findByText('1 row match.')).toBeTruthy();
  });

  it('writes a CSV with only the selected fields and shares it', async () => {
    const db = await setup();
    await renderWithDb(<ExportScreen today="2026-11-04" />, db);
    for (const label of ['Weekday', 'Category', 'Set number', 'Duration', 'Distance', 'Completed', 'Workout notes', 'Reps']) {
      await fireEvent(screen.getByLabelText(`Include ${label}`), 'valueChange', false);
    }
    await fireEvent.press(screen.getByText('Export CSV'));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    expect(mockWrite).toHaveBeenCalledWith('Date,Exercise,Weight (lb)\r\n2026-10-26,Bench Press,135\r\n');
    expect((Sharing.shareAsync as jest.Mock).mock.calls[0][0]).toBe('file:///cache/lockin-all.csv');
  });

  it('validates custom dates', async () => {
    const db = await setup();
    await renderWithDb(<ExportScreen today="2026-11-04" />, db);
    await fireEvent.press(screen.getByLabelText('Custom'));
    await fireEvent.changeText(screen.getByLabelText('From date'), '10/01/2026');
    await fireEvent.changeText(screen.getByLabelText('To date'), '2026-10-31');
    await fireEvent.press(screen.getByText('Export CSV'));
    expect(await screen.findByText('Enter dates as YYYY-MM-DD.')).toBeTruthy();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('applies a custom range', async () => {
    const db = await setup();
    await renderWithDb(<ExportScreen today="2026-11-04" />, db);
    await fireEvent.press(screen.getByLabelText('Custom'));
    await fireEvent.changeText(screen.getByLabelText('From date'), '2026-11-01');
    await fireEvent.changeText(screen.getByLabelText('To date'), '2026-11-30');
    await fireEvent.press(screen.getByText('Export CSV'));
    expect(await screen.findByText('No logged workouts in that range.')).toBeTruthy();
  });

  it('refuses to export with no fields selected', async () => {
    const db = await setup();
    await renderWithDb(<ExportScreen today="2026-11-04" />, db);
    for (const label of ['Date','Weekday','Category','Exercise','Set number','Reps','Weight','Duration','Distance','Completed','Workout notes']) {
      await fireEvent(screen.getByLabelText(`Include ${label}`), 'valueChange', false);
    }
    await fireEvent.press(screen.getByText('Export CSV'));
    expect(await screen.findByText('Select at least one field.')).toBeTruthy();
  });
});
