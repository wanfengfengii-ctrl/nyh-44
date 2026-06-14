<script lang="ts">
	import { activePlan, getRiskColor, getRiskLabel, formatHour, multiVesselStore } from '$lib/stores/multiVesselScheduleStore';
	import type { ConflictPeriod, Vessel } from '$lib/types';

	const vesselsStore = multiVesselStore.vessels;

	let plan = $derived($activePlan);
	let vesselList = $derived($vesselsStore);
	let expanded = $state(true);

	let conflicts = $derived(plan?.conflicts ?? []);

	function getConflictIcon(type: ConflictPeriod['conflictType']): string {
		switch (type) {
			case 'route_overlap': return '🔄';
			case 'risk_overlap': return '⚡';
			case 'timing_conflict': return '⏰';
			case 'resource_contention': return '🏗️';
			default: return '⚠️';
		}
	}

	function getConflictTypeLabel(type: ConflictPeriod['conflictType']): string {
		switch (type) {
			case 'route_overlap': return '航线重叠';
			case 'risk_overlap': return '风险重叠';
			case 'timing_conflict': return '时段冲突';
			case 'resource_contention': return '资源争用';
			default: return type;
		}
	}

	function getVesselColor(vesselId: string): string {
		const vessel = vesselList.find((v: Vessel) => v.id === vesselId);
		return vessel?.color ?? '#888';
	}

	function getVesselName(vesselId: string): string {
		const vessel = vesselList.find((v: Vessel) => v.id === vesselId);
		return vessel?.name ?? '未知';
	}

	let conflictSummary = $derived(() => {
		if (conflicts.length === 0) return { total: 0, critical: 0, high: 0, medium: 0 };
		return {
			total: conflicts.length,
			critical: conflicts.filter(c => c.severity === 'critical').length,
			high: conflicts.filter(c => c.severity === 'high').length,
			medium: conflicts.filter(c => c.severity === 'medium').length
		};
	});

	let summary = $derived(conflictSummary());
</script>

<div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
	<button
		onclick={() => expanded = !expanded}
		class="w-full flex items-center justify-between mb-2"
	>
		<div class="flex items-center gap-2">
			<span class="text-[10px] text-white/40 uppercase tracking-wider font-body">冲突与风险重叠分析</span>
			{#if summary.total > 0}
				<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold font-body">
					{summary.total}
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if summary.total > 0}
				<div class="flex gap-1">
					{#if summary.critical > 0}
						<span class="text-[9px] text-red-400 font-mono">{summary.critical}严重</span>
					{/if}
					{#if summary.high > 0}
						<span class="text-[9px] text-orange-400 font-mono">{summary.high}高</span>
					{/if}
					{#if summary.medium > 0}
						<span class="text-[9px] text-amber-400 font-mono">{summary.medium}中</span>
					{/if}
				</div>
			{/if}
			<span class="text-white/30 text-[10px] transition-transform duration-200 {expanded ? 'rotate-180' : ''}">▼</span>
		</div>
	</button>

	{#if expanded}
		{#if conflicts.length === 0}
			<div class="py-4 text-center text-[11px] text-emerald-400/60 font-body flex items-center justify-center gap-1.5">
				<span>✓</span>
				<span>无冲突，各船只调度时段安全</span>
			</div>
		{:else}
			<div class="mb-3">
				<div class="h-8 relative rounded bg-white/[0.02] overflow-hidden">
					{#each conflicts as conflict}
						{@const left = (conflict.startHour / 24) * 100}
						{@const right = (conflict.endHour / 24) * 100}
						<div
							class="absolute top-0 h-full rounded-sm opacity-60"
							style="left: {left}%; width: {right - left}%; background: {getRiskColor(conflict.severity)};"
							title="{getConflictTypeLabel(conflict.conflictType)}: {formatHour(conflict.startHour)}-{formatHour(conflict.endHour)}"
						></div>
					{/each}
					{#each Array.from({length: 9}, (_, i) => i * 3) as hour}
						<div class="absolute top-0 h-full border-l border-white/5" style="left: {(hour / 24) * 100}%;">
							<span class="absolute bottom-0 left-0.5 text-[7px] text-white/20 font-mono">{hour}h</span>
						</div>
					{/each}
				</div>
			</div>

			<div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
				{#each conflicts as conflict}
					<div class="flex items-center gap-2 p-2 rounded border transition-all hover:bg-white/[0.03]" style="border-color: {getRiskColor(conflict.severity)}20;">
						<span class="text-sm shrink-0">{getConflictIcon(conflict.conflictType)}</span>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-1.5">
								<span class="text-[9px] px-1 py-0.5 rounded font-bold font-body" style="background: {getRiskColor(conflict.severity)}; color: #fff;">
									{getConflictTypeLabel(conflict.conflictType)}
								</span>
								<span class="text-[10px] text-white/40 font-mono">{formatHour(conflict.startHour)}-{formatHour(conflict.endHour)}</span>
							</div>
							<div class="flex items-center gap-1 mt-1">
								{#each conflict.vesselIds as vid}
									<span class="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded-full font-body" style="background: {getVesselColor(vid)}20; color: {getVesselColor(vid)};">
										<span class="w-1.5 h-1.5 rounded-full" style="background: {getVesselColor(vid)};"></span>
										{getVesselName(vid)}
									</span>
								{/each}
							</div>
						</div>
						<span class="text-[9px] font-mono shrink-0" style="color: {getRiskColor(conflict.severity)};">
							{getRiskLabel(conflict.severity)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
