<div align="center">

<img src="docs/vaultly-logo.png" alt="Vaultly — unlock more value" width="420">

### Never overpay for a gift card again.

One search compares every marketplace selling the card you want — and shows the four terms
that decide whether the discount is actually worth it.

<p>
  <a href="https://vaultly-gules.vercel.app/"><img alt="Live site" src="https://img.shields.io/badge/live%20site-vaultly--gules.vercel.app-6d5efc?style=for-the-badge&logo=vercel&logoColor=white"></a>
</p>

<p>
  <a href="https://github.com/Satwik-2025/Vaultly---The-Gift-Card-Site/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Satwik-2025/Vaultly---The-Gift-Card-Site/ci.yml?branch=main&label=build&style=flat-square"></a>
  <a href="https://github.com/Satwik-2025/Vaultly---The-Gift-Card-Site/actions/workflows/refresh-prices.yml"><img alt="Daily price refresh" src="https://img.shields.io/github/actions/workflow/status/Satwik-2025/Vaultly---The-Gift-Card-Site/refresh-prices.yml?label=daily%20refresh&style=flat-square"></a>
  <img alt="Last commit" src="https://img.shields.io/github/last-commit/Satwik-2025/Vaultly---The-Gift-Card-Site?style=flat-square">
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-4ad6a8?style=flat-square"></a>
</p>

<p>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Vite 7" src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white">
  <img alt="Tailwind v4" src="https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white">
  <img alt="Data" src="https://img.shields.io/badge/data-100%25%20scraped-4ad6a8?style=flat-square">
</p>

<img src="docs/home.jpg" alt="Vaultly home page" width="100%">

</div>

---

## The problem

A 20% discount is worthless if the card expires in three months, can't be combined with a sale,
or forfeits whatever you don't spend. Marketplaces bury that in a wall of fine print — and they
all word it differently, so you can't compare them side by side.

Vaultly reads the sellers' own terms and puts the answers **in the same four rows for every
seller**, right next to the price.

<div align="center">
  <img src="docs/compare.jpg" alt="Three sellers compared side by side" width="100%">
  <em>Every seller that stocks the card, with its real payable price, the payment method you'd use, and its own freshness stamp.</em>
</div>

---

## What it does

| | |
| --- | --- |
| 🔍 **Compares every seller** | GyFTR, Woohoo and Amazon.in, merged per brand — about 600 brands and 800 live offers. |
| 📊 **Four facts, aligned** | Multiple cards per order · clubbing with offers · validity · leftover balance — same order, every column, via CSS subgrid. |
| 💸 **The price you'd really pay** | Pick a denomination *and how you'll pay*. Woohoo's Air India card is 0% on paper but **6% by UPI** with code `WOOHOO` — the price follows the method you choose. |
| 🎁 **"Get 8% extra" done right** | Some cards add value instead of cutting the price. Vaultly shows it as Woohoo does (pay ₹1,000, get ₹1,080) and the **≈ 7.4% off** it works out to, so it ranks fairly against a plain discount. |
| 🧾 **One-off promos, kept honest** | A "90% off" that's really *new customers, one ₹10 order, once* is shown with those conditions and never counted as the card's price. |
| 📖 **How to use** | Each seller's redemption steps, folded away under the price until you want them. |
| 📜 **Full terms, per seller** | A *Terms & conditions* button under every column of the comparison — the fine print without a second copy of the comparison. |
| 💰 **Cashback on top** | CashKaro's full rate table, whether it works on app or only web, and whether it stacks with a gift card at all. |
| 👤 **Accounts that follow you** | Sign in on any device and your saved cards come with you. |
| ♻️ **Self-correcting catalog** | Opening the site syncs which cards still exist; opening a brand re-reads its live prices (switch off in Settings). |
| 🎨 **Eight themes** | Dark and light, with a diagonal view-transition wipe. Built for phones first. |

---

## The four things nobody tells you

<div align="center">
  <img src="docs/key-facts.jpg" alt="The four key facts compared across sellers" width="100%">
</div>

Each answer keeps **the seller's own sentence it was derived from**. If a seller doesn't state
something, it reads *"Not stated"* — never a plausible-looking guess.

The reader is deliberately literal about the awkward cases:

- *"Up to 3 vouchers in one bill when the whole order is paid with vouchers. Up to 2 along with
  another payment method."* → **Up to 3 cards · 2 if you pay part another way.**
