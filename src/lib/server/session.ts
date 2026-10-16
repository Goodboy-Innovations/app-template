// The session cookies and access checks: the SvelteKit side of the identity and admin-sso modules.

import { error, redirect, type Cookies } from '@sveltejs/kit';
import { ADMIN_COOKIE } from '$lib/server/modules/admin-sso';
import { SESSION_COOKIE, createSession } from '$lib/server/modules/identity';

export function setSessionCookie(cookies: Cookies, url: URL, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		expires: expiresAt
	});
}

export async function startSession(cookies: Cookies, url: URL, userId: string) {
	const { token, expiresAt } = await createSession(userId);
	setSessionCookie(cookies, url, token, expiresAt);
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

// Admin sign-in through OIDC (the admin-sso module), when it is on.

export const OIDC_PENDING_COOKIE = 'oidc_pending';

/** The callback address registered with the provider: <ORIGIN>/auth/oidc/callback. */
export const oidcRedirectUri = (url: URL) => `${url.origin}/auth/oidc/callback`;

export function setAdminCookie(cookies: Cookies, url: URL, token: string, expiresAt: Date) {
	cookies.set(ADMIN_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		expires: expiresAt
	});
}

/** The OIDC-signed-in admin, or a redirect to sign in (pages) or a 403 (form posts). */
export function requireAdmin(locals: App.Locals, method = 'GET') {
	if (locals.admin) return locals.admin;
	if (method !== 'GET') error(403, 'Sign in as admin first');
	redirect(303, '/login');
}
