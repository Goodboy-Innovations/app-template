import { redirect } from '@sveltejs/kit';
import { signOut } from '$lib/server/modules/identity';
import { applyAuthCookies } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, request }) => {
	applyAuthCookies(cookies, await signOut(request.headers));
	redirect(303, '/');
};
