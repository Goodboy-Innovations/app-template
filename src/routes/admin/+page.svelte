<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Act as a user</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<h1>Act as a user</h1>
<p>
	You are signed in as an admin with Cloudgood ID. Pick a demo user to see the app as they do. Every
	switch is logged.
</p>
{#if form?.error}<p class="notice warn" role="alert">{form.error}</p>{/if}

{#if data.users.length}
	<ul class="users">
		{#each data.users as user (user.id)}
			<li>
				<span>
					<strong>{user.name}</strong>
					<span class="muted">{user.email}{user.role === 'admin' ? ' · admin' : ''}</span>
				</span>
				{#if user.id === data.actingAs}
					<span class="muted">acting now</span>
				{:else}
					<form method="POST" action="?/act">
						<input type="hidden" name="user" value={user.id} />
						<button type="submit">Act as</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">No demo users. Seed them with SEED_DEMO=1.</p>
{/if}

<style>
	.users {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.users li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
	}
	.users span span {
		display: block;
		font-size: 0.9em;
	}
</style>
