import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user && { name: locals.user.name, email: locals.user.email },
	admin: locals.admin && {
		name: locals.admin.name,
		actingAs: locals.admin.actingAs && locals.admin.actingAs.name
	}
});
