import { describe, expect, it } from 'vitest';
import { MAX_BODY_LENGTH, checkBody } from '$lib/server/modules/notes/validation';
import { demoDataset } from './demo';

describe('demoDataset', () => {
	const data = demoDataset({ maxBodyLength: MAX_BODY_LENGTH });

	it('is the same on every run', () => {
		expect(demoDataset({ maxBodyLength: MAX_BODY_LENGTH })).toEqual(data);
	});

	it('has unique, plain emails and one extra admin', () => {
		const emails = data.users.map((u) => u.email);
		expect(new Set(emails).size).toBe(emails.length);
		for (const email of emails) expect(email).toMatch(/^demo\.[a-z]+\.[a-z]+@example\.com$/);
		expect(data.users.filter((u) => u.role === 'admin')).toHaveLength(1);
	});

	it('has only notes the notes module accepts, including one of the maximum length', () => {
		for (const note of data.notes) {
			expect(checkBody(note.body).ok).toBe(true);
			expect(data.users[note.author]).toBeDefined();
		}
		expect(data.notes.some((n) => n.body.length === MAX_BODY_LENGTH)).toBe(true);
	});

	it('leaves some users without notes, for empty states', () => {
		const authors = new Set(data.notes.map((n) => n.author));
		expect(authors.size).toBeLessThan(data.users.length);
	});
});
