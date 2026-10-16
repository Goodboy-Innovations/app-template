import { fail } from '@sveltejs/kit';
import { MIN_PASSWORD_LENGTH, changePassword } from '$lib/server/modules/identity';
import { applyAuthCookies, requireUser } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals, url);
	return { email: user.email, minPassword: MIN_PASSWORD_LENGTH };
};

export const actions: Actions = {
	password: async ({ request, locals, cookies, url }) => {
		requireUser(locals, url, request.method);
		const data = await request.formData();
		const current = String(data.get('current') ?? '');
		const next = String(data.get('next') ?? '');
		if (next.length < MIN_PASSWORD_LENGTH) {
			return fail(400, { error: `Use at least ${MIN_PASSWORD_LENGTH} characters` });
		}
		if (next !== String(data.get('confirm') ?? '')) {
			return fail(400, { error: 'The new passwords differ' });
		}
		// Signs every other device out; this one gets a fresh session.
		const result = await changePassword(request.headers, current, next);
		if (!result.ok) return fail(400, { error: result.error });
		applyAuthCookies(cookies, result.setCookies);
		return { message: 'Password changed. Other devices are signed out.' };
	}
};
