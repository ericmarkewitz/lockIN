import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { getPlan, isPlanComplete, markPlanComplete } from '@/data/plan';
import { acceptDisclaimer } from '@/data/settings';
import { DISCLAIMER_VERSION, DisclaimerProvider } from '@/disclaimer';
import { DbProvider } from '@/db/DbContext';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/testDb';
import { ThemeProvider } from '@/theme';
import { Screens } from '../_layout';
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
    await markPlanComplete(db, '2026-11-01');
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
    await markPlanComplete(db, '2026-11-01');
    const before = await getPlan(db);
    const r = await renderApp(db);

    await fireEvent.press(await screen.findByLabelText('Plan'));
    await fireEvent.press(await screen.findByLabelText('Add exercise to Monday'));
    await fireEvent.press(await screen.findByLabelText('Add Squat'));
    await fireEvent.press(await screen.findByLabelText('Add Squat to the plan'));
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

describe('root stack', () => {
  it('labels the back button after the calendar, not the route file', async () => {
    const db = await createTestDb();
    await markPlanComplete(db, '2026-11-01');
    await acceptDisclaimer(db, DISCLAIMER_VERSION);
    await renderRouter(
      {
        _layout: () => (
          <GestureHandlerRootView style={{ flex: 1 }}>
            <DbProvider db={db}>
              <ThemeProvider>
                <DisclaimerProvider>
                  <Screens />
                </DisclaimerProvider>
              </ThemeProvider>
            </DbProvider>
          </GestureHandlerRootView>
        ),
        index: Index,
        setup: Setup,
      },
      { initialUrl: '/' },
    );
    await fireEvent.press(await screen.findByLabelText('Plan'));
    await screen.findByText('Save plan');
    // iOS labels the back button with the previous screen's title, falling back to its route name.
    const titles: (string | undefined)[] = [];
    type Node = { type: string; props: { title?: string }; children: (Node | string)[] | null };
    const walk = (n: Node | Node[] | string | null): void => {
      if (!n || typeof n === 'string') return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (n.type === 'RNSScreenStackHeaderConfig') titles.push(n.props.title);
      n.children?.forEach(walk);
    };
    walk(screen.toJSON() as Node | Node[] | null);
    expect(titles).toEqual(['lockIN', 'Weekly plan']);
  });
});
