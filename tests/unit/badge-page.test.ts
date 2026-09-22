/**
 * The /badge page.
 *
 * The page's real job is handing out snippets that work on somebody else's
 * site, so the assertions here are about the snippets being honest: pointed at
 * the origin the reader is actually on, matching the wording and ground on
 * screen, and never quietly the wrong badge.
 */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

const ORIGIN = 'https://preview.example';

// The literal is repeated inside the factory on purpose: vi.mock is hoisted
// above every const in the file, so referencing ORIGIN here throws before the
// first test runs.
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			url: new URL('https://preview.example/badge'),
			params: {},
			status: 200,
			error: null
		}),
		navigating: writable(null),
		updated: { check: () => Promise.resolve(false), subscribe: writable(false).subscribe }
	};
});

import BadgePage from '../../src/routes/badge/+page.svelte';
import { BADGE_HREF, badgeSvgUrl } from '../../src/lib/badge';

describe('/badge', () => {
	it('offers all three wordings', () => {
		render(BadgePage);
		expect(screen.getByLabelText('Proudly built with NebulaKit')).toBeInTheDocument();
		expect(screen.getByLabelText('Built with NebulaKit')).toBeInTheDocument();
		expect(screen.getByLabelText('Powered by NebulaKit')).toBeInTheDocument();
	});

	it('starts on the wording the template ships', () => {
		render(BadgePage);
		const proud = screen.getByLabelText('Proudly built with NebulaKit') as HTMLInputElement;
		expect(proud.checked).toBe(true);
	});

	it('previews the real image rather than a drawing of one', () => {
		// The preview is an <img> pointed at the endpoint, so a broken renderer
		// shows here instead of only in somebody's README.
		render(BadgePage);
		const preview = screen.getByAltText('Proudly built with NebulaKit');
		expect(preview).toHaveAttribute('src', badgeSvgUrl(ORIGIN, 'proudly', 'dark'));
	});

	it('points its snippets at the origin the reader is on, not the production URL', () => {
		// A preview deployment has to hand out snippets that can be tested where
		// they are read. `$page.url.origin`, not site.config.url.
		render(BadgePage);
		const markdown = screen.getByText(new RegExp(`${ORIGIN}/badge.svg`, 'i'));
		expect(markdown).toBeInTheDocument();
	});

	it('shows a snippet for every form it advertises', () => {
		render(BadgePage);
		for (const title of ['Markdown', 'HTML', 'Web component', 'React', 'Svelte', 'Vue']) {
			expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
		}
	});

	it('gives every snippet its own copy button', () => {
		render(BadgePage);
		expect(screen.getAllByRole('button', { name: /copy/i })).toHaveLength(6);
	});

	it('says plainly that the badge is optional', () => {
		// The badge ships switched on in every generated app. The page that hands
		// it out is the right place to say the licence does not require it.
		render(BadgePage);
		expect(screen.getByText(/never required/i)).toBeInTheDocument();
		expect(screen.getByText(/showBuiltWithBadge: false/)).toBeInTheDocument();
	});

	it('links the mark endpoint for the cases the pill does not cover', () => {
		render(BadgePage);
		expect(screen.getByRole('link', { name: '/badge-mark.svg' })).toHaveAttribute(
			'href',
			'/badge-mark.svg'
		);
	});

	it('names the badge home the snippets point at', () => {
		expect(BADGE_HREF).toBe('https://nebulakit.starspace.group');
	});
});
