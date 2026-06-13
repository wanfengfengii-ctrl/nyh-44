<script lang="ts">
	import { weather } from '$lib/stores/weatherStore';
	import { alerts } from '$lib/stores/alertsStore';

	let windDirection = $state($weather.windDirection);
	let windSpeed = $state($weather.windSpeed);
	let humidity = $state($weather.humidity);
	let frequency = $state($weather.frequency);

	$effect(() => {
		windDirection = $weather.windDirection;
		windSpeed = $weather.windSpeed;
		humidity = $weather.humidity;
		frequency = $weather.frequency;
	});

	function updateField(field: 'windDirection' | 'windSpeed' | 'humidity' | 'frequency', value: number) {
		const result = weather.update({ [field]: value });
		if (!result.success) {
			alerts.showErrors(result.errors);
		}
	}

	const windPresets = [
		{ label: 'N', value: 0 },
		{ label: 'NE', value: 45 },
		{ label: 'E', value: 90 },
		{ label: 'SE', value: 135 },
		{ label: 'S', value: 180 },
		{ label: 'SW', value: 225 },
		{ label: 'W', value: 270 },
		{ label: 'NW', value: 315 }
	];

	function directionToLabel(deg: number): string {
		const normalized = ((deg % 360) + 360) % 360;
		const index = Math.round(normalized / 45) % 8;
		return windPresets[index].label;
	}
</script>

<div class="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
	<h3 class="text-lg font-display font-bold mb-4 text-white flex items-center gap-2">
		<span class="text-accent">🌊</span> 天气参数
	</h3>

	<div class="space-y-5">
		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">风向</label>
				<span class="text-sm text-accent font-body">{windDirection}° ({directionToLabel(windDirection)})</span>
			</div>
			<input
				type="range"
				min="0"
				max="360"
				bind:value={windDirection}
				oninput={() => updateField('windDirection', windDirection)}
				class="w-full accent-accent"
			/>
			<div class="mt-2 flex gap-1 flex-wrap">
				{#each windPresets as preset}
					<button
						onclick={() => updateField('windDirection', preset.value)}
						class="px-2 py-1 text-xs rounded-lg border font-body transition-all duration-200 {
							windDirection === preset.value
								? 'border-accent bg-accent/20 text-accent'
								: 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70'
						}"
					>
						{preset.label}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">风速 (m/s)</label>
				<span class="text-sm text-accent font-body">{windSpeed.toFixed(1)}</span>
			</div>
			<input
				type="range"
				min="0.1"
				max="30"
				step="0.1"
				bind:value={windSpeed}
				oninput={() => updateField('windSpeed', windSpeed)}
				class="w-full accent-accent"
			/>
		</div>

		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">空气湿度 (%)</label>
				<span class="text-sm text-accent font-body">{humidity}%</span>
			</div>
			<input
				type="range"
				min="0"
				max="100"
				bind:value={humidity}
				oninput={() => updateField('humidity', humidity)}
				class="w-full accent-accent"
			/>
		</div>

		<div>
			<div class="flex justify-between mb-2">
				<label class="text-sm font-body font-medium text-white/70">鸣钟频率 (Hz)</label>
				<span class="text-sm text-accent font-body">{frequency}</span>
			</div>
			<input
				type="range"
				min="50"
				max="2000"
				step="10"
				bind:value={frequency}
				oninput={() => updateField('frequency', frequency)}
				class="w-full accent-accent"
			/>
		</div>

		<button
			onclick={() => weather.reset()}
			class="w-full mt-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm font-body font-medium text-white/70 hover:text-white transition-all duration-200"
		>
			重置默认参数
		</button>
	</div>
</div>
