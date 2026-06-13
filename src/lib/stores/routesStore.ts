import { writable, derived } from 'svelte/store';
import type { Route, RouteWaypoint } from '../types';

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

	function addWaypoint(routeId: string, x: number, y: number, label?: string): RouteWaypoint | null {
		let wp: RouteWaypoint | null = null;
		let currentRoutes: Route[] = [];
		subscribe((r) => (currentRoutes = r))();

		const route = currentRoutes.find((r) => r.id === routeId);
		if (!route) return null;

		const wpNum = route.waypoints.length + 1;
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
			updated.waypoints = [...updated.waypoints, wp!];
			return [...routes.slice(0, index), updated, ...routes.slice(index + 1)];
		});

		return wp;
	}

	function removeWaypoint(routeId: string, waypointId: string): void {
		update((routes) => {
			const index = routes.findIndex((r) => r.id === routeId);
			if (index === -1) return routes;
			const updated = { ...routes[index] };
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
			const updated = { ...routes[index], waypoints: [] };
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
