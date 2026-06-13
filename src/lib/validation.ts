import type { Point, Cliff, WeatherParams, SavedScenario } from './types';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

export function validatePointIdUnique(points: Point[], newId: string): ValidationResult {
	const errors: string[] = [];
	if (points.some((p) => p.id === newId)) {
		errors.push(`点位编号 "${newId}" 已存在，请使用不同的编号。`);
	}
	return { valid: errors.length === 0, errors };
}

export function validateWeatherParams(weather: WeatherParams): ValidationResult {
	const errors: string[] = [];
	if (weather.windSpeed <= 0) {
		errors.push('风速必须大于 0 m/s。');
	}
	if (weather.frequency <= 0) {
		errors.push('鸣钟频率必须大于 0 Hz。');
	}
	if (weather.humidity < 0 || weather.humidity > 100) {
		errors.push('空气湿度必须在 0-100% 之间。');
	}
	if (weather.windDirection < 0 || weather.windDirection > 360) {
		errors.push('风向必须在 0-360° 之间。');
	}
	return { valid: errors.length === 0, errors };
}

export function checkPointOverlap(
	points: Point[],
	newPoint: Omit<Point, 'id'>,
	threshold: number = 20
): ValidationResult {
	const errors: string[] = [];
	for (const p of points) {
		const dist = Math.sqrt((p.x - newPoint.x) ** 2 + (p.y - newPoint.y) ** 2);
		if (dist < threshold) {
			errors.push(`新点位与 "${p.label}" 位置过于接近（距离 ${dist.toFixed(1)}px），可能发生重叠。`);
		}
	}
	return { valid: errors.length === 0, errors };
}

export function checkCliffOverlap(
	cliffs: Cliff[],
	newCliff: Omit<Cliff, 'id'>,
	threshold: number = 10
): ValidationResult {
	const errors: string[] = [];

	for (const cliff of cliffs) {
		const lines = [
			[cliff.x1, cliff.y1, cliff.x2, cliff.y2],
			[newCliff.x1, newCliff.y1, newCliff.x2, newCliff.y2]
		];

		const denom =
			(lines[0][2] - lines[0][0]) * (lines[1][3] - lines[1][1]) -
			(lines[0][3] - lines[0][1]) * (lines[1][2] - lines[1][0]);

		if (Math.abs(denom) < 0.0001) {
			const dist1 = pointToLineDistance(
				cliff.x1,
				cliff.y1,
				newCliff.x1,
				newCliff.y1,
				newCliff.x2,
				newCliff.y2
			);
			const dist2 = pointToLineDistance(
				cliff.x2,
				cliff.y2,
				newCliff.x1,
				newCliff.y1,
				newCliff.x2,
				newCliff.y2
			);
			if (Math.min(dist1, dist2) < threshold + Math.max(cliff.thickness, newCliff.thickness)) {
				errors.push('新岩壁与现有岩壁位置发生重叠。');
				break;
			}
		} else {
			const t =
				((lines[1][0] - lines[0][0]) * (lines[1][3] - lines[1][1]) -
					(lines[1][1] - lines[0][1]) * (lines[1][2] - lines[1][0])) /
				denom;
			const u =
				-((lines[0][2] - lines[0][0]) * (lines[1][1] - lines[0][1]) -
					(lines[0][3] - lines[0][1]) * (lines[1][0] - lines[0][0])) /
				denom;

			if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
				errors.push('新岩壁与现有岩壁位置发生交叉重叠。');
				break;
			}
		}
	}

	return { valid: errors.length === 0, errors };
}

function pointToLineDistance(
	px: number,
	py: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number
): number {
	const A = px - x1;
	const B = py - y1;
	const C = x2 - x1;
	const D = y2 - y1;
	const dot = A * C + B * D;
	const lenSq = C * C + D * D;
	let param = -1;
	if (lenSq !== 0) param = dot / lenSq;

	let xx: number, yy: number;
	if (param < 0) {
		xx = x1;
		yy = y1;
	} else if (param > 1) {
		xx = x2;
		yy = y2;
	} else {
		xx = x1 + param * C;
		yy = y1 + param * D;
	}

	return Math.sqrt((px - xx) ** 2 + (py - yy) ** 2);
}

const STORAGE_KEY = 'lighthouse-acoustics-scenarios';

export function saveScenario(
	name: string,
	points: Point[],
	cliffs: Cliff[],
	weather: WeatherParams
): SavedScenario {
	const scenario: SavedScenario = {
		id: `scenario-${Date.now()}`,
		name,
		createdAt: Date.now(),
		points: JSON.parse(JSON.stringify(points)),
		cliffs: JSON.parse(JSON.stringify(cliffs)),
		weather: { ...weather }
	};

	const saved = loadAllScenarios();
	saved.push(scenario);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
	return scenario;
}

export function loadAllScenarios(): SavedScenario[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		return JSON.parse(raw);
	} catch {
		return [];
	}
}

export function deleteScenario(id: string): void {
	const saved = loadAllScenarios().filter((s) => s.id !== id);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

export function exportScenario(scenario: SavedScenario): string {
	return JSON.stringify(scenario, null, 2);
}

export function importScenario(json: string): SavedScenario | null {
	try {
		const parsed = JSON.parse(json);
		if (
			parsed.id &&
			parsed.name &&
			Array.isArray(parsed.points) &&
			Array.isArray(parsed.cliffs) &&
			parsed.weather
		) {
			return parsed as SavedScenario;
		}
		return null;
	} catch {
		return null;
	}
}
