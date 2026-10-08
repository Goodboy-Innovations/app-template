// The demo dataset for staging and previews (SEED_DEMO=1): users and content that look like real
// use, with the edge cases a UI has to handle. Generated from a fixed seed, so every run gives the
// same data. No database here, so it is unit-tested on its own. When a module gets new tables or
// new rules, extend this in the same pull request: CI seeds a fresh database on every PR.

export interface DemoUser {
	email: string;
	name: string;
	role: 'admin' | 'user';
}

export interface DemoNote {
	/** Index into `users`. */
	author: number;
	body: string;
}

export interface DemoDataset {
	users: DemoUser[];
	notes: DemoNote[];
}

const FIRST = [
	'Aino',
	'Mikko',
	'Sofia',
	'Jüri',
	'Leila',
	'Tomás',
	'Hanna',
	'Kwame',
	'Élodie',
	'Ravi'
];
const LAST = ['Virtanen', 'Korhonen', 'Nieminen', 'García', 'Øster', 'Mäkinen', 'Okafor', 'Lind'];

const OPENINGS = [
	'Reminder:',
	'Idea for next week:',
	'Notes from the call:',
	'Quick one:',
	'Follow-up:',
	'To check:'
];
const TOPICS = [
	'the spring catalogue needs new photos',
	'invoice 2041 is still open',
	'move the team meeting to Thursday',
	'ask the printer about paper stock',
	'the website footer has an old phone number',
	'order more coffee for the office',
	'review the onboarding checklist',
	'the client wants a second draft by Friday'
];
const CLOSINGS = ['', '', ' Thanks!', ' Let me know.', ' (low priority)', ' — done by Monday?'];

/** Notes that test how the UI copes, rather than how it looks with typical text. */
function edgeCaseNotes(maxBodyLength: number): string[] {
	const sentence = 'This note is exactly as long as a note can be. ';
	return [
		sentence.repeat(Math.ceil(maxBodyLength / sentence.length)).slice(0, maxBodyLength),
		'.',
		'First line\n\nThird line, after an empty one\n   indented line',
		'Emoji 🎉🚀 and scripts: Ääkköset, Здравствуйте, こんにちは, مرحبا بالعالم',
		'<script>alert("not escaped")</script> & <b>not bold</b>',
		`A-very-long-word-without-spaces-${'x'.repeat(120)}`,
		'A link: https://example.com/a/very/long/path?with=query&and=more#fragment'
	];
}

/** Mulberry32: a small seeded random number generator, so the dataset is the same every run. */
function random(seed: number): () => number {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const ascii = (text: string) =>
	text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').toLowerCase();

export function demoDataset({ maxBodyLength }: { maxBodyLength: number }): DemoDataset {
	const next = random(20261008);
	const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];

	const users: DemoUser[] = [];
	const emails = new Set<string>();
	while (users.length < 12) {
		const name = `${pick(FIRST)} ${pick(LAST)}`;
		const email = `demo.${ascii(name).replace(' ', '.')}@example.com`;
		if (emails.has(email)) continue;
		emails.add(email);
		// One more admin besides SEED_ADMIN_*, so admin views have someone else to show.
		users.push({ email, name, role: users.length === 0 ? 'admin' : 'user' });
	}

	const notes: DemoNote[] = [];
	// Skewed on purpose: a few users write most notes, and the last two write none (empty states).
	const writers = users.length - 2;
	for (let i = 0; i < 60; i++) {
		const author = Math.floor(next() ** 2 * writers);
		notes.push({ author, body: `${pick(OPENINGS)} ${pick(TOPICS)}.${pick(CLOSINGS)}` });
	}
	edgeCaseNotes(maxBodyLength).forEach((body, i) => notes.push({ author: i % writers, body }));

	return { users, notes };
}
