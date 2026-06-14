<script lang="ts">
	import { onMount } from 'svelte';
	import { activePlan, getRiskColor, formatHour } from '$lib/stores/multiVesselScheduleStore';
	import type { SafetyWindow, RiskLevel } from '$lib/types';

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let plan = $derived($activePlan);
	let hoveredWindow = $state<SafetyWindow | null>(null);
	let selectedVesselIdx = $state<number>(0);

	function getRiskBg(level: RiskLevel, alpha: number = 0.6): string {
		switch (level) {
			case 'low': return `rgba(34, 197, 94, ${alpha})`;
			case 'medium': return `rgba(245, 158, 11, ${alpha})`;
			case 'high': return `rgba(249, 115, 22, ${alpha})`;
			case 'critical': return `rgba(239, 68, 68, ${alpha})`;
		}
	}

	$effect(() => {
		if (!canvas) return;
		drawChart();
	});

	function drawChart() {
		const canvasEl = canvas;
		if (!canvasEl || !plan) return;

		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = canvasEl.getBoundingClientRect();
		canvasEl.width = rect.width * dpr;
		canvasEl.height = rect.height * dpr;
		ctx.scale(dpr, dpr);

		const w = rect.width;
		const h = rect.height;

		ctx.clearRect(0, 0, w, h);

		const schedules = plan.vesselSchedules;
		if (schedules.length === 0) return;

		const totalHours = 24;
		const leftPad = 60;
		const rightPad = 16;
		const topPad = 24;
		const bottomPad = 28;
		const chartW = w - leftPad - rightPad;
		const chartH = h - topPad - bottomPad;
		const rowH = chartH / schedules.length;

		ctx.fillStyle = 'rgba(255,255,255,0.03)';
		ctx.fillRect(leftPad, topPad, chartW, chartH);

		for (let i = 0; i <= totalHours; i += 3) {
			const x = leftPad + (i / totalHours) * chartW;
			ctx.strokeStyle = 'rgba(255,255,255,0.06)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(x, topPad);
			ctx.lineTo(x, topPad + chartH);
			ctx.stroke();

			ctx.fillStyle = 'rgba(255,255,255,0.3)';
			ctx.font = '9px monospace';
			ctx.textAlign = 'center';
			ctx.fillText(`${i}h`, x, topPad + chartH + 14);
		}

		for (let i = 0; i < schedules.length; i++) {
			const y = topPad + i * rowH;

			ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)';
			ctx.fillRect(leftPad, y, chartW, rowH);

			const vesselName = `船${i + 1}`;
			ctx.fillStyle = 'rgba(255,255,255,0.5)';
			ctx.font = '10px sans-serif';
			ctx.textAlign = 'right';
			ctx.fillText(vesselName, leftPad - 8, y + rowH / 2 + 3);

			const windows = schedules[i].safetyWindows;
			for (const win of windows) {
				const x1 = leftPad + (win.startHour / totalHours) * chartW;
				const x2 = leftPad + (win.endHour / totalHours) * chartW;
				const barY = y + 4;
				const barH = rowH - 8;

				ctx.fillStyle = getRiskBg(win.riskLevel, 0.5);
				ctx.beginPath();
				ctx.roundRect(x1, barY, x2 - x1, barH, 2);
				ctx.fill();

				if (win.score >= 60) {
					ctx.fillStyle = getRiskBg(win.riskLevel, 0.15);
					const safeH = barH * (win.score / 100);
					ctx.beginPath();
					ctx.roundRect(x1, barY + barH - safeH, x2 - x1, safeH, 2);
					ctx.fill();
				}
			}

			if (schedules[i].bestWindow) {
				const bw = schedules[i].bestWindow!;
				const x1 = leftPad + (bw.startHour / totalHours) * chartW;
				const x2 = leftPad + (bw.endHour / totalHours) * chartW;
				ctx.strokeStyle = '#22c55e';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.roundRect(x1, y + 2, x2 - x1, rowH - 4, 3);
				ctx.stroke();
			}

			const depX = leftPad + (schedules[i].departureHour / totalHours) * chartW;
			ctx.fillStyle = '#3b82f6';
			ctx.beginPath();
			ctx.moveTo(depX, y + rowH - 4);
			ctx.lineTo(depX - 4, y + rowH);
			ctx.lineTo(depX + 4, y + rowH);
			ctx.closePath();
			ctx.fill();

			const arrX = leftPad + (schedules[i].arrivalHour / totalHours) * chartW;
			ctx.fillStyle = '#8b5cf6';
			ctx.beginPath();
			ctx.moveTo(arrX, y + rowH - 4);
			ctx.lineTo(arrX - 4, y + rowH);
			ctx.lineTo(arrX + 4, y + rowH);
			ctx.closePath();
			ctx.fill();
		}

		ctx.strokeStyle = 'rgba(255,255,255,0.1)';
		ctx.lineWidth = 1;
		ctx.strokeRect(leftPad, topPad, chartW, chartH);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!canvas || !plan) return;
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const leftPad = 60;
		const topPad = 24;
		const chartW = rect.width - leftPad - 16;
		const chartH = rect.height - topPad - 28;
		const rowH = chartH / plan.vesselSchedules.length;

		if (x < leftPad || y < topPad || y > topPad + chartH) {
			hoveredWindow = null;
			return;
		}

		const hour = ((x - leftPad) / chartW) * 24;
		const rowIdx = Math.floor((y - topPad) / rowH);
		const schedule = plan.vesselSchedules[rowIdx];

		if (schedule) {
			const found = schedule.safetyWindows.find(w => hour >= w.startHour && hour <= w.endHour);
			hoveredWindow = found ?? null;
		} else {
			hoveredWindow = null;
		}
	}

	function handleMouseLeave() {
		hoveredWindow = null;
	}

	onMount(() => {
		const handleResize = () => {
			if (canvas) drawChart();
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});
</script>

<div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
	<div class="flex items-center justify-between mb-2">
		<span class="text-[10px] text-white/40 uppercase tracking-wider font-body">安全通行窗口时间图</span>
		<div class="flex items-center gap-3 text-[9px] text-white/30 font-body">
			<span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm" style="background: rgba(34,197,94,0.5);"></span>低风险</span>
			<span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm" style="background: rgba(245,158,11,0.5);"></span>中风险</span>
			<span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm" style="background: rgba(249,115,22,0.5);"></span>高风险</span>
			<span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-sm" style="background: rgba(239,68,68,0.5);"></span>严重</span>
			<span class="flex items-center gap-1"><span class="inline-block w-2.5 h-0.5 rounded-sm" style="background: #22c55e;"></span>推荐窗口</span>
		</div>
	</div>

	<div class="h-48 relative">
		<canvas
			bind:this={canvas}
			class="w-full h-full"
			onmousemove={handleMouseMove}
			onmouseleave={handleMouseLeave}
		></canvas>
	</div>

	{#if hoveredWindow}
		<div class="mt-2 p-2 rounded-lg bg-black/30 border border-white/10 text-[10px] font-body grid grid-cols-4 gap-2">
			<div>
				<span class="text-white/30">时段</span>
				<div class="text-white/70 font-mono">{formatHour(hoveredWindow.startHour)}-{formatHour(hoveredWindow.endHour)}</div>
			</div>
			<div>
				<span class="text-white/30">风险</span>
				<div style="color: {getRiskColor(hoveredWindow.riskLevel)};">{hoveredWindow.riskLevel}</div>
			</div>
			<div>
				<span class="text-white/30">声强</span>
				<div class="text-cyan-400 font-mono">{hoveredWindow.avgIntensity.toFixed(1)}%</div>
			</div>
			<div>
				<span class="text-white/30">评分</span>
				<div class="text-violet-400 font-mono">{hoveredWindow.score.toFixed(0)}</div>
			</div>
		</div>
	{/if}
</div>
