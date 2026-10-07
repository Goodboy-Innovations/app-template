import { and, count, desc, eq } from 'drizzle-orm';
import { db, isUuid, objectStore } from '$lib/server/platform';
import { getUserNames } from '../identity';
import { notes } from './schema';
import { MAX_FILE_BYTES, checkBody, cleanFileName } from './validation';

export interface Note {
	id: string;
	authorId: string;
	authorName: string;
	body: string;
	file: { name: string; size: number } | null;
	createdAt: Date;
}

/** Whether notes can carry a file: only with a bucket configured. */
export const filesEnabled = () => objectStore() !== null;

export async function listNotes(): Promise<Note[]> {
	const rows = await db.select().from(notes).orderBy(desc(notes.createdAt));
	// Other modules are used only through their index.ts.
	const names = await getUserNames(rows.map((row) => row.authorId));
	return rows.map((row) => ({
		id: row.id,
		authorId: row.authorId,
		authorName: names.get(row.authorId) ?? 'Deleted user',
		body: row.body,
		file: row.fileKey ? { name: row.fileName ?? 'file', size: row.fileSize ?? 0 } : null,
		createdAt: row.createdAt
	}));
}

export async function countNotes(): Promise<number> {
	const [row] = await db.select({ n: count() }).from(notes);
	return row.n;
}

export type CreateNoteResult = { ok: true; id: string } | { ok: false; error: string };

export async function createNote(input: {
	authorId: string;
	body: string;
	file?: { name: string; bytes: Uint8Array } | null;
}): Promise<CreateNoteResult> {
	const body = checkBody(input.body);
	if (!body.ok) return body;

	const id = crypto.randomUUID();
	let file = null;
	if (input.file && input.file.bytes.byteLength > 0) {
		const store = objectStore();
		if (!store) return { ok: false, error: 'Files are turned off' };
		if (input.file.bytes.byteLength > MAX_FILE_BYTES) {
			return { ok: false, error: `Files can be at most ${MAX_FILE_BYTES / 1024 / 1024} MB` };
		}
		// The object first, then the row: a row never points to a missing object.
		const key = store.key(`notes/${id}`);
		await store.put(key, input.file.bytes, 'application/octet-stream');
		file = { key, name: cleanFileName(input.file.name), size: input.file.bytes.byteLength };
	}

	await db.insert(notes).values({
		id,
		authorId: input.authorId,
		body: body.value,
		fileKey: file?.key ?? null,
		fileName: file?.name ?? null,
		fileSize: file?.size ?? null
	});
	return { ok: true, id };
}

/** Deletes a note, if `userId` wrote it, and then its file. Returns whether it was deleted. */
export async function deleteNote(id: string, userId: string): Promise<boolean> {
	if (!isUuid(id)) return false;
	const [row] = await db
		.delete(notes)
		.where(and(eq(notes.id, id), eq(notes.authorId, userId)))
		.returning({ fileKey: notes.fileKey });
	if (!row) return false;
	// Keys outside this deployment's S3_PREFIX (e.g. in a copy of another database) are left alone.
	if (row.fileKey) await objectStore()?.delete(row.fileKey);
	return true;
}

export async function getNoteFile(
	id: string
): Promise<{ name: string; size: number; body: ReadableStream<Uint8Array> } | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({ key: notes.fileKey, name: notes.fileName, size: notes.fileSize })
		.from(notes)
		.where(eq(notes.id, id));
	const store = objectStore();
	if (!row?.key || !store) return null;
	const body = await store.get(row.key);
	return body && { name: row.name ?? 'file', size: row.size ?? 0, body };
}
