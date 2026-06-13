import type { Point, Cliff, WeatherParams, PropagationResult, Route, RouteSegmentIntensity, RouteAnalysisResult, RouteRiskAlert, RiskLevel } from './types';

const SPEED_OF_SOUND = 343;
const REFERENCE_DISTANCE = 1;
const DEFAULT_SOURCE_LEVEL = 80;
const REACHABLE_THRESHOLD_DB = 20;
const LOW_INTENSITY_THRESHOLD = 30;

function degToRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
	return (rad * 180) / Math.PI;
}

function normalizeAngle(deg: number): number {
	let result = deg % 360;
	if (result < 0) result += 360;
	return result;
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
	return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function angleBetween(
	fromX: number,
	fromY: number,
	toX: number,
	toY: number
): number {
	const dx = toX - fromX;
	const dy = toY - fromY;
	let angle = radToDeg(Math.atan2(dy, dx));
	angle = 90 - angle;
	return normalizeAngle(angle);
}

export function lineSegmentsIntersect(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	x3: number,
	y3: number,
	x4: number,
	y4: number
): boolean {
	const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
	if (Math.abs(denom) < 0.0001) return false;

	const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
	const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

	return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function isPointBlockedByCliff(
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	cliffs: Cliff[]
): boolean {
	for (const cliff of cliffs) {
		const dx = cliff.x2 - cliff.x1;
		const dy = cliff.y2 - cliff.y1;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len === 0) continue;

		const nx = -dy / len;
		const ny = dx / len;
		const halfT = cliff.thickness / 2;

		const corners = [
			{ x: cliff.x1 + nx * halfT, y: cliff.y1 + ny * halfT },
			{ x: cliff.x2 + nx * halfT, y: cliff.y2 + ny * halfT },
			{ x: cliff.x2 - nx * halfT, y: cliff.y2 - ny * halfT },
			{ x: cliff.x1 - nx * halfT, y: cliff.y1 - ny * halfT }
		];

		for (let i = 0; i < 4; i++) {
			const c1 = corners[i];
			const c2 = corners[(i + 1) % 4];
			if (lineSegmentsIntersect(fromX, fromY, toX, toY, c1.x, c1.y, c2.x, c2.y)) {
				return true;
			}
		}
	}
	return false;
}

export function calculateAtmosphericAttenuation(
	distance: number,
	frequency: number,
	humidity: number
): number {
	const f = frequency / 1000;
	const h = humidity;
	const T = 20;
	const T0 = 293.15;
	const Tk = T + 273.15;

	const psat = 10 ** (-6.8346 * (T0 / Tk) ** 1.261 + 4.6151);
	const hrel = h;
	const hmol = (hrel * psat) / 101.325;

	const frn = (T0 / Tk) ** (1 / 2) * (9 + 280 * hmol * Math.exp(-4.17 * ((T0 / Tk) ** (1 / 3) - 1)));
	const fro = (T0 / Tk) ** (-1 / 2) * (24 + 40400 * hmol);

	const alpha =
		8.686 *
		f *
		f *
		((1.84 * 10 ** -11 * (Tk / T0) ** (1 / 2)) /
			(frn + f * f / frn) +
			0.01275 * Math.exp(-2239.1 / Tk) * (1 / (fro + f * f / fro)));

	return alpha * distance;
}

export function calculateWindEffect(
	directionToTarget: number,
	windDirection: number,
	windSpeed: number
): number {
	const angleDiff = normalizeAngle(directionToTarget - windDirection);
	const angleRad = degToRad(angleDiff);
	const windComponent = windSpeed * Math.cos(angleRad);

	const effectiveSpeed = SPEED_OF_SOUND + windComponent;
	const windFactor = effectiveSpeed / SPEED_OF_SOUND;

	return windFactor;
}

export function calculateIntensityFromSource(
	sourceX: number,
	sourceY: number,
	sourceFrequency: number,
	sourceLevel: number,
	targetX: number,
	targetY: number,
	weather: WeatherParams,
	cliffs: Cliff[]
): { intensityDb: number; intensityLinear: number; isReachable: boolean; isBlocked: boolean; attenuation: number; distance: number; direction: number } {
	const dist = distance(sourceX, sourceY, targetX, targetY);
	const dir = angleBetween(sourceX, sourceY, targetX, targetY);
	const isBlocked = isPointBlockedByCliff(sourceX, sourceY, targetX, targetY, cliffs);

	if (isBlocked || dist === 0) {
		return {
			distance: dist,
			direction: dir,
			attenuation: Infinity,
			intensityDb: 0,
			intensityLinear: 0,
			isReachable: false,
			isBlocked
		};
	}

	const sphericalAttenuation = 20 * Math.log10(dist / REFERENCE_DISTANCE);
	const atmosphericAttenuation = calculateAtmosphericAttenuation(
		dist,
		sourceFrequency,
		weather.humidity
	);

	const windFactor = calculateWindEffect(dir, weather.windDirection, weather.windSpeed);
	const windGain = windFactor > 1 ? -10 * Math.log10(windFactor) : 10 * Math.log10(1 / windFactor);

	const totalAttenuation = sphericalAttenuation + atmosphericAttenuation + windGain;
	const intensityDb = sourceLevel - totalAttenuation;
	const intensityLinear = Math.max(0, Math.min(100, (intensityDb / sourceLevel) * 100));
	const isReachable = intensityDb > REACHABLE_THRESHOLD_DB;

	return {
		distance: dist,
		direction: dir,
		attenuation: totalAttenuation,
		intensityDb,
		intensityLinear,
		isReachable,
		isBlocked
	};
}

export function calculateIntensity(
	source: Point,
	target: Point,
	weather: WeatherParams,
	cliffs: Cliff[]
): PropagationResult {
	const freq = source.sourceParams?.frequency ?? weather.frequency;
	const level = source.sourceParams?.sourceLevel ?? DEFAULT_SOURCE_LEVEL;

	const result = calculateIntensityFromSource(
		source.x,
		source.y,
		freq,
		level,
		target.x,
		target.y,
		weather,
		cliffs
	);

	return {
		pointId: target.id,
		distance: result.distance,
		direction: result.direction,
		attenuation: result.attenuation,
		intensity: result.intensityLinear,
		isReachable: result.isReachable,
		isBlocked: result.isBlocked
	};
}

export function calculateCombinedIntensity(
	sources: Point[],
	targetX: number,
	targetY: number,
	weather: WeatherParams,
	cliffs: Cliff[]
): { totalIntensityDb: number; totalIntensityLinear: number; isReachable: boolean; contributingSources: string[]; perSource: Map<string, number> } {
	const perSource = new Map<string, number>();
	let totalPower = 0;
	const contributingSources: string[] = [];

	for (const source of sources) {
		if (source.sourceParams?.enabled === false) continue;
		if (source.type !== 'lighthouse' && source.type !== 'foghorn') continue;

		const freq = source.sourceParams?.frequency ?? weather.frequency;
		const level = source.sourceParams?.sourceLevel ?? DEFAULT_SOURCE_LEVEL;

		const result = calculateIntensityFromSource(
			source.x,
			source.y,
			freq,
			level,
			targetX,
			targetY,
			weather,
			cliffs
		);

		perSource.set(source.id, result.intensityDb);

		if (result.isReachable && !result.isBlocked) {
			const intensityWm2 = Math.pow(10, result.intensityDb / 10);
			totalPower += intensityWm2;
			contributingSources.push(source.id);
		}
	}

	const totalIntensityDb = totalPower > 0 ? 10 * Math.log10(totalPower) : 0;
	const maxLevel = Math.max(...sources.filter(s => s.type === 'lighthouse' || s.type === 'foghorn').map(s => s.sourceParams?.sourceLevel ?? DEFAULT_SOURCE_LEVEL), DEFAULT_SOURCE_LEVEL);
	const totalIntensityLinear = Math.max(0, Math.min(100, (totalIntensityDb / maxLevel) * 100));
	const isReachable = totalIntensityDb > REACHABLE_THRESHOLD_DB;

	return { totalIntensityDb, totalIntensityLinear, isReachable, contributingSources, perSource };
}

export interface SectorSample {
	angle: number;
	maxDistance: number;
	intensity: number;
}

export function calculatePropagationSector(
	source: Point,
	weather: WeatherParams,
	cliffs: Cliff[],
	numSamples: number = 36,
	maxRange: number = 500
): SectorSample[] {
	const samples: SectorSample[] = [];
	const freq = source.sourceParams?.frequency ?? weather.frequency;
	const level = source.sourceParams?.sourceLevel ?? DEFAULT_SOURCE_LEVEL;

	for (let i = 0; i < numSamples; i++) {
		const angle = (360 / numSamples) * i;
		const rad = degToRad(90 - angle);

		let maxDist = 0;
		let finalIntensity = 0;

		for (let d = 10; d <= maxRange; d += 10) {
			const tx = source.x + Math.cos(rad) * d;
			const ty = source.y + Math.sin(rad) * d;

			const blocked = isPointBlockedByCliff(source.x, source.y, tx, ty, cliffs);
			if (blocked) break;

			const result = calculateIntensityFromSource(
				source.x,
				source.y,
				freq,
				level,
				tx,
				ty,
				weather,
				cliffs
			);

			if (result.intensityDb < REACHABLE_THRESHOLD_DB) {
				break;
			}

			maxDist = d;
			finalIntensity = result.intensityLinear;
		}

		samples.push({
			angle,
			maxDistance: maxDist,
			intensity: finalIntensity
		});
	}

	return samples;
}

export interface MultiSourceSectorSample {
	angle: number;
	maxDistance: number;
	intensity: number;
}

export function calculateCombinedPropagationSector(
	sources: Point[],
	centerX: number,
	centerY: number,
	weather: WeatherParams,
	cliffs: Cliff[],
	numSamples: number = 72,
	maxRange: number = 800
): MultiSourceSectorSample[] {
	const samples: MultiSourceSectorSample[] = [];

	for (let i = 0; i < numSamples; i++) {
		const angle = (360 / numSamples) * i;
		const rad = degToRad(90 - angle);

		let maxDist = 0;
		let finalIntensity = 0;

		for (let d = 10; d <= maxRange; d += 10) {
			const tx = centerX + Math.cos(rad) * d;
			const ty = centerY + Math.sin(rad) * d;

			const result = calculateCombinedIntensity(sources, tx, ty, weather, cliffs);

			if (!result.isReachable) {
				break;
			}

			maxDist = d;
			finalIntensity = result.totalIntensityLinear;
		}

		samples.push({
			angle,
			maxDistance: maxDist,
			intensity: finalIntensity
		});
	}

	return samples;
}

export function analyzeRoute(
	route: Route,
	sources: Point[],
	weather: WeatherParams,
	cliffs: Cliff[],
	sampleInterval: number = 20
): RouteAnalysisResult {
	const segments: RouteSegmentIntensity[] = [];
	let totalDistance = 0;
	let totalIntensity = 0;
	let minIntensity = 100;
	let maxIntensity = 0;
	let reachableCount = 0;
	let blockedCount = 0;
	let sampleCount = 0;

	if (route.waypoints.length < 2) {
		return {
			routeId: route.id,
			totalDistance: 0,
			avgIntensity: 0,
			minIntensity: 0,
			maxIntensity: 0,
			reachableRatio: 0,
			blockedRatio: 0,
			segments: [],
			riskAlerts: []
		};
	}

	for (let i = 0; i < route.waypoints.length - 1; i++) {
		const start = route.waypoints[i];
		const end = route.waypoints[i + 1];
		const segDist = distance(start.x, start.y, end.x, end.y);
		const steps = Math.max(1, Math.ceil(segDist / sampleInterval));

		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			const x = start.x + (end.x - start.x) * t;
			const y = start.y + (end.y - start.y) * t;
			const distFromStart = totalDistance + segDist * t;

			const result = calculateCombinedIntensity(sources, x, y, weather, cliffs);

			const intensityLinear = result.totalIntensityLinear;
			const isBlocked = result.contributingSources.length === 0 && sources.some(s => (s.type === 'lighthouse' || s.type === 'foghorn') && s.sourceParams?.enabled !== false);

			segments.push({
				distance: distFromStart,
				intensity: intensityLinear,
				isReachable: result.isReachable,
				isBlocked,
				contributingSources: result.contributingSources
			});

			sampleCount++;
			totalIntensity += intensityLinear;
			minIntensity = Math.min(minIntensity, intensityLinear);
			maxIntensity = Math.max(maxIntensity, intensityLinear);

			if (result.isReachable) reachableCount++;
			if (isBlocked) blockedCount++;
		}

		totalDistance += segDist;
	}

	const avgIntensity = sampleCount > 0 ? totalIntensity / sampleCount : 0;
	const reachableRatio = sampleCount > 0 ? reachableCount / sampleCount : 0;
	const blockedRatio = sampleCount > 0 ? blockedCount / sampleCount : 0;

	const riskAlerts = generateRiskAlerts(segments, route.speed, totalDistance);

	return {
		routeId: route.id,
		totalDistance,
		avgIntensity,
		minIntensity,
		maxIntensity,
		reachableRatio,
		blockedRatio,
		segments,
		riskAlerts
	};
}

