import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { getPlan, isPlanComplete, markPlanComplete } from '@/data/plan';
import { DbProvider } from '@/db/DbContext';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/testDb';
import Index from '../index';
import Setup from '../setup';

const renderApp = (db: Db) =>
  renderRouter(
    {
      _layout: () => (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <DbProvider db={db}>
            <Stack />
          </DbProvider>
        </GestureHandlerRootView>
      ),
      index: Index,
      setup: Setup,
    },
    { initialUrl: '/' },
  );

// The root layout's Stack is nested inside expo-router's `__root` route.
const stackRoutes = (r: Awaited<ReturnType<typeof renderApp>>) =>
  r.getRouterState()?.routes[0].state?.routes.map((route) => route.name);

describe('setup route', () => {
  it('lands on the calendar after first-run setup', async () => {
    const db = await createTestDb();
    const r = await renderApp(db);
    await fireEvent.press(await screen.findByText('Save plan'));

    await waitFor(() => expect(r.getPathname()).toBe('/'));
    expect(await isPlanComplete(db)).toBe(true);
    expect(stackRoutes(r)).toEqual(['index']);
  });

  it('returns to the existing calendar instead of stacking a new one on each save', async () => {
    const db = await createTestDb();
    await markPlanComplete(db);
    const r = await renderApp(db);

    for (let i = 0; i < 3; i++) {
      await fireEvent.press(await screen.findByLabelText('Plan'));
      await fireEvent.press(await screen.findByText('Save plan'));
      await waitFor(() => expect(r.getPathname()).toBe('/'));
    }
    expect(stackRoutes(r)).toEqual(['index']);
  });

  it('leaves the plan without saving when cancelled', async () => {
    const db = await createTestDb();
    await markPlanComplete(db);
    const before = await getPlan(db);
    const r = await renderApp(db);

    await fireEvent.press(await screen.findByLabelText('Plan'));
    await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
    await fireEvent.press(await screen.findByLabelText('Add Squat'));
    await fireEvent.press(screen.getByText('Cancel'));

    await waitFor(() => expect(r.getPathname()).toBe('/'));
    expect(stackRoutes(r)).toEqual(['index']);
    expect(await getPlan(db)).toEqual(before);
  });

  it('offers no Cancel during first-run setup', async () => {
    const db = await createTestDb();
    await renderApp(db);
    await screen.findByText('Save plan');
    expect(screen.queryByText('Cancel')).toBeNull();
  });
});
