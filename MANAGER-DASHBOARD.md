# Manager dashboard

The manager UI is rendered by `manager-dashboard.js` and styled by
`manager-dashboard.css`. `dashboard.html` loads these alongside the existing
application. Supabase queries, authentication, roles, and payment/member/bid
write handlers remain in `app.js`.

## Calculations

- Expected collection sums each current member's saved monthly `amountDue`,
  falling back to `dueForMonth` during the configured group cycle.
- Collected includes partial payments allocated to the current month. It does
  not count receipts allocated to earlier months as current-month collections.
- Pending sums positive per-member balances; fully paid member counts are
  based on those balances. Previous dues remain a separate amount.
- Future and completed groups do not accrue new monthly contributions. The
  shared dues helper now stops at the group's configured final cycle.
- A completed bid uses the recorded payout. Contribution changes after a bid
  continue to use the existing calculation.

## Existing functionality

Group creation, member creation (including the inline 20-member limit), payment
recording, payment history, dues details, marking pending, monthly bidding, and
logout retain their existing handlers. Quick Record Payment selects a member
and opens the existing payment form. View Reports opens a basic collection
summary of loaded data. Delete Group is inside collapsed settings and a nested
Danger Zone, with a confirmation naming the selected group and an ownership check.

Search and manually selected filters combine. Initially the list shows up to
eight members, defaulting to Pending when applicable; View all expands it.
Explicit searches/filters show all matching members. Attention links clear an
old search before showing the relevant category.

## Activity and optional future database work

No schema changes, migrations, authentication changes, or RLS changes were made.
Activity uses existing transactions and bid dates, with payment summaries when
transaction allocations are unavailable. Member additions appear only if an
existing `created_at` value is returned. Undated records say “Date not recorded.”
This is derived history, not an immutable audit trail.

TODOs for future review, not implemented or required:

- An optional activity log could retain edits, reversals, actor identity, and
  exact timestamps. Current payment records alone cannot reconstruct them.
- Explicit payment due-day and bid scheduling fields would support precise
  upcoming dates and overdue labels. Until then, only the next collection
  month is derived; day-specific dates remain unspecified.
- Browser visual checks on desktop/tablet/mobile and a staging Supabase flow
  check remain to be done. No browser was available in the automation session;
  no live financial records were changed for testing.

Any future schema design should be reviewed separately before applying SQL.

## Verification

Run `node --check app.js`, `node --check manager-dashboard.js`, and
`node --test tests/manager-dashboard.test.cjs`.

The tests cover no groups, one/multiple groups, authorized group selection,
no members, paid/pending/partial payments, both bid states, contribution-rate
changes, group boundaries, filters/search/expansion, activity fallbacks, handler
references, inline capacity validation, role routing, and the logout call.
They use isolated fixtures and stubbed browser/Supabase boundaries; they do not
replace production data or prove live database connectivity.
