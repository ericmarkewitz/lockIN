import { DatabaseSync } from 'node:sqlite';

import { migrate } from '@/db/migrations';
import type { Db } from '@/db/types';

/** Wraps node:sqlite in the async Db interface that expo-sqlite also satisfies. */
export function wrap(raw: DatabaseSync): Db {
  return {
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params = []) {
      const r = raw.prepare(sql).run(...(params as any[]));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...(params as any[])) as T[];
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []) {
      return (raw.prepare(sql).get(...(params as any[])) as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

/** Fresh in-memory, fully migrated database. */
export async function createTestDb(): Promise<Db> {
  const db = wrap(new DatabaseSync(':memory:'));
  await migrate(db);
  return db;
}
