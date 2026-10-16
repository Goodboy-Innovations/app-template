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
	{#if data.adminSsoFailed}
		<p class="notice warn" role="alert">
			Admin sign-in didn't work: the account has no admin role for this app, or the sign-in was
			cancelled.
		</p>
	{/if}

	<form method="POST" action={`?/password${next ? `&next=${encodeURIComponent(next)}` : ''}`}>
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
		<form method="POST" action="?/admin" class="admin-sso">
			<button type="submit" class="link">Sign in as admin with {data.adminSso.providerName}</button>
		</form>
	{/if}
</div>

<style>
	.admin-sso {
		margin: 16px 0 0;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
</style>
