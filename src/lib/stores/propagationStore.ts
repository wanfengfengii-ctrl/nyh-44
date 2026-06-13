import { derived, get } from 'svelte/store';
import { soundSources, targetPoints, allSources } from './pointsStore';
import { cliffs } from './cliffsStore';
import { weather } from './weatherStore';
import { routes, activeRouteId, activeRoute } from './routesStore';
import { temporal, timeSnapshots } from './tidalStore';
import {
	calculateIntensity,
	calculateCombinedIntensity,
	calculateCombinedPropagationSector,
	calculatePropagationSector,
	analyzeRoute,
	calculateTemporalFactors,
	calculateCombinedIntensityTemporal,
	calculatePropagationSectorTemporal,
	calculateCombinedPropagationSectorTemporal,
	analyzeRouteTemporal,
	runTemporalRouteAnalysis
} from '../acoustics';
import type {
	PropagationResult, RouteAnalysisResult,
	TemporalPropagationMetrics, RouteTemporalAnalysis,
	TemporalRiskPeak, ComparisonTimePoint, TimeSnapshot
} from '../types';
import type { SectorSample, MultiSourceSectorSample, TemporalAdjustmentFactors } from '../acoustics';

export const propagationResults = derived(
	[soundSources, targetPoints, weather, cliffs],
	([$soundSources, $targetPoints, $weather, $cliffs]) => {
		if ($soundSources.length === 0) return [];

		return $targetPoints.map((point): PropagationResult => {
			const result = calculateCombinedIntensity(
				$soundSources,
				point.x,
				point.y,
				$weather,
				$cliffs
			);

			return {
				pointId: point.id,
				distance: 0,
				direction: 0,
				attenuation: 0,
				intensity: result.totalIntensityLinear,
				isReachable: result.isReachable,
				isBlocked: result.contributingSources.length === 0 && $soundSources.length > 0
			};
		});
	}
);

export const propagationSector = derived(
	[soundSources, weather, cliffs],
	([$soundSources, $weather, $cliffs]): MultiSourceSectorSample[] => {
		if ($soundSources.length === 0) return [];

		if ($soundSources.length === 1) {
			return calculatePropagationSector($soundSources[0], $weather, $cliffs, 72, 600);
		}

		const centerX =
			$soundSources.reduce((sum, s) => sum + s.x, 0) / $soundSources.length;
		const centerY =
			$soundSources.reduce((sum, s) => sum + s.y, 0) / $soundSources.length;

		return calculateCombinedPropagationSector(
			$soundSources,
			centerX,
			centerY,
			$weather,
			$cliffs,
			72,
			800
		);
	}
);

export const perSourceSectors = derived(
	[allSources, weather, cliffs],
	([$allSources, $weather, $cliffs]) => {
		const map = new Map<string, SectorSample[]>();
		for (const source of $allSources) {
			if (source.sourceParams?.enabled !== false) {
				map.set(source.id, calculatePropagationSector(source, $weather, $cliffs, 36, 600));
			}
		}
		return map;
	}
);

export const sectorCenter = derived(soundSources, ($soundSources) => {
	if ($soundSources.length === 0) return null;
	if ($soundSources.length === 1) return { x: $soundSources[0].x, y: $soundSources[0].y };
	return {
		x: $soundSources.reduce((sum, s) => sum + s.x, 0) / $soundSources.length,
		y: $soundSources.reduce((sum, s) => sum + s.y, 0) / $soundSources.length
	};
});

export const reachablePointsCount = derived(propagationResults, ($results) => {
	return $results.filter((r) => r.isReachable).length;
});

export const blockedPointsCount = derived(propagationResults, ($results) => {
	return $results.filter((r) => r.isBlocked).length;
});

export const routeAnalysisResults = derived(
	[routes, soundSources, weather, cliffs],
	([$routes, $soundSources, $weather, $cliffs]) => {
		const map = new Map<string, RouteAnalysisResult>();
		for (const route of $routes) {
			map.set(route.id, analyzeRoute(route, $soundSources, $weather, $cliffs));
		}
		return map;
	}
);

