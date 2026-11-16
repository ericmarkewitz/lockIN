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
const dumbbells = [disc(at('hand1'), 3), disc(at('hand2'), 3)];
const handleBar = line(at('hand1', -6), at('hand1', 6), 2);

/** Keyed by the built-in exercise names in `CATALOG` (`src/data/catalog.ts`). */
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
    // The near plate covers the shoulders from the side; set back on the traps so the face shows.
    gear: [disc(at('neck', -3, -1.5), 4)],
  },
  'Front Squat': {
    pose: pose({ hip: [27, 46], torso: 165, arm1: [75, -120], leg1: [80, -20], leg2: [76, -24] }),
    // Across the front of the shoulders, below the chin, elbows up.
    gear: [disc(at('neck', 4, 1), 3.5)],
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
  'Bent-Over Row': {
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
  'Bicep Curl': {
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

  'Close-Grip Bench Press': {
    // Bench press with the elbows tucked in toward the ribs.
    pose: pose({ hip: [22, 44], torso: 90, arm1: [215, 180], leg1: [-70, -10], leg2: [-65, -5] }),
    scene: [line([8, 48], [42, 48], 3), line([12, 48], [12, FLOOR_Y]), line([38, 48], [38, FLOOR_Y])],
    gear: [disc(at('hand1'), 4)],
  },
  // Seen from the front: a cable crossover, arms wide with a soft bend, cables from high pulleys.
  'Pec Fly': {
    pose: pose({ hip: [32, 34], torso: 180, arm1: [100, 125], arm2: [-100, -125], leg1: [10, 3], leg2: [-10, -3] }),
    scene: [line([62, 2], at('hand1'), 1), line([2, 2], at('hand2'), 1)],
    gear: [disc(at('hand1'), 1.8), disc(at('hand2'), 1.8)],
  },
  // Top of the push-up: body in one straight line, hands under the shoulders.
  'Push-up': {
    pose: pose({ hip: [25, 48.2], torso: 117, arm1: [0, 0], leg1: [-63, -63], leg2: [-62, -62] }),
  },
  'Seated Cable Row': {
    pose: pose({ hip: [18, 52], torso: 180, arm1: [-20, 90], leg1: [80, 95], leg2: [78, 97] }),
    scene: [
      line([6, 56], [26, 56], 3), line([43.5, 48], [43.5, 58], 2), // seat, footplate
      line([58, 20], [58, FLOOR_Y], 2), line(at('hand1'), [58, 44.5], 1), // stack, cable
    ],
    gear: [line(at('hand1', 0, -2), at('hand1', 0, 2), 2)],
  },
  // Chest down on an incline bench, rowing the dumbbells up beside it.
  'Chest-Supported Row': {
    pose: pose({ hip: [24, 42], torso: 135, arm1: [-35, 10], leg1: [-30, -60], leg2: [-26, -56] }),
    scene: [line([26.5, 44.5], [38, 33], 3), line([32, 39], [32, FLOOR_Y]), line([24, FLOOR_Y], [40, FLOOR_Y], 2)],
    gear: [disc(at('hand1'), 3)],
  },
  // On a flat bench, arms long overhead, the dumbbell lowered behind the head.
  'Lat Pullover': {
    pose: pose({ hip: [22, 44], torso: 90, arm1: [130, 130], leg1: [-70, -10], leg2: [-65, -5] }),
    scene: [line([8, 48], [42, 48], 3), line([12, 48], [12, FLOOR_Y]), line([38, 48], [38, FLOOR_Y])],
    gear: [disc(at('hand1'), 3.5)],
  },
  // Seen from the front: dumbbells at the chin, palms in, elbows tucked, before rotating up.
  'Arnold Press': {
    pose: pose({ hip: [32, 34], torso: 180, arm1: [30, 172], arm2: [-30, -172], leg1: [10, 3], leg2: [-10, -3] }),
    gear: dumbbells,
  },
  // Hinged over, raising the dumbbells out wide toward the ceiling.
  'Rear Delt Fly': {
    pose: pose({ hip: [24, 36], torso: 105, arm1: [170, 160], leg1: [20, -5], leg2: [16, -8] }),
    gear: [disc(at('hand1'), 3)],
  },
  // Rope pulled back to the face from a pulley at head height, elbows high.
  'Face Pull': {
    pose: pose({ ...STAND, arm1: [-100, 155] }),
    scene: [line([58, 0], [58, FLOOR_Y], 2), line([58, 10], at('hand1'), 1)],
    gear: [disc(at('hand1'), 1.8)],
  },
  // Overhead cable extension: facing away from a high pulley, leaning in, pressing the rope out overhead.
  'Tricep Extension': {
    pose: pose({ hip: [30, 35], torso: 165, arm1: [140, 140], leg1: [20, 0], leg2: [-15, -5] }),
    scene: [line([4, 0], [4, FLOOR_Y], 2), line([4, 4], at('hand1'), 1)],
    gear: [disc(at('hand1'), 1.8)],
  },
  // On a flat bench, upper arms still, lowering the bar toward the forehead.
  'Skull Crusher': {
    pose: pose({ hip: [22, 44], torso: 90, arm1: [170, 80], leg1: [-70, -10], leg2: [-65, -5] }),
    scene: [line([8, 48], [42, 48], 3), line([12, 48], [12, FLOOR_Y]), line([38, 48], [38, FLOOR_Y])],
    gear: [line(at('hand1', 0, -2.5), at('hand1', 0, 2.5), 2)],
  },
  // Seated, the backs of the upper arms on the sloped pad, curling up.
  'Preacher Curl': {
    pose: pose({ hip: [24, 46], torso: 170, arm1: [40, 160], leg1: [90, 0], leg2: [88, 2] }),
    scene: [
      line([16, 49], [30, 49], 3), line([23, 49], [23, FLOOR_Y]), // seat
      line([26, 33], [34, 42], 4), line([31, 40], [31, FLOOR_Y]), // pad
    ],
    gear: [disc(at('hand1'), 2.5)],
  },
  // Standing, curling a handle up from a low pulley in front.
  'Cable Curl': {
    pose: pose({ ...STAND, arm1: [5, 150] }),
    scene: [line([50, 50], [50, FLOOR_Y], 2), line([50, 51], at('hand1'), 1)],
    gear: [line(at('hand1', -3), at('hand1', 3), 2)],
  },
  // Squatting with a dumbbell held upright at the chest.
  'Goblet Squat': {
    pose: pose({ hip: [27, 46], torso: 160, arm1: [30, 150], leg1: [80, -20], leg2: [76, -24] }),
    gear: [disc(at('hand1'), 3.5)],
  },
  // Front foot on the floor, rear foot up on a bench behind, dropping the back knee.
  'Bulgarian Split Squat': {
    pose: pose({ hip: [30, 44], torso: 180, arm1: [2, 0], arm2: [-2, 0], leg1: [75, 0], leg2: [-20, -100] }),
    scene: [line([3, 55], [17, 55], 3), line([8, 55], [8, FLOOR_Y])],
    gear: dumbbells,
  },
  // Hinging on one leg, the other leg reaching back in line with the torso.
  'Single-Leg Romanian Deadlift': {
    pose: pose({ hip: [28, 35], torso: 95, arm1: [0, 0], leg1: [-95, -95], leg2: [0, 0] }),
    gear: [disc(at('hand1'), 3)],
  },
  // Stepping up onto a box, dumbbells at the sides.
  'Step-up': {
    pose: pose({ hip: [28, 36], torso: 178, arm1: [2, 0], arm2: [-2, 0], leg1: [85, 5], leg2: [-15, -15] }),
    scene: [line([35, 49], [50, 49], 2), line([35, 49], [35, FLOOR_Y], 2), line([50, 49], [50, FLOOR_Y], 2)],
    gear: dumbbells,
  },
  // Shoulders on a bench, hips driven up under a barbell, shins vertical.
  'Hip Thrust': {
    pose: pose({ hip: [32, 47], torso: -90, arm1: [70, 140], leg1: [90, 0], leg2: [88, 2] }),
    scene: [line([2, 51], [18, 51], 3), line([10, 51], [10, FLOOR_Y])],
    gear: [disc(at('hip', 0, -4), 4.5)],
  },
  // On the back on the floor, knees bent, hips lifted.
  'Glute Bridge': {
    pose: pose({ hip: [30, 46.5], torso: -70, arm1: [70, 70], leg1: [92, -10], leg2: [90, -12] }),
  },
  // Face down on the machine, curling the roller up toward the glutes.
  'Hamstring Curl': {
    pose: pose({ hip: [26, 46], torso: 90, arm1: [90, 0], leg1: [-90, 160], leg2: [-90, 155] }),
    scene: [line([10, 50], [46, 50], 3), line([16, 50], [16, FLOOR_Y]), line([40, 50], [40, FLOOR_Y])],
    gear: [disc(at('foot1'), 2.5)],
  },
  // Seated on the machine, straightening the knees against the roller.
  'Leg Extension': {
    pose: pose({ hip: [24, 46], torso: 175, arm1: [10, 10], leg1: [90, 80], leg2: [88, 82] }),
    scene: [line([14, 49], [38, 49], 3), line([19, 49], [17, 30], 3), line([28, 49], [28, FLOOR_Y])],
    gear: [disc(at('foot1', 0, -2), 2.5)],
  },
  // Up on the toes, heels lifted, dumbbells at the sides.
  'Standing Calf Raise': {
    pose: pose({ hip: [32, 32], torso: 180, arm1: [2, 0], arm2: [-2, 0], leg1: [2, 0], leg2: [-2, 0] }),
    gear: [...dumbbells, line(at('foot1'), at('foot1', 3, 3), 2), line(at('foot2'), at('foot2', 3, 3), 2)],
  },
  // Seated, a pad across the knees, pushing up onto the toes.
  'Seated Calf Raise': {
    pose: pose({ hip: [22, 44], torso: 180, arm1: [40, 70], leg1: [90, 0], leg2: [88, 0] }),
    scene: [line([12, 47], [28, 47], 3), line([20, 47], [20, FLOOR_Y])],
    gear: [line(at('knee1', -4, -2.5), at('knee1', 4, -2.5), 3), line(at('foot1'), at('foot1', 3, 3), 2)],
  },
  // Back against a wall, feet out in front, heels down and toes pulled up.
  'Tibialis Raise': {
    pose: pose({ hip: [14, 34], torso: 180, arm1: [0, 0], leg1: [20, 20], leg2: [18, 18] }),
    scene: [line([8, 0], [8, FLOOR_Y], 2)],
    gear: [line(at('foot1', 0, 2.5), at('foot1', 5, -1.5), 2), line(at('foot2', 0, 2.5), at('foot2', 5, -1.5), 2)],
  },
  // Leaning back into the sled's pad, feet forward on the platform, sinking into the squat.
  'Hack Squat': {
    pose: pose({ hip: [26, 43], torso: 200, arm1: [60, 170], leg1: [70, -5], leg2: [66, -8] }),
    scene: [line([26, FLOOR_Y], [9.6, 14], 1), line([23.6, 41], [18.2, 26], 3)],
  },
  // Chest down on an incline bench, arms hanging straight, squeezing the shoulder blades together.
  'Kelso Shrug': {
    pose: pose({ hip: [24, 42], torso: 135, arm1: [0, 0], leg1: [-30, -60], leg2: [-26, -56] }),
    scene: [line([26.5, 44.5], [38, 33], 3), line([32, 39], [32, FLOOR_Y]), line([24, FLOOR_Y], [40, FLOOR_Y], 2)],
    gear: [disc(at('hand1'), 3)],
  },
  // Lowered between parallel bars, elbows bent back, knees bent so the feet stay up.
  Dip: {
    pose: pose({ hip: [30, 40], torso: 175, arm1: [-40, 0], leg1: [5, -80], leg2: [8, -75] }),
    scene: [line([16, 40], [38, 40], 2), line([36, 40], [36, FLOOR_Y])],
  },
  // Seated against the back pad, pressing the handles straight out in front.
  'Chest Press': {
    pose: pose({ hip: [24, 46], torso: 180, arm1: [90, 90], leg1: [90, 0], leg2: [88, 2] }),
    scene: [line([14, 49], [30, 49], 3), line([20.5, 48], [20.5, 27], 3), line([24, 49], [24, FLOOR_Y])],
    gear: [line(at('hand1', 0, -2.5), at('hand1', 0, 2.5), 2)],
  },
  // Seated on an upright bench, pressing the weight overhead.
  'Seated Shoulder Press': {
    pose: pose({ hip: [26, 46], torso: 180, arm1: [150, 175], leg1: [90, 0], leg2: [88, 2] }),
    scene: [line([16, 49], [32, 49], 3), line([22.5, 49], [21.5, 26], 3), line([26, 49], [26, FLOOR_Y])],
    gear: [disc(at('hand1'), 3)],
  },
  // Lying back on an incline bench, upper arms hanging straight down, curling up.
  'Incline Curl': {
    pose: pose({ hip: [22, 46], torso: 125, arm1: [0, 120], leg1: [-80, 0], leg2: [-75, 5] }),
    scene: [line([21, 50], [40, 36.7], 3), line([10, 50], [21, 50], 3), line([16, 50], [16, FLOOR_Y]), line([32, 42.3], [32, FLOOR_Y])],
    gear: [disc(at('hand1'), 3)],
  },
  // Standing, curling with the palms facing in, the weight held upright.
  'Hammer Curl': {
    pose: pose({ ...STAND, arm1: [0, 120], arm2: [0, 0] }),
    gear: [line(at('hand1', 0, -3), at('hand1', 0, 3), 3), disc(at('hand2'), 3)],
  },

  // Core
  // Sitting leaned back, feet off the floor, turning a plate to one side.
  'Russian Twist': {
    pose: pose({ hip: [28, 56], torso: 210, arm1: [100, 100], leg1: [120, 80], leg2: [118, 78] }),
    gear: [disc(at('hand1'), 3.5)],
  },
  // On the back, knees bent, curling the shoulders up off the floor, reaching for the knees.
  Crunch: {
    pose: pose({ hip: [28, 56], torso: -110, arm1: [100, 100], leg1: [140, 20], leg2: [138, 18] }),
  },
  // Kneeling under a high pulley, rope held at the forehead, crunching down.
  'Cable Crunch': {
    pose: pose({ hip: [24, 46], torso: 100, arm1: [160, 120], leg1: [0, -90], leg2: [2, -88] }),
    scene: [line([58, 0], [58, FLOOR_Y], 2), line([58, 6], at('hand1'), 1)],
    gear: [disc(at('hand1'), 1.8)],
  },
  // Legs straight along the floor, sitting up with the arms reaching forward.
  'Straight-Leg Sit-up': {
    pose: pose({ hip: [22, 56], torso: 220, arm1: [100, 100], leg1: [90, 90], leg2: [90, 90] }),
  },
  // Kneeling, rolling the wheel out in front until the body is long.
  'Ab Wheel Rollout': {
    pose: pose({ hip: [24, 49.5], torso: 100, arm1: [60, 60], leg1: [-45, -90], leg2: [-43, -90] }),
    gear: [disc(at('hand1'), 3.5, true)],
  },
  // On hands and knees, reaching one arm forward and the opposite leg back.
  'Bird Dog': {
    pose: pose({ hip: [28, 47], torso: 112, arm1: [105, 105], arm2: [0, 0], leg1: [-80, -80], leg2: [0, -90] }),
  },
  // On the back, one arm up and one leg bent at 90 degrees, the other arm and leg reaching out long.
  'Dead Bug': {
    pose: pose({ hip: [25, 55], torso: 90, arm1: [110, 110], arm2: [180, 180], leg1: [-78, -78], leg2: [180, -90] }),
  },
  // Seen from the front: holding a cable handle at the chest against the pull from the side.
  'Pallof Press': {
    pose: pose({ hip: [32, 34], torso: 180, arm1: [40, -60], arm2: [-40, 60], leg1: [10, 3], leg2: [-10, -3] }),
    scene: [line([58, 0], [58, FLOOR_Y], 2), line([58, 29], at('hand1'), 1)],
    gear: [disc(at('hand1'), 1.8)],
  },
  // Forearm plank, body straight, a plate across the back.
  'Weighted Plank': {
    pose: pose({ hip: [30.4, 53.6], torso: 103, arm1: [0, 90], leg1: [-77, -77], leg2: [-77, -77] }),
    gear: [line(at('hip', 2, -4.2), at('hip', 13, -6.7), 3)],
  },
  // Seen from the front: walking tall with a heavy weight hanging in each hand.
  'Farmer Carry': {
    pose: pose({ hip: [32, 34], torso: 180, arm1: [22, 8], arm2: [-22, -8], leg1: [12, 3], leg2: [-6, -2] }),
    gear: [disc(at('hand1', 0, 4), 3.5), disc(at('hand2', 0, 4), 3.5)],
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
  // Road bike sized to the rider: wheels on the floor, saddle a leg's length above the cranks,
  // near knee coming up over the top of the stroke, far leg pushing down, hands on the bars.
  Biking: {
    pose: pose({ hip: [21, 31], torso: 110, arm1: [58, 62], leg1: [63.5, -9.3], leg2: [24.6, -8.6] }),
    scene: [
      disc([15, 48.5], 10.5, true), disc([50, 48.5], 10.5, true),
      line([27, 51], [15, 48.5]), line([15, 48.5], [22.5, 35]), // chainstay, seatstay
      line([21.5, 32], [27, 51]), line([22.5, 35], [47.5, 35.5]), line([27, 51], [47, 38]), // seat, top, down tubes
      line([48, 33], [50, 48.5]), line([48, 33], [52, 33.5], 2), line([18, 32], [24.5, 32], 2.5), // fork, bars, saddle
      disc([27, 51], 3, true), line([24.2, 53.8], [29.8, 48.2], 1.5), // chainring, cranks
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
  // Climbing the steps, near knee high, a hand on the rail.
  'Stair Stepper': {
    pose: pose({ hip: [28, 36], torso: 170, arm1: [30, 80], arm2: [20, 70], leg1: [85, 5], leg2: [-15, -15] }),
    scene: [
      line([36, 49], [48, 49], 2), line([48, 49], [48, 39], 2), line([48, 39], [60, 39], 2), line([36, 49], [36, FLOOR_Y], 2),
      line([38, 32.5], [62, 21.5], 1.5),
    ],
  },
  // Upright on the pedals mid-stride, hands on the moving handles.
  Elliptical: {
    pose: pose({ hip: [28, 30], torso: 175, arm1: [40, 110], arm2: [10, 90], leg1: [20, -5], leg2: [-15, -5] }),
    scene: [line([52, FLOOR_Y], at('hand1'), 2), line([14, 56], [52, 56], 2)],
    gear: [line(at('foot1', -3, 1.5), at('foot1', 4, 1.5), 2), line(at('foot2', -3, 1.5), at('foot2', 4, 1.5), 2)],
  },
  // Seen from the front: in the air mid jumping jack, arms and legs out wide.
  HIIT: {
    pose: pose({ hip: [32, 34], torso: 180, arm1: [150, 160], arm2: [-150, -160], leg1: [25, 20], leg2: [-25, -20] }),
  },
  // Addressing the ball: hinged at the hips, arms hanging, club down to the ball.
  Golf: {
    pose: pose({ hip: [26, 35], torso: 130, arm1: [5, 5], leg1: [10, 0], leg2: [6, -2] }),
    scene: [disc([50, 57.5], 1.5)],
    gear: [line(at('hand1'), at('hand1', 8, 14), 1.2)],
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

  // Pilates
  // The hundred: on the back, head and shoulders curled up, legs long at 45 degrees, arms reaching.
  'Mat Pilates': {
    pose: pose({ hip: [32, 56], torso: -110, arm1: [95, 95], leg1: [135, 135], leg2: [133, 133] }),
  },
  // Footwork on the reformer: lying on the carriage, feet on the footbar, pressing out.
  'Reformer Pilates': {
    pose: pose({ hip: [26, 48], torso: -90, arm1: [90, 90], leg1: [115, 65], leg2: [113, 67] }),
    scene: [line([2, 54], [34, 54], 3), line([2, 57], [58, 57], 2), line([49, 45], [49, 57], 2)],
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

  // Mindfulness
  // Seen from the front: sitting cross-legged, back tall, hands resting on the knees.
  Meditation: {
    pose: pose({ hip: [32, 54], torso: 180, arm1: [25, 50], arm2: [-25, -50], leg1: [80, -95], leg2: [-80, 95] }),
  },
};

/** The stick figure for a built-in exercise. Custom exercises have none, even if the name matches. */
export function motionFor(exercise: { name: string; isCustom: boolean }): Motion | null {
  if (exercise.isCustom) return null;
  return MOTIONS[exercise.name] ?? null;
}