function generateRiskAlerts(
	segments: RouteSegmentIntensity[],
	speed: number,
	totalDistance: number
): RouteRiskAlert[] {
	const alerts: RouteRiskAlert[] = [];
	const speedMs = speed > 0 ? speed : 10;

	let i = 0;
	while (i < segments.length) {
		const seg = segments[i];

		if (seg.isBlocked) {
			let j = i;
			while (j < segments.length && segments[j].isBlocked) {
				j++;
			}
			const startDist = seg.distance;
			const endDist = segments[j - 1].distance;
			const duration = (endDist - startDist) / speedMs;

			let level: RiskLevel = 'medium';
			if (duration > 300) level = 'critical';
			else if (duration > 120) level = 'high';
			else if (duration > 60) level = 'medium';
			else level = 'low';

			alerts.push({
				id: `blocked-${i}`,
				type: 'blocked',
				level,
				startDistance: startDist,
				endDistance: endDist,
				duration,
				description: `遮蔽盲区：距离 ${startDist.toFixed(0)}-${endDist.toFixed(0)}m，持续约 ${formatDuration(duration)}`
			});

			i = j;
			continue;
		}

		if (!seg.isReachable && seg.intensity < LOW_INTENSITY_THRESHOLD) {
			let j = i;
			while (j < segments.length && !segments[j].isReachable && segments[j].intensity < LOW_INTENSITY_THRESHOLD && !segments[j].isBlocked) {
				j++;
			}
			const startDist = seg.distance;
			const endDist = segments[j - 1].distance;
			const duration = (endDist - startDist) / speedMs;

			let level: RiskLevel = 'low';
			if (duration > 300) level = 'high';
			else if (duration > 120) level = 'medium';

			if (duration > 30) {
				alerts.push({
					id: `low-${i}`,
					type: 'low_intensity',
					level,
					startDistance: startDist,
					endDistance: endDist,
					duration,
					description: `低声强区：距离 ${startDist.toFixed(0)}-${endDist.toFixed(0)}m，持续约 ${formatDuration(duration)}`
				});
			}

			i = j;
			continue;
		}

		i++;
	}

	const deadZones = detectDeadZones(segments, speedMs);
	alerts.push(...deadZones);

	return alerts.sort((a, b) => {
		const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 };
		return levelOrder[a.level] - levelOrder[b.level];
	});
}

