// The one place that reads environment variables. Modules never import `$env/*`, so the same
// code runs inside SvelteKit, in scripts (`npm run db:seed`) and in tests.

try {
	// Loads `.env` in local development. In a container the variables come from the platform.
	process.loadEnvFile();
} catch {
	// No .env file: rely on the real environment.
}

export const config = {
	get databaseUrl() {
		const url = process.env.DATABASE_URL;
		// db.ts opens its pool as soon as it is imported, which can be before the server's own check
		// runs (bundlers merge modules into one chunk). So a bad value names every configuration
		// problem here, instead of only "Invalid URL".
		if (!isPostgresUrl(url)) checkConfig();
		return url!;
	},
	/** Seed an empty database when the server starts. */
	get seedOnStart() {
		return isOn(process.env.SEED_ON_START);
	},
	/** First admin account, created when an empty database is seeded. */
	get seedAdmin() {
		return { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD };
	},
	/** The demo dataset for an empty database (staging, previews); null when off. */
	get seedDemo() {
		return isOn(process.env.SEED_DEMO) ? { password: process.env.SEED_DEMO_PASSWORD } : null;
	},
	/** S3-compatible bucket for uploads; null when uploads are off. */
	get s3() {
		const env = process.env;
		if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
			return null;
		}
		return {
			endpoint: endpointUrl(env.S3_ENDPOINT),
			bucket: env.S3_BUCKET,
			region: env.S3_REGION || 'us-east-1',
			accessKeyId: env.S3_ACCESS_KEY_ID,
			secretAccessKey: env.S3_SECRET_ACCESS_KEY,
			prefix: keyPrefix(env.S3_PREFIX)
		};
	},
	/** Admin sign-in through an OIDC provider (Cloudgood ID); null when off. */
	get adminSso() {
		return adminSsoSettings(process.env);
	}
};

export interface AdminSsoSettings {
	issuer: string;
	clientId: string;
	clientSecret: string;
	/** The role an admin must have, read from `roleClaim` in the ID token or userinfo. */
	adminRole: string;
	roleClaim: string;
	scopes: string;
	/** Admins may act only as users whose email is at this domain. */
	actAsDomain: string;
}

export function adminSsoSettings(env: NodeJS.ProcessEnv): AdminSsoSettings | null {
	if (!env.OIDC_ISSUER || !env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET || !env.OIDC_ADMIN_ROLE) {
		return null;
	}
	return {
		issuer: env.OIDC_ISSUER.replace(/\/+$/, ''),
		clientId: env.OIDC_CLIENT_ID,
		clientSecret: env.OIDC_CLIENT_SECRET,
		adminRole: env.OIDC_ADMIN_ROLE,
		roleClaim: env.OIDC_ROLE_CLAIM || 'urn:zitadel:iam:org:project:roles',
		scopes: env.OIDC_SCOPES || 'openid profile email urn:zitadel:iam:org:projects:roles',
		actAsDomain: (env.OIDC_ACT_AS_DOMAIN || 'example.com').toLowerCase()
	};
}

/** https, or http only on this machine (a mock provider in tests and local development). */
export function issuerUrl(issuer: string): URL {
	let url: URL;
	try {
		url = new URL(issuer);
	} catch {
		throw new Error('OIDC_ISSUER is not a valid URL');
	}
	const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
	if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
		throw new Error('OIDC_ISSUER is not an https URL');
	}
	return url;
}

const isOn = (value: string | undefined) => value === '1' || value === 'true';

function isPostgresUrl(value: string | undefined): value is string {
	if (!value) return false;
	try {
		const { protocol } = new URL(value);
		return protocol === 'postgres:' || protocol === 'postgresql:';
	} catch {
		return false;
	}
}

/** Host and database name, without the login. */
function databaseName(value: string): string {
	const url = new URL(value);
	return `${url.hostname}${url.pathname}`;
}

