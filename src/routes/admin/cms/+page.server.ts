/**
 * Admin CMS Dashboard - Server Load
 *
 * Loads all content types and their item counts.
 */
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/cms/types');
		if (response.ok) {
			const data = await response.json();
			return { contentTypes: data.types || [] };
		}
	} catch (error) {
		console.error('Failed to load CMS data:', error);
	}
	return { contentTypes: [] };
};
