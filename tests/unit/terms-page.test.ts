import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from '../../src/routes/terms/+page.svelte';

describe('Terms of Service Page', () => {
	it('should render the page title', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /terms of service/i })).toBeInTheDocument();
	});

	it('should have an acceptance section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /acceptance/i })).toBeInTheDocument();
	});

	it('should have a use of service section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /use of service/i })).toBeInTheDocument();
	});

	it('should have a user accounts section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /user accounts/i })).toBeInTheDocument();
	});

	it('should have an intellectual property section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /intellectual property/i })).toBeInTheDocument();
	});

	it('should have a limitation of liability section', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /limitation of liability/i })).toBeInTheDocument();
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

	it('should link to privacy policy', () => {
		render(Page);
		const privacyLink = screen.getByRole('link', { name: /privacy policy/i });
		expect(privacyLink).toHaveAttribute('href', '/privacy');
	});
});
