// The session cookie and access checks: the SvelteKit side of the identity module.

import { error, redirect, type Cookies } from '@sveltejs/kit';
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
