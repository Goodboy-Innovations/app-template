import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// scrypt from node:crypto: no native dependencies, so Docker builds work on every platform.
const scryptAsync = promisify(scrypt) as (
	password: string,
	salt: Buffer,
	keylen: number,
	options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scryptAsync(password, salt, KEY_LENGTH, PARAMS);
	return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
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

// Hash of a random password: verifying against it when the user doesn't exist (or has no
// password) keeps response times the same, so login can't be used to probe for emails.
let dummyHash: Promise<string> | null = null;
export const dummyPasswordHash = () =>
	(dummyHash ??= hashPassword(randomBytes(16).toString('hex')));
