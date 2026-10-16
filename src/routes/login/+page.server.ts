import { fail, redirect } from '@sveltejs/kit';
import { signIn } from '$lib/server/modules/identity';
import { applyAuthCookies, safeNext } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
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
	}
};
