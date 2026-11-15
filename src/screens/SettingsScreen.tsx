import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { ThemePicker } from '@/components/ThemePicker';
import { sym } from '@/components/Icon';
import { Card, SectionTitle, Segmented } from '@/components/ui';
import {
  getRestSeconds, getUnits, REST_OPTIONS, setDistanceUnit, setRestSeconds, setWeightUnit,
  type Appearance, type DistanceUnit, type WeightUnit,
} from '@/data/settings';
import { formatRest } from '@/components/RestTimer';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { useTheme, useThemeSettings } from '@/theme';

export function SettingsScreen() {
  const db = useDb();
  const t = useTheme();
  const theme = useThemeSettings();
  const { data, reload } = useLoad(async () => ({ ...(await getUnits(db)), rest: await getRestSeconds(db) }), [db]);
  const [error, setError] = useState<string | null>(null);

  const save = async (write: () => Promise<void>) => {
    try {
      await write();
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    await reload();
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <Card style={{ gap: 12 }}>
        <SectionTitle title="Weight unit" icon={sym('scalemass.fill', 'fitness_center')} />
        {data && (
          <Segmented<WeightUnit>
            options={[{ value: 'lb', label: 'Pounds (lb)' }, { value: 'kg', label: 'Kilograms (kg)' }]}
            value={data.weight}
            onChange={(unit) => save(() => setWeightUnit(db, unit))}
          />
        )}
        <Text style={[styles.help, { color: t.muted }]}>
          Weights are stored once and converted for display, so you can switch units at any time without losing or altering data. Logging, history and CSV exports all use the unit selected here.
        </Text>
        <Text style={[styles.help, { color: t.muted }]}>
          At a gym with plates in the other unit? Tap the unit next to its weight to log one set in lb or kg. It still shows in your unit everywhere else.
        </Text>
      </Card>
      <Card style={{ gap: 12 }}>
        <SectionTitle title="Distance unit" icon={sym('figure.run', 'directions_run')} />
        {data && (
          <Segmented<DistanceUnit>
            options={[{ value: 'mi', label: 'Miles (mi)' }, { value: 'km', label: 'Kilometers (km)' }]}
            value={data.distance}
            onChange={(unit) => save(() => setDistanceUnit(db, unit))}
          />
        )}
        <Text style={[styles.help, { color: t.muted }]}>
          Used for planned and logged distances, history and CSV exports. Tap the unit next to a distance to log one set in the other unit.
        </Text>
      </Card>
      <Card style={{ gap: 12 }}>
        <SectionTitle title="Rest between sets" icon={sym('timer', 'timer')} />
        {data && (
          <Segmented<string>
            options={REST_OPTIONS.map((s) => ({ value: String(s), label: s ? formatRest(s * 1000) : 'Off' }))}
            value={String(data.rest)}
            onChange={(s) => save(() => setRestSeconds(db, Number(s)))}
          />
        )}
        <Text style={[styles.help, { color: t.muted }]}>
          Workout mode counts this down after each set. Add or take away time while it runs.
        </Text>
      </Card>
      <Card style={{ gap: 12 }}>
        <SectionTitle title="Theme" icon={sym('paintpalette.fill', 'palette')} />
        <ThemePicker value={theme.themeId} onChange={(id) => save(() => theme.setThemeId(id))} />
      </Card>
      <Card style={{ gap: 12 }}>
        <SectionTitle title="Appearance" icon={sym('circle.lefthalf.filled', 'contrast')} />
        <Segmented<Appearance>
          options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          value={theme.appearance}
          onChange={(appearance) => save(() => theme.setAppearance(appearance))}
        />
        <Text style={[styles.help, { color: t.muted }]}>
          System follows your phone&apos;s light or dark mode. Every theme has both.
        </Text>
      </Card>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14 },
  help: { fontSize: 14, lineHeight: 20 },
});
