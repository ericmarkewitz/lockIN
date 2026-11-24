import { CATALOG, type CatalogCategory } from '@/data/catalog';
import { serializeFields } from '@/data/fields';
import type { Db } from './types';

/**
 * Adds the categories and exercises in the catalog that the database doesn't have yet. It only
 * ever adds: existing rows, and anything people logged against them, are left as they are. A
 * name the user already has in that category (built-in or custom, any case) is skipped, and a
 * built-in's extra muscle groups (`also`) are never given to a custom exercise.
 *
 * A built-in's `builtin_fields` always follow the catalog (null for its category's default). The
 * default the user picked (`fields`) is theirs and left alone. Logged values stay put either way.
 */
export async function syncCatalog(db: Db, catalog: CatalogCategory[] = CATALOG): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const cat of catalog) {
      await db.runAsync('INSERT OR IGNORE INTO categories (name, kind) VALUES (?, ?)', [cat.name, cat.kind]);
      const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE name = ?', [cat.name]);
      for (const ex of cat.exercises) {
        await db.runAsync(
          `INSERT INTO exercises (category_id, name, subcategory)
           SELECT ?, ?, ? WHERE NOT EXISTS
             (SELECT 1 FROM exercises WHERE category_id = ? AND name = ? COLLATE NOCASE)`,
          [row!.id, ex.name, ex.subcategory ?? null, row!.id, ex.name],
        );
        const fields = ex.fields ? serializeFields(ex.fields) : null;
        await db.runAsync(
          'UPDATE exercises SET builtin_fields = ? WHERE category_id = ? AND name = ? AND is_custom = 0 AND builtin_fields IS NOT ?',
          [fields, row!.id, ex.name, fields],
        );
        for (const sub of ex.also ?? []) {
          await db.runAsync(
            `INSERT OR IGNORE INTO exercise_subcategories (exercise_id, subcategory)
             SELECT id, ? FROM exercises WHERE category_id = ? AND name = ? AND is_custom = 0`,
            [sub, row!.id, ex.name],
          );
        }
      }
    }
  });
}
