/**
 * Screenshots of the admin interface shown on the home page.
 *
 * Each has a light and a dark capture in `static/admin-shots/`, made by
 * `bun run capture:admin` from the local app with demo data (`bun run seed:demo`).
 * Add a screen here, then run both.
 */
export interface AdminShot {
	/** File stem: `<slug>-light.webp`, `<slug>-dark.webp`. */
	slug: string;
	/** Admin route the capture visits. */
	path: string;
	label: string;
	blurb: string;
	/** Pixels to scroll before the capture, to start below an empty form. */
	scrollY?: number;
}

export const adminShots: AdminShot[] = [
	{
		slug: 'stats',
		path: '/admin/stats',
		label: 'Stats',
		blurb:
			'Visitors, pages, referrers and countries from first-party counters. No cookies and no per-visitor data are stored.'
	},
	{
		slug: 'cms',
		path: '/admin/cms',
		label: 'Content',
		blurb: 'Define content types and edit their entries. Blog posts come built in.'
	},
	{
		slug: 'users',
		path: '/admin/users',
		label: 'Users',
		blurb: 'Everyone who has signed in, their role, and which admin areas each admin can open.'
	},
	{
		slug: 'status',
		path: '/admin/status',
		label: 'Status page',
		blurb:
			'Post incidents to the public status page. The site and database checks run on their own.'
	},
	{
		slug: 'scheduled-jobs',
		path: '/admin/scheduled-jobs',
		label: 'Scheduled jobs',
		blurb: 'Every background job, when it last ran, and a Run now button.'
	}
];
