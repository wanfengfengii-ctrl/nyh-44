import { writable, derived, get } from 'svelte/store';
import type {
	Vessel,
	VesselStatus,
	SafetyWindow,
	VesselSchedule,
	ConflictPeriod,
	SchedulePlan,
	ScheduleWarning,
	RiskLevel,
	TidalPhase,
	SeaState,
	TimeOfDay,
	TimeSnapshot
} from '../types';
import { routes } from './routesStore';
import { temporal, timeSnapshots } from './tidalStore';
import { calculateTemporalFactors, analyzeRouteTemporal } from '../acoustics';
import { soundSources } from './pointsStore';
import { weather } from './weatherStore';
import { cliffs } from './cliffsStore';
import type { TemporalAdjustmentFactors } from '../acoustics';
import type { Point, WeatherParams, Cliff, Route } from '../types';

const VESSEL_COLORS = [
	'#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
	'#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
];

function createMultiVesselScheduleStore() {
	const vessels = writable<Vessel[]>([]);
	const schedulePlans = writable<SchedulePlan[]>([]);
	const activePlanId = writable<string | null>(null);
	const appliedSchedule = writable<Map<string, number>>(new Map());
	const warnings = writable<ScheduleWarning[]>([]);

	let vesselCounter = 0;

	function addVessel(name?: string, speed: number = 10): Vessel {
		const id = `vessel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const vessel: Vessel = {
			id,
			name: name || `船只${++vesselCounter}`,
			routeId: null,
			speed,
			status: 'idle',
			priority: vesselCounter,
			color: VESSEL_COLORS[(vesselCounter - 1) % VESSEL_COLORS.length]
		};
		vessels.update(v => [...v, vessel]);
		return vessel;
	}

	function removeVessel(id: string): void {
		vessels.update(v => v.filter(vessel => vessel.id !== id));
	}

	function updateVessel(id: string, updates: Partial<Vessel>): void {
		vessels.update(vList =>
			vList.map(v => v.id === id ? { ...v, ...updates } : v)
		);
	}

	function bindVesselToRoute(vesselId: string, routeId: string | null): void {
		vessels.update(vList =>
			vList.map(v =>
				v.id === vesselId
					? { ...v, routeId, status: routeId ? 'scheduled' : 'idle' }
					: v
			)
		);
	}

	function calculateSafetyWindows(
		route: Route,
		snapshots: TimeSnapshot[],
		sources: Point[],
		weatherParams: WeatherParams,
		cliffList: Cliff[]
	): SafetyWindow[] {
		if (route.waypoints.length < 2 || sources.length === 0) return [];

		const windows: SafetyWindow[] = [];
		const windowSize = 2;

		for (let i = 0; i <= snapshots.length - windowSize; i++) {
			const windowSnaps = snapshots.slice(i, i + windowSize);
			let totalIntensity = 0;
			let totalReachable = 0;
			let maxRisk: RiskLevel = 'low';
			let sampleCount = 0;

			for (const snap of windowSnaps) {
				const factors = calculateTemporalFactors(
					snap.tidal, snap.seaSurface, snap.dayTime
				);
				const analysis = analyzeRouteTemporal(
					route, sources, weatherParams, cliffList, factors
				);
				totalIntensity += analysis.avgIntensity;
				totalReachable += analysis.reachableRatio;
				sampleCount++;

				const hasCritical = analysis.riskAlerts.some(a => a.level === 'critical');
				const hasHigh = analysis.riskAlerts.some(a => a.level === 'high');
				if (hasCritical) maxRisk = 'critical';
				else if (hasHigh && maxRisk !== 'critical') maxRisk = 'high';
				else if (analysis.riskAlerts.some(a => a.level === 'medium') && maxRisk !== 'critical' && maxRisk !== 'high') maxRisk = 'medium';
			}

			const avgIntensity = sampleCount > 0 ? totalIntensity / sampleCount : 0;
			const avgReachable = sampleCount > 0 ? totalReachable / sampleCount : 0;
			const midSnap = windowSnaps[Math.floor(windowSnaps.length / 2)];

			const score = computeSafetyScore(avgIntensity, avgReachable, maxRisk);

			windows.push({
				startHour: windowSnaps[0].simulatedHour,
				endHour: windowSnaps[windowSnaps.length - 1].simulatedHour,
				riskLevel: maxRisk,
				avgIntensity,
				reachableRatio: avgReachable,
				tidalPhase: midSnap.tidal.tidalPhase,
				seaState: midSnap.seaSurface.seaState,
				timeOfDay: midSnap.dayTime.timeOfDay,
				score
			});
		}

		return windows;
	}

	function computeSafetyScore(intensity: number, reachable: number, risk: RiskLevel): number {
		const riskPenalty: Record<RiskLevel, number> = {
			low: 0,
			medium: 20,
			high: 45,
			critical: 70
		};
		const intensityScore = Math.min(40, intensity * 0.4);
		const reachScore = reachable * 30;
		const riskScore = 100 - riskPenalty[risk];
		return Math.max(0, Math.min(100, intensityScore + reachScore + riskScore * 0.3));
	}

	function riskToValue(level: RiskLevel): number {
		const map: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
		return map[level];
	}

	function findBestDeparture(windows: SafetyWindow[]): { bestHour: number; bestWindow: SafetyWindow | null } {
		if (windows.length === 0) return { bestHour: 0, bestWindow: null };
		const sorted = [...windows].sort((a, b) => {
			if (a.riskLevel !== b.riskLevel) return riskToValue(a.riskLevel) - riskToValue(b.riskLevel);
			return b.score - a.score;
		});
		const best = sorted[0];
		return { bestHour: best.startHour, bestWindow: best };
	}

	function detectConflicts(schedules: VesselSchedule[]): ConflictPeriod[] {
		const conflicts: ConflictPeriod[] = [];
		let conflictId = 0;

		for (let i = 0; i < schedules.length; i++) {
			for (let j = i + 1; j < schedules.length; j++) {
				const sA = schedules[i];
				const sB = schedules[j];

				const overlapStart = Math.max(sA.departureHour, sB.departureHour);
				const overlapEnd = Math.min(sA.arrivalHour, sB.arrivalHour);

				if (overlapStart < overlapEnd) {
					const aHighRisk = sA.safetyWindows.filter(w => w.riskLevel === 'high' || w.riskLevel === 'critical');
					const bHighRisk = sB.safetyWindows.filter(w => w.riskLevel === 'high' || w.riskLevel === 'critical');

					for (const wa of aHighRisk) {
						for (const wb of bHighRisk) {
							const rStart = Math.max(wa.startHour, wb.startHour);
							const rEnd = Math.min(wa.endHour, wb.endHour);
							if (rStart < rEnd) {
								const severity: RiskLevel = (wa.riskLevel === 'critical' || wb.riskLevel === 'critical') ? 'critical' : 'high';
								conflicts.push({
									startHour: rStart,
									endHour: rEnd,
									vesselIds: [sA.vesselId, sB.vesselId],
									conflictType: 'risk_overlap',
									severity,
									description: `船只时段风险重叠: ${formatHour(rStart)}-${formatHour(rEnd)}`
								});
							}
						}
					}

					conflicts.push({
						startHour: overlapStart,
						endHour: overlapEnd,
						vesselIds: [sA.vesselId, sB.vesselId],
						conflictType: 'timing_conflict',
						severity: 'medium',
						description: `航行时段重叠: ${formatHour(overlapStart)}-${formatHour(overlapEnd)}`
					});
				}

				if (sA.routeId === sB.routeId) {
					conflicts.push({
						startHour: Math.max(sA.departureHour, sB.departureHour),
						endHour: Math.min(sA.arrivalHour, sB.arrivalHour),
						vesselIds: [sA.vesselId, sB.vesselId],
						conflictType: 'route_overlap',
						severity: 'high',
						description: `共享同一条航线`
					});
				}
			}
		}

		return conflicts;
	}

	function generateWarnings(schedules: VesselSchedule[], conflicts: ConflictPeriod[]): ScheduleWarning[] {
		const ws: ScheduleWarning[] = [];
		let wId = 0;

		for (const schedule of schedules) {
			const criticalWindows = schedule.safetyWindows.filter(w => w.riskLevel === 'critical');
			for (const cw of criticalWindows) {
				ws.push({
					id: `warn-${wId++}`,
					vesselId: schedule.vesselId,
					type: 'high_risk_window',
					level: 'critical',
					hour: cw.startHour,
					message: `${formatHour(cw.startHour)}-${formatHour(cw.endHour)} 存在严重风险时段`
				});
			}

			const lowVisWindows = schedule.safetyWindows.filter(w =>
				w.timeOfDay === 'night' || w.timeOfDay === 'midnight' || w.timeOfDay === 'dusk'
			);
			for (const lv of lowVisWindows) {
				if (lv.riskLevel !== 'low') {
					ws.push({
						id: `warn-${wId++}`,
						vesselId: schedule.vesselId,
						type: 'low_visibility',
						level: 'medium',
						hour: lv.startHour,
						message: `${formatHour(lv.startHour)}-${formatHour(lv.endHour)} 能见度较低`
					});
				}
			}

			const stormWindows = schedule.safetyWindows.filter(w =>
				w.seaState === 'rough' || w.seaState === 'very_rough' || w.seaState === 'stormy'
			);
			for (const sw of stormWindows) {
				ws.push({
					id: `warn-${wId++}`,
					vesselId: schedule.vesselId,
					type: 'storm_warning',
					level: sw.seaState === 'stormy' ? 'critical' : 'high',
					hour: sw.startHour,
					message: `${formatHour(sw.startHour)}-${formatHour(sw.endHour)} 海况恶劣 (${sw.seaState})`
				});
			}

			const highCurrentWindows = schedule.safetyWindows.filter(w =>
				w.tidalPhase === 'rising' || w.tidalPhase === 'falling'
			);
			for (const hc of highCurrentWindows) {
				if (hc.riskLevel !== 'low') {
					ws.push({
						id: `warn-${wId++}`,
						vesselId: schedule.vesselId,
						type: 'current_hazard',
						level: 'medium',
						hour: hc.startHour,
						message: `${formatHour(hc.startHour)}-${formatHour(hc.endHour)} 潮流影响较大`
					});
				}
			}
		}

		for (const conflict of conflicts) {
			for (const vid of conflict.vesselIds) {
				ws.push({
					id: `warn-${wId++}`,
					vesselId: vid,
					type: 'conflict_detected',
					level: conflict.severity,
					hour: conflict.startHour,
					message: conflict.description
				});
			}
		}

		ws.sort((a, b) => riskToValue(b.level) - riskToValue(a.level));
		return ws;
	}

	function generateSchedulePlan(name?: string): SchedulePlan | null {
		const currentVessels = get(vessels);
		const currentRoutes = get(routes);
		const currentSources = get(soundSources);
		const currentWeather = get(weather);
		const currentCliffs = get(cliffs);
		const currentSnapshots = get(timeSnapshots);

		const boundVessels = currentVessels.filter(v => v.routeId !== null);
		if (boundVessels.length === 0) return null;

		const schedules: VesselSchedule[] = [];

		for (const vessel of boundVessels) {
			const route = currentRoutes.find(r => r.id === vessel.routeId);
			if (!route || route.waypoints.length < 2) continue;

			const safetyWindows = calculateSafetyWindows(
				route, currentSnapshots, currentSources, currentWeather, currentCliffs
			);

			const { bestHour, bestWindow } = findBestDeparture(safetyWindows);
			const routeDistance = route.waypoints.reduce((sum, wp, idx) => {
				if (idx === 0) return 0;
				const prev = route.waypoints[idx - 1];
				return sum + Math.sqrt((wp.x - prev.x) ** 2 + (wp.y - prev.y) ** 2);
			}, 0);

			const travelHours = vessel.speed > 0 ? routeDistance / (vessel.speed * 1000) : 1;
			const arrivalHour = bestHour + travelHours;

			let overallRisk: RiskLevel = 'low';
			const highRiskWindows = safetyWindows.filter(w => w.riskLevel === 'high' || w.riskLevel === 'critical');
			if (highRiskWindows.some(w => w.riskLevel === 'critical')) overallRisk = 'critical';
			else if (highRiskWindows.length > 0) overallRisk = 'high';
			else if (safetyWindows.some(w => w.riskLevel === 'medium')) overallRisk = 'medium';

			const overallScore = safetyWindows.length > 0
				? safetyWindows.reduce((sum, w) => sum + w.score, 0) / safetyWindows.length
				: 0;

			schedules.push({
				vesselId: vessel.id,
				routeId: route.id,
				departureHour: bestHour,
				arrivalHour: arrivalHour,
				safetyWindows,
				bestDepartureHour: bestHour,
				bestWindow,
				overallRisk,
				overallScore
			});
		}

		const conflicts = detectConflicts(schedules);
		const planWarnings = generateWarnings(schedules, conflicts);
		warnings.set(planWarnings);

		let maxRisk: RiskLevel = 'low';
		for (const s of schedules) {
			if (riskToValue(s.overallRisk) > riskToValue(maxRisk)) maxRisk = s.overallRisk;
		}

		const totalScore = schedules.length > 0
			? schedules.reduce((sum, s) => sum + s.overallScore, 0) / schedules.length
			: 0;

		const plan: SchedulePlan = {
			id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: name || `调度方案${get(schedulePlans).length + 1}`,
			vesselSchedules: schedules,
			conflicts,
			totalScore,
			maxRisk,
			createdAt: Date.now()
		};

		schedulePlans.update(plans => [...plans, plan]);
		activePlanId.set(plan.id);
		return plan;
	}

	function removePlan(id: string): void {
		schedulePlans.update(plans => plans.filter(p => p.id !== id));
		if (get(activePlanId) === id) {
			activePlanId.set(null);
		}
	}

	function applyPlan(planId: string): void {
		const plans = get(schedulePlans);
		const plan = plans.find(p => p.id === planId);
		if (!plan) return;

		const newApplied = new Map<string, number>();
		for (const schedule of plan.vesselSchedules) {
			newApplied.set(schedule.vesselId, schedule.bestDepartureHour);
		}
		appliedSchedule.set(newApplied);

		vessels.update(vList =>
			vList.map(v => {
				const schedule = plan.vesselSchedules.find(s => s.vesselId === v.id);
				if (schedule) {
					return { ...v, status: 'scheduled' as VesselStatus };
				}
				return v;
			})
		);
	}

	function sortPlansByScore(): void {
		schedulePlans.update(plans =>
			[...plans].sort((a, b) => b.totalScore - a.totalScore)
		);
	}

	function sortPlansByRisk(): void {
		schedulePlans.update(plans =>
			[...plans].sort((a, b) => riskToValue(a.maxRisk) - riskToValue(b.maxRisk))
		);
	}

	function clearAll(): void {
		vessels.set([]);
		schedulePlans.set([]);
		activePlanId.set(null);
		appliedSchedule.set(new Map());
		warnings.set([]);
		vesselCounter = 0;
	}

	return {
		vessels,
		schedulePlans,
		activePlanId,
		appliedSchedule,
		warnings,
		addVessel,
		removeVessel,
		updateVessel,
		bindVesselToRoute,
		generateSchedulePlan,
		removePlan,
		applyPlan,
		sortPlansByScore,
		sortPlansByRisk,
		clearAll
	};
}

export const multiVesselStore = createMultiVesselScheduleStore();

export const activePlan = derived(
	[multiVesselStore.schedulePlans, multiVesselStore.activePlanId],
	([$plans, $activeId]) => {
		if (!$activeId) return null;
		return $plans.find(p => p.id === $activeId) ?? null;
	}
);

export const boundVessels = derived(
	[multiVesselStore.vessels, routes],
	([$vessels, $routes]) => {
		return $vessels.filter(v => {
			if (!v.routeId) return false;
			return $routes.some(r => r.id === v.routeId);
		});
	}
);

export const conflictCount = derived(
	multiVesselStore.schedulePlans,
	($plans) => {
		let count = 0;
		for (const plan of $plans) {
			count += plan.conflicts.length;
		}
		return count;
	}
);

export function formatHour(hour: number): string {
	const h = Math.floor(((hour % 24) + 24) % 24);
	const m = Math.floor((hour % 1) * 60);
	return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function getRiskColor(level: RiskLevel): string {
	switch (level) {
		case 'low': return '#22c55e';
		case 'medium': return '#f59e0b';
		case 'high': return '#f97316';
		case 'critical': return '#ef4444';
	}
}

export function getRiskLabel(level: RiskLevel): string {
	switch (level) {
		case 'low': return '低风险';
		case 'medium': return '中风险';
		case 'high': return '高风险';
		case 'critical': return '严重';
	}
}