/** The endpoint as a base URL without a trailing slash; https:// when no scheme is given. */
export function endpointUrl(endpoint: string): string {
	const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`;
	let url: URL;
	try {
		url = new URL(withScheme);
	} catch {
		throw new Error('S3_ENDPOINT is not a valid URL');
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error('S3_ENDPOINT is not an http(s) URL');
	}
	return withScheme.replace(/\/+$/, '');
}

/** S3_PREFIX as a key prefix: empty, or ending in one slash ("staging" → "staging/"). */
export function keyPrefix(prefix: string | undefined): string {
	if (!prefix) return '';
	if (prefix.startsWith('/')) throw new Error('S3_PREFIX must not start with /');
	return prefix.replace(/\/*$/, '/');
}

/** Variables that only work together: one set without the others is a mistake. */
const GROUPS = [
	{
		required: ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
		optional: ['S3_REGION', 'S3_PREFIX']
	},
	{ required: ['SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'], optional: [] },
	{ required: ['SEED_DEMO'], optional: ['SEED_DEMO_PASSWORD'] },
	{
		required: ['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_ADMIN_ROLE'],
		optional: ['OIDC_ROLE_CLAIM', 'OIDC_SCOPES', 'OIDC_ACT_AS_DOMAIN']
	}
];

/**
 * Checks the environment once when the server starts, so a deployment with missing or half-set
 * variables stops with one message naming all of them, instead of failing on a later request or
 * quietly falling back. Returns a one-line summary for the log, without secrets.
 */
export function checkConfig(env: NodeJS.ProcessEnv = process.env): string {
	const problems: string[] = [];

	const databaseUrl = env.DATABASE_URL;
	if (!databaseUrl) problems.push('DATABASE_URL is not set');
	else if (!isPostgresUrl(databaseUrl)) problems.push('DATABASE_URL is not a postgres:// URL');

	// The app's own address, for SvelteKit (adapter-node): absolute links, canonical URLs and the
	// CSRF check of form posts. Without it a server behind a TLS proxy thinks it is http.
	if (!env.ORIGIN) problems.push('ORIGIN is not set');
	else if (!/^https?:\/\/[^/]+$/.test(env.ORIGIN)) {
		problems.push('ORIGIN is not an http(s) address without a path, e.g. https://app.example.com');
	}

	for (const { required, optional } of GROUPS) {
		const given = [...required, ...optional].filter((name) => env[name]);
		const missing = required.filter((name) => !env[name]);
		if (given.length && missing.length) {
			problems.push(`${given.join(', ')} set without ${missing.join(', ')}`);
		}
	}
	const parses = (parse: () => unknown) => {
		try {
			parse();
		} catch (err) {
			problems.push((err as Error).message);
		}
	};
	if (env.S3_ENDPOINT) parses(() => endpointUrl(env.S3_ENDPOINT!));
	parses(() => keyPrefix(env.S3_PREFIX));
	if (env.OIDC_ISSUER) parses(() => issuerUrl(env.OIDC_ISSUER!));

	for (const name of ['SEED_ON_START', 'SEED_DEMO']) {
		const value = env[name];
		if (value && !['1', 'true', '0', 'false'].includes(value)) {
			problems.push(`${name} is not 1, true, 0 or false`);
		}
	}

	if (problems.length) {
		throw new Error(`Configuration is incomplete:\n- ${problems.join('\n- ')}`);
	}

	const uploads = env.S3_BUCKET ? `s3 ${env.S3_BUCKET}/${keyPrefix(env.S3_PREFIX)}` : 'off';
	return [
		`database ${databaseName(databaseUrl!)}`,
		`origin ${env.ORIGIN}`,
		`uploads ${uploads}`,
		`admin sign-in ${adminSsoSettings(env) ? `oidc ${env.OIDC_ISSUER}` : 'off'}`,
		`seed ${isOn(env.SEED_ON_START) ? (isOn(env.SEED_DEMO) ? 'on, with demo data' : 'on') : 'off'}`
	].join(' · ');
}
