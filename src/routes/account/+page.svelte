<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Account</title></svelte:head>

<h1>Account</h1>
<p class="muted">Signed in as {data.email}.</p>

<div class="card">
	<h2>Change password</h2>
	{#if form?.error}<p class="notice warn" role="alert">{form.error}</p>{/if}
	{#if form?.message}<p class="notice" role="status">{form.message}</p>{/if}

	<form method="POST" action="?/password">
		<div class="field">
			<label for="current">Current password</label>
			<input id="current" name="current" type="password" autocomplete="current-password" required />
		</div>
		<div class="field">
			<label for="next">New password</label>
			<input
				id="next"
				name="next"
				type="password"
				autocomplete="new-password"
				minlength={data.minPassword}
				required
			/>
		</div>
		<div class="field">
			<label for="confirm">New password again</label>
			<input
				id="confirm"
				name="confirm"
				type="password"
				autocomplete="new-password"
				minlength={data.minPassword}
				required
			/>
		</div>
		<button type="submit">Change password</button>
	</form>
</div>
