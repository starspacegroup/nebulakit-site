# Auctions

Sell one unit of a product to the highest bidder. Auctions are part of
`@nebulakit/commerce` (0.3.0). A won auction becomes an ordinary order, so
payment, fulfilment and the orders API work as they do for any other sale.

## Where things are

| What                             | Where                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------ |
| The bidding rules (pure, no I/O) | `packages/commerce/src/auction.ts`                                             |
| Storage, bids, closing, orders   | `packages/commerce/src/auction-store.ts`                                       |
| Tables                           | `commerce_auctions`, `commerce_auction_bids` (migration `0026`)                |
| Public pages                     | `/auctions`, `/auctions/[slug]`                                                |
| Admin                            | `/admin/auctions` (the `shop` permission)                                      |
| The sweep that closes and bills  | `settle-auctions` job, every 5 minutes (`docs/SCHEDULED_JOBS.md`)              |
| Tests                            | `commerce-auction`, `commerce-auction-store`, `auctions-routes` (`tests/unit`) |

## How an auction works

An auction is created from a product in `/admin/auctions`. It copies the
product's name and currency, so editing the product later does not change an
auction in progress. Archive the product in `/admin/products` if it should not
also be bought at a fixed price: the shop only lists active products.

Setup options:

- **Starting price.** The first bid starts here.
- **Reserve** (optional, hidden). Below it the item does not sell. Bidders see
  only whether it has been met, never the amount.
- **Buy it now** (optional). On offer until the first bid, or, with a reserve,
  until the reserve is met.
- **Bid increment** (optional). Blank uses a tiered default: 50 cents under
  $100, then $1, $5, $25 and $100 as the price grows.
- **Extend by** seconds (optional). A bid inside the last N seconds moves the end
  to N seconds from the bid, so nobody wins by bidding in the last moment. At most
  50 extensions per auction.
- **Start and end**, in UTC. An auction runs for 60 days at most.

### Proxy bidding

A bidder enters the most they will pay. The auction shows only the price needed
to stay in front, and raises it for them, one increment above the runner-up, up
to their maximum.

- The first bid sits at the starting price.
- A higher maximum takes the lead. The price becomes one increment over the old
  leader's maximum, never above the new maximum.
- A lower maximum leaves the leader in front; the price rises to one increment
  over that bid, never above the leader's maximum.
- An equal maximum loses: the earlier bid wins a tie.
- A leader may raise their own maximum (the price does not move) but not lower it.
- When the leader's maximum reaches the reserve, the price rises to the reserve.
- The winner pays the price on the board, never their maximum.

### Closing and paying

An auction ends at its end time (after any extensions). It sells if someone bid
and the reserve was met; otherwise it ends unsold. Admins can **End now** or
**Cancel** an open auction from the admin page.

The `settle-auctions` job closes ended auctions and creates one pending order
for each winner at the winning price, with the site's tax and flat shipping from
`COMMERCE_TAX_RATE_PERCENT` and `COMMERCE_FLAT_SHIPPING_CENTS`. The winner also
gets the order the moment they open the auction page, so they never wait for
the sweep. On the auction page the winner pays: with `STRIPE_SECRET_KEY` set they
go to Stripe Checkout (and the existing webhook marks the order paid); without
it the order waits for manual payment. A physical product asks for a shipping
address first.

An auction closes once and has one order. The sweep is safe to retry, and it
also repairs a sold auction whose order was never created.

## Who can bid

Bidders must be signed in. The public page shows an alias ("Bidder 7F3A"), the
price and the bid count. Emails, maximums and the reserve are visible only in
`/admin/auctions`.

## Concurrency

Every bid and every closing is a compare-and-set on the auction's `version`. The
rules run against the auction as read, and the write lands only if it is still
that auction. A lost race re-reads and re-runs the rules, so two bids at the
same moment are ordered and never both applied. The bid row is written in the
same batch, only when the auction update changed a row.

## Not included

- **Notification emails** (outbid, won). The email log exists; wiring a template
  is the next step.
- **Payment deadline and relisting.** An unpaid winner's order stays pending
  until an admin cancels it; relist by creating a new auction.
- **A public API.** Auctions have pages, not `/api/v1` routes, so no API scope.
- **Quantity above one.** One auction sells one unit.
