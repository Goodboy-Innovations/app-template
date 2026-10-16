// Admin sign-in end to end, without Postgres or a real provider: Better Auth on its memory
// adapter with the admin plugin and these plugins, against a mock OIDC provider on localhost.
// Covers the code + PKCE exchange, the ID token checks, the role gate, who may act as whom, and
// the access log.

import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { admin } from 'better-auth/plugins/admin';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_IP_HEADER, type AdminSsoSettings } from '$lib/server/platform/config';
import type { AdminAccessLogger } from './log';
import { ADMIN_SSO_PROVIDER, adminSsoPlugins } from './plugin';

const ORIGIN = 'http://localhost:3000';
const REDIRECT_URI = `${ORIGIN}/api/auth/callback/${ADMIN_SSO_PROVIDER}`;
const ROLE_CLAIM = 'urn:zitadel:iam:org:project:roles';
const CLIENT = { id: 'app-client', secret: 'app-secret' };

/** A tiny OIDC provider: discovery, JWKS, token (PKCE and basic auth) and userinfo. */
async function mockProvider() {
	const { privateKey, publicKey } = await generateKeyPair('RS256');
	const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
	const codes = new Map<string, { challenge: string; nonce: string; claims: object }>();
	const userinfo = new Map<string, object>();
	let issuer = '';

	const server = createServer(async (req, res) => {
		const url = new URL(req.url!, issuer);
		const json = (status: number, body: unknown) => {
			res.writeHead(status, { 'content-type': 'application/json' });
			res.end(JSON.stringify(body));
		};
		if (url.pathname === '/.well-known/openid-configuration') {
			return json(200, {
				issuer,
				authorization_endpoint: `${issuer}/authorize`,
				token_endpoint: `${issuer}/token`,
				userinfo_endpoint: `${issuer}/userinfo`,
				jwks_uri: `${issuer}/keys`,
				response_types_supported: ['code'],
				subject_types_supported: ['public'],
				id_token_signing_alg_values_supported: ['RS256'],
				code_challenge_methods_supported: ['S256']
			});
		}
		if (url.pathname === '/keys') return json(200, { keys: [jwk] });
		if (url.pathname === '/userinfo') {
			const claims = userinfo.get(req.headers.authorization?.replace(/^Bearer /, '') ?? '');
			return claims ? json(200, claims) : json(401, { error: 'invalid_token' });
		}
		if (url.pathname === '/token' && req.method === 'POST') {
			let body = '';
			for await (const chunk of req) body += chunk;
			const form = new URLSearchParams(body);
			const basic = Buffer.from(req.headers.authorization?.replace(/^Basic /, '') ?? '', 'base64');
			const [id, secret] = basic.toString().split(':').map(decodeURIComponent);
			if (id !== CLIENT.id || secret !== CLIENT.secret)
				return json(401, { error: 'invalid_client' });
			const code = form.get('code') ?? '';
			const grant = codes.get(code);
			codes.delete(code);
			const challenge = createHash('sha256')
				.update(form.get('code_verifier') ?? '')
				.digest('base64url');
			if (!grant || grant.challenge !== challenge || form.get('redirect_uri') !== REDIRECT_URI) {
				return json(400, { error: 'invalid_grant' });
			}
			const accessToken = randomBytes(16).toString('hex');
			const { [ROLE_CLAIM]: roles, ...withoutRoles } = grant.claims as Record<string, unknown>;
			userinfo.set(accessToken, { ...withoutRoles, [ROLE_CLAIM]: roles });
			// Roles only at userinfo, like Zitadel without "assert roles on authentication".
			const idToken = await new SignJWT({ ...withoutRoles, nonce: grant.nonce })
				.setProtectedHeader({ alg: 'RS256', kid: 'k1' })
				.setIssuer(issuer)
				.setAudience(CLIENT.id)
				.setIssuedAt()
				.setExpirationTime('5m')
				.sign(privateKey);
			return json(200, {
				access_token: accessToken,
				token_type: 'Bearer',
				expires_in: 300,
				id_token: idToken
			});
		}
		json(404, { error: 'not_found' });
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

	return {
		issuer,
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
		/** What the provider does once the person has signed in: the callback's parameters. */
		authorize(authorizationUrl: string, claims: object): URLSearchParams {
			const params = new URL(authorizationUrl).searchParams;
			expect(params.get('code_challenge_method')).toBe('S256');
			expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
			const code = randomBytes(16).toString('hex');
			codes.set(code, {
				challenge: params.get('code_challenge')!,
				nonce: params.get('nonce')!,
				claims
			});
			return new URLSearchParams({ code, state: params.get('state')! });
		}
	};
}

const cookiesOf = (response: Response) =>
	response.headers
		.getSetCookie()
		.map((c) => c.split(';')[0])
		.join('; ');

/** A cookie header with the response's cookies replacing those of the same name. */
function withCookies(cookie: string, response: Response): string {
	const jar = new Map(cookie.split('; ').map((c) => [c.split('=')[0], c] as const));
	for (const c of cookiesOf(response).split('; ')) jar.set(c.split('=')[0], c);
	return [...jar.values()].join('; ');
}

let provider: Awaited<ReturnType<typeof mockProvider>>;
let auth: ReturnType<typeof createAuth>;
const log: { action: string; email: string; target?: string }[] = [];

function createAuth(settings: AdminSsoSettings) {
	const logger: AdminAccessLogger = async (adminUser, action, ip, target) => {
		expect(ip).toBe('203.0.113.7');
		log.push({ action, email: adminUser.email, target: target?.email });
	};
	return betterAuth({
		baseURL: ORIGIN,
		secret: 'test-secret-test-secret-test-secret',
		database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
		emailAndPassword: { enabled: true, disableSignUp: true },
		user: { additionalFields: { role: { type: 'string', defaultValue: 'user', input: false } } },
		account: { accountLinking: { enabled: false } },
		advanced: { ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] } },
		plugins: [admin({ adminRoles: ['admin'] }), ...adminSsoPlugins(settings, logger)],
		telemetry: { enabled: false }
	});
}

