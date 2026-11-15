import { CATALOG } from '../catalog';
import { FORM_TIPS, formTipsFor } from '../formTips';

describe('form tips', () => {
  const builtIns = CATALOG.flatMap((c) => c.exercises.map((e) => e.name));

  it('keeps every tip short and keyed by an exercise in the catalog', () => {
    for (const [name, tips] of Object.entries(FORM_TIPS)) {
      expect(builtIns).toContain(name);
      expect(tips.length).toBeGreaterThanOrEqual(1);
      expect(tips.length).toBeLessThanOrEqual(5);
      for (const tip of tips) expect(tip.length).toBeLessThanOrEqual(90);
    }
  });

  it('has none for custom exercises, even when the name matches a built-in', () => {
    FORM_TIPS.Squat = ['Brace before you descend.'];
    try {
      expect(formTipsFor({ name: 'Squat', isCustom: true })).toBeNull();
      expect(formTipsFor({ name: 'Squat', isCustom: false })).toEqual(['Brace before you descend.']);
    } finally {
      delete FORM_TIPS.Squat;
    }
  });
});
