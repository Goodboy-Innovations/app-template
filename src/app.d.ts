// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionUser } from '$lib/server/modules/identity';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
		}
	}
}

export {};
