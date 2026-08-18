import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import Page from '../../src/routes/showcase/+page.svelte';

const STORAGE_KEY = 'nebulakit-showcase-layout';

/** Widget titles in one column, in render order. */
function titlesIn(group: string): string[] {
	const zone = document.querySelector(`[data-drag-group="${group}"]`) as HTMLElement;
	return Array.from(zone.querySelectorAll('[data-drag-item] h3')).map(
		(el) => el.textContent?.trim() ?? ''
	);
}

function meter(label: string): string {
	const node = screen.getByText(label).closest('p');
	return node?.querySelector('.meter__value')?.textContent ?? '';
}

beforeEach(() => {
	localStorage.clear();
});

describe('Showcase page', () => {
	it('leads with what the page is', () => {
		render(Page);

		expect(
			screen.getByRole('heading', { level: 1, name: /drag it\. type in it\./i })
		).toBeInTheDocument();
	});

	it('renders a real board with the default layout', () => {
		render(Page);

		expect(titlesIn('overview')[1]).toBe('Page views');
		expect(titlesIn('activity')).toEqual(['Signups', 'Uptime']);
		expect(titlesIn('scratch')).toEqual(['Scratch pad']);
	});

	it('shows the clock through a live title rather than a stored one', async () => {
		render(Page);
		// Mount, then the clock's first tick, then the title re-render.
		await waitFor(() => expect(titlesIn('overview')[0]).toMatch(/\d{1,2}:\d{2}:\d{2}/));

		expect(Number(meter('live title updates'))).toBeGreaterThan(0);
		// The live title moved; the layout did not.
		expect(meter('layout writes')).toBe('0');
	});

	it('starts with nothing written to storage', () => {
		render(Page);

		expect(meter('layout writes')).toBe('0');
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	it('saves the layout, and counts the write, only when something moves', async () => {
		render(Page);

		await fireEvent.keyDown(screen.getByRole('button', { name: 'Move Signups' }), { key: ' ' });
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Move Signups' }), {
			key: 'ArrowDown'
		});

		expect(titlesIn('activity')).toEqual(['Uptime', 'Signups']);
		expect(meter('layout writes')).toBe('1');
		expect(localStorage.getItem(STORAGE_KEY)).toContain('signups');
	});

	it('does not write when a move is cancelled', async () => {
		render(Page);
		const handle = () => screen.getByRole('button', { name: 'Move Signups' });

		await fireEvent.keyDown(handle(), { key: ' ' });
		await fireEvent.keyDown(handle(), { key: 'ArrowUp' });
		await fireEvent.keyDown(handle(), { key: 'Enter' });

		expect(meter('layout writes')).toBe('0');
	});

	it('restores a layout saved in an earlier visit', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{ id: 'notes', type: 'notes', group: 'overview', order: 0, title: 'Scratch pad' }
			])
		);

		render(Page);
		await tick();

		expect(titlesIn('overview')).toEqual(['Scratch pad']);
		expect(titlesIn('activity')).toEqual([]);
	});

	it('ignores a saved layout that no longer makes sense', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify([{ id: 'x', type: 'crypto', group: 'deleted', order: 0 }])
		);

		render(Page);
		await tick();

		expect(titlesIn('activity')).toEqual(['Signups', 'Uptime']);
	});

	it('puts everything back with Reset', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify([{ id: 'notes', type: 'notes', group: 'overview', order: 0 }])
		);
		render(Page);
		await tick();

		await fireEvent.click(screen.getByRole('button', { name: 'Reset layout' }));

		expect(titlesIn('scratch')).toEqual(['Scratch pad']);
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		expect(meter('layout writes')).toBe('0');
	});

	it('can turn dragging off, which takes the handles away', async () => {
		render(Page);

		await fireEvent.click(screen.getByRole('checkbox', { name: /draggable/i }));

		expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
	});

	it('explains the keyboard path', () => {
		render(Page);

		expect(screen.getByRole('heading', { name: /works without a mouse/i })).toBeInTheDocument();
		expect(screen.getByText(/put it back where it started/i)).toBeInTheDocument();
	});

	it('lists the widgets this site registers', () => {
		render(Page);

		const registry = screen.getByRole('list', { name: 'Registered widgets' });

		expect(within(registry).getByText('notes')).toBeInTheDocument();
		expect(within(registry).getByText('stat')).toBeInTheDocument();
		expect(within(registry).getByText('clock')).toBeInTheDocument();
	});

	it('names the four rules the design enforces', () => {
		render(Page);

		expect(screen.getByRole('heading', { name: /order is derived/i })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /carry identity/i })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /hit-test in the space/i })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: /persisted state must be inert/i })
		).toBeInTheDocument();
	});

	it('points at the deeper documentation', () => {
		render(Page);

		expect(screen.getByRole('link', { name: /documentation page/i })).toHaveAttribute(
			'href',
			'/documentation#drag-and-drop'
		);
		expect(screen.getByRole('link', { name: /WIDGET_BOARD\.md/ })).toHaveAttribute(
			'href',
			expect.stringContaining('WIDGET_BOARD.md') as unknown as string
		);
	});
});
