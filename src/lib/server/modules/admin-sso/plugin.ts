// Admin sign-in through any standard OIDC provider, and acting as demo users, as Better Auth
// plugins that identity/auth.ts adds next to Better Auth's admin plugin. When OIDC_* is unset,
// only the guard is added, and it keeps the admin plugin's API closed.
//
// - genericOAuth: Authorization Code with PKCE, ID token verified against the provider's JWKS
//   (signature, issuer, audience, nonce). Only people with the admin role get past getUserInfo;
//   they become users with role `admin` and no password
// - the guard: of the admin plugin's API only impersonate-user and stop-impersonating are open,
//   only to admins who signed in through the provider, and only for users at OIDC_ACT_AS_DOMAIN.
//   It writes the access log

import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { tryGetCurrentAuthEndpointContext } from '@better-auth/core/context';
import { decodeJwt } from 'jose';
// From config directly: the platform index opens the database pool, which tests don't have.
import { CLIENT_IP_HEADER, type AdminSsoSettings } from '$lib/server/platform/config';
import type { ActingAdmin, AdminAccessLogger } from './log';
import { canActAs, hasRole } from './roles';

/** The provider id in Better Auth: the redirect URI is <ORIGIN>/api/auth/callback/oidc. */
export const ADMIN_SSO_PROVIDER = 'oidc';
const OPEN_ADMIN_PATHS = ['/admin/impersonate-user', '/admin/stop-impersonating'];

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

const clientIp = (headers: Headers | undefined | null) =>
	headers?.get(CLIENT_IP_HEADER) ?? 'unknown';

/** The admin's identity at the provider, or null when the user didn't sign in through it. */
async function providerIdentity(
	ctx: HookContext,
	user: { id: string; email: string }
): Promise<ActingAdmin | null> {
	const accounts = await ctx.context.internalAdapter.findAccounts(user.id);
	const account = accounts.find((a) => a.providerId === ADMIN_SSO_PROVIDER);
	return account ? { subject: account.accountId, email: user.email } : null;
}

