import { error, fail, redirect } from '@sveltejs/kit';
import { ADMIN_SSO_PROVIDER, canActAs } from '$lib/server/modules/admin-sso';
import {
	impersonate,
	listUsers,
	providerSubject,
	stopImpersonating
} from '$lib/server/modules/identity';
import { config } from '$lib/server/platform';
import { applyAuthCookies, requireUser } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

// An admin signed in through the identity provider picks a demo user to act as. Better Auth's
// hooks (admin-sso) check the same rules again for every request to its API.

export const load: PageServerLoad = async ({ locals, url }) => {
	const settings = config.adminSso;
	if (!settings) error(404, 'Not found');
	const user = requireUser(locals, url);
	if (locals.actingAdmin) redirect(303, '/');
	if (!user.isAdmin || !(await providerSubject(user.id, ADMIN_SSO_PROVIDER))) {
		error(403, 'Only admins signed in with the identity provider can act as users');
	}
	// Admins can't be acted as (Better Auth's rule), so only demo users who aren't.
	const users = (await listUsers()).filter(
		(u) => !u.isAdmin && canActAs(u.email, settings.actAsDomain)
	);
	return { users: users.map(({ id, name, email }) => ({ id, name, email })) };
};

export const actions: Actions = {
	act: async ({ request, cookies, locals, url }) => {
		requireUser(locals, url, request.method);
		const userId = String((await request.formData()).get('user') ?? '');
		const result = await impersonate(request.headers, userId);
		if (!result.ok) return fail(403, { error: result.error });
		applyAuthCookies(cookies, result.setCookies);
		redirect(303, '/');
	},
	exit: async ({ request, cookies, locals, url }) => {
		requireUser(locals, url, request.method);
		if (locals.actingAdmin) applyAuthCookies(cookies, await stopImpersonating(request.headers));
		redirect(303, '/admin');
	}
};
