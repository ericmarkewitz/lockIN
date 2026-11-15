import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { DISCLAIMER_VERSION, DisclaimerProvider } from '@/disclaimer';
import { markPlanComplete } from '@/data/plan';
import { acceptDisclaimer, hasAcceptedDisclaimer } from '@/data/settings';
import { DbProvider } from '@/db/DbContext';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/testDb';
import { ThemeProvider } from '@/theme';
import { Screens } from '../_layout';
import Disclaimer from '../disclaimer';
import Index from '../index';
import Settings from '../settings';
import Setup from '../setup';

const ACCEPT = 'I understand';

const renderApp = (db: Db, initialUrl = '/') =>
  renderRouter(
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
      settings: Settings,
      disclaimer: Disclaimer,
    },
    { initialUrl },
  );

const stackRoutes = (r: Awaited<ReturnType<typeof renderApp>>) =>
  r.getRouterState()?.routes[0].state?.routes.map((route) => route.name);

describe('first-launch disclaimer', () => {
  it('blocks a fresh install until the disclaimer is accepted', async () => {
    const db = await createTestDb();
    await renderApp(db);
    expect(await screen.findByText(ACCEPT)).toBeTruthy();
    expect(screen.queryByText('Save plan')).toBeNull();
    expect(await hasAcceptedDisclaimer(db, DISCLAIMER_VERSION)).toBe(false);
  });

  it('records acceptance and continues to first-run setup', async () => {
    const db = await createTestDb();
    const r = await renderApp(db);
    await fireEvent.press(await screen.findByText(ACCEPT));

    expect(await screen.findByText('Save plan')).toBeTruthy();
    expect(await hasAcceptedDisclaimer(db, DISCLAIMER_VERSION)).toBe(true);
    // The disclaimer leaves no history entry to swipe back to.
    expect(stackRoutes(r)).not.toContain('disclaimer');
  });

  it('skips the disclaimer once the current version is accepted', async () => {
    const db = await createTestDb();
    await markPlanComplete(db, '2026-11-01');
    await acceptDisclaimer(db, DISCLAIMER_VERSION);
    await renderApp(db);
    expect(await screen.findByLabelText('Plan')).toBeTruthy();
    expect(screen.queryByText(ACCEPT)).toBeNull();
  });

  it('shows the disclaimer again after its version is bumped', async () => {
    const db = await createTestDb();
    await markPlanComplete(db, '2026-11-01');
    await acceptDisclaimer(db, DISCLAIMER_VERSION);
    // Pretend the stored acceptance is for the wording before the current one.
    await db.runAsync("UPDATE settings SET value = ? WHERE key = 'disclaimer_version'", [String(DISCLAIMER_VERSION - 1)]);
    await renderApp(db);
    expect(await screen.findByText(ACCEPT)).toBeTruthy();
  });

  it('blocks deep links to other screens until accepted', async () => {
    const db = await createTestDb();
    await markPlanComplete(db, '2026-11-01');
    const r = await renderApp(db, '/settings');
    expect(await screen.findByText(ACCEPT)).toBeTruthy();
    expect(screen.queryByText('Weight unit')).toBeNull();
    await fireEvent.press(screen.getByText(ACCEPT));
    await waitFor(() => expect(r.getPathname()).not.toBe('/disclaimer'));
    expect(screen.queryByText(ACCEPT)).toBeNull();
  });
});
