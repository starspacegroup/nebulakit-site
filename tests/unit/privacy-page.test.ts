import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from '../../src/routes/privacy/+page.svelte';

describe('Privacy Policy Page', () => {
	it('should render the page title', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
	});

	it('should have an information collection section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /information.*collect/i })).toBeInTheDocument();
	});

	it('should have a how we use information section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /how we use/i })).toBeInTheDocument();
	});

	it('should have a data storage section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /data storage/i })).toBeInTheDocument();
	});

	it('should have a cookies section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /cookies/i })).toBeInTheDocument();
	});

	it('should have a your rights section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /your rights/i })).toBeInTheDocument();
	});

	it('should have a contact section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /contact/i })).toBeInTheDocument();
	});

	it('should have proper page structure with main element', () => {
		render(Page);
		const main = document.querySelector('main');
		expect(main).toBeInTheDocument();
	});

	it('should link to terms of service', () => {
		render(Page);
		const termsLink = screen.getByRole('link', { name: /terms of service/i });
		expect(termsLink).toHaveAttribute('href', '/terms');
	});
});
