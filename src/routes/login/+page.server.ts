import { error, fail, redirect } from '@sveltejs/kit';
import { ADMIN_SSO_PROVIDER } from '$lib/server/modules/admin-sso';
import { signIn, startProviderSignIn } from '$lib/server/modules/identity';
import { config } from '$lib/server/platform';
import { applyAuthCookies, safeNext } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return {
		adminSso: config.adminSso && { providerName: config.adminSso.providerName },
		// Better Auth sends a failed or refused provider sign-in back here with ?error=…
		adminSsoFailed: url.searchParams.has('error')
	};
};

export const actions: Actions = {
	password: async ({ request, cookies, url, getClientAddress }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim();
		const password = String(data.get('password') ?? '');

		const result =
			email && password
				? await signIn({
						email,
						password,
						clientAddress: getClientAddress(),
						userAgent: request.headers.get('user-agent')
					})
				: null;
		if (!result?.ok) {
			const error = result?.throttled
				? 'Too many attempts. Wait a few seconds and try again.'
				: 'Wrong email or password';
			return fail(result?.throttled ? 429 : 400, { email, error });
		}

		applyAuthCookies(cookies, result.setCookies);
		redirect(303, safeNext(url.searchParams.get('next')));
	},
	/** "Sign in as admin with …": off (404) unless OIDC_* is set. */
	admin: async ({ request, cookies }) => {
		if (!config.adminSso) error(404, 'Not found');
		const { url, setCookies } = await startProviderSignIn({
			provider: ADMIN_SSO_PROVIDER,
			headers: request.headers,
			callbackURL: '/admin',
			errorCallbackURL: '/login'
		});
		applyAuthCookies(cookies, setCookies);
		redirect(303, url);
	}
};
