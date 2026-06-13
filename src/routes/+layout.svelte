<script lang="ts">
	import '../app.css';
	import AlertToast from '$lib/components/AlertToast.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔔</text></svg>" />
</svelte:head>

<AlertToast />

{@render children()}
