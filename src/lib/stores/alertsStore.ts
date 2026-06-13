import { writable } from 'svelte/store';

export interface Alert {
	id: string;
	type: 'error' | 'warning' | 'info' | 'success';
	message: string;
	timestamp: number;
}

function createAlertsStore() {
	const { subscribe, set, update } = writable<Alert[]>([]);

	function addAlert(type: Alert['type'], message: string): string {
		const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const alert: Alert = {
			id,
			type,
			message,
			timestamp: Date.now()
		};
		update((alerts) => [...alerts, alert]);

		setTimeout(() => {
			removeAlert(id);
		}, 5000);

		return id;
	}

	function removeAlert(id: string): void {
		update((alerts) => alerts.filter((a) => a.id !== id));
	}

	function clearAlerts(): void {
		set([]);
	}

	function showErrors(errors: string[]): void {
		errors.forEach((e) => addAlert('error', e));
	}

	function showWarnings(warnings: string[]): void {
		warnings.forEach((w) => addAlert('warning', w));
	}

	function showSuccess(message: string): void {
		addAlert('success', message);
	}

	function showInfo(message: string): void {
		addAlert('info', message);
	}

	return {
		subscribe,
		addAlert,
		removeAlert,
		clearAlerts,
		showErrors,
		showWarnings,
		showSuccess,
		showInfo
	};
}

export const alerts = createAlertsStore();
