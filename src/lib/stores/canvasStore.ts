import { writable } from 'svelte/store';
import type { CanvasMode } from '../types';

interface CanvasState {
	mode: CanvasMode;
	selectedId: string | null;
	selectedType: 'point' | 'cliff' | null;
	cliffStart: { x: number; y: number } | null;
}

const initialState: CanvasState = {
	mode: 'select',
	selectedId: null,
	selectedType: null,
	cliffStart: null
};

function createCanvasStore() {
	const { subscribe, set, update } = writable<CanvasState>(initialState);

	function setMode(mode: CanvasMode): void {
		update((state) => ({
			...state,
			mode,
			selectedId: null,
			selectedType: null,
			cliffStart: null
		}));
	}

	function selectPoint(id: string): void {
		update((state) => ({
			...state,
			selectedId: id,
			selectedType: 'point'
		}));
	}

	function selectCliff(id: string): void {
		update((state) => ({
			...state,
			selectedId: id,
			selectedType: 'cliff'
		}));
	}

	function clearSelection(): void {
		update((state) => ({
			...state,
			selectedId: null,
			selectedType: null,
			cliffStart: null
		}));
	}

	function startCliff(x: number, y: number): void {
		update((state) => ({
			...state,
			cliffStart: { x, y }
		}));
	}

	function endCliff(): void {
		update((state) => ({
			...state,
			cliffStart: null
		}));
	}

	function reset(): void {
		set(initialState);
	}

	return {
		subscribe,
		setMode,
		selectPoint,
		selectCliff,
		clearSelection,
		startCliff,
		endCliff,
		reset
	};
}

export const canvas = createCanvasStore();