- *"To use multiple cards in a single transaction, add all of them to the Air India Wallet."* →
  **Multiple cards · via Air India Wallet**, with the extra step spelled out.
- *"Gift Voucher CANNOT be used multiple times."* → **Single use only** — not the opposite.
- *"Valid only for one year from the date of activation."* → **1 year from activation**, which a
  buyer controls, rather than from purchase.

<div align="center">
  <img src="docs/how-to-use.jpg" alt="Payment-method choice and the How to use steps open under each seller" width="100%">
  <em>Pay-with choices drive the price; each seller's redemption steps sit behind “How to use”.</em>
</div>

---

## Cashback, honestly

<div align="center">
  <img src="docs/cashback.jpg" alt="CashKaro cashback card with the full rate table" width="100%">
</div>

The headline rate always covers one slice of a catalogue, so it's shown as **"up to"** with every
published rate one tap away — Air India pays ₹275 on an international flight but ₹80 on a
domestic one. More importantly: **most brands paying cashback exclude gift-voucher payments**, so
there you pick one saving, not both. Vaultly says so, quoting the clause.

---

## Everywhere you use it

<div align="center">
  <img src="docs/mobile.jpg" alt="A brand page on a phone" width="300">
  &nbsp;&nbsp;
  <img src="docs/themes.jpg" alt="The eight colour themes" width="620">
</div>

---

## Accounts

Sign-up, sign-in and saved cards live on the server, so an account works on any device.

- **Passwords are hashed with scrypt** on the server and never stored as typed.
- **The browser only holds a session cookie** — `HttpOnly`, `SameSite=Lax`, `Secure` — which
  page scripts cannot read. The store keeps a hash of the session token, not the token.
- **Wrong guesses are rate-limited** — ten per email per fifteen minutes, with a wider allowance
  per network.
- **Saved cards sync as adds and removes**, not a whole list, so a phone and a laptop saving
  different cards at the same moment both win. Cards saved as a guest fold into the account on
  first sign-in.
- **No third-party sign-in.** Email and password only, by design.
- **It degrades gracefully.** With no database connected the site falls back to browser-only
  accounts; the first sign-in after a database is connected moves them to the server.

