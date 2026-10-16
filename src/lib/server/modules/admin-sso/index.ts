import type { AdminSsoSettings } from '$lib/server/platform';
import { logAdminAccess } from './log';
import { adminSsoPlugins as plugins } from './plugin';

export { type ActingAdmin, logAdminAccess } from './log';
export { ADMIN_SSO_PROVIDER } from './plugin';
export { canActAs } from './roles';

/** The Better Auth plugins for admin sign-in, writing to the admin access log. */
export const adminSsoPlugins = (settings: AdminSsoSettings | null) =>
	plugins(settings, logAdminAccess);
