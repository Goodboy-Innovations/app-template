import { describe, expect, it } from 'vitest';
import { adminSsoSettings, checkConfig, keyPrefix } from './config';

const base = {
	DATABASE_URL: 'postgres://app:secret@db.example.com:5432/app',
	ORIGIN: 'https://app.example.com'
};

const s3 = {
	S3_ENDPOINT: 's3.example.com',
	S3_BUCKET: 'app-files',
	S3_ACCESS_KEY_ID: 'id',
	S3_SECRET_ACCESS_KEY: 'key'
};

describe('checkConfig', () => {
	it('summarises a complete configuration without secrets', () => {
		const summary = checkConfig({ ...base, ...s3, S3_PREFIX: 'staging', SEED_ON_START: '1' });
		expect(summary).toBe(
			'database db.example.com/app · origin https://app.example.com · uploads s3 app-files/staging/ · admin sign-in off · seed on'
		);
		expect(summary).not.toContain('secret');
		expect(summary).not.toContain('key');
	});

	it('names every problem at once', () => {
		expect(() =>
			checkConfig({ S3_BUCKET: 'app-files', S3_PREFIX: 'pr-1/', SEED_ADMIN_EMAIL: 'a@example.com' })
		).toThrow(
			[
				'Configuration is incomplete:',
				'- DATABASE_URL is not set',
				'- ORIGIN is not set',
				'- S3_BUCKET, S3_PREFIX set without S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY',
				'- SEED_ADMIN_EMAIL set without SEED_ADMIN_PASSWORD'
			].join('\n')
		);
	});

	it('rejects a placeholder database and a malformed origin', () => {
		const run = () => checkConfig({ DATABASE_URL: 'none', ORIGIN: 'app.example.com/' });
		expect(run).toThrow('DATABASE_URL is not a postgres:// URL');
		expect(run).toThrow('ORIGIN is not an http(s) address');
	});

	it('rejects an S3 endpoint that is not http(s), and unknown seed values', () => {
		const run = () =>
			checkConfig({
				...base,
				...s3,
				S3_ENDPOINT: 'ftp://s3.example.com',
				SEED_ON_START: 'yes',
				SEED_DEMO: 'on'
			});
		expect(run).toThrow('S3_ENDPOINT is not an http(s) URL');
		expect(run).toThrow('SEED_ON_START is not 1, true, 0 or false');
		expect(run).toThrow('SEED_DEMO is not 1, true, 0 or false');
	});

	it('shows the demo dataset in the summary, and wants SEED_DEMO with its password', () => {
		expect(checkConfig({ ...base, SEED_ON_START: '1', SEED_DEMO: '1' })).toContain(
			'seed on, with demo data'
		);
		expect(() => checkConfig({ ...base, SEED_DEMO_PASSWORD: 'secret-pw' })).toThrow(
			'SEED_DEMO_PASSWORD set without SEED_DEMO'
		);
	});

	it('turns uploads off when no S3 variable is set', () => {
		expect(checkConfig(base)).toContain('uploads off');
	});
});

const oidc = {
	OIDC_ISSUER: 'https://id.example.org/',
	OIDC_CLIENT_ID: 'client',
	OIDC_CLIENT_SECRET: 'oidc-secret',
	OIDC_ADMIN_ROLE: 'admin'
};

describe('admin sign-in settings', () => {
	it('are off unless all four OIDC_* are set, and name the missing ones', () => {
		expect(adminSsoSettings({})).toBeNull();
		expect(checkConfig(base)).toContain('admin sign-in off');
		expect(() => checkConfig({ ...base, OIDC_ISSUER: oidc.OIDC_ISSUER })).toThrow(
			'OIDC_ISSUER set without OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_ADMIN_ROLE'
		);
	});

	it('default to Zitadel roles and demo users at example.com', () => {
		expect(adminSsoSettings(oidc)).toEqual({
			issuer: 'https://id.example.org',
			clientId: 'client',
			clientSecret: 'oidc-secret',
			adminRole: 'admin',
			roleClaim: 'urn:zitadel:iam:org:project:roles',
			scopes: 'openid profile email urn:zitadel:iam:org:projects:roles',
			actAsDomain: 'example.com'
		});
		const summary = checkConfig({ ...base, ...oidc });
		expect(summary).toContain('admin sign-in oidc https://id.example.org/');
		expect(summary).not.toContain('oidc-secret');
	});

	it('want https, except on this machine', () => {
		expect(() => checkConfig({ ...base, ...oidc, OIDC_ISSUER: 'http://id.example.org' })).toThrow(
			'OIDC_ISSUER is not an https URL'
		);
		expect(checkConfig({ ...base, ...oidc, OIDC_ISSUER: 'http://localhost:8080' })).toContain(
			'admin sign-in oidc'
		);
	});
});

describe('keyPrefix', () => {
	it('is empty or ends in one slash', () => {
		expect(keyPrefix(undefined)).toBe('');
		expect(keyPrefix('')).toBe('');
		expect(keyPrefix('pr-12')).toBe('pr-12/');
		expect(keyPrefix('pr-12/')).toBe('pr-12/');
		expect(() => keyPrefix('/staging')).toThrow('S3_PREFIX must not start with /');
	});
});
