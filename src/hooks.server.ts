import type { Handle, ServerInit } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { CLIENT_IP_HEADER, checkConfig, config, migrateDatabase, sql } from '$lib/server/platform';
import { auth, getSession } from '$lib/server/modules/identity';
import { clientAddress } from '$lib/server/client-address';
import { seedDatabase } from '$lib/server/seed';
import { applyAuthCookies, requireUser, resolveAdminSession } from '$lib/server/session';

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
	const { cookies, url, request } = event;
	if (building) return resolve(event);

	// Better Auth sees the client address as the app does (ADDRESS_HEADER / XFF_DEPTH), never
	// one the client sent: its rate limit, session records and the admin log use it. A request
	// without one (a health check bypassing the proxy) gets none, not a 500.
	const address = clientAddress(event);
	if (address) request.headers.set(CLIENT_IP_HEADER, address);
	else request.headers.delete(CLIENT_IP_HEADER);
	// Its HTTP API: OAuth callbacks and anything an app calls from the browser.
	if (url.pathname === '/api/auth' || url.pathname.startsWith('/api/auth/')) {
		return auth.handler(request);
	}

	const session = await getSession(request.headers);
	applyAuthCookies(cookies, session.setCookies);
	// With admin sign-in (admin-sso): while an admin acts as a demo user, that user is the
	// signed-in user and the admin is in actingAdmin.
	const { user, actingAdmin } = await resolveAdminSession(session, request.headers, cookies);
	event.locals.user = user;
	event.locals.actingAdmin = actingAdmin;

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
