<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status === 404 ? 'Not found' : 'Error'}</title></svelte:head>

<h1>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
<p class="muted">
	{page.status === 404
		? 'The page does not exist or has moved.'
		: (page.error?.message ?? 'Try again in a moment.')}
</p>
<p><a href="/">Home</a></p>
