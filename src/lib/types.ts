export type PointType = 'lighthouse' | 'coast' | 'port' | 'ship';

export interface Point {
	id: string;
	type: PointType;
	x: number;
	y: number;
	label: string;
}

export interface Cliff {
	id: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	thickness: number;
}

export interface WeatherParams {
	windDirection: number;
	windSpeed: number;
	humidity: number;
	frequency: number;
}

export interface PropagationResult {
	pointId: string;
	distance: number;
	direction: number;
	attenuation: number;
	intensity: number;
	isReachable: boolean;
	isBlocked: boolean;
}

export interface SavedScenario {
	id: string;
	name: string;
	createdAt: number;
	points: Point[];
	cliffs: Cliff[];
	weather: WeatherParams;
}

export type CanvasMode = 'select' | 'addLighthouse' | 'addCoast' | 'addPort' | 'addShip' | 'addCliff';
