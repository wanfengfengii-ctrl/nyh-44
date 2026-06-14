<script lang="ts">
	import { multiVesselStore, activePlan, formatHour, getRiskColor, getRiskLabel } from '$lib/stores/multiVesselScheduleStore';
	import { routes } from '$lib/stores/routesStore';
	import SafetyWindowChart from './SafetyWindowChart.svelte';
	import ConflictTimeline from './ConflictTimeline.svelte';
	import ScheduleComparison from './ScheduleComparison.svelte';
	import type { Vessel } from '$lib/types';

	const vesselsStore = multiVesselStore.vessels;
	const warningsStore = multiVesselStore.warnings;

	let vesselList = $derived($vesselsStore);
	let routeList = $derived($routes);
	let plan = $derived($activePlan);
	let warningList = $derived($warningsStore);
	let activeTab = $state<'vessels' | 'plan' | 'warnings'>('vessels');

	function onAddVessel() {
		multiVesselStore.addVessel();
	}

	function onRemoveVessel(id: string) {
		multiVesselStore.removeVessel(id);
	}

	function onBindRoute(vesselId: string, routeId: string) {
		multiVesselStore.bindVesselToRoute(vesselId, routeId === '' ? null : routeId);
	}

	function onGeneratePlan() {
		const result = multiVesselStore.generateSchedulePlan();
		if (result) {
			activeTab = 'plan';
		}
	}

	function onApplyPlan() {
		if (plan) {
			multiVesselStore.applyPlan(plan.id);
		}
	}

	function onClearAll() {
		multiVesselStore.clearAll();
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'idle': return '待命';
			case 'scheduled': return '已调度';
			case 'transit': return '航行中';
			case 'completed': return '已完成';
			default: return status;
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'idle': return 'text-white/40';
			case 'scheduled': return 'text-cyan-400';
			case 'transit': return 'text-amber-400';
			case 'completed': return 'text-emerald-400';
			default: return 'text-white/40';
		}
	}

	function getWarningIcon(type: string): string {
		switch (type) {
			case 'high_risk_window': return '🔴';
			case 'conflict_detected': return '⚡';
			case 'low_visibility': return '🌙';
			case 'storm_warning': return '🌪️';
			case 'current_hazard': return '🌊';
			default: return '⚠️';
		}
	}
</script>

