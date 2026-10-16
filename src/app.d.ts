// See https://svelte.dev/docs/kit/types#app.d.ts
import type { ActingAdmin, AdminSession } from '$lib/server/modules/admin-sso';
import type { SessionUser } from '$lib/server/modules/identity';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			/** An admin signed in with OIDC (admin-sso); null when not, or when the module is off. */
			admin: AdminSession | null;
			/**
			 * While an admin acts as `user`: who the admin is. Record it with any write the app logs or
			 * audits, so the record says "admin X acting as Y", not only Y. Null otherwise.
			 */
			actingAdmin: ActingAdmin | null;
		}
	}
}

export {};
