<script lang="ts">
	import { routes, activeRouteId, activeRoute } from '$lib/stores/routesStore';
	import { canvas } from '$lib/stores/canvasStore';
	import { activeRouteAnalysis, totalRiskCount } from '$lib/stores/propagationStore';
	import { alerts } from '$lib/stores/alertsStore';
	import { getRiskColor } from '$lib/acoustics';
	import { points } from '$lib/stores/pointsStore';
	import type { Point } from '$lib/types';

	let newRouteName = $state('');
	let newRouteSpeed = $state(10);

	$effect(() => {
		void points;
	});

	function handleAddRoute() {
		const route = routes.addRoute(newRouteName.trim() || `航线${$routes.length + 1}`, newRouteSpeed);
		activeRouteId.set(route.id);
		canvas.setMode('editRoute');
		alerts.showSuccess(`航线 "${route.name}" 已创建。`);
		newRouteName = '';
	}

	function handleSelectRoute(id: string) {
		activeRouteId.set(id);
		canvas.selectRoute(id);
	}

	function handleDeleteRoute(id: string) {
		const route = $routes.find((r) => r.id === id);
		if (route && confirm(`确定要删除航线 "${route.name}" 吗？`)) {
			routes.removeRoute(id);
			if ($activeRouteId === id) {
				activeRouteId.set(null);
			}
			alerts.showInfo('航线已删除。');
		}
	}

	function handleEditRoute(id: string) {
		activeRouteId.set(id);
		canvas.setMode('editRoute');
	}

	function handleClearWaypoints(id: string) {
		if (confirm('确定要清空该航线的所有航点吗？')) {
			routes.clearWaypoints(id);
			alerts.showInfo('航点已清空。');
		}
	}

	function handleRemoveWaypoint(routeId: string, wpId: string) {
		routes.removeWaypoint(routeId, wpId);
	}

	function handleSetStartPoint(routeId: string, pointId: string) {
		const point = pointId ? $points.find((p) => p.id === pointId) ?? null : null;
		routes.setRouteStartPoint(routeId, point);
		if (point) {
			alerts.showSuccess(`已设置起点: ${point.label}`);
		}
	}

	function handleSetEndPoint(routeId: string, pointId: string) {
		const point = pointId ? $points.find((p) => p.id === pointId) ?? null : null;
		routes.setRouteEndPoint(routeId, point);
		if (point) {
			alerts.showSuccess(`已设置终点: ${point.label}`);
		}
	}

	function getPorts(): Point[] {
		return $points.filter((p) => p.type === 'port');
	}

	function getShips(): Point[] {
		return $points.filter((p) => p.type === 'ship');
	}

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${seconds.toFixed(0)}秒`;
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}分${secs}秒`;
	}

	function getRiskLabel(level: string): string {
		switch (level) {
			case 'critical': return '严重';
			case 'high': return '高';
			case 'medium': return '中';
			case 'low': return '低';
			default: return level;
		}
	}
</script>

