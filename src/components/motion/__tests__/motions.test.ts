import { CATALOG } from '@/data/catalog';
import type { Exercise } from '@/data/types';
import { CANVAS, FLOOR_Y, MOTIONS, motionFor, type Anchor, type Prop } from '../motions';
import { skeleton } from '../skeleton';

const exercise = (name: string, isCustom = false): Exercise => ({
  id: 1, categoryId: 1, name, isCustom, categoryName: 'Lifts', categoryKind: 'strength', subcategory: null,
});

describe('motions', () => {
  const builtIns = CATALOG.flatMap((c) => c.exercises.map((e) => e.name));

  it.each(builtIns)('has a stick figure for the built-in %s', (name) => {
    expect(motionFor(exercise(name))).not.toBeNull();
  });

  it.each(Object.keys(MOTIONS))('draws %s for an exercise in the catalog', (name) => {
    expect(builtIns).toContain(name);
  });

  it('has none for custom exercises, even when the name matches a built-in', () => {
    expect(motionFor(exercise('Squat', true))).toBeNull();
    expect(motionFor(exercise('Farmer Carry', true))).toBeNull();
  });

  it.each(Object.keys(MOTIONS))('keeps %s on the canvas', (name) => {
    for (const [x, y] of Object.values(skeleton(MOTIONS[name].pose))) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(CANVAS);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(CANVAS);
    }
  });
});

describe('Stretching', () => {
  it('is a standing quad stretch: upright on one leg, the other foot held up behind the hip', () => {
    const s = skeleton(MOTIONS.Stretching.pose);
    const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    expect(s.head[1]).toBeLessThan(s.neck[1]); // upright
    expect(s.foot2[1]).toBeCloseTo(FLOOR_Y, 0); // standing leg on the floor
    expect(s.foot1[1]).toBeLessThan(s.knee1[1]); // stretched leg folded up
    expect(s.foot1[0]).toBeLessThan(s.hip[0]); // ...behind the body
    expect(dist(s.hand1, s.foot1)).toBeLessThan(4); // held by the hand
  });
});

describe('Downhill Skiing', () => {
  it('heads down a slope: the ground and the skis drop away in the direction the skier faces', () => {
    const m = MOTIONS['Downhill Skiing'];
    const j = skeleton(m.pose);
    const resolve = (a: Anchor): number[] => (Array.isArray(a) ? a : [j[a.joint][0] + (a.dx ?? 0), j[a.joint][1] + (a.dy ?? 0)]);
    const drop = (p: Prop) => {
      if (p.kind !== 'line') throw new Error('expected a line');
      const [a, b] = [resolve(p.from), resolve(p.to)].sort((u, v) => u[0] - v[0]);
      return (b[1] - a[1]) / (b[0] - a[0]);
    };
    expect(drop(m.scene![0])).toBeGreaterThan(0.2); // slope falls to the right (screen y grows downward)
    expect(drop(m.gear![0])).toBeCloseTo(drop(m.scene![0]), 1); // skis run along it
  });
});

describe('Incline Bench Press', () => {
  it('has a backrest that runs under the whole torso, up behind the head', () => {
    const m = MOTIONS['Incline Bench Press'];
    const j = skeleton(m.pose);
    const back = m.scene![0];
    if (back.kind !== 'line' || !Array.isArray(back.from) || !Array.isArray(back.to)) throw new Error('expected a fixed line');
    const [low, high] = [back.from, back.to].sort((u, v) => u[0] - v[0]);
    // Measured along the torso: the backrest starts at or before the hip and ends past the shoulders.
    const along = (p: number[]) => {
      const d = [j.neck[0] - j.hip[0], j.neck[1] - j.hip[1]];
      return ((p[0] - j.hip[0]) * d[0] + (p[1] - j.hip[1]) * d[1]) / Math.hypot(d[0], d[1]);
    };
    expect(along(low)).toBeLessThanOrEqual(0);
    expect(along(high)).toBeGreaterThan(along(j.neck) + 2);
  });

  it('joins the seat and backrest at one corner, so the bench reads as one piece', () => {
    const [back, seat] = MOTIONS['Incline Bench Press'].scene!;
    if (back.kind !== 'line' || seat.kind !== 'line') throw new Error('expected lines');
    expect(back.from).toEqual(seat.to); // the backrest rises from the seat's end, no overlap
  });
});

