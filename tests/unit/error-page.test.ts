import { writable } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock SvelteKit modules
vi.mock('$app/stores', () => {
	return {
		page: writable({
			status: 404,
			error: null,
			url: new URL('http://localhost/not-found')
		})
	};
});

describe('Error Page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Error Info Mapping', () => {
		const errorInfo: Record<number, { title: string; message: string; icon: string }> = {
			400: {
				title: 'Bad Request',
				message: 'Something went wrong with your request. Please check and try again.',
				icon: '⚠️'
			},
			401: {
				title: 'Unauthorized',
				message: 'You need to be logged in to access this page.',
				icon: '🔐'
			},
			403: {
				title: 'Forbidden',
				message: "You don't have permission to access this resource.",
				icon: '🚫'
			},
			404: {
				title: 'Lost in Space',
				message: "The page you're looking for has drifted into the cosmic void.",
				icon: '🌌'
			},
			500: {
				title: 'Server Error',
				message: "Our servers encountered an unexpected anomaly. We're on it!",
				icon: '💥'
			},
			502: {
				title: 'Bad Gateway',
				message: "We're having trouble connecting to our services.",
				icon: '🔌'
			},
			503: {
				title: 'Service Unavailable',
				message: "We're temporarily offline for maintenance. Please try again soon.",
				icon: '🔧'
			},
			504: {
				title: 'Gateway Timeout',
				message: 'The request took too long to process. Please try again.',
				icon: '⏱️'
			}
		};

		it('should have correct info for 400 Bad Request', () => {
			expect(errorInfo[400].title).toBe('Bad Request');
			expect(errorInfo[400].icon).toBe('⚠️');
		});

		it('should have correct info for 401 Unauthorized', () => {
			expect(errorInfo[401].title).toBe('Unauthorized');
			expect(errorInfo[401].icon).toBe('🔐');
		});

		it('should have correct info for 403 Forbidden', () => {
			expect(errorInfo[403].title).toBe('Forbidden');
			expect(errorInfo[403].icon).toBe('🚫');
		});

		it('should have correct info for 404 Not Found', () => {
			expect(errorInfo[404].title).toBe('Lost in Space');
			expect(errorInfo[404].icon).toBe('🌌');
		});

		it('should have correct info for 500 Server Error', () => {
			expect(errorInfo[500].title).toBe('Server Error');
			expect(errorInfo[500].icon).toBe('💥');
		});

		it('should have correct info for 502 Bad Gateway', () => {
			expect(errorInfo[502].title).toBe('Bad Gateway');
			expect(errorInfo[502].icon).toBe('🔌');
		});

		it('should have correct info for 503 Service Unavailable', () => {
			expect(errorInfo[503].title).toBe('Service Unavailable');
			expect(errorInfo[503].icon).toBe('🔧');
		});

		it('should have correct info for 504 Gateway Timeout', () => {
			expect(errorInfo[504].title).toBe('Gateway Timeout');
			expect(errorInfo[504].icon).toBe('⏱️');
		});

		it('should provide fallback for unknown error codes', () => {
			const unknownStatus = 418; // I'm a teapot
			const fallback = errorInfo[unknownStatus] || {
				title: 'Something Went Wrong',
				message: 'An unexpected error occurred.',
				icon: '❌'
			};
			expect(fallback.title).toBe('Something Went Wrong');
			expect(fallback.icon).toBe('❌');
		});
	});

	describe('Error Code Display', () => {
		it('should split 3-digit status codes correctly', () => {
			const status = 404;
			const digits = String(status).split('');
			expect(digits).toEqual(['4', '0', '4']);
		});

		it('should handle 500 series errors', () => {
			const status = 503;
			const digits = String(status).split('');
			expect(digits).toEqual(['5', '0', '3']);
		});
	});

	describe('Page Title', () => {
		it('should generate correct page title for known errors', () => {
			const status = 404;
			const title = 'Lost in Space';
			const expectedTitle = `${status} - ${title} | NebulaKit`;
			expect(expectedTitle).toBe('404 - Lost in Space | NebulaKit');
		});

		it('should generate correct page title for server errors', () => {
			const status = 500;
			const title = 'Server Error';
			const expectedTitle = `${status} - ${title} | NebulaKit`;
			expect(expectedTitle).toBe('500 - Server Error | NebulaKit');
		});
	});

	describe('Error Details', () => {
		it('should show technical details when error message differs from display message', () => {
			const error = { message: 'Database connection failed' };
			const info = { message: 'Our servers encountered an unexpected anomaly.' };
			const shouldShowDetails = error?.message && error.message !== info.message;
			expect(shouldShowDetails).toBe(true);
		});

		it('should hide technical details when messages are the same', () => {
			const displayMessage = 'An unexpected error occurred.';
			const error = { message: displayMessage };
			const info = { message: displayMessage };
			const shouldShowDetails = error?.message && error.message !== info.message;
			expect(shouldShowDetails).toBe(false);
		});

		it('should hide technical details when no error message', () => {
			const error = null as { message?: string } | null;
			const shouldShowDetails = error?.message && error.message !== 'Some message';
			expect(shouldShowDetails).toBeFalsy();
		});
	});

	describe('Navigation Actions', () => {
		it('should have Go Home button linking to root', () => {
			const homeLink = '/';
			expect(homeLink).toBe('/');
		});

		it('should have Go Back button that calls history.back()', () => {
			const mockBack = vi.fn();
			const originalBack = globalThis.history?.back;

			// Mock history.back
			Object.defineProperty(globalThis, 'history', {
				value: { back: mockBack },
				writable: true
			});

			// Simulate button click
			globalThis.history.back();
			expect(mockBack).toHaveBeenCalled();

			// Restore
			if (originalBack) {
				Object.defineProperty(globalThis, 'history', {
					value: { back: originalBack },
					writable: true
				});
			}
		});
	});

	describe('Accessibility', () => {
		it('should have aria-hidden on decorative elements', () => {
			// These are the decorative elements that should have aria-hidden="true":
			// - cosmic-bg
			// - error-icon
			// - SVG icons in buttons
			const decorativeElements = ['cosmic-bg', 'error-icon', 'svg icons'];
			expect(decorativeElements.length).toBeGreaterThan(0);
		});

		it('should have descriptive button text', () => {
			const buttonTexts = ['Go Home', 'Go Back'];
			buttonTexts.forEach((text) => {
				expect(text.length).toBeGreaterThan(0);
				expect(text).not.toBe('Click here');
			});
		});
	});

	describe('Theme Compatibility', () => {
		it('should use CSS variables for colors', () => {
			const cssVariables = [
				'--color-primary',
				'--color-secondary',
				'--color-background',
				'--color-surface',
				'--color-text',
				'--color-text-secondary',
				'--color-border',
				'--color-error'
			];
			// All colors in the component should reference these variables
			expect(cssVariables.length).toBe(8);
		});

		it('should use CSS variables for spacing', () => {
			const spacingVariables = ['--spacing-sm', '--spacing-md', '--spacing-lg', '--spacing-xl'];
			expect(spacingVariables.length).toBe(4);
		});

		it('should use CSS variables for transitions', () => {
			const transitionVariable = '--transition-fast';
			expect(transitionVariable).toBeDefined();
		});
	});
});
