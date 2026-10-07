import { afterEach, describe, expect, it, vi } from 'vitest';
import { createS3Store } from './storage';

const store = createS3Store({
	endpoint: 'https://s3.example.com',
	bucket: 'app-files',
	region: 'eu-central',
	accessKeyId: 'AKIDEXAMPLE',
	secretAccessKey: 'secret',
	prefix: 'staging/'
});

function stubFetch(response: () => Response) {
	const fetch = vi.fn<(req: Request) => Promise<Response>>(async () => response());
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('createS3Store', () => {
	it('puts new objects under the prefix, path-style, with a SigV4 signature', async () => {
		const fetch = stubFetch(() => new Response(null, { status: 200 }));
		const key = store.key('notes/abc');
		expect(key).toBe('staging/notes/abc');
		await store.put(key, new Uint8Array([1, 2, 3]), 'text/plain');

		const req = fetch.mock.calls[0][0];
		expect(req.method).toBe('PUT');
		expect(req.url).toBe('https://s3.example.com/app-files/staging/notes/abc');
		expect(req.headers.get('content-type')).toBe('text/plain');
		expect(req.headers.get('authorization')).toMatch(
			/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/eu-central\/s3\/aws4_request/
		);
	});

	it('reads any key, so a copied database still reads its files', async () => {
		stubFetch(() => new Response('<Error/>', { status: 404 }));
		expect(await store.get('staging/notes/missing')).toBeNull();

		stubFetch(() => new Response(new Uint8Array([9, 8])));
		const body = await store.get('production/notes/abc');
		expect(new Uint8Array(await new Response(body).arrayBuffer())).toEqual(new Uint8Array([9, 8]));
	});

	it('deletes only keys under its own prefix', async () => {
		const fetch = stubFetch(() => new Response(null, { status: 204 }));
		expect(await store.delete('production/notes/abc')).toBe(false);
		expect(fetch).not.toHaveBeenCalled();

		expect(await store.delete('staging/notes/abc')).toBe(true);
		expect(fetch.mock.calls[0][0].method).toBe('DELETE');

		stubFetch(() => new Response(null, { status: 404 }));
		await expect(store.delete('staging/notes/gone')).resolves.toBe(true);
	});

	it('throws on errors with the status and response', async () => {
		stubFetch(() => new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 }));
		await expect(store.put('staging/x', new Uint8Array([1]), 'text/plain')).rejects.toThrow(
			/HTTP 403.*AccessDenied/
		);
	});
});