const headers = (cookie = '', json = false) => {
	const h = new Headers({ origin: ORIGIN, cookie, [CLIENT_IP_HEADER]: '203.0.113.7' });
	if (json) h.set('content-type', 'application/json');
	return h;
};

/** The browser's round trip: start, provider, callback. Returns the callback response. */
async function signInWithProvider(claims: object): Promise<Response> {
	const start = await auth.handler(
		new Request(`${ORIGIN}/api/auth/sign-in/social`, {
			method: 'POST',
			headers: headers('', true),
			body: JSON.stringify({
				provider: ADMIN_SSO_PROVIDER,
				callbackURL: '/admin',
				errorCallbackURL: '/login'
			})
		})
	);
	const { url } = await start.json();
	const callback = provider.authorize(url, claims);
	return auth.handler(
		new Request(`${REDIRECT_URI}?${callback}`, { headers: headers(cookiesOf(start)) })
	);
}

async function createUser(email: string, role = 'user') {
	const ctx = await auth.$context;
	const user = await ctx.internalAdapter.createUser(
		{ email, name: email, role, emailVerified: true },
		{ method: 'email-password' }
	);
	await ctx.internalAdapter.linkAccount({
		userId: user.id,
		providerId: 'credential',
		accountId: user.id,
		password: await ctx.password.hash('password-123')
	});
	return user;
}

const person = (sub: string, roles: object) => ({
	sub,
	email: `${sub}@example.org`,
	name: `Person ${sub}`,
	[ROLE_CLAIM]: roles
});

beforeAll(async () => {
	provider = await mockProvider();
	auth = createAuth({
		issuer: provider.issuer,
		clientId: CLIENT.id,
		clientSecret: CLIENT.secret,
		adminRole: 'admin',
		roleClaim: ROLE_CLAIM,
		scopes: 'openid profile email',
		actAsDomain: 'example.com',
		providerName: 'Mock ID'
	});
});
afterAll(() => provider.close());
beforeEach(() => {
	log.length = 0;
});

