import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Suspense, type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider, useTheme } from '@/theme';

import { DATABASE_NAME } from "@/db/config";
import { migrate } from '@/db/migrations';
import { DbProvider } from '@/db/DbContext';
import type { Db } from '@/db/types';

function Bridge({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  return <DbProvider db={db as unknown as Db}>{children}</DbProvider>;
}

function Screens() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerTitleStyle: { color: t.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ title: 'Weekly plan' }} />
      <Stack.Screen name="day/[date]" options={{ title: 'Workout' }} />
      <Stack.Screen name="export" options={{ title: 'Export' }} />
      <Stack.Screen name="history" options={{ title: 'History' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
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
            <Screens />
          </ThemeProvider>
        </Bridge>
      </SQLiteProvider>
    </Suspense>
    </GestureHandlerRootView>
  );
}