describe('Overhead Press', () => {
  it('is seen from the front: both arms press the bar overhead, mirrored about the body', () => {
    const j = skeleton(MOTIONS['Overhead Press'].pose);
    expect(j.hand1[0] - j.neck[0]).toBeGreaterThan(5);
    expect(j.hand1[0] - j.neck[0]).toBeCloseTo(j.neck[0] - j.hand2[0], 5);
    expect(j.hand1[1]).toBeCloseTo(j.hand2[1], 5);
    expect(j.hand1[1]).toBeLessThan(j.head[1]);
  });
});

describe('Biking', () => {
  const m = MOTIONS.Biking;
  const j = skeleton(m.pose);
  const discs = m.scene!.filter((p): p is Extract<Prop, { kind: 'disc' }> => p.kind === 'disc' && Array.isArray(p.at));
  const wheels = discs.filter((d) => d.r >= 8);
  const ring = discs.find((d) => d.r < 8)!;

  it('has two wheels resting on the floor', () => {
    expect(wheels).toHaveLength(2);
    for (const w of wheels) expect((w.at as number[])[1] + w.r).toBeCloseTo(FLOOR_Y, 0);
  });

  it('has both feet on opposite pedals, cranking around the chainring', () => {
    const [cx, cy] = ring.at as number[];
    const crank = (f: number[]) => Math.hypot(f[0] - cx, f[1] - cy);
    expect(crank(j.foot1)).toBeGreaterThan(3);
    expect(crank(j.foot1)).toBeCloseTo(crank(j.foot2), 0);
    expect((j.foot1[0] + j.foot2[0]) / 2).toBeCloseTo(cx, 0);
    expect((j.foot1[1] + j.foot2[1]) / 2).toBeCloseTo(cy, 0);
  });

  it('keeps the head behind the front wheel axle, not slumped over the bars', () => {
    const front = Math.max(...wheels.map((w) => (w.at as number[])[0]));
    expect(j.head[0]).toBeLessThan(front);
    expect(j.head[1]).toBeLessThan(j.hand1[1]);
  });
});

describe('squat bars', () => {
  // Seen from the side, the bar's near end is closer than the body, so it is drawn in front (gear).
  const bar = (name: string) => {
    const m = MOTIONS[name];
    const j = skeleton(m.pose);
    expect(m.scene ?? []).toHaveLength(0);
    const plate = m.gear?.find((p) => p.kind === 'disc');
    if (!plate || Array.isArray(plate.at)) throw new Error('expected a plate on a joint');
    const at = [j[plate.at.joint][0] + (plate.at.dx ?? 0), j[plate.at.joint][1] + (plate.at.dy ?? 0)];
    return { j, at, r: plate.r };
  };

  it('racks the back squat bar on the upper back, behind the face', () => {
    const { j, at, r } = bar('Squat');
    expect(at[0]).toBeLessThan(j.neck[0]); // behind the neck
    expect(at[0] + r).toBeLessThan(j.head[0]); // leaves the front half of the head (the face) clear
    expect(Math.abs(at[1] - j.neck[1])).toBeLessThan(4); // at shoulder height
  });

  it('racks the front squat bar across the front of the shoulders, below the chin', () => {
    const { j, at, r } = bar('Front Squat');
    expect(at[0]).toBeGreaterThan(j.neck[0]);
    expect(at[1] - r).toBeGreaterThan(j.head[1] + 2); // under the chin, not over the face
    expect(Math.abs(at[1] - j.neck[1])).toBeLessThan(4);
  });
});

describe('skeleton', () => {
  it('stacks a standing figure with the head above the hip and the feet below', () => {
    const s = skeleton({ hip: [32, 34], torso: 180, arm1: [0, 0], arm2: [0, 0], leg1: [0, 0], leg2: [0, 0] });
    expect(s.head[1]).toBeLessThan(s.neck[1]);
    expect(s.neck[1]).toBeLessThan(s.hip[1]);
    expect(s.knee1[1]).toBeGreaterThan(s.hip[1]);
    expect(s.foot1[1]).toBeGreaterThan(s.knee1[1]);
    expect(s.foot1[0]).toBeCloseTo(32);
  });
});
