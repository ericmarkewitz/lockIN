import type { Db } from '@/db/types';

export type WeightUnit = 'lb' | 'kg';
export const WEIGHT_UNITS: readonly WeightUnit[] = ['lb', 'kg'];

export async function getWeightUnit(db: Db): Promise<WeightUnit> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'weight_unit'");
  return WEIGHT_UNITS.find((u) => u === row?.value) ?? 'lb';
}

/** Weights are always stored in pounds; this only changes how they are shown and entered. */
export async function setWeightUnit(db: Db, unit: WeightUnit): Promise<void> {
  if (!WEIGHT_UNITS.includes(unit)) throw new Error(`Unsupported weight unit: ${unit}`);
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES ('weight_unit', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [unit],
  );
}
