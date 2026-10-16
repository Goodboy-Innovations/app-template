import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { config, db, isUuid } from '$lib/server/platform';
import { findUserById, listUsers, type SessionUser } from '$lib/server/modules/identity';
import { canActAs } from './roles';
import { adminAccessLog, adminSessions } from './schema';

export const ADMIN_COOKIE = 'admin_session';
/** A working day; no sliding, so an admin signs in through the provider again after it. */
const SESSION_MS = 8 * 60 * 60 * 1000;

export interface AdminSession {
	subject: string;
	email: string;
	name: string;
	/** The user the admin acts as, or null. */
	actingAs: SessionUser | null;
	expiresAt: Date;
}

type Admin = { subject: string; email: string };
type LogAction = (typeof adminAccessLog.$inferInsert)['action'];

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Whether admin sign-in is configured (all OIDC_* variables set). */
export const adminSsoEnabled = () => config.adminSso !== null;

/** Writes the access log: a row, and a line in the server log. */
export async function logAdminAccess(
	admin: Admin,
	action: LogAction,
	target?: { id: string; email: string }
): Promise<void> {
	await db.insert(adminAccessLog).values({
		subject: admin.subject,
		email: admin.email,
		action,
		targetUserId: target?.id,
		targetEmail: target?.email
	});
	console.log(
		`Admin access: ${action} by ${admin.email} (${admin.subject})${target ? ` as ${target.email}` : ''}`
	);
}

/** Starts an admin session for an identity whose admin role is already checked. */
export async function createAdminSession(admin: {
	subject: string;
	email: string;
	name: string;
}): Promise<{ token: string; expiresAt: Date }> {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + SESSION_MS);
	await db.insert(adminSessions).values({ id: hashToken(token), ...admin, expiresAt });
	await logAdminAccess(admin, 'sign-in');
	return { token, expiresAt };
}

export async function validateAdminSession(token: string): Promise<AdminSession | null> {
	const id = hashToken(token);
	const [row] = await db.select().from(adminSessions).where(eq(adminSessions.id, id));
	if (!row) return null;
	if (row.expiresAt.getTime() < Date.now()) {
		await db.delete(adminSessions).where(eq(adminSessions.id, id));
		return null;
	}
	const actingAs = row.actingAs ? await findUserById(row.actingAs) : null;
	return {
		subject: row.subject,
		email: row.email,
		name: row.name,
		actingAs,
		expiresAt: row.expiresAt
	};
}

/** The users an admin may act as: those at OIDC_ACT_AS_DOMAIN, the seeded demo users. */
export async function listActableUsers(): Promise<SessionUser[]> {
	const settings = config.adminSso;
	if (!settings) return [];
	return (await listUsers()).filter((user) => canActAs(user.email, settings.actAsDomain));
}

/**
 * Starts acting as a user, ending acting as another one first. False, and nothing changed, when
 * that user may not be acted as (or doesn't exist).
 */
export async function actAs(
	token: string,
	session: AdminSession,
	userId: string
): Promise<boolean> {
	const settings = config.adminSso;
	const user = isUuid(userId) ? await findUserById(userId) : null;
	if (!settings || !user || !canActAs(user.email, settings.actAsDomain)) return false;
	if (session.actingAs) await logAdminAccess(session, 'exit', session.actingAs);
	await db
		.update(adminSessions)
		.set({ actingAs: user.id })
		.where(eq(adminSessions.id, hashToken(token)));
	await logAdminAccess(session, 'act-as', user);
	return true;
}

export async function exitActing(token: string, session: AdminSession): Promise<void> {
	if (!session.actingAs) return;
	await db
		.update(adminSessions)
		.set({ actingAs: null })
		.where(eq(adminSessions.id, hashToken(token)));
	await logAdminAccess(session, 'exit', session.actingAs);
}

export async function endAdminSession(token: string): Promise<void> {
	const [row] = await db
		.delete(adminSessions)
		.where(eq(adminSessions.id, hashToken(token)))
		.returning();
	if (row) await logAdminAccess(row, 'sign-out');
}