export const activeRouteAnalysis = derived(
	[activeRouteId, routeAnalysisResults],
	([$activeRouteId, $results]) => {
		if (!$activeRouteId) return null;
		return $results.get($activeRouteId) ?? null;
	}
);

export const totalRiskCount = derived(routeAnalysisResults, ($results) => {
	let total = 0;
	let critical = 0;
	let high = 0;
	for (const analysis of $results.values()) {
		total += analysis.riskAlerts.length;
		critical += analysis.riskAlerts.filter((a) => a.level === 'critical').length;
		high += analysis.riskAlerts.filter((a) => a.level === 'high').length;
	}
	return { total, critical, high };
});

export function getIntensityColor(intensity: number): string {
	if (intensity >= 80) return '#22c55e';
	if (intensity >= 60) return '#84cc16';
	if (intensity >= 40) return '#eab308';
	if (intensity >= 20) return '#f97316';
	return '#ef4444';
}

export function getSectorGradient(samples: SectorSample[] | MultiSourceSectorSample[]): string {
	const stops = samples
		.map((s, i) => {
			const color = getIntensityColor(s.intensity);
			const percent = (i / samples.length) * 100;
			return `${color} ${percent}%`;
		})
		.join(', ');
	return `conic-gradient(from 0deg, ${stops})`;
}

export const temporalFactors = derived(
	[temporal],
	([$temporal]): TemporalAdjustmentFactors => {
		return calculateTemporalFactors(
			$temporal.tidal,
			$temporal.seaSurface,
			$temporal.dayTime
		);
	}
);

export const temporalPropagationResults = derived(
	[soundSources, targetPoints, weather, cliffs, temporalFactors],
	([$soundSources, $targetPoints, $weather, $cliffs, $temporalFactors]) => {
		if ($soundSources.length === 0) return [];
		return $targetPoints.map((point): PropagationResult => {
			const result = calculateCombinedIntensityTemporal(
				$soundSources, point.x, point.y, $weather, $cliffs, $temporalFactors
			);
			return {
				pointId: point.id,
				distance: 0,
				direction: 0,
				attenuation: 0,
				intensity: result.totalIntensityLinear,
				isReachable: result.isReachable,
				isBlocked: result.contributingSources.length === 0 && $soundSources.length > 0
			};
		});
	}
);

export const temporalPropagationSector = derived(
	[soundSources, weather, cliffs, temporalFactors],
	([$soundSources, $weather, $cliffs, $temporalFactors]): MultiSourceSectorSample[] => {
		if ($soundSources.length === 0) return [];
		if ($soundSources.length === 1) {
			return calculatePropagationSectorTemporal(
				$soundSources[0], $weather, $cliffs, $temporalFactors, 72, 600
			);
		}
		const centerX = $soundSources.reduce((sum, s) => sum + s.x, 0) / $soundSources.length;
		const centerY = $soundSources.reduce((sum, s) => sum + s.y, 0) / $soundSources.length;
		return calculateCombinedPropagationSectorTemporal(
			$soundSources, centerX, centerY, $weather, $cliffs, $temporalFactors, 72, 800
		);
	}
);

export const temporalPerSourceSectors = derived(
	[allSources, weather, cliffs, temporalFactors],
	([$allSources, $weather, $cliffs, $temporalFactors]) => {
		const map = new Map<string, SectorSample[]>();
		for (const source of $allSources) {
			if (source.sourceParams?.enabled !== false) {
				map.set(source.id, calculatePropagationSectorTemporal(
					source, $weather, $cliffs, $temporalFactors, 36, 600
				));
			}
		}
		return map;
	}
);

export const temporalRouteAnalysisResults = derived(
	[routes, soundSources, weather, cliffs, temporalFactors],
	([$routes, $soundSources, $weather, $cliffs, $temporalFactors]) => {
		const map = new Map<string, RouteAnalysisResult>();
		for (const route of $routes) {
			map.set(route.id, analyzeRouteTemporal(
				route, $soundSources, $weather, $cliffs, $temporalFactors
			));
		}
		return map;
	}
);

export const temporalActiveRouteAnalysis = derived(
	[activeRouteId, temporalRouteAnalysisResults],
	([$activeRouteId, $results]) => {
		if (!$activeRouteId) return null;
		return $results.get($activeRouteId) ?? null;
	}
);

