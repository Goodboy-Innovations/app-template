import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
	it('verifies the right password and rejects others', async () => {
		const hash = await hashPassword('right-password');
		expect(hash.startsWith('scrypt$')).toBe(true);
		expect(await verifyPassword('right-password', hash)).toBe(true);
		expect(await verifyPassword('wrong-password', hash)).toBe(false);
	});

	it('salts every hash', async () => {
		expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
	});

	it('rejects malformed stored values', async () => {
		expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
	});
});
