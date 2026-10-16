// The whole Authorization Code + PKCE flow against a mock OIDC provider on localhost: discovery,
// the token exchange with client authentication, and the ID token checks. No real Zitadel.

import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminSsoSettings } from '$lib/server/platform/config';
import { beginLogin, completeLogin } from './oidc';

const ROLE_CLAIM = 'urn:zitadel:iam:org:project:roles';
const REDIRECT_URI = 'https://app.example.com/auth/oidc/callback';
const CLIENT = { id: 'app-client', secret: 'app-secret' };

interface Grant {
	challenge: string;
	nonce: string;
	claims: Record<string, unknown>;
	/** Roles in the ID token too, like Zitadel's "assert roles on authentication" setting. */
	rolesInIdToken: boolean;
}

/** A tiny OIDC provider: discovery, JWKS, token (with PKCE and basic auth) and userinfo. */
async function mockProvider() {
	const { privateKey, publicKey } = await generateKeyPair('RS256');
	const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
	const codes = new Map<string, Grant>();
	const accessTokens = new Map<string, Record<string, unknown>>();
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
				authorization_endpoint: `${issuer}/oauth/v2/authorize`,
				token_endpoint: `${issuer}/oauth/v2/token`,
				userinfo_endpoint: `${issuer}/oidc/v1/userinfo`,
				jwks_uri: `${issuer}/oauth/v2/keys`,
				response_types_supported: ['code'],
				subject_types_supported: ['public'],
				id_token_signing_alg_values_supported: ['RS256'],
				code_challenge_methods_supported: ['S256'],
				token_endpoint_auth_methods_supported: ['client_secret_basic']
			});
		}
		if (url.pathname === '/oauth/v2/keys') return json(200, { keys: [jwk] });
		if (url.pathname === '/oidc/v1/userinfo') {
			const claims = accessTokens.get(req.headers.authorization?.replace(/^Bearer /, '') ?? '');
			return claims ? json(200, claims) : json(401, { error: 'invalid_token' });
		}
		if (url.pathname === '/oauth/v2/token' && req.method === 'POST') {
			let body = '';
			for await (const chunk of req) body += chunk;
			const form = new URLSearchParams(body);
			// Basic credentials are form-encoded first (RFC 6749 2.3.1), so decode each part.
			const basic = Buffer.from(req.headers.authorization?.replace(/^Basic /, '') ?? '', 'base64');
			const [id, secret] = basic.toString().split(':').map(decodeURIComponent);
			if (id !== CLIENT.id || secret !== CLIENT.secret) {
				return json(401, { error: 'invalid_client' });
			}
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
			accessTokens.set(accessToken, grant.claims);
			const { [ROLE_CLAIM]: roles, ...withoutRoles } = grant.claims;
			const idClaims = grant.rolesInIdToken
				? { ...withoutRoles, [ROLE_CLAIM]: roles }
				: withoutRoles;
			const idToken = await new SignJWT({ ...idClaims, nonce: grant.nonce })
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
		authorize(
			authorizationUrl: URL,
			claims: Record<string, unknown>,
			rolesInIdToken = false
		): URLSearchParams {
			const params = authorizationUrl.searchParams;
			expect(params.get('code_challenge_method')).toBe('S256');
			expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
			const code = randomBytes(16).toString('hex');
			codes.set(code, {
				challenge: params.get('code_challenge')!,
				nonce: params.get('nonce')!,
				claims,
				rolesInIdToken
			});
			return new URLSearchParams({ code, state: params.get('state')! });
		}
	};
}

let provider: Awaited<ReturnType<typeof mockProvider>>;
let settings: AdminSsoSettings;

beforeAll(async () => {
	provider = await mockProvider();
	settings = {
		issuer: provider.issuer,
		clientId: CLIENT.id,
		clientSecret: CLIENT.secret,
		adminRole: 'admin',
		roleClaim: ROLE_CLAIM,
		scopes: 'openid profile email',
		actAsDomain: 'example.com'
	};
});
afterAll(() => provider.close());

const person = (roles: Record<string, unknown>) => ({
	sub: 'u-1',
	email: 'admin@example.org',
	name: 'Admin Person',
	[ROLE_CLAIM]: roles
});

describe('admin sign-in against a mock OIDC provider', () => {
	it('grants admin when the role is in the ID token', async () => {
		const { url, pending } = await beginLogin(settings, REDIRECT_URI);
		const callback = provider.authorize(url, person({ admin: { '1': 'org' } }), true);
		expect(await completeLogin(settings, REDIRECT_URI, callback, pending)).toEqual({
			subject: 'u-1',
			email: 'admin@example.org',
			name: 'Admin Person',
			isAdmin: true
		});
	});

	it('reads the role from userinfo when the ID token has none', async () => {
		const { url, pending } = await beginLogin(settings, REDIRECT_URI);
		const callback = provider.authorize(url, person({ admin: {} }));
		expect((await completeLogin(settings, REDIRECT_URI, callback, pending)).isAdmin).toBe(true);
	});

	it('does not grant admin without the role', async () => {
		const { url, pending } = await beginLogin(settings, REDIRECT_URI);
		const callback = provider.authorize(url, person({ user: {} }), true);
		expect((await completeLogin(settings, REDIRECT_URI, callback, pending)).isAdmin).toBe(false);
	});

	it('refuses a callback with another state', async () => {
		const { url, pending } = await beginLogin(settings, REDIRECT_URI);
		const callback = provider.authorize(url, person({ admin: {} }));
		callback.set('state', 'forged');
		await expect(completeLogin(settings, REDIRECT_URI, callback, pending)).rejects.toThrow();
	});

	it('refuses a code redeemed with another sign-in’s PKCE verifier', async () => {
		const first = await beginLogin(settings, REDIRECT_URI);
		const second = await beginLogin(settings, REDIRECT_URI);
		const callback = provider.authorize(first.url, person({ admin: {} }));
		const pending = { ...first.pending, verifier: second.pending.verifier };
		await expect(completeLogin(settings, REDIRECT_URI, callback, pending)).rejects.toThrow();
	});
});
