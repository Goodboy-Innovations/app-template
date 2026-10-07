import { fail, redirect } from '@sveltejs/kit';
import { authenticate } from '$lib/server/modules/identity';
import { safeNext, startSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim();
		const password = String(data.get('password') ?? '');

		const result = email && password ? await authenticate(email, password) : null;
		if (!result?.ok) {
			const error = result?.throttled
				? 'Too many attempts. Wait a few minutes and try again.'
				: 'Wrong email or password';
			return fail(result?.throttled ? 429 : 400, { email, error });
		}

		await startSession(cookies, url, result.user.id);
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
