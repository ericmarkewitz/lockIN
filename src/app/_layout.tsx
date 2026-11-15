import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Suspense, type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DisclaimerProvider, useDisclaimer } from '@/disclaimer';
import { ThemeProvider, useTheme } from '@/theme';

import { DATABASE_NAME } from "@/db/config";
import { migrate } from '@/db/migrations';
import { DbProvider } from '@/db/DbContext';
import type { Db } from '@/db/types';

function Bridge({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  return <DbProvider db={db as unknown as Db}>{children}</DbProvider>;
}

export function Screens() {
  const t = useTheme();
  const { accepted } = useDisclaimer();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerTitleStyle: { color: t.text, fontWeight: '800' },
        headerLargeTitleStyle: { color: t.text, fontWeight: '900' },
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      {/* Every screen is unreachable, deep links included, until the disclaimer is accepted. */}
      <Stack.Protected guard={accepted}>
        {/* The title is unseen here but becomes the back button label on every screen pushed from the calendar. */}
        <Stack.Screen name="index" options={{ headerShown: false, title: 'lockIN' }} />
        <Stack.Screen name="setup" options={{ headerLargeTitle: true, title: 'Weekly plan' }} />
        <Stack.Screen name="day/[date]" options={{ title: 'Workout' }} />
        {/* Full screen with no swipe to dismiss, so a stray swipe mid-set doesn't end the workout; it draws its own End button. */}
        <Stack.Screen name="workout/[date]" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="export" options={{ headerLargeTitle: true, title: 'Export' }} />
        <Stack.Screen name="history" options={{ headerLargeTitle: true, title: 'History' }} />
        <Stack.Screen name="settings" options={{ headerLargeTitle: true, title: 'Settings' }} />
      </Stack.Protected>
      <Stack.Protected guard={!accepted}>
        <Stack.Screen name="disclaimer" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Suspense fallback={<ActivityIndicator style={{ flex: 1 }} />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={(db) => migrate(db as unknown as Db)} useSuspense>
        <Bridge>
          <ThemeProvider>
            <DisclaimerProvider>
              <Screens />
            </DisclaimerProvider>
          </ThemeProvider>
        </Bridge>
      </SQLiteProvider>
    </Suspense>
    </GestureHandlerRootView>
  );
}
