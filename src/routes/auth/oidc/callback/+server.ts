import { error, redirect } from '@sveltejs/kit';
import { config } from '$lib/server/platform';
import {
	completeLogin,
	createAdminSession,
	logAdminAccess,
	type OidcIdentity,
	type PendingLogin
} from '$lib/server/modules/admin-sso';
import { OIDC_PENDING_COOKIE, oidcRedirectUri, setAdminCookie } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url, getClientAddress }) => {
	const settings = config.adminSso;
	if (!settings) error(404, 'Not found');

	const saved = cookies.get(OIDC_PENDING_COOKIE);
	cookies.delete(OIDC_PENDING_COOKIE, { path: '/auth/oidc' });
	if (!saved) error(400, 'The sign-in took too long or was started elsewhere. Try again.');
	if (url.searchParams.has('error')) redirect(303, '/login');

	let identity: OidcIdentity;
	try {
		identity = await completeLogin(
			settings,
			oidcRedirectUri(url),
			url.searchParams,
			JSON.parse(saved) as PendingLogin
		);
	} catch (err) {
		console.warn(`Admin access: sign-in failed: ${(err as Error).message}`);
		error(400, 'The sign-in could not be completed. Try again.');
	}

	if (!identity.isAdmin) {
		await logAdminAccess(identity, 'refused', getClientAddress());
		error(403, `${identity.email || 'This account'} has no admin role for this app.`);
	}
	const { token, expiresAt } = await createAdminSession(identity, getClientAddress());
	setAdminCookie(cookies, url, token, expiresAt);
	redirect(303, '/admin');
};
