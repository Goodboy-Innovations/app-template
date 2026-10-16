import { config } from '$lib/server/platform';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user && { name: locals.user.name, email: locals.user.email },
	/** While an admin acts as `user`: the admin's email, for the banner. */
	actingAdmin: locals.actingAdmin && locals.actingAdmin.email,
	/** Admin sign-in is on and this is an admin: link to "Act as a user". */
	adminTools: !!config.adminSso && !!locals.user?.isAdmin && !locals.actingAdmin
});
