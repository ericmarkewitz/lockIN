import type { Joint, Point, Pose } from './skeleton';

/** Width and height of the drawing space the poses are written in. */
export const CANVAS = 64;
export const FLOOR_Y = 59;

/** A fixed point, or a point that follows a joint (optionally offset from it). */
export type Anchor = Point | { joint: Joint; dx?: number; dy?: number };
export type Prop =
  | { kind: 'line'; from: Anchor; to: Anchor; width?: number }
  | { kind: 'disc'; at: Anchor; r: number; hollow?: boolean };

export type Motion = {
  /** The figure loops back and forth between these two poses. */
  from: Pose;
  to: Pose;
  /** Milliseconds for one half of the loop (from -> to). */
  duration: number;
  /** Where along from -> to (0..1) the figure rests when it isn't playing. Defaults to 1. */
  still?: number;
  /** Drawn behind the figure: benches, bikes, water. */
  scene?: Prop[];
  /** Drawn in front of the figure: bars, dumbbells, skis. */
  gear?: Prop[];
  /** Draws the ground line. Defaults to true. */
  floor?: boolean;
};

type PoseInput = Omit<Pose, 'arm2' | 'leg2'> & Partial<Pick<Pose, 'arm2' | 'leg2'>>;
/** The far limbs default to tracking the near ones. */
const pose = (p: PoseInput): Pose => ({ ...p, arm2: p.arm2 ?? p.arm1, leg2: p.leg2 ?? p.leg1 });

const STAND = { hip: [32, 34] as Point, torso: 180, leg1: [3, 2] as [number, number], leg2: [-3, -2] as [number, number] };
const at = (joint: Joint, dx = 0, dy = 0): Anchor => ({ joint, dx, dy });
const line = (from: Anchor, to: Anchor, width?: number): Prop => ({ kind: 'line', from, to, width });
const disc = (where: Anchor, r: number, hollow?: boolean): Prop => ({ kind: 'disc', at: where, r, hollow });

const plate = [disc(at('hand1'), 5)];
/** A bar racked on the shoulders, drawn behind the head so the face stays visible. */
const rackedBar = [disc(at('hand1'), 4)];
const dumbbells = [disc(at('hand1'), 3), disc(at('hand2'), 3)];
const handleBar = line(at('hand1', -6), at('hand1', 6), 2);

