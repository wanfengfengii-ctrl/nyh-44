import { writable, derived } from 'svelte/store';
import type { Point, SoundSourceParams } from '../types';
import { validatePointIdUnique, checkPointOverlap } from '../validation';

const DEFAULT_SOURCE_PARAMS: SoundSourceParams = {
	frequency: 500,
	sourceLevel: 80,
	enabled: true
};

function createPointsStore() {
	const { subscribe, set, update } = writable<Point[]>([]);

	function addPoint(point: Omit<Point, 'id'>, id: string): { success: boolean; errors: string[] } {
		let errors: string[] = [];

		let currentPoints: Point[] = [];
		subscribe((p) => (currentPoints = p))();

		const idResult = validatePointIdUnique(currentPoints, id);
		if (!idResult.valid) {
			errors = [...errors, ...idResult.errors];
		}

		const overlapResult = checkPointOverlap(currentPoints, point);
		if (!overlapResult.valid) {
			errors = [...errors, ...overlapResult.errors];
		}

		if (errors.length > 0) {
			return { success: false, errors };
		}

		let enrichedPoint = { ...point, id };
		if (point.type === 'lighthouse' || point.type === 'foghorn') {
			enrichedPoint.sourceParams = point.sourceParams ?? { ...DEFAULT_SOURCE_PARAMS };
		}

		update((points) => [...points, enrichedPoint]);

		return { success: true, errors: [] };
	}

	function movePoint(id: string, x: number, y: number): { success: boolean; errors: string[] } {
		let errors: string[] = [];

		let currentPoints: Point[] = [];
		subscribe((p) => (currentPoints = p))();

		const point = currentPoints.find((p) => p.id === id);
		if (!point) {
			return { success: false, errors: ['点位不存在。'] };
		}

		const otherPoints = currentPoints.filter((p) => p.id !== id);
		const overlapResult = checkPointOverlap(otherPoints, { ...point, x, y });
		if (!overlapResult.valid) {
			errors = [...errors, ...overlapResult.errors];
		}

		if (errors.length > 0) {
			return { success: false, errors };
		}

		update((points) => {
			const index = points.findIndex((p) => p.id === id);
			if (index === -1) return points;
			return [...points.slice(0, index), { ...points[index], x, y }, ...points.slice(index + 1)];
		});

		return { success: true, errors: [] };
	}

	function updatePoint(id: string, updates: Partial<Point>): boolean {
		let updated = false;
		update((points) => {
			const index = points.findIndex((p) => p.id === id);
			if (index !== -1) {
				updated = true;
				return [...points.slice(0, index), { ...points[index], ...updates }, ...points.slice(index + 1)];
			}
			return points;
		});
		return updated;
	}

	function updateSourceParams(id: string, params: Partial<SoundSourceParams>): boolean {
		return updatePoint(id, {
			sourceParams: { ...DEFAULT_SOURCE_PARAMS, ...params }
		});
	}

	function toggleSourceEnabled(id: string): boolean {
		let result = false;
		let currentPoints: Point[] = [];
		subscribe((p) => (currentPoints = p))();
		const point = currentPoints.find((p) => p.id === id);
		if (point && point.sourceParams) {
			result = updateSourceParams(id, { enabled: !point.sourceParams.enabled });
		}
		return result;
	}

	function removePoint(id: string): void {
		update((points) => points.filter((p) => p.id !== id));
	}

	function clearPoints(): void {
		set([]);
	}

	function getUsedNumbers(type?: Point['type']): number[] {
		let numbers: number[] = [];
		subscribe((points) => {
			numbers = points
				.filter((p) => !type || p.type === type)
				.map((p) => {
					const match = p.label.match(/\d+/);
					return match ? parseInt(match[0]) : NaN;
				})
				.filter((n) => !isNaN(n));
		})();
		return numbers;
	}

	function getNextNumber(type: Point['type']): number {
		const used = getUsedNumbers(type);
		let n = 1;
		while (used.includes(n)) n++;
		return n;
	}

	return {
		subscribe,
		set,
		addPoint,
		movePoint,
		updatePoint,
		updateSourceParams,
		toggleSourceEnabled,
		removePoint,
		clearPoints,
		getUsedNumbers,
		getNextNumber
	};
}

export const points = createPointsStore();

export const soundSources = derived(points, ($points) =>
	$points.filter(
		(p) =>
			(p.type === 'lighthouse' || p.type === 'foghorn') && p.sourceParams?.enabled !== false
	)
);

export const allSources = derived(points, ($points) =>
	$points.filter((p) => p.type === 'lighthouse' || p.type === 'foghorn')
);

export const targetPoints = derived(points, ($points) =>
	$points.filter((p) => p.type !== 'lighthouse' && p.type !== 'foghorn')
);

export const lighthouse = derived(points, ($points) => {
	const sources = $points.filter(
		(p) => p.type === 'lighthouse' && p.sourceParams?.enabled !== false
	);
	return sources.length > 0 ? sources[0] : null;
});

export const nonLighthousePoints = targetPoints;

export const enabledSourcesCount = derived(soundSources, ($s) => $s.length);

export const totalSourcesCount = derived(allSources, ($s) => $s.length);