<div class="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
	<h3 class="text-lg font-display font-bold mb-4 text-white flex items-center gap-2">
		<span class="text-accent">🧭</span> 航线管理
	</h3>

	<div class="space-y-4">
		<div>
			<div class="text-xs font-body font-medium text-white/50 mb-2 uppercase tracking-wider">新建航线</div>
			<div class="space-y-2">
				<input
					type="text"
					bind:value={newRouteName}
					placeholder="航线名称（可选）"
					class="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm font-body text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-colors"
				/>
				<div class="flex gap-2 items-center">
					<label class="text-xs text-white/50 font-body whitespace-nowrap">航速:</label>
					<input
						type="number"
						bind:value={newRouteSpeed}
						min="1"
						max="100"
						class="flex-1 px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 text-sm font-body text-white focus:outline-none focus:border-accent/50 transition-colors"
					/>
					<span class="text-xs text-white/40 font-body">m/s</span>
				</div>
				<button
					onclick={handleAddRoute}
					class="w-full px-4 py-2 bg-accent text-ocean-deep rounded-lg text-sm font-body font-bold hover:bg-accent-light transition-colors"
				>
					创建航线
				</button>
			</div>
		</div>

		<div>
			<div class="flex justify-between items-center mb-2">
				<div class="text-xs font-body font-medium text-white/50 uppercase tracking-wider">航线列表 ({$routes.length})</div>
				{#if $totalRiskCount.total > 0}
					<div class="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-body">
						{$totalRiskCount.critical + $totalRiskCount.high} 项风险
					</div>
				{/if}
			</div>
			<div class="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
				{#if $routes.length === 0}
					<div class="text-xs text-white/30 py-6 text-center font-body">暂无航线</div>
				{/if}
				{#each $routes as route (route.id)}
					{@const analysis = $activeRouteAnalysis && route.id === $activeRouteId ? $activeRouteAnalysis : null}
					<div
						class="p-3 rounded-lg border transition-all duration-200 {
							$activeRouteId === route.id
								? 'border-accent/50 bg-accent/5'
								: 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
						}"
					>
						<div class="flex items-center justify-between mb-2">
							<button
								onclick={() => handleSelectRoute(route.id)}
								class="flex-1 text-left"
							>
								<div class="font-body font-medium text-sm text-white/90">{route.name}</div>
							</button>
							<div class="flex gap-1">
								<button
									onclick={() => handleEditRoute(route.id)}
									class="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 font-body transition-colors"
									title="编辑航线"
								>
									编辑
								</button>
								<button
									onclick={() => handleDeleteRoute(route.id)}
									class="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-body transition-colors"
									title="删除航线"
								>
									删除
								</button>
							</div>
						</div>

						<div class="text-xs text-white/50 font-body mb-2">
							{route.waypoints.length} 个航点 · 航速 {route.speed} m/s
							{#if analysis}
								· 总距离 {analysis.totalDistance.toFixed(0)}m
							{/if}
						</div>

						<div class="space-y-1.5 mb-2">
							<div class="flex items-center gap-2">
								<span class="text-[10px] text-white/40 font-body w-10">起点:</span>
								<select
									value={route.startPointId ?? ''}
									onchange={(e) => handleSetStartPoint(route.id, (e.target as HTMLSelectElement).value)}
									class="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-white/80 focus:outline-none focus:border-accent/50 font-body"
								>
									<option value="">-- 选择港口 --</option>
									{#each getPorts() as port (port.id)}
										<option value={port.id}>⚓ {port.label}</option>
									{/each}
								</select>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-[10px] text-white/40 font-body w-10">终点:</span>
								<select
									value={route.endPointId ?? ''}
									onchange={(e) => handleSetEndPoint(route.id, (e.target as HTMLSelectElement).value)}
									class="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-white/80 focus:outline-none focus:border-accent/50 font-body"
								>
									<option value="">-- 选择船只/目标 --</option>
									{#each getShips() as ship (ship.id)}
										<option value={ship.id}>⛵ {ship.label}</option>
									{/each}
								</select>
							</div>
						</div>

						{#if analysis && analysis.segments.length > 0}
							<div class="grid grid-cols-3 gap-1 mb-2">
								<div class="text-center p-1.5 rounded bg-emerald-500/10">
									<div class="text-[10px] text-emerald-400 font-body">可达率</div>
									<div class="text-sm font-bold text-emerald-400 font-display">
										{(analysis.reachableRatio * 100).toFixed(0)}%
									</div>
								</div>
								<div class="text-center p-1.5 rounded bg-red-500/10">
									<div class="text-[10px] text-red-400 font-body">遮蔽率</div>
									<div class="text-sm font-bold text-red-400 font-display">
										{(analysis.blockedRatio * 100).toFixed(0)}%
									</div>
								</div>
								<div class="text-center p-1.5 rounded bg-white/5">
									<div class="text-[10px] text-white/50 font-body">平均声强</div>
									<div class="text-sm font-bold text-white/70 font-display">
										{analysis.avgIntensity.toFixed(0)}%
									</div>
								</div>
							</div>

							{#if analysis.riskAlerts.length > 0}
								<div class="space-y-1">
									<div class="text-[10px] text-white/40 font-body uppercase">风险预警</div>
									{#each analysis.riskAlerts.slice(0, 3) as alert (alert.id)}
										<div
											class="text-[11px] px-2 py-1 rounded font-body flex items-center gap-1.5"
											style="background-color: {getRiskColor(alert.level)}20; color: {getRiskColor(alert.level)}"
										>
											<span class="w-1.5 h-1.5 rounded-full" style="background-color: {getRiskColor(alert.level)}"></span>
											<span class="font-medium">{getRiskLabel(alert.level)}</span>
											<span class="opacity-70 truncate">{alert.description}</span>
										</div>
									{/each}
									{#if analysis.riskAlerts.length > 3}
										<div class="text-[10px] text-white/40 font-body text-center">
											还有 {analysis.riskAlerts.length - 3} 项风险...
										</div>
									{/if}
								</div>
							{/if}
						{/if}

						{#if route.waypoints.length > 0}
							<details class="mt-2">
								<summary class="text-[11px] text-white/40 cursor-pointer hover:text-white/60 font-body">
									查看航点列表
								</summary>
								<div class="mt-2 space-y-1 max-h-32 overflow-y-auto">
									{#each route.waypoints as wp (wp.id)}
										<div class="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-white/5">
											<span class="w-2 h-2 rotate-45 bg-cyan-400"></span>
											<span class="text-white/60 font-body flex-1">{wp.label}</span>
											<span class="text-white/30 font-mono text-[10px]">
												({wp.x.toFixed(0)},{wp.y.toFixed(0)})
											</span>
											<button
												onclick={() => handleRemoveWaypoint(route.id, wp.id)}
												class="text-red-400/50 hover:text-red-400 transition-colors"
											>
												×
											</button>
										</div>
									{/each}
								</div>
								<button
									onclick={() => handleClearWaypoints(route.id)}
									class="mt-2 w-full text-[10px] py-1 text-white/40 hover:text-red-400 font-body transition-colors"
								>
									清空所有航点
								</button>
							</details>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
