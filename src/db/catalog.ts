import { CATALOG, type CatalogCategory } from '@/data/catalog';
import type { Db } from './types';

/**
 * Adds the categories and exercises in the catalog that the database doesn't have yet. It only
 * ever adds: existing rows, and anything people logged against them, are left as they are. A
 * name the user already has in that category (built-in or custom, any case) is skipped.
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
      }
    }
  });
}
