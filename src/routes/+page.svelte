<script lang="ts">
	import MapCanvas from '$lib/components/MapCanvas.svelte';
	import PointsPanel from '$lib/components/PointsPanel.svelte';
	import WeatherPanel from '$lib/components/WeatherPanel.svelte';
	import PropagationInfo from '$lib/components/PropagationInfo.svelte';
	import ScenarioPanel from '$lib/components/ScenarioPanel.svelte';
	import IntensityChart from '$lib/components/IntensityChart.svelte';

	let currentTime = $state('');

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
		<div class="mx-auto max-w-[1600px] px-6 py-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<div class="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent to-lighthouse-glow shadow-lg shadow-accent/30">
						<span class="text-xl">🔔</span>
						<div class="absolute inset-0 animate-ping rounded-full bg-accent/20"></div>
					</div>
					<div>
						<h1 class="font-display text-xl font-bold tracking-wide text-accent drop-shadow-[0_0_12px_rgba(255,215,0,0.4)]">
							沿海灯塔钟声传播模拟器
						</h1>
						<p class="text-[11px] tracking-widest text-sea-fog/80 uppercase">
							声学传播路径可视化分析工具
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

	<main class="relative z-10 mx-auto max-w-[1600px] px-6 py-5">
		<div class="grid grid-cols-12 gap-4">

			<aside class="col-span-12 lg:col-span-3 space-y-4">
				<PointsPanel />
				<PropagationInfo />
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
				<IntensityChart />
				<ScenarioPanel />
			</aside>
		</div>

		<div class="mt-5 rounded-xl border border-white/8 bg-white/[0.03] p-5 backdrop-blur-md shadow-xl shadow-black/20">
			<div class="mb-4 flex items-center gap-2">
				<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-lighthouse-glow/10 text-sm">📖</span>
				<h3 class="font-display text-sm font-semibold text-accent/90">使用说明</h3>
			</div>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div class="flex gap-3 rounded-lg bg-white/[0.03] p-3 border border-white/5 transition-all hover:bg-white/[0.06] hover:border-accent/20">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-surface/15 text-sm font-bold text-ocean-surface">1</span>
					<p class="text-xs leading-relaxed text-sea-fog/70">选择左侧工具栏中的点位类型，在画布上点击放置灯塔、海岸、港口或船只位置。</p>
				</div>
				<div class="flex gap-3 rounded-lg bg-white/[0.03] p-3 border border-white/5 transition-all hover:bg-white/[0.06] hover:border-accent/20">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-surface/15 text-sm font-bold text-ocean-surface">2</span>
					<p class="text-xs leading-relaxed text-sea-fog/70">选择岩壁工具，在画布上点击两次绘制岩壁线段，岩壁会遮挡声音传播。</p>
				</div>
				<div class="flex gap-3 rounded-lg bg-white/[0.03] p-3 border border-white/5 transition-all hover:bg-white/[0.06] hover:border-accent/20">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-surface/15 text-sm font-bold text-ocean-surface">3</span>
					<p class="text-xs leading-relaxed text-sea-fog/70">调整右侧天气参数面板中的风向、风速、湿度和频率，观察传播范围实时变化。</p>
				</div>
				<div class="flex gap-3 rounded-lg bg-white/[0.03] p-3 border border-white/5 transition-all hover:bg-white/[0.06] hover:border-accent/20">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-surface/15 text-sm font-bold text-ocean-surface">4</span>
					<p class="text-xs leading-relaxed text-sea-fog/70">使用方案管理功能保存和加载你的设计方案，支持 JSON 格式导入导出。</p>
				</div>
			</div>
		</div>
	</main>

	<footer class="relative z-10 border-t border-white/5 mt-6 py-5">
		<div class="mx-auto max-w-[1600px] px-6 text-center">
			<p class="text-[11px] tracking-wider text-sea-fog/40">
				基于声学传播模型 · 考虑大气衰减、风速影响和障碍物遮蔽效应 · 沿海灯塔钟声传播模拟系统
			</p>
		</div>
	</footer>
</div>
