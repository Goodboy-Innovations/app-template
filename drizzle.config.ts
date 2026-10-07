import { defineConfig } from 'drizzle-kit';

try {
	process.loadEnvFile();
} catch {
	// no .env file
}

export default defineConfig({
	// Every module owns its tables in its own schema.ts.
	schema: './src/lib/server/modules/*/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
	verbose: true,
	strict: true
});
