// See https://svelte.dev/docs/kit/types#app.d.ts
import type { ActingAdmin } from '$lib/server/modules/admin-sso';
import type { SessionUser } from '$lib/server/modules/identity';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			/**
			 * While an admin acts as `user` (admin-sso): who the admin is, by the provider's `sub` and
			 * email. Record it with any write the app logs or audits, so the record says "admin X
			 * acting as Y", not only Y. Null otherwise.
			 */
			actingAdmin: ActingAdmin | null;
		}
	}
}

export {};
