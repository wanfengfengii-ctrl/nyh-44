import { writable, derived, get } from 'svelte/store';
import type {
	TemporalParams,
	TidalParams,
	SeaSurfaceParams,
	DayTimeParams,
	TimeSnapshot,
	TidalPhase,
	SeaState,
	TimeOfDay,
	ComparisonTimePoint
} from '../types';

const defaultTidal: TidalParams = {
	tideLevel: 1.5,
	tidalPhase: 'rising',
	tidalRange: 3.0,
	tidalCurrentSpeed: 0.8,
	tidalCurrentDirection: 90
};

const defaultSeaSurface: SeaSurfaceParams = {
	seaState: 'slight',
	waveHeight: 0.5,
	waveDirection: 180,
	surfaceTemperature: 18
};

const defaultDayTime: DayTimeParams = {
	timeOfDay: 'morning',
	hourOfDay: 8,
	visibility: 10,
	ambientNoise: 45
};

const defaultTemporal: TemporalParams = {
	tidal: { ...defaultTidal },
	seaSurface: { ...defaultSeaSurface },
	dayTime: { ...defaultDayTime },
	timeStep: 0.5,
	totalSimulatedHours: 24
};

export const TIDAL_PHASES: { value: TidalPhase; label: string; icon: string }[] = [
	{ value: 'high', label: '高潮', icon: '🌊' },
	{ value: 'rising', label: '涨潮', icon: '⬆️' },
	{ value: 'low', label: '低潮', icon: '🏖️' },
	{ value: 'falling', label: '落潮', icon: '⬇️' }
];

export const SEA_STATES: { value: SeaState; label: string; waveRange: [number, number]; noiseBase: number }[] = [
	{ value: 'calm', label: '风平浪静', waveRange: [0, 0.1], noiseBase: 40 },
	{ value: 'slight', label: '微浪', waveRange: [0.1, 0.5], noiseBase: 45 },
	{ value: 'moderate', label: '中浪', waveRange: [0.5, 1.25], noiseBase: 52 },
	{ value: 'rough', label: '大浪', waveRange: [1.25, 2.5], noiseBase: 60 },
	{ value: 'very_rough', label: '巨浪', waveRange: [2.5, 4.0], noiseBase: 68 },
	{ value: 'stormy', label: '风暴', waveRange: [4.0, 9.0], noiseBase: 78 }
];

export const TIME_OF_DAY: { value: TimeOfDay; label: string; hourRange: [number, number]; visibilityBase: number }[] = [
	{ value: 'dawn', label: '黎明', hourRange: [5, 7], visibilityBase: 6 },
	{ value: 'morning', label: '上午', hourRange: [7, 11], visibilityBase: 12 },
	{ value: 'noon', label: '正午', hourRange: [11, 14], visibilityBase: 15 },
	{ value: 'afternoon', label: '下午', hourRange: [14, 17], visibilityBase: 12 },
	{ value: 'dusk', label: '黄昏', hourRange: [17, 19], visibilityBase: 5 },
	{ value: 'night', label: '夜晚', hourRange: [19, 23], visibilityBase: 3 },
	{ value: 'midnight', label: '深夜', hourRange: [23, 5], visibilityBase: 2 }
];

function hourToTimeOfDay(hour: number): TimeOfDay {
	const h = ((hour % 24) + 24) % 24;
	if (h >= 5 && h < 7) return 'dawn';
	if (h >= 7 && h < 11) return 'morning';
	if (h >= 11 && h < 14) return 'noon';
	if (h >= 14 && h < 17) return 'afternoon';
	if (h >= 17 && h < 19) return 'dusk';
	if (h >= 19 && h < 23) return 'night';
	return 'midnight';
}

function hourToTidalPhase(hour: number, tidalPeriod: number = 12.42): TidalPhase {
	const position = ((hour % tidalPeriod) + tidalPeriod) % tidalPeriod;
	const quarter = tidalPeriod / 4;
	if (position < quarter) return 'rising';
	if (position < quarter * 2) return 'high';
	if (position < quarter * 3) return 'falling';
	return 'low';
}

function calculateTideLevel(hour: number, range: number, phaseOffset: number = 0): number {
	const tidalPeriod = 12.42;
	const phase = ((hour + phaseOffset) / tidalPeriod) * 2 * Math.PI;
	return range / 2 * Math.sin(phase) + range / 2;
}

function seaStateFromWaveHeight(height: number): SeaState {
	for (let i = SEA_STATES.length - 1; i >= 0; i--) {
		if (height >= SEA_STATES[i].waveRange[0]) return SEA_STATES[i].value;
	}
	return 'calm';
}

