import { derived } from 'svelte/store';
import { soundSources, targetPoints, allSources } from './pointsStore';
import { cliffs } from './cliffsStore';
import { weather } from './weatherStore';
import { routes, activeRouteId, activeRoute } from './routesStore';
import {
	calculateIntensity,
	calculateCombinedIntensity,
	calculateCombinedPropagationSector,
	calculatePropagationSector,
	analyzeRoute
} from '../acoustics';
import type { PropagationResult, RouteAnalysisResult } from '../types';
import type { SectorSample, MultiSourceSectorSample } from '../acoustics';

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
