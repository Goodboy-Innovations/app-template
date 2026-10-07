// Slows down password guessing: per email, a few failed attempts, then a cool-down. In memory, so
// per server process; good enough for one container, not a replacement for a rate-limiting proxy.

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

export function createThrottle(now = () => Date.now()) {
	const failures = new Map<string, { count: number; until: number }>();

	return {
		isLocked(email: string): boolean {
			const record = failures.get(email);
			return !!record && record.count >= MAX_ATTEMPTS && record.until > now();
		},
		recordFailure(email: string) {
			if (failures.size > 1000) {
				for (const [key, r] of failures) if (r.until <= now()) failures.delete(key);
			}
			const record = failures.get(email);
			const count = record && record.until > now() ? record.count + 1 : 1;
			failures.set(email, { count, until: now() + LOCK_MS });
		},
		clear(email: string) {
			failures.delete(email);
		}
	};
}
