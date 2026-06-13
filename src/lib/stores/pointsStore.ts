import { writable, derived } from 'svelte/store';
import type { Point } from '../types';
import { validatePointIdUnique, checkPointOverlap } from '../validation';

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

		update((points) => [...points, { ...point, id }]);
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

	function removePoint(id: string): void {
		update((points) => points.filter((p) => p.id !== id));
	}

	function clearPoints(): void {
		set([]);
	}

	function getUsedNumbers(): number[] {
		let numbers: number[] = [];
		subscribe((points) => {
			numbers = points
				.map((p) => {
					const match = p.label.match(/\d+/);
					return match ? parseInt(match[0]) : NaN;
				})
				.filter((n) => !isNaN(n));
		})();
		return numbers;
	}

	function getNextNumber(type: Point['type']): number {
		const used = getUsedNumbers();
		let n = 1;
		while (used.includes(n)) n++;
		return n;
	}

	return {
		subscribe,
		set,
		addPoint,
		updatePoint,
		removePoint,
		clearPoints,
		getUsedNumbers,
		getNextNumber
	};
}

export const points = createPointsStore();

export const lighthouse = derived(points, ($points) => $points.find((p) => p.type === 'lighthouse'));

export const nonLighthousePoints = derived(points, ($points) =>
	$points.filter((p) => p.type !== 'lighthouse')
);
