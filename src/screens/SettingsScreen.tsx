import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card, Segmented } from '@/components/ui';
import { getWeightUnit, setWeightUnit, type WeightUnit } from '@/data/settings';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { useTheme } from '@/theme';

export function SettingsScreen() {
  const db = useDb();
  const t = useTheme();
  const { data, reload } = useLoad(() => getWeightUnit(db), [db]);
  const [error, setError] = useState<string | null>(null);

  const change = async (unit: WeightUnit) => {
    try {
      await setWeightUnit(db, unit);
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
            value={data}
            onChange={change}
          />
        )}
        <Text style={{ color: t.muted }}>
          Weights are stored once and converted for display, so you can switch units at any time without losing or altering data. Logging, history and CSV exports all use the unit selected here.
        </Text>
        {error && <Text style={{ color: t.danger }}>{error}</Text>}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: 16, gap: 12 } });
