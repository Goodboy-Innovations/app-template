// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AdminSession } from '$lib/server/modules/admin-sso';
import type { SessionUser } from '$lib/server/modules/identity';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			/** An admin signed in with OIDC (admin-sso); null when not, or when the module is off. */
			admin: AdminSession | null;
		}
	}
}

export {};
