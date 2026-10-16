import { fail, redirect } from '@sveltejs/kit';
import { ADMIN_COOKIE, actAs, exitActing, listActableUsers } from '$lib/server/modules/admin-sso';
import { requireAdmin } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

// An admin signed in with Cloudgood ID picks a demo user to act as. Acting ends with Exit (in the
// banner on every page), at sign-out, or when the admin session expires.

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const users = await listActableUsers();
	return {
		users: users.map(({ id, name, email, role }) => ({ id, name, email, role })),
		actingAs: locals.admin?.actingAs?.id ?? null
	};
};

export const actions: Actions = {
	act: async ({ request, locals, cookies }) => {
		const admin = requireAdmin(locals, request.method);
		const userId = String((await request.formData()).get('user') ?? '');
		if (!(await actAs(cookies.get(ADMIN_COOKIE)!, admin, userId))) {
			return fail(400, { error: 'That user cannot be acted as' });
		}
		redirect(303, '/');
	},
	exit: async ({ request, locals, cookies }) => {
		const admin = requireAdmin(locals, request.method);
		await exitActing(cookies.get(ADMIN_COOKIE)!, admin);
		redirect(303, '/admin');
	}
};
