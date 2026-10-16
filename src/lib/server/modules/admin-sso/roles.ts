// The admin check: does the role claim contain the admin role? Providers shape the claim
// differently, so all common forms count:
// - Zitadel: an object keyed by role, { "admin": { "<orgId>": "<org domain>" } }
// - an array of role names, ["admin", "user"]
// - one name, or several separated by spaces, "admin user"

export function hasRole(claims: Record<string, unknown>, claim: string, role: string): boolean {
	const value = claims[claim];
	if (typeof value === 'string') return value.split(/\s+/).includes(role);
	if (Array.isArray(value)) return value.includes(role);
	if (value && typeof value === 'object') return Object.hasOwn(value, role);
	return false;
}

/** Whether an admin may act as this user: only users at the configured domain (demo users). */
export function canActAs(email: string, domain: string): boolean {
	return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}
