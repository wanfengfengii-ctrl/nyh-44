<script lang="ts">
	import { temporal, TIDAL_PHASES, SEA_STATES, TIME_OF_DAY } from '$lib/stores/tidalStore';
	import { temporalFactors } from '$lib/stores/propagationStore';

	let temporalParams = $derived($temporal);
	let factors = $derived($temporalFactors);

	let timeOfDayLabel = $derived(TIME_OF_DAY.find(t => t.value === temporalParams.dayTime.timeOfDay)?.label ?? '');
	let seaStateLabel = $derived(SEA_STATES.find(s => s.value === temporalParams.seaSurface.seaState)?.label ?? '');
	let tidalPhaseLabel = $derived(TIDAL_PHASES.find(p => p.value === temporalParams.tidal.tidalPhase)?.label ?? '');
</script>

<div class="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
	<h3 class="text-lg font-display font-bold mb-4 text-white flex items-center gap-2">
		<span class="text-cyan-400">🌊</span> 潮汐与海况参数
	</h3>

	<div class="space-y-5">
		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">潮位高度 (m)</label>
				<span class="text-sm text-cyan-400 font-body">{temporalParams.tidal.tideLevel.toFixed(2)} / {temporalParams.tidal.tidalRange.toFixed(1)}</span>
			</div>
			<input
				type="range"
				min="0"
				max={Math.max(temporalParams.tidal.tidalRange, 0.1)}
				step="0.01"
				bind:value={temporalParams.tidal.tideLevel}
				oninput={() => temporal.updateTidal({ tideLevel: temporalParams.tidal.tideLevel })}
				class="w-full accent-cyan-400"
			/>
		</div>

		<div>
			<label class="text-sm font-body font-medium text-white/70 block mb-2">潮汐相位</label>
			<div class="grid grid-cols-4 gap-1.5">
				{#each TIDAL_PHASES as phase}
					<button
						onclick={() => temporal.setTidalPhase(phase.value)}
						class="px-2 py-1.5 text-xs rounded-lg border font-body transition-all duration-200 flex flex-col items-center gap-0.5 {
							temporalParams.tidal.tidalPhase === phase.value
								? 'border-cyan-400 bg-cyan-400/20 text-cyan-400'
								: 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70'
						}"
						title={phase.label}
					>
						<span class="text-sm">{phase.icon}</span>
						<span>{phase.label}</span>
					</button>
				{/each}
			</div>
		</div>

		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">潮差范围 (m)</label>
				<span class="text-sm text-cyan-400 font-body">{temporalParams.tidal.tidalRange.toFixed(1)}</span>
			</div>
			<input
				type="range"
				min="0.5"
				max="8"
				step="0.1"
				bind:value={temporalParams.tidal.tidalRange}
				oninput={() => temporal.updateTidal({ tidalRange: temporalParams.tidal.tidalRange })}
				class="w-full accent-cyan-400"
			/>
		</div>

		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">潮流速度 (m/s)</label>
				<span class="text-sm text-cyan-400 font-body">{temporalParams.tidal.tidalCurrentSpeed.toFixed(2)}</span>
			</div>
			<input
				type="range"
				min="0"
				max="5"
				step="0.05"
				bind:value={temporalParams.tidal.tidalCurrentSpeed}
				oninput={() => temporal.updateTidal({ tidalCurrentSpeed: temporalParams.tidal.tidalCurrentSpeed })}
				class="w-full accent-cyan-400"
			/>
		</div>

		<div class="border-t border-white/10 my-4"></div>

		<div>
			<label class="text-sm font-body font-medium text-white/70 block mb-2">海面状态</label>
			<div class="grid grid-cols-3 gap-1.5">
				{#each SEA_STATES as state}
					<button
						onclick={() => temporal.setSeaState(state.value)}
						class="px-1.5 py-1.5 text-[10px] rounded-lg border font-body transition-all duration-200 {
							temporalParams.seaSurface.seaState === state.value
								? 'border-amber-400 bg-amber-400/20 text-amber-400'
								: 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70'
						}"
						title={state.label}
					>
						{state.label}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">浪高 (m)</label>
				<span class="text-sm text-amber-400 font-body">{temporalParams.seaSurface.waveHeight.toFixed(2)}</span>
			</div>
			<input
				type="range"
				min="0"
				max="9"
				step="0.05"
				bind:value={temporalParams.seaSurface.waveHeight}
				oninput={() => temporal.updateSeaSurface({ waveHeight: temporalParams.seaSurface.waveHeight })}
				class="w-full accent-amber-400"
			/>
		</div>

		<div class="border-t border-white/10 my-4"></div>

		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">时刻 (24h)</label>
				<span class="text-sm text-indigo-400 font-body">{Math.floor(temporalParams.dayTime.hourOfDay).toString().padStart(2, '0')}:{Math.floor((temporalParams.dayTime.hourOfDay % 1) * 60).toString().padStart(2, '0')} · {timeOfDayLabel}</span>
			</div>
			<input
				type="range"
				min="0"
				max="23.99"
				step="0.0833"
				bind:value={temporalParams.dayTime.hourOfDay}
				oninput={() => temporal.setHourOfDay(temporalParams.dayTime.hourOfDay)}
				class="w-full accent-indigo-400"
			/>
		</div>

		<div>
			<label class="text-sm font-body font-medium text-white/70 block mb-2">时段快速选择</label>
			<div class="grid grid-cols-4 gap-1.5">
				{#each TIME_OF_DAY as tod}
					<button
						onclick={() => temporal.setHourOfDay((tod.hourRange[0] + tod.hourRange[1]) / 2)}
						class="px-1 py-1.5 text-[10px] rounded-lg border font-body transition-all duration-200 {
							temporalParams.dayTime.timeOfDay === tod.value
								? 'border-indigo-400 bg-indigo-400/20 text-indigo-400'
								: 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70'
						}"
						title={tod.label}
					>
						{tod.label}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">环境噪声 (dB)</label>
				<span class="text-sm text-indigo-400 font-body">{temporalParams.dayTime.ambientNoise.toFixed(0)}</span>
			</div>
			<input
				type="range"
				min="30"
				max="90"
				step="1"
				bind:value={temporalParams.dayTime.ambientNoise}
				oninput={() => temporal.updateDayTime({ ambientNoise: temporalParams.dayTime.ambientNoise })}
				class="w-full accent-indigo-400"
			/>
		</div>

		<div class="border-t border-white/10 my-4"></div>

		<div class="bg-black/20 rounded-lg p-3 space-y-2">
			<h4 class="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">时变影响因子</h4>
			<div class="grid grid-cols-2 gap-2 text-[11px]">
				<div class="flex justify-between">
					<span class="text-white/50">潮位系数</span>
					<span class="text-cyan-300 font-mono">{factors.tideIntensityMultiplier.toFixed(3)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-white/50">海浪衰减</span>
					<span class="text-amber-300 font-mono">-{factors.waveNoisePenaltyDb.toFixed(1)}dB</span>
				</div>
				<div class="flex justify-between">
					<span class="text-white/50">环境衰减</span>
					<span class="text-indigo-300 font-mono">-{factors.ambientNoisePenaltyDb.toFixed(1)}dB</span>
				</div>
				<div class="flex justify-between">
					<span class="text-white/50">总dB修正</span>
					<span class="text-white/90 font-mono {factors.totalDbAdjustment >= 0 ? 'text-emerald-400' : 'text-red-400'}">{factors.totalDbAdjustment >= 0 ? '+' : ''}{factors.totalDbAdjustment.toFixed(1)}dB</span>
				</div>
				<div class="col-span-2 flex justify-between border-t border-white/5 pt-2">
					<span class="text-white/50">可达阈值</span>
					<span class="text-accent font-mono font-bold">{factors.effectiveThresholdDb.toFixed(1)}dB</span>
				</div>
			</div>
		</div>

		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">模拟时长 (小时)</label>
				<span class="text-sm text-white/80 font-body">{temporalParams.totalSimulatedHours}h · 步长 {temporalParams.timeStep.toFixed(1)}h</span>
			</div>
			<div class="flex gap-2">
				<input
					type="range"
					min="6"
					max="72"
					step="6"
					bind:value={temporalParams.totalSimulatedHours}
					oninput={() => temporal.update({ totalSimulatedHours: temporalParams.totalSimulatedHours })}
					class="flex-1 accent-white"
				/>
			</div>
			<div class="mt-2 flex gap-1">
				{#each [0.25, 0.5, 1, 2] as step}
					<button
						onclick={() => temporal.update({ timeStep: step })}
						class="flex-1 px-1 py-1 text-[10px] rounded border font-body transition-all duration-200 {
							temporalParams.timeStep === step
								? 'border-white/40 bg-white/10 text-white'
								: 'border-white/10 text-white/40 hover:bg-white/5 hover:text-white/60'
						}"
					>
						{step}h
					</button>
				{/each}
			</div>
		</div>

		<button
			onclick={() => temporal.reset()}
			class="w-full mt-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm font-body font-medium text-white/70 hover:text-white transition-all duration-200"
		>
			重置潮汐/海况参数
		</button>
	</div>
</div>
