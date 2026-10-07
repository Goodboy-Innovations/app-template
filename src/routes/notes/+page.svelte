<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const formatSize = (bytes: number) =>
		bytes < 1024 * 1024
			? `${Math.ceil(bytes / 1024)} kB`
			: `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	// The same text on the server and in the browser, whatever their time zones.
	const formatTime = (date: Date) => `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
</script>

<svelte:head><title>Notes</title></svelte:head>

<h1>Notes</h1>

<form class="card" method="POST" action="?/create" enctype="multipart/form-data" use:enhance>
	{#if form?.error}<p class="notice warn" role="alert">{form.error}</p>{/if}
	<div class="field">
		<label for="body">New note</label>
		<textarea id="body" name="body" rows="3" maxlength={data.maxLength} required
			>{form?.body ?? ''}</textarea
		>
	</div>
	{#if data.filesEnabled}
		<div class="field">
			<label for="file">File (optional)</label>
			<input id="file" name="file" type="file" />
		</div>
	{/if}
	<button type="submit">Add note</button>
</form>

{#each data.notes as note (note.id)}
	<article class="card note">
		<p class="body">{note.body}</p>
		{#if note.file}
			<p><a href="/notes/{note.id}/file">{note.file.name}</a> ({formatSize(note.file.size)})</p>
		{/if}
		<footer class="muted">
			<span>
				{note.authorName} ·
				<time datetime={note.createdAt.toISOString()}>{formatTime(note.createdAt)}</time>
			</span>
			{#if note.mine}
				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="id" value={note.id} />
					<button class="link">Delete</button>
				</form>
			{/if}
		</footer>
	</article>
{:else}
	<p class="muted">No notes yet.</p>
{/each}

<style>
	form.card,
	.note {
		margin-bottom: 16px;
	}
	.body {
		margin-top: 0;
		white-space: pre-wrap;
	}
	footer {
		display: flex;
		gap: 12px;
		font-size: 0.9rem;
	}
</style>
