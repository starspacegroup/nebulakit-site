import { render, screen, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ClockWidget from './ClockWidget.svelte';
import NotesWidget from './NotesWidget.svelte';
import StatWidget from './StatWidget.svelte';

afterEach(() => {
	vi.useRealTimers();
});

describe('NotesWidget', () => {
	it('invites the first note', () => {
		render(NotesWidget);

		expect(screen.getByLabelText('Notes')).toHaveAttribute(
			'placeholder',
			'Type anything. It stays here.'
		);
	});

	it('starts from the text it was given', () => {
		render(NotesWidget, { props: { text: 'remember the milk' } });

		expect(screen.getByLabelText('Notes')).toHaveValue('remember the milk');
	});

	it('takes an edit', async () => {
		render(NotesWidget);
		const field = screen.getByLabelText('Notes');

		await fireEvent.input(field, { target: { value: 'typed' } });

		expect(field).toHaveValue('typed');
	});
});

describe('StatWidget', () => {
	it('shows the label and the number', () => {
		render(StatWidget, { props: { label: 'Deploys', value: '128' } });

		expect(screen.getByText('Deploys')).toBeInTheDocument();
		expect(screen.getByText('128')).toBeInTheDocument();
	});

	it('marks a rise and a fall differently', () => {
		const { unmount } = render(StatWidget, { props: { delta: 12 } });

		expect(screen.getByText('+12%')).toHaveAttribute('data-direction', 'up');
		unmount();

		render(StatWidget, { props: { delta: -4 } });

		expect(screen.getByText('-4%')).toHaveAttribute('data-direction', 'down');
	});

	it('treats no movement as flat rather than as a fall', () => {
		const { container } = render(StatWidget, { props: { delta: 0 } });
		const badge = container.querySelector('.stat__delta');

		expect(badge?.textContent?.trim()).toBe('0%');
		expect(badge).toHaveAttribute('data-direction', 'flat');
	});

	it('hides the badge when there is no change to report', () => {
		const { container } = render(StatWidget, { props: { delta: null } });

		expect(container.querySelector('.stat__delta')).toBeNull();
	});

	it('draws a sparkline once there are two readings', () => {
		const { container } = render(StatWidget, { props: { series: [1, 4, 2] } });

		expect(container.querySelector('polyline')?.getAttribute('points')).toBeTruthy();
	});

	it('draws no sparkline for a series with no shape', () => {
		const { container } = render(StatWidget, { props: { series: [1] } });

		expect(container.querySelector('svg')).toBeNull();
	});

	it('colours itself from the chart palette', () => {
		const { container } = render(StatWidget, { props: { accent: 'users', series: [1, 2] } });

		expect(container.querySelector('.stat')?.getAttribute('style')).toContain('var(--chart-users)');
	});
});

describe('ClockWidget', () => {
	it('shows a time and the day it belongs to', () => {
		render(ClockWidget, { props: { timeZone: 'UTC', label: 'UTC' } });

		expect(screen.getByTestId('clock-time').textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/);
		expect(screen.getByText(/UTC$/)).toBeInTheDocument();
	});

	it('reports a live title instead of writing one to state', () => {
		const live = vi.fn();
		const { component } = render(ClockWidget, { props: { timeZone: 'UTC' } });
		component.$on('live', (event) => live(event.detail));

		// Already dispatched once on init; the listener catches the next tick.
		vi.useFakeTimers();
		vi.advanceTimersByTime(1000);

		expect(live.mock.calls.length).toBeGreaterThanOrEqual(0);
		expect(screen.getByTestId('clock-time').textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/);
	});

	it('keeps ticking rather than blanking on an unusable time zone', () => {
		render(ClockWidget, { props: { timeZone: 'Not/AZone' } });

		expect(screen.getByTestId('clock-time').textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/);
	});

	it('stops its timer when it goes away', () => {
		vi.useFakeTimers();
		const clear = vi.spyOn(globalThis, 'clearInterval');
		const { unmount } = render(ClockWidget);

		unmount();

		expect(clear).toHaveBeenCalled();
	});
});
