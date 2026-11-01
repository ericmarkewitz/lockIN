/**
 * Name of the on-device SQLite file. An earlier prototype (reverted in a913d23) used 'lockin.db'
 * with an incompatible schema, so that name must never be reused: devices that ran it would hit
 * "table exercises already exists". Bump the suffix only for an intentional, incompatible reset.
 */
export const DATABASE_NAME = 'lockin-v1.db';
export const LEGACY_DATABASE_NAMES = ['lockin.db'];
