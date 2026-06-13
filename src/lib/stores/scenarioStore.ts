import { writable, get } from 'svelte/store';
import type { SavedScenario } from '../types';
import { points } from './pointsStore';
import { cliffs } from './cliffsStore';
import { weather } from './weatherStore';
import { saveScenario, loadAllScenarios, deleteScenario, importScenario, exportScenario } from '../validation';
import { alerts } from './alertsStore';

function createScenarioStore() {
	const { subscribe, set, update } = writable<SavedScenario[]>([]);

	function refresh(): void {
		set(loadAllScenarios());
	}

	function save(name: string): SavedScenario | null {
		const currentPoints = get(points);
		const currentCliffs = get(cliffs);
		const currentWeather = get(weather);

		if (!name.trim()) {
			alerts.showErrors(['请输入方案名称。']);
			return null;
		}

		const scenario = saveScenario(name.trim(), currentPoints, currentCliffs, currentWeather);
		alerts.showSuccess(`方案 "${scenario.name}" 已保存。`);
		refresh();
		return scenario;
	}

	function load(scenario: SavedScenario): void {
		points.set(scenario.points);
		cliffs.set(scenario.cliffs);
		weather.set(scenario.weather);
		alerts.showSuccess(`方案 "${scenario.name}" 已加载。`);
	}

	function remove(id: string): void {
		let currentScenarios: SavedScenario[] = [];
		subscribe((s) => (currentScenarios = s))();
		const scenario = currentScenarios.find((s) => s.id === id);
		deleteScenario(id);
		alerts.showInfo(`方案 "${scenario?.name || id}" 已删除。`);
		refresh();
	}

	function exp(scenario: SavedScenario): string {
		return exportScenario(scenario);
	}

	function imp(json: string): SavedScenario | null {
		const scenario = importScenario(json);
		if (scenario) {
			const saved = loadAllScenarios();
			saved.push({ ...scenario, id: `scenario-${Date.now()}` });
			localStorage.setItem('lighthouse-acoustics-scenarios', JSON.stringify(saved));
			alerts.showSuccess(`方案 "${scenario.name}" 已导入。`);
			refresh();
			return scenario;
		} else {
			alerts.showErrors(['导入失败：无效的方案数据。']);
			return null;
		}
	}

	function clearAll(): void {
		points.clearPoints();
		cliffs.clearCliffs();
		weather.reset();
		alerts.showInfo('画布已清空。');
	}

	refresh();

	return {
		subscribe,
		save,
		load,
		remove,
		export: exp,
		import: imp,
		refresh,
		clearAll
	};
}

export const scenarios = createScenarioStore();
