# Vaultly — gift card price comparison

Compares live gift card discounts across seller marketplaces and puts the four terms that
actually decide a purchase right next to the price.

## Running it

```bash
npm install
npm run scrape     # fetch live prices -> public/catalog.json
npm run dev
```

Then open http://localhost:5173.

```bash
npm run build     # production build into dist/
npm run preview   # serve the built output
```

> **Note on `.claude/launch.json`:** `runtimeExecutable` points at the absolute path of `node.exe`
> because Node was installed mid-session and the shell's `PATH` was stale. You can simplify it to
> `"runtimeExecutable": "npm"` / `"runtimeArgs": ["run", "dev"]` any time.

## Stack

React 19 · TypeScript · Vite 7 · Tailwind CSS v4 · Framer Motion · React Router 7
Scraper: plain Node (no dependencies — `fetch` and regex only).

## Where the data comes from

There is **no hand-authored catalog**. `npm run scrape` reads the sellers' own pages and writes
`public/catalog.json`, which the app fetches once before its first render.

| Seller | How it's read | Status |
| --- | --- | --- |
| **GyFTR** | `__NEXT_DATA__` Redux blob on each brand page — discount, every denomination, the real T&C text, and per-payment-method rates. Brand list from `sitemap.xml`. | Full support |
| **Woohoo** | schema.org `Product` / `AggregateOffer` JSON-LD, discount from the page title, terms from the T&C section. Brand list from `sitemap.xml`. | Full support |
| **Amazon.in** | Driven through a real browser via Playwright — plain HTTP gets a bot check. Discount comes from the listing title ("Flat 8%"), denominations from the amount twister. | Full support |
| Paytm | App-only, and **not supported**. `paytm.com/gift-cards` redirects to the homepage and `catalog.paytm.com/v1/g/gift-cards` reports `totalCount: 1` — a placeholder named "Test". Getting it from the app would mean intercepting their private API and defeating certificate pinning, which this project does not do. | Not possible |

### Source gotchas worth knowing

- **Woohoo's page `<title>` is not a usable discount source.** Their SEO copy goes stale — the
  Amazon Pay card's title claims "Flat 50% Off" while the product actually gives 0.5%. The
  discount is read from `appReducer.product.offerShortDesc` in `window.__INITIAL_STATE`.
- **Open-value cards** are `price.type === "RANGE"` on Woohoo (Cinepolis: any amount ₹100–₹5,000).
  These become `offer.customAmount` and render as a validated amount field, not fake min/max slabs.
- **Amazon lists one brand under many ASINs** with *different* denomination sets. They're merged,
  unioning denominations — Lenskart alone spans 3 listings.
- **Amazon denominations must be matched on the ₹ sign.** A bare-number selector picks up the
  artwork twister instead and silently reports 3 denominations where there are 9.
- **Category rules are `\b`-anchored.** Without word boundaries "blockbuster" matched `bus` and
  filed Zee5 under Travel.
- **Subscription plans are folded into the parent brand.** Woohoo lists Zee5 as nine products
  ("Zee5 Tamil 12M", "Zee5 12M 4K"); they appear as labelled packs in one Zee5 section, matching
  how GyFTR models it. The suffix must *start* with a plan token, otherwise "Amazon Fresh" and
  "Ajio Luxe" would wrongly collapse into their parents.

The scraper is polite: bounded concurrency, a gap between requests, and backoff on 429/5xx.

### Amazon specifics

Two things were needed to get past Amazon's bot detection, and both matter:

1. **Do not spoof the user agent.** A UA claiming Chrome 131 on a browser that is actually Chrome
   149 is a fingerprint mismatch — Amazon responds by starting a bogus file download instead of
   rendering the page.
2. **Visit the homepage first.** Jumping straight to a search URL with no session cookies fails;
   the adapter warms up on `amazon.in` once per browser context.

