# PoolPe V2.3.0 - GitHub Pages Prototype

Frontend-only PoolPe prototype using browser localStorage. No SQL/backend is required for this demo version.

## New in V2.3.0
- 20-member sample group.
- Displays current running month as `Month X of 20`.
- Displays Bid Completed and Yet to Bid counts.
- Member roster shows Bid Completed / Yet to Bid, bid month and payout; winner icons and member email IDs are removed.
- Automatic previous-dues calculation: an unpaid contribution becomes due once the next month begins; multiple unpaid months accumulate.
- Manager sees members with dues and total outstanding at a glance, plus a dues breakdown by month.
- Member sees only their own dues; other members' payment/dues data remains private.
- Configurable manager commission percentage, default 4%, displayed to both Manager and Member. It is informational only and is not used in calculations.
- Existing payment popup retains amount, payment date, mode, reference and notes.

## Demo accounts
Manager: manager@demo.com / demo123
Member: nowshath@demo.com / demo123

## Deploy
Upload `index.html`, `styles.css` and `app.js` to a GitHub repository and enable GitHub Pages for the repository root.

## Important
This is a prototype. localStorage is per browser/device and client-side authentication is not production security. A shared multi-user release will require a hosted backend/database such as Supabase.
