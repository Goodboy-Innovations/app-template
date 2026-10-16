import { describe, expect, it } from 'vitest';
import { clientAddress } from './client-address';

describe('clientAddress', () => {
	it('is the address SvelteKit gives', () => {
		expect(clientAddress({ getClientAddress: () => '203.0.113.7' })).toBe('203.0.113.7');
	});

	it('is null when ADDRESS_HEADER is set but the request lacks it, instead of failing', () => {
		// What adapter-node does for a health check from 127.0.0.1 without X-Forwarded-For.
		const event = {
			getClientAddress(): string {
				throw new Error(
					'Address header was specified with ADDRESS_HEADER=x-forwarded-for but is absent from request'
				);
			}
		};
		expect(clientAddress(event)).toBeNull();
	});
});
