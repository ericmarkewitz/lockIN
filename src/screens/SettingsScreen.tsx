import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card, Segmented } from '@/components/ui';
import { getUnits, setDistanceUnit, setWeightUnit, type DistanceUnit, type WeightUnit } from '@/data/settings';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { useTheme } from '@/theme';

export function SettingsScreen() {
  const db = useDb();
  const t = useTheme();
  const { data, reload } = useLoad(() => getUnits(db), [db]);
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
      <Card style={{ gap: 10 }}>
        <Text style={{ color: t.text, fontWeight: '700' }}>Weight unit</Text>
        {data && (
          <Segmented<WeightUnit>
            options={[{ value: 'lb', label: 'Pounds (lb)' }, { value: 'kg', label: 'Kilograms (kg)' }]}
            value={data.weight}
            onChange={(unit) => save(() => setWeightUnit(db, unit))}
          />
        )}
        <Text style={{ color: t.muted }}>
          Weights are stored once and converted for display, so you can switch units at any time without losing or altering data. Logging, history and CSV exports all use the unit selected here.
        </Text>
        <Text style={{ color: t.muted }}>
          At a gym with plates in the other unit? Tap the unit next to its weight to log one set in lb or kg. It still shows in your unit everywhere else.
        </Text>
      </Card>
      <Card style={{ gap: 10 }}>
        <Text style={{ color: t.text, fontWeight: '700' }}>Distance unit</Text>
        {data && (
          <Segmented<DistanceUnit>
            options={[{ value: 'mi', label: 'Miles (mi)' }, { value: 'km', label: 'Kilometers (km)' }]}
            value={data.distance}
            onChange={(unit) => save(() => setDistanceUnit(db, unit))}
          />
        )}
        <Text style={{ color: t.muted }}>
          Used for planned and logged distances, history and CSV exports. Tap the unit next to a distance to log one set in the other unit.
        </Text>
      </Card>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: 16, gap: 12 } });
