<script lang="ts">
	import { comparisonSnapshotsData, temporalMetricsSeries } from '$lib/stores/propagationStore';
	import { temporal, TIDAL_PHASES, SEA_STATES, TIME_OF_DAY } from '$lib/stores/tidalStore';
	import { activeRouteId, routes } from '$lib/stores/routesStore';
	import { getRiskColor, getIntensityColor } from '$lib/acoustics';
	import type { MultiSourceSectorSample } from '$lib/acoustics';
	import type { ComparisonTimePoint, RouteAnalysisResult } from '$lib/types';

	const { comparisonPoints: comparisonPointsStore } = temporal;

	let comparison = $derived($comparisonSnapshotsData);
	let series = $derived($temporalMetricsSeries);
	let comparisonPoints = $derived($comparisonPointsStore);
	let activeId = $derived($activeRouteId);
	let routeList = $derived($routes);

	const comparisonColors = ['#fbbf24', '#3b82f6', '#a855f7', '#ec4899'];

	function getColor(idx: number) {
		return comparisonColors[idx % comparisonColors.length];
	}

	function getComparisonList() {
		return Array.from(comparison.entries()).map(([idx, data]) => {
			const cp = comparisonPoints.find((p: ComparisonTimePoint) => p.timeIndex === idx);
			return { idx, data, cp, orderInList: 0 };
		});
	}

	function getRouteAnalysis(data: { routeAnalyses: Map<string, RouteAnalysisResult> }): RouteAnalysisResult | undefined {
		if (activeId && data.routeAnalyses.has(activeId)) {
			return data.routeAnalyses.get(activeId);
		}
		const first = data.routeAnalyses.values().next();
		return first.value;
	}

	function getActiveRouteLabel(): string {
		if (activeId) {
			const r = routeList.find(r => r.id === activeId);
			if (r) return r.name;
		}
		return routeList.length > 0 ? routeList[0].name : '未选择航线';
	}

	function sectorArea(samples: MultiSourceSectorSample[]) {
		if (samples.length === 0) return 0;
		let area = 0;
		for (const s of samples) area += s.maxDistance;
		return area / samples.length;
	}

	function getSectorRingPath(samples: MultiSourceSectorSample[], scale: number = 0.25): string {
		if (samples.length === 0) return '';
		const cx = 60, cy = 60;
		let path = '';
		const first = samples[0];
		const rad0 = ((90 - first.angle) * Math.PI) / 180;
		const r0 = Math.min(110, first.maxDistance * scale);
		path += `M ${cx + Math.cos(rad0) * r0} ${cy + Math.sin(rad0) * r0}`;
		for (let i = 1; i < samples.length; i++) {
			const s = samples[i];
			const rad = ((90 - s.angle) * Math.PI) / 180;
			const r = Math.min(110, s.maxDistance * scale);
			path += ` L ${cx + Math.cos(rad) * r} ${cy + Math.sin(rad) * r}`;
		}
		path += ' Z';
		return path;
	}

	const metricList = [
		{ key: 'avgIntensity', label: '平均声强', suffix: '%', scale: 1, color: '#22c55e' },
		{ key: 'reachableRatio', label: '可达比例', suffix: '%', scale: 100, color: '#3b82f6' },
		{ key: 'blockedRatio', label: '遮蔽比例', suffix: '%', scale: 100, color: '#ef4444' },
		{ key: 'riskCount', label: '风险数', suffix: '', scale: 1, color: '#f97316' }
	] as const;
</script>

