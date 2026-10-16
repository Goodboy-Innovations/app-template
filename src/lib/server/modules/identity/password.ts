// Template v1's password format, scrypt$N$r$p$salt$key. Better Auth hashes new passwords in its
// own format; auth.ts verifies these old ones so existing users keep signing in. Remove this once
// no account has a scrypt$ hash.

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
	password: string,
	salt: Buffer,
	keylen: number,
	options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Only for tests: makes a hash in the old format. */
export async function hashLegacyPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scryptAsync(password, salt, 32, PARAMS);
	return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyLegacyPassword(password: string, stored: string): Promise<boolean> {
	const [algo, n, r, p, salt, key] = stored.split('$');
	if (algo !== 'scrypt' || !salt || !key) return false;
	const expected = Buffer.from(key, 'base64');
	const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, {
		N: Number(n),
		r: Number(r),
		p: Number(p),
		maxmem: PARAMS.maxmem
	});
	return timingSafeEqual(actual, expected);
}
