import { createHash, randomBytes } from 'node:crypto';
import { count, eq, inArray } from 'drizzle-orm';
import { db, DAY_MS, isUuid } from '$lib/server/platform';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password';
import { sessions, users, type UserRole } from './schema';
import { createThrottle } from './throttle';

export interface SessionUser {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	isAdmin: boolean;
}

const SESSION_DAYS = 30;
export const SESSION_COOKIE = 'session';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const toSessionUser = (u: typeof users.$inferSelect): SessionUser => ({
	id: u.id,
	email: u.email,
	name: u.name,
	role: u.role,
	isAdmin: u.role === 'admin'
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function createUser(input: {
	email: string;
	name: string;
	password: string;
	role?: UserRole;
}): Promise<SessionUser> {
	const [user] = await db
		.insert(users)
		.values({
			email: normalizeEmail(input.email),
			name: input.name.trim(),
			passwordHash: await hashPassword(input.password),
			role: input.role ?? 'user'
		})
		.returning();
	return toSessionUser(user);
}

export async function setPassword(userId: string, password: string): Promise<void> {
	await db
		.update(users)
		.set({ passwordHash: await hashPassword(password) })
		.where(eq(users.id, userId));
	// Signing everyone out of the account is the expected effect of a password change.
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

const throttle = createThrottle();

export type SignInResult = { ok: true; user: SessionUser } | { ok: false; throttled: boolean };

/** Email + password sign-in, in constant-ish time, with a cool-down after repeated failures. */
export async function authenticate(email: string, password: string): Promise<SignInResult> {
	const key = normalizeEmail(email);
	if (throttle.isLocked(key)) return { ok: false, throttled: true };

	const [user] = await db.select().from(users).where(eq(users.email, key));
	// Verifying against a dummy hash when the user doesn't exist keeps response times the same,
	// so sign-in can't be used to probe for emails.
	const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyPasswordHash()));
	if (!user || !valid) {
		throttle.recordFailure(key);
		return { ok: false, throttled: false };
	}
	throttle.clear(key);
	return { ok: true, user: toSessionUser(user) };
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
	const [user] = await db.select().from(users).where(eq(users.id, userId));
	return !!user && (await verifyPassword(password, user.passwordHash));
}

export async function findUserByEmail(email: string): Promise<SessionUser | null> {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, normalizeEmail(email)));
	return user ? toSessionUser(user) : null;
}

/** Display names by user id, for other modules that keep user ids. */
export async function getUserNames(ids: string[]): Promise<Map<string, string>> {
	const valid = [...new Set(ids)].filter(isUuid);
	if (!valid.length) return new Map();
	const rows = await db
		.select({ id: users.id, name: users.name })
		.from(users)
		.where(inArray(users.id, valid));
	return new Map(rows.map((row) => [row.id, row.name]));
}

export async function countUsers(): Promise<number> {
	const [row] = await db.select({ n: count() }).from(users);
	return row.n;
}

/** Creates a session and returns the raw token to put in the cookie. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
	await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
	return { token, expiresAt };
}

/** Validates a session token and slides its expiry forward when it is half used up. */
export async function validateSession(
	token: string
): Promise<{ user: SessionUser; expiresAt: Date } | null> {
	const id = hashToken(token);
	const [row] = await db
		.select({ user: users, session: sessions })
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id));
	if (!row) return null;

	let expiresAt = row.session.expiresAt;
	if (expiresAt.getTime() < Date.now()) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}
	if (expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY_MS) {
		expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
		await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
	}
	return { user: toSessionUser(row.user), expiresAt };
}

export async function invalidateSession(token: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
