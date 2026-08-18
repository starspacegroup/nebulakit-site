/**
 * Widget manifest — metadata for every widget type a board can render.
 * Deliberately free of .svelte imports so Workers, tests, migrations and
 * server routes can all read it.
 *
 * Add entries here and a matching component in ./index.ts to register a widget
 * type for your project. Registering a widget never means editing the board.
 *
 * NebulaKit itself ships this list empty — a template should not force its
 * widgets on a project. These three are this site's own, shown on /showcase.
 */

export interface WidgetDefinition {
	/** Kebab-case type name, matching `BoardWidget.type`. */
	name: string;
	/** Human-readable name, used as the default widget title. */
	label: string;
	description: string;
	/** Props every instance starts with; a widget's own `props` merge over these. */
	defaultProps: Record<string, unknown>;
}

export const widgetManifest: WidgetDefinition[] = [
	{
		name: 'notes',
		label: 'Notes',
		description: 'A scratch pad. Keeps its own local state and nothing else.',
		defaultProps: { text: '' }
	},
	{
		name: 'stat',
		label: 'Stat',
		description: 'A number, its change, and a sparkline in the chart palette.',
		defaultProps: { label: 'Metric', value: '0', delta: null, series: [], accent: 'views' }
	},
	{
		name: 'clock',
		label: 'Clock',
		description: 'Ticks every second and reports a live title, never a stored one.',
		defaultProps: { label: 'Local time' }
	}
];

export function getWidgetDefinition(name: string): WidgetDefinition | undefined {
	return widgetManifest.find((widget) => widget.name === name);
}
