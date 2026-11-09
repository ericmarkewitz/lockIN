import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthView } from '@/components/calendar/MonthView';
import { WeekView } from '@/components/calendar/WeekView';
import { KeyboardAvoider, keyboardScrollProps } from '@/components/KeyboardAvoider';
import { IconButton, Segmented } from '@/components/ui';
import { getRangeSummary } from '@/data/workouts';
import type { DaySummary } from '@/data/types';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { inPeriod, periodLabel, periodRange, shiftAnchor, type ViewMode } from '@/lib/calendar';
import { todayKey, weekDates } from '@/lib/dates';
import { tint, useTheme } from '@/theme';
import { WorkoutView } from './WorkoutView';

export function CalendarScreen({ today = todayKey() }: { today?: string }) {
  const db = useDb();
  const t = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(today);
  const { from, to } = periodRange(anchor, mode);
  const { data, reload } = useLoad(() => getRangeSummary(db, from, to, today), [db, from, to, today]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const byDate = new Map<string, DaySummary>((data ?? []).map((d) => [d.date, d]));
  const open = (date: string) => router.push({ pathname: '/day/[date]', params: { date } });
  const pick = (date: string) => { setAnchor(date); setMode('day'); };

  return (
    <SafeAreaView testID="calendar-safe-area" style={{ flex: 1, backgroundColor: t.bg }}>
    <KeyboardAvoider>
    {/* Insets come from the SafeAreaView: scroll insets would push the full-height week and month views past the bottom. */}
    <ScrollView
      testID="calendar-scroll"
      {...keyboardScrollProps}
      contentInsetAdjustmentBehavior="never"
      // Week and month are laid out to fit the screen; only a day's workout can outgrow it.
      scrollEnabled={mode === 'day'}
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.wrap}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.today, { color: t.muted }]}>{periodLabel(today, 'day').toUpperCase()}</Text>
          <Text style={[styles.h1, { color: t.text }]}>lock<Text style={{ color: t.primary }}>IN</Text></Text>
        </View>
        <View style={styles.topBtns}>
          <IconButton icon={{ ios: 'list.bullet.clipboard', android: 'assignment', web: 'assignment' }} fallback="☰" label="Plan" onPress={() => router.push('/setup')} />
          <IconButton icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }} fallback="↗" label="History" onPress={() => router.push('/history')} />
          <IconButton icon={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' }} fallback="⇪" label="Export" onPress={() => router.push('/export')} />
          <IconButton icon={{ ios: 'gearshape', android: 'settings', web: 'settings' }} fallback="⚙" label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      <Segmented<ViewMode>
        options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
        value={mode}
        onChange={(m) => setMode(m)}
      />

      <View style={styles.navRow}>
        <IconButton icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} fallback="‹" label="Previous" size={36} onPress={() => setAnchor(shiftAnchor(anchor, mode, -1))} />
        <View style={styles.periodCol}>
          <Text style={[styles.period, { color: t.text }]}>{periodLabel(anchor, mode)}</Text>
          {!inPeriod(today, anchor, mode) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to today"
              onPress={() => setAnchor(today)}
              hitSlop={8}
              style={[styles.chip, { backgroundColor: tint(t.primary, 0.12) }]}
            >
              <Text style={{ color: t.primary, fontSize: 12, fontWeight: '700' }}>Today</Text>
            </Pressable>
          )}
        </View>
        <IconButton icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} fallback="›" label="Next" size={36} onPress={() => setAnchor(shiftAnchor(anchor, mode, 1))} />
      </View>

      {mode === 'day' && <WorkoutView key={anchor} date={anchor} />}
      {mode === 'week' && <WeekView dates={weekDates(anchor)} byDate={byDate} today={today} onOpen={open} />}
      {mode === 'month' && <MonthView anchor={anchor} byDate={byDate} today={today} onPick={pick} />}
    </ScrollView>
    </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // flexGrow lets the month grid stretch to exactly fill the screen.
  wrap: { flexGrow: 1, padding: 16, gap: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  topBtns: { flexDirection: 'row', gap: 6 },
  today: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  h1: { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  periodCol: { alignItems: 'center', gap: 4 },
  period: { fontSize: 17, fontWeight: '700' },
  chip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
});