<div class="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
	<h3 class="text-lg font-display font-bold mb-4 text-white flex items-center gap-2">
		<span class="text-amber-400">🔀</span> 关键时段对比分析
	</h3>

	{#if comparison.size === 0}
		<div class="text-center py-8 text-white/40 text-sm">
			<div class="text-3xl mb-2 opacity-50">📌</div>
			<p class="mb-1">尚未钉选任何时刻</p>
			<p class="text-[11px] text-white/30">在"时间轴回放"面板中点击"钉选当前时刻"以添加对比点（最多4个）</p>
		</div>
	{:else}
		<div class="space-y-5">
			<div class="grid grid-cols-1 gap-3">
				{#each Array.from(comparison.entries()) as [idx, data], i}
					{@const cp = comparisonPoints.find((p: ComparisonTimePoint) => p.timeIndex === idx)}
					<div class="rounded-lg p-3 border transition-all hover:bg-white/[0.04]" style="border-color: {getColor(i)}30; background: linear-gradient(135deg, {getColor(i)}08, transparent);">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<div class="w-3 h-3 rounded-full shrink-0" style="background: {getColor(i)};"></div>
								<span class="text-white font-bold text-sm">{cp?.label ?? `T${i + 1}`}</span>
								<span class="text-xs font-mono text-white/50">
									{data.snapshot.displayTime}
								</span>
							</div>
							<button
								onclick={() => temporal.setTimeIndex(idx)}
								class="text-[10px] px-2 py-0.5 rounded border transition-all hover:bg-white/10"
								style="border-color: {getColor(i)}40; color: {getColor(i)};"
							>
								跳转
							</button>
						</div>

						<div class="grid grid-cols-4 gap-2 text-[10px]">
							<div class="flex flex-col">
								<span class="text-cyan-400/60">潮位</span>
								<span class="text-white/90 font-mono">
									{TIDAL_PHASES.find(p => p.value === data.snapshot.tidal.tidalPhase)?.icon}
									{data.snapshot.tidal.tideLevel.toFixed(1)}m
								</span>
							</div>
							<div class="flex flex-col">
								<span class="text-amber-400/60">浪高</span>
								<span class="text-white/90 font-mono">{data.snapshot.seaSurface.waveHeight.toFixed(2)}m</span>
							</div>
							<div class="flex flex-col">
								<span class="text-indigo-400/60">时段</span>
								<span class="text-white/90 font-mono">
									{TIME_OF_DAY.find(t => t.value === data.snapshot.dayTime.timeOfDay)?.label}
								</span>
							</div>
							<div class="flex flex-col">
								<span class="text-rose-400/60">风险</span>
								<span class="text-white/90 font-mono font-bold">{data.totalRiskCount}个</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="border-t border-white/10 pt-4">
				<h4 class="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">📡 传播范围对比</h4>
				<div class="relative mx-auto" style="width: 240px; height: 240px;">
					<svg viewBox="0 0 240 240" class="w-full h-full">
						<circle cx="120" cy="120" r="30" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="2,2"/>
						<circle cx="120" cy="120" r="55" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="2,2"/>
						<circle cx="120" cy="120" r="80" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="2,2"/>
						<circle cx="120" cy="120" r="105" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="2,2"/>
						<line x1="120" y1="15" x2="120" y2="225" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
						<line x1="15" y1="120" x2="225" y2="120" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>

						{#each Array.from(comparison.entries()) as [idx, data], i}
							{#if data.sectorData.length > 0}
								<path
									d={getSectorRingPath(data.sectorData, 0.25).replace(/60/g, '120')}
									fill={getColor(i)}
									fill-opacity={0.12 - i * 0.02}
									stroke={getColor(i)}
									stroke-opacity={0.5}
									stroke-width="1.5"
								/>
							{/if}
						{/each}

						<circle cx="120" cy="120" r="5" fill="#FFD700"/>
					</svg>

					<div class="absolute bottom-0 left-0 right-0 flex flex-wrap justify-center gap-2 mt-2">
						{#each Array.from(comparison.entries()) as [idx, data], i}
							{@const cp = comparisonPoints.find(p => p.timeIndex === idx)}
							<div class="flex items-center gap-1 text-[9px]">
								<div class="w-2 h-2 rounded-full" style="background: {getColor(i)};"></div>
								<span class="text-white/60">{cp?.label.split(' ')[0]}</span>
								<span class="font-mono text-white/40">{sectorArea(data.sectorData).toFixed(0)}u</span>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<div class="border-t border-white/10 pt-4">
				<h4 class="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">📊 航线指标对比 <span class="text-[10px] font-normal text-white/30">({getActiveRouteLabel()})</span></h4>

				{#if comparison.size > 0}
					<div class="space-y-3">
						{#each metricList as metric}
							<div>
								<div class="flex justify-between items-center mb-1">
									<span class="text-[10px] text-white/50">{metric.label}</span>
								</div>
								<div class="space-y-1">
									{#each Array.from(comparison.entries()) as [idx, data], i}
										{@const cp = comparisonPoints.find((p: ComparisonTimePoint) => p.timeIndex === idx)}
										{@const analysis = getRouteAnalysis(data)}
										{#if analysis}
											{@const rawValue = analysis[metric.key as keyof typeof analysis]}
											{@const value = typeof rawValue === 'number' ? rawValue * metric.scale : 0}
											{@const pct = Math.min(100, value)}
											<div class="flex items-center gap-2">
												<div class="w-10 text-[9px] font-mono shrink-0 text-white/40">
													{cp?.label.split(' ')[0]}
												</div>
												<div class="flex-1 h-4 bg-black/30 rounded overflow-hidden relative">
													<div
														class="h-full transition-all duration-300"
														style="width: {pct}%; background: {getColor(i)}; opacity: 0.8;"
													></div>
													<div class="absolute inset-0 flex items-center px-1.5 text-[9px] font-mono">
														<span class="text-white/90 font-bold">
															{value.toFixed(metric.key === 'reachableRatio' || metric.key === 'blockedRatio' ? 0 : 1)}{metric.suffix}
														</span>
													</div>
												</div>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			{#if series.timeLabels.length > 2}
				<div class="border-t border-white/10 pt-4">
					<h4 class="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">📈 全时段演化曲线</h4>
					<div class="bg-black/20 rounded-lg p-3">
						<svg viewBox="0 0 300 120" preserveAspectRatio="none" class="w-full h-28">
							<line x1="0" y1="30" x2="300" y2="30" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="2,2"/>
							<line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="2,2"/>
							<line x1="0" y1="90" x2="300" y2="90" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="2,2"/>

							{#each Array.from(comparison.entries()) as [idx], i}
								{@const xPos = (idx / Math.max(1, series.timeLabels.length - 1)) * 300}
								<line x1={xPos} y1="0" x2={xPos} y2="120" stroke={getColor(i)} stroke-width="1" stroke-dasharray="3,2" opacity="0.4"/>
							{/each}

							<polyline
								fill="none"
								stroke="#22c55e"
								stroke-width="1.5"
								opacity="0.8"
								points={series.avgIntensity.map((v, i) => `${(i / Math.max(1, series.avgIntensity.length - 1)) * 300},${115 - (v / 100) * 100}`).join(' ')}
							/>

							<polyline
								fill="none"
								stroke="#3b82f6"
								stroke-width="1.5"
								opacity="0.6"
								stroke-dasharray="4,2"
								points={series.reachableRatio.map((v, i) => `${(i / Math.max(1, series.reachableRatio.length - 1)) * 300},${115 - v * 100}`).join(' ')}
							/>

							<polyline
								fill="none"
								stroke="#ef4444"
								stroke-width="1"
								opacity="0.5"
								points={series.blockedRatio.map((v, i) => `${(i / Math.max(1, series.blockedRatio.length - 1)) * 300},${115 - v * 100}`).join(' ')}
							/>

							{#each Array.from(comparison.entries()) as [idx, data], i}
							{@const analysis = getRouteAnalysis(data)}
							{#if analysis}
									<circle
										cx={(idx / Math.max(1, series.timeLabels.length - 1)) * 300}
										cy={115 - (analysis.avgIntensity / 100) * 100}
										r="4"
										fill={getColor(i)}
										stroke="white"
										stroke-width="1"
									/>
								{/if}
							{/each}
						</svg>

						<div class="flex justify-between items-center mt-2 text-[9px]">
							<div class="flex gap-3">
								<div class="flex items-center gap-1">
									<div class="w-3 h-0.5 bg-emerald-500"></div>
									<span class="text-emerald-400/70">声强</span>
								</div>
								<div class="flex items-center gap-1">
									<div class="w-3 h-0.5 bg-blue-500" style="border-style: dashed;"></div>
									<span class="text-blue-400/70">可达率</span>
								</div>
								<div class="flex items-center gap-1">
									<div class="w-3 h-0.5 bg-red-500"></div>
									<span class="text-red-400/70">遮蔽</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<div class="border-t border-white/10 pt-3">
				<button
					onclick={() => temporal.clearComparisonPoints()}
					class="w-full px-3 py-1.5 text-xs rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-all"
				>
					清空所有对比点
				</button>
			</div>
		</div>
	{/if}
</div>
