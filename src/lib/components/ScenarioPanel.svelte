<script lang="ts">
	import { scenarios } from '$lib/stores/scenarioStore';
	import type { SavedScenario } from '$lib/types';
	import { alerts } from '$lib/stores/alertsStore';

	let scenarioName = $state('');
	let showImport = $state(false);
	let importText = $state('');

	function handleSave() {
		scenarios.save(scenarioName);
		scenarioName = '';
	}

	function handleLoad(s: SavedScenario) {
		scenarios.load(s);
	}

	function handleDelete(s: SavedScenario) {
		if (confirm(`确定要删除方案 "${s.name}" 吗？`)) {
			scenarios.remove(s.id);
		}
	}

	function handleExport(s: SavedScenario) {
		const json = scenarios.export(s);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${s.name}.json`;
		a.click();
		URL.revokeObjectURL(url);
		alerts.showSuccess(`方案 "${s.name}" 已导出。`);
	}

	function handleImport() {
		const result = scenarios.import(importText);
		if (result) {
			showImport = false;
			importText = '';
		}
	}

	function formatDate(ts: number): string {
		const d = new Date(ts);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}
</script>

<div class="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
	<h3 class="text-lg font-display font-bold mb-4 text-white flex items-center gap-2">
		<span class="text-accent">🗺</span> 方案管理
	</h3>

	<div class="space-y-3">
		<div>
			<label class="text-xs font-body font-medium text-white/50 block mb-1 uppercase tracking-wider">保存当前方案</label>
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={scenarioName}
					placeholder="输入方案名称..."
					class="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm font-body text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-colors"
				/>
				<button
					onclick={handleSave}
					class="px-4 py-2 bg-accent text-ocean-deep rounded-lg text-sm font-body font-bold hover:bg-accent-light transition-colors"
				>
					保存
				</button>
			</div>
		</div>

		<button
			onclick={() => (showImport = !showImport)}
			class="w-full px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm font-body font-medium text-white/70 hover:text-white transition-all duration-200"
		>
			{showImport ? '取消导入' : '导入方案 JSON'}
		</button>

		{#if showImport}
			<div class="space-y-2">
				<textarea
					bind:value={importText}
					placeholder="粘贴 JSON 数据..."
					class="w-full h-24 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-accent/50 resize-none transition-colors"
				></textarea>
				<button
					onclick={handleImport}
					class="w-full px-4 py-2 bg-ocean-surface/20 border border-ocean-surface/30 text-ocean-surface rounded-lg text-sm font-body font-medium hover:bg-ocean-surface/30 transition-colors"
				>
					确认导入
				</button>
			</div>
		{/if}

		<div>
			<div class="text-xs font-body font-medium text-white/50 mb-2 uppercase tracking-wider">已保存方案 ({$scenarios.length})</div>
			<div class="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
				{#if $scenarios.length === 0}
					<div class="text-xs text-white/30 py-4 text-center font-body">暂无保存的方案</div>
				{/if}
				{#each $scenarios as s (s.id)}
					<div class="p-3 rounded-lg border border-white/10 hover:border-accent/20 bg-white/[0.02] transition-all duration-200">
						<div class="flex justify-between items-start mb-1">
							<div class="font-body font-medium text-sm truncate text-white/90">{s.name}</div>
						</div>
						<div class="text-xs text-white/40 mb-2 font-body">
							{formatDate(s.createdAt)} · {s.points.length} 点位 · {s.cliffs.length} 岩壁
						</div>
						<div class="flex gap-1">
							<button
								onclick={() => handleLoad(s)}
								class="flex-1 px-2 py-1 text-xs bg-ocean-surface/15 text-ocean-surface rounded hover:bg-ocean-surface/25 transition-colors font-body"
							>
								加载
							</button>
							<button
								onclick={() => handleExport(s)}
								class="flex-1 px-2 py-1 text-xs bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors font-body"
							>
								导出
							</button>
							<button
								onclick={() => handleDelete(s)}
								class="flex-1 px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors font-body"
							>
								删除
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<button
			onclick={() => scenarios.clearAll()}
			class="w-full px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-body font-medium transition-colors"
		>
			清空画布
		</button>
	</div>
</div>
