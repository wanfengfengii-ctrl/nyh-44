<script lang="ts">
	import { points, allSources, soundSources } from '$lib/stores/pointsStore';
	import { cliffs } from '$lib/stores/cliffsStore';
	import { canvas } from '$lib/stores/canvasStore';
	import { propagationResults, getIntensityColor } from '$lib/stores/propagationStore';
	import type { PointType, CanvasMode } from '$lib/types';
	import { alerts } from '$lib/stores/alertsStore';

	const tools: { mode: CanvasMode; label: string; icon: string; color: string }[] = [
		{ mode: 'select', label: '选择', icon: '↖', color: 'bg-gray-500' },
		{ mode: 'addLighthouse', label: '灯塔', icon: '🔔', color: 'bg-yellow-500' },
		{ mode: 'addFoghorn', label: '雾号', icon: '📯', color: 'bg-orange-500' },
		{ mode: 'addCoast', label: '海岸', icon: '🏖', color: 'bg-blue-500' },
		{ mode: 'addPort', label: '港口', icon: '⚓', color: 'bg-purple-500' },
		{ mode: 'addShip', label: '船只', icon: '⛵', color: 'bg-cyan-500' },
		{ mode: 'addCliff', label: '岩壁', icon: '⛰', color: 'bg-stone-600' },
		{ mode: 'editRoute', label: '航线', icon: '🧭', color: 'bg-cyan-600' }
	];

	let editingSourceId = $state<string | null>(null);
	let editFrequency = $state(500);
	let editSourceLevel = $state(80);

	function getTypeLabel(type: PointType): string {
		switch (type) {
			case 'lighthouse':
				return '灯塔';
			case 'foghorn':
				return '雾号';
			case 'coast':
				return '海岸';
			case 'port':
				return '港口';
			case 'ship':
				return '船只';
		}
	}

	function getResultForPoint(pointId: string) {
		return $propagationResults.find((r) => r.pointId === pointId);
	}

	function handleDeletePoint(id: string) {
		points.removePoint(id);
		canvas.clearSelection();
		if (editingSourceId === id) {
			editingSourceId = null;
		}
		alerts.showInfo('点位已删除。');
	}

	function handleDeleteCliff(id: string) {
		cliffs.removeCliff(id);
		canvas.clearSelection();
		alerts.showInfo('岩壁已删除。');
	}

	function toggleSource(id: string) {
		points.toggleSourceEnabled(id);
	}

	function startEditSource(id: string) {
		const source = $allSources.find((s) => s.id === id);
		if (source?.sourceParams) {
			editingSourceId = id;
			editFrequency = source.sourceParams.frequency;
			editSourceLevel = source.sourceParams.sourceLevel;
		}
	}

	function saveSourceParams() {
		if (!editingSourceId) return;
		points.updateSourceParams(editingSourceId, {
			frequency: editFrequency,
			sourceLevel: editSourceLevel
		});
		alerts.showSuccess('声源参数已更新。');
		editingSourceId = null;
	}

	function cancelEditSource() {
		editingSourceId = null;
	}
</script>