function detectDeadZones(
	segments: RouteSegmentIntensity[],
	speedMs: number
): RouteRiskAlert[] {
	const alerts: RouteRiskAlert[] = [];

	if (segments.length < 3) return alerts;

	let inDeadZone = false;
	let startIdx = 0;
	let minIntensityInZone = 100;

	for (let i = 1; i < segments.length - 1; i++) {
		const prev = segments[i - 1];
		const curr = segments[i];
		const next = segments[i + 1];

		const isLocalMin = curr.intensity < prev.intensity && curr.intensity < next.intensity;
		const isVeryLow = curr.intensity < 15;

		if (isLocalMin && isVeryLow && !inDeadZone) {
			inDeadZone = true;
			startIdx = i;
			minIntensityInZone = curr.intensity;
		} else if (inDeadZone && curr.intensity > prev.intensity && curr.intensity > 25) {
			const startDist = segments[startIdx].distance;
			const endDist = segments[i].distance;
			const duration = (endDist - startDist) / speedMs;

			if (duration > 10) {
				alerts.push({
					id: `deadzone-${startIdx}`,
					type: 'dead_zone',
					level: duration > 60 ? 'high' : 'medium',
					startDistance: startDist,
					endDistance: endDist,
					duration,
					description: `声影盲区：距离 ${startDist.toFixed(0)}-${endDist.toFixed(0)}m，最低声强 ${minIntensityInZone.toFixed(1)}%`
				});
			}

			inDeadZone = false;
			minIntensityInZone = 100;
		} else if (inDeadZone) {
			minIntensityInZone = Math.min(minIntensityInZone, curr.intensity);
		}
	}

	return alerts;
}

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds.toFixed(0)}秒`;
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}分${secs}秒`;
}

export function getIntensityColor(intensity: number): string {
	if (intensity >= 80) return '#22c55e';
	if (intensity >= 60) return '#84cc16';
	if (intensity >= 40) return '#eab308';
	if (intensity >= 20) return '#f97316';
	return '#ef4444';
}

export function getRiskColor(level: RiskLevel): string {
	switch (level) {
		case 'critical': return '#dc2626';
		case 'high': return '#f97316';
		case 'medium': return '#eab308';
		case 'low': return '#22c55e';
	}
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