export const temporalTotalRiskCount = derived(temporalRouteAnalysisResults, ($results) => {
	let total = 0;
	let critical = 0;
	let high = 0;
	for (const analysis of $results.values()) {
		total += analysis.riskAlerts.length;
		critical += analysis.riskAlerts.filter((a) => a.level === 'critical').length;
		high += analysis.riskAlerts.filter((a) => a.level === 'high').length;
	}
	return { total, critical, high };
});

export const activeRouteTemporalAnalysis = derived(
	[activeRoute, soundSources, weather, cliffs, timeSnapshots],
	([$activeRoute, $soundSources, $weather, $cliffs, $snapshots]): RouteTemporalAnalysis | null => {
		if (!$activeRoute || $snapshots.length < 3) return null;
		return runTemporalRouteAnalysis(
			$activeRoute, $soundSources, $weather, $cliffs, $snapshots
		);
	}
);

export const allRiskPeaks = derived(
	[activeRouteTemporalAnalysis],
	([$analysis]): TemporalRiskPeak[] => {
		return $analysis?.riskPeaks ?? [];
	}
);

export const temporalMetricsSeries = derived(
	[activeRouteTemporalAnalysis],
	([$analysis]) => {
		if (!$analysis) return {
			timeLabels: [] as string[],
			avgIntensity: [] as number[],
			reachableRatio: [] as number[],
			blockedRatio: [] as number[],
			riskCount: [] as number[],
			maxRiskLevel: [] as string[]
		};
		return {
			timeLabels: $analysis.metrics.map(m => {
				const snap = $analysis.timeSnapshots[m.timeIndex];
				return snap?.displayTime ?? `T${m.timeIndex}`;
			}),
			avgIntensity: $analysis.metrics.map(m => m.avgIntensity),
			reachableRatio: $analysis.metrics.map(m => m.reachableRatio),
			blockedRatio: $analysis.metrics.map(m => m.blockedRatio),
			riskCount: $analysis.metrics.map(m => m.riskCount + m.criticalRiskCount * 2),
			maxRiskLevel: $analysis.metrics.map(m => m.maxRiskLevel)
		};
	}
);

export const comparisonSnapshotsData = derived(
	[temporal.comparisonPoints, routes, soundSources, weather, cliffs, timeSnapshots],
	([$points, $routes, $soundSources, $weather, $cliffs, $snapshots]) => {
		const result = new Map<number, {
			snapshot: TimeSnapshot;
			routeAnalyses: Map<string, RouteAnalysisResult>;
			sectorData: MultiSourceSectorSample[];
			totalRiskCount: number;
		}>();

		for (const cp of $points) {
			const snapshot = $snapshots[cp.timeIndex];
			if (!snapshot) continue;

			const factors = calculateTemporalFactors(
				snapshot.tidal, snapshot.seaSurface, snapshot.dayTime
			);

			const routeAnalyses = new Map<string, RouteAnalysisResult>();
			let totalRisk = 0;
			for (const route of $routes) {
				const analysis = analyzeRouteTemporal(
					route, $soundSources, $weather, $cliffs, factors
				);
				routeAnalyses.set(route.id, analysis);
				totalRisk += analysis.riskAlerts.length;
			}

			let sectorData: MultiSourceSectorSample[] = [];
			if ($soundSources.length > 0) {
				if ($soundSources.length === 1) {
					sectorData = calculatePropagationSectorTemporal(
						$soundSources[0], $weather, $cliffs, factors, 36, 500
					);
				} else {
					const cx = $soundSources.reduce((s, p) => s + p.x, 0) / $soundSources.length;
					const cy = $soundSources.reduce((s, p) => s + p.y, 0) / $soundSources.length;
					sectorData = calculateCombinedPropagationSectorTemporal(
						$soundSources, cx, cy, $weather, $cliffs, factors, 36, 500
					);
				}
			}

			result.set(cp.timeIndex, { snapshot, routeAnalyses, sectorData, totalRiskCount: totalRisk });
		}

		return result;
	}
);
