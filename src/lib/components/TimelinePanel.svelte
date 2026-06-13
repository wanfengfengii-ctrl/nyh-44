<script lang="ts">
	import { temporal, timeSnapshots, totalTimeSteps, TIDAL_PHASES, TIME_OF_DAY } from '$lib/stores/tidalStore';
	import { allRiskPeaks, temporalMetricsSeries } from '$lib/stores/propagationStore';
	import { getRiskColor } from '$lib/acoustics';

	const { currentTimeIndex, isPlaying: isPlayingStore, playbackSpeed, comparisonPoints: comparisonPointsStore } = temporal;

	let currentIdx = $derived($currentTimeIndex);
	let isPlaying = $derived($isPlayingStore);
	let playSpeed = $derived($playbackSpeed);
	let snapshots = $derived($timeSnapshots);
	let totalSteps = $derived($totalTimeSteps);
	let comparisonPoints = $derived($comparisonPointsStore);
	let peaks = $derived($allRiskPeaks);
	let series = $derived($temporalMetricsSeries);

	const currentSnapshot = $derived(snapshots[currentIdx] ?? null);

	function jumpTo(idx: number) {
		temporal.setTimeIndex(idx);
	}

	function prevStep() {
		jumpTo(Math.max(0, currentIdx - 1));
	}

	function nextStep() {
		jumpTo(Math.min(snapshots.length - 1, currentIdx + 1));
	}

	function getPeakPosition(peak: typeof peaks[number]) {
		return (peak.peakTimeIndex / Math.max(1, totalSteps - 1)) * 100;
	}

	function getComparisonPosition(idx: number) {
		return (idx / Math.max(1, totalSteps - 1)) * 100;
	}

	const playSpeedOptions = [
		{ label: '0.25×', value: 0.25 },
		{ label: '0.5×', value: 0.5 },
		{ label: '1×', value: 1 },
		{ label: '2×', value: 2 },
		{ label: '4×', value: 4 },
		{ label: '8×', value: 8 }
	];
</script>

