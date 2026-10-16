// The SvelteKit side of the identity module: Better Auth's cookies and the access checks.

import { error, redirect, type Cookies } from '@sveltejs/kit';
import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';

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

/** Only same-site paths: "/x", but not "//host" or "/\host" (browsers treat both as another origin). */
export const safeNext = (next: string | null | undefined) =>
	next && /^\/(?![/\\])/.test(next) ? next : '/';

/** The signed-in user, or a redirect to sign in (pages) or a 401 (form posts, endpoints). */
export function requireUser(locals: App.Locals, url: URL, method = 'GET') {
	if (locals.user) return locals.user;
	if (method !== 'GET') error(401, 'Sign in first');
	redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
}
