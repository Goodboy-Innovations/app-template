import { count, eq, inArray } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { config, db, isUuid } from '$lib/server/platform';
import { CLIENT_IP_HEADER, auth } from './auth';
import { users, type UserRole } from './schema';

export interface SessionUser {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	isAdmin: boolean;
}

const toSessionUser = (u: {
	id: string;
	email: string;
	name: string;
	role?: unknown;
}): SessionUser => {
	const role: UserRole = u.role === 'admin' ? 'admin' : 'user';
	return { id: u.id, email: u.email, name: u.name, role, isAdmin: role === 'admin' };
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * The signed-in user for a request's headers (null when not signed in), and the cookies Better
 * Auth wants to set: a session about to expire is extended, an invalid cookie cleared.
 */
export async function getSession(
	headers: Headers
): Promise<{ user: SessionUser | null; setCookies: Headers }> {
	const { headers: setCookies, response } = await auth.api.getSession({
		headers,
		returnHeaders: true
	});
	return { user: response ? toSessionUser(response.user) : null, setCookies };
}

export type SignInResult =
	{ ok: true; user: SessionUser; setCookies: Headers } | { ok: false; throttled: boolean };

/**
 * Email + password sign-in. It goes through Better Auth's HTTP handler, not its server API, so
 * Better Auth's rate limit applies (it only guards HTTP requests).
 */
export async function signIn(input: {
	email: string;
	password: string;
	clientAddress: string;
	userAgent: string | null;
}): Promise<SignInResult> {
	const headers = new Headers({
		'content-type': 'application/json',
		origin: config.origin,
		[CLIENT_IP_HEADER]: input.clientAddress
	});
	if (input.userAgent) headers.set('user-agent', input.userAgent);
	const response = await auth.handler(
		new Request(`${config.origin}/api/auth/sign-in/email`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ email: normalizeEmail(input.email), password: input.password })
		})
	);
	if (!response.ok) return { ok: false, throttled: response.status === 429 };
	const { user } = await response.json();
	return { ok: true, user: toSessionUser(user), setCookies: response.headers };
}

/** Ends the request's session; returns the cookies that clear it. */
export async function signOut(headers: Headers): Promise<Headers> {
	const result = await auth.api.signOut({ headers, returnHeaders: true });
	return result.headers;
}

/** Changes the password and signs every other device out; returns this device's new cookies. */
export async function changePassword(
	headers: Headers,
	currentPassword: string,
	newPassword: string
): Promise<{ ok: true; setCookies: Headers } | { ok: false; error: string }> {
	try {
		const result = await auth.api.changePassword({
			headers,
			body: { currentPassword, newPassword, revokeOtherSessions: true },
			returnHeaders: true
		});
		return { ok: true, setCookies: result.headers };
	} catch (err) {
		if (!(err instanceof APIError)) throw err;
		const code = (err.body as { code?: string } | undefined)?.code;
		if (code === 'INVALID_PASSWORD') return { ok: false, error: 'The current password is wrong' };
		return { ok: false, error: err.message || 'The password could not be changed' };
	}
}

/** Adds a user with a password (seeding, admin tools). Sign-up through the API is off. */
export async function createUser(input: {
	email: string;
	name: string;
	password: string;
	role?: UserRole;
}): Promise<SessionUser> {
	const ctx = await auth.$context;
	const user = await ctx.internalAdapter.createUser(
		{
			email: normalizeEmail(input.email),
			name: input.name.trim(),
			emailVerified: false,
			role: input.role ?? 'user'
		},
		{ method: 'email-password' }
	);
	await ctx.internalAdapter.linkAccount({
		userId: user.id,
		providerId: 'credential',
		accountId: user.id,
		password: await ctx.password.hash(input.password)
	});
	return toSessionUser(user);
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
