import { fail } from '@sveltejs/kit';
import { MIN_PASSWORD_LENGTH, setPassword, verifyUserPassword } from '$lib/server/modules/identity';
import { requireUser, startSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals, url);
	return { email: user.email, minPassword: MIN_PASSWORD_LENGTH };
};

export const actions: Actions = {
	password: async ({ request, locals, cookies, url }) => {
		const user = requireUser(locals, url, request.method);
		const data = await request.formData();
		const current = String(data.get('current') ?? '');
		const next = String(data.get('next') ?? '');
		if (!(await verifyUserPassword(user.id, current))) {
			return fail(400, { error: 'The current password is wrong' });
		}
		if (next.length < MIN_PASSWORD_LENGTH) {
			return fail(400, { error: `Use at least ${MIN_PASSWORD_LENGTH} characters` });
		}
		if (next !== String(data.get('confirm') ?? '')) {
			return fail(400, { error: 'The new passwords differ' });
		}
		// Changing the password ends every session, this one included; start a fresh one.
		await setPassword(user.id, next);
		await startSession(cookies, url, user.id);
		return { message: 'Password changed. Other devices are signed out.' };
	}
};
