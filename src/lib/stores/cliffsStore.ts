import { writable } from 'svelte/store';
import type { Cliff } from '../types';
import { checkCliffOverlap } from '../validation';

function createCliffsStore() {
	const { subscribe, set, update } = writable<Cliff[]>([]);

	function addCliff(cliff: Omit<Cliff, 'id'>): { success: boolean; errors: string[] } {
		let currentCliffs: Cliff[] = [];
		subscribe((c) => (currentCliffs = c))();

		const overlapResult = checkCliffOverlap(currentCliffs, cliff);
		if (!overlapResult.valid) {
			return { success: false, errors: overlapResult.errors };
		}

		const id = `cliff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		update((cliffs) => [...cliffs, { ...cliff, id }]);
		return { success: true, errors: [] };
	}

	function updateCliff(id: string, updates: Partial<Cliff>): boolean {
		let updated = false;
		update((cliffs) => {
			const index = cliffs.findIndex((c) => c.id === id);
			if (index !== -1) {
				updated = true;
				return [...cliffs.slice(0, index), { ...cliffs[index], ...updates }, ...cliffs.slice(index + 1)];
			}
			return cliffs;
		});
		return updated;
	}

	function removeCliff(id: string): void {
		update((cliffs) => cliffs.filter((c) => c.id !== id));
	}

	function clearCliffs(): void {
		set([]);
	}

	return {
		subscribe,
		set,
		addCliff,
		updateCliff,
		removeCliff,
		clearCliffs
	};
}

export const cliffs = createCliffsStore();
