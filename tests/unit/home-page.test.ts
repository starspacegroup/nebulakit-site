import { goto } from '$app/navigation';
import { showCommandPalette } from '$lib/stores/commandPalette';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../src/routes/+page.svelte';

// Mock $app/navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

// The page reads `$page.url.searchParams` to surface auth error toasts. Outside a
// SvelteKit runtime there is no page store to subscribe to, which is what kept this
// whole file skipped. A plain readable store satisfies the contract the component
// actually uses, so the landing page can be tested like any other component.
vi.mock('$app/stores', async () => {
	const { readable } = await import('svelte/store');
	return {
		page: readable({ url: new URL('http://localhost/') })
	};
});

// This is the marketing site's front door — the copy here is the product pitch, so
// it is asserted rather than left to drift.
describe('Home Page Hero', () => {
	beforeEach(() => {
		// Reset the command palette store before each test
		showCommandPalette.set(false);
	});

	afterEach(() => {
		showCommandPalette.set(false);
	});

	it('should render the main title', () => {
		render(Page);
		const title = screen.getByText('NebulaKit');
		expect(title).toBeTruthy();
	});

	it('should declare a canonical url for the landing page', () => {
		render(Page);
		// This is the page most likely to be linked and shared, so it needs to say
		// which URL is the real one.
		const canonical = document.querySelector('link[rel="canonical"]');
		expect(canonical?.getAttribute('href')).toBe('https://nebulakit.starspace.group');
	});

	it('should render the subtitle with correct text', () => {
		render(Page);
		// The subhead is broken up by inline tech icons, so match the container's
		// text rather than a single text node.
		const subtitle = document.querySelector('.subtitle');
		expect(subtitle?.textContent).toMatch(/A production-ready/i);
		expect(subtitle?.textContent).toMatch(/SvelteKit template powered by/i);
		expect(subtitle?.textContent).toMatch(/Cloudflare's full stack/i);
	});

	it('should lead with the "Use this template" call to action', () => {
		render(Page);
		const cta = screen.getAllByRole('link', { name: /Use this template/i })[0];
		expect(cta).toBeTruthy();
		// Must point at the template repo's generate flow, not this marketing repo —
		// sending people here would hand them the site instead of the starter.
		expect(cta.getAttribute('href')).toBe('https://github.com/starspacegroup/NebulaKit/generate');
	});

	it('should render the value propositions', () => {
		render(Page);
		expect(screen.getByText('Deploy in minutes')).toBeTruthy();
		expect(screen.getByText('Real auth, not a stub')).toBeTruthy();
		expect(screen.getByText('Tested by default')).toBeTruthy();
		expect(screen.getByText('Complete, not a skeleton')).toBeTruthy();
	});

	it('should render the search input with placeholder', () => {
		render(Page);
		const searchInput = screen.getByPlaceholderText('Start typing or ask something...');
		expect(searchInput).toBeTruthy();
	});

	it('should render all command options', () => {
		render(Page);
		expect(screen.getByText('Log in')).toBeTruthy();
		expect(screen.getByText('Sign up')).toBeTruthy();
		expect(screen.getByText('Ask something...')).toBeTruthy();
	});

	it('should navigate to login page when Log in is clicked', async () => {
		render(Page);
		const loginButton = screen.getByText('Log in').closest('button');
		expect(loginButton).toBeTruthy();

		if (loginButton) {
			await fireEvent.click(loginButton);
			expect(goto).toHaveBeenCalledWith('/auth/login');
		}
	});

	it('should navigate to signup page when Sign up is clicked', async () => {
		render(Page);
		const signupButton = screen.getByText('Sign up').closest('button');
		expect(signupButton).toBeTruthy();

		if (signupButton) {
			await fireEvent.click(signupButton);
			expect(goto).toHaveBeenCalledWith('/auth/signup');
		}
	});

	it('should navigate to chat page when Ask something is clicked', async () => {
		render(Page);
		const askButton = screen.getByText('Ask something...').closest('button');
		expect(askButton).toBeTruthy();

		if (askButton) {
			await fireEvent.click(askButton);
			expect(goto).toHaveBeenCalledWith('/chat');
		}
	});

	it('should open command palette when search input is clicked', async () => {
		render(Page);
		const searchInput = screen.getByPlaceholderText(
			'Start typing or ask something...'
		) as HTMLInputElement;

		await fireEvent.click(searchInput);

		// Check if command palette store is set to true
		expect(get(showCommandPalette)).toBe(true);
	});

	it('should open command palette when search input is focused', async () => {
		render(Page);
		const searchInput = screen.getByPlaceholderText('Start typing or ask something...');

		await fireEvent.focus(searchInput);

		// Check if command palette store is set to true
		expect(get(showCommandPalette)).toBe(true);
	});

	it('should open command palette when typing in search input', async () => {
		render(Page);
		const searchInput = screen.getByPlaceholderText('Start typing or ask something...');

		await fireEvent.keyDown(searchInput, { key: 'a' });

		// Check if command palette store is set to true
		expect(get(showCommandPalette)).toBe(true);
	});

	it('should render cosmic background elements', () => {
		const { container } = render(Page);

		// Check for cosmic background
		const cosmicBg = container.querySelector('.cosmic-bg');
		expect(cosmicBg).toBeTruthy();

		// Check for stars
		const stars = container.querySelector('.stars-layer');
		expect(stars).toBeTruthy();

		// Check for planets
		const planets = container.querySelectorAll('.planet');
		expect(planets.length).toBeGreaterThan(0);
	});

	it('should render AI indicator with animation bars', () => {
		const { container } = render(Page);
		const bars = container.querySelectorAll('.bar');
		expect(bars.length).toBe(3);
	});

	it('should have accessible search input', () => {
		render(Page);
		const searchInput = screen.getByLabelText('Search or ask a question');
		expect(searchInput).toBeTruthy();
	});
});
