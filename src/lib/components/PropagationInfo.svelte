<script lang="ts">
	import { reachablePointsCount, blockedPointsCount, totalRiskCount } from '$lib/stores/propagationStore';
	import { targetPoints, soundSources, allSources } from '$lib/stores/pointsStore';
	import { weather } from '$lib/stores/weatherStore';
	import { routes } from '$lib/stores/routesStore';
</script>

<div class="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
	<h3 class="text-lg font-display font-bold mb-4 text-white flex items-center gap-2">
		<span class="text-accent">📡</span> 传播统计
	</h3>

	<div class="grid grid-cols-2 gap-3">
		<div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
			<div class="text-xs text-emerald-400 mb-1 font-body">可达点位</div>
			<div class="text-2xl font-bold text-emerald-400 font-display">
				{$reachablePointsCount}
				<span class="text-sm font-normal text-white/40 font-body">
					/ {$targetPoints.length}
				</span>
			</div>
		</div>

		<div class="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
			<div class="text-xs text-red-400 mb-1 font-body">被遮蔽点位</div>
			<div class="text-2xl font-bold text-red-400 font-display">{$blockedPointsCount}</div>
		</div>

		<div class="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 col-span-2">
			<div class="text-xs text-yellow-400 mb-1 font-body">声源状态</div>
			<div class="text-sm font-medium text-yellow-300/90 font-body">
				启用 {$soundSources.length} / 总计 {$allSources.length} 个声源
			</div>
			<div class="text-[11px] text-white/40 font-body mt-1">
				灯塔 {$allSources.filter((s) => s.type === 'lighthouse').length} 个 · 
				雾号 {$allSources.filter((s) => s.type === 'foghorn').length} 个
			</div>
		</div>

		<div class="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 col-span-2">
			<div class="text-xs text-cyan-400 mb-1 font-body">航线状态</div>
			<div class="text-sm font-medium text-cyan-300/90 font-body">
				{$routes.length} 条航线
				{#if $totalRiskCount.total > 0}
					<span class="ml-2 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
						{$totalRiskCount.total} 项风险
					</span>
				{/if}
			</div>
		</div>

		<div class="p-3 rounded-lg bg-white/5 border border-white/10 col-span-2">
			<div class="text-xs text-white/50 mb-2 font-body uppercase tracking-wider">强度图例</div>
			<div class="flex h-4 rounded-full overflow-hidden">
				<div class="flex-1 bg-[#22c55e]" title="≥ 80% (强)"></div>
				<div class="flex-1 bg-[#84cc16]" title="60-80% (较强)"></div>
				<div class="flex-1 bg-[#eab308]" title="40-60% (中)"></div>
				<div class="flex-1 bg-[#f97316]" title="20-40% (弱)"></div>
				<div class="flex-1 bg-[#ef4444]" title="< 20% (极弱)"></div>
			</div>
			<div class="flex justify-between text-xs mt-1 text-white/40 font-body">
				<span>强</span>
				<span>中</span>
				<span>弱</span>
			</div>
		</div>

		<div class="p-3 rounded-lg bg-white/5 border border-white/10 col-span-2">
			<div class="text-xs text-white/50 mb-2 font-body uppercase tracking-wider">天气条件</div>
			<div class="grid grid-cols-2 gap-2 text-xs">
				<div class="flex justify-between">
					<span class="text-white/50 font-body">风向</span>
					<span class="text-accent font-mono">{$weather.windDirection}°</span>
				</div>
				<div class="flex justify-between">
					<span class="text-white/50 font-body">风速</span>
					<span class="text-accent font-mono">{$weather.windSpeed.toFixed(1)} m/s</span>
				</div>
				<div class="flex justify-between">
					<span class="text-white/50 font-body">湿度</span>
					<span class="text-accent font-mono">{$weather.humidity}%</span>
				</div>
				<div class="flex justify-between">
					<span class="text-white/50 font-body">基准频率</span>
					<span class="text-accent font-mono">{$weather.frequency} Hz</span>
				</div>
			</div>
		</div>
	</div>
</div>
