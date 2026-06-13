<script lang="ts">
	import { onMount } from 'svelte';
	import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
	import { points, lighthouse } from '$lib/stores/pointsStore';
	import { cliffs } from '$lib/stores/cliffsStore';
	import { canvas } from '$lib/stores/canvasStore';
	import { propagationResults, propagationSector, getIntensityColor } from '$lib/stores/propagationStore';
	import { weather } from '$lib/stores/weatherStore';
	import { alerts } from '$lib/stores/alertsStore';
	import type { PointType } from '$lib/types';

	const CANVAS_WIDTH = 800;
	const CANVAS_HEIGHT = 600;

	let container: HTMLDivElement;
	let cy = $state<Core | null>(null);
	let isDrawingCliff = $state(false);
	let cliffStartX = $state(0);
	let cliffStartY = $state(0);
	let tempCliffId = $state<string | null>(null);

	let modeLabel = $derived.by(() => {
		if ($canvas.mode === 'select') return '选择模式';
		if ($canvas.mode === 'addCliff') return isDrawingCliff ? '点击确定岩壁终点' : '点击设置岩壁起点';
		return '点击画布放置点位';
	});

	function getPointColor(type: PointType): string {
		switch (type) {
			case 'lighthouse': return '#FFD700';
			case 'coast': return '#3b82f6';
			case 'port': return '#8b5cf6';
			case 'ship': return '#06b6d4';
		}
	}

	function getResultForPoint(pointId: string) {
		return $propagationResults.find((r) => r.pointId === pointId);
	}

	function renderAll() {
		if (!cy) return;

		cy.elements().remove();

		const elements: ElementDefinition[] = [];

		$points.forEach((p) => {
			const result = p.type !== 'lighthouse' ? getResultForPoint(p.id) : null;
			let borderColor = '#ffffff';
			let borderWidth = 2;

			if (result) {
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
					pointId: p.id
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
					width: p.type === 'lighthouse' ? 32 : 22,
					height: p.type === 'lighthouse' ? 32 : 22,
					shape: p.type === 'lighthouse' ? 'star' : 'ellipse'
				}
			});
		});

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
					'curve-style': 'straight'
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

		cy.add(elements);

		renderSectorOverlay();
		renderWindIndicator();
	}

	function renderSectorOverlay() {
		if (!cy) return;
		const lh = $lighthouse;
		const sector = $propagationSector;
		if (!lh || sector.length === 0) return;

		cy.getElementById('sector-overlay').remove();

		let svgContent = '';
		for (let i = 0; i < sector.length; i++) {
			const sample = sector[i];
			const nextSample = sector[(i + 1) % sector.length];
			const color = getIntensityColor(sample.intensity);

			const rad1 = ((90 - sample.angle) * Math.PI) / 180;
			const rad2 = ((90 - nextSample.angle) * Math.PI) / 180;

			const r = sample.maxDistance;
			if (r <= 0) continue;

			const x1 = lh.x + Math.cos(rad1) * r;
			const y1 = lh.y + Math.sin(rad1) * r;
			const x2 = lh.x + Math.cos(rad2) * r;
			const y2 = lh.y + Math.sin(rad2) * r;

			svgContent += `<path d="M ${lh.x} ${lh.y} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-opacity="0.4" stroke-width="1"/>`;
		}

		if (svgContent) {
			try {
				cy.add({
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
			} catch (_) {}
		}
	}

	function renderWindIndicator() {
		if (!cy) return;
		const lh = $lighthouse;
		if (!lh) return;

		cy.getElementById('wind-indicator').remove();

		const arrowLen = 50;
		const rad = ((90 - $weather.windDirection) * Math.PI) / 180;
		const endX = lh.x + Math.cos(rad) * arrowLen;
		const endY = lh.y + Math.sin(rad) * arrowLen;

		cy.add([
			{
				group: 'nodes',
				data: { id: 'wind-start' },
				position: { x: lh.x, y: lh.y },
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

		const typeMap: Record<string, PointType> = {
			addLighthouse: 'lighthouse',
			addCoast: 'coast',
			addPort: 'port',
			addShip: 'ship'
		};

		const type = typeMap[mode];
		if (!type) return;

		if (type === 'lighthouse' && $lighthouse) {
			points.removePoint($lighthouse.id);
		}

		const nextNum = points.getNextNumber(type);
		const label = type === 'lighthouse' ? `灯塔${nextNum}` : type === 'coast' ? `海岸${nextNum}` : type === 'port' ? `港口${nextNum}` : `船只${nextNum}`;
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
			} else if (data.cliffId) {
				canvas.selectCliff(data.cliffId);
			}
		});

		cy.on('tap', 'edge', (evt) => {
			const data = evt.target.data();
			if (data.cliffId) {
				canvas.selectCliff(data.cliffId);
			}
		});

		cy.on('dragfree', 'node', (evt) => {
			const data = evt.target.data();
			const pos = evt.target.position();
			if (data.pointId) {
				points.updatePoint(data.pointId, { x: pos.x, y: pos.y });
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
