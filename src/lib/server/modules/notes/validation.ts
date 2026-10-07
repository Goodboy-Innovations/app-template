// Input rules for notes. No database here, so they are unit-tested on their own.

export const MAX_BODY_LENGTH = 2000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function checkBody(input: string): Checked<string> {
	const body = input.trim();
	if (!body) return { ok: false, error: 'Write something first' };
	if (body.length > MAX_BODY_LENGTH) {
		return { ok: false, error: `Keep it under ${MAX_BODY_LENGTH} characters` };
	}
	return { ok: true, value: body };
}

/** A file name safe to show and to send back in a download header. */
export function cleanFileName(name: string): string {
	const base = name.split(/[/\\]/).pop() ?? '';
	// eslint-disable-next-line no-control-regex
	const clean = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
	return clean.slice(0, 200) || 'file';
}
