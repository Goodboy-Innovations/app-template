import { fail } from '@sveltejs/kit';
import {
	MAX_BODY_LENGTH,
	createNote,
	deleteNote,
	filesEnabled,
	listNotes
} from '$lib/server/modules/notes';
import { requireUser } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals, url);
	const notes = await listNotes();
	return {
		notes: notes.map((note) => ({ ...note, mine: note.authorId === user.id })),
		filesEnabled: filesEnabled(),
		maxLength: MAX_BODY_LENGTH
	};
};

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		const user = requireUser(locals, url, request.method);
		const data = await request.formData();
		const body = String(data.get('body') ?? '');
		const file = data.get('file');
		const result = await createNote({
			authorId: user.id,
			body,
			file:
				file instanceof File && file.size > 0
					? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
					: null
		});
		if (!result.ok) return fail(400, { body, error: result.error });
	},
	delete: async ({ request, locals, url }) => {
		const user = requireUser(locals, url, request.method);
		const id = String((await request.formData()).get('id') ?? '');
		if (!(await deleteNote(id, user.id))) return fail(404, { error: 'Note not found' });
	}
};
