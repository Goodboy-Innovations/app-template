import { describe, expect, it } from 'vitest';
import { canActAs, hasRole } from './roles';

const ZITADEL = 'urn:zitadel:iam:org:project:roles';

describe('hasRole', () => {
	it('reads Zitadel role objects', () => {
		const claims = { [ZITADEL]: { admin: { '123': 'org.example.com' } } };
		expect(hasRole(claims, ZITADEL, 'admin')).toBe(true);
		expect(hasRole(claims, ZITADEL, 'owner')).toBe(false);
	});

	it('reads arrays and space-separated strings', () => {
		expect(hasRole({ roles: ['user', 'admin'] }, 'roles', 'admin')).toBe(true);
		expect(hasRole({ roles: 'user admin' }, 'roles', 'admin')).toBe(true);
		expect(hasRole({ roles: 'administrator' }, 'roles', 'admin')).toBe(false);
	});

	it('refuses a missing claim and inherited keys', () => {
		expect(hasRole({}, ZITADEL, 'admin')).toBe(false);
		expect(hasRole({ [ZITADEL]: null }, ZITADEL, 'admin')).toBe(false);
		expect(hasRole({ [ZITADEL]: {} }, ZITADEL, 'toString')).toBe(false);
	});
});

describe('canActAs', () => {
	it('allows only users at the domain', () => {
		expect(canActAs('demo.aino.virtanen@example.com', 'example.com')).toBe(true);
		expect(canActAs('Demo@Example.com', 'example.com')).toBe(true);
		expect(canActAs('someone@notexample.com', 'example.com')).toBe(false);
		expect(canActAs('someone@example.com.evil.fi', 'example.com')).toBe(false);
	});
});
