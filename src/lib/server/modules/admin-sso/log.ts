import { db } from '$lib/server/platform';
import { adminAccessLog } from './schema';

/** Who did it, for logs and audits: the provider's `sub` and the admin's email. */
export interface ActingAdmin {
	subject: string;
	email: string;
}

type Action = (typeof adminAccessLog.$inferInsert)['action'];

export type AdminAccessLogger = (
	admin: ActingAdmin,
	action: Action,
	ip: string,
	target?: { id: string; email: string }
) => Promise<void>;

/** Writes the access log: a row, and a line in the server log. */
export const logAdminAccess: AdminAccessLogger = async (admin, action, ip, target) => {
	await db.insert(adminAccessLog).values({
		subject: admin.subject,
		email: admin.email,
		action,
		ip,
		targetUserId: target?.id,
		targetEmail: target?.email
	});
	const as = target ? ` as ${target.email}` : '';
	console.log(`Admin access: ${action} by ${admin.email} (sub ${admin.subject}) from ${ip}${as}`);
};
