// Starting content for an empty database: the first admin and a welcome note. Not a domain
// module: it only calls other modules through their index.ts. Safe on every start, because a
// database with any users or notes is never touched.

import { countUsers, createUser } from '$lib/server/modules/identity';
import { countNotes, createNote } from '$lib/server/modules/notes';

export interface SeedOptions {
	/** The first admin, from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. */
	admin: { email?: string; password?: string };
}

export async function seedDatabase({ admin }: SeedOptions): Promise<void> {
	if ((await countUsers()) || (await countNotes())) {
		console.log('Seed: the database has data, skipped.');
		return;
	}
	if (!admin.email || !admin.password) {
		console.log('Seed: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set, nothing added.');
		return;
	}
	const user = await createUser({
		email: admin.email,
		password: admin.password,
		name: 'Admin',
		role: 'admin'
	});
	await createNote({
		authorId: user.id,
		body: 'Welcome! This note comes from seeding. Replace the notes module with your own.'
	});
	console.log(`Seed: admin ${user.email} and a welcome note added.`);
}
