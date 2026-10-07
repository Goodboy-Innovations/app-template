export { checkConfig, config } from './config';
export { db, sql, type Db } from './db';
export { migrateDatabase } from './migrate';
export { objectStore, type ObjectStore } from './storage';

export const DAY_MS = 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards database lookups by id against malformed input (which Postgres rejects with an error). */
export const isUuid = (value: unknown): value is string =>
	typeof value === 'string' && UUID.test(value);
