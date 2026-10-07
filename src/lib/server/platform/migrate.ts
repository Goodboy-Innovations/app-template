import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './db';

/**
 * Applies pending SQL migrations from `drizzle/` (relative to the working directory). The
 * production image has no drizzle-kit, so the server runs this when it starts.
 */
export async function migrateDatabase(migrationsFolder = 'drizzle') {
	await migrate(db, { migrationsFolder });
}
