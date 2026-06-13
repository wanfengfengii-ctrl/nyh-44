import { writable, derived } from 'svelte/store';
import type { Route, RouteWaypoint, Point } from '../types';

function createRoutesStore() {
	const { subscribe, set, update } = writable<Route[]>([]);

	function addRoute(name: string, speed: number = 10): Route {
		const id = `route-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const route: Route = {
			id,
			name: name || `航线${getRouteCount() + 1}`,
			waypoints: [],
			speed: speed > 0 ? speed : 10
		};
		update((routes) => [...routes, route]);
		return route;
	}

	function removeRoute(id: string): void {
		update((routes) => routes.filter((r) => r.id !== id));
	}

	function updateRoute(id: string, updates: Partial<Route>): boolean {
		let updated = false;
		update((routes) => {
			const index = routes.findIndex((r) => r.id === id);
			if (index !== -1) {
				updated = true;
				return [...routes.slice(0, index), { ...routes[index], ...updates }, ...routes.slice(index + 1)];
			}
			return routes;
		});
		return updated;
	}

	function setRouteStartPoint(routeId: string, point: Point | null): boolean {
		let updated = false;
		update((routes) => {
			const index = routes.findIndex((r) => r.id === routeId);
			if (index === -1) return routes;
			updated = true;
			const route = { ...routes[index] };
			if (point) {
				route.startPointId = point.id;
				const startWp: RouteWaypoint = {
					id: `wp-start-${point.id}`,
					x: point.x,
					y: point.y,
					label: `起点: ${point.label}`
				};
				if (route.waypoints.length > 0 && route.waypoints[0].id.startsWith('wp-start-')) {
					route.waypoints = [startWp, ...route.waypoints.slice(1)];
				} else {
					route.waypoints = [startWp, ...route.waypoints];
				}
			} else {
				route.startPointId = undefined;
				route.waypoints = route.waypoints.filter((w) => !w.id.startsWith('wp-start-'));
			}
			return [...routes.slice(0, index), route, ...routes.slice(index + 1)];
		});
		return updated;
	}

	function setRouteEndPoint(routeId: string, point: Point | null): boolean {
		let updated = false;
		update((routes) => {
			const index = routes.findIndex((r) => r.id === routeId);
			if (index === -1) return routes;
			updated = true;
			const route = { ...routes[index] };
			if (point) {
				route.endPointId = point.id;
				const endWp: RouteWaypoint = {
					id: `wp-end-${point.id}`,
					x: point.x,
					y: point.y,
					label: `终点: ${point.label}`
				};
				const hasEnd = route.waypoints.length > 0 && route.waypoints[route.waypoints.length - 1].id.startsWith('wp-end-');
				if (hasEnd) {
					route.waypoints = [...route.waypoints.slice(0, -1), endWp];
				} else {
					route.waypoints = [...route.waypoints, endWp];
				}
			} else {
				route.endPointId = undefined;
				route.waypoints = route.waypoints.filter((w) => !w.id.startsWith('wp-end-'));
			}
			return [...routes.slice(0, index), route, ...routes.slice(index + 1)];
		});
		return updated;
	}

	function syncPointToRoutes(pointId: string, x: number, y: number): void {
		update((routes) =>
			routes.map((route) => {
				let changed = false;
				const waypoints = route.waypoints.map((wp) => {
					if (wp.id === `wp-start-${pointId}` || wp.id === `wp-end-${pointId}`) {
						changed = true;
						return { ...wp, x, y };
					}
					return wp;
				});
				return changed ? { ...route, waypoints } : route;
			})
		);
	}

	function unlinkPointFromRoutes(pointId: string): void {
		update((routes) =>
			routes.map((route) => {
				let changed = false;
				const waypoints = route.waypoints.filter((w) => w.id !== `wp-start-${pointId}` && w.id !== `wp-end-${pointId}`);
				if (waypoints.length !== route.waypoints.length) changed = true;
				let startPointId = route.startPointId;
				let endPointId = route.endPointId;
				if (route.startPointId === pointId) {
					startPointId = undefined;
					changed = true;
				}
				if (route.endPointId === pointId) {
					endPointId = undefined;
					changed = true;
				}
				return changed ? { ...route, waypoints, startPointId, endPointId } : route;
			})
		);
	}

	function addWaypoint(routeId: string, x: number, y: number, label?: string): RouteWaypoint | null {
		let wp: RouteWaypoint | null = null;
		let currentRoutes: Route[] = [];
		subscribe((r) => (currentRoutes = r))();

		const route = currentRoutes.find((r) => r.id === routeId);
		if (!route) return null;

		const wpNum = route.waypoints.filter((w) => !w.id.startsWith('wp-start-') && !w.id.startsWith('wp-end-')).length + 1;
		wp = {
			id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			x,
			y,
			label: label || `航点${wpNum}`
		};

		update((routes) => {
			const index = routes.findIndex((r) => r.id === routeId);
			if (index === -1) return routes;
			const updated = { ...routes[index] };
			const hasEnd = updated.waypoints.length > 0 && updated.waypoints[updated.waypoints.length - 1].id.startsWith('wp-end-');
			if (hasEnd) {
				updated.waypoints = [...updated.waypoints.slice(0, -1), wp!, updated.waypoints[updated.waypoints.length - 1]];
			} else {
				updated.waypoints = [...updated.waypoints, wp!];
			}
			return [...routes.slice(0, index), updated, ...routes.slice(index + 1)];
		});

		return wp;
	}

	function removeWaypoint(routeId: string, waypointId: string): void {
		update((routes) => {
			const index = routes.findIndex((r) => r.id === routeId);
			if (index === -1) return routes;
			const updated = { ...routes[index] };
			if (waypointId.startsWith('wp-start-')) {
				updated.startPointId = undefined;
			} else if (waypointId.startsWith('wp-end-')) {
				updated.endPointId = undefined;
			}
			updated.waypoints = updated.waypoints.filter((w) => w.id !== waypointId);
			return [...routes.slice(0, index), updated, ...routes.slice(index + 1)];
		});
	}

	function moveWaypoint(routeId: string, waypointId: string, x: number, y: number): void {
		update((routes) => {
			const index = routes.findIndex((r) => r.id === routeId);
			if (index === -1) return routes;
			const updated = { ...routes[index] };
			updated.waypoints = updated.waypoints.map((w) =>
				w.id === waypointId ? { ...w, x, y } : w
			);
			return [...routes.slice(0, index), updated, ...routes.slice(index + 1)];
		});
	}

	function clearWaypoints(routeId: string): void {
		update((routes) => {
			const index = routes.findIndex((r) => r.id === routeId);
			if (index === -1) return routes;
			const updated = { ...routes[index], waypoints: [], startPointId: undefined, endPointId: undefined };
			return [...routes.slice(0, index), updated, ...routes.slice(index + 1)];
		});
	}

	function getRouteCount(): number {
		let count = 0;
		subscribe((routes) => (count = routes.length))();
		return count;
	}

	function clearRoutes(): void {
		set([]);
	}

	return {
		subscribe,
		set,
		addRoute,
		removeRoute,
		updateRoute,
		setRouteStartPoint,
		setRouteEndPoint,
		syncPointToRoutes,
		unlinkPointFromRoutes,
		addWaypoint,
		removeWaypoint,
		moveWaypoint,
		clearWaypoints,
		clearRoutes
	};
}

export const routes = createRoutesStore();

export const activeRouteId = writable<string | null>(null);

export const activeRoute = derived([routes, activeRouteId], ([$routes, $activeRouteId]) => {
	if (!$activeRouteId) return null;
	return $routes.find((r) => r.id === $activeRouteId) ?? null;
});
