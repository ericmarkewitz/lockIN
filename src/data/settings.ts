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

/** Color themes, in the order the picker shows them. Cobalt is the app's original palette. */
export const THEME_IDS = ['cobalt', 'volt', 'ember', 'midnight', 'mono', 'tide', 'trophy', 'sakura', 'trail'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** Whether the app follows the system light/dark setting or forces one. */
export const APPEARANCES = ['system', 'light', 'dark'] as const;
export type Appearance = (typeof APPEARANCES)[number];

export type ThemeSettings = { themeId: ThemeId; appearance: Appearance };

export async function getThemeId(db: Db): Promise<ThemeId> {
  const value = await readSetting(db, 'theme');
  return THEME_IDS.find((id) => id === value) ?? 'cobalt';
}

export async function setThemeId(db: Db, id: ThemeId): Promise<void> {
  if (!THEME_IDS.includes(id)) throw new Error(`Unsupported theme: ${id}`);
  await writeSetting(db, 'theme', id);
}

export async function getAppearance(db: Db): Promise<Appearance> {
  const value = await readSetting(db, 'appearance');
  return APPEARANCES.find((a) => a === value) ?? 'system';
}

export async function setAppearance(db: Db, appearance: Appearance): Promise<void> {
  if (!APPEARANCES.includes(appearance)) throw new Error(`Unsupported appearance: ${appearance}`);
  await writeSetting(db, 'appearance', appearance);
}

export async function getThemeSettings(db: Db): Promise<ThemeSettings> {
  return { themeId: await getThemeId(db), appearance: await getAppearance(db) };
}