<div class="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
	<h3 class="text-lg font-display font-bold mb-4 text-white flex items-center gap-2">
		<span class="text-accent">⚓</span> 点位与工具
	</h3>

	<div class="mb-4">
		<div class="text-xs font-body font-medium text-white/50 mb-2 uppercase tracking-wider">绘图工具</div>
		<div class="grid grid-cols-4 gap-2">
			{#each tools as tool}
				<button
					onclick={() => canvas.setMode(tool.mode)}
					class="flex flex-col items-center gap-1 p-2 rounded-lg border transition-all duration-200 {
						$canvas.mode === tool.mode
							? 'border-accent bg-accent/15 text-accent shadow-lg shadow-accent/10'
							: 'border-white/10 hover:bg-white/5 text-white/70'
					}"
				>
					<span class="text-lg">{tool.icon}</span>
					<span class="text-[10px] font-body">{tool.label}</span>
				</button>
			{/each}
		</div>
		{#if $canvas.mode !== 'select'}
			<p class="text-xs text-sea-fog mt-2 font-body">
				{#if $canvas.mode === 'addCliff'}
					在画布上点击并拖动绘制岩壁。
				{:else if $canvas.mode === 'editRoute'}
					在画布上点击添加航点。
				{:else}
					在画布上点击放置点位。
				{/if}
			</p>
		{/if}
	</div>

	<div class="mb-4">
		<div class="flex justify-between items-center mb-2">
			<div class="text-xs font-body font-medium text-white/50 uppercase tracking-wider">声源列表 ({$soundSources.length}/{$allSources.length})</div>
		</div>
		<div class="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
			{#if $allSources.length === 0}
				<div class="text-xs text-white/30 py-4 text-center font-body">暂无声源</div>
			{/if}
			{#each $allSources as source (source.id)}
				<div
					class="p-2 rounded-lg text-sm transition-all duration-200 {
						$canvas.selectedId === source.id && $canvas.selectedType === 'point'
							? 'bg-accent/10 border border-accent/40'
							: 'border border-transparent hover:bg-white/5'
					}"
				>
					<div class="flex items-center gap-2">
						<button
							onclick={() => canvas.selectPoint(source.id)}
							class="flex items-center gap-2 flex-1 min-w-0 text-left"
						>
							<span class="text-xs">{source.type === 'lighthouse' ? '🔔' : '📯'}</span>
							<div class="flex-1 min-w-0">
								<div class="font-body font-medium truncate text-white/90">{source.label}</div>
								<div class="text-xs text-white/50 font-body">{getTypeLabel(source.type)}</div>
							</div>
						</button>
						<button
							onclick={() => toggleSource(source.id)}
							class="text-xs px-2 py-0.5 rounded font-body transition-colors {
								source.sourceParams?.enabled !== false
									? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
									: 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
							}"
							title={source.sourceParams?.enabled !== false ? '点击禁用' : '点击启用'}
						>
							{source.sourceParams?.enabled !== false ? '开启' : '关闭'}
						</button>
						<button
							onclick={() => startEditSource(source.id)}
							class="text-xs px-2 py-0.5 rounded bg-white/10 text-white/70 hover:bg-white/20 font-body transition-colors"
						>
							编辑
						</button>
						<button
							onclick={() => handleDeletePoint(source.id)}
							class="text-red-400/60 hover:text-red-400 text-lg leading-none px-1 transition-colors"
						>
							×
						</button>
					</div>
					{#if source.sourceParams}
						<div class="mt-1.5 text-[10px] text-white/40 font-mono flex gap-3">
							<span>频率: {source.sourceParams.frequency}Hz</span>
							<span>声级: {source.sourceParams.sourceLevel}dB</span>
						</div>
					{/if}
				</div>

				{#if editingSourceId === source.id}
					<div class="p-3 rounded-lg bg-ocean-deep/50 border border-accent/20 mt-1 space-y-3">
						<div>
							<div class="flex justify-between mb-1">
								<label class="text-xs font-body text-white/60">频率 (Hz)</label>
								<span class="text-xs text-accent font-mono">{editFrequency}</span>
							</div>
							<input
								type="range"
								min="50"
								max="2000"
								step="10"
								bind:value={editFrequency}
								class="w-full accent-accent"
							/>
						</div>
						<div>
							<div class="flex justify-between mb-1">
								<label class="text-xs font-body text-white/60">声源级 (dB)</label>
								<span class="text-xs text-accent font-mono">{editSourceLevel}</span>
							</div>
							<input
								type="range"
								min="50"
								max="120"
								step="1"
								bind:value={editSourceLevel}
								class="w-full accent-accent"
							/>
						</div>
						<div class="flex gap-2">
							<button
								onclick={saveSourceParams}
								class="flex-1 px-3 py-1.5 bg-accent text-ocean-deep rounded text-xs font-bold font-body hover:bg-accent-light transition-colors"
							>
								保存
							</button>
							<button
								onclick={cancelEditSource}
								class="flex-1 px-3 py-1.5 bg-white/10 text-white/70 rounded text-xs font-body hover:bg-white/20 transition-colors"
							>
								取消
							</button>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>

	<div class="mb-4">
		<div class="flex justify-between items-center mb-2">
			<div class="text-xs font-body font-medium text-white/50 uppercase tracking-wider">目标点位</div>
		</div>
		<div class="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
			{#each $points.filter((p) => p.type !== 'lighthouse' && p.type !== 'foghorn') as point (point.id)}
				{@const result = getResultForPoint(point.id)}
				<div
					class="flex items-center gap-2 p-2 rounded-lg text-sm cursor-pointer transition-all duration-200 {
						$canvas.selectedId === point.id && $canvas.selectedType === 'point'
							? 'bg-accent/10 border border-accent/40'
							: 'border border-transparent hover:bg-white/5'
					}"
					onclick={() => canvas.selectPoint(point.id)}
				>
					<span class="text-xs">{point.type === 'coast' ? '🏖' : point.type === 'port' ? '⚓' : '⛵'}</span>
					<div class="flex-1 min-w-0">
						<div class="font-body font-medium truncate text-white/90">{point.label}</div>
						<div class="text-xs text-white/50 font-body">{getTypeLabel(point.type)}</div>
					</div>
					{#if result}
						{#if result.isBlocked}
							<span class="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-body">遮蔽</span>
						{:else if result.isReachable}
							<span
								class="text-xs px-2 py-0.5 rounded-full font-body text-white"
								style="background-color: {getIntensityColor(result.intensity)}"
							>
								{result.intensity.toFixed(0)}%
							</span>
						{:else}
							<span class="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40 font-body">弱</span>
						{/if}
					{/if}
					<button
						onclick={(e) => {
							e.stopPropagation();
							handleDeletePoint(point.id);
						}}
						class="text-red-400/60 hover:text-red-400 text-lg leading-none px-1 transition-colors"
					>
						×
					</button>
				</div>
			{/each}
		</div>
	</div>

	<div>
		<div class="flex justify-between items-center mb-2">
			<div class="text-xs font-body font-medium text-white/50 uppercase tracking-wider">岩壁列表 ({$cliffs.length})</div>
		</div>
		<div class="max-h-24 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
			{#if $cliffs.length === 0}
				<div class="text-xs text-white/30 py-3 text-center font-body">暂无岩壁</div>
			{/if}
			{#each $cliffs as cliff (cliff.id)}
				<div
					class="flex items-center gap-2 p-2 rounded-lg text-sm cursor-pointer transition-all duration-200 {
						$canvas.selectedId === cliff.id && $canvas.selectedType === 'cliff'
							? 'bg-accent/10 border border-accent/40'
							: 'border border-transparent hover:bg-white/5'
					}"
					onclick={() => canvas.selectCliff(cliff.id)}
				>
					<span class="text-xs">⛰</span>
					<div class="flex-1 min-w-0">
						<div class="font-body font-medium truncate text-white/90">岩壁</div>
						<div class="text-xs text-white/50 font-body">
							({cliff.x1.toFixed(0)},{cliff.y1.toFixed(0)}) → ({cliff.x2.toFixed(0)},{cliff.y2.toFixed(0)})
						</div>
					</div>
					<button
						onclick={(e) => {
							e.stopPropagation();
							handleDeleteCliff(cliff.id);
						}}
						class="text-red-400/60 hover:text-red-400 text-lg leading-none px-1 transition-colors"
					>
						×
					</button>
				</div>
			{/each}
		</div>
	</div>
</div>
