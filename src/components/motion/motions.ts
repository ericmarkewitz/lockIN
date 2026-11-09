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
  /** The figure's pose in the drawing. */
  pose: Pose;
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
    pose: pose({ hip: [22, 44], torso: 90, arm1: [178, 180], leg1: [-70, -10], leg2: [-65, -5] }),
    scene: [line([8, 48], [42, 48], 3), line([12, 48], [12, FLOOR_Y]), line([38, 48], [38, FLOOR_Y])],
    gear: [disc(at('hand1'), 4)],
  },
  'Incline Bench Press': {
    pose: pose({ hip: [22, 46], torso: 125, arm1: [165, 170], leg1: [-80, 0], leg2: [-75, 5] }),
    scene: [line([21, 50], [40, 36.7], 3), line([10, 50], [21, 50], 3), line([16, 50], [16, FLOOR_Y]), line([32, 42.3], [32, FLOOR_Y])],
    gear: [disc(at('hand1'), 4)],
  },
  Squat: {
    pose: pose({ hip: [26, 46], torso: 150, arm1: [-70, 130], leg1: [80, -20], leg2: [76, -24] }),
    scene: rackedBar,
  },
  'Front Squat': {
    pose: pose({ hip: [27, 46], torso: 165, arm1: [75, -145], leg1: [80, -20], leg2: [76, -24] }),
    scene: rackedBar,
  },
  Deadlift: {
    pose: pose({ hip: [24, 38], torso: 115, arm1: [0, 0], leg1: [40, -5], leg2: [36, -8] }),
    gear: [disc(at('hand1'), 6)],
  },
  'Romanian Deadlift': {
    pose: pose({ hip: [28, 35], torso: 100, arm1: [0, 0], leg1: [10, 0], leg2: [6, -2] }),
    gear: plate,
  },
  // Seen from the front, so both arms show pressing the bar overhead.
  'Overhead Press': {
    pose: pose({ hip: [32, 35.5], torso: 180, arm1: [125, 155], arm2: [-125, -155], leg1: [10, 3], leg2: [-10, -3] }),
    gear: [line(at('hand2', -7), at('hand1', 7), 2), disc(at('hand2', -7), 3), disc(at('hand1', 7), 3)],
  },
  'Barbell Row': {
    pose: pose({ hip: [26, 36], torso: 110, arm1: [-60, 20], leg1: [20, -5], leg2: [16, -8] }),
    gear: plate,
  },
  'Pull-up': {
    pose: pose({ hip: [28, 28], torso: 180, arm1: [80, 213], arm2: [75, 210], leg1: [20, -30], leg2: [15, -35] }),
    floor: false,
    scene: [line([6, 6], [58, 6], 2)],
  },
  'Lat Pulldown': {
    pose: pose({ hip: [26, 43], torso: 175, arm1: [30, 170], leg1: [90, 0], leg2: [88, 2] }),
    scene: [line([16, 46], [34, 46], 3), line([25, 46], [25, FLOOR_Y]), line([32, 0], at('hand1'), 1)],
    gear: [handleBar],
  },
  'Dumbbell Curl': {
    pose: pose({ ...STAND, arm1: [5, 165], arm2: [0, 160] }),
    gear: dumbbells,
  },
  'Tricep Pushdown': {
    pose: pose({ ...STAND, torso: 172, arm1: [10, 10] }),
    scene: [line([46, 0], at('hand1'), 1)],
    gear: [disc(at('hand1'), 2)],
  },
  'Leg Press': {
    pose: pose({ hip: [26, 46], torso: -115, arm1: [10, 60], leg1: [115, 115], leg2: [112, 118] }),
    scene: [line([10, 50], [30, 50], 3), line([7, 39], [14, 49], 3), line([20, 50], [20, FLOOR_Y])],
    gear: [line(at('foot1', -3.5, -3.2), at('foot1', 5.5, 1.2), 3)],
  },
  Lunge: {
    pose: pose({ hip: [30, 44], torso: 180, arm1: [2, 0], arm2: [-2, 0], leg1: [80, -20], leg2: [-20, -80] }),
    gear: dumbbells,
  },
  // Seen from the front, so the arms can rise out to the sides.
  'Lateral Raise': {
    pose: pose({ hip: [32, 34], torso: 180, arm1: [95, 95], arm2: [-95, -95], leg1: [10, 3], leg2: [-10, -3] }),
    gear: dumbbells,
  },

  // Cardio
  Running: {
    pose: pose({ hip: [32, 35], torso: 168, arm1: [40, 130], arm2: [-40, 60], leg1: [-30, -80], leg2: [40, -10] }),
  },
  Walking: {
    pose: pose({ hip: [32, 34], torso: 178, arm1: [20, 30], arm2: [-20, -10], leg1: [-20, -15], leg2: [20, 5] }),
  },
  Hiking: {
    pose: pose({ hip: [30, 34], torso: 163, arm1: [25, 40], arm2: [-20, -10], leg1: [-18, -15], leg2: [22, 5] }),
    gear: [disc(at('neck', -5, 5), 4), line(at('hand1'), at('hand1', 3, 14), 1.5)],
  },
  Biking: {
    pose: pose({ hip: [27, 32], torso: 110, arm1: [83, 20], arm2: [80, 22], leg1: [20, 10], leg2: [60, -10] }),
    scene: [
      disc([14, 50], 9, true), disc([50, 50], 9, true),
      line([14, 50], [31, 50]), line([31, 50], [26, 34]), line([26, 34], [53, 36]), line([31, 50], [53, 36]),
      line([53, 36], [50, 50]), line([23, 33], [29, 33], 2.5), disc([31, 50], 5, true),
    ],
  },
  Swimming: {
    pose: pose({ hip: [26, 36], torso: 90, arm1: [-10, -40], arm2: [90, 90], leg1: [-98, -98], leg2: [-85, -85] }),
    floor: false,
    scene: [line([0, 32], [CANVAS, 32], 1)],
  },
  Rowing: {
    pose: pose({ hip: [18, 52], torso: 200, arm1: [40, 100], leg1: [85, 95], leg2: [83, 97] }),
    scene: [line([4, 57], [60, 57], 2), disc([56, 46], 6, true), line([56, 46], at('hand1'), 1), line([46, 46], [48, 56], 2)],
    gear: [line(at('hip', -5, 3), at('hip', 5, 3), 3)],
  },
  // Racing down a slope in a tuck: the whole body is tilted 20 degrees to stand square to the hill.
  'Downhill Skiing': {
    pose: pose({ hip: [26, 32], torso: 125, arm1: [20, 50], arm2: [15, 45], leg1: [40, -40], leg2: [35, -42] }),
    floor: false,
    scene: [line([0, 43], [58, 64], 1)],
    gear: [line(at('foot1', -13, -3.2), at('foot1', 12, 5.9), 2), line(at('hand1'), at('hand1', -16, 9), 1.5)],
  },
  // Skinning uphill with a pack: skis flat along the slope, poles planted.
  'Ski Touring': {
    pose: pose({ hip: [30, 33], torso: 165, arm1: [50, 20], arm2: [-30, -10], leg1: [55, 0], leg2: [-15, -15] }),
    floor: false,
    scene: [line([0, 64], [64, 43], 1)],
    gear: [
      disc(at('neck', -5, 5), 4),
      line(at('foot1', -9, 4.5), at('foot1', 9, -1.5), 2), line(at('foot2', -9, 4.5), at('foot2', 9, -1.5), 2),
      line(at('hand1'), at('hand1', -2, 17), 1.5),
    ],
  },
  // Classic stride: legs and arms swinging opposite, long skis, poles pushing behind.
  'Cross-Country Skiing': {
    pose: pose({ hip: [30, 36], torso: 165, arm1: [55, 20], arm2: [-50, -30], leg1: [25, 5], leg2: [-25, -15] }),
    gear: [
      line(at('foot1', -12, 1.5), at('foot1', 12, 1.5), 2), line(at('foot2', -12, 1.5), at('foot2', 12, 1.5), 2),
      line(at('hand1'), at('hand1', -6, 24), 1.5), line(at('hand2'), at('hand2', -10, 24), 1.5),
    ],
  },
  // A high step over deep snow on wide snowshoes, poles in hand.
  Snowshoeing: {
    pose: pose({ hip: [30, 35.5], torso: 170, arm1: [30, 60], arm2: [-30, -10], leg1: [60, -5], leg2: [-10, -10] }),
    gear: [
      line(at('foot1', -5, 1.5), at('foot1', 6, 1.5), 3.5), line(at('foot2', -5, 1.5), at('foot2', 6, 1.5), 3.5),
      line(at('hand1'), at('hand1', 3, 14), 1.5), line(at('hand2'), at('hand2', -3, 14), 1.5),
    ],
  },
  // On a wall, reaching for the next hold.
  Climbing: {
    pose: pose({ hip: [36, 37], torso: 160, arm1: [150, 165], arm2: [40, 170], leg1: [80, 10], leg2: [30, 30] }),
    floor: false,
    scene: [line([50.5, 0], [50.5, CANVAS], 2)],
    gear: [disc(at('hand1', 1, 0), 1.8), disc(at('hand2', 1, 0), 1.8), disc(at('foot1', 1, 1), 1.8), disc(at('foot2', 1, 1), 1.8)],
  },

  // Yoga
  // Downward dog into plank, hands planted.
  Vinyasa: {
    pose: pose({ hip: [16, 35.5], torso: 60, arm1: [25, 25], leg1: [-20, -20], leg2: [-22, -22] }),
  },
  // Seen from the front: standing into warrior II.
  Hatha: {
    pose: pose({ hip: [32, 40], torso: 180, arm1: [90, 90], arm2: [-90, -90], leg1: [50, 0], leg2: [-40, -40] }),
  },
  // Seated forward fold.
  Yin: {
    pose: pose({ hip: [14, 57], torso: 115, arm1: [60, 70], leg1: [90, 90] }),
  },
  // Standing, arms up, into chair pose.
  'Power Yoga': {
    pose: pose({ hip: [28, 44], torso: 160, arm1: [140, 145], leg1: [75, -15], leg2: [72, -18] }),
  },

  // Mobility
  // Standing quad stretch: near foot held up behind the hip, far arm reaching forward for balance.
  Stretching: {
    pose: pose({ hip: [32, 35], torso: 180, arm1: [-35, -20], arm2: [115, 110], leg1: [-20, -165], leg2: [2, 0] }),
  },
  // Calves on a roller, hands planted behind, rocking the hips forward and back.
  'Foam Rolling': {
    pose: pose({ hip: [24, 52], torso: -135, arm1: [-44, 12], leg1: [97, 92], leg2: [95, 90] }),
    scene: [disc([34, 54], 4)],
  },
};

/** The stick figure for a built-in exercise. Custom exercises have none, even if the name matches. */
export function motionFor(exercise: { name: string; isCustom: boolean }): Motion | null {
  if (exercise.isCustom) return null;
  return MOTIONS[exercise.name] ?? null;
}
