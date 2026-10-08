// Seeds an empty local database: the admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (.env), the
// starting content and, with SEED_DEMO=1, the demo dataset. A database with data is left alone.
//
//   npm run db:seed

import { config, sql } from '../src/lib/server/platform';
import { seedDatabase } from '../src/lib/server/seed';

seedDatabase({ admin: config.seedAdmin, demo: config.seedDemo })
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(() => sql.end());
