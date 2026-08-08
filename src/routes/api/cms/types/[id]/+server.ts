/**
 * CMS Content Type by ID API
 *
 * GET    /api/cms/types/[id] - Get a single content type
 * PUT    /api/cms/types/[id] - Update a content type
 * DELETE /api/cms/types/[id] - Delete a content type (non-system only)
 */
import { validateContentTypeInput } from '$lib/cms/utils';
import {
	deleteContentTypeFromDB,
	getContentTypeById,
	updateContentTypeInDB
} from '$lib/services/cms';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (!locals.user.isOwner && !locals.user.isAdmin) {
		throw error(403, 'Forbidden');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		const contentType = await getContentTypeById(db, params.id);
		if (!contentType) {
			throw error(404, 'Content type not found');
		}
		return json({ contentType });
	} catch (err: any) {
		if (err?.status) throw err;
		throw error(500, 'Failed to fetch content type');
	}
};

export const PUT: RequestHandler = async ({ platform, locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (!locals.user.isOwner && !locals.user.isAdmin) {
		throw error(403, 'Forbidden');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		const body = await request.json();

		// Validate the input if fields that need validation are present
		const validationErrors = validateContentTypeInput({
			name: body.name || 'placeholder', // name is optional for update
			slug: body.slug,
			fields: body.fields,
			settings: body.settings
		});

		// Filter out name error if name wasn't provided (it's optional for updates)
		const relevantErrors = body.name
			? validationErrors
			: validationErrors.filter((e: string) => !e.includes('name'));

		if (relevantErrors.length > 0) {
			throw error(400, relevantErrors.join(', '));
		}

		const contentType = await updateContentTypeInDB(db, params.id, {
			name: body.name?.trim(),
			slug: body.slug?.trim(),
			description: body.description !== undefined ? body.description?.trim() || null : undefined,
			icon: body.icon,
			fields: body.fields,
			settings: body.settings
		});

		if (!contentType) {
			throw error(404, 'Content type not found');
		}

		return json({ contentType });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to update content type:', err);
		throw error(500, 'Failed to update content type');
	}
};

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (!locals.user.isOwner && !locals.user.isAdmin) {
		throw error(403, 'Forbidden');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		const result = await deleteContentTypeFromDB(db, params.id);

		if (!result.success) {
			throw error(result.reason === 'Cannot delete system content type' ? 403 : 404, result.reason);
		}

		return json({ success: true });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('Failed to delete content type:', err);
		throw error(500, 'Failed to delete content type');
	}
};
