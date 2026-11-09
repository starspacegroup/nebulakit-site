/**
 * Auction rules, in integer cents, with no database and no clock of their own.
 *
 * Every function here is pure: the caller passes the auction as it is and the
 * time it is, and gets back what should happen. That keeps the rules that move
 * money in one small file that a property test can hammer, and keeps the
 * storage code (auction-store.ts) free of arithmetic.
 *
 * Proxy bidding: a bidder states the most they will pay (`maxCents`). The
 * board shows only the price needed to stay in front, and the auction raises
 * it for them, one increment above the runner-up, up to their maximum.
 */
import { isCents } from './money';

export const AUCTION_STATUSES = ['open', 'sold', 'unsold', 'cancelled'] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

/** Whether the clock says an open auction has started, is running, or is over. */
export type AuctionPhase = 'scheduled' | 'live' | 'ended' | AuctionStatus;

/** The largest amount an auction accepts: matches the admin's seven-digit dollars field. */
export const MAX_AUCTION_CENTS = 99_999_999;
/** Soft-close extensions allowed per auction, so a bidding war cannot run forever. */
export const MAX_EXTENSIONS = 50;
export const MAX_EXTEND_SECONDS = 3600;

/** The state of an auction that the rules need. */
export interface AuctionState {
	status: AuctionStatus;
	startingCents: number;
	reserveCents: number | null;
	buyNowCents: number | null;
	/** Fixed minimum raise; null uses `defaultIncrement`. */
	incrementCents: number | null;
	startsAt: number;
	endsAt: number;
	extendSeconds: number;
	extensions: number;
	/** The price to beat. Null until the first bid. */
	currentCents: number | null;
	leaderId: string | null;
	leaderMaxCents: number | null;
	bidCount: number;
}

/**
 * The minimum raise at a given price, when the auction sets none: bigger
 * prices move in bigger steps so a bidding war does not crawl a cent at a time.
 */
export function defaultIncrement(priceCents: number): number {
	if (priceCents < 100_00) return 50; // under $100: 50¢
	if (priceCents < 500_00) return 100; // under $500: $1
	if (priceCents < 1_000_00) return 500; // under $1,000: $5
	if (priceCents < 5_000_00) return 2_500; // under $5,000: $25
	return 10_000; // $100
}

export function incrementAt(auction: Pick<AuctionState, 'incrementCents'>, price: number): number {
	return auction.incrementCents ?? defaultIncrement(price);
}

export function phaseOf(auction: AuctionState, now: number): AuctionPhase {
	if (auction.status !== 'open') return auction.status;
	if (now < auction.startsAt) return 'scheduled';
	if (now >= auction.endsAt) return 'ended';
	return 'live';
}

export function reserveMet(auction: AuctionState): boolean {
	if (auction.currentCents === null) return false;
	return auction.reserveCents === null || auction.currentCents >= auction.reserveCents;
}

/** The smallest max bid a new bidder may place right now. */
export function minimumBidCents(auction: AuctionState): number {
	if (auction.currentCents === null) return auction.startingCents;
	return auction.currentCents + incrementAt(auction, auction.currentCents);
}

/**
 * Buy-it-now is on offer until a bid ends the sale of it: with no reserve, the
 * first bid removes it; with a reserve, it stays until the reserve is met.
 */
export function buyNowAvailable(auction: AuctionState, now: number): boolean {
	if (auction.buyNowCents === null) return false;
	if (phaseOf(auction, now) !== 'live') return false;
	return auction.bidCount === 0 || (auction.reserveCents !== null && !reserveMet(auction));
}

/** What an auction's setup form may ask for, checked before anything is stored. */
export interface AuctionTerms {
	startingCents: number;
	reserveCents: number | null;
	buyNowCents: number | null;
	incrementCents: number | null;
	startsAt: number;
	endsAt: number;
	extendSeconds: number;
}

const MAX_RUN_MS = 60 * 24 * 3600 * 1000; // 60 days

