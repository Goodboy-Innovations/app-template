<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { APP_NAME } from '$lib/app';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{APP_NAME}</title>
</svelte:head>

<header>
	<a class="brand" href="/">{APP_NAME}</a>
	<nav aria-label="Main">
		{#if data.user}
			<a href="/notes">Notes</a>
			<a href="/account">{data.user.name}</a>
			<form method="POST" action="/logout">
				<button class="link">Sign out</button>
			</form>
		{:else}
			<a href="/login">Sign in</a>
		{/if}
	</nav>
</header>

<main class="page">
	{@render children()}
</main>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 16px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.brand {
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	form {
		display: contents;
	}
</style>
