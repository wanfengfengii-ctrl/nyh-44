export type PointType = 'lighthouse' | 'foghorn' | 'coast' | 'port' | 'ship';

export type SourceType = 'lighthouse' | 'foghorn';

export interface SoundSourceParams {
	frequency: number;
	sourceLevel: number;
	enabled: boolean;
}

export interface Point {
	id: string;
	type: PointType;
	x: number;
	y: number;
	label: string;
	sourceParams?: SoundSourceParams;
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

export interface RouteWaypoint {
	id: string;
	x: number;
	y: number;
	label: string;
}

export interface Route {
	id: string;
	name: string;
	waypoints: RouteWaypoint[];
	speed: number;
	startPointId?: string;
	endPointId?: string;
}

export interface RouteSegmentIntensity {
	distance: number;
	intensity: number;
	isReachable: boolean;
	isBlocked: boolean;
	contributingSources: string[];
}

export interface RouteAnalysisResult {
	routeId: string;
	totalDistance: number;
	avgIntensity: number;
	minIntensity: number;
	maxIntensity: number;
	reachableRatio: number;
	blockedRatio: number;
	segments: RouteSegmentIntensity[];
	riskAlerts: RouteRiskAlert[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RouteRiskAlert {
	id: string;
	type: 'low_intensity' | 'blocked' | 'dead_zone';
	level: RiskLevel;
	startDistance: number;
	endDistance: number;
	duration: number;
	description: string;
}

export interface SavedScenario {
	id: string;
	name: string;
	createdAt: number;
	points: Point[];
	cliffs: Cliff[];
	weather: WeatherParams;
	routes: Route[];
}

export type CanvasMode =
	| 'select'
	| 'addLighthouse'
	| 'addFoghorn'
	| 'addCoast'
	| 'addPort'
	| 'addShip'
	| 'addCliff'
	| 'editRoute';
