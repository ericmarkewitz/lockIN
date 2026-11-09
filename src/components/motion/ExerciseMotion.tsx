import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { CANVAS, FLOOR_Y, motionFor, type Anchor, type Motion, type Prop } from './motions';
import { HEAD_RADIUS, skeleton, type Joint, type Point, type Skeleton } from './skeleton';


function resolve(a: Anchor, joints: Skeleton): Point {
  if (Array.isArray(a)) return a;
  const p = joints[a.joint];
  return [p[0] + (a.dx ?? 0), p[1] + (a.dy ?? 0)];
}

/** A rounded bar from `a` to `b`, in canvas units scaled by `k`. */
function segmentStyle(a: Point, b: Point, width: number, k: number) {
  const dx = (b[0] - a[0]) * k;
  const dy = (b[1] - a[1]) * k;
  const length = Math.sqrt(dx * dx + dy * dy) + width; // + width so the round caps meet at the joints
  return {
    width: length,
    transform: [
      { translateX: ((a[0] + b[0]) / 2) * k - length / 2 },
      { translateY: ((a[1] + b[1]) / 2) * k - width / 2 },
      { rotate: `${Math.atan2(dy, dx)}rad` },
    ],
  };
}

function discStyle(c: Point, r: number, k: number) {
  return { transform: [{ translateX: (c[0] - r) * k }, { translateY: (c[1] - r) * k }] };
}

function Segment({ joints, from, to, width, k, color }: {
  joints: Skeleton; from: Anchor; to: Anchor; width: number; k: number; color: string;
}) {
  const style = segmentStyle(resolve(from, joints), resolve(to, joints), width, k);
  return (
    <View
      style={[styles.abs, { height: width, borderRadius: width / 2, backgroundColor: color }, style]}
    />
  );
}

function Disc({ joints, at, r, hollow, k, color }: {
  joints: Skeleton; at: Anchor; r: number; hollow?: boolean; k: number; color: string;
}) {
  const style = discStyle(resolve(at, joints), r, k);
  const size = r * 2 * k;
  return (
    <View
      style={[
        styles.abs,
        { width: size, height: size, borderRadius: size / 2 },
        hollow ? { borderWidth: Math.max(1, 1.2 * k), borderColor: color } : { backgroundColor: color },
        style,
      ]}
    />
  );
}

function PropView({ prop, ...rest }: { prop: Prop; joints: Skeleton; k: number; color: string }) {
  return prop.kind === 'line'
    ? <Segment {...rest} from={prop.from} to={prop.to} width={(prop.width ?? 1.5) * rest.k} />
    : <Disc {...rest} at={prop.at} r={prop.r} hollow={prop.hollow} />;
}

const bone = (from: Joint, to: Joint) => ({ from: { joint: from }, to: { joint: to } });
const TORSO = bone('hip', 'neck');
const LIMBS = [
  bone('neck', 'elbow1'), bone('elbow1', 'hand1'), bone('neck', 'elbow2'), bone('elbow2', 'hand2'),
  bone('hip', 'knee1'), bone('knee1', 'foot1'), bone('hip', 'knee2'), bone('knee2', 'foot2'),
];

/** A stick figure holding the still pose of an exercise. */
export function ExerciseMotion({ motion, size = 64, testID }: { motion: Motion; size?: number; testID?: string }) {
  const t = useTheme();
  const k = size / CANVAS;
  const joints = skeleton(motion.pose);
  const limb = 2.6 * k;
  const common = { joints, k };

  return (
    <View testID={testID} accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      {motion.floor !== false && (
        <Segment {...common} from={[3, FLOOR_Y + 1.5]} to={[CANVAS - 3, FLOOR_Y + 1.5]} width={k} color={t.border} />
      )}
      {motion.scene?.map((p, i) => <PropView key={`s${i}`} prop={p} {...common} color={t.muted} />)}
      <Segment {...common} {...TORSO} width={limb * 1.2} color={t.text} />
      {LIMBS.map((b, i) => <Segment key={`l${i}`} {...common} {...b} width={limb} color={t.text} />)}
      <Disc {...common} at={{ joint: 'head' }} r={HEAD_RADIUS} color={t.text} />
      {motion.gear?.map((p, i) => <PropView key={`g${i}`} prop={p} {...common} color={t.primary} />)}
    </View>
  );
}

/** The stick figure for a built-in exercise, or nothing for a custom one. */
export function ExerciseMotionFor({ name, isCustom, size }: { name: string; isCustom: boolean; size?: number }) {
  const motion = motionFor({ name, isCustom });
  return motion ? <ExerciseMotion motion={motion} size={size} testID={`motion-${name}`} /> : null;
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});
