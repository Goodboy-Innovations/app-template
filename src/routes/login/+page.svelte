<script lang="ts">
	import { page } from '$app/state';

	let { data, form } = $props();
	const next = $derived(page.url.searchParams.get('next'));
</script>

<svelte:head>
	<title>Sign in</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="card">
	<h1>Sign in</h1>
	{#if form?.error}<p class="notice warn" role="alert">{form.error}</p>{/if}

	<form method="POST" action={next ? `?next=${encodeURIComponent(next)}` : undefined}>
		<div class="field">
			<label for="email">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="username"
				required
				value={form?.email ?? ''}
			/>
		</div>
		<div class="field">
			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>
		<button type="submit">Sign in</button>
	</form>
	{#if data.adminSso}
		<p class="admin-sso">
			<a href="/auth/oidc/start" data-sveltekit-reload
				>Sign in as admin with {data.adminSso.providerName}</a
			>
		</p>
	{/if}
</div>

<style>
	.admin-sso {
		margin: 16px 0 0;
		padding-top: 12px;
		border-top: 1px solid var(--border);
		font-size: 0.95rem;
	}
</style>
