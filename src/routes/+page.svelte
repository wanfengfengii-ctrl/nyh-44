<script lang="ts">
	import MapCanvas from '$lib/components/MapCanvas.svelte';
	import PointsPanel from '$lib/components/PointsPanel.svelte';
	import WeatherPanel from '$lib/components/WeatherPanel.svelte';
	import PropagationInfo from '$lib/components/PropagationInfo.svelte';
	import ScenarioPanel from '$lib/components/ScenarioPanel.svelte';
	import IntensityChart from '$lib/components/IntensityChart.svelte';
	import RoutePanel from '$lib/components/RoutePanel.svelte';
	import RouteAnalysisPanel from '$lib/components/RouteAnalysisPanel.svelte';
	import AlertToast from '$lib/components/AlertToast.svelte';
	import TidalPanel from '$lib/components/TidalPanel.svelte';
	import TimelinePanel from '$lib/components/TimelinePanel.svelte';
	import TemporalComparisonPanel from '$lib/components/TemporalComparisonPanel.svelte';
	import MultiVesselScheduler from '$lib/components/MultiVesselScheduler.svelte';

	let currentTime = $state('');
	let temporalExpanded = $state(true);
	let schedulerExpanded = $state(false);

	$effect(() => {
		const update = () => {
			currentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
		};
		update();
		const interval = setInterval(update, 30000);
		return () => clearInterval(interval);
	});
</script>

