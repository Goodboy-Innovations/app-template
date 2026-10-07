// Seeds an empty local database: the admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (.env) and
// the starting content. A database with data is left alone.
//
//   npm run db:seed

import { config, sql } from '../src/lib/server/platform';
import { seedDatabase } from '../src/lib/server/seed';

seedDatabase({ admin: config.seedAdmin })
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(() => sql.end());
