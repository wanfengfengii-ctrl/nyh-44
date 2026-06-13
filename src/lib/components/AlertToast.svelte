<script lang="ts">
	import { alerts, type Alert } from '$lib/stores/alertsStore';

	function getColorClass(type: Alert['type']): string {
		switch (type) {
			case 'error':
				return 'bg-red-500/90 border-red-400/30';
			case 'warning':
				return 'bg-lighthouse-glow/90 border-lighthouse-glow/30';
			case 'info':
				return 'bg-ocean-surface/90 border-ocean-surface/30';
			case 'success':
				return 'bg-emerald-500/90 border-emerald-400/30';
		}
	}

	function getIcon(type: Alert['type']): string {
		switch (type) {
			case 'error':
				return '✕';
			case 'warning':
				return '⚠';
			case 'info':
				return 'ℹ';
			case 'success':
				return '✓';
		}
	}
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
	{#each $alerts as alert (alert.id)}
		<div
			class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg shadow-black/30 text-white border backdrop-blur-sm {getColorClass(alert.type)} animate-[slideIn_0.3s_ease-out]"
		>
			<span class="text-lg font-bold font-display">{getIcon(alert.type)}</span>
			<span class="flex-1 text-sm font-body">{alert.message}</span>
			<button
				onclick={() => alerts.removeAlert(alert.id)}
				class="hover:opacity-70 transition-opacity text-lg font-body"
			>
				×
			</button>
		</div>
	{/each}
</div>

<style>
	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
</style>
