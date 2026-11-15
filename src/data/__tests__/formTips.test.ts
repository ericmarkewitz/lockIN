import { CATALOG } from '../catalog';
import { FORM_TIPS, formTipsFor } from '../formTips';

describe('form tips', () => {
  const builtIns = CATALOG.flatMap((c) => c.exercises.map((e) => e.name));

  it.each(builtIns)('has three to five short tips for the built-in %s', (name) => {
    const tips = formTipsFor({ name, isCustom: false })!;
    expect(tips.length).toBeGreaterThanOrEqual(3);
    expect(tips.length).toBeLessThanOrEqual(5);
    for (const tip of tips) expect(tip.length).toBeLessThanOrEqual(90);
  });

  it.each(Object.keys(FORM_TIPS))('has tips for %s, an exercise in the catalog', (name) => {
    expect(builtIns).toContain(name);
  });

  it('has none for custom exercises, even when the name matches a built-in', () => {
    expect(formTipsFor({ name: 'Squat', isCustom: true })).toBeNull();
  });
});
