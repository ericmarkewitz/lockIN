import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { OTHER_SUBCATEGORY, addExercise, groupBySubcategory, listCategoriesWithExercises, searchExercises } from '@/data/exercises';
import type { Category, Exercise } from '@/data/types';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { tint, useTheme, type Theme } from '@/theme';
import { categoryIcon, Icon, sym } from './Icon';
import { keyboardAvoidance } from './KeyboardAvoider';
import { ExerciseMotion } from './motion/ExerciseMotion';
import { motionFor } from './motion/motions';

/** The top level: one equal-width tab per category, icon over name. */
function CategoryTabs({ cats, activeId, onSelect, t }: {
  cats: Category[]; activeId: number | undefined; onSelect: (id: number) => void; t: Theme;
}) {
  return (
    <View style={[styles.catTrack, { backgroundColor: t.card, borderColor: t.border }]}>
      {cats.map((c) => {
        const on = c.id === activeId;
        const color = on ? t.onPrimary : t.muted;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`Category ${c.name}`}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(c.id)}
            style={[styles.catTab, on && { backgroundColor: t.primary }]}
          >
            <Icon name={categoryIcon(c)} size={18} color={color} fallback={c.name.charAt(0)} />
            <Text numberOfLines={1} style={[styles.catLabel, { color: on ? t.onPrimary : t.text }]}>{c.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The second level: lighter underlined text tabs, each with how many exercises it holds. */
function SubTabs({ tabs, value, onChange, t }: {
  tabs: { key: string | null; title: string; label: string; count: number }[];
  value: string | null; onChange: (s: string | null) => void; t: Theme;
}) {
  return (
    <View style={[styles.subWrap, { borderColor: t.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
        {tabs.map((tab) => {
          const on = tab.key === value;
          return (
            <Pressable
              key={tab.title}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(tab.key)}
              hitSlop={6}
              style={[styles.subTab, { borderColor: on ? t.primary : 'transparent' }]}
            >
              <Text style={[styles.subLabel, { color: on ? t.text : t.muted, fontWeight: on ? '700' : '600' }]}>{tab.title}</Text>
              <Text style={[styles.subCount, { color: on ? t.primary : t.muted }]}>{tab.count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const MOTION_SIZE = 64;

function ExerciseCard({ exercise, caption, onPress, t }: { exercise: Exercise; caption?: string; onPress: () => void; t: Theme }) {
  const motion = motionFor(exercise);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${exercise.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: t.border, backgroundColor: t.card, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View style={[styles.figure, { backgroundColor: tint(t.primary, 0.07) }]}>
        {motion ? (
          <ExerciseMotion motion={motion} size={MOTION_SIZE} testID={`motion-${exercise.name}`} />
        ) : (
          <Text style={[styles.initial, { color: t.primary }]}>{exercise.name.trim().charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.cardText}>
        <Text numberOfLines={2} style={[styles.cardName, { color: t.text }]}>{exercise.name}</Text>
        {caption && <Text numberOfLines={1} style={[styles.caption, { color: t.muted }]}>{caption}</Text>}
      </View>
    </Pressable>
  );
}

function Grid({ exercises, caption, onPick, t }: {
  exercises: Exercise[]; caption?: (e: Exercise) => string | undefined; onPick: (e: Exercise) => void; t: Theme;
}) {
  return (
    <View testID="exercise-grid" style={styles.grid}>
      {exercises.map((e) => <ExerciseCard key={e.id} exercise={e} caption={caption?.(e)} onPress={() => onPick(e)} t={t} />)}
    </View>
  );
}

function SectionHeader({ title, count, t }: { title: string; count?: number; t: Theme }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: t.text }]}>{title}</Text>
      {count !== undefined && <Text style={[styles.sectionCount, { color: t.muted }]}>{count}</Text>}
    </View>
  );
}

export function ExercisePicker({
  visible, onPick, onClose,
}: { visible: boolean; onPick: (e: Exercise) => void; onClose: () => void }) {
  const db = useDb();
  const t = useTheme();
  const { data: cats, reload } = useLoad(() => listCategoriesWithExercises(db), [db]);
  const [catId, setCatId] = useState<number | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null); // null shows the whole category
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const active = cats?.find((c) => c.id === (catId ?? cats?.[0]?.id));
  const groups = active ? groupBySubcategory(active) : [];
  const shownGroups = subcategory ? groups.filter((g) => g.title === subcategory) : groups;
  const hasOther = groups.some((g) => g.title === OTHER_SUBCATEGORY);
  const newExerciseGroup = subcategory === OTHER_SUBCATEGORY ? null : subcategory;
  const name = query.trim();
  const searching = name.length > 0;
  const results = searching && cats && active ? searchExercises(cats, active.id, name) : null;

  const selectCategory = (id: number) => {
    setCatId(id);
    setSubcategory(null);
  };
  const search = (text: string) => {
    setQuery(text);
    setError(null);
  };
  const pick = (e: Exercise) => {
    search('');
    onPick(e);
  };

  const create = async () => {
    if (!active) return;
    try {
      const ex = await addExercise(db, active.id, name, newExerciseGroup);
      await reload();
      pick(ex);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const subTabs = active?.subcategories.length
    ? [
        { key: null, title: 'All', label: 'Show all exercises', count: active.exercises.length },
        ...[...active.subcategories, ...(hasOther ? [OTHER_SUBCATEGORY] : [])].map((s) => ({
          key: s, title: s, label: `Subcategory ${s}`, count: groups.find((g) => g.title === s)?.exercises.length ?? 0,
        })),
      ]
    : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        testID="picker-keyboard-avoider"
        // The modal fills the window, so no header offset; the search field sits outside the list.
        {...keyboardAvoidance({ os: Platform.OS, headerHeight: 0, scrolls: false })}
        style={{ flex: 1, backgroundColor: t.bg }}
      >
        <View style={styles.wrap}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]}>Choose exercise</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.close, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name={sym('xmark', 'close')} size={14} color={t.muted} fallback="✕" />
            </Pressable>
          </View>

          <View style={[styles.search, { backgroundColor: t.card, borderColor: t.border }]}>
            <Icon name={sym('magnifyingglass', 'search')} size={16} color={t.muted} fallback="⌕" />
            <TextInput
              accessibilityLabel="Search exercises"
              value={query}
              onChangeText={search}
              placeholder="Search or create an exercise"
              placeholderTextColor={t.muted}
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.searchInput, { color: t.text }]}
            />
            {searching && (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => search('')} hitSlop={10}>
                <Icon name={sym('xmark.circle.fill', 'cancel')} size={18} color={t.muted} fallback="⊗" />
              </Pressable>
            )}
          </View>

          {cats && <CategoryTabs cats={cats} activeId={active?.id} onSelect={selectCategory} t={t} />}
          {!searching && subTabs.length > 0 && <SubTabs tabs={subTabs} value={subcategory} onChange={setSubcategory} t={t} />}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {results && active && (
              <>
                {!results.exact && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Create ${name}`}
                    onPress={create}
                    style={({ pressed }) => [
                      styles.create,
                      { borderColor: tint(t.primary, 0.45), backgroundColor: tint(t.primary, 0.08), opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={[styles.plus, { backgroundColor: t.primary }]}>
                      <Icon name={sym('plus', 'add')} size={16} color={t.onPrimary} fallback="+" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[styles.createTitle, { color: t.text }]}>Create “{name}”</Text>
                      <Text style={{ color: t.muted, fontSize: 13 }}>
                        {`in ${active.name}${newExerciseGroup ? ` · ${newExerciseGroup}` : ''}`}
                      </Text>
                    </View>
                  </Pressable>
                )}
                {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}
                {results.here.length > 0 ? (
                  <>
                    <SectionHeader title={active.name} count={results.here.length} t={t} />
                    <Grid exercises={results.here} caption={(e) => e.subcategory ?? undefined} onPick={pick} t={t} />
                  </>
                ) : (
                  <Text style={[styles.empty, { color: t.muted }]}>No matches in {active.name}.</Text>
                )}
                {results.elsewhere.length > 0 && (
                  <>
                    <SectionHeader title="Other categories" count={results.elsewhere.length} t={t} />
                    <Grid exercises={results.elsewhere} caption={(e) => e.categoryName} onPick={pick} t={t} />
                  </>
                )}
              </>
            )}

            {!searching && (
              <>
                {shownGroups.map((g) => (
                  <View key={g.title ?? 'all'}>
                    {g.title && !subcategory && <SectionHeader title={g.title} count={g.exercises.length} t={t} />}
                    <Grid exercises={g.exercises} onPick={pick} t={t} />
                  </View>
                ))}
                {subcategory && !shownGroups.length && (
                  <View style={styles.emptyBox}>
                    <Text style={[styles.emptyTitle, { color: t.text }]}>No {subcategory} exercises yet.</Text>
                    <Text style={{ color: t.muted, textAlign: 'center' }}>Type a name in the search field to create one.</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  catTrack: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  catTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 12 },
  catLabel: { fontSize: 12, fontWeight: '700' },
  subWrap: { borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: -16 },
  subRow: { paddingHorizontal: 16, gap: 20 },
  subTab: { flexDirection: 'row', alignItems: 'baseline', gap: 5, paddingBottom: 9, borderBottomWidth: 2.5 },
  subLabel: { fontSize: 15 },
  subCount: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  list: { paddingBottom: 32 },
  section: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingTop: 18, paddingBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionCount: { fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  card: { width: '48%', padding: 8, gap: 8, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  figure: { height: 88, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 30, fontWeight: '800' },
  cardText: { paddingHorizontal: 4, paddingBottom: 4, minHeight: 40 },
  cardName: { fontSize: 15, fontWeight: '700' },
  caption: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  create: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 12,
    borderRadius: 16, borderWidth: 1, borderStyle: 'dashed',
  },
  plus: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  createTitle: { fontSize: 16, fontWeight: '700' },
  error: { paddingTop: 8 },
  empty: { paddingVertical: 18, textAlign: 'center' },
  emptyBox: { alignItems: 'center', gap: 4, paddingVertical: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
});
