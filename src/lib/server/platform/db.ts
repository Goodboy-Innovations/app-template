import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from './config';

// Reuse one connection pool across Vite hot reloads in development.
const globalForDb = globalThis as unknown as { __appSql?: postgres.Sql };

export const sql = (globalForDb.__appSql ??= postgres(config.databaseUrl, {
	max: 10,
	// Notices like "relation already exists, skipping" (from migrations on every start) are noise.
	onnotice: () => {}
}));

/** Query builder. Modules pass their own table objects, so no global schema is registered here. */
export const db = drizzle(sql);

export type Db = typeof db;
