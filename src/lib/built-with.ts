/**
 * Live sites built with NebulaKit, shown on the home page.
 *
 * Each one has a light and a dark capture in `static/built-with/`, made by
 * `bun run capture:built-with` (AGENTS.md §10). Add a site here, then run it.
 */
export interface BuiltWithSite {
	/** File stem for the captures: `<slug>-light.webp`, `<slug>-dark.webp`. */
	slug: string;
	name: string;
	url: string;
	blurb: string;
}

export const builtWith: BuiltWithSite[] = [
	{
		slug: 'starspace-group',
		name: 'StarSpace',
		url: 'https://starspace.group',
		blurb: 'An inclusive coworking community on Discord, with its own live dashboards.'
	},
	{
		slug: 'davis9001-com',
		name: 'davis9001.com',
		url: 'https://davis9001.com',
		blurb: 'Accessible websites and AI tools for everyone.'
	},
	{
		slug: 'davis9001-dev',
		name: 'davis9001.dev',
		url: 'https://davis9001.dev',
		blurb: 'The portfolio of a software and community architect.'
	}
];