function formatSimulatedTime(hour: number): string {
	const h = Math.floor(((hour % 24) + 24) % 24);
	const m = Math.floor((hour % 1) * 60);
	return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function createTidalStore() {
	const { subscribe, set, update } = writable<TemporalParams>(JSON.parse(JSON.stringify(defaultTemporal)));
	const currentTimeIndex = writable<number>(0);
	const isPlaying = writable<boolean>(false);
	const playbackSpeed = writable<number>(1);
	const comparisonPoints = writable<ComparisonTimePoint[]>([]);
	let playInterval: ReturnType<typeof setInterval> | null = null;

	function generateTimeSnapshots(): TimeSnapshot[] {
		const params = get({ subscribe });
		const { timeStep, totalSimulatedHours, tidal } = params;
		const snapshots: TimeSnapshot[] = [];
		const numSteps = Math.ceil(totalSimulatedHours / timeStep) + 1;

		for (let i = 0; i < numSteps; i++) {
			const simHour = i * timeStep;
			const tideLevel = calculateTideLevel(simHour, tidal.tidalRange);
			const tidalPhase = hourToTidalPhase(simHour);
			const timeOfDay = hourToTimeOfDay(simHour);

			const todInfo = TIME_OF_DAY.find(t => t.value === timeOfDay)!;

			let waveHeight = 0.5;
			for (const ss of SEA_STATES) {
				if (params.seaSurface.seaState === ss.value) {
					waveHeight = ss.waveRange[0] + (ss.waveRange[1] - ss.waveRange[0]) * 0.3;
					const tideModulation = 0.8 + 0.4 * (tideLevel / Math.max(0.1, tidal.tidalRange));
					waveHeight *= tideModulation;
					break;
				}
			}

			let ambientNoise = 45;
			for (const ss of SEA_STATES) {
				if (params.seaSurface.seaState === ss.value) {
					ambientNoise = ss.noiseBase;
					break;
				}
			}

			const currentSpeedMod = tidalPhase === 'high' || tidalPhase === 'low' ? 0.3 : 1.0;

			snapshots.push({
				timeIndex: i,
				simulatedHour: simHour,
				displayTime: formatSimulatedTime(simHour),
				tidal: {
					tideLevel,
					tidalPhase,
					tidalRange: tidal.tidalRange,
					tidalCurrentSpeed: tidal.tidalCurrentSpeed * currentSpeedMod,
					tidalCurrentDirection: tidal.tidalCurrentDirection
				},
				seaSurface: {
					seaState: seaStateFromWaveHeight(waveHeight),
					waveHeight,
					waveDirection: params.seaSurface.waveDirection,
					surfaceTemperature: params.seaSurface.surfaceTemperature
				},
				dayTime: {
					timeOfDay,
					hourOfDay: ((simHour % 24) + 24) % 24,
					visibility: todInfo.visibilityBase,
					ambientNoise
				}
			});
		}

		return snapshots;
	}

	function updateTemporal(updates: Partial<TemporalParams>): void {
		update((params) => ({ ...params, ...updates }));
	}

	function updateTidalDetails(updates: Partial<TemporalParams['tidal']>): void {
		update((params) => ({
			...params,
			tidal: { ...params.tidal, ...updates }
		}));
	}

	function updateSeaSurface(updates: Partial<SeaSurfaceParams>): void {
		update((params) => ({
			...params,
			seaSurface: { ...params.seaSurface, ...updates }
		}));
	}

	function updateDayTime(updates: Partial<DayTimeParams>): void {
		update((params) => ({
			...params,
			dayTime: { ...params.dayTime, ...updates }
		}));
	}

	function setHourOfDay(hour: number): void {
		const h = ((hour % 24) + 24) % 24;
		const timeOfDay = hourToTimeOfDay(h);
		const todInfo = TIME_OF_DAY.find(t => t.value === timeOfDay)!;
		update((params) => ({
			...params,
			dayTime: {
				...params.dayTime,
				hourOfDay: h,
				timeOfDay,
				visibility: todInfo.visibilityBase
			}
		}));
	}

	function setSeaState(state: SeaState): void {
		const info = SEA_STATES.find(s => s.value === state);
		if (!info) return;
		const waveHeight = (info.waveRange[0] + info.waveRange[1]) / 2;
		update((params) => ({
			...params,
			seaSurface: {
				...params.seaSurface,
				seaState: state,
				waveHeight,
				surfaceTemperature: params.seaSurface.surfaceTemperature
			},
			dayTime: {
				...params.dayTime,
				ambientNoise: info.noiseBase
			}
		}));
	}

	function setTidalPhase(phase: TidalPhase): void {
		const phaseOffsets: Record<TidalPhase, number> = {
			rising: 0,
			high: 3.1,
			falling: 6.21,
			low: 9.32
		};
		const offset = phaseOffsets[phase];
		const params = get({ subscribe });
		const tideLevel = calculateTideLevel(offset, params.tidal.tidalRange);
		update((p) => ({
			...p,
			tidal: {
				...p.tidal,
				tidalPhase: phase,
				tideLevel
			}
		}));
	}

	function reset(): void {
		set(JSON.parse(JSON.stringify(defaultTemporal)));
		currentTimeIndex.set(0);
		isPlaying.set(false);
		comparisonPoints.set([]);
		if (playInterval) {
			clearInterval(playInterval);
			playInterval = null;
		}
	}

	function setTimeIndex(index: number): void {
		const snapshots = generateTimeSnapshots();
		const clamped = Math.max(0, Math.min(snapshots.length - 1, index));
		currentTimeIndex.set(clamped);
		const snapshot = snapshots[clamped];
		if (snapshot) {
			set({
				...get({ subscribe }),
				tidal: snapshot.tidal,
				seaSurface: snapshot.seaSurface,
				dayTime: snapshot.dayTime
			});
		}
	}

	function startPlayback(): void {
		if (playInterval) return;
		isPlaying.set(true);
		const snapshots = generateTimeSnapshots();
		playInterval = setInterval(() => {
			const current = get(currentTimeIndex);
			const speed = get(playbackSpeed);
			const next = current + speed;
			if (next >= snapshots.length) {
				currentTimeIndex.set(0);
				setTimeIndex(0);
			} else {
				const floorNext = Math.floor(next);
				currentTimeIndex.set(floorNext);
				setTimeIndex(floorNext);
			}
		}, 500);
	}

	function stopPlayback(): void {
		isPlaying.set(false);
		if (playInterval) {
			clearInterval(playInterval);
			playInterval = null;
		}
	}

	function togglePlayback(): void {
		if (get(isPlaying)) {
			stopPlayback();
		} else {
			startPlayback();
		}
	}

	function setPlaybackSpeed(speed: number): void {
		playbackSpeed.set(Math.max(0.25, Math.min(8, speed)));
	}

	function addComparisonPoint(label?: string): void {
		const currentIdx = get(currentTimeIndex);
		const snapshots = generateTimeSnapshots();
		const snapshot = snapshots[currentIdx];
		if (!snapshot) return;
		const existing = get(comparisonPoints);
		if (existing.length >= 4) return;
		if (existing.some(p => p.timeIndex === currentIdx)) return;
		comparisonPoints.set([
			...existing,
			{
				label: label || `T${existing.length + 1} (${snapshot.displayTime})`,
				timeIndex: currentIdx,
				simulatedHour: snapshot.simulatedHour
			}
		]);
	}

	function removeComparisonPoint(timeIndex: number): void {
		comparisonPoints.update(points => points.filter(p => p.timeIndex !== timeIndex));
	}

	function clearComparisonPoints(): void {
		comparisonPoints.set([]);
	}

	return {
		subscribe,
		set,
		update: updateTemporal,
		updateTidal: updateTidalDetails,
		updateSeaSurface,
		updateDayTime,
		setHourOfDay,
		setSeaState,
		setTidalPhase,
		reset,
		generateTimeSnapshots,
		currentTimeIndex,
		isPlaying,
		playbackSpeed,
		setTimeIndex,
		startPlayback,
		stopPlayback,
		togglePlayback,
		setPlaybackSpeed,
		comparisonPoints,
		addComparisonPoint,
		removeComparisonPoint,
		clearComparisonPoints
	};
}

export const temporal = createTidalStore();

export const currentSnapshot = derived(
	[temporal, temporal.currentTimeIndex],
	([$temporal]) => {
		const snapshots = temporal.generateTimeSnapshots();
		const idx = get(temporal.currentTimeIndex);
		return snapshots[idx] || snapshots[0] || null;
	}
);

export const timeSnapshots = derived(temporal, () => temporal.generateTimeSnapshots());

export const totalTimeSteps = derived(timeSnapshots, ($snapshots) => $snapshots.length);

export const tidalAttenuationFactor = derived(
	[temporal],
	([$temporal]) => {
		const { tidal, seaSurface, dayTime } = $temporal;

		const tideMod = 1 - (tidal.tideLevel / Math.max(0.1, tidal.tidalRange)) * 0.15;

		const waveNoisePenalty = seaSurface.waveHeight * 3;

		const ambientAttenuation = Math.max(0, (dayTime.ambientNoise - 40) * 0.15);

		const currentSpeedFactor = tidal.tidalCurrentSpeed * 0.08;

		return {
			tideMod,
			waveNoisePenalty,
			ambientAttenuation,
			currentSpeedFactor,
			totalDbAdjustment: -waveNoisePenalty - ambientAttenuation + currentSpeedFactor,
			intensityMultiplier: tideMod
		};
	}
);
