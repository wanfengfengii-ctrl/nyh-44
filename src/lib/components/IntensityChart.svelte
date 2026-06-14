<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import { propagationSector, temporalPropagationSector, getIntensityColor } from '$lib/stores/propagationStore';
	import { weather } from '$lib/stores/weatherStore';
	import { soundSources } from '$lib/stores/pointsStore';
	import { temporal } from '$lib/stores/tidalStore';

	Chart.register(...registerables);

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let chart = $state<Chart | null>(null);

	const { temporalMode: temporalModeStore } = temporal;
	let temporalMode = $derived($temporalModeStore);

	function toggleMode() {
		temporalModeStore.set(!$temporalModeStore);
	}

	let effectiveSector = $derived(
		temporalMode ? $temporalPropagationSector : $propagationSector
	);

	$effect(() => {
		if (!chart) return;
		updateChart();
	});

	function updateChart() {
		if (!chart) return;

		const sector = effectiveSector;
		const labels = sector.map((s) => `${s.angle.toFixed(0)}°`);
		const data = sector.map((s) => s.intensity);

		chart.data.labels = labels;
		chart.data.datasets[0].data = data;

		const backgroundColors = sector.map((s) => {
			const color = getIntensityColor(s.intensity);
			return color + '60';
		});
		const borderColors = sector.map((s) => getIntensityColor(s.intensity));

		(chart.data.datasets[0] as any).backgroundColor = backgroundColors;
		(chart.data.datasets[0] as any).borderColor = borderColors;

		chart.update('none');
	}

	onMount(() => {
		const canvasEl = canvas;
		if (!canvasEl) return;

		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		chart = new Chart(ctx, {
			type: 'polarArea',
			data: {
				labels: [],
				datasets: [
					{
						label: '强度 (%)',
						data: [],
						backgroundColor: [],
						borderColor: [],
						borderWidth: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				animation: false,
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						backgroundColor: 'rgba(10,36,99,0.9)',
						titleColor: '#FFD700',
						bodyColor: '#8D99AE',
						borderColor: 'rgba(255,215,0,0.3)',
						borderWidth: 1,
						callbacks: {
							label: function (context: any) {
								const index = context.dataIndex;
								const sector = effectiveSector[index];
								if (sector) {
									return [
										`角度: ${sector.angle.toFixed(0)}°`,
										`强度: ${sector.intensity.toFixed(1)}%`,
										`距离: ${sector.maxDistance.toFixed(0)}px`
									];
								}
								return '';
							}
						}
					}
				},
				scales: {
					r: {
						beginAtZero: true,
						max: 100,
						ticks: {
							stepSize: 20,
							color: 'rgba(141,153,174,0.6)',
							backdropColor: 'transparent',
							font: { size: 9 }
						},
						pointLabels: {
							color: 'rgba(141,153,174,0.6)',
							font: { size: 8 },
							display: true
						},
						grid: {
							color: 'rgba(141,153,174,0.15)'
						},
						angleLines: {
							color: 'rgba(141,153,174,0.15)'
						}
					}
				}
			}
		});

		updateChart();

		return () => {
			if (chart) {
				chart.destroy();
				chart = null;
			}
		};
	});
</script>

{#if $soundSources.length > 0}
	<div class="flex items-center justify-between mb-2">
		<span class="text-xs text-white/40 font-body">
			传播方向强度分布 {temporalMode ? '(时变)' : ''}
		</span>
		<button
			onclick={() => toggleMode()}
			class="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] transition-all {
				temporalMode
					? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
					: 'border-white/10 bg-white/5 text-white/40 hover:text-white/60'
			}"
			title={temporalMode ? '切换为静态模式' : '切换为时变模式'}
		>
			🌀 {temporalMode ? '时变' : '静态'}
		</button>
	</div>
	<div class="relative">
		<canvas bind:this={canvas}></canvas>
	</div>
	<div class="mt-3 flex items-center justify-between text-xs text-white/40 font-body">
		<span>风向: <span class="text-accent">{$weather.windDirection}°</span></span>
		<span>风速: <span class="text-accent">{$weather.windSpeed.toFixed(1)} m/s</span></span>
	</div>
{:else}
	<div class="py-12 text-center text-sm text-white/30 font-body">
		请先在画布上放置灯塔或雾号
	</div>
{/if}
