// The client's address, as SvelteKit sees it. With ADDRESS_HEADER set (behind a proxy),
// adapter-node's getClientAddress() throws when a request lacks that header, which is what a
// container health check from 127.0.0.1 looks like. Such requests get no address, not a 500.

/** The client address, or null when it can't be known for this request. */
export function clientAddress(event: { getClientAddress(): string }): string | null {
	try {
		return event.getClientAddress() || null;
	} catch {
		return null;
	}
}