export function validateAuctionTerms(terms: AuctionTerms): string[] {
	const errors: string[] = [];
	const money = (value: number | null, label: string) => {
		if (value !== null && (!isCents(value) || value > MAX_AUCTION_CENTS)) {
			errors.push(`${label} is too large or not a valid amount.`);
			return false;
		}
		return true;
	};
	money(terms.startingCents, 'Starting price');
	const reserveOk = money(terms.reserveCents, 'Reserve price');
	const buyNowOk = money(terms.buyNowCents, 'Buy-now price');
	if (
		terms.incrementCents !== null &&
		(!Number.isSafeInteger(terms.incrementCents) ||
			terms.incrementCents < 1 ||
			terms.incrementCents > MAX_AUCTION_CENTS)
	) {
		errors.push('Bid increment must be at least one cent.');
	}
	if (reserveOk && terms.reserveCents !== null && terms.reserveCents < terms.startingCents) {
		errors.push('The reserve cannot be below the starting price.');
	}
	if (buyNowOk && terms.buyNowCents !== null) {
		if (terms.buyNowCents <= terms.startingCents) {
			errors.push('The buy-now price must be above the starting price.');
		}
		if (terms.reserveCents !== null && terms.buyNowCents < terms.reserveCents) {
			errors.push('The buy-now price cannot be below the reserve.');
		}
	}
	if (!Number.isFinite(terms.startsAt) || !Number.isFinite(terms.endsAt)) {
		errors.push('Start and end times must be valid dates.');
	} else {
		if (terms.endsAt <= terms.startsAt) errors.push('The auction must end after it starts.');
		else if (terms.endsAt - terms.startsAt > MAX_RUN_MS) {
			errors.push('An auction can run for 60 days at most.');
		}
	}
	if (
		!Number.isInteger(terms.extendSeconds) ||
		terms.extendSeconds < 0 ||
		terms.extendSeconds > MAX_EXTEND_SECONDS
	) {
		errors.push(`Extension must be 0 to ${MAX_EXTEND_SECONDS} seconds.`);
	}
	return errors;
}

export type BidRefusal =
	'not-open' | 'not-started' | 'ended' | 'invalid-amount' | 'too-low' | 'already-leading';

export const BID_REFUSALS: Record<BidRefusal, string> = {
	'not-open': 'This auction is closed.',
	'not-started': 'This auction has not started yet.',
	ended: 'This auction has ended.',
	'invalid-amount': 'Enter your bid in dollars and cents.',
	'too-low': 'Your bid is below the minimum.',
	'already-leading': 'You already lead with a higher maximum. Raise it above your current maximum.'
};

/** What a bid did to the auction. `next` is the whole new state; the caller writes it. */
export interface BidOutcome {
	ok: true;
	next: AuctionState;
	/** Did this bidder hold the lead after the bid? */
	leading: boolean;
	/** The price left on the board by this bid. */
	priceAfterCents: number;
	/** The bidder who was in front before and no longer is. */
	outbidId: string | null;
	/** The end moved because the bid came in the closing window. */
	extended: boolean;
	/** The minimum bid now, for a "try again" message. */
	minimumNextCents: number;
}
export interface BidRefused {
	ok: false;
	reason: BidRefusal;
	minimumCents?: number;
}

/**
 * Apply one bid. Never mutates `auction`.
 *
 *  - The first bid takes the lead at the starting price.
 *  - A higher max takes the lead; the price becomes one increment above the old
 *    leader's max, but never above the new max.
 *  - A lower max leaves the leader in front; the price rises to one increment
 *    above the new max, but never above the leader's max.
 *  - An equal max loses: the earlier bid wins a tie, at that amount.
 *  - If the leader's max reaches the reserve, the price rises to the reserve.
 *  - A bid inside the closing window pushes the end out (soft close).
 */
