import { describe, expect, it } from 'vitest';
import { hashLegacyPassword, verifyLegacyPassword } from './password';

describe('template v1 password hashes', () => {
	it('verify the right password and reject others', async () => {
		const hash = await hashLegacyPassword('right-password');
		expect(hash.startsWith('scrypt$')).toBe(true);
		expect(await verifyLegacyPassword('right-password', hash)).toBe(true);
		expect(await verifyLegacyPassword('wrong-password', hash)).toBe(false);
	});

	it('reject malformed stored values', async () => {
		expect(await verifyLegacyPassword('x', 'not-a-hash')).toBe(false);
	});
});