export function adminSsoPlugins(
	settings: AdminSsoSettings | null,
	logAdminAccess: AdminAccessLogger
): BetterAuthPlugin[] {
	const guard: BetterAuthPlugin = {
		id: 'admin-sso-guard',
		hooks: {
			before: [
				{
					matcher: (ctx) => !!ctx.path?.startsWith('/admin/') || ctx.path === '/sign-out',
					handler: createAuthMiddleware(async (ctx) => {
						const ip = clientIp(ctx.headers);
						if (ctx.path === '/sign-out') {
							const session = await getSessionFromCtx(ctx);
							const admin = session && (await providerIdentity(ctx, session.user));
							if (admin) await logAdminAccess(admin, 'sign-out', ip);
							return;
						}
						if (!settings || !OPEN_ADMIN_PATHS.includes(ctx.path)) {
							throw APIError.fromStatus('NOT_FOUND');
						}
						const session = await getSessionFromCtx(ctx);
						if (!session) throw APIError.fromStatus('UNAUTHORIZED');

						if (ctx.path === '/admin/stop-impersonating') {
							const adminId = session.session.impersonatedBy as string | undefined;
							const adminUser =
								adminId && (await ctx.context.internalAdapter.findUserById(adminId));
							const admin = adminUser && (await providerIdentity(ctx, adminUser));
							if (admin) await logAdminAccess(admin, 'exit', ip, session.user);
							return;
						}

						// impersonate-user: only admins who signed in through the provider, and only
						// users at OIDC_ACT_AS_DOMAIN (the demo users).
						const admin =
							session.user.role === 'admin' ? await providerIdentity(ctx, session.user) : null;
						if (!admin) {
							throw APIError.fromStatus('FORBIDDEN', {
								message: 'Only admins signed in with the identity provider can act as users'
							});
						}
						const target = await ctx.context.internalAdapter.findUserById(
							String(ctx.body?.userId ?? '')
						);
						if (!target || !canActAs(target.email, settings.actAsDomain)) {
							throw APIError.fromStatus('FORBIDDEN', { message: 'That user cannot be acted as' });
						}
					})
				}
			],
			after: [
				{
					matcher: (ctx) =>
						ctx.path === '/admin/impersonate-user' || !!ctx.path?.startsWith('/callback/'),
					handler: createAuthMiddleware(async (ctx) => {
						// The callback ends in a redirect, which Better Auth returns as an APIError (FOUND).
						const returned = ctx.context.returned;
						if (isAPIError(returned) && returned.status !== 'FOUND') return;
						const created = ctx.context.newSession;
						if (!created) return;
						const ip = clientIp(ctx.headers);
						if (ctx.path === '/admin/impersonate-user') {
							const adminId = created.session.impersonatedBy as string | undefined;
							const adminUser =
								adminId && (await ctx.context.internalAdapter.findUserById(adminId));
							const admin = adminUser && (await providerIdentity(ctx, adminUser));
							if (admin) await logAdminAccess(admin, 'act-as', ip, created.user);
						} else if (ctx.params?.id === ADMIN_SSO_PROVIDER) {
							// Only people with the admin role get this far (getUserInfo). Better Auth
							// never takes `role` from a profile, so it is set here.
							if (created.user.role !== 'admin') {
								await ctx.context.internalAdapter.updateUser(created.user.id, { role: 'admin' });
							}
							const admin = await providerIdentity(ctx, created.user);
							if (admin) await logAdminAccess(admin, 'sign-in', ip);
						}
					})
				}
			]
		}
	};
	if (!settings) return [guard];

	let userinfoEndpoint: Promise<string | null> | null = null;
	const discoveryUrl = `${settings.issuer}/.well-known/openid-configuration`;
	const findUserinfoEndpoint = () =>
		(userinfoEndpoint ??= fetch(discoveryUrl)
			.then((r) => (r.ok ? r.json() : {}))
			.then((d: { userinfo_endpoint?: string }) => d.userinfo_endpoint ?? null)
			.catch(() => ((userinfoEndpoint = null), null)));

	return [
		guard,
		genericOAuth({
			config: [
				{
					providerId: ADMIN_SSO_PROVIDER,
					name: settings.providerName,
					discoveryUrl,
					requireIdTokenVerification: true,
					clientId: settings.clientId,
					clientSecret: settings.clientSecret,
					authentication: 'basic',
					pkce: true,
					scopes: settings.scopes.split(/\s+/).filter(Boolean),
					// Name and email follow the provider on every sign-in.
					overrideUserInfo: true,
					// The ID token is verified before this runs. The role comes from it, or from
					// userinfo when the provider leaves roles out of the token.
					async getUserInfo(tokens) {
						if (!tokens.idToken) return null;
						let claims: Record<string, unknown> = decodeJwt(tokens.idToken);
						if (!(settings.roleClaim in claims) || !claims.email) {
							const endpoint = await findUserinfoEndpoint();
							const response = endpoint
								? await fetch(endpoint, {
										headers: { authorization: `Bearer ${tokens.accessToken}` }
									})
								: null;
							const userinfo = response?.ok ? await response.json() : null;
							// userinfo must be about the same person as the ID token (OIDC Core 5.3.2).
							if (userinfo?.sub === claims.sub) claims = { ...userinfo, ...claims };
						}
						const subject = String(claims.sub ?? '');
						const email = String(claims.email ?? '');
						if (!subject || !email) return null;
						if (!hasRole(claims, settings.roleClaim, settings.adminRole)) {
							const headers = tryGetCurrentAuthEndpointContext()?.headers;
							await logAdminAccess({ subject, email }, 'refused', clientIp(headers));
							return null;
						}
						return {
							...claims,
							id: subject,
							sub: subject,
							email,
							emailVerified: claims.email_verified === true,
							name: String(claims.name ?? claims.preferred_username ?? email)
						};
					}
				}
			]
		})
	];
}
