import { SEED } from '@/db/migrations';
import type { Exercise } from '@/data/types';
import { CANVAS, MOTIONS, motionFor } from '../motions';
import { skeleton } from '../skeleton';

const exercise = (name: string, isCustom = false): Exercise => ({
  id: 1, categoryId: 1, name, isCustom, categoryName: 'Lifts', categoryKind: 'strength', subcategory: null,
});

describe('motions', () => {
  it.each(SEED.flatMap((c) => c.exercises))('has a stick figure for the built-in %s', (name) => {
    expect(motionFor(exercise(name))).not.toBeNull();
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
