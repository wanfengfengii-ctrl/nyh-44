<script lang="ts">
	import { onMount } from 'svelte';
	import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
	import { points, soundSources, allSources } from '$lib/stores/pointsStore';
	import { cliffs } from '$lib/stores/cliffsStore';
	import { canvas } from '$lib/stores/canvasStore';
	import { propagationResults, perSourceSectors, getIntensityColor, activeRouteAnalysis, routeAnalysisResults, temporalPropagationResults, temporalPerSourceSectors, temporalRouteAnalysisResults, temporalActiveRouteAnalysis } from '$lib/stores/propagationStore';
	import { routes, activeRoute, activeRouteId } from '$lib/stores/routesStore';
	import { weather } from '$lib/stores/weatherStore';
	import { alerts } from '$lib/stores/alertsStore';
	import { temporal, currentSnapshot, TIDAL_PHASES, TIME_OF_DAY } from '$lib/stores/tidalStore';
	import type { PointType } from '$lib/types';
	import { getRiskColor } from '$lib/acoustics';

	const CANVAS_WIDTH = 800;
	const CANVAS_HEIGHT = 600;

	let container: HTMLDivElement;
	let cy = $state<Core | null>(null);
	let isDrawingCliff = $state(false);
	let cliffStartX = $state(0);
	let cliffStartY = $state(0);
	let tempCliffId = $state<string | null>(null);

	const { temporalMode: temporalModeStore } = temporal;
	let temporalModeEnabled = $derived($temporalModeStore);

	function toggleTemporalMode() {
		temporalModeStore.set(!$temporalModeStore);
	}

	let effectivePropagationResults = $derived(
		temporalModeEnabled ? $temporalPropagationResults : $propagationResults
	);
	let effectivePerSourceSectors = $derived(
		temporalModeEnabled ? $temporalPerSourceSectors : $perSourceSectors
	);
	let effectiveRouteAnalysisResults = $derived(
		temporalModeEnabled ? $temporalRouteAnalysisResults : $routeAnalysisResults
	);
	let effectiveActiveRouteAnalysis = $derived(
		temporalModeEnabled ? $temporalActiveRouteAnalysis : $activeRouteAnalysis
	);
	let currentSnap = $derived($currentSnapshot);

	let modeLabel = $derived.by(() => {
		const mode = $canvas.mode;
		if (mode === 'select') return '选择模式';
		if (mode === 'addCliff') return isDrawingCliff ? '点击确定岩壁终点' : '点击设置岩壁起点';
		if (mode === 'editRoute') {
			if (!$activeRoute) return '请先选择或创建航线';
			return '点击画布添加航点';
		}
		if (mode === 'addFoghorn') return '点击放置雾号';
		return '点击画布放置点位';
	});

	function getPointColor(type: PointType): string {
		switch (type) {
			case 'lighthouse': return '#FFD700';
			case 'foghorn': return '#f97316';
			case 'coast': return '#3b82f6';
			case 'port': return '#8b5cf6';
			case 'ship': return '#06b6d4';
		}
	}

	function getPointShape(type: PointType): string {
		switch (type) {
			case 'lighthouse': return 'star';
			case 'foghorn': return 'triangle';
			default: return 'ellipse';
		}
	}

	function getResultForPoint(pointId: string) {
		return effectivePropagationResults.find((r) => r.pointId === pointId);
	}

	function renderAll() {
		if (!cy) return;

		cy.elements().remove();

		const elements: ElementDefinition[] = [];

		renderSectorOverlays(elements);
		renderRoutes(elements);
		renderCliffs(elements);
		renderPoints(elements);

		cy.add(elements);

		renderWindIndicator();
		renderTemporalOverlay();
	}

	function renderSectorOverlays(elements: ElementDefinition[]) {
		const sectors = effectivePerSourceSectors;
		const sources = $allSources;

		let svgContent = '';

		for (const source of sources) {
			const sector = sectors.get(source.id);
			if (!sector || sector.length === 0) continue;
			if (source.sourceParams?.enabled === false) continue;

			for (let i = 0; i < sector.length; i++) {
				const sample = sector[i];
				const nextSample = sector[(i + 1) % sector.length];
				const color = getIntensityColor(sample.intensity);

				const rad1 = ((90 - sample.angle) * Math.PI) / 180;
				const rad2 = ((90 - nextSample.angle) * Math.PI) / 180;

				const r = sample.maxDistance;
				if (r <= 0) continue;

				const x1 = source.x + Math.cos(rad1) * r;
				const y1 = source.y + Math.sin(rad1) * r;
				const x2 = source.x + Math.cos(rad2) * r;
				const y2 = source.y + Math.sin(rad2) * r;

				svgContent += `<path d="M ${source.x} ${source.y} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-opacity="0.3" stroke-width="1"/>`;
			}
		}

		if (svgContent) {
			elements.push({
				group: 'nodes',
				data: { id: 'sector-overlay' },
				position: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
				style: {
					width: CANVAS_WIDTH,
					height: CANVAS_HEIGHT,
					'background-image': `data:image/svg+xml;utf8,${encodeURIComponent(
						`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}">${svgContent}</svg>`
					)}`,
					'background-width': '100%',
					'background-height': '100%',
					shape: 'rectangle',
					opacity: 1,
					'z-index': -10
				}
			});
		}
	}

	function renderRoutes(elements: ElementDefinition[]) {
		const allRoutes = $routes;
		const analysisMap = effectiveRouteAnalysisResults;

		for (const route of allRoutes) {
			if (route.waypoints.length < 2) {
				for (let i = 0; i < route.waypoints.length; i++) {
					const wp = route.waypoints[i];
					elements.push({
						group: 'nodes',
						data: {
							id: `wp-${wp.id}`,
							label: wp.label,
							waypointId: wp.id,
							routeId: route.id
						},
						position: { x: wp.x, y: wp.y },
						style: {
							'background-color': '#22d3ee',
							'border-color': route.id === $activeRouteId ? '#06b6d4' : '#0891b2',
							'border-width': route.id === $activeRouteId ? 3 : 2,
							width: 14,
							height: 14,
							shape: 'diamond',
							label: 'data(label)',
							'font-size': 9,
							'text-valign': 'bottom',
							'text-margin-y': 3,
							color: '#67e8f9',
							'text-outline-width': 2,
							'text-outline-color': '#0c4a6e',
							'z-index': 50
						}
					});
				}
				continue;
			}

			const analysis = analysisMap.get(route.id);
			const segments = analysis?.segments ?? [];

			for (let i = 0; i < route.waypoints.length - 1; i++) {
				const start = route.waypoints[i];
				const end = route.waypoints[i + 1];
				const segDist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);

				if (segments.length > 0) {
					const steps = 20;
					for (let s = 0; s < steps; s++) {
						const t1 = s / steps;
						const t2 = (s + 1) / steps;
						const x1 = start.x + (end.x - start.x) * t1;
						const y1 = start.y + (end.y - start.y) * t1;
						const x2 = start.x + (end.x - start.x) * t2;
						const y2 = start.y + (end.y - start.y) * t2;

						const sampleIdx = Math.floor((i + t1) * (segments.length / (route.waypoints.length - 1)));
						const seg = segments[Math.min(sampleIdx, segments.length - 1)];

						let lineColor = '#22d3ee';
						if (seg) {
							if (seg.isBlocked) {
								lineColor = '#ef4444';
							} else if (!seg.isReachable) {
								lineColor = '#f97316';
							} else {
								lineColor = getIntensityColor(seg.intensity);
							}
						}

						const startNodeId = `route-${route.id}-seg-${i}-${s}-start`;
						const endNodeId = `route-${route.id}-seg-${i}-${s}-end`;

						elements.push({
							group: 'nodes',
							data: { id: startNodeId },
							position: { x: x1, y: y1 },
							style: { width: 1, height: 1, opacity: 0 }
						});
						elements.push({
							group: 'nodes',
							data: { id: endNodeId },
							position: { x: x2, y: y2 },
							style: { width: 1, height: 1, opacity: 0 }
						});
						elements.push({
							group: 'edges',
							data: {
								id: `route-${route.id}-seg-${i}-${s}`,
								source: startNodeId,
								target: endNodeId,
								routeId: route.id
							},
							style: {
								'line-color': lineColor,
								width: route.id === $activeRouteId ? 4 : 3,
								'line-style': 'solid',
								'target-arrow-shape': 'none',
								'source-arrow-shape': 'none',
								'curve-style': 'straight',
								opacity: route.id === $activeRouteId ? 0.9 : 0.6,
								'z-index': 20
							}
						});
					}
				} else {
					const startNodeId = `route-${route.id}-start-${i}`;
					const endNodeId = `route-${route.id}-end-${i}`;

					elements.push({
						group: 'nodes',
						data: { id: startNodeId },
						position: { x: start.x, y: start.y },
						style: { width: 1, height: 1, opacity: 0 }
					});
					elements.push({
						group: 'nodes',
						data: { id: endNodeId },
						position: { x: end.x, y: end.y },
						style: { width: 1, height: 1, opacity: 0 }
					});
					elements.push({
						group: 'edges',
						data: {
							id: `route-${route.id}-edge-${i}`,
							source: startNodeId,
							target: endNodeId,
							routeId: route.id
						},
						style: {
							'line-color': '#22d3ee',
							width: route.id === $activeRouteId ? 4 : 3,
							'line-style': 'solid',
							'target-arrow-shape': 'none',
							'source-arrow-shape': 'none',
							'curve-style': 'straight',
							opacity: route.id === $activeRouteId ? 0.9 : 0.6,
							'z-index': 20
						}
					});
				}
			}

			for (let i = 0; i < route.waypoints.length; i++) {
				const wp = route.waypoints[i];
				const isStart = i === 0;
				const isEnd = i === route.waypoints.length - 1;

				elements.push({
					group: 'nodes',
					data: {
						id: `wp-${wp.id}`,
						label: wp.label,
						waypointId: wp.id,
						routeId: route.id
					},
					position: { x: wp.x, y: wp.y },
					style: {
						'background-color': isStart ? '#22c55e' : isEnd ? '#ef4444' : '#22d3ee',
						'border-color': route.id === $activeRouteId ? '#06b6d4' : '#0891b2',
						'border-width': route.id === $activeRouteId ? 3 : 2,
						width: isStart || isEnd ? 18 : 14,
						height: isStart || isEnd ? 18 : 14,
						shape: isStart ? 'triangle' : isEnd ? 'triangle' : 'diamond',
						label: 'data(label)',
						'font-size': 9,
						'text-valign': 'bottom',
						'text-margin-y': 3,
						color: '#67e8f9',
						'text-outline-width': 2,
						'text-outline-color': '#0c4a6e',
						'z-index': 50
					}
				});
			}
		}
	}

	function renderCliffs(elements: ElementDefinition[]) {
		$cliffs.forEach((c) => {
			elements.push({
				group: 'edges',
				data: {
					id: `cliff-${c.id}`,
					source: `cliff-start-${c.id}`,
					target: `cliff-end-${c.id}`,
					cliffId: c.id
				},
				style: {
					'line-color': '#78716c',
					'width': c.thickness,
					'line-style': 'solid',
					'target-arrow-shape': 'none',
					'source-arrow-shape': 'none',
					'curve-style': 'straight',
					'z-index': 5
				}
			});
			elements.push({
				group: 'nodes',
				data: { id: `cliff-start-${c.id}` },
				position: { x: c.x1, y: c.y1 },
				style: { width: 1, height: 1, opacity: 0 }
			});
			elements.push({
				group: 'nodes',
				data: { id: `cliff-end-${c.id}` },
				position: { x: c.x2, y: c.y2 },
				style: { width: 1, height: 1, opacity: 0 }
			});
		});
	}

	function renderPoints(elements: ElementDefinition[]) {
		$points.forEach((p) => {
			const result = (p.type !== 'lighthouse' && p.type !== 'foghorn') ? getResultForPoint(p.id) : null;
			let borderColor = '#ffffff';
			let borderWidth = 2;

			const isSource = p.type === 'lighthouse' || p.type === 'foghorn';
			const isEnabled = p.sourceParams?.enabled !== false;

			if (isSource && !isEnabled) {
				borderColor = '#6b7280';
				borderWidth = 2;
			} else if (result) {
				if (result.isBlocked) {
					borderColor = '#ef4444';
					borderWidth = 4;
				} else if (result.isReachable) {
					borderColor = getIntensityColor(result.intensity);
					borderWidth = 4;
				}
			}

			elements.push({
				group: 'nodes',
				data: {
					id: `point-${p.id}`,
					label: p.label,
					type: p.type,
					pointId: p.id,
					isSource,
					isEnabled
				},
				position: { x: p.x, y: p.y },
				style: {
					'background-color': getPointColor(p.type),
					'border-color': borderColor,
					'border-width': borderWidth,
					label: 'data(label)',
					'font-size': 10,
					'text-valign': 'bottom',
					'text-margin-y': 4,
					'color': '#1f2937',
					'text-outline-width': 2,
					'text-outline-color': '#ffffff',
					width: isSource ? 30 : 22,
					height: isSource ? 30 : 22,
					shape: getPointShape(p.type),
					opacity: isSource && !isEnabled ? 0.4 : 1,
					'z-index': 30
				}
			});
		});
	}

	function renderTemporalOverlay() {
		if (!cy || !temporalModeEnabled) return;

		cy.getElementById('temporal-badge').remove();
		cy.getElementById('temporal-badge-text').remove();

		const snap = currentSnap;
		if (!snap) return;

		const phaseInfo = TIDAL_PHASES.find(p => p.value === snap.tidal.tidalPhase);
		const todInfo = TIME_OF_DAY.find(t => t.value === snap.dayTime.timeOfDay);

		let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="56">`
			+ `<rect x="0" y="0" width="160" height="56" rx="8" fill="rgba(0,20,60,0.85)" stroke="rgba(34,211,238,0.4)" stroke-width="1"/>`
			+ `<text x="80" y="16" font-size="8" fill="rgba(34,211,238,0.7)" text-anchor="middle" font-family="monospace">时变模拟</text>`
			+ `<text x="80" y="30" font-size="11" fill="white" text-anchor="middle" font-weight="bold" font-family="monospace">${snap.displayTime}</text>`
			+ `<text x="80" y="44" font-size="8" fill="rgba(255,255,255,0.5)" text-anchor="middle" font-family="sans-serif">${phaseInfo?.icon ?? ''} ${phaseInfo?.label ?? ''} · ${todInfo?.label ?? ''}</text>`
			+ `</svg>`;

		cy.add([
			{
				group: 'nodes',
				data: { id: 'temporal-badge-text' },
				position: { x: 85, y: 38 },
				style: { width: 160, height: 56, opacity: 1, shape: 'rectangle' }
			}
		]);

		const badgeNode = cy.getElementById('temporal-badge-text');
		if (badgeNode.length > 0) {
			badgeNode.style({
				'background-image': `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`,
				'background-width': '100%',
				'background-height': '100%',
				'z-index': 200
			});
		}
	}

	function renderWindIndicator() {
		if (!cy) return;
		const sources = $soundSources;
		if (sources.length === 0) return;

		cy.getElementById('wind-indicator').remove();
		cy.getElementById('wind-start').remove();
		cy.getElementById('wind-end').remove();

		const centerX = sources.reduce((sum, s) => sum + s.x, 0) / sources.length;
		const centerY = sources.reduce((sum, s) => sum + s.y, 0) / sources.length;

		const arrowLen = 50;
		const rad = ((90 - $weather.windDirection) * Math.PI) / 180;
		const endX = centerX + Math.cos(rad) * arrowLen;
		const endY = centerY + Math.sin(rad) * arrowLen;

		cy.add([
			{
				group: 'nodes',
				data: { id: 'wind-start' },
				position: { x: centerX, y: centerY },
				style: { width: 1, height: 1, opacity: 0 }
			},
			{
				group: 'nodes',
				data: { id: 'wind-end' },
				position: { x: endX, y: endY },
				style: { width: 1, height: 1, opacity: 0 }
			},
			{
				group: 'edges',
				data: { id: 'wind-indicator', source: 'wind-start', target: 'wind-end' },
				style: {
					'line-color': '#0ea5e9',
					'width': 3,
					'target-arrow-shape': 'triangle',
					'target-arrow-color': '#0ea5e9',
					'target-arrow-fill': 'filled',
					'curve-style': 'straight',
					'line-style': 'dashed',
					opacity: 0.8,
					'z-index': 100
				}
			}
		]);
	}

	function handleCanvasClick(e: MouseEvent) {
		if (!cy) return;

		const rect = container.getBoundingClientRect();
		const pan = cy.pan();
		const zoom = cy.zoom();
		const x = (e.clientX - rect.left - pan.x) / zoom;
		const y = (e.clientY - rect.top - pan.y) / zoom;

		const mode = $canvas.mode;

		if (mode === 'select') {
			const target = e.target as HTMLElement;
			if (target === container || target.tagName === 'CANVAS') {
				canvas.clearSelection();
			}
			return;
		}

		if (mode === 'addCliff') {
			if (!isDrawingCliff) {
				isDrawingCliff = true;
				cliffStartX = x;
				cliffStartY = y;
				tempCliffId = `temp-${Date.now()}`;
				cy.add([
					{
						group: 'nodes',
						data: { id: `${tempCliffId}-s` },
						position: { x, y },
						style: { width: 1, height: 1, opacity: 0 }
					},
					{
						group: 'nodes',
						data: { id: `${tempCliffId}-e` },
						position: { x, y },
						style: { width: 1, height: 1, opacity: 0 }
					},
					{
						group: 'edges',
						data: { id: tempCliffId!, source: `${tempCliffId}-s`, target: `${tempCliffId}-e` },
						style: {
							'line-color': '#a8a29e',
							'width': 8,
							'line-style': 'dashed',
							'target-arrow-shape': 'none',
							'source-arrow-shape': 'none',
							'curve-style': 'straight',
							opacity: 0.6
						}
					}
				]);
			} else {
				if (tempCliffId) {
					cy.getElementById(tempCliffId).remove();
					cy.getElementById(`${tempCliffId}-s`).remove();
					cy.getElementById(`${tempCliffId}-e`).remove();
				}

				const dist = Math.sqrt((x - cliffStartX) ** 2 + (y - cliffStartY) ** 2);
				if (dist > 20) {
					const result = cliffs.addCliff({
						x1: cliffStartX,
						y1: cliffStartY,
						x2: x,
						y2: y,
						thickness: 8
					});
					if (!result.success) {
						alerts.showErrors(result.errors);
					}
				}
				isDrawingCliff = false;
				tempCliffId = null;
			}
			return;
		}

		if (mode === 'editRoute') {
			const activeRouteVal = $activeRoute;
			if (!activeRouteVal) {
				alerts.showErrors(['请先选择或创建一条航线。']);
				return;
			}

			const wpNum = activeRouteVal.waypoints.length + 1;
			routes.addWaypoint(activeRouteVal.id, x, y, `航点${wpNum}`);
			alerts.showSuccess(`已添加航点${wpNum}`);
			return;
		}

		const typeMap: Record<string, PointType> = {
			addLighthouse: 'lighthouse',
			addFoghorn: 'foghorn',
			addCoast: 'coast',
			addPort: 'port',
			addShip: 'ship'
		};

		const type = typeMap[mode];
		if (!type) return;

		const nextNum = points.getNextNumber(type);
		const label = type === 'lighthouse' ? `灯塔${nextNum}` : type === 'foghorn' ? `雾号${nextNum}` : type === 'coast' ? `海岸${nextNum}` : type === 'port' ? `港口${nextNum}` : `船只${nextNum}`;
		const id = `${type}-${nextNum}`;

		const result = points.addPoint({ type, x, y, label }, id);
		if (!result.success) {
			alerts.showErrors(result.errors);
		}
	}

	function handleCanvasMouseMove(e: MouseEvent) {
		if (!cy || !isDrawingCliff || !tempCliffId) return;

		const rect = container.getBoundingClientRect();
		const pan = cy.pan();
		const zoom = cy.zoom();
		const x = (e.clientX - rect.left - pan.x) / zoom;
		const y = (e.clientY - rect.top - pan.y) / zoom;

		const endNode = cy.getElementById(`${tempCliffId}-e`);
		if (endNode) {
			endNode.position({ x, y });
		}
	}

	$effect(() => {
		if (!cy) return;
		renderAll();
	});

	onMount(() => {
		cy = cytoscape({
			container,
			wheelSensitivity: 0.2,
			minZoom: 0.3,
			maxZoom: 3,
			style: []
		});

		cy.on('tap', 'node', (evt) => {
			const data = evt.target.data();
			if (data.pointId) {
				canvas.selectPoint(data.pointId);
			} else if (data.waypointId) {
				canvas.selectWaypoint(data.waypointId);
				if (data.routeId) {
					activeRouteId.set(data.routeId);
				}
			}
		});

		cy.on('tap', 'edge', (evt) => {
			const data = evt.target.data();
			if (data.cliffId) {
				canvas.selectCliff(data.cliffId);
			} else if (data.routeId) {
				activeRouteId.set(data.routeId);
				canvas.selectRoute(data.routeId);
			}
		});

		cy.on('dragfree', 'node', (evt) => {
			const data = evt.target.data();
			const pos = evt.target.position();
			if (data.pointId) {
				const result = points.movePoint(data.pointId, pos.x, pos.y);
				if (!result.success) {
					const current = $points.find((p) => p.id === data.pointId);
					if (current) {
						evt.target.position({ x: current.x, y: current.y });
					}
					alerts.showErrors(result.errors);
				}
			} else if (data.waypointId && data.routeId) {
				routes.moveWaypoint(data.routeId, data.waypointId, pos.x, pos.y);
			}
		});

		return () => {
			if (cy) {
				cy.destroy();
				cy = null;
			}
		};
	});
</script>

<div class="relative w-full h-full overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a2463]">
	<div class="absolute top-3 left-3 z-10 flex gap-2">
		<div class="px-3 py-1.5 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 text-xs font-medium text-accent/90 border border-accent/20 font-body">
			{modeLabel}
		</div>
	</div>

	<div class="absolute top-3 right-3 z-10 flex gap-1">
		<button
			onclick={() => toggleTemporalMode()}
			class="px-2.5 h-8 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border transition-colors flex items-center justify-center gap-1.5 text-xs font-medium {
				temporalModeEnabled
					? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30'
					: 'bg-ocean-deep/80 border-white/10 text-white/50 hover:bg-ocean-mid/80 hover:text-white/70'
			}"
			title={temporalModeEnabled ? '关闭时变模拟' : '开启时变模拟'}
		>
			<span>🌀</span>
			<span>{temporalModeEnabled ? '时变' : '静态'}</span>
		</button>
		<button
			onclick={() => cy?.zoom(Math.min((cy?.zoom() ?? 1) * 1.3, 3))}
			class="w-8 h-8 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10 hover:bg-ocean-mid/80 hover:border-accent/30 transition-colors flex items-center justify-center text-sm font-bold text-white/70 hover:text-accent"
		>
			+
		</button>
		<button
			onclick={() => cy?.zoom(Math.max((cy?.zoom() ?? 1) * 0.7, 0.3))}
			class="w-8 h-8 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10 hover:bg-ocean-mid/80 hover:border-accent/30 transition-colors flex items-center justify-center text-sm font-bold text-white/70 hover:text-accent"
		>
			−
		</button>
		<button
			onclick={() => {
				cy?.reset();
				cy?.fit(undefined, 50);
			}}
			class="w-8 h-8 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10 hover:bg-ocean-mid/80 hover:border-accent/30 transition-colors flex items-center justify-center text-xs text-white/70 hover:text-accent"
		>
			⌂
		</button>
	</div>

	<div class="absolute bottom-3 left-3 z-10 flex gap-2 flex-wrap">
		<div class="flex items-center gap-1.5 px-2.5 py-1 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10">
			<span class="w-3 h-3 rounded-full bg-accent"></span>
			<span class="text-[10px] text-white/50 font-body">灯塔</span>
		</div>
		<div class="flex items-center gap-1.5 px-2.5 py-1 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10">
			<span class="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-orange-500"></span>
			<span class="text-[10px] text-white/50 font-body">雾号</span>
		</div>
		<div class="flex items-center gap-1.5 px-2.5 py-1 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10">
			<span class="w-3 h-3 rounded-full bg-blue-500"></span>
			<span class="text-[10px] text-white/50 font-body">海岸</span>
		</div>
		<div class="flex items-center gap-1.5 px-2.5 py-1 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10">
			<span class="w-3 h-3 rounded-full bg-purple-500"></span>
			<span class="text-[10px] text-white/50 font-body">港口</span>
		</div>
		<div class="flex items-center gap-1.5 px-2.5 py-1 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10">
			<span class="w-3 h-3 rounded-full bg-cyan-500"></span>
			<span class="text-[10px] text-white/50 font-body">船只</span>
		</div>
		<div class="flex items-center gap-1.5 px-2.5 py-1 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10">
			<span class="w-5 h-1.5 rounded bg-stone-500"></span>
			<span class="text-[10px] text-white/50 font-body">岩壁</span>
		</div>
		<div class="flex items-center gap-1.5 px-2.5 py-1 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10">
			<span class="text-sky-400 text-xs">→</span>
			<span class="text-[10px] text-white/50 font-body">风向</span>
		</div>
		<div class="flex items-center gap-1.5 px-2.5 py-1 bg-ocean-deep/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-white/10">
			<span class="w-3 h-3 rotate-45 bg-cyan-400"></span>
			<span class="text-[10px] text-white/50 font-body">航线</span>
		</div>
		{#if temporalModeEnabled}
			<div class="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/15 backdrop-blur-sm rounded-lg shadow-lg shadow-black/30 border border-cyan-400/30">
				<span class="text-cyan-400 text-xs">🌀</span>
				<span class="text-[10px] text-cyan-300/80 font-body">时变模式</span>
			</div>
		{/if}
	</div>

	<div
		bind:this={container}
		class="w-full h-full cursor-crosshair"
		role="application"
		aria-label="海图画布"
		onclick={handleCanvasClick}
		onmousemove={handleCanvasMouseMove}
	></div>
</div>
