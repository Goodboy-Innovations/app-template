// Uploaded files: an S3-compatible bucket, private, shared with other deployments of the app
// (e.g. staging and previews) that each have their own S3_PREFIX.
//
// - New objects go under the app's own prefix: `store.key('notes/<id>')`.
// - Rows store the full key, prefix included, so a copy of another deployment's database still
//   reads that deployment's files.
// - Deleting only touches keys under the app's own prefix; other keys belong to another deployment.

import { AwsClient } from 'aws4fetch';
import { config } from './config';

export interface ObjectStore {
	/** The app's own key prefix: empty, or ending in "/". */
	readonly prefix: string;
	/** The full key for a path under the app's prefix. */
	key(path: string): string;
	put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
	/** The object's bytes, or null if it doesn't exist. */
	get(key: string): Promise<ReadableStream<Uint8Array> | null>;
	/** Deletes the object if its key is under the app's prefix. Returns whether it tried. */
	delete(key: string): Promise<boolean>;
}

export interface S3Options {
	/** Base URL, e.g. https://s3.example.com */
	endpoint: string;
	bucket: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	/** Empty, or ending in "/". */
	prefix: string;
}

/** Path-style requests (`{endpoint}/{bucket}/{key}`), signed with AWS Signature V4. */
export function createS3Store(options: S3Options): ObjectStore {
	const client = new AwsClient({
		accessKeyId: options.accessKeyId,
		secretAccessKey: options.secretAccessKey,
		service: 's3',
		region: options.region
	});
	const base = `${options.endpoint}/${encodeURIComponent(options.bucket)}`;
	const url = (key: string) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;

	async function failed(res: Response, action: string, key: string): Promise<never> {
		const detail = (await res.text().catch(() => '')).slice(0, 300);
		throw new Error(`S3 ${action} ${key} failed: HTTP ${res.status} ${detail}`);
	}

	return {
		prefix: options.prefix,
		key: (path) => `${options.prefix}${path}`,
		async put(key, bytes, contentType) {
			const res = await client.fetch(url(key), {
				method: 'PUT',
				// Node accepts any Uint8Array; the DOM typings want one over a plain ArrayBuffer.
				body: bytes as Uint8Array<ArrayBuffer>,
				headers: { 'content-type': contentType }
			});
			if (!res.ok) await failed(res, 'PUT', key);
		},
		async get(key) {
			const res = await client.fetch(url(key));
			if (res.status === 404) return null;
			if (!res.ok || !res.body) return failed(res, 'GET', key);
			return res.body;
		},
		async delete(key) {
			if (!key.startsWith(options.prefix)) return false;
			const res = await client.fetch(url(key), { method: 'DELETE' });
			if (!res.ok && res.status !== 404) await failed(res, 'DELETE', key);
			return true;
		}
	};
}

let store: ObjectStore | null | undefined;

/** The configured bucket, or null when uploads are off (no S3_* variables). */
export function objectStore(): ObjectStore | null {
	if (store === undefined) {
		const s3 = config.s3;
		store = s3 ? createS3Store(s3) : null;
	}
	return store;
}
