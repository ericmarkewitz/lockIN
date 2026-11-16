import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tint, useTheme } from '@/theme';

export type TrendPoint = { key: string; value: number };

const PAD_X = 8;
const PAD_Y = 14;
const DOT = 8;
const LINE = 3;
/** Room on the right for the top and bottom value labels, so the line never runs under them. */
const AXIS_W = 44;

/**
 * A line through `points` (oldest first), scaled between their lowest and highest value so small gains show.
 * Drawn with plain views, so it needs no native module. Points appear once the chart has measured its width.
 */
export function TrendChart({
  points, label, height = 140, formatValue = String,
}: { points: TrendPoint[]; label: string; height?: number; formatValue?: (n: number) => string }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const axis = max === min ? 0 : AXIS_W;
  const plotW = width - axis;
  const xy = points.map((p, i) => {
    const x = points.length === 1 ? plotW / 2 : PAD_X + (i * (plotW - 2 * PAD_X)) / (points.length - 1);
    const y = max === min ? height / 2 : PAD_Y + (1 - (p.value - min) / (max - min)) * (height - 2 * PAD_Y);
    return { x, y };
  });

  return (
    <View
      accessible
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height }}
    >
      {max !== min && (
        <>
          <View style={[styles.grid, { top: PAD_Y, borderColor: t.border }]} />
          <View style={[styles.grid, { top: height - PAD_Y, borderColor: t.border }]} />
          <Text style={[styles.axis, { top: PAD_Y - 14, color: t.muted }]}>{formatValue(max)}</Text>
          <Text style={[styles.axis, { top: height - PAD_Y + 2, color: t.muted }]}>{formatValue(min)}</Text>
        </>
      )}
      {width > 0 && xy.slice(1).map((b, i) => {
        const a = xy[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        return (
          <View
            key={points[i + 1].key}
            testID={`trend-segment-${points[i + 1].key}`}
            style={[styles.segment, {
              left: (a.x + b.x) / 2 - len / 2, top: (a.y + b.y) / 2 - LINE / 2, width: len,
              backgroundColor: tint(t.primary, 0.55),
              transform: [{ rotate: `${Math.atan2(b.y - a.y, b.x - a.x)}rad` }],
            }]}
          />
        );
      })}
      {width > 0 && xy.map(({ x, y }, i) => {
        const last = i === points.length - 1;
        const size = last ? DOT + 4 : DOT;
        return (
          <View
            key={points[i].key}
            testID={`trend-point-${points[i].key}`}
            style={[styles.dot, { left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2 },
              { backgroundColor: last ? t.primary : t.card, borderColor: t.primary }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
  axis: { position: 'absolute', right: 0, width: AXIS_W, textAlign: 'right', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  segment: { position: 'absolute', height: LINE, borderRadius: LINE / 2 },
  dot: { position: 'absolute', borderWidth: 2 },
});
