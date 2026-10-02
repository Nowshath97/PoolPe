# Manager home redesign

The application is a static HTML / plain JavaScript app, not React. This change replaces only the manager home renderer. Group workspaces, Reports, Activity, Settings, authentication and the sidebar continue to use their existing implementations.

## Files

- `manager-home.js`: dashboard model, focused render functions and contextual group picker.
- `manager-home.css`: styles scoped to dashboard home and its picker.
- `manager-pages.js`: old home renderer removed; detail-page renderers retained.
- `dashboard.html`: loads the two new assets.
- `.assetsignore`: permits those assets in deployment.
- `tests/manager-dashboard.test.cjs`: loads the new module and verifies dashboard scenarios.

## Data and calculations

No Supabase queries, APIs, dependencies or schema changes were added. The dashboard uses the store loaded by `app.js`: groups, members, payments, auctions and transactions. Existing loading/error behavior remains at the authenticated app entry point.

- **This month:** sums `getManagerSummary` results for manager-owned, active groups whose configured term includes the selected application month. Recorded `amountDue` overrides the scheduled obligation. Otherwise the existing `dueForMonth` helper supplies the regular or post-lift subscription. Collected includes actual partial payments. Paid, Partial and Pending are mutually exclusive member-account counts; the same person in two groups counts twice. The progress bar is capped at 100% while actual amounts remain visible.
- **Action center:** previous dues are high priority; missing bids and partial payments are medium; unpaid current subscriptions and incomplete setup are low. Only nonzero/actionable conditions appear. Existing group routes and member filters perform the follow-up.
- **Coming up:** confirmed group starts from today through the following six days, using India’s date. Setup placeholders are excluded. No future bid, contribution or payout dates are invented.
- **Collection pulse:** sums `amountPaid` by payment allocation month over six calendar months, ending in the selected month, across all manager-owned groups (including completed groups). Transactions are not added again. This is allocation history, not bank receipt-date cash flow; a zero means no collection recorded in the loaded data.
- **Dues health:** uses existing `duesFor` month-level outstanding balances and groups them by calendar-month age: one, two, or three-plus months. Current balances appear separately. Completed groups retain unpaid historical obligations but accrue no invented future subscriptions. Excess payments are treated according to the existing helpers rather than silently netted against unrelated months.
- **Checklist:** for active monthly groups, all subscriptions paid; each group has a monthly auction; and each auction has a winner and a positive recorded payout amount. Payout amount means an allotment record, not proof of money transfer. Completion is derived without writes.
- **Group health:** compact comparison appears only for two or more active groups. Shows collection percentage, current plus prior dues, and an actual upcoming start date if any; otherwise “Not scheduled.”

## Reuse

Uses `getManagerSummary`, `duesFor`, `dueForMonth`, `groupNeedsStart`, existing period/currency helpers, `portalHeading`, `navigateManager`, `openGroupAttention`, `modal`, and `openAuction`. Quick actions use the existing payment picker, member modal, bid flow and group creation modal. Multiple qualifying groups require a group selection first; no default group is silently selected.

## Intentionally omitted

No collection pace or same-point-last-month comparison: the current model does not provide reliable subscription due dates or a complete historical receipt-time series. No scheduled bid/payout events: auction dates describe recorded events. No duplicate Activity feed or speculative insight. No manual checklist state, and no claim that subscriptions were generated or payouts were transferred.

Potential future additive schema work, requiring a separate task: explicit subscription due dates, scheduled auction timestamps, and payout settlement status/date. These would support accurate pace, upcoming events and settlement checks. No migration was made.

## Verification

Run `node --test --experimental-test-isolation=none tests/manager-dashboard.test.cjs`.
Coverage includes no groups, one/multiple groups, ownership isolation, unpaid/partial/fully-paid cycles, previous dues, missing/completed bids, missing start dates, setup, confirmed upcoming starts, and completed groups. The repository has no build or lint scripts. Browser visual/mobile verification is still required; no browser was available in this session.
