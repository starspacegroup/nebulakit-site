import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from '../../src/routes/documentation/+page.svelte';

describe('Documentation Page', () => {
	it('renders the primary documentation heading and intro', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /NebulaKit documentation/i })).toBeInTheDocument();
		expect(
			screen.getByText(/single source of truth for setup, development, and deployment/i)
		).toBeInTheDocument();
	});

	it('includes beginner-friendly start sections', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /Start Here/i })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: /What You Get Out of the Box/i })
		).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /How To Use the App/i })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: /Working With AI in This Repo/i })
		).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /Quick Start/i })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: /Deployment to Cloudflare Pages/i })
		).toBeInTheDocument();
	});

	it('documents the drag-and-drop board and points at the live one', () => {
		render(Page);

		expect(screen.getByRole('heading', { name: /^Drag and Drop$/i })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /the showcase/i })).toHaveAttribute(
			'href',
			'/showcase'
		);
		expect(screen.getByRole('heading', { name: /keyboard control/i })).toBeInTheDocument();
		expect(screen.getByText(/pick the widget up, and put it down again/i)).toBeInTheDocument();
		expect(screen.getByText(/must be inert/i)).toBeInTheDocument();
	});

	it('documents core product features and operator workflows', () => {
		render(Page);

		expect(screen.getByText(/keyboard-first navigation with command palette/i)).toBeInTheDocument();
		expect(screen.getByText(/open the command palette with ctrl\/cmd \+ k/i)).toBeInTheDocument();
		expect(screen.getByText(/chat route becomes your primary ai surface/i)).toBeInTheDocument();
		expect(
			screen.getByText(/before expecting sign-in or ai features to work/i)
		).toBeInTheDocument();
	});

	it('recommends bun quick start and provides a switchable npm view', () => {
		render(Page);
		const quickStartSection = screen
			.getByRole('heading', { name: /Quick Start/i })
			.closest('section');

		expect(quickStartSection).toBeTruthy();

		const scoped = within(quickStartSection as HTMLElement);

		expect(scoped.getByText(/is the recommended default for this repo/i)).toBeInTheDocument();
		expect(scoped.getByRole('button', { name: /bun/i })).toBeInTheDocument();
		expect(scoped.getByRole('button', { name: /npm/i })).toBeInTheDocument();
		expect(scoped.getByRole('link', { name: /^bun$/i })).toHaveAttribute('href', 'https://bun.sh');
		expect(scoped.getByText(/install dependencies/i)).toBeInTheDocument();
		expect(scoped.getAllByText(/^bun$/i).length).toBeGreaterThan(0);
		expect(scoped.getByText(/^install$/i)).toBeInTheDocument();
		expect(scoped.getByText(/^run dev$/i)).toBeInTheDocument();
	});

	it('explains how to use ai assistance safely in this repository', () => {
		render(Page);

		expect(
			screen.getByText(/treat ai as a fast pair programmer, not as a source of truth/i)
		).toBeInTheDocument();
		expect(
			screen.getByText(/point the assistant at a concrete file, route, failing test, or command/i)
		).toBeInTheDocument();
		expect(screen.getByText(/ask it to write or update tests first/i)).toBeInTheDocument();
		expect(
			screen.getByText(/always finish by running check, tests, and coverage/i)
		).toBeInTheDocument();
	});

	it('documents the admin analytics surface and its privacy stance', () => {
		render(Page);

		const statsSection = screen
			.getByRole('heading', { name: /Admin Analytics/i })
			.closest('section');
		expect(statsSection).toBeTruthy();

		const scoped = within(statsSection as HTMLElement);

		expect(scoped.getAllByText(/\/admin\/stats/i).length).toBeGreaterThan(0);
		// The privacy posture is the reason this ships instead of a GA tag, so it
		// has to be stated on the page users actually read.
		expect(
			scoped.getByText(/no cookies, no identifiers, and no IP addresses/i)
		).toBeInTheDocument();
		expect(scoped.getAllByText(/can_view_stats/i).length).toBeGreaterThan(0);
		expect(scoped.getAllByText(/CRON_SECRET/i).length).toBeGreaterThan(0);
		// content_view_daily is the only counter that grows with the catalogue, so
		// an operator has to be told before they turn it on, not after.
		expect(scoped.getAllByText(/Top content/i).length).toBeGreaterThan(0);
		expect(
			scoped.getByText(/grows with your catalogue rather than with a fixed list/i)
		).toBeInTheDocument();
	});

	// The stats token and /api/stats/summary are a user-visible
	// admin and integration surface, so the documentation has to say how an
	// external dashboard gets in and that the token is shown once.
	it('documents the stats token and the summary endpoint', () => {
		render(Page);

		const scoped = within(
			screen.getByRole('heading', { name: /Admin Analytics/i }).closest('section') as HTMLElement
		);

		expect(
			scoped.getByRole('heading', { name: /Reading Stats From a Dashboard/i })
		).toBeInTheDocument();
		expect(scoped.getAllByText(/\/api\/stats\/summary/).length).toBeGreaterThan(0);
		expect(scoped.getByText(/it is shown once, and only its hash is stored/i)).toBeInTheDocument();
		expect(scoped.getByText(/never issued one answers 401/i)).toBeInTheDocument();
	});

	// /admin/analytics is a user-visible admin surface, so the documentation has
	// to describe it and keep describing it.
	it('documents the optional Google Analytics connection', () => {
		render(Page);

		const scoped = within(
			screen.getByRole('heading', { name: /Admin Analytics/i }).closest('section') as HTMLElement
		);

		expect(scoped.getAllByText('/admin/analytics').length).toBeGreaterThan(0);
		expect(scoped.getByText(/Optional, and off until you turn it on/i)).toBeInTheDocument();
		// Both accepted inputs, because the whole point of the field is that the
		// admin does not have to know which one Google gave them.
		expect(scoped.getAllByText('G-ABCD123456').length).toBeGreaterThan(0);
		expect(scoped.getAllByText('gtag.js').length).toBeGreaterThan(0);
		// The exclusions and the privacy consequence are the two things an
		// operator gets wrong if nobody tells them.
		expect(scoped.getByText(/loads on public pages only/i)).toBeInTheDocument();
		expect(
			scoped.getByText(/review your privacy policy and add\s+a consent banner/i)
		).toBeInTheDocument();
	});

	it('lists analytics among the out-of-the-box capabilities', () => {
		render(Page);

		// The bullet wraps the route in <code>, so match on the element's whole
		// text rather than a single text node.
		expect(
			screen.getByText((_content, element) => {
				if (element?.tagName !== 'LI') return false;
				return /first-party, cookie-free analytics at\s*\/admin\/stats/i.test(
					element.textContent ?? ''
				);
			})
		).toBeInTheDocument();
	});

	it('documents migration workflow with immutable migration guidance', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /Database Migrations/i })).toBeInTheDocument();
		expect(screen.getByText(/never edit or delete existing migration files/i)).toBeInTheDocument();
		expect(screen.getAllByText(/db:migrate:local/i).length).toBeGreaterThan(0);
	});

	it('contains links to key project docs and repository', () => {
		render(Page);

		expect(screen.getByRole('link', { name: /README/i })).toHaveAttribute(
			'href',
			'https://github.com/starspacegroup/nebulakit-site/blob/main/README.md'
		);
		expect(screen.getByRole('link', { name: /Contributing Guide/i })).toHaveAttribute(
			'href',
			'https://github.com/starspacegroup/nebulakit-site/blob/main/CONTRIBUTING.md'
		);
		expect(screen.getByRole('link', { name: /GitHub repository/i })).toHaveAttribute(
			'href',
			'https://github.com/starspacegroup/nebulakit-site'
		);
	});

	it('renders a main landmark and section navigation', () => {
		render(Page);
		expect(document.querySelector('main')).toBeInTheDocument();
		expect(
			screen.getByRole('navigation', { name: /documentation navigation/i })
		).toBeInTheDocument();
	});

	// AGENTS.md §8 — the agent-discovery surfaces are user-visible features, so
	// /documentation has to describe them and keep describing them.
	describe('agent readiness section', () => {
		it('documents the section and links every published discovery surface', () => {
			render(Page);

			expect(screen.getByRole('heading', { name: /Agent Readiness/i })).toBeInTheDocument();

			const surfaces: Array<[RegExp, string]> = [
				[/\/robots\.txt/, '/robots.txt'],
				[/\/sitemap\.xml/, '/sitemap.xml'],
				[/api-catalog/, '/.well-known/api-catalog'],
				[/agent-skills/, '/.well-known/agent-skills/index.json'],
				[/auth\.md/, '/auth.md'],
				[/api\/health/, '/api/health']
			];

			for (const [name, href] of surfaces) {
				expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
			}
		});

		it('explains markdown negotiation', () => {
			render(Page);
			expect(
				screen.getByRole('heading', { name: /Reading pages as Markdown/i })
			).toBeInTheDocument();
			expect(screen.getAllByText(/Accept: text\/markdown/i).length).toBeGreaterThan(0);
			expect(screen.getAllByText(/x-markdown-tokens/i).length).toBeGreaterThan(0);
		});

		it('explains the WebMCP tools and their limits', () => {
			render(Page);
			expect(screen.getByRole('heading', { name: /In-browser tools/i })).toBeInTheDocument();
			expect(screen.getByText(/read-and-navigate only/i)).toBeInTheDocument();
		});

		it('warns that the shipped content policy allows AI training', () => {
			// A downstream site with proprietary content must be told to change this
			// before launch; burying it would be a defect.
			render(Page);
			expect(screen.getByRole('heading', { name: /Content usage policy/i })).toBeInTheDocument();
			expect(screen.getAllByText(/ai-train=yes/i).length).toBeGreaterThan(0);
			expect(screen.getAllByText(/CONTENT_SIGNAL/i).length).toBeGreaterThan(0);
		});

		it('flags DNS-AID as the step that must be done by hand', () => {
			render(Page);
			expect(screen.getByText(/DNS-based discovery \(DNS-AID\)/i)).toBeInTheDocument();
		});

		it('is reachable from the section navigation', () => {
			render(Page);
			const nav = screen.getByRole('navigation', { name: /documentation navigation/i });
			expect(within(nav).getByRole('link', { name: /Agent Readiness/i })).toHaveAttribute(
				'href',
				'#agent-readiness'
			);
		});
	});

	describe('Modules section', () => {
		it('documents the import, every group, and the live gallery', () => {
			render(Page);
			const section = screen
				.getByRole('heading', { name: /^modules$/i })
				.closest('section') as HTMLElement;
			expect(section.id).toBe('modules');
			expect(section.textContent).toMatch(/\$lib\/modules/);
			expect(section.querySelector('a[href="/modules"]')).toBeTruthy();
			for (const group of [
				'Account',
				'Settings',
				'Marketing',
				'App shell',
				'Data & teams',
				'Commerce'
			]) {
				expect(section.textContent).toContain(group);
			}
		});
	});

	describe('UI kit section', () => {
		it('documents the import, the toaster, and the live catalog', () => {
			render(Page);
			const section = screen
				.getByRole('heading', { name: /^ui kit$/i })
				.closest('section') as HTMLElement;
			expect(section.id).toBe('ui-kit');
			expect(section.textContent).toMatch(/\$lib\/ui/);
			expect(section.textContent).toMatch(/<Toaster \/>/);
			expect(section.querySelector('a[href="/components"]')).toBeTruthy();
		});

		it('lists every group of the kit, including the larger components', () => {
			render(Page);
			const section = screen
				.getByRole('heading', { name: /^ui kit$/i })
				.closest('section') as HTMLElement;
			for (const name of [
				'Command',
				'Combobox',
				'DatePicker',
				'Sheet',
				'Sidebar',
				'Resizable',
				'DataTable',
				'LineChart'
			]) {
				expect(section.textContent).toContain(name);
			}
			expect(section.textContent).toMatch(/Layout/);
			expect(section.textContent).toMatch(/MIT-licensed/);
		});

		it('is in the nav, and the board section names the standard widgets', () => {
			render(Page);
			const nav = screen.getByRole('navigation', { name: /documentation navigation/i });
			expect(nav.querySelector('a[href="#ui-kit"]')).toBeTruthy();
			const board = document.getElementById('drag-and-drop') as HTMLElement;
			expect(board.textContent).toMatch(/clock.*checklist.*meter/is);
		});
	});

	it('documents how stored secrets are encrypted and how to rotate the key', () => {
		render(Page);

		expect(screen.getByRole('heading', { name: /Secrets at Rest/i })).toBeInTheDocument();
		expect(screen.getAllByText(/ENCRYPTION_KEY_PREVIOUS/).length).toBeGreaterThan(0);
		expect(screen.getByText(/generate:encryption-key/)).toBeInTheDocument();
	});

	it('documents the security hardening and the migration check', () => {
		render(Page);

		expect(screen.getByRole('heading', { name: /Security Hardening/i })).toBeInTheDocument();
		expect(screen.getByText(/check:migrations/)).toBeInTheDocument();
	});

	// AGENTS.md §7 — the role ladder and per-area permissions are an admin
	// change, so the page has to say how they work and what upgrading does.
	it('documents the role ladder and per-area permissions', () => {
		render(Page);

		const section = screen
			.getByRole('heading', { name: /Roles and Permissions/i })
			.closest('section');
		expect(section).toBeTruthy();
		const scoped = within(section as HTMLElement);

		expect(scoped.getByText(/strictly below you/i)).toBeInTheDocument();
		expect(scoped.getAllByText(/GITHUB_OWNER_ID/).length).toBeGreaterThan(0);
		expect(scoped.getAllByText('users-manage').length).toBeGreaterThan(0);
		expect(scoped.getAllByText('0015').length).toBeGreaterThan(0);
		expect(scoped.getAllByText(/requirePermission/).length).toBeGreaterThan(0);
	});

	it('documents the audit log, its privacy limits and its retention job', () => {
		render(Page);
		const section = screen.getByRole('heading', { name: /^Audit Log$/ }).closest('section');
		expect(section).toBeTruthy();
		const text = section?.textContent ?? '';
		expect(text).toMatch(/never a secret value/i);
		expect(text).toMatch(/never page views/i);
		expect(text).toMatch(/prune-audit/);
		expect(text).toMatch(/365 days/);
	});

	it('documents sign-in tracking as opt-in with its privacy limits', () => {
		render(Page);
		const section = screen.getByRole('heading', { name: /^Sign-in Tracking$/ }).closest('section');
		expect(section).toBeTruthy();
		const text = section?.textContent ?? '';
		expect(text).toMatch(/off by default/i);
		expect(text).toMatch(/IP address/);
		expect(text).toMatch(/never the raw browser string/i);
		expect(text).toMatch(/90 days/);
		expect(text).toMatch(/never\s+block a sign-in/i);
	});

	// AGENTS.md section 7: /admin/redirects, /admin/lighthouse, security.txt and the
	// canonical host are user-visible routes and bindings an operator sets.
	describe('SEO, redirects and Lighthouse', () => {
		const section = () =>
			screen
				.getByRole('heading', { name: /SEO, Redirects and Lighthouse/i, level: 2 })
				.closest('section') as HTMLElement;

		it('documents the redirect manager', () => {
			render(Page);
			const scoped = within(section());
			for (const text of ['/admin/redirects', '0017_redirects.sql', 'REDIRECT_ALLOWED_HOSTS']) {
				expect(scoped.getAllByText(text).length).toBeGreaterThan(0);
			}
			expect(scoped.getByText(/Loops and off-site targets are refused/i)).toBeInTheDocument();
		});

		it('documents the canonical host and noindex rule', () => {
			render(Page);
			const scoped = within(section());
			expect(scoped.getByRole('heading', { name: 'Canonical host' })).toBeInTheDocument();
			expect(scoped.getAllByText('site.url').length).toBeGreaterThan(0);
			expect(scoped.getByText(/X-Robots-Tag: noindex/)).toBeInTheDocument();
		});

		it('documents security.txt and that it is off until configured', () => {
			render(Page);
			const scoped = within(section());
			expect(scoped.getAllByText('/.well-known/security.txt').length).toBeGreaterThan(0);
			expect(scoped.getAllByText('SECURITY_CONTACT').length).toBeGreaterThan(0);
			expect(scoped.getByText(/path answers 404/)).toBeInTheDocument();
		});

		it('documents structured data and both Lighthouse paths', () => {
			render(Page);
			const scoped = within(section());
			expect(scoped.getByRole('heading', { name: 'Structured data' })).toBeInTheDocument();
			expect(scoped.getAllByText('/admin/lighthouse').length).toBeGreaterThan(0);
			expect(scoped.getAllByText('0018_lighthouse_audits.sql').length).toBeGreaterThan(0);
			expect(scoped.getAllByText('bun run lighthouse').length).toBeGreaterThan(0);
			expect(scoped.getAllByText('PAGESPEED_API_KEY').length).toBeGreaterThan(0);
		});

		it('is in the nav', () => {
			render(Page);
			const nav = screen.getByRole('navigation', { name: /documentation navigation/i });
			expect(nav.querySelector('a[href="#seo-and-hosts"]')).toBeTruthy();
		});
	});

	// AGENTS.md: /admin/scheduled-jobs, the cron Worker and CRON_SECRET are a
	// user-visible admin route and a deployment step, so the documentation has to say so.
	it('documents the cron Worker and the scheduled jobs admin page', () => {
		render(Page);
		const scoped = within(
			screen
				.getByRole('heading', { name: /Scheduled Jobs/i, level: 2 })
				.closest('section') as HTMLElement
		);

		expect(scoped.getAllByText(/cron-worker\//).length).toBeGreaterThan(0);
		expect(scoped.getByText('/admin/scheduled-jobs')).toBeInTheDocument();
		expect(scoped.getByText(/wrangler secret put CRON_SECRET/)).toBeInTheDocument();
		expect(scoped.getByText('0019_scheduled_job_runs.sql')).toBeInTheDocument();
	});

	// AGENTS.md — /admin/pages, /admin/api-keys, /p/[slug] and /api/v1 are
	// user-visible routes, and ORCHESTRATOR_KEY_SHA256 is a binding an operator sets.
	it('documents the page builder, API keys and the site API', () => {
		render(Page);
		const scoped = within(
			screen
				.getByRole('heading', { name: /Pages and the Site API/i })
				.closest('section') as HTMLElement
		);
		for (const text of [
			'/admin/pages',
			'/admin/api-keys',
			'/p/[slug]',
			'/api/v1/openapi.json',
			'ORCHESTRATOR_KEY_SHA256'
		]) {
			expect(scoped.getAllByText(text).length).toBeGreaterThan(0);
		}
		expect(scoped.getByText(/Security updates are forced to every site/i)).toBeInTheDocument();
	});

	// AGENTS.md §7 — /shop, /cart, /admin/settings/pricing, the Stripe webhook,
	// order status and the email settings are user-visible routes and bindings.
	it('documents the shop, payments, order status and email', () => {
		render(Page);
		const scoped = within(
			screen
				.getByRole('heading', { name: /Shop, Payments and Email/i })
				.closest('section') as HTMLElement
		);
		for (const text of [
			'/shop',
			'/cart',
			'COMMERCE_TAX_RATE_PERCENT',
			'STRIPE_WEBHOOK_SECRET',
			'GET /api/v1/orders/[id]/status',
			'RESEND_API_KEY',
			'checkout.session.async_payment_failed'
		]) {
			expect(scoped.getAllByText(text).length).toBeGreaterThan(0);
		}
	});

	it('documents regional pricing', () => {
		render(Page);
		const scoped = within(
			screen
				.getByRole('heading', { name: /Shop, Payments and Email/i })
				.closest('section') as HTMLElement
		);
		for (const text of [
			'/admin/settings/pricing',
			'POST /api/v1/checkout/quote',
			'GET/PUT /api/v1/pricing',
			'pricing:read',
			'pricing:write',
			'bun run update:price-index'
		]) {
			expect(scoped.getAllByText(text).length).toBeGreaterThan(0);
		}
		expect(scoped.getByText(/it only ever lowers a price/i)).toBeInTheDocument();
		expect(scoped.getByText(/least generous country/i)).toBeInTheDocument();
	});
});
