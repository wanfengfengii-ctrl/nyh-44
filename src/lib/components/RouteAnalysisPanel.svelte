<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import { activeRouteAnalysis, temporalActiveRouteAnalysis, totalRiskCount, temporalTotalRiskCount, allRiskPeaks } from '$lib/stores/propagationStore';
	import { activeRoute, activeRouteId } from '$lib/stores/routesStore';
	import { getRiskColor, getIntensityColor } from '$lib/acoustics';
	import type { RouteRiskAlert } from '$lib/types';

	Chart.register(...registerables);

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let chart = $state<Chart | null>(null);

	let selectedAlert = $state<RouteRiskAlert | null>(null);
	let temporalMode = $state(false);

	let effectiveAnalysis = $derived(
		temporalMode ? $temporalActiveRouteAnalysis : $activeRouteAnalysis
	);
	let peaks = $derived($allRiskPeaks);

	$effect(() => {
		if (!chart) return;
		updateChart();
	});

	function updateChart() {
		if (!chart) return;

		const analysis = effectiveAnalysis;
		if (!analysis || analysis.segments.length === 0) {
			chart.data.labels = [];
			chart.data.datasets[0].data = [];
			chart.update('none');
			return;
		}

		const labels = analysis.segments.map((s) => `${s.distance.toFixed(0)}m`);
		const data = analysis.segments.map((s) => s.intensity);

		const backgroundColors = analysis.segments.map((s) => {
			if (s.isBlocked) return '#ef444480';
			if (!s.isReachable) return '#f9731680';
			return getIntensityColor(s.intensity) + '80';
		});

		const borderColors = analysis.segments.map((s) => {
			if (s.isBlocked) return '#ef4444';
			if (!s.isReachable) return '#f97316';
			return getIntensityColor(s.intensity);
		});

		chart.data.labels = labels;
		chart.data.datasets[0].data = data;
		(chart.data.datasets[0] as any).backgroundColor = backgroundColors;
		(chart.data.datasets[0] as any).borderColor = borderColors;

		chart.update('none');
	}

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${seconds.toFixed(0)}秒`;
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}分${secs}秒`;
	}

	function getRiskLabel(level: string): string {
		switch (level) {
			case 'critical': return '严重';
			case 'high': return '高风险';
			case 'medium': return '中风险';
			case 'low': return '低风险';
			default: return level;
		}
	}

	function getAlertTypeLabel(type: string): string {
		switch (type) {
			case 'blocked': return '遮蔽盲区';
			case 'low_intensity': return '低声强区';
			case 'dead_zone': return '声影盲区';
			default: return type;
		}
	}

	function getAlertIcon(type: string): string {
		switch (type) {
			case 'blocked': return '⛰️';
			case 'low_intensity': return '🔇';
			case 'dead_zone': return '🌑';
			default: return '⚠️';
		}
	}

	onMount(() => {
		const canvasEl = canvas;
		if (!canvasEl) return;

		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		chart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: [],
				datasets: [
					{
						label: '声强 (%)',
						data: [],
						fill: true,
						tension: 0.3,
						pointRadius: 0,
						pointHoverRadius: 4,
						borderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						backgroundColor: 'rgba(10,36,99,0.95)',
						titleColor: '#FFD700',
						bodyColor: '#8D99AE',
						borderColor: 'rgba(255,215,0,0.3)',
						borderWidth: 1,
						callbacks: {
							label: function (context: any) {
								const index = context.dataIndex;
								const seg = effectiveAnalysis?.segments[index];
								if (seg) {
									return [
										`声强: ${seg.intensity.toFixed(1)}%`,
										`距离: ${seg.distance.toFixed(0)}m`,
										`可达: ${seg.isReachable ? '是' : '否'}`,
										`遮蔽: ${seg.isBlocked ? '是' : '否'}`,
										`贡献声源: ${seg.contributingSources.length}个`
									];
								}
								return '';
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							color: 'rgba(141,153,174,0.6)',
							font: { size: 9 },
							maxTicksLimit: 8
						},
						grid: {
							color: 'rgba(141,153,174,0.1)'
						},
						title: {
							display: true,
							text: '航行距离 (m)',
							color: 'rgba(141,153,174,0.6)',
							font: { size: 10 }
						}
					},
					y: {
						beginAtZero: true,
						max: 100,
						ticks: {
							color: 'rgba(141,153,174,0.6)',
							font: { size: 9 },
							stepSize: 20
						},
						grid: {
							color: 'rgba(141,153,174,0.1)'
						},
						title: {
							display: true,
							text: '声强 (%)',
							color: 'rgba(141,153,174,0.6)',
							font: { size: 10 }
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

<div class="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
	<div class="flex items-center justify-between mb-4">
		<h3 class="text-lg font-display font-bold text-white flex items-center gap-2">
			<span class="text-accent">📊</span> 航线声强分析
		</h3>
		<button
			onclick={() => temporalMode = !temporalMode}
			class="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] transition-all {
				temporalMode
					? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
					: 'border-white/10 bg-white/5 text-white/40 hover:text-white/60'
			}"
			title={temporalMode ? '切换为静态模式' : '切换为时变模式'}
		>
			<span>🌀</span>
			<span>{temporalMode ? '时变' : '静态'}</span>
		</button>
	</div>

	{#if !$activeRoute}
		<div class="py-8 text-center text-sm text-white/30 font-body">
			请在航线管理中选择一条航线
		</div>
	{:else if !effectiveAnalysis || effectiveAnalysis.segments.length < 2}
		<div class="py-8 text-center text-sm text-white/30 font-body">
			航线航点不足，请添加至少 2 个航点
		</div>
	{:else}
		<div class="mb-4 grid grid-cols-4 gap-2">
			<div class="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
				<div class="text-[10px] text-emerald-400 font-body mb-0.5">总距离</div>
				<div class="text-sm font-bold text-emerald-400 font-display">
					{effectiveAnalysis.totalDistance.toFixed(0)}m
				</div>
			</div>
			<div class="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
				<div class="text-[10px] text-cyan-400 font-body mb-0.5">平均声强</div>
				<div class="text-sm font-bold text-cyan-400 font-display">
					{effectiveAnalysis.avgIntensity.toFixed(0)}%
				</div>
			</div>
			<div class="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
				<div class="text-[10px] text-yellow-400 font-body mb-0.5">最低声强</div>
				<div class="text-sm font-bold text-yellow-400 font-display">
					{effectiveAnalysis.minIntensity.toFixed(0)}%
				</div>
			</div>
			<div class="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
				<div class="text-[10px] text-purple-400 font-body mb-0.5">航行时间</div>
				<div class="text-sm font-bold text-purple-400 font-display">
					{formatDuration(effectiveAnalysis.totalDistance / ($activeRoute?.speed || 10))}
				</div>
			</div>
		</div>

		<div class="h-48 mb-4">
			<canvas bind:this={canvas}></canvas>
		</div>

		{#if temporalMode && peaks.length > 0}
			<div class="mb-3 p-3 rounded-lg bg-cyan-500/8 border border-cyan-500/15">
				<div class="text-[10px] text-cyan-400/70 uppercase tracking-wider mb-2 font-body">⚠️ 时变风险峰值</div>
				<div class="space-y-1 max-h-24 overflow-y-auto">
					{#each peaks.slice(0, 3) as peak}
						<div class="flex items-center gap-2 text-[11px]">
							<div class="w-2 h-2 rounded-full shrink-0" style="background: {getRiskColor(peak.riskLevel)};"></div>
							<span class="text-white/60 truncate">{peak.description.split('：')[0]}</span>
							<span class="ml-auto font-mono text-white/40 shrink-0">{(peak.severity * 100).toFixed(0)}%</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="mb-3 flex items-center justify-between">
			<div class="text-xs font-body font-medium text-white/50 uppercase tracking-wider">
				风险预警 ({effectiveAnalysis.riskAlerts.length})
			</div>
		</div>

		<div class="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
			{#if effectiveAnalysis.riskAlerts.length === 0}
				<div class="text-xs text-emerald-400/70 py-4 text-center font-body flex items-center justify-center gap-2">
					<span>✓</span>
					<span>航线安全，无风险预警</span>
				</div>
			{/if}
			{#each effectiveAnalysis.riskAlerts as alert (alert.id)}
				<div
					class="p-3 rounded-lg border cursor-pointer transition-all duration-200 {
						selectedAlert?.id === alert.id
							? 'border-opacity-100 bg-opacity-20'
							: 'border-opacity-30 hover:border-opacity-60 hover:bg-opacity-10'
					}"
					style="border-color: {getRiskColor(alert.level)}; background-color: {getRiskColor(alert.level)}10;"
					onclick={() => selectedAlert = selectedAlert?.id === alert.id ? null : alert}
				>
					<div class="flex items-center gap-2">
						<span class="text-base">{getAlertIcon(alert.type)}</span>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span
									class="text-[10px] px-1.5 py-0.5 rounded font-bold font-body"
									style="background-color: {getRiskColor(alert.level)}; color: #fff;"
								>
									{getRiskLabel(alert.level)}
								</span>
								<span class="text-xs font-medium text-white/80 font-body truncate">
									{getAlertTypeLabel(alert.type)}
								</span>
							</div>
							<div class="text-[11px] text-white/50 font-body mt-1">
								{alert.description}
							</div>
						</div>
					</div>

					{#if selectedAlert?.id === alert.id}
						<div class="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-2">
							<div class="text-center">
								<div class="text-[10px] text-white/40 font-body">起始距离</div>
								<div class="text-xs font-bold text-white/70 font-mono">
									{alert.startDistance.toFixed(0)}m
								</div>
							</div>
							<div class="text-center">
								<div class="text-[10px] text-white/40 font-body">结束距离</div>
								<div class="text-xs font-bold text-white/70 font-mono">
									{alert.endDistance.toFixed(0)}m
								</div>
							</div>
							<div class="text-center">
								<div class="text-[10px] text-white/40 font-body">持续时间</div>
								<div class="text-xs font-bold text-white/70 font-mono">
									{formatDuration(alert.duration)}
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