export function placeBid(
	auction: AuctionState,
	bid: { bidderId: string; maxCents: number },
	now: number
): BidOutcome | BidRefused {
	const phase = phaseOf(auction, now);
	if (phase === 'scheduled') return { ok: false, reason: 'not-started' };
	if (phase === 'ended') return { ok: false, reason: 'ended' };
	if (phase !== 'live') return { ok: false, reason: 'not-open' };

	const max = bid.maxCents;
	if (!isCents(max) || max > MAX_AUCTION_CENTS) return { ok: false, reason: 'invalid-amount' };

	const isLeader = auction.leaderId !== null && auction.leaderId === bid.bidderId;
	if (isLeader) {
		// Raising your own ceiling never moves the price; lowering it is not allowed.
		if (max <= (auction.leaderMaxCents as number)) return { ok: false, reason: 'already-leading' };
	} else {
		const minimum = minimumBidCents(auction);
		if (max < minimum) return { ok: false, reason: 'too-low', minimumCents: minimum };
	}

	let currentCents: number;
	let leaderId: string;
	let leaderMax: number;
	let outbidId: string | null = null;

	if (auction.leaderId === null || auction.leaderMaxCents === null) {
		currentCents = auction.startingCents;
		leaderId = bid.bidderId;
		leaderMax = max;
	} else if (isLeader) {
		currentCents = auction.currentCents as number;
		leaderId = auction.leaderId;
		leaderMax = max;
	} else if (max > auction.leaderMaxCents) {
		const step = incrementAt(auction, auction.leaderMaxCents);
		currentCents = Math.min(max, auction.leaderMaxCents + step);
		leaderId = bid.bidderId;
		leaderMax = max;
		outbidId = auction.leaderId;
	} else if (max === auction.leaderMaxCents) {
		currentCents = max;
		leaderId = auction.leaderId;
		leaderMax = auction.leaderMaxCents;
	} else {
		currentCents = Math.min(auction.leaderMaxCents, max + incrementAt(auction, max));
		leaderId = auction.leaderId;
		leaderMax = auction.leaderMaxCents;
	}

	// A leader whose ceiling clears the reserve lifts the price to it, never past it.
	if (
		auction.reserveCents !== null &&
		leaderMax >= auction.reserveCents &&
		currentCents < auction.reserveCents
	) {
		currentCents = auction.reserveCents;
	}

	let endsAt = auction.endsAt;
	let extensions = auction.extensions;
	let extended = false;
	if (
		auction.extendSeconds > 0 &&
		auction.extensions < MAX_EXTENSIONS &&
		auction.endsAt - now <= auction.extendSeconds * 1000
	) {
		const target = now + auction.extendSeconds * 1000;
		if (target > endsAt) {
			endsAt = target;
			extensions += 1;
			extended = true;
		}
	}

	const next: AuctionState = {
		...auction,
		currentCents,
		leaderId,
		leaderMaxCents: leaderMax,
		bidCount: auction.bidCount + 1,
		endsAt,
		extensions
	};
	return {
		ok: true,
		next,
		leading: leaderId === bid.bidderId,
		priceAfterCents: currentCents,
		outbidId,
		extended,
		minimumNextCents: minimumBidCents(next)
	};
}

export interface Settlement {
	status: 'sold' | 'unsold';
	winnerId: string | null;
	/** What the winner pays. Null when unsold. */
	finalCents: number | null;
}

/**
 * How an auction closes at its end time. It sells only when someone bid and the
 * reserve (if any) was met; otherwise it ends unsold. The winner pays the price
 * on the board, not their maximum.
 */
export function settleAuction(auction: AuctionState): Settlement {
	if (auction.leaderId !== null && auction.currentCents !== null && reserveMet(auction)) {
		return { status: 'sold', winnerId: auction.leaderId, finalCents: auction.currentCents };
	}
	return { status: 'unsold', winnerId: null, finalCents: null };
}

/** Buying it now closes the auction at the buy-now price, to the buyer. */
export function buyNow(
	auction: AuctionState,
	buyerId: string,
	now: number
): { ok: true; settlement: Settlement } | { ok: false; reason: 'unavailable' } {
	if (!buyNowAvailable(auction, now)) return { ok: false, reason: 'unavailable' };
	return {
		ok: true,
		settlement: { status: 'sold', winnerId: buyerId, finalCents: auction.buyNowCents as number }
	};
}

/**
 * A short, stable public name for a bidder ("Bidder 7F3A"), so the bid history
 * can show who outbid whom without showing anyone's email.
 */
export function bidderAlias(bidderId: string): string {
	let hash = 2166136261;
	for (let i = 0; i < bidderId.length; i++) {
		hash ^= bidderId.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return `Bidder ${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4)}`;
}
