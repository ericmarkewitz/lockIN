import type { Db } from '@/db/types';

export async function findByName(db: Db, name: string): Promise<number> {
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name = ?', [name]);
  if (!row) throw new Error(`No seeded exercise ${name}`);
  return row.id;
}
