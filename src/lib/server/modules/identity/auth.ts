// Sign-in through Better Auth: email and password, sessions in Postgres (schema.ts), its rate
// limiting. Pages and form actions reach it through service.ts; its HTTP API is under /api/auth.

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { config, db } from '$lib/server/platform';
import { verifyLegacyPassword } from './password';
import { accounts, sessions, users, verifications } from './schema';

export const MIN_PASSWORD_LENGTH = 10;
const DAY_SECONDS = 24 * 60 * 60;

/**
 * The client address, set by hooks.server.ts on every request it hands to Better Auth (from
 * SvelteKit's getClientAddress, which honours ADDRESS_HEADER / XFF_DEPTH). Any value the client
 * sent is replaced, so the rate limit can't be dodged by inventing addresses.
 */
export const CLIENT_IP_HEADER = 'x-app-client-ip';

export const auth = betterAuth({
	baseURL: config.origin,
	secret: config.authSecret,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: { user: users, session: sessions, account: accounts, verification: verifications }
	}),
	emailAndPassword: {
		enabled: true,
		// No self-registration: the first admin comes from seeding; an app adds sign-up if it needs it.
		disableSignUp: true,
		minPasswordLength: MIN_PASSWORD_LENGTH,
		password: {
			hash: hashPassword,
			// Template v1 stored its own scrypt format (scrypt$…); those still sign in.
			verify: ({ hash, password }) =>
				hash.startsWith('scrypt$')
					? verifyLegacyPassword(password, hash)
					: verifyPassword({ hash, password })
		}
	},
	user: {
		additionalFields: {
			// Roles: `admin` and `user`. Never set from a request (input: false).
			role: { type: 'string', defaultValue: 'user', input: false }
		}
	},
	session: { expiresIn: 30 * DAY_SECONDS, updateAge: 15 * DAY_SECONDS },
	// On in every environment (Better Auth's default is production only). Sign-in: 3 tries per 10 s
	// per address. In memory, so per process: fine for one container, not for several.
	rateLimit: { enabled: true, storage: 'memory' },
	advanced: {
		database: { generateId: 'uuid' },
		ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] }
	},
	telemetry: { enabled: false }
});
