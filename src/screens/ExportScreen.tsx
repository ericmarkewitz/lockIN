import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Calendar } from 'react-native-calendars';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, sym } from '@/components/Icon';
import { Button, Card, Eyebrow, SectionTitle, Segmented, tapFeedback, Toggle } from '@/components/ui';
import { EXPORT_FIELDS, buildExport, exportFileName, type ExportFieldKey } from '@/data/export';
import { useDb } from '@/db/DbContext';
import { addDays, todayKey } from '@/lib/dates';
import { accentGradient, tint, useTheme } from '@/theme';

type Range = 'all' | '30' | 'pick';
type Selection = { from?: string; to?: string; dates?: string[] };

export function ExportScreen({ today = todayKey() }: { today?: string }) {
  const db = useDb();
  const t = useTheme();
  const [range, setRange] = useState<Range>('all');
  const [dates, setDates] = useState<string[]>([]);
  const [fields, setFields] = useState<Set<ExportFieldKey>>(new Set(EXPORT_FIELDS.map((f) => f.key)));
  const [includeUnlogged, setIncludeUnlogged] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const selection = (): Selection | string => {
    if (range === 'all') return {};
    if (range === '30') return { from: addDays(today, -29), to: today };
    if (!dates.length) return 'Pick at least one date.';
    return { dates };
  };

  const run = async (share: boolean) => {
    setMessage(null);
    const sel = selection();
    if (typeof sel === 'string') return setMessage(sel);
    if (!fields.size) return setMessage('Select at least one field.');
    try {
      const ordered = EXPORT_FIELDS.filter((f) => fields.has(f.key)).map((f) => f.key);
      const { csv, rows } = await buildExport(db, { fields: ordered, includeUnlogged, ...sel });
      if (!share) {
        setPreview(csv.split('\r\n').slice(0, 6).join('\n'));
        return setMessage(`${rows.length} row${rows.length === 1 ? '' : 's'} match.`);
      }
      if (!rows.length) return setMessage('No logged workouts in that range.');
      const file = new File(Paths.cache, exportFileName(sel));
      file.create({ overwrite: true });
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Export workouts' });
      } else {
        setMessage(`Saved to ${file.uri}`);
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const toggleDate = (d: string) =>
    setDates((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  const toggle = (k: ExportFieldKey) => {
    const next = new Set(fields);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setFields(next);
  };

  const rangeLabel = range === 'all' ? 'All data' : range === '30' ? 'Last 30 days' : `${dates.length} day${dates.length === 1 ? '' : 's'} picked`;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <View style={[styles.hero, { backgroundColor: t.primary, experimental_backgroundImage: accentGradient(t) }]}>
        <View style={[styles.heroIcon, { backgroundColor: tint(t.onPrimary, 0.16) }]}>
          <Icon name={sym('tablecells.fill', 'table_chart')} size={22} color={t.onPrimary} fallback="▦" />
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow color={tint(t.onPrimary, 0.8)}>CSV export</Eyebrow>
          <Text style={[styles.heroTitle, { color: t.onPrimary }]}>{rangeLabel}</Text>
          <Text style={{ color: tint(t.onPrimary, 0.85), fontWeight: '600' }}>{fields.size} of {EXPORT_FIELDS.length} fields</Text>
        </View>
      </View>

      <Card style={styles.section}>
        <SectionTitle title="Date range" icon={sym('calendar', 'calendar_month')} />
        <Segmented<Range>
          options={[{ value: 'all', label: 'All data' }, { value: '30', label: 'Last 30 days' }, { value: 'pick', label: 'Pick dates' }]}
          value={range}
          onChange={setRange}
        />
        {range === 'pick' && (
          <>
            <Calendar
              testID="export-calendar"
              current={today}
              firstDay={1}
              markedDates={Object.fromEntries(dates.map((d) => [d, { selected: true }]))}
              onDayPress={({ dateString }) => toggleDate(dateString)}
              theme={{
                calendarBackground: t.card, dayTextColor: t.text, monthTextColor: t.text, textDisabledColor: t.muted,
                textSectionTitleColor: t.muted, arrowColor: t.primary, todayTextColor: t.primary,
                selectedDayBackgroundColor: t.primary, selectedDayTextColor: t.onPrimary,
                textMonthFontWeight: '900', textDayFontWeight: '600', textDayHeaderFontWeight: '800',
              }}
              key={t.bg} // theme is only read on mount; remount when light/dark changes
            />
            <Text style={{ color: t.muted, fontWeight: '600' }}>{dates.length} day{dates.length === 1 ? '' : 's'} selected</Text>
          </>
        )}
      </Card>

      <Card style={styles.section}>
        <SectionTitle title="Columns" icon={sym('list.bullet', 'view_column')} />
        <View style={styles.chips}>
          {EXPORT_FIELDS.map((f) => {
            const on = fields.has(f.key);
            return (
              <Pressable
                key={f.key}
                accessibilityRole="checkbox"
                accessibilityLabel={`Include ${f.label}`}
                accessibilityState={{ checked: on }}
                onPress={() => { tapFeedback(); toggle(f.key); }}
                style={({ pressed }) => [
                  styles.chip,
                  on
                    ? { backgroundColor: tint(t.primary, 0.14), borderColor: tint(t.primary, 0.5) }
                    : { backgroundColor: 'transparent', borderColor: t.border },
                  { transform: [{ scale: pressed ? 0.95 : 1 }] },
                ]}
              >
                {on && <Icon name={sym('checkmark', 'check')} size={12} color={t.primary} fallback="✓" />}
                <Text style={[styles.chipText, { color: on ? t.primary : t.muted }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.fieldRow, { borderTopColor: t.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '700' }}>Include sets I didn&apos;t log</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>Planned sets left blank show up as empty rows.</Text>
          </View>
          <Toggle label="Include unlogged sets" value={includeUnlogged} onChange={setIncludeUnlogged} />
        </View>
      </Card>

      {message && <Text style={[styles.message, { color: t.muted }]}>{message}</Text>}
      {preview && (
        <Card style={styles.section}>
          <Eyebrow>Preview</Eyebrow>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={[styles.preview, { color: t.text }]}>{preview}</Text>
          </ScrollView>
        </Card>
      )}
      <View style={styles.actions}>
        <Button title="Preview" variant="secondary" onPress={() => run(false)} style={styles.action} />
        <Button title="Export CSV" onPress={() => run(true)} style={{ ...styles.action, flex: 2 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14, paddingBottom: 32 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 24 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.6 },
  section: { gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: '700' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  message: { textAlign: 'center', fontWeight: '600' },
  preview: { fontFamily: 'Courier', fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, paddingVertical: 16 },
});
