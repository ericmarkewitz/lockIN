import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Exercise } from '@/data/types';
import { useTheme } from '@/theme';
import { ExerciseMotionFor } from './motion/ExerciseMotion';
import { motionFor } from './motion/motions';

/** An exercise's name and category above its stick figure, playing. */
export function ExerciseDetail({ exercise, children }: {
  exercise: Pick<Exercise, 'name' | 'isCustom' | 'categoryName' | 'subcategory'>; children?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={[styles.name, { color: t.text }]}>{exercise.name}</Text>
      <Text style={{ color: t.muted }}>
        {exercise.categoryName}
        {exercise.subcategory ? ` · ${exercise.subcategory}` : ''}
      </Text>
      <View style={[styles.stage, { backgroundColor: t.card, borderColor: t.border }]}>
        {motionFor(exercise) ? (
          <ExerciseMotionFor name={exercise.name} isCustom={exercise.isCustom} size={220} playing />
        ) : (
          <Text style={{ color: t.muted }}>Custom exercises have no animation.</Text>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, padding: 16 },
  name: { fontSize: 24, fontWeight: '700' },
  stage: {
    marginTop: 8, height: 260, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
});
