import { describe, expect, it } from 'vitest';
import { checkConfig, keyPrefix } from './config';

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
			'database db.example.com/app · origin https://app.example.com · uploads s3 app-files/staging/ · seed on'
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

describe('keyPrefix', () => {
	it('is empty or ends in one slash', () => {
		expect(keyPrefix(undefined)).toBe('');
		expect(keyPrefix('')).toBe('');
		expect(keyPrefix('pr-12')).toBe('pr-12/');
		expect(keyPrefix('pr-12/')).toBe('pr-12/');
		expect(() => keyPrefix('/staging')).toThrow('S3_PREFIX must not start with /');
	});
});
