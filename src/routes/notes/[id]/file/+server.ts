import { error } from '@sveltejs/kit';
import { getNoteFile } from '$lib/server/modules/notes';
import type { RequestHandler } from './$types';

// Always a download: never rendered on the app's own address, whatever the file contains.
export const GET: RequestHandler = async ({ params }) => {
	const file = await getNoteFile(params.id);
	if (!file) error(404, 'File not found');
	return new Response(file.body, {
		headers: {
			'content-type': 'application/octet-stream',
			'content-length': String(file.size),
			'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
			'content-security-policy': "default-src 'none'"
		}
	});
};
