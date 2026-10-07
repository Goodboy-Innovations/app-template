import type { RequestHandler } from './$types';

// Also the health check: it needs no database, so it shows whether the server itself is up.
export const GET: RequestHandler = () =>
	new Response(
		['User-agent: *', 'Disallow: /login', 'Disallow: /account', 'Disallow: /notes', ''].join('\n'),
		{ headers: { 'content-type': 'text/plain; charset=utf-8' } }
	);
