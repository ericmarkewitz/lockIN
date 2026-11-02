import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { DateMultiPicker } from '@/components/DateMultiPicker';
import { Button, Card, Segmented } from '@/components/ui';
import { EXPORT_FIELDS, buildExport, exportFileName, type ExportFieldKey } from '@/data/export';
import { useDb } from '@/db/DbContext';
import { addDays, todayKey } from '@/lib/dates';
import { useTheme } from '@/theme';

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

  const toggle = (k: ExportFieldKey) => {
    const next = new Set(fields);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setFields(next);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <Segmented<Range>
        options={[{ value: 'all', label: 'All data' }, { value: '30', label: 'Last 30 days' }, { value: 'pick', label: 'Pick dates' }]}
        value={range}
        onChange={setRange}
      />
      {range === 'pick' && <DateMultiPicker selected={dates} onChange={setDates} initialDate={today} />}
      <Card style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontWeight: '700', marginBottom: 4 }}>Fields to include</Text>
        {EXPORT_FIELDS.map((f) => (
          <View key={f.key} style={styles.fieldRow}>
            <Text style={{ color: t.text }}>{f.label}</Text>
            <Switch accessibilityLabel={`Include ${f.label}`} value={fields.has(f.key)} onValueChange={() => toggle(f.key)} />
          </View>
        ))}
        <View style={styles.fieldRow}>
          <Text style={{ color: t.text }}>Include sets I didn&apos;t log</Text>
          <Switch accessibilityLabel="Include unlogged sets" value={includeUnlogged} onValueChange={setIncludeUnlogged} />
        </View>
      </Card>
      {message && <Text style={{ color: t.muted }}>{message}</Text>}
      {preview && <Text style={[styles.preview, { color: t.text, backgroundColor: t.card, borderColor: t.border }]}>{preview}</Text>}
      <Button title="Preview" variant="secondary" onPress={() => run(false)} />
      <Button title="Export CSV" onPress={() => run(true)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  preview: { fontFamily: 'Courier', fontSize: 11, padding: 10, borderWidth: 1, borderRadius: 8 },
});
