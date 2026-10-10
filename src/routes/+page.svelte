<script lang="ts">
	import { APP_NAME } from '$lib/app';

	let { data } = $props();
</script>

<h1>{APP_NAME}</h1>
<p>A SvelteKit app with Postgres, its own sign-in and an example module. Replace this page.</p>

{#if data.user}
	<p><a href="/notes">Open the notes</a></p>
{:else}
	<p><a href="/login">Sign in</a> to see the notes.</p>
{/if}

<article class="readme" aria-label="README">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- the readme module renders Markdown without raw HTML -->
	{@html data.readme}
</article>

<style>
	.readme {
		margin-top: 32px;
		padding: 8px 24px 16px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow-wrap: anywhere;
	}
	.readme :global(table) {
		display: block;
		overflow-x: auto;
		border-collapse: collapse;
	}
	.readme :global(th),
	.readme :global(td) {
		padding: 6px 10px;
		border: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}
	.readme :global(pre) {
		overflow-x: auto;
		padding: 12px;
		background: var(--bg);
		border-radius: 6px;
	}
	.readme :global(code) {
		font-size: 0.9em;
	}
</style>
