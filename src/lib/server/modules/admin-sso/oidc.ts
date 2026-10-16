// The OIDC side: Authorization Code with PKCE against the provider (Zitadel in Cloudgood),
// through openid-client. No database here, so it is tested against a mock provider.

import * as client from 'openid-client';
// From config directly: the platform index opens the database pool, which these tests don't need.
import { issuerUrl, type AdminSsoSettings } from '$lib/server/platform/config';
import { hasRole } from './roles';

/** What the browser keeps between the redirect to the provider and the callback. */
export interface PendingLogin {
	state: string;
	nonce: string;
	verifier: string;
}

export interface OidcIdentity {
	subject: string;
	email: string;
	name: string;
	isAdmin: boolean;
}

// One discovery per issuer and client, for the life of the process. A failed one is retried.
const configurations = new Map<string, Promise<client.Configuration>>();

function configuration(settings: AdminSsoSettings): Promise<client.Configuration> {
	const key = `${settings.issuer} ${settings.clientId}`;
	let found = configurations.get(key);
	if (!found) {
		const url = issuerUrl(settings.issuer);
		found = client.discovery(
			url,
			settings.clientId,
			undefined,
			client.ClientSecretBasic(settings.clientSecret),
			// Plain http only for a provider on this machine (issuerUrl refuses any other).
			url.protocol === 'http:' ? { execute: [client.allowInsecureRequests] } : undefined
		);
		found.catch(() => configurations.delete(key));
		configurations.set(key, found);
	}
	return found;
}

/** The provider's sign-in address, and what to keep in a cookie until the callback. */
export async function beginLogin(
	settings: AdminSsoSettings,
	redirectUri: string
): Promise<{ url: URL; pending: PendingLogin }> {
	const config = await configuration(settings);
	const pending = {
		state: client.randomState(),
		nonce: client.randomNonce(),
		verifier: client.randomPKCECodeVerifier()
	};
	const url = client.buildAuthorizationUrl(config, {
		redirect_uri: redirectUri,
		scope: settings.scopes,
		state: pending.state,
		nonce: pending.nonce,
		code_challenge: await client.calculatePKCECodeChallenge(pending.verifier),
		code_challenge_method: 'S256'
	});
	return { url, pending };
}

/**
 * Exchanges the code from the callback and checks the ID token (signature, issuer, audience,
 * expiry, nonce) and the state. Throws on any mismatch. The admin role is read from the ID
 * token, or from userinfo when the provider doesn't put roles in the token.
 */
export async function completeLogin(
	settings: AdminSsoSettings,
	redirectUri: string,
	callbackParams: URLSearchParams,
	pending: PendingLogin
): Promise<OidcIdentity> {
	const config = await configuration(settings);
	// Built from the registered redirect URI, so the token request sends exactly that one.
	const currentUrl = new URL(redirectUri);
	currentUrl.search = callbackParams.toString();
	const tokens = await client.authorizationCodeGrant(config, currentUrl, {
		pkceCodeVerifier: pending.verifier,
		expectedState: pending.state,
		expectedNonce: pending.nonce,
		idTokenExpected: true
	});
	const idClaims = tokens.claims()!;
	let claims: Record<string, unknown> = idClaims;
	if (!(settings.roleClaim in idClaims) || !idClaims.email) {
		const userinfo = await client.fetchUserInfo(config, tokens.access_token, idClaims.sub);
		claims = { ...userinfo, ...idClaims };
	}
	const email = String(claims.email ?? '');
	return {
		subject: idClaims.sub,
		email,
		name: String(claims.name ?? claims.preferred_username ?? email),
		isAdmin: hasRole(claims, settings.roleClaim, settings.adminRole)
	};
}
