import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { CLIENT_IP_HEADER, config, db, isUuid } from '$lib/server/platform';
import { auth } from './auth';
import { accounts, users, type UserRole } from './schema';

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

export interface SessionInfo {
	/** The signed-in user (while an admin acts as someone, that someone); null when signed out. */
	user: SessionUser | null;
	/** The admin's user id while they act as `user`. */
	impersonatedBy: string | null;
	createdAt: Date | null;
	/** Cookies Better Auth wants set: a session about to expire is extended, a bad one cleared. */
	setCookies: Headers;
}

export async function getSession(headers: Headers): Promise<SessionInfo> {
	const { headers: setCookies, response } = await auth.api.getSession({
		headers,
		returnHeaders: true
	});
	return {
		user: response ? toSessionUser(response.user) : null,
		impersonatedBy: response?.session.impersonatedBy ?? null,
		createdAt: response ? new Date(response.session.createdAt) : null,
		setCookies
	};
}

/** Starts a sign-in at an OAuth/OIDC provider: the address to send the browser to. */
export async function startProviderSignIn(input: {
	provider: string;
	headers: Headers;
	callbackURL: string;
	errorCallbackURL: string;
}): Promise<{ url: string; setCookies: Headers }> {
	const { headers, response } = await auth.api.signInSocial({
		headers: input.headers,
		body: {
			provider: input.provider,
			callbackURL: input.callbackURL,
			errorCallbackURL: input.errorCallbackURL,
			disableRedirect: true
		},
		returnHeaders: true
	});
	if (!response.url) throw new Error(`No sign-in address from provider ${input.provider}`);
	return { url: response.url, setCookies: headers };
}

/**
 * Acts as another user (Better Auth's admin plugin). Who may act as whom is checked in Better
 * Auth's hooks (admin-sso); a refusal is { ok: false }.
 */
export async function impersonate(
	headers: Headers,
	userId: string
): Promise<{ ok: true; setCookies: Headers } | { ok: false; error: string }> {
	try {
		const result = await auth.api.impersonateUser({
			headers,
			body: { userId },
			returnHeaders: true
		});
		return { ok: true, setCookies: result.headers };
	} catch (err) {
		if (!(err instanceof APIError)) throw err;
		return { ok: false, error: err.message || 'That user cannot be acted as' };
	}
}

/** Back to the admin's own session; returns its cookies. */
export async function stopImpersonating(headers: Headers): Promise<Headers> {
	const result = await auth.api.stopImpersonating({ headers, returnHeaders: true });
	return result.headers;
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
	clientAddress: string | null;
	userAgent: string | null;
}): Promise<SignInResult> {
	const headers = new Headers({ 'content-type': 'application/json', origin: config.origin });
	if (input.clientAddress) headers.set(CLIENT_IP_HEADER, input.clientAddress);
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

export async function findUserById(id: string): Promise<SessionUser | null> {
	if (!isUuid(id)) return null;
	const [user] = await db.select().from(users).where(eq(users.id, id));
	return user ? toSessionUser(user) : null;
}

/** Every user, by name. For admin views; an app with many users adds paging. */
export async function listUsers(): Promise<SessionUser[]> {
	return (await db.select().from(users).orderBy(asc(users.name))).map(toSessionUser);
}

/** The user's id at an OAuth/OIDC provider (its `sub`), or null when they have no account there. */
export async function providerSubject(userId: string, providerId: string): Promise<string | null> {
	if (!isUuid(userId)) return null;
	const [account] = await db
		.select({ accountId: accounts.accountId })
		.from(accounts)
		.where(and(eq(accounts.userId, userId), eq(accounts.providerId, providerId)));
	return account?.accountId ?? null;
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
