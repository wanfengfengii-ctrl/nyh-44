import { derived } from 'svelte/store';
import { points, lighthouse, nonLighthousePoints } from './pointsStore';
import { cliffs } from './cliffsStore';
import { weather } from './weatherStore';
import { calculateIntensity, calculatePropagationSector } from '../acoustics';
import type { PropagationResult } from '../types';
import type { SectorSample } from '../acoustics';

export const propagationResults = derived(
	[lighthouse, nonLighthousePoints, weather, cliffs],
	([$lighthouse, $nonLighthousePoints, $weather, $cliffs]) => {
		if (!$lighthouse) return [];

		return $nonLighthousePoints.map((point): PropagationResult => {
			return calculateIntensity($lighthouse, point, $weather, $cliffs);
		});
	}
);

export const propagationSector = derived(
	[lighthouse, weather, cliffs],
	([$lighthouse, $weather, $cliffs]) => {
		if (!$lighthouse) return [];

		return calculatePropagationSector($lighthouse, $weather, $cliffs, 72, 600);
	}
);

export const reachablePointsCount = derived(propagationResults, ($results) => {
	return $results.filter((r) => r.isReachable).length;
});

export const blockedPointsCount = derived(propagationResults, ($results) => {
	return $results.filter((r) => r.isBlocked).length;
});

export function getIntensityColor(intensity: number): string {
	if (intensity >= 80) return '#22c55e';
	if (intensity >= 60) return '#84cc16';
	if (intensity >= 40) return '#eab308';
	if (intensity >= 20) return '#f97316';
	return '#ef4444';
}

export function getSectorGradient(samples: SectorSample[]): string {
	const stops = samples
		.map((s, i) => {
			const color = getIntensityColor(s.intensity);
			const percent = (i / samples.length) * 100;
			return `${color} ${percent}%`;
		})
		.join(', ');
	return `conic-gradient(from 0deg, ${stops})`;
}