<div class="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="text-lg font-display font-bold text-white flex items-center gap-2">
			<span class="text-emerald-400">⏱️</span> 时间轴回放
		</h3>
		{#if currentSnapshot}
			<div class="flex items-center gap-2 text-right">
				<div class="px-3 py-1 rounded-lg bg-emerald-400/10 border border-emerald-400/30">
					<span class="text-emerald-300 font-mono font-bold text-lg">{currentSnapshot.displayTime}</span>
				</div>
				<div class="text-[10px] text-white/40 font-mono">
					<div>T+{currentSnapshot.simulatedHour.toFixed(1)}h</div>
					<div>{currentIdx + 1}/{snapshots.length}</div>
				</div>
			</div>
		{/if}
	</div>

	{#if currentSnapshot}
		<div class="grid grid-cols-3 gap-2 mb-4 text-[11px]">
			<div class="bg-black/20 rounded-lg p-2">
				<div class="text-cyan-400/70 mb-0.5">潮汐</div>
				<div class="text-white/90 font-bold">
					{TIDAL_PHASES.find(p => p.value === currentSnapshot.tidal.tidalPhase)?.icon}
					{TIDAL_PHASES.find(p => p.value === currentSnapshot.tidal.tidalPhase)?.label}
				</div>
				<div class="text-cyan-300/70 text-[10px]">
					{currentSnapshot.tidal.tideLevel.toFixed(2)}m
				</div>
			</div>
			<div class="bg-black/20 rounded-lg p-2">
				<div class="text-amber-400/70 mb-0.5">海面</div>
				<div class="text-white/90 font-bold">
					{currentSnapshot.seaSurface.waveHeight.toFixed(2)}m浪
				</div>
				<div class="text-amber-300/70 text-[10px]">
					{currentSnapshot.seaSurface.seaState}
				</div>
			</div>
			<div class="bg-black/20 rounded-lg p-2">
				<div class="text-indigo-400/70 mb-0.5">时段</div>
				<div class="text-white/90 font-bold">
					{TIME_OF_DAY.find(t => t.value === currentSnapshot.dayTime.timeOfDay)?.label}
				</div>
				<div class="text-indigo-300/70 text-[10px]">
					噪声 {currentSnapshot.dayTime.ambientNoise.toFixed(0)}dB
				</div>
			</div>
		</div>
	{/if}

	<div class="flex items-center gap-2 mb-3">
		<button
			onclick={prevStep}
			class="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
			title="上一时刻"
		>
			⏮
		</button>

		<button
			onclick={() => temporal.togglePlayback()}
			class="w-12 h-9 flex items-center justify-center rounded-lg border transition-all font-bold {
				isPlaying
					? 'bg-rose-500/80 border-rose-400 text-white hover:bg-rose-500'
					: 'bg-emerald-500/80 border-emerald-400 text-white hover:bg-emerald-500'
			}"
			title={isPlaying ? '暂停' : '播放'}
		>
			{isPlaying ? '⏸' : '▶'}
		</button>

		<button
			onclick={nextStep}
			class="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
			title="下一时刻"
		>
			⏭
		</button>

		<button
			onclick={() => jumpTo(0)}
			class="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
			title="回到开始"
		>
			⏪
		</button>

		<div class="flex-1"></div>

		<div class="flex items-center gap-1">
			<span class="text-[10px] text-white/40 mr-1">速度</span>
			{#each playSpeedOptions as opt}
				<button
					onclick={() => temporal.setPlaybackSpeed(opt.value)}
					class="px-1.5 py-1 text-[10px] rounded border font-mono transition-all {
						playSpeed === opt.value
							? 'border-emerald-400 bg-emerald-400/20 text-emerald-300'
							: 'border-white/10 text-white/40 hover:bg-white/5'
					}"
				>
					{opt.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="relative mb-4">
		<div class="relative h-14 bg-black/30 rounded-lg overflow-hidden border border-white/10">
			<svg viewBox="0 0 100 40" preserveAspectRatio="none" class="absolute inset-0 w-full h-full opacity-30">
				{#if series.avgIntensity.length > 2}
					<polyline
						fill="none"
						stroke="#22c55e"
						stroke-width="0.5"
						points={series.avgIntensity.map((v, i) => `${(i / Math.max(1, series.avgIntensity.length - 1)) * 100},${40 - (v / 100) * 35}`).join(' ')}
					/>
					<polyline
						fill="none"
						stroke="#3b82f6"
						stroke-width="0.5"
						points={series.reachableRatio.map((v, i) => `${(i / Math.max(1, series.reachableRatio.length - 1)) * 100},${40 - v * 35}`).join(' ')}
						stroke-dasharray="1,1"
					/>
				{/if}
			</svg>

			{#each peaks as peak}
				<div
					class="absolute top-0 bottom-0 w-0.5 opacity-70 pointer-events-none"
					style="left: {getPeakPosition(peak)}%; background: {getRiskColor(peak.riskLevel)};"
					title={peak.description}
				>
					<div class="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full" style="background: {getRiskColor(peak.riskLevel)};"></div>
				</div>
			{/each}

			{#each comparisonPoints as cp}
				<div
					class="absolute top-0 bottom-0 border-l-2 border-dashed pointer-events-none"
					style="left: {getComparisonPosition(cp.timeIndex)}%; border-color: #fbbf24;"
					title={cp.label}
				>
					<div class="absolute top-0 -left-3 text-[9px] font-mono bg-amber-400/80 text-black px-1 rounded-sm font-bold">
						{cp.label.split(' ')[0]}
					</div>
				</div>
			{/each}

			<div
				class="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none z-10"
				style="left: {(currentIdx / Math.max(1, totalSteps - 1)) * 100}%; box-shadow: 0 0 10px rgba(255,255,255,0.5);"
			>
				<div class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white"></div>
			</div>
		</div>

		<input
			type="range"
			min="0"
			max={Math.max(0, totalSteps - 1)}
			bind:value={currentIdx}
			oninput={() => jumpTo(currentIdx)}
			class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
		/>
	</div>

	<div class="flex items-center justify-between gap-2 text-[10px] text-white/40 font-mono mb-3 px-1">
		{#each [0, 6, 12, 18, 24, 36, 48, 60, 72] as hour}
			{#if hour <= $temporal.totalSimulatedHours}
				<div class="flex flex-col items-center">
					<div>{hour.toString().padStart(2, '0')}:00</div>
					<div class="w-px h-1.5 bg-white/20 mt-0.5"></div>
				</div>
			{/if}
		{/each}
	</div>

	<div class="flex gap-2 flex-wrap">
		<button
			onclick={() => temporal.addComparisonPoint()}
			disabled={comparisonPoints.length >= 4}
			class="flex-1 min-w-[120px] px-3 py-1.5 text-xs rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed {
				comparisonPoints.length >= 4
					? 'border-white/10 text-white/30'
					: 'border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
			}"
		>
			📌 钉选当前时刻（{comparisonPoints.length}/4）
		</button>

		<button
			onclick={() => temporal.clearComparisonPoints()}
			disabled={comparisonPoints.length === 0}
			class="px-3 py-1.5 text-xs rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
		>
			清空
		</button>
	</div>

	{#if comparisonPoints.length > 0}
		<div class="mt-3 flex gap-1.5 flex-wrap">
			{#each comparisonPoints as cp}
				<div class="group relative flex items-center gap-1 px-2 py-1 bg-amber-400/10 border border-amber-400/30 rounded-lg text-[11px]">
					<button
						onclick={() => jumpTo(cp.timeIndex)}
						class="text-amber-300 hover:text-amber-200 font-medium"
					>
						{cp.label}
					</button>
					<button
						onclick={() => temporal.removeComparisonPoint(cp.timeIndex)}
						class="text-amber-400/50 hover:text-rose-400 transition-colors ml-0.5"
						title="移除"
					>
						✕
					</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if peaks.length > 0}
		<div class="mt-4 pt-3 border-t border-white/10">
			<h4 class="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center gap-2">
				<span>⚠️</span> 风险时段标记（{peaks.length}个）
			</h4>
			<div class="space-y-1.5 max-h-32 overflow-y-auto">
				{#each peaks.slice(0, 5) as peak}
					<button
						onclick={() => jumpTo(peak.peakTimeIndex)}
						class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] transition-all hover:bg-white/5 border border-transparent hover:border-white/10"
					>
						<div class="w-2 h-2 rounded-full shrink-0" style="background: {getRiskColor(peak.riskLevel)};"></div>
						<span class="font-mono text-white/50 shrink-0">
							{snapshots[peak.startTimeIndex]?.displayTime}-{snapshots[peak.endTimeIndex]?.displayTime}
						</span>
						<span class="text-white/80 truncate">{peak.description.split('：')[0]}</span>
						<span class="ml-auto font-mono text-white/40 shrink-0">
							{(peak.severity * 100).toFixed(0)}%
						</span>
					</button>
				{/each}
				{#if peaks.length > 5}
					<div class="text-[10px] text-white/30 text-center py-1">
						还有 {peaks.length - 5} 个风险时段...
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
