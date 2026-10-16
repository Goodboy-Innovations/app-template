import { redirect } from '@sveltejs/kit';
import { ADMIN_COOKIE, endAdminSession } from '$lib/server/modules/admin-sso';
import { SESSION_COOKIE, invalidateSession } from '$lib/server/modules/identity';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) await invalidateSession(token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	// Signing out also ends an admin session (and with it any acting as a user).
	const adminToken = cookies.get(ADMIN_COOKIE);
	if (adminToken) await endAdminSession(adminToken);
	cookies.delete(ADMIN_COOKIE, { path: '/' });
	redirect(303, '/');
};
