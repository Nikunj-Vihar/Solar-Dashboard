
# Build Prompt for Claude Code: Solar Generation Dashboard (Client Project)

Paste this into Claude Code as your project prompt. This is a real client build — treat security, data integrity, and UX polish as non-negotiable, not portfolio-speed shortcuts.

---

## 1. Project Summary

A web dashboard for a solar plant owner currently logging daily generation data from 4 inverters on paper. The tool must:

1. Capture one-time **setup data** about the site and each inverter.
2. Provide a fast, minimal-input **daily logging** screen (replaces the paper log).
3. Present a **living dashboard** with health-status analytics.
4. Send a **monthly email report** summarizing performance.

## 2. Background Research: What Solar Monitoring Dashboards Actually Track

Before specifying inputs, here's the industry-standard KPI set this dashboard should be built around, so the analytics feel credible and match what real solar O&M tools show:

- **Total Energy Generated** (kWh/day, MWh cumulative) — the base metric, already what the client logs today.
- **Capacity Utilization Factor (CUF)**: `Daily Energy (kWh) / (Plant Capacity (kWp) × 24)`, expressed as a percentage. Typical Indian fixed-tilt systems run 15-25% annually — useful for benchmarking.
- **Specific Yield** (kWh generated per kWp of installed capacity, per day or per year) — normalizes output regardless of system size, so day-to-day and inverter-to-inverter comparisons are meaningful even though the 4 inverters may have different capacities.
- **Performance Ratio (PR)**: the ratio of actual to theoretical output. A healthy PR is generally 75-85%; below ~70% signals a real problem worth inspecting. **Important limitation**: true PR requires measured solar irradiance (plane-of-array), which this client isn't capturing and shouldn't have to — see §4 for how to approximate this without extra manual burden.
- **System Availability**: uptime percentage; industry target is ~98%+. Relevant here as "did an inverter report zero/near-zero generation on a day it should have produced," a genuine fault signal.

**Practical adaptation for this client**: don't ask them to log irradiance manually. Instead, during setup, pull a **location-based expected generation baseline** once from a free solar irradiance data source (e.g., NASA POWER or PVGIS, both free/public APIs providing historical average solar irradiance by coordinates and month). Use that baseline plus each inverter's rated capacity to compute an "expected" generation range per month, and compare actual logged generation against it. This gives a genuine PR-like health signal without adding a single extra manual input field.

## 3. Initial Setup — Questions to Ask the Client Directly

Before building, get these answers from the client (this list doubles as your own onboarding checklist inside the app):

**Site-level:**
- Site name/address
- Location coordinates (or just city/pincode — used to fetch the irradiance baseline in §2)
- Installation/commissioning date
- Grid electricity tariff rate (₹/kWh) — optional, but enables a "money saved" figure the client will likely care about more than raw kWh
- Whether they want a "public read-only" dashboard link (e.g. to show family/investors) or strictly private/login-only

**Per inverter (× 4):**
- Inverter name/label (e.g. "Inverter 1", or their own naming if they already call them something)
- Manufacturer and model (optional, nice-to-have for records)
- Rated capacity (kW) of the inverter
- Connected DC capacity (kWp) — the panel capacity feeding that inverter (needed for CUF/specific yield calculations per inverter)
- Install date (may differ slightly per inverter if added in phases)

## 4. Daily Logging — Kept Minimal, Matches Their Existing Habit

One screen, 4 rows (one per inverter), each with exactly the two fields they already track on paper:

- **Daily energy generated (kWh)**
- **Cumulative total (MWh)** — the running total as shown on the inverter's own display

Design details to keep this fast and error-resistant:
- Date defaults to today; allow logging for a past date if they missed a day.
- Pre-fill each field with a faint placeholder showing the previous day's value, so they're typing a small delta from a visible anchor, not starting from a blank field each time.
- Optional (not required) photo upload of each inverter's display, per entry — gives them a photographic backup exactly like keeping the paper log would have, without requiring it.
- Mobile-first layout — they'll likely log this standing at the inverters on a phone, not at a desk.

**Validation, since this replaces error-prone paper entry:**
- A given inverter's cumulative reading must be ≥ yesterday's cumulative reading, unless the entry is explicitly flagged as "inverter replaced/reset."
- Cross-check: (today's cumulative − yesterday's cumulative) should roughly match today's entered daily kWh. Flag a mismatch beyond a small tolerance as a likely typo, and ask for confirmation rather than silently accepting it.
- Flag (don't block) any day where total generation across all 4 inverters deviates sharply (e.g. >35%) from the expected seasonal baseline from §2 — could be a real equipment issue or a data entry error, both worth surfacing.

## 5. Living Dashboard — Content Spec

Keep it simple and to-the-point, per the client's ask — no clutter, no metric overload:

**Top summary row**: Today's generation, this month's cumulative, lifetime cumulative, and one overall **health status indicator** (Good / Watch / Needs Attention), color-coded but paired with an icon/label too (not color alone, for accessibility).

**Per-inverter comparison**: a simple bar chart of today's (or this week's) generation per inverter. Since all 4 sit on the same site and get the same sunlight, one inverter meaningfully underperforming relative to the others is the single clearest real-world fault signal available from this data — surface it prominently.

