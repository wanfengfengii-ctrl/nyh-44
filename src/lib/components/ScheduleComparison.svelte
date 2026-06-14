<script lang="ts">
	import { multiVesselStore, activePlan, getRiskColor, getRiskLabel, formatHour } from '$lib/stores/multiVesselScheduleStore';
	import type { SchedulePlan } from '$lib/types';

	const schedulePlansStore = multiVesselStore.schedulePlans;

	let plans = $derived($schedulePlansStore);
	let currentPlan = $derived($activePlan);
	let sortMode = $state<'score' | 'risk'>('score');

	function sortByScore() {
		sortMode = 'score';
		multiVesselStore.sortPlansByScore();
	}

	function sortByRisk() {
		sortMode = 'risk';
		multiVesselStore.sortPlansByRisk();
	}

	function selectPlan(id: string) {
		multiVesselStore.activePlanId.set(id);
	}

	function applyPlan(id: string) {
		multiVesselStore.applyPlan(id);
	}

	function removePlan(id: string) {
		multiVesselStore.removePlan(id);
	}

	function getScoreColor(score: number): string {
		if (score >= 70) return '#22c55e';
		if (score >= 40) return '#f59e0b';
		return '#ef4444';
	}
</script>

<div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
	<div class="flex items-center justify-between mb-2">
		<span class="text-[10px] text-white/40 uppercase tracking-wider font-body">调度方案对比排序</span>
		<div class="flex gap-1">
			<button
				onclick={sortByScore}
				class="px-2 py-0.5 text-[9px] rounded border font-body transition-all {sortMode === 'score'
					? 'border-violet-400/40 bg-violet-400/10 text-violet-300'
					: 'border-white/10 text-white/30 hover:text-white/50'}"
			>
				按评分
			</button>
			<button
				onclick={sortByRisk}
				class="px-2 py-0.5 text-[9px] rounded border font-body transition-all {sortMode === 'risk'
					? 'border-violet-400/40 bg-violet-400/10 text-violet-300'
					: 'border-white/10 text-white/30 hover:text-white/50'}"
			>
				按风险
			</button>
		</div>
	</div>

	{#if plans.length <= 1}
		<div class="py-3 text-center text-[11px] text-white/20 font-body">
			{#if plans.length === 0}
				暂无方案
			{:else}
				仅一个方案，生成更多方案进行对比
			{/if}
		</div>
	{:else}
		<div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
			{#each plans as plan, idx}
				<div
					class="flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all {currentPlan?.id === plan.id
						? 'border-violet-400/30 bg-violet-400/5'
						: 'border-white/10 hover:bg-white/[0.03]'}"
					onclick={() => selectPlan(plan.id)}
				>
					<span class="text-[10px] text-white/30 font-mono w-4 text-center shrink-0">{idx + 1}</span>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-1.5">
							<span class="text-[11px] font-medium text-white/70 font-body truncate">{plan.name}</span>
							<span class="text-[9px] px-1 py-0.5 rounded font-bold font-body" style="background: {getRiskColor(plan.maxRisk)}20; color: {getRiskColor(plan.maxRisk)};">
								{getRiskLabel(plan.maxRisk)}
							</span>
						</div>
						<div class="flex items-center gap-3 mt-1 text-[9px] text-white/30 font-body">
							<span>{plan.vesselSchedules.length}船</span>
							<span>{plan.conflicts.length}冲突</span>
							<span>{new Date(plan.createdAt).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'})}</span>
						</div>
					</div>
					<div class="text-right shrink-0">
						<div class="text-sm font-bold font-mono" style="color: {getScoreColor(plan.totalScore)};">
							{plan.totalScore.toFixed(0)}
						</div>
						<div class="text-[8px] text-white/20">评分</div>
					</div>
					<div class="flex flex-col gap-0.5 shrink-0 ml-1">
						<button
							onclick={(e) => { e.stopPropagation(); applyPlan(plan.id); }}
							class="text-[9px] text-emerald-400/60 hover:text-emerald-400 transition-colors"
							title="应用方案"
						>✓</button>
						<button
							onclick={(e) => { e.stopPropagation(); removePlan(plan.id); }}
							class="text-[9px] text-red-400/40 hover:text-red-400 transition-colors"
							title="删除方案"
						>✕</button>
					</div>
				</div>
			{/each}
		</div>

		{#if plans.length >= 2}
			<div class="mt-3 pt-2 border-t border-white/5">
				<div class="text-[9px] text-white/30 font-body mb-1">方案对比摘要</div>
				<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
					{#each plans.slice(0, 4) as plan}
						<div class="text-center p-1.5 rounded bg-white/[0.02]">
							<div class="text-[9px] text-white/30 font-body truncate">{plan.name}</div>
							<div class="text-xs font-bold font-mono" style="color: {getScoreColor(plan.totalScore)};">
								{plan.totalScore.toFixed(0)}
							</div>
							<div class="flex items-center justify-center gap-1 mt-0.5">
								<span class="w-1.5 h-1.5 rounded-full" style="background: {getRiskColor(plan.maxRisk)};"></span>
								<span class="text-[8px] text-white/30">{plan.conflicts.length}冲突</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
