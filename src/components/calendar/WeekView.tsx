import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { CategoryKind, DaySummary, DayStatus } from '@/data/types';
import { weekProgress } from '@/lib/calendar';
import { parseDateKey } from '@/lib/dates';
import { accentGradient, tint, useTheme, type Theme } from '@/theme';
import { Eyebrow, useRaised } from '../ui';
import { KindIcon } from './KindIcon';
import { statusColor, statusLabel } from './status';

const KIND_LABEL: Record<CategoryKind, string> = { strength: 'Lifts', cardio: 'Cardio', mindbody: 'Mind & Body' };
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CTA: Partial<Record<DayStatus, string>> = { planned: 'Start workout', partial: 'Continue', completed: 'View workout' };
/** Statuses worth a badge: the rest read fine from the title alone. */
const BADGED: DayStatus[] = ['completed', 'partial', 'missed'];

const isTraining = (s: DayStatus) => s !== 'none' && s !== 'rest';

function describe(s: DaySummary | undefined): { title: string; subtitle?: string } {
  if (s?.beforePlan) return { title: 'Before your plan' };
  if (!s || s.status === 'none') return { title: 'Nothing planned' };
  if (s.status === 'rest') return { title: 'Rest day' };
  return {
    title: s.kinds.map((k) => KIND_LABEL[k]).join(' + '),
    subtitle: `${s.exerciseCount} exercise${s.exerciseCount === 1 ? '' : 's'}`,
  };
}

/** The dot on the timeline rail for one day. */
function Node({ status, t, onAccent }: { status: DayStatus; t: Theme; onAccent?: boolean }) {
  const c = onAccent ? t.onPrimary : statusColor(status, t);
  if (!isTraining(status)) return <View style={[styles.restNode, { backgroundColor: status === 'rest' || onAccent ? c : t.border }]} />;
  const filled = status === 'completed';
  const hollow = onAccent ? tint(t.onPrimary, 0.15) : t.bg;
  return (
    <View style={[styles.node, { borderColor: c, backgroundColor: filled ? c : hollow }]}>
      {filled && <Text style={[styles.check, { color: onAccent ? t.primary : t.bg }]}>✓</Text>}
      {status === 'partial' && <View style={[styles.half, { backgroundColor: c }]} />}
    </View>
  );
}

function Progress({ days, t }: { days: DaySummary[]; t: Theme }) {
  const raised = useRaised();
  const { done, total } = weekProgress(days);
  const training = days.filter((d) => isTraining(d.status));
  const complete = total > 0 && done === total;
  return (
    <View
      accessible
      accessibilityLabel={`${done} of ${total} workouts done`}
      style={[styles.progress, { backgroundColor: t.card, borderColor: t.border }, raised]}
    >
      <View style={styles.progressTop}>
        <Eyebrow>This week</Eyebrow>
        {complete && <Eyebrow color={t.success}>Week complete 🔥</Eyebrow>}
      </View>
      <View style={styles.progressMain}>
        <Text style={[styles.big, { color: t.text }]}>
          {done}<Text style={{ color: t.muted }}>/{total}</Text>
        </Text>
        <Text style={[styles.progressLabel, { color: t.muted }]}>
          {total ? 'workouts\ndone' : 'Nothing planned this week'}
        </Text>
        {total > 0 && (
          <View style={styles.segments}>
            {training.map((d) => (
              <View
                key={d.date}
                style={[
                  styles.segment,
                  d.status === 'completed'
                    ? { backgroundColor: t.success }
                    : d.status === 'planned'
                      ? { backgroundColor: t.surface }
                      : { backgroundColor: statusColor(d.status, t) },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export function WeekView({ dates, byDate, today, onOpen }: {
  dates: string[]; byDate: Map<string, DaySummary>; today: string; onOpen: (date: string) => void;
}) {
  const t = useTheme();
  const raised = useRaised();
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
                  isToday
                    ? { backgroundColor: t.primary, experimental_backgroundImage: accentGradient(t), boxShadow: `0px 8px 20px ${tint(t.primary, 0.35)}` }
                    : !quiet && [{ backgroundColor: t.card, borderColor: t.border }, raised],
                  { transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                <View style={styles.dateCol}>
                  <Text style={[styles.dow, { color: isToday ? tint(t.onPrimary, 0.8) : t.muted }]}>{SHORT_DAYS[d.getDay()]}</Text>
                  <Text style={[styles.dom, { color: isToday ? t.onPrimary : quiet ? t.muted : t.text }]}>{d.getDate()}</Text>
                </View>
                <View style={styles.rail}>
                  <View style={[styles.line, styles.lineTop, { backgroundColor: i === 0 || isToday ? 'transparent' : t.border }]} />
                  <Node status={status} t={t} onAccent={isToday} />
                  <View style={[styles.line, styles.lineBottom, { backgroundColor: i === dates.length - 1 || isToday ? 'transparent' : t.border }]} />
                </View>
                <View style={styles.body}>
                  {isToday && <Text style={[styles.eyebrow, { color: tint(t.onPrimary, 0.8) }]}>Today</Text>}
                  <View style={styles.titleRow}>
                    {!quiet && s && s.kinds.slice(0, 2).map((k) => (
                      <KindIcon key={k} kind={k} size={13} color={isToday ? t.onPrimary : t.primary} />
                    ))}
                    <Text
                      numberOfLines={1}
                      style={[styles.title, { color: isToday ? t.onPrimary : quiet ? t.muted : t.text, fontWeight: quiet ? '500' : '800' }]}
                    >
                      {title}
                    </Text>
                  </View>
                  {subtitle && <Text style={{ color: isToday ? tint(t.onPrimary, 0.8) : t.muted, fontSize: 13, fontWeight: '500' }}>{subtitle}</Text>}
                </View>
                {isToday ? (
                  <View style={[styles.cta, { backgroundColor: t.onPrimary }]}>
                    <Text style={{ color: t.primary, fontWeight: '800', fontSize: 13 }}>{cta}</Text>
                    <Text style={{ color: t.primary, fontWeight: '900', fontSize: 13 }}>›</Text>
                  </View>
                ) : BADGED.includes(status) && (
                  <View style={[styles.badge, { backgroundColor: tint(statusColor(status, t), 0.15) }]}>
                    <Text style={[styles.badgeText, { color: statusColor(status, t) }]}>{statusLabel(status, date, today)}</Text>
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
  wrap: { flex: 1, gap: 12 },
  list: { flex: 1, gap: 4 },
  flex: { flex: 1 },
  progress: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  big: { fontSize: 34, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  progressLabel: { fontSize: 12, fontWeight: '700', lineHeight: 14 },
  segments: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 10, borderRadius: 5 },
  row: {
    flex: 1, flexDirection: 'row', alignItems: 'stretch', gap: 10, paddingHorizontal: 10,
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent',
  },
  dateCol: { width: 36, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dow: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  dom: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  rail: { width: 22, alignItems: 'center' },
  // The lines reach past the row into the gap so the timeline stays unbroken between rows.
  line: { flex: 1, width: 2 },
  lineTop: { marginTop: -4 },
  lineBottom: { marginBottom: -4 },
  node: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  check: { fontSize: 11, fontWeight: '900', lineHeight: 13 },
  half: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  restNode: { width: 9, height: 9, borderRadius: 5, marginVertical: 5.5 },
  body: { flex: 1, justifyContent: 'center', paddingVertical: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  title: { fontSize: 16, letterSpacing: -0.2, flexShrink: 1 },
  cta: { flexDirection: 'row', gap: 4, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  badge: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '800' },
});
