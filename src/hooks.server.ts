import type { Handle, ServerInit } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { checkConfig, config, migrateDatabase, sql } from '$lib/server/platform';
import { SESSION_COOKIE, validateSession } from '$lib/server/modules/identity';
import { seedDatabase } from '$lib/server/seed';
import { requireUser, setSessionCookie } from '$lib/server/session';

// Before the first request: check the environment, bring the schema up to date, and with
// SEED_ON_START seed an empty database (with SEED_DEMO, the demo dataset too). A failure stops the server. In development
// `npm run db:migrate` and `npm run db:seed` do the same.
export const init: ServerInit = async () => {
	if (dev || building) return;
	console.log(`Config: ${checkConfig()}`);
	await migrateDatabase();
	console.log('Database: migrations applied');
	if (config.seedOnStart) await seedDatabase({ admin: config.seedAdmin, demo: config.seedDemo });
	// adapter-node emits this on SIGTERM / SIGINT once open requests are done. Closing the pool
	// lets the process exit instead of waiting to be killed.
	process.on('sveltekit:shutdown', () => sql.end());
};

/** Paths for signed-in users only. Checked here because form actions don't run a page's load. */
const SIGNED_IN = ['/notes', '/account'];

export const handle: Handle = async ({ event, resolve }) => {
	const { cookies, url } = event;
	const token = cookies.get(SESSION_COOKIE);
	event.locals.user = null;
	if (token) {
		const session = await validateSession(token);
		if (session) {
			event.locals.user = session.user;
			setSessionCookie(cookies, url, token, session.expiresAt);
		} else {
			cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	}

	if (SIGNED_IN.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
		requireUser(event.locals, url, event.request.method);
	}

	const response = await resolve(event);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-frame-options', 'DENY');
	if (event.locals.user) response.headers.set('cache-control', 'private, no-store');
	return response;
};
