import { describe, expect, it } from 'vitest';
import { createThrottle } from './throttle';

describe('createThrottle', () => {
	it('locks an email after five failures, for five minutes', () => {
		let time = 0;
		const throttle = createThrottle(() => time);
		for (let i = 0; i < 4; i++) throttle.recordFailure('a@example.com');
		expect(throttle.isLocked('a@example.com')).toBe(false);

		throttle.recordFailure('a@example.com');
		expect(throttle.isLocked('a@example.com')).toBe(true);
		expect(throttle.isLocked('b@example.com')).toBe(false);

		time += 5 * 60 * 1000;
		expect(throttle.isLocked('a@example.com')).toBe(false);
	});

	it('forgets failures after a successful sign-in', () => {
		const throttle = createThrottle(() => 0);
		for (let i = 0; i < 5; i++) throttle.recordFailure('a@example.com');
		throttle.clear('a@example.com');
		expect(throttle.isLocked('a@example.com')).toBe(false);
	});
});