/** Keyed by the seeded exercise names in `src/db/migrations.ts`. */
export const MOTIONS: Record<string, Motion> = {
  // Lifts
  'Bench Press': {
    from: pose({ hip: [22, 44], torso: 90, arm1: [280, 180], leg1: [-70, -10], leg2: [-65, -5] }),
    to: pose({ hip: [22, 44], torso: 90, arm1: [178, 180], leg1: [-70, -10], leg2: [-65, -5] }),
    duration: 1000,
    scene: [line([8, 48], [42, 48], 3), line([12, 48], [12, FLOOR_Y]), line([38, 48], [38, FLOOR_Y])],
    gear: [disc(at('hand1'), 4)],
  },
  'Incline Bench Press': {
    from: pose({ hip: [22, 46], torso: 125, arm1: [300, 170], leg1: [-80, 0], leg2: [-75, 5] }),
    to: pose({ hip: [22, 46], torso: 125, arm1: [165, 170], leg1: [-80, 0], leg2: [-75, 5] }),
    duration: 1000,
    scene: [line([14, 51], [31, 39], 3), line([10, 50], [26, 50], 3), line([18, 50], [18, FLOOR_Y])],
    gear: [disc(at('hand1'), 4)],
  },
  Squat: {
    from: pose({ ...STAND, arm1: [-40, 160] }),
    to: pose({ hip: [26, 46], torso: 150, arm1: [-70, 130], leg1: [80, -20], leg2: [76, -24] }),
    duration: 1100,
    scene: rackedBar,
  },
  'Front Squat': {
    from: pose({ ...STAND, arm1: [90, -130] }),
    to: pose({ hip: [27, 46], torso: 165, arm1: [75, -145], leg1: [80, -20], leg2: [76, -24] }),
    duration: 1100,
    scene: rackedBar,
  },
  Deadlift: {
    from: pose({ hip: [24, 38], torso: 115, arm1: [0, 0], leg1: [40, -5], leg2: [36, -8] }),
    to: pose({ ...STAND, arm1: [0, 0] }),
    still: 0,
    duration: 1200,
    gear: [disc(at('hand1'), 6)],
  },
  'Romanian Deadlift': {
    from: pose({ hip: [28, 35], torso: 100, arm1: [0, 0], leg1: [10, 0], leg2: [6, -2] }),
    to: pose({ ...STAND, arm1: [0, 0] }),
    still: 0,
    duration: 1200,
    gear: plate,
  },
  'Overhead Press': {
    from: pose({ ...STAND, hip: [32, 35], arm1: [30, 165], arm2: [25, 160] }),
    to: pose({ ...STAND, hip: [32, 35], arm1: [178, 180], arm2: [176, 178] }),
    duration: 1000,
    gear: [disc(at('hand1'), 4)],
  },
  'Barbell Row': {
    from: pose({ hip: [26, 36], torso: 110, arm1: [0, 0], leg1: [20, -5], leg2: [16, -8] }),
    to: pose({ hip: [26, 36], torso: 110, arm1: [-60, 20], leg1: [20, -5], leg2: [16, -8] }),
    duration: 900,
    gear: plate,
  },
  'Pull-up': {
    from: pose({ hip: [30, 40], torso: 180, arm1: [175, 175], leg1: [20, -30], leg2: [15, -35] }),
    to: pose({ hip: [28, 28], torso: 180, arm1: [80, 213], arm2: [75, 210], leg1: [20, -30], leg2: [15, -35] }),
    duration: 1100,
    floor: false,
    scene: [line([6, 6], [58, 6], 2)],
  },
  'Lat Pulldown': {
    from: pose({ hip: [26, 43], torso: 175, arm1: [165, 170], leg1: [90, 0], leg2: [88, 2] }),
    to: pose({ hip: [26, 43], torso: 175, arm1: [30, 170], leg1: [90, 0], leg2: [88, 2] }),
    duration: 1000,
    scene: [line([16, 46], [34, 46], 3), line([25, 46], [25, FLOOR_Y]), line([32, 0], at('hand1'), 1)],
    gear: [handleBar],
  },
  'Dumbbell Curl': {
    from: pose({ ...STAND, arm1: [5, 10], arm2: [0, 5] }),
    to: pose({ ...STAND, arm1: [5, 165], arm2: [0, 160] }),
    duration: 900,
    gear: dumbbells,
  },
  'Tricep Pushdown': {
    from: pose({ ...STAND, torso: 172, arm1: [10, 130] }),
    to: pose({ ...STAND, torso: 172, arm1: [10, 10] }),
    duration: 900,
    scene: [line([46, 0], at('hand1'), 1)],
    gear: [disc(at('hand1'), 2)],
  },
  'Leg Press': {
    from: pose({ hip: [26, 46], torso: -115, arm1: [10, 60], leg1: [135, 45], leg2: [130, 50] }),
    to: pose({ hip: [26, 46], torso: -115, arm1: [10, 60], leg1: [115, 115], leg2: [112, 118] }),
    duration: 1100,
    scene: [line([10, 50], [30, 50], 3), line([7, 39], [14, 49], 3), line([20, 50], [20, FLOOR_Y])],
    gear: [line(at('foot1', -3.5, -3.2), at('foot1', 5.5, 1.2), 3)],
  },
  Lunge: {
    from: pose({ hip: [30, 36], torso: 180, arm1: [2, 0], arm2: [-2, 0], leg1: [30, -5], leg2: [-30, -30] }),
    to: pose({ hip: [30, 44], torso: 180, arm1: [2, 0], arm2: [-2, 0], leg1: [80, -20], leg2: [-20, -80] }),
    duration: 1100,
    gear: dumbbells,
  },
  // Seen from the front, so the arms can rise out to the sides.
  'Lateral Raise': {
    from: pose({ hip: [32, 34], torso: 180, arm1: [12, 8], arm2: [-12, -8], leg1: [10, 3], leg2: [-10, -3] }),
    to: pose({ hip: [32, 34], torso: 180, arm1: [95, 95], arm2: [-95, -95], leg1: [10, 3], leg2: [-10, -3] }),
    duration: 1000,
    gear: dumbbells,
  },

  // Cardio
  Running: {
    from: pose({ hip: [32, 35], torso: 168, arm1: [-40, 60], arm2: [40, 130], leg1: [40, -10], leg2: [-30, -80] }),
    to: pose({ hip: [32, 35], torso: 168, arm1: [40, 130], arm2: [-40, 60], leg1: [-30, -80], leg2: [40, -10] }),
    duration: 420,
  },
  Walking: {
    from: pose({ hip: [32, 34], torso: 178, arm1: [-20, -10], arm2: [20, 30], leg1: [20, 5], leg2: [-20, -15] }),
    to: pose({ hip: [32, 34], torso: 178, arm1: [20, 30], arm2: [-20, -10], leg1: [-20, -15], leg2: [20, 5] }),
    duration: 700,
  },
  Hiking: {
    from: pose({ hip: [30, 34], torso: 163, arm1: [-20, -10], arm2: [25, 40], leg1: [22, 5], leg2: [-18, -15] }),
    to: pose({ hip: [30, 34], torso: 163, arm1: [25, 40], arm2: [-20, -10], leg1: [-18, -15], leg2: [22, 5] }),
    duration: 900,
    gear: [disc(at('neck', -5, 5), 4), line(at('hand1'), at('hand1', 3, 14), 1.5)],
  },
  Biking: {
    from: pose({ hip: [27, 32], torso: 110, arm1: [83, 20], arm2: [80, 22], leg1: [60, -10], leg2: [20, 10] }),
    to: pose({ hip: [27, 32], torso: 110, arm1: [83, 20], arm2: [80, 22], leg1: [20, 10], leg2: [60, -10] }),
    duration: 500,
    scene: [
      disc([14, 50], 9, true), disc([50, 50], 9, true),
      line([14, 50], [31, 50]), line([31, 50], [26, 34]), line([26, 34], [53, 36]), line([31, 50], [53, 36]),
      line([53, 36], [50, 50]), line([23, 33], [29, 33], 2.5), disc([31, 50], 5, true),
    ],
  },
  Swimming: {
    from: pose({ hip: [26, 36], torso: 90, arm1: [90, 90], arm2: [-10, -40], leg1: [-85, -85], leg2: [-98, -98] }),
    to: pose({ hip: [26, 36], torso: 90, arm1: [-10, -40], arm2: [90, 90], leg1: [-98, -98], leg2: [-85, -85] }),
    duration: 700,
    floor: false,
    scene: [line([0, 32], [CANVAS, 32], 1)],
  },
  Rowing: {
    from: pose({ hip: [30, 52], torso: 150, arm1: [80, 80], leg1: [140, 30], leg2: [138, 32] }),
    to: pose({ hip: [18, 52], torso: 200, arm1: [40, 100], leg1: [85, 95], leg2: [83, 97] }),
    duration: 1100,
    scene: [line([4, 57], [60, 57], 2), disc([56, 46], 6, true), line([56, 46], at('hand1'), 1), line([46, 46], [48, 56], 2)],
    gear: [line(at('hip', -5, 3), at('hip', 5, 3), 3)],
  },
  Skiing: {
    from: pose({ hip: [30, 40], torso: 145, arm1: [40, 70], arm2: [35, 65], leg1: [60, -20], leg2: [55, -22] }),
    to: pose({ hip: [30, 37], torso: 160, arm1: [30, 60], arm2: [25, 55], leg1: [40, -15], leg2: [36, -18] }),
    still: 0,
    duration: 900,
    floor: false,
    gear: [line(at('foot1', -14, 1.5), at('foot1', 12, 1.5), 2), line(at('hand1'), at('hand1', -12, 14), 1.5)],
  },

  // Yoga
  // Downward dog into plank, hands planted.
  Vinyasa: {
    from: pose({ hip: [16, 35.5], torso: 60, arm1: [25, 25], leg1: [-20, -20], leg2: [-22, -22] }),
    to: pose({ hip: [23.2, 47.3], torso: 117, arm1: [0, 0], leg1: [-63, -63], leg2: [-65, -65] }),
    still: 0,
    duration: 1400,
  },
  // Seen from the front: standing into warrior II.
  Hatha: {
    from: pose({ hip: [32, 34], torso: 180, arm1: [10, 5], arm2: [-10, -5], leg1: [4, 2], leg2: [-4, -2] }),
    to: pose({ hip: [32, 40], torso: 180, arm1: [90, 90], arm2: [-90, -90], leg1: [50, 0], leg2: [-40, -40] }),
    duration: 1600,
  },
  // Seated forward fold.
  Yin: {
    from: pose({ hip: [14, 57], torso: 180, arm1: [20, 60], leg1: [90, 90] }),
    to: pose({ hip: [14, 57], torso: 115, arm1: [60, 70], leg1: [90, 90] }),
    duration: 2200,
  },
  // Standing, arms up, into chair pose.
  'Power Yoga': {
    from: pose({ hip: [32, 35], torso: 180, arm1: [168, 172], leg1: [2, 1], leg2: [-2, -1] }),
    to: pose({ hip: [28, 44], torso: 160, arm1: [140, 145], leg1: [75, -15], leg2: [72, -18] }),
    duration: 1200,
  },

  // Mobility
  // Seen from the front: an overhead side bend.
  Stretching: {
    from: pose({ hip: [32, 35], torso: 180, arm1: [172, 175], arm2: [-172, -175], leg1: [10, 3], leg2: [-10, -3] }),
    to: pose({ hip: [32, 35], torso: 160, arm1: [140, 135], arm2: [150, 140], leg1: [10, 3], leg2: [-10, -3] }),
    duration: 1800,
  },
  // Calves on a roller, hands planted behind, rocking the hips forward and back.
  'Foam Rolling': {
    from: pose({ hip: [18, 52], torso: -150, arm1: [-5, -5], leg1: [96, 92], leg2: [94, 90] }),
    to: pose({ hip: [24, 52], torso: -135, arm1: [-44, 12], leg1: [97, 92], leg2: [95, 90] }),
    duration: 1500,
    scene: [disc([34, 54], 4)],
  },
};

/** The animation for a built-in exercise. Custom exercises have none, even if the name matches. */
export function motionFor(exercise: { name: string; isCustom: boolean }): Motion | null {
  if (exercise.isCustom) return null;
  return MOTIONS[exercise.name] ?? null;
}
