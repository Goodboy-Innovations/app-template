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
