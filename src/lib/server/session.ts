// The SvelteKit side of the identity and admin-sso modules: Better Auth's cookies, the access
// checks, and who is acting as whom.

import { error, redirect, type Cookies } from '@sveltejs/kit';
import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import { ADMIN_SSO_PROVIDER, type ActingAdmin } from '$lib/server/modules/admin-sso';
import {
	findUserById,
	providerSubject,
	signOut,
	type SessionInfo
} from '$lib/server/modules/identity';
import { config } from '$lib/server/platform';

/** Admins signed in through the provider sign in again after a working day. */
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

/** Copies the cookies Better Auth set on a response (sign-in, sign-out, refresh) to SvelteKit's. */
export function applyAuthCookies(cookies: Cookies, headers: Headers) {
	const setCookie = headers.get('set-cookie');
	if (!setCookie) return;
	for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
		cookies.set(name, attributes.value, {
			...toCookieOptions(attributes),
			path: attributes.path || '/'
		});
	}
}

/**
 * For admin sign-in (admin-sso): while an admin acts as the session's user, who the admin is.
 * Ends a provider admin's own session once it is older than a working day (Better Auth's
 * sessions last 30 days). Null when admin sign-in is off or nobody is acting.
 */
export async function resolveAdminSession(
	session: SessionInfo,
	headers: Headers,
	cookies: Cookies
): Promise<{ user: SessionInfo['user']; actingAdmin: ActingAdmin | null }> {
	const { user } = session;
	if (!user || !config.adminSso) return { user, actingAdmin: null };
	if (session.impersonatedBy) {
		const admin = await findUserById(session.impersonatedBy);
		const subject = admin && (await providerSubject(admin.id, ADMIN_SSO_PROVIDER));
		return { user, actingAdmin: admin && subject ? { subject, email: admin.email } : null };
	}
	const age = session.createdAt ? Date.now() - session.createdAt.getTime() : 0;
	if (user.isAdmin && age > ADMIN_SESSION_MS) {
		if (await providerSubject(user.id, ADMIN_SSO_PROVIDER)) {
			applyAuthCookies(cookies, await signOut(headers));
			return { user: null, actingAdmin: null };
		}
	}
	return { user, actingAdmin: null };
}

/** Only same-site paths: "/x", but not "//host" or "/\host" (browsers treat both as another origin). */
export const safeNext = (next: string | null | undefined) =>
	next && /^\/(?![/\\])/.test(next) ? next : '/';

/** The signed-in user, or a redirect to sign in (pages) or a 401 (form posts, endpoints). */
export function requireUser(locals: App.Locals, url: URL, method = 'GET') {
	if (locals.user) return locals.user;
	if (method !== 'GET') error(401, 'Sign in first');
	redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
}
