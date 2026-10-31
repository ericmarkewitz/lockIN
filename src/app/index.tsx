import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  addToPlan,
  Exercise,
  getDayCounts,
  getPlanForDay,
  PlanItem,
  removePlanItem,
  updatePlanItem,
} from '../db';
import { Stepper } from '../components/Stepper';
import { ExercisePicker } from '../components/ExercisePicker';
import { DAYS, DAYS_LONG, dateForWeekday } from '../lib/dates';
import { exportCsv } from '../lib/exportCsv';
import { colors } from '../theme';

export default function WeekSetup() {
  const router = useRouter();
  const [day, setDay] = useState((new Date().getDay() + 6) % 7); // 0 = Monday
  const [items, setItems] = useState<PlanItem[]>([]);
  const [counts, setCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(async (d: number) => {
    const [plan, c] = await Promise.all([getPlanForDay(d), getDayCounts()]);
    setItems(plan);
    setCounts(c);
  }, []);

  useEffect(() => {
    refresh(day);
  }, [day, refresh]);

  const change = (item: PlanItem, patch: Partial<Pick<PlanItem, 'sets' | 'reps' | 'weight'>>) => {
    const next = { ...item, ...patch };
    setItems((prev) => prev.map((i) => (i.id === item.id ? next : i)));
    updatePlanItem(item.id, { sets: next.sets, reps: next.reps, weight: next.weight });
  };

  const remove = async (item: PlanItem) => {
    await removePlanItem(item.id);
    refresh(day);
  };

  const pick = async (exercise: Exercise) => {
    setPickerOpen(false);
    await addToPlan(day, exercise.id);
    refresh(day);
  };

  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportCsv();
      if (result === 'empty') {
        Alert.alert('Nothing to export yet', 'Save a workout from any day, then export.');
      } else if (result === 'unavailable') {
        Alert.alert('Sharing unavailable', 'This device cannot open the share sheet.');
      }
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Plan your week</Text>
          <Text style={s.subtitle}>Pick a day, then add the lifts you want to hit.</Text>
        </View>
        <Pressable onPress={doExport} hitSlop={10} accessibilityLabel="Export workouts as CSV">
          <Text style={s.export}>{exporting ? 'Exporting…' : 'Export CSV'}</Text>
        </Pressable>
      </View>

      <View style={s.dayRow}>
        {DAYS.map((label, i) => {
          const active = i === day;
          return (
            <Pressable
              key={label}
              onPress={() => setDay(i)}
              style={[s.dayChip, active && s.dayChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${DAYS_LONG[i]}, ${counts[i]} lifts`}
            >
              <Text style={[s.dayText, active && s.dayTextActive]}>{label}</Text>
              <Text style={[s.dayCount, active && s.dayTextActive]}>{counts[i] > 0 ? counts[i] : '–'}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={<Text style={s.dayTitle}>{DAYS_LONG[day]}</Text>}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Nothing planned for {DAYS_LONG[day]}</Text>
            <Text style={s.emptyBody}>Add a lift to set your sets, reps, and weight.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View>
                <Text style={s.liftName}>{item.name}</Text>
                <Text style={s.liftMuscle}>{item.muscle}</Text>
              </View>
              <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityLabel={`Remove ${item.name}`}>
                <Text style={s.remove}>Remove</Text>
              </Pressable>
            </View>
            <View style={s.steppers}>
              <Stepper label="Sets" value={item.sets} min={1} max={20} onChange={(v) => change(item, { sets: v })} />
              <Stepper label="Reps" value={item.reps} min={1} max={100} onChange={(v) => change(item, { reps: v })} />
              <Stepper label="Weight" unit="lb" value={item.weight} step={5} max={2000} onChange={(v) => change(item, { weight: v })} />
            </View>
          </View>
        )}
      />

      <View style={s.footer}>
        <Pressable style={[s.btn, s.btnPrimary]} onPress={() => setPickerOpen(true)}>
          <Text style={s.btnPrimaryText}>Add lift</Text>
        </Pressable>
        <Pressable style={[s.btn, s.btnSecondary]} onPress={() => router.push(`/log/${dateForWeekday(day)}`)}>
          <Text style={s.btnSecondaryText}>Log {DAYS[day]}</Text>
        </Pressable>
      </View>

      <ExercisePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pick} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 12 },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 4 },
  export: { fontSize: 15, fontWeight: '600', color: colors.accent, marginTop: 10 },

  dayRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 8 },
  dayChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  dayChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  dayCount: { fontSize: 12, color: colors.muted, marginTop: 2 },
  dayTextActive: { color: colors.onAccent },

  list: { padding: 16, paddingBottom: 120, gap: 12 },
  dayTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 4 },

  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  liftName: { fontSize: 18, fontWeight: '700', color: colors.ink },
  liftMuscle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  remove: { fontSize: 14, fontWeight: '600', color: colors.danger },
  steppers: { flexDirection: 'row', gap: 4 },

  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  emptyBody: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: 'center' },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 28, backgroundColor: colors.bg },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  btnSecondary: { backgroundColor: colors.chip },
  btnSecondaryText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
});
