/**
 * A stick figure on a small square canvas, described by joint angles.
 *
 * Angles are absolute degrees in screen space: 0 points down, 90 right (the way the figure faces),
 * 180 up and -90 left. Limb pairs are [upper, lower] (upper arm + forearm, thigh + shin); side 1 is
 * the near limb and side 2 the far one. Everything here runs as a Reanimated worklet.
 */
export type Point = [number, number];
export type Pose = {
  hip: Point;
  torso: number;
  arm1: [number, number];
  arm2: [number, number];
  leg1: [number, number];
  leg2: [number, number];
};

export const BONES = { torso: 16, neck: 6, upperArm: 9, forearm: 9, thigh: 12, shin: 12 };
export const HEAD_RADIUS = 5;

export type Joint = 'hip' | 'neck' | 'head' | 'elbow1' | 'hand1' | 'elbow2' | 'hand2' | 'knee1' | 'foot1' | 'knee2' | 'foot2';
export type Skeleton = Record<Joint, Point>;

function step(from: Point, angle: number, length: number): Point {
  'worklet';
  const r = (angle * Math.PI) / 180;
  return [from[0] + length * Math.sin(r), from[1] + length * Math.cos(r)];
}

export function skeleton(p: Pose): Skeleton {
  'worklet';
  const neck = step(p.hip, p.torso, BONES.torso);
  const elbow1 = step(neck, p.arm1[0], BONES.upperArm);
  const elbow2 = step(neck, p.arm2[0], BONES.upperArm);
  const knee1 = step(p.hip, p.leg1[0], BONES.thigh);
  const knee2 = step(p.hip, p.leg2[0], BONES.thigh);
  return {
    hip: p.hip,
    neck,
    head: step(neck, p.torso, BONES.neck),
    elbow1,
    hand1: step(elbow1, p.arm1[1], BONES.forearm),
    elbow2,
    hand2: step(elbow2, p.arm2[1], BONES.forearm),
    knee1,
    foot1: step(knee1, p.leg1[1], BONES.shin),
    knee2,
    foot2: step(knee2, p.leg2[1], BONES.shin),
  };
}

const mix = (a: number, b: number, t: number) => {
  'worklet';
  return a + (b - a) * t;
};
const mix2 = (a: [number, number], b: [number, number], t: number): [number, number] => {
  'worklet';
  return [mix(a[0], b[0], t), mix(a[1], b[1], t)];
};

/** The pose a fraction `t` of the way from `a` to `b`. */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  'worklet';
  return {
    hip: mix2(a.hip, b.hip, t),
    torso: mix(a.torso, b.torso, t),
    arm1: mix2(a.arm1, b.arm1, t),
    arm2: mix2(a.arm2, b.arm2, t),
    leg1: mix2(a.leg1, b.leg1, t),
    leg2: mix2(a.leg2, b.leg2, t),
  };
}
