import type { Point, Cliff, WeatherParams, SavedScenario, Route, TemporalParams } from './types';

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

export function validateTemporalParams(temporal: TemporalParams): ValidationResult {
	const errors: string[] = [];
	const { tidal, seaSurface, dayTime } = temporal;

	if (tidal.tideLevel < 0 || tidal.tideLevel > tidal.tidalRange) {
		errors.push('潮位高度必须在 0 到潮差范围之间。');
	}
	if (tidal.tidalRange < 0.1 || tidal.tidalRange > 15) {
		errors.push('潮差范围必须在 0.1-15m 之间。');
	}
	if (tidal.tidalCurrentSpeed < 0 || tidal.tidalCurrentSpeed > 10) {
		errors.push('潮流速度必须在 0-10 m/s 之间。');
	}
	if (tidal.tidalCurrentDirection < 0 || tidal.tidalCurrentDirection > 360) {
		errors.push('潮流方向必须在 0-360° 之间。');
	}
	if (seaSurface.waveHeight < 0 || seaSurface.waveHeight > 15) {
		errors.push('浪高必须在 0-15m 之间。');
	}
	if (seaSurface.waveDirection < 0 || seaSurface.waveDirection > 360) {
		errors.push('浪向必须在 0-360° 之间。');
	}
	if (seaSurface.surfaceTemperature < -5 || seaSurface.surfaceTemperature > 40) {
		errors.push('海水温度必须在 -5 到 40°C 之间。');
	}
	if (dayTime.hourOfDay < 0 || dayTime.hourOfDay >= 24) {
		errors.push('小时必须在 0-24 之间。');
	}
	if (dayTime.visibility < 0.1 || dayTime.visibility > 50) {
		errors.push('能见度必须在 0.1-50 km 之间。');
	}
	if (dayTime.ambientNoise < 20 || dayTime.ambientNoise > 120) {
		errors.push('环境噪声必须在 20-120 dB 之间。');
	}
	if (temporal.timeStep < 0.05 || temporal.timeStep > 6) {
		errors.push('时间步长必须在 0.05-6 小时之间。');
	}
	if (temporal.totalSimulatedHours < 1 || temporal.totalSimulatedHours > 168) {
		errors.push('模拟总时长必须在 1-168 小时之间。');
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
	weather: WeatherParams,
	routes: Route[] = []
): SavedScenario {
	const scenario: SavedScenario = {
		id: `scenario-${Date.now()}`,
		name,
		createdAt: Date.now(),
		points: JSON.parse(JSON.stringify(points)),
		cliffs: JSON.parse(JSON.stringify(cliffs)),
		weather: { ...weather },
		routes: JSON.parse(JSON.stringify(routes))
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
		const parsed = JSON.parse(raw);
		return parsed.map((s: any) => ({
			...s,
			routes: s.routes ?? []
		}));
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

export function importScenario(json: string): { scenario: SavedScenario | null; errors: string[] } {
	try {
		const parsed = JSON.parse(json);
		const errors: string[] = [];

		if (!parsed.id) errors.push('方案缺少 id 字段。');
		if (!parsed.name) errors.push('方案缺少 name 字段。');
		if (!Array.isArray(parsed.points)) errors.push('方案缺少 points 数组。');
		if (!Array.isArray(parsed.cliffs)) errors.push('方案缺少 cliffs 数组。');
		if (!parsed.weather) errors.push('方案缺少 weather 字段。');

		if (!Array.isArray(parsed.routes)) {
			parsed.routes = [];
		}

		if (errors.length > 0) {
			return { scenario: null, errors };
		}

		const pointIds = parsed.points.map((p: any) => p.id);
		const uniqueIds = new Set(pointIds);
		if (pointIds.length !== uniqueIds.size) {
			const duplicates = pointIds.filter((id: string, i: number) => pointIds.indexOf(id) !== i);
			errors.push(`方案中存在重复的点位编号：${[...new Set(duplicates)].join('、')}`);
		}

		const cliffIds = parsed.cliffs.map((c: any) => c.id);
		const uniqueCliffIds = new Set(cliffIds);
		if (cliffIds.length !== uniqueCliffIds.size) {
			const duplicates = cliffIds.filter((id: string, i: number) => cliffIds.indexOf(id) !== i);
			errors.push(`方案中存在重复的岩壁编号：${[...new Set(duplicates)].join('、')}`);
		}

		const routeIds = parsed.routes.map((r: any) => r.id);
		const uniqueRouteIds = new Set(routeIds);
		if (routeIds.length !== uniqueRouteIds.size) {
			const duplicates = routeIds.filter((id: string, i: number) => routeIds.indexOf(id) !== i);
			errors.push(`方案中存在重复的航线编号：${[...new Set(duplicates)].join('、')}`);
		}

		if (errors.length > 0) {
			return { scenario: null, errors };
		}

		return { scenario: parsed as SavedScenario, errors: [] };
	} catch (e) {
		return { scenario: null, errors: ['解析失败：无效的 JSON 格式。'] };
	}
}