<div class="min-h-screen bg-gradient-to-br from-primary-dark via-ocean-deep to-ocean-mid font-body text-sand relative overflow-hidden">

	<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.12)_0%,transparent_60%)]"></div>
	<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgba(255,215,0,0.06)_0%,transparent_50%)]"></div>

	<header class="sticky top-0 z-50 border-b border-white/10 bg-primary-dark/80 backdrop-blur-xl">
		<div class="mx-auto max-w-[1800px] px-6 py-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<div class="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent to-lighthouse-glow shadow-lg shadow-accent/30">
						<span class="text-xl">🔔</span>
						<div class="absolute inset-0 animate-ping rounded-full bg-accent/20"></div>
					</div>
					<div>
						<h1 class="font-display text-xl font-bold tracking-wide text-accent drop-shadow-[0_0_12px_rgba(255,215,0,0.4)]">
							多声源协同传播与航线风险预警系统
						</h1>
						<p class="text-[11px] tracking-widest text-sea-fog/80 uppercase">
							沿海灯塔钟声 · 声学传播路径 · 航线安全分析
						</p>
					</div>
				</div>
				<div class="flex items-center gap-5">
					<div class="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 backdrop-blur-sm border border-white/10">
						<span class="relative flex h-2 w-2">
							<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
							<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
						</span>
						<span class="text-[11px] text-emerald-300">实时计算</span>
					</div>
					<span class="text-[11px] text-sea-fog/60 font-mono">{currentTime}</span>
				</div>
			</div>
		</div>
	</header>

	<main class="relative z-10 mx-auto max-w-[1800px] px-6 py-5">
		<div class="grid grid-cols-12 gap-4">

			<aside class="col-span-12 lg:col-span-3 space-y-4">
				<PointsPanel />
				<RoutePanel />
				<TidalPanel />
			</aside>

			<section class="col-span-12 lg:col-span-6">
				<div class="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-2xl shadow-black/30 overflow-hidden">
					<div class="flex items-center justify-between border-b border-white/10 px-4 py-2">
						<div class="flex items-center gap-2">
							<span class="flex h-5 w-5 items-center justify-center rounded bg-ocean-surface/20 text-[10px]">🗺️</span>
							<span class="text-xs font-medium text-sea-fog/80">海图绘制区</span>
						</div>
						<div class="flex items-center gap-1.5">
							<span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
							<span class="text-[10px] text-sea-fog/50">LIVE</span>
						</div>
					</div>
					<div class="h-[600px]">
						<MapCanvas />
					</div>
				</div>
			</section>

			<aside class="col-span-12 lg:col-span-3 space-y-4">
				<WeatherPanel />
				<PropagationInfo />
				<RouteAnalysisPanel />
				<IntensityChart />
				<ScenarioPanel />
			</aside>
		</div>

		<div class="mt-5 rounded-xl border border-white/8 bg-white/[0.03] backdrop-blur-md shadow-xl shadow-black/20 overflow-hidden">
			<button
				onclick={() => temporalExpanded = !temporalExpanded}
				class="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.03] transition-colors"
			>
				<div class="flex items-center gap-3">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-indigo-500/10 text-base">🌀</span>
					<div class="text-left">
						<h3 class="font-display text-sm font-semibold text-accent/90">潮汐与地形时变传播模拟系统</h3>
						<p class="text-[10px] text-sea-fog/50 tracking-wider">TIDAL & TERRAIN TIME-VARYING PROPAGATION SIMULATION</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-[10px] text-cyan-400/60 font-mono">{temporalExpanded ? '收起' : '展开'}</span>
					<span class="text-white/50 transition-transform duration-300 {temporalExpanded ? 'rotate-180' : ''}">▼</span>
				</div>
			</button>

			{#if temporalExpanded}
				<div class="px-5 pb-5 pt-1">
					<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
						<div class="lg:col-span-1">
							<TimelinePanel />
						</div>
						<div class="lg:col-span-2">
							<TemporalComparisonPanel />
						</div>
					</div>
				</div>
			{/if}
		</div>

		<div class="mt-5 rounded-xl border border-white/8 bg-white/[0.03] backdrop-blur-md shadow-xl shadow-black/20 overflow-hidden">
			<button
				onclick={() => schedulerExpanded = !schedulerExpanded}
				class="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.03] transition-colors"
			>
				<div class="flex items-center gap-3">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/10 text-base">🚢</span>
					<div class="text-left">
						<h3 class="font-display text-sm font-semibold text-violet-300/90">多船协同调度与安全窗口推荐系统</h3>
						<p class="text-[10px] text-sea-fog/50 tracking-wider">MULTI-VESSEL COOPERATIVE SCHEDULING & SAFETY WINDOW RECOMMENDATION</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-[10px] text-violet-400/60 font-mono">{schedulerExpanded ? '收起' : '展开'}</span>
					<span class="text-white/50 transition-transform duration-300 {schedulerExpanded ? 'rotate-180' : ''}">▼</span>
				</div>
			</button>

			{#if schedulerExpanded}
				<div class="px-5 pb-5 pt-1">
					<MultiVesselScheduler />
				</div>
			{/if}
		</div>

		<div class="mt-5 rounded-xl border border-white/8 bg-white/[0.03] p-5 backdrop-blur-md shadow-xl shadow-black/20">
			<div class="mb-4 flex items-center gap-2">
				<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-lighthouse-glow/10 text-sm">📖</span>
				<h3 class="font-display text-sm font-semibold text-accent/90">使用说明</h3>
			</div>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
				<div class="flex gap-3 rounded-lg bg-white/[0.03] p-3 border border-white/5 transition-all hover:bg-white/[0.06] hover:border-accent/20">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-surface/15 text-sm font-bold text-ocean-surface">1</span>
					<p class="text-xs leading-relaxed text-sea-fog/70">在左侧工具栏选择声源类型（灯塔/雾号），在画布上点击放置多个声源，可单独设置频率与声级。</p>
				</div>
				<div class="flex gap-3 rounded-lg bg-white/[0.03] p-3 border border-white/5 transition-all hover:bg-white/[0.06] hover:border-accent/20">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-surface/15 text-sm font-bold text-ocean-surface">2</span>
					<p class="text-xs leading-relaxed text-sea-fog/70">使用岩壁工具绘制遮挡地形，岩壁会对声波产生遮蔽效应，形成声影盲区。</p>
				</div>
				<div class="flex gap-3 rounded-lg bg-white/[0.03] p-3 border border-white/5 transition-all hover:bg-white/[0.06] hover:border-accent/20">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-surface/15 text-sm font-bold text-ocean-surface">3</span>
					<p class="text-xs leading-relaxed text-sea-fog/70">创建航线并在画布上设置航点，系统自动计算航线各段的声强变化与风险预警。</p>
				</div>
				<div class="flex gap-3 rounded-lg bg-white/[0.03] p-3 border border-white/5 transition-all hover:bg-white/[0.06] hover:border-accent/20">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-surface/15 text-sm font-bold text-ocean-surface">4</span>
					<p class="text-xs leading-relaxed text-sea-fog/70">调整天气参数观察传播变化，保存方案时自动记录所有声源、障碍物、航线及天气条件。</p>
				</div>
				<div class="flex gap-3 rounded-lg bg-white/[0.03] p-3 border border-white/5 transition-all hover:bg-white/[0.06] hover:border-cyan-400/20">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-sm font-bold text-cyan-400">5</span>
					<p class="text-xs leading-relaxed text-sea-fog/70">展开"潮汐与地形时变传播模拟系统"，设置潮汐/海况/时段参数，使用时间轴回放观察不同时刻的传播范围与风险演化，钉选关键时段进行对比分析。</p>
				</div>
				<div class="flex gap-3 rounded-lg bg-white/[0.03] p-3 border border-white/5 transition-all hover:bg-white/[0.06] hover:border-violet-400/20">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-sm font-bold text-violet-400">6</span>
					<p class="text-xs leading-relaxed text-sea-fog/70">展开"多船协同调度与安全窗口推荐系统"，添加船只并绑定航线，系统自动计算各航线最佳出发时刻、安全通行窗口、风险重叠与冲突时段，支持方案排序对比和一键应用。</p>
				</div>
			</div>
		</div>
	</main>

	<footer class="relative z-10 border-t border-white/5 mt-6 py-5">
		<div class="mx-auto max-w-[1800px] px-6 text-center">
			<p class="text-[11px] tracking-wider text-sea-fog/40">
				多声源协同传播模型 · 考虑大气衰减、风速影响、障碍物遮蔽与叠加效应 · 潮汐与地形时变传播模拟 · 航线安全风险预警系统 · 多船协同调度与安全窗口推荐
			</p>
		</div>
	</footer>

	<AlertToast />
</div>
