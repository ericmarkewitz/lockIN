import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Exercise, getLogForDate, getPlanAsLog, LogExercise, LoggedSet, saveLog } from '../../db';
import { Stepper } from '../../components/Stepper';
import { ExercisePicker } from '../../components/ExercisePicker';
import { addDays, formatLong, toISO, weekdayIndex } from '../../lib/dates';
import { colors } from '../../theme';

export default function LogDay() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ date: string }>();

  const [date, setDate] = useState(params.date ?? toISO(new Date()));
  const [exercises, setExercises] = useState<LogExercise[]>([]);
  const [source, setSource] = useState<'saved' | 'plan'>('plan');
  const [dirty, setDirty] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load the saved log for this date, or prefill from the weekday's plan.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getLogForDate(date);
      const next = saved ?? (await getPlanAsLog(weekdayIndex(date)));
      if (cancelled) return;
      setExercises(next);
      setSource(saved ? 'saved' : 'plan');
      setDirty(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  // Warn before leaving the screen with unsaved edits.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirtyRef.current) return;
        e.preventDefault();
        Alert.alert('Discard changes?', 'You have unsaved changes for this day.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation]
  );

  const edit = (fn: (prev: LogExercise[]) => LogExercise[]) => {
    setExercises(fn);
    setDirty(true);
  };

  const setSetValue = (ei: number, si: number, patch: Partial<LoggedSet>) =>
    edit((prev) =>
      prev.map((ex, i) =>
        i !== ei ? ex : { ...ex, sets: ex.sets.map((st, j) => (j === si ? { ...st, ...patch } : st)) }
      )
    );

  const addSet = (ei: number) =>
    edit((prev) =>
      prev.map((ex, i) =>
        i !== ei ? ex : { ...ex, sets: [...ex.sets, { ...ex.sets[ex.sets.length - 1] }] }
      )
    );

  const removeSet = (ei: number, si: number) =>
    edit((prev) =>
      prev
        .map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== si) }))
        .filter((ex) => ex.sets.length > 0)
    );

  const removeExercise = (ei: number) => edit((prev) => prev.filter((_, i) => i !== ei));

  const addExercise = (exercise: Exercise) => {
    setPickerOpen(false);
    const existing = exercises.findIndex((e) => e.exerciseId === exercise.id);
    if (existing >= 0) return addSet(existing);
    edit((prev) => [
      ...prev,
      { exerciseId: exercise.id, name: exercise.name, muscle: exercise.muscle, sets: [{ reps: 10, weight: 0 }] },
    ]);
  };

  const save = async () => {
    await saveLog(date, exercises);
    setDirty(false);
    setSource('saved');
  };

  const go = (delta: number) => {
    const next = addDays(date, delta);
    if (!dirty) return setDate(next);
    Alert.alert('Unsaved changes', 'Save this day before moving on?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => setDate(next) },
      {
        text: 'Save',
        onPress: async () => {
          await save();
          setDate(next);
        },
      },
    ]);
  };

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const saved = source === 'saved' && !dirty;
  const saveDisabled = saved || (exercises.length === 0 && source !== 'saved');

  const note =
    exercises.length === 0
      ? 'Nothing planned for this day. Add the lifts you did.'
      : source === 'saved'
      ? dirty
        ? 'You have unsaved changes.'
        : 'Saved. Edit anything and save again to update it.'
      : dirty
      ? 'You have unsaved changes.'
      : 'Prefilled from your plan. Change it to what you actually did, then save.';

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.topBar}>
        <Pressable onPress={leave} hitSlop={10}>
          <Text style={s.back}>‹ Week</Text>
        </Pressable>
      </View>

      <View style={s.dateRow}>
        <Pressable onPress={() => go(-1)} style={s.arrow} accessibilityLabel="Previous day">
          <Text style={s.arrowText}>‹</Text>
        </Pressable>
        <Text style={s.date}>{formatLong(date)}</Text>
        <Pressable onPress={() => go(1)} style={s.arrow} accessibilityLabel="Next day">
          <Text style={s.arrowText}>›</Text>
        </Pressable>
      </View>
      <Text style={s.note}>{note}</Text>

      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {exercises.map((ex, ei) => (
          <View key={ex.exerciseId} style={s.card}>
            <View style={s.cardTop}>
              <View>
                <Text style={s.liftName}>{ex.name}</Text>
                <Text style={s.liftMuscle}>{ex.muscle}</Text>
              </View>
              <Pressable onPress={() => removeExercise(ei)} hitSlop={10} accessibilityLabel={`Remove ${ex.name}`}>
                <Text style={s.remove}>Remove</Text>
              </Pressable>
            </View>

            <View style={s.headRow}>
              <Text style={[s.head, { width: 44 }]}>Set</Text>
              <Text style={[s.head, { width: 106, textAlign: 'center' }]}>Reps</Text>
              <Text style={[s.head, { flex: 1, textAlign: 'center' }]}>Weight (lb)</Text>
              <View style={{ width: 28 }} />
            </View>

            {ex.sets.map((st, si) => (
              <View key={si} style={s.setRow}>
                <Text style={s.setNum}>{si + 1}</Text>
                <Stepper compact label={`Set ${si + 1} reps`} value={st.reps} min={0} max={100} onChange={(v) => setSetValue(ei, si, { reps: v })} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Stepper compact label={`Set ${si + 1} weight`} value={st.weight} step={5} max={2000} onChange={(v) => setSetValue(ei, si, { weight: v })} />
                </View>
                <Pressable onPress={() => removeSet(ei, si)} hitSlop={8} style={s.removeSet} accessibilityLabel={`Remove set ${si + 1}`}>
                  <Text style={s.removeSetText}>×</Text>
                </Pressable>
              </View>
            ))}

            <Pressable onPress={() => addSet(ei)} style={s.addSet}>
              <Text style={s.addSetText}>Add set</Text>
            </Pressable>
          </View>
        ))}

        <Pressable onPress={() => setPickerOpen(true)} style={s.addLift}>
          <Text style={s.addLiftText}>Add another lift</Text>
        </Pressable>
      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.saveBtn, saveDisabled && s.saveBtnDisabled]} onPress={save} disabled={saveDisabled}>
          <Text style={[s.saveText, saveDisabled && s.saveTextDisabled]}>{saved ? 'Saved' : 'Save workout'}</Text>
        </Pressable>
      </View>

      <ExercisePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: 20, paddingTop: 8 },
  back: { fontSize: 16, fontWeight: '600', color: colors.accent },

  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: 8 },
  arrow: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 26, fontWeight: '700', color: colors.ink, marginTop: -3 },
  date: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  note: { fontSize: 14, color: colors.muted, paddingHorizontal: 20, marginTop: 8, marginBottom: 4 },

  list: { padding: 16, paddingBottom: 120, gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  liftName: { fontSize: 18, fontWeight: '700', color: colors.ink },
  liftMuscle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  remove: { fontSize: 14, fontWeight: '600', color: colors.danger },

  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  head: { fontSize: 12, fontWeight: '600', color: colors.muted },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  setNum: { width: 44, fontSize: 16, fontWeight: '700', color: colors.muted },
  removeSet: { width: 28, alignItems: 'center' },
  removeSetText: { fontSize: 22, color: colors.muted },

  addSet: { marginTop: 8, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.chip, alignItems: 'center' },
  addSetText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  addLift: { paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  addLiftText: { fontSize: 15, fontWeight: '600', color: colors.accent },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, backgroundColor: colors.bg },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: colors.chip },
  saveText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  saveTextDisabled: { color: colors.muted },
});
