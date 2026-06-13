import { writable } from 'svelte/store';
import type { WeatherParams } from '../types';
import { validateWeatherParams } from '../validation';

const defaultWeather: WeatherParams = {
	windDirection: 90,
	windSpeed: 5,
	humidity: 70,
	frequency: 500
};

function createWeatherStore() {
	const { subscribe, set, update } = writable<WeatherParams>(defaultWeather);

	function updateWeather(updates: Partial<WeatherParams>): { success: boolean; errors: string[] } {
		let current: WeatherParams = defaultWeather;
		subscribe((w) => (current = w))();

		const newWeather = { ...current, ...updates };
		const result = validateWeatherParams(newWeather);

		if (!result.valid) {
			return { success: false, errors: result.errors };
		}

		set(newWeather);
		return { success: true, errors: [] };
	}

	function reset(): void {
		set(defaultWeather);
	}

	return {
		subscribe,
		set,
		update: updateWeather,
		reset
	};
}

export const weather = createWeatherStore();