Storage is [Upstash Redis](https://upstash.com) in production and a JSON file under `.data/`
(git-ignored) on the dev server — both behind the same five operations in
`server/auth-store.mjs`.

---

## Quick start

```bash
npm install
npm run scrape     # fetch live prices -> public/catalog.json  (~6 min)
npm run dev        # http://localhost:5173
```

In a hurry? `npm run scrape:fast` skips the browser-driven Amazon source (~2 min).

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the built output
```

**Keeping prices fresh by hand**

```bash
npm run fill:cashkaro            # cashback for every brand        (~2 min)
npm run fill:amazon -- --refresh # re-read the brands Amazon already has, one by one
```

On Windows, double-click **`update-prices.bat`**: it pulls the latest catalog, refreshes every
seller, saves what changed and pushes it, which redeploys the site.

---

## Deploying

The site deploys to **Vercel** straight from this repository — no server to run.

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project**, import this repository, and press **Deploy**. Nothing to configure —
   `vercel.json` sets the build, the page routing and the API functions.

Every push to `main` redeploys.

**Accounts across devices** need one more click. In the Vercel project open **Storage → Create
Database → Upstash for Redis** (the free plan is plenty), set the environment-variable prefix to
`KV`, connect it to the project and redeploy. That adds `KV_REST_API_URL` and
`KV_REST_API_TOKEN`, which `api/auth/[action].mjs` picks up.

What runs where once deployed:

| Feature | Deployed site |
| --- | --- |
| Browsing, search, compare, themes | ✅ Static |
| Accounts and saved cards, on every device | ✅ `api/auth/[action].mjs` + Upstash Redis |
| **Re-check prices now** — GyFTR, Woohoo, CashKaro | ✅ Live, via `api/refresh/[brandId].mjs` (~1–2 s) |
| Re-check — Amazon | 🕒 Daily. Needs a real browser, too heavy for a function; the panel shows its age |
| New and delisted cards | 🕒 Daily, via the scheduled scrape |

**The daily refresh** is `.github/workflows/refresh-prices.yml`. At 06:00 IST it scrapes GyFTR and
Woohoo, tries Amazon, refreshes cashback, commits `catalog.json` and so triggers a redeploy. Run
it any time from **Actions → Refresh prices → Run workflow**. Amazon rate-limits GitHub's runners,
so a blocked Amazon run keeps the previous Amazon prices rather than wiping them — see
`update-prices.bat` for refreshing Amazon from your own machine.

A live re-check returns fresh prices to whoever pressed it but doesn't save them — serverless
filesystems are read-only. The shared catalog moves forward once a day.

---

## Where the data comes from

There is **no hand-authored catalog**. Everything is read from the sellers' own pages.

| Source | How it's read | Status |
| --- | --- | --- |
| **GyFTR** | `__NEXT_DATA__` for prices and denominations, plus the endpoint behind its *Instructions*, *How to redeem* and *T&C* tabs — the embedded copy of those can be stale and even contradict the live tab. | ✅ Full |
| **Woohoo** | `window.__INITIAL_STATE` → `appReducer.product`: discount from `offerShortDesc`, payment offers from `campaigns`, validity from `expiry`, steps from `cpg.howToUse`, full `tnc`. | ✅ Full |
| **Amazon.in** | Real browser via Playwright — plain HTTP gets a bot check. Redemption steps and validity are parsed out of the listing text. | ⚠️ Rate-limited |
| **CashKaro** | `__NEXT_DATA__` → full rate table, app/web eligibility, gift-voucher exclusions. | ✅ Full |
| Paytm | App-only. `paytm.com/gift-cards` redirects to the homepage and the old catalog API returns nothing. Reading it would mean defeating certificate pinning on their app, which this project does not do. | ❌ Not possible |

---

## How freshness works

Three layers, each doing only what it's cheap enough to do:

| Layer | Covers | Cost | Trigger |
| --- | --- | --- | --- |
| **Catalog sync** | Which cards *exist* — adds newly listed, removes delisted | One sitemap per seller | Opening the site |
| **Live re-check** | One brand's prices, across **every** seller + cashback | ~8 s, ~25 s with Amazon | Opening a brand page (optional), or the button |
| **Full scrape** | Everything | ~6 min | Manual or scheduled |

The sync deliberately **doesn't** check prices — re-reading 600 product pages on every page view
would be slow and pointless. And the re-check searches sellers that *aren't* currently listed, so a
card a seller has just started stocking shows up on its own.

Every panel stamps its own age. If one seller can't be reached, only that panel is marked stale —
the others still read *"checked just now"*.

<details>
<summary><b>Guard rails that stop a bad run destroying good data</b></summary>

<br>

- **Delisting needs proof.** A seller is only dropped when its page returns a hard 404/410. A live
  page with an empty product list is marked *sold out* instead — GyFTR leaves delisted pages up
  and serving HTTP 200, and deleting on that once wiped a brand that came back an hour later.
- **A broken sitemap removes nothing.** If more than 25% of a seller's listings vanish at once,
  that's treated as a broken sitemap, not a closed shop.
- **Blocked ≠ gone.** A CAPTCHA, timeout or network blip never counts as evidence of a delisting.
- **One writer at a time.** The sync and the re-check used to read `catalog.json`, spend 30 s on
  the network, then write their stale copy back — whichever finished last silently reverted the
  other. All writes now go through a lock in `server/catalog-store.mjs`.
- **The scrape won't shrink your catalog.** A half-failed run can't overwrite a healthy
  `catalog.json`; the guard is per seller, because healthy sellers hide one seller's collapse.
- **A stale label is not a discount.** Woohoo's discounts are coupons in its "Offers for you"
  strip, and a card's headline normally restates the best of them. When a promo ends but the label
  lingers (RuPay read "99% Discount" with nothing behind it), the card counts as face value.

</details>

<details>
<summary><b>Scraper gotchas worth knowing</b></summary>

<br>

- **Woohoo's page `<title>` is not a usable discount source.** Their SEO copy goes stale — the
  Amazon Pay card's title claims "Flat 50% Off" while the product gives 0.5%.
- **Gift-only listings can carry numbers the page never shows.** Woohoo's ₹100 Ajio gift voucher
  says "25% Discount" in its data; its page offers none. Such listings never outrank the brand's
  real card.
- **"Get X% Extra" is value, not a price cut** — 8% extra is 8/108 = 7.4% off, and ranking it as
  8% overstated Goibibo, Ajio and EaseMyTrip.
- **Open-value cards** are `price.type === "RANGE"` and become a validated amount field, not fake
  min/max slabs.
- **Amazon lists one brand under many ASINs** with different denomination sets; they're merged,
  unioning denominations.
- **Amazon denominations must match on the ₹ sign.** A bare-number selector reads the artwork
  twister and reports 3 denominations where there are 9.
- **Category rules are `\b`-anchored.** Without word boundaries "blockbuster" matched `bus` and
  filed Zee5 under Travel.
- **Subscription plans fold into the parent brand.** Woohoo lists Zee5 as nine products; they
  appear as labelled packs in one section. The suffix must *start* with a plan token, or "Amazon
  Fresh" would collapse into "Amazon".
- **Brand matching is deliberately strict.** An Amazon search for "The Body Shop" also returns
  Bath & Bodyworks and Health and Glow — a loose match would staple a rival's price to the wrong
  brand.
- **Terms are never truncated.** A cap of 16 points once hid Air India Ancillary's wallet rule,
  which was the 17th.

</details>

<details>
<summary><b>Working with Amazon's rate limits</b></summary>

<br>

Amazon is the hard one: plain HTTP gets a bot check, so it's read through a real browser.

1. **Don't spoof the user agent.** A UA claiming a different Chrome build than the real one is a
   fingerprint mismatch — Amazon responds with a bogus file download instead of the page.
2. **Browse like a shopper.** `npm run fill:amazon -- --refresh` searches each brand by name and
   opens the result, rather than requesting product pages cold.
3. **Go slowly.** One page at a time with a 2.5–9 s pause between them, oldest prices first.
4. **Optionally, change where it comes from.** Set `AMAZON_PROXY=http://user:pass@host:port` in
   `.env` (see `.env.example`), or as a repository secret of the same name for the daily job,
   and the browser routes through it. Nothing else changes: same pace, same stop-on-block.
5. **Stop at the first block.** The moment Amazon shows a CAPTCHA or a *"Click to continue
   shopping"* interstitial the run stops — it never retries and **never clicks through**. Blocked
   is reported as blocked, never mistaken for a delisting, and the panel keeps its previous
   numbers and says how old they are.

</details>

---

## Project layout

```
src/
  components/      SitePanel · KeyFactsCompare · TermsSection · CashKaroCard · Navbar …
  pages/           Home · SearchResults · BrandCompare · Settings · SignIn
  context/         AuthContext · SavedContext · ThemeContext
  services/        catalog.ts — the only module components read catalog data from
  lib/             howToUse · prefs · color · scroll
  types.ts         domain model + fixed order of the four key facts
api/               Vercel functions: auth/[action] · refresh/[brandId] · discover
server/
  auth-core.mjs    accounts, sessions, saved cards — one core, run by Vercel and by Vite
  auth-store.mjs   Upstash Redis in production, a JSON file in dev
  catalog-store.mjs  the single writer for catalog.json (locked, atomic)
  refresh*.mjs     re-reads one brand from every seller
scripts/
  scrape.mjs       CLI orchestrator
  sources/*.mjs    one adapter per seller — add a file to add a seller
  lib/facts.mjs    the four-key-fact derivation rules
  lib/build.mjs    classification, folding, merging
.github/workflows/ refresh-prices.yml (daily scrape) · ci.yml (type-check + build)
```

The live API routes run as Vite middleware in development, so there's no second process to start.
On a statically hosted `dist/` without functions they fail silently and the site serves the last
scraped catalog.

---

## Adding a seller

Create `scripts/sources/<name>.mjs` exporting `PLATFORM`, `listBrandUrls()` and
`fetchBrand({ slug, url })` returning `{ key, name, logo, offer }`, then register it in the
`SOURCES` map. Brands merge across sellers on `brandKey(name)`, which strips apostrophes and
gift-card boilerplate so `DOMINO'S` and `Domino's E-Gift Voucher` collapse together.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the rest, including how to report a wrong price or
term — that's the most useful contribution there is.

---

<div align="center">
<sub>Prices and terms are read from public seller pages and can change at any time.<br>
Always confirm on the seller's own page before buying — every panel links straight to it.<br>
Vaultly doesn't sell gift cards and isn't affiliated with GyFTR, Woohoo, Amazon or CashKaro.</sub>
</div>
