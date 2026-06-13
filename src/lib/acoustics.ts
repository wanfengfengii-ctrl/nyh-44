import type { Point, Cliff, WeatherParams, PropagationResult } from './types';

const SPEED_OF_SOUND = 343;
const REFERENCE_DISTANCE = 1;
const REFERENCE_INTENSITY = 100;

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

export function calculateIntensity(
	source: Point,
	target: Point,
	weather: WeatherParams,
	cliffs: Cliff[]
): PropagationResult {
	const dist = distance(source.x, source.y, target.x, target.y);
	const dir = angleBetween(source.x, source.y, target.x, target.y);
	const isBlocked = isPointBlockedByCliff(source.x, source.y, target.x, target.y, cliffs);

	if (isBlocked || dist === 0) {
		return {
			pointId: target.id,
			distance: dist,
			direction: dir,
			attenuation: Infinity,
			intensity: 0,
			isReachable: false,
			isBlocked
		};
	}

	const sphericalAttenuation = 20 * Math.log10(dist / REFERENCE_DISTANCE);
	const atmosphericAttenuation = calculateAtmosphericAttenuation(
		dist,
		weather.frequency,
		weather.humidity
	);

	const windFactor = calculateWindEffect(dir, weather.windDirection, weather.windSpeed);
	const windGain = windFactor > 1 ? -10 * Math.log10(windFactor) : 10 * Math.log10(1 / windFactor);

	const totalAttenuation = sphericalAttenuation + atmosphericAttenuation + windGain;

	const intensityDb = 80 - totalAttenuation;
	const intensityLinear = Math.max(0, Math.min(100, intensityDb / 80 * 100));
	const isReachable = intensityDb > 20;

	return {
		pointId: target.id,
		distance: dist,
		direction: dir,
		attenuation: totalAttenuation,
		intensity: intensityLinear,
		isReachable,
		isBlocked
	};
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

			const sphericalAttenuation = 20 * Math.log10(d / REFERENCE_DISTANCE);
			const atmosphericAttenuation = calculateAtmosphericAttenuation(
				d,
				weather.frequency,
				weather.humidity
			);
			const windFactor = calculateWindEffect(angle, weather.windDirection, weather.windSpeed);
			const windGain = windFactor > 1 ? -10 * Math.log10(windFactor) : 10 * Math.log10(1 / windFactor);

			const totalAttenuation = sphericalAttenuation + atmosphericAttenuation + windGain;
			const intensityDb = 80 - totalAttenuation;

			if (intensityDb < 20) {
				break;
			}

			maxDist = d;
			finalIntensity = Math.max(0, Math.min(100, intensityDb / 80 * 100));
		}

		samples.push({
			angle,
			maxDistance: maxDist,
			intensity: finalIntensity
		});
	}

	return samples;
}
