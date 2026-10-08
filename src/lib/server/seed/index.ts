// Starting content for an empty database: the first admin and a welcome note, and with SEED_DEMO
// the demo dataset (demo.ts). Not a domain module: it only calls other modules through their
// index.ts. Safe on every start, because a database with any users or notes is never touched.

import { randomBytes } from 'node:crypto';
import { countUsers, createUser } from '$lib/server/modules/identity';
import { MAX_BODY_LENGTH, countNotes, createNote } from '$lib/server/modules/notes';
import { demoDataset } from './demo';

export interface SeedOptions {
	/** The first admin, from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. */
	admin: { email?: string; password?: string };
	/** The demo dataset (SEED_DEMO), with the demo users' password (SEED_DEMO_PASSWORD); null for none. */
	demo: { password?: string } | null;
}

export async function seedDatabase({ admin, demo }: SeedOptions): Promise<void> {
	if ((await countUsers()) || (await countNotes())) {
		console.log('Seed: the database has data, skipped.');
		return;
	}
	const added: string[] = [];

	if (admin.email && admin.password) {
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
		added.push(`admin ${user.email} and a welcome note`);
	}

	if (demo) {
		const data = demoDataset({ maxBodyLength: MAX_BODY_LENGTH });
		// Without SEED_DEMO_PASSWORD each demo user gets a random password, so nobody can sign in as one.
		const password = () => demo.password || randomBytes(24).toString('base64url');
		const ids: string[] = [];
		for (const user of data.users)
			ids.push((await createUser({ ...user, password: password() })).id);
		for (const note of data.notes) {
			const result = await createNote({ authorId: ids[note.author], body: note.body });
			if (!result.ok) throw new Error(`Seed: a demo note was refused: ${result.error}`);
		}
		added.push(`demo dataset (${data.users.length} users, ${data.notes.length} notes)`);
	}

	console.log(
		added.length
			? `Seed: ${added.join(', ')} added.`
			: 'Seed: neither SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD nor SEED_DEMO set, nothing added.'
	);
}
