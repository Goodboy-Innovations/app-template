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

{#if data.actingAdmin && data.user}
	<div class="acting" role="status">
		<span>Acting as <strong>{data.user.name}</strong> (you are {data.actingAdmin})</span>
		<form method="POST" action="/admin?/exit">
			<button class="link">Exit</button>
		</form>
	</div>
{/if}

<header>
	<a class="brand" href="/">{APP_NAME}</a>
	<nav aria-label="Main">
		{#if data.user}
			<a href="/notes">Notes</a>
			{#if data.adminTools}<a href="/admin">Act as a user</a>{/if}
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
	.acting {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 8px 16px;
		background: var(--warn-soft);
		color: var(--warn);
		border-bottom: 1px solid var(--warn);
	}
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
