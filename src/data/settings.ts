import type { Db } from '@/db/types';

export type WeightUnit = 'lb' | 'kg';
export const WEIGHT_UNITS: readonly WeightUnit[] = ['lb', 'kg'];

export type DistanceUnit = 'mi' | 'km';
export const DISTANCE_UNITS: readonly DistanceUnit[] = ['mi', 'km'];

export type Units = { weight: WeightUnit; distance: DistanceUnit };

async function readSetting(db: Db, key: string): Promise<string | undefined> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value;
}

async function writeSetting(db: Db, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

export async function getWeightUnit(db: Db): Promise<WeightUnit> {
  const value = await readSetting(db, 'weight_unit');
  return WEIGHT_UNITS.find((u) => u === value) ?? 'lb';
}

/** Weights are always stored in pounds; this only changes how they are shown and entered. */
export async function setWeightUnit(db: Db, unit: WeightUnit): Promise<void> {
  if (!WEIGHT_UNITS.includes(unit)) throw new Error(`Unsupported weight unit: ${unit}`);
  await writeSetting(db, 'weight_unit', unit);
}

export async function getDistanceUnit(db: Db): Promise<DistanceUnit> {
  const value = await readSetting(db, 'distance_unit');
  return DISTANCE_UNITS.find((u) => u === value) ?? 'mi';
}

/** Distances are always stored in miles; this only changes how they are shown and entered. */
export async function setDistanceUnit(db: Db, unit: DistanceUnit): Promise<void> {
  if (!DISTANCE_UNITS.includes(unit)) throw new Error(`Unsupported distance unit: ${unit}`);
  await writeSetting(db, 'distance_unit', unit);
}

export async function getUnits(db: Db): Promise<Units> {
  return { weight: await getWeightUnit(db), distance: await getDistanceUnit(db) };
}