**Trend chart**: daily generation over the last 30/90 days, with the expected-baseline range from §2 overlaid as a shaded band, so the client can see at a glance whether they're tracking normal or falling behind.

**Impact figures** (if tariff/emission data was provided at setup): estimated ₹ saved and approximate CO₂ offset (using a standard grid-emission-factor approximation, clearly labeled as an estimate, not a certified figure).

**Alerts list**: plain-language flags, e.g. "Inverter 3 generation is 22% below its 30-day average" or "No reading logged for 2 days" — this is what actually makes it feel like a "health status" rather than a wall of numbers.

## 6. Monthly Email Report

Sent automatically on the 1st of each month, summarizing the prior month:
- Total generation, vs. previous month, vs. expected baseline
- Per-inverter breakdown
- CUF and specific yield for the month
- Estimated savings and CO₂ offset
- Any health flags raised during the month
- Simple, scannable layout — this is a summary email, not the full dashboard; link back to the live dashboard for details rather than cramming everything in.

## 7. Architecture & Tech Stack

This needs persistent, ongoing storage — unlike a portfolio static-site tool, this is a real multi-month data history for a real client, so:

- **Frontend**: React (Next.js works well) — responsive, mobile-first for the daily logging screen.
- **Backend**: Supabase (Postgres) — genuinely relational data (site → inverters → daily readings → alerts), plus built-in Auth and Storage (for the optional inverter photos) in one platform.
- **Scheduled jobs**: a Supabase Edge Function (or equivalent serverless cron) for the monthly email, using a transactional email provider with a free tier (e.g. Resend) for delivery.
- **Charts**: Recharts or Chart.js.
- **Irradiance baseline data**: fetched once at setup from a free public API (NASA POWER or PVGIS), stored locally — no need for a live weather feed.

## 8. Security & Data Integrity Requirements (do not shortcut these)

- Proper authentication (Supabase Auth) — no dashboard data reachable without login, unless the client explicitly opts into a public read-only share link (§3).
- Row Level Security in Postgres so each client's data is strictly isolated (relevant if this ever hosts more than one client's site).
- HTTPS enforced everywhere (default on most modern hosts — verify, don't assume).
- **Audit trail**: every daily reading records who entered it and when. This is a meaningful upgrade over paper, not just a technical nicety — it gives the client accountability they didn't have before.
- Input validation on every numeric field: no negative values, sensible upper bounds (e.g. reject a daily kWh entry wildly above what 4 inverters of known capacity could physically produce in a day).
- Regular backups (Supabase's automatic backups) plus a simple CSV export feature, so the client always has an offline copy of their own data — don't make them dependent solely on your hosting.
- No exposed API keys or credentials in any client-side code — verify this explicitly before considering the build done.

## 9. UI/UX Standards

- Mobile-first for logging (used on-site), desktop-friendly for the dashboard (likely reviewed from a computer).
- Color-blind-safe status indicators: pair every color with an icon or label, never color alone.
- Fast logging above all else — the client is replacing a 30-second paper habit; if the digital version takes longer or feels fiddly, they'll go back to paper. Minimize taps/fields relentlessly.
- Clear empty states for the first few days before enough history exists for trend charts to be meaningful.

## 10. Testing & Integrity Checks

1. **Validation test**: confirm cumulative-reading and daily-kWh cross-checks correctly flag realistic mismatch scenarios (typo'd digit, decimal point error) without false-flagging normal daily variation.
2. **Baseline calculation test**: confirm the expected-generation baseline (from irradiance + capacity) produces sane numbers when checked against the client's actual early logged data — recalibrate the tolerance bands if the first month's real data doesn't match assumptions.
3. **Alert logic test**: confirm the underperforming-inverter alert triggers correctly on a synthetic dataset (one inverter deliberately logged low) and doesn't fire on normal expected daily variation.
4. **Email delivery test**: send a test monthly report end-to-end (not just render the template) to confirm the scheduled job and email provider integration actually works.
5. **Auth/RLS test**: confirm a logged-out request cannot read any dashboard data, and (if multi-client in the future) one client cannot see another's data.
6. **Mobile logging test**: time how long it takes to log all 4 inverters' readings on an actual phone — this should be close to their current paper-logging time, not slower.

## 11. Definition of Done

- Setup flow captures all site + per-inverter data from §3.
- Daily logging screen matches the client's existing 2-fields-per-inverter habit, with validation from §4 working.
- Dashboard shows all sections from §5, with real (not placeholder) data once a few days are logged.
- Monthly email sends automatically and correctly.
- All checks in §10 passing, especially the mobile logging speed test — this is the feature most likely to determine whether the client actually adopts it over paper.