It launches your **installed Chrome** (falling back to Edge, then Playwright's bundled build).
Playwright's own Chromium download doesn't run on this machine — it needs a Visual C++ runtime
that isn't installed — so the installed-browser path is the working one. Amazon runs at a lower
concurrency than the others because it's a real browser, and it may still occasionally serve a
CAPTCHA, in which case that brand is skipped rather than failing the run.

## Picking up newly-listed gift cards

**On page load**, the site asks `GET /api/discover` whether the sellers have listed anything since
the last scrape. This is cheap — discovery costs one sitemap fetch per seller, and only genuinely
new product pages are then fetched. New cards are added to the catalog and a banner names them.

Guard rails, in `server/discover.mjs`:

- Rate-limited to one real check every 10 minutes, so repeated page views don't re-walk sitemaps.
- Caps each check at 25 new brands, so one visit can't take minutes.
- **Amazon is excluded** — it needs a real browser and is rate-limit prone, which is the opposite of
  what a page-load check should be. The daily scrape covers it.
- A brand-new *plan* of an existing brand (say a new Zee5 pack) won't fold into that brand here,
  because folding needs to see all its siblings. The full scrape handles it.
- Needs a running dev/preview server. On a statically-hosted build the call fails silently and the
  site just shows the last scraped catalog.

Brand discovery is sitemap-driven rather than a fixed list, so the full scrape picks up new cards
too. Nothing to configure per brand.

To keep that happening without you remembering, register the bundled script as a daily task (run
once, from the project folder):

```bash
schtasks /create /tn "Vaultly gift card refresh" /tr "\"%CD%\scripts\refresh.cmd\"" /sc daily /st 06:00
```

It logs to `%TEMP%\vaultly-refresh.log`, and the per-seller collapse guard means a blocked run
leaves your existing catalog intact. Remove it with
`schtasks /delete /tn "Vaultly gift card refresh" /f`.

So freshness comes from three places:

| | Covers | Trigger |
| --- | --- | --- |
| Discovery on page load | Newly-listed cards on GyFTR + Woohoo | Automatic, every visit |
| Daily scheduled scrape | New brands + all prices, all sellers | Automatic |
| "Re-check prices now" | One brand, every seller, every source page | Button on the brand page |
| `npm run scrape:fast` | Everything except Amazon | Manual, ~2 min |

## Live re-check

The brand page has a **"Re-check prices now"** button that re-reads that one brand from every
seller that stocks it and writes the result back to `catalog.json` — roughly 0.7 s for the HTTP
sellers, ~3 s when Amazon is involved.

It's served by `server/refresh.mjs`, mounted as Vite middleware at `GET /api/refresh/:brandId`, so
there is no second process to start — it works under both `npm run dev` and `npm run preview`.
Refreshes are serialised per brand, and a seller that errors keeps its previous price rather than
blanking out.

**A re-check must revisit every source page.** An offer is often the merge of several product pages
— Woohoo lists Zee5 as nine subscription packs, Amazon lists Lenskart under three ASINs — so each
offer records `sources: [{url, label}]` and the refresh re-fetches all of them and re-merges.
Fetching only `productUrl` replaced all nine Zee5 packs with whichever single one it fetched.

Note this endpoint only exists while a Vite server is running. A statically-hosted `dist/` still
works fine — the button will just report the failure instead of silently showing stale data.

### Scraper usage

```bash
node scripts/scrape.mjs                          # everything (~6 min with Amazon)
node scripts/scrape.mjs --only gyftr,woohoo      # skip the slow browser-driven source
node scripts/scrape.mjs --limit 40               # first 40 brands per seller
node scripts/scrape.mjs --only gyftr
node scripts/scrape.mjs --brands dominos,healthkart
node scripts/scrape.mjs --concurrency 8
```

It refuses to overwrite a healthy `catalog.json` with a much smaller result (a half-failed run
can't wipe your data); pass `--force` to override.

### The honesty rule

The scraper never invents a value. `scripts/lib/facts.mjs` derives the four key facts with
regex rules over the seller's own terms text, and **every fact keeps the sentence it came from** —
rendered as a quote under the answer on the brand page. Anything the seller doesn't state comes
back as `status: "unknown"` → "Not stated", never a plausible-looking guess.

Rules also carry `reject` patterns to kill false positives. Example: "If any balance remains,
select Pay in Cash" is about settling the rest of the *bill*, not the voucher's leftover value, so
it's explicitly excluded from the partial-use rule.

Coverage is honest rather than flattering — Gyftr states stacking and clubbing on nearly every
brand, but rarely publishes validity, so many validity chips read "Not stated".

### Layout

| File | What lives there |
| --- | --- |
| `scripts/scrape.mjs` | CLI orchestrator — runs the sources, writes the catalog |
| `scripts/lib/build.mjs` | Classification, folding and merging; shared by the scrape and discovery |
| `scripts/sources/*.mjs` | One adapter per seller; add a file here to add a seller |
| `server/discover.mjs` | Finds cards listed since the last scrape (page-load check) |
| `server/refresh.mjs` | Re-reads one brand from every seller (the re-check button) |
| `scripts/lib/facts.mjs` | The four-key-fact derivation rules |
| `scripts/lib/http.mjs` | Polite fetch, retries, concurrency pool |
| `src/services/catalog.ts` | The only module components read data from |
| `src/types.ts` | Domain model + the fixed order/labels of the four key facts |

### Adding a seller

Create `scripts/sources/<name>.mjs` exporting `PLATFORM`, `listBrandUrls()` and
`fetchBrand({slug, url})` returning `{ key, name, logo, offer }`, then register it in the
`SOURCES` map in `scrape.mjs`. Brands merge across sellers on `brandKey(name)`, which strips
apostrophes and gift-card boilerplate so "DOMINO'S" and "Domino's E-Gift Voucher" collapse
together.