describe('admin sign-in through a mock OIDC provider', () => {
	it('signs in someone with the admin role as an admin, without a password', async () => {
		const callback = await signInWithProvider(person('alice', { admin: { '1': 'org' } }));
		expect(callback.status).toBe(302);
		expect(callback.headers.get('location')).toBe('/admin');
		const session = await auth.api.getSession({ headers: headers(cookiesOf(callback)) });
		expect(session?.user).toMatchObject({ email: 'alice@example.org', role: 'admin' });
		expect(log).toEqual([{ action: 'sign-in', email: 'alice@example.org', target: undefined }]);
	});

	it('refuses someone without the role, and creates no user', async () => {
		const callback = await signInWithProvider(person('bob', { user: {} }));
		expect(callback.headers.get('location')).toMatch(/^\/login\?error=/);
		expect(callback.headers.getSetCookie().some((c) => c.includes('session_token=;'))).toBe(false);
		const ctx = await auth.$context;
		expect(await ctx.internalAdapter.findUserByEmail('bob@example.org')).toBeNull();
		expect(log).toEqual([{ action: 'refused', email: 'bob@example.org', target: undefined }]);
	});
});

describe('acting as a user', () => {
	it('lets a provider admin act as a demo user and back, and logs both', async () => {
		const demo = await createUser('demo.aino@example.com');
		const signedIn = await signInWithProvider(person('carol', { admin: {} }));
		const adminCookie = cookiesOf(signedIn);

		const acting = await auth.handler(
			new Request(`${ORIGIN}/api/auth/admin/impersonate-user`, {
				method: 'POST',
				headers: headers(adminCookie, true),
				body: JSON.stringify({ userId: demo.id })
			})
		);
		expect(acting.status).toBe(200);
		const actingCookie = withCookies(adminCookie, acting);
		const session = await auth.api.getSession({ headers: headers(actingCookie) });
		expect(session?.user.email).toBe('demo.aino@example.com');
		expect(session?.session.impersonatedBy).toBeTruthy();

		const back = await auth.handler(
			new Request(`${ORIGIN}/api/auth/admin/stop-impersonating`, {
				method: 'POST',
				headers: headers(actingCookie)
			})
		);
		expect(back.status).toBe(200);
		expect(log.map((e) => [e.action, e.target])).toEqual([
			['sign-in', undefined],
			['act-as', 'demo.aino@example.com'],
			['exit', 'demo.aino@example.com']
		]);
	});

	it('refuses users outside the demo domain', async () => {
		const real = await createUser('customer@company.fi');
		const signedIn = await signInWithProvider(person('dave', { admin: {} }));
		const response = await auth.handler(
			new Request(`${ORIGIN}/api/auth/admin/impersonate-user`, {
				method: 'POST',
				headers: headers(cookiesOf(signedIn), true),
				body: JSON.stringify({ userId: real.id })
			})
		);
		expect(response.status).toBe(403);
	});

	it('refuses password admins, and keeps the rest of the admin API closed', async () => {
		const demo = await createUser('demo.mikko@example.com');
		await createUser('password.admin@example.org', 'admin');
		const signIn = await auth.handler(
			new Request(`${ORIGIN}/api/auth/sign-in/email`, {
				method: 'POST',
				headers: headers('', true),
				body: JSON.stringify({ email: 'password.admin@example.org', password: 'password-123' })
			})
		);
		expect(signIn.status).toBe(200);
		const cookie = cookiesOf(signIn);
		const act = await auth.handler(
			new Request(`${ORIGIN}/api/auth/admin/impersonate-user`, {
				method: 'POST',
				headers: headers(cookie, true),
				body: JSON.stringify({ userId: demo.id })
			})
		);
		expect(act.status).toBe(403);
		const listUsers = await auth.handler(
			new Request(`${ORIGIN}/api/auth/admin/list-users`, { headers: headers(cookie) })
		);
		expect(listUsers.status).toBe(404);
	});
});
