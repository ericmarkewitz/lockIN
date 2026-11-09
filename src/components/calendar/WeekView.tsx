import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { CategoryKind, DaySummary, DayStatus } from '@/data/types';
import { weekProgress } from '@/lib/calendar';
import { parseDateKey } from '@/lib/dates';
import { tint, useTheme, type Theme } from '@/theme';
import { STATUS_LABEL, statusColor } from './status';

const KIND_LABEL: Record<CategoryKind, string> = { strength: 'Lifts', cardio: 'Cardio', mindbody: 'Yoga/Mobility' };
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CTA: Partial<Record<DayStatus, string>> = { planned: 'Start workout', partial: 'Continue', completed: 'View workout' };
/** Statuses worth a badge: the rest read fine from the title alone. */
const BADGED: DayStatus[] = ['completed', 'partial', 'missed'];

const isTraining = (s: DayStatus) => s !== 'none' && s !== 'rest';

function describe(s: DaySummary | undefined): { title: string; subtitle?: string } {
  if (!s || s.status === 'none') return { title: 'Nothing planned' };
  if (s.status === 'rest') return { title: 'Rest day' };
  return {
    title: s.kinds.map((k) => KIND_LABEL[k]).join(' + '),
    subtitle: `${s.exerciseCount} exercise${s.exerciseCount === 1 ? '' : 's'}`,
  };
}

/** The dot on the timeline rail for one day. */
function Node({ status, t }: { status: DayStatus; t: Theme }) {
  const c = statusColor(status, t);
  if (!isTraining(status)) return <View style={[styles.restNode, { backgroundColor: status === 'rest' ? c : t.border }]} />;
  const filled = status === 'completed';
  return (
    <View style={[styles.node, { borderColor: c, backgroundColor: filled ? c : t.bg }]}>
      {filled && <Text style={[styles.check, { color: t.bg }]}>✓</Text>}
      {status === 'partial' && <View style={[styles.half, { backgroundColor: c }]} />}
    </View>
  );
}

function Progress({ days, t }: { days: DaySummary[]; t: Theme }) {
  const { done, total } = weekProgress(days);
  const training = days.filter((d) => isTraining(d.status));
  return (
    <View
      accessible
      accessibilityLabel={`${done} of ${total} workouts done`}
      style={[styles.progress, { backgroundColor: t.card, borderColor: t.border }]}
    >
      <Text style={[styles.big, { color: t.text }]}>
        {done}<Text style={{ color: t.muted }}>/{total}</Text>
      </Text>
      <Text style={[styles.progressLabel, { color: t.muted }]}>
        {total ? (done === total ? 'Week complete 🔥' : 'workouts\ndone') : 'Nothing planned this week'}
      </Text>
      {total > 0 && (
        <View style={styles.segments}>
          {training.map((d) => (
            <View
              key={d.date}
              style={[styles.segment, { backgroundColor: d.status === 'planned' ? t.surface : statusColor(d.status, t) }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function WeekView({ dates, byDate, today, onOpen }: {
  dates: string[]; byDate: Map<string, DaySummary>; today: string; onOpen: (date: string) => void;
}) {
  const t = useTheme();
  const days = dates.map((date) => byDate.get(date)).filter((d): d is DaySummary => !!d);

  return (
    <View testID="week-view" style={styles.wrap}>
      <Progress days={days} t={t} />
      <View style={styles.list}>
        {dates.map((date, i) => {
          const s = byDate.get(date);
          const status = s?.status ?? 'none';
          const d = parseDateKey(date);
          const isToday = date === today;
          const { title, subtitle } = describe(s);
          const quiet = !isTraining(status);
          const cta = CTA[status] ?? 'Open day';
          return (
            <Animated.View key={date} entering={FadeInDown.delay(i * 35).duration(260)} style={styles.flex}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${date}`}
                onPress={() => onOpen(date)}
                style={({ pressed }) => [
                  styles.row,
                  isToday && { backgroundColor: tint(t.primary, 0.1), borderColor: tint(t.primary, 0.35) },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <View style={styles.dateCol}>
                  <Text style={[styles.dow, { color: isToday ? t.primary : t.muted }]}>{SHORT_DAYS[d.getDay()]}</Text>
                  <Text style={[styles.dom, { color: isToday ? t.primary : t.text }]}>{d.getDate()}</Text>
                </View>
                <View style={styles.rail}>
                  <View style={[styles.line, { backgroundColor: i === 0 ? 'transparent' : t.border }]} />
                  <Node status={status} t={t} />
                  <View style={[styles.line, { backgroundColor: i === dates.length - 1 ? 'transparent' : t.border }]} />
                </View>
                <View style={styles.body}>
                  {isToday && <Text style={[styles.eyebrow, { color: t.primary }]}>Today</Text>}
                  <Text style={[styles.title, { color: quiet ? t.muted : t.text, fontWeight: quiet ? '500' : '700' }]}>{title}</Text>
                  {subtitle && <Text style={{ color: t.muted, fontSize: 13 }}>{subtitle}</Text>}
                </View>
                {isToday ? (
                  <View style={[styles.cta, { backgroundColor: t.primary }]}>
                    <Text style={{ color: t.onPrimary, fontWeight: '700', fontSize: 13 }}>{cta}</Text>
                    <Text style={{ color: t.onPrimary, fontWeight: '800', fontSize: 13 }}>›</Text>
                  </View>
                ) : BADGED.includes(status) && (
                  <View style={[styles.badge, { backgroundColor: tint(statusColor(status, t), 0.15) }]}>
                    <Text style={[styles.badgeText, { color: statusColor(status, t) }]}>{STATUS_LABEL[status]}</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The week fills the space it is given: the seven rows share the height left under the progress card.
  wrap: { flex: 1, gap: 10 },
  list: { flex: 1 },
  flex: { flex: 1 },
  progress: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 14,
  },
  big: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressLabel: { fontSize: 12, fontWeight: '600', lineHeight: 14 },
  segments: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
  row: {
    flex: 1, flexDirection: 'row', alignItems: 'stretch', gap: 10, paddingHorizontal: 10,
    borderRadius: 14, borderWidth: 1, borderColor: 'transparent',
  },
  dateCol: { width: 36, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  dom: { fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rail: { width: 22, alignItems: 'center' },
  line: { flex: 1, width: 2 },
  node: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  check: { fontSize: 11, fontWeight: '900', lineHeight: 13 },
  half: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  restNode: { width: 9, height: 9, borderRadius: 5, marginVertical: 5.5 },
  body: { flex: 1, justifyContent: 'center', paddingVertical: 4 },
  eyebrow: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 15 },
  cta: { flexDirection: 'row', gap: 4, alignSelf: 'center', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
  badge: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
