import { error, redirect } from '@sveltejs/kit';
import { config } from '$lib/server/platform';
import { beginLogin } from '$lib/server/modules/admin-sso';
import { OIDC_PENDING_COOKIE, oidcRedirectUri } from '$lib/server/session';
import type { RequestHandler } from './$types';

/** "Sign in as admin with Cloudgood ID": off (404) unless OIDC_* is set. */
export const GET: RequestHandler = async ({ cookies, url }) => {
	const settings = config.adminSso;
	if (!settings) error(404, 'Not found');
	const { url: target, pending } = await beginLogin(settings, oidcRedirectUri(url));
	cookies.set(OIDC_PENDING_COOKIE, JSON.stringify(pending), {
		path: '/auth/oidc',
		httpOnly: true,
		// lax: the provider sends the browser back with a top-level GET, which carries it.
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 10 * 60
	});
	redirect(303, target);
};
