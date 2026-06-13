<script lang="ts">
	import { reachablePointsCount, blockedPointsCount } from '$lib/stores/propagationStore';
	import { nonLighthousePoints, lighthouse } from '$lib/stores/pointsStore';
	import { weather } from '$lib/stores/weatherStore';
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
					/ {$nonLighthousePoints.length}
				</span>
			</div>
		</div>

		<div class="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
			<div class="text-xs text-red-400 mb-1 font-body">被遮蔽点位</div>
			<div class="text-2xl font-bold text-red-400 font-display">{$blockedPointsCount}</div>
		</div>

		<div class="p-3 rounded-lg bg-ocean-mid/30 border border-ocean-surface/20 col-span-2">
			<div class="text-xs text-ocean-surface mb-1 font-body">灯塔状态</div>
			{#if $lighthouse}
				<div class="text-sm font-medium text-lighthouse-glow font-body">
					{$lighthouse.label} 位于 ({$lighthouse.x.toFixed(0)}, {$lighthouse.y.toFixed(0)})
				</div>
			{:else}
				<div class="text-sm text-white/30 font-body">尚未布置灯塔</div>
			{/if}
		</div>

		<div class="p-3 rounded-lg bg-white/5 border border-white/10 col-span-2">
			<div class="text-xs text-white/50 mb-2 font-body uppercase tracking-wider">强度图例</div>
			<div class="flex h-4 rounded-full overflow-hidden">
				<div class="flex-1 bg-[#22c55e]" title="≥ 80%"></div>
				<div class="flex-1 bg-[#84cc16]" title="60-80%"></div>
				<div class="flex-1 bg-[#eab308]" title="40-60%"></div>
				<div class="flex-1 bg-[#f97316]" title="20-40%"></div>
				<div class="flex-1 bg-[#ef4444]" title="< 20%"></div>
			</div>
			<div class="flex justify-between text-xs mt-1 text-white/40 font-body">
				<span>强</span>
				<span>中</span>
				<span>弱</span>
			</div>
		</div>
	</div>
</div>