<div class="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl overflow-hidden">
	<div class="px-4 py-3 border-b border-white/10 flex items-center justify-between">
		<h3 class="text-lg font-display font-bold text-white flex items-center gap-2">
			<span class="text-violet-400">🚢</span> 多船协同调度与安全窗口推荐
		</h3>
		<div class="flex items-center gap-2">
			<span class="text-[10px] text-violet-400/60 tracking-wider uppercase">Multi-Vessel Scheduler</span>
		</div>
	</div>

	<div class="flex border-b border-white/10">
		<button
			onclick={() => activeTab = 'vessels'}
			class="flex-1 px-3 py-2 text-xs font-body font-medium transition-all {activeTab === 'vessels'
				? 'text-violet-400 border-b-2 border-violet-400 bg-violet-400/5'
				: 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'}"
		>
			船只管理 ({vesselList.length})
		</button>
		<button
			onclick={() => activeTab = 'plan'}
			class="flex-1 px-3 py-2 text-xs font-body font-medium transition-all {activeTab === 'plan'
				? 'text-violet-400 border-b-2 border-violet-400 bg-violet-400/5'
				: 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'}"
		>
			调度方案 {#if plan}<span class="text-emerald-400 ml-1">●</span>{/if}
		</button>
		<button
			onclick={() => activeTab = 'warnings'}
			class="flex-1 px-3 py-2 text-xs font-body font-medium transition-all {activeTab === 'warnings'
				? 'text-violet-400 border-b-2 border-violet-400 bg-violet-400/5'
				: 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'}"
		>
			预警 {#if warningList.length > 0}<span class="text-red-400 ml-1">({warningList.length})</span>{/if}
		</button>
	</div>

	<div class="p-4">
		{#if activeTab === 'vessels'}
			<div class="space-y-3">
				<div class="flex items-center justify-between mb-2">
					<span class="text-xs text-white/50 font-body">绑定航线到船只以参与调度计算</span>
					<div class="flex gap-2">
						<button
							onclick={onAddVessel}
							class="px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 rounded-lg text-xs font-body text-violet-300 transition-all"
						>
							+ 添加船只
						</button>
						<button
							onclick={onClearAll}
							class="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-xs font-body text-white/40 transition-all"
						>
							清空
						</button>
					</div>
				</div>

				{#if vesselList.length === 0}
					<div class="py-8 text-center text-sm text-white/20 font-body">
						暂无船只，点击"添加船只"开始
					</div>
				{:else}
					{#each vesselList as vessel (vessel.id)}
						<div class="rounded-lg border border-white/10 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.05]">
							<div class="flex items-center gap-3 mb-2">
								<div class="w-3 h-3 rounded-full shrink-0" style="background: {vessel.color};"></div>
								<input
									type="text"
									value={vessel.name}
									onchange={(e) => multiVesselStore.updateVessel(vessel.id, { name: (e.target as HTMLInputElement).value })}
									class="bg-transparent border-none text-sm font-medium text-white/80 font-body focus:outline-none focus:text-white w-24"
								/>
								<span class="text-[10px] px-1.5 py-0.5 rounded font-body {getStatusColor(vessel.status)} bg-white/5">
									{getStatusLabel(vessel.status)}
								</span>
								<div class="ml-auto flex items-center gap-2">
									<label class="text-[10px] text-white/40 font-body">航速</label>
									<input
										type="number"
										value={vessel.speed}
										min="1"
										max="30"
										step="1"
										onchange={(e) => multiVesselStore.updateVessel(vessel.id, { speed: Number((e.target as HTMLInputElement).value) || 10 })}
										class="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/70 font-mono text-center"
									/>
									<span class="text-[10px] text-white/30">kn</span>
									<button
										onclick={() => onRemoveVessel(vessel.id)}
										class="text-white/20 hover:text-red-400 transition-colors text-xs ml-1"
										title="移除船只"
									>✕</button>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<label class="text-[10px] text-white/40 font-body shrink-0">绑定航线:</label>
								<select
									value={vessel.routeId ?? ''}
									onchange={(e) => onBindRoute(vessel.id, (e.target as HTMLSelectElement).value)}
									class="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/70 font-body focus:outline-none focus:border-violet-400/40"
								>
									<option value="">未绑定</option>
									{#each routeList as route}
										<option value={route.id}>{route.name}</option>
									{/each}
								</select>
							</div>
						</div>
					{/each}
				{/if}

				{#if vesselList.some(v => v.routeId !== null)}
					<button
						onclick={onGeneratePlan}
						class="w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-violet-600/30 to-indigo-600/30 border border-violet-500/30 hover:from-violet-600/40 hover:to-indigo-600/40 rounded-lg text-sm font-body font-medium text-violet-200 transition-all"
					>
						🧮 生成调度方案
					</button>
				{/if}
			</div>
		{:else if activeTab === 'plan'}
			{#if !plan}
				<div class="py-8 text-center text-sm text-white/20 font-body">
					暂无调度方案，请先添加船只并绑定航线后生成
				</div>
			{:else}
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-sm font-display font-bold text-white/80">{plan.name}</span>
							<span class="text-[10px] px-1.5 py-0.5 rounded font-bold font-body" style="background: {getRiskColor(plan.maxRisk)}20; color: {getRiskColor(plan.maxRisk)};">
								{getRiskLabel(plan.maxRisk)}
							</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-[10px] text-white/40 font-mono">综合评分: {plan.totalScore.toFixed(0)}</span>
							<button
								onclick={onApplyPlan}
								class="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 rounded-lg text-xs font-body text-emerald-300 transition-all"
							>
								✓ 一键应用
							</button>
						</div>
					</div>

					<div class="grid grid-cols-3 gap-2">
						<div class="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-center">
							<div class="text-[10px] text-violet-400 font-body mb-0.5">调度船只</div>
							<div class="text-sm font-bold text-violet-400 font-display">{plan.vesselSchedules.length}</div>
						</div>
						<div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
							<div class="text-[10px] text-amber-400 font-body mb-0.5">冲突数</div>
							<div class="text-sm font-bold text-amber-400 font-display">{plan.conflicts.length}</div>
						</div>
						<div class="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
							<div class="text-[10px] text-cyan-400 font-body mb-0.5">安全窗口</div>
							<div class="text-sm font-bold text-cyan-400 font-display">{plan.vesselSchedules.reduce((s, v) => s + v.safetyWindows.length, 0)}</div>
						</div>
					</div>

					<div class="space-y-2">
						<div class="text-[10px] text-white/40 uppercase tracking-wider font-body mb-1">各船调度详情</div>
						{#each plan.vesselSchedules as schedule}
							{@const vessel = vesselList.find(v => v.id === schedule.vesselId)}
							{@const route = routeList.find(r => r.id === schedule.routeId)}
							{#if vessel && route}
								<div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
									<div class="flex items-center gap-2 mb-2">
										<div class="w-2.5 h-2.5 rounded-full" style="background: {vessel.color};"></div>
										<span class="text-xs font-medium text-white/80 font-body">{vessel.name}</span>
										<span class="text-[10px] text-white/30 font-body">→</span>
										<span class="text-xs text-white/60 font-body">{route.name}</span>
										<span class="ml-auto text-[10px] px-1.5 py-0.5 rounded font-bold font-body" style="background: {getRiskColor(schedule.overallRisk)}20; color: {getRiskColor(schedule.overallRisk)};">
											{getRiskLabel(schedule.overallRisk)}
										</span>
									</div>
									<div class="grid grid-cols-4 gap-2 text-[10px]">
										<div>
											<span class="text-white/30">最佳出发</span>
											<div class="text-emerald-400 font-mono font-bold">{formatHour(schedule.bestDepartureHour)}</div>
										</div>
										<div>
											<span class="text-white/30">预计到达</span>
											<div class="text-cyan-400 font-mono font-bold">{formatHour(schedule.arrivalHour)}</div>
										</div>
										<div>
											<span class="text-white/30">安全评分</span>
											<div class="font-mono font-bold" style="color: {schedule.overallScore >= 70 ? '#22c55e' : schedule.overallScore >= 40 ? '#f59e0b' : '#ef4444'};">{schedule.overallScore.toFixed(0)}</div>
										</div>
										<div>
											<span class="text-white/30">安全窗口</span>
											<div class="text-violet-400 font-mono font-bold">{schedule.safetyWindows.length}</div>
										</div>
									</div>
									{#if schedule.bestWindow}
										<div class="mt-2 pt-2 border-t border-white/5 text-[10px] text-white/40 font-body">
											推荐窗口: {formatHour(schedule.bestWindow.startHour)}-{formatHour(schedule.bestWindow.endHour)}
											· 潮汐{schedule.bestWindow.tidalPhase === 'high' ? '高潮' : schedule.bestWindow.tidalPhase === 'rising' ? '涨潮' : schedule.bestWindow.tidalPhase === 'low' ? '低潮' : '落潮'}
											· {schedule.bestWindow.timeOfDay === 'morning' ? '上午' : schedule.bestWindow.timeOfDay === 'noon' ? '正午' : schedule.bestWindow.timeOfDay === 'afternoon' ? '下午' : schedule.bestWindow.timeOfDay === 'night' ? '夜晚' : schedule.bestWindow.timeOfDay === 'dawn' ? '黎明' : schedule.bestWindow.timeOfDay === 'dusk' ? '黄昏' : '深夜'}
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>

					<SafetyWindowChart />

					<ConflictTimeline />

					<ScheduleComparison />
				</div>
			{/if}
		{:else if activeTab === 'warnings'}
			{#if warningList.length === 0}
				<div class="py-8 text-center text-sm text-white/20 font-body">
					暂无预警信息
				</div>
			{:else}
				<div class="space-y-2 max-h-96 overflow-y-auto pr-1">
					{#each warningList as warning (warning.id)}
						<div class="rounded-lg border p-3 transition-all" style="border-color: {getRiskColor(warning.level)}40; background-color: {getRiskColor(warning.level)}08;">
							<div class="flex items-center gap-2">
								<span class="text-sm">{getWarningIcon(warning.type)}</span>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="text-[10px] px-1.5 py-0.5 rounded font-bold font-body" style="background-color: {getRiskColor(warning.level)}; color: #fff;">
											{getRiskLabel(warning.level)}
										</span>
										<span class="text-[10px] text-white/40 font-mono">{formatHour(warning.hour)}</span>
									</div>
									<div class="text-[11px] text-white/60 font-body mt-1">{warning.message}</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
