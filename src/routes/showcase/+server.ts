import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** /showcase was a drag-and-drop demo; /components is the page that replaced it. */
export const GET: RequestHandler = () => {
	throw redirect(301, '/components');
};
