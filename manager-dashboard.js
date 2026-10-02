/* Manager presentation only. Supabase access and write handlers remain in app.js. */
const managerUI = { key: null, filter: 'all', search: '', expanded: false, explicitFilter: false };
const MEMBER_PREVIEW_COUNT = 8;
let savingGroupStart = false;

function renderGroupStart(s) {
  if (!groupNeedsStart(s.g)) return '';
  return `<section class="card"><h2>Prepare your chit group</h2>
    <p>Add all ${MAX_GROUP_MEMBERS} members, then choose the official start month. No payments or dues apply during setup.</p>
    <form onsubmit="event.preventDefault();startManagerGroup()">
      <div class="field"><label for="chitStartMonth">Chit start month</label>
      <input id="chitStartMonth" type="month" min="${runningMonth()}" value="${runningMonth()}" required></div>
      <p id="groupStartError" class="due-text" role="status"></p>
      <button id="confirmGroupStart" class="btn primary" ${s.rows.length !== MAX_GROUP_MEMBERS ? 'disabled' : ''}>Confirm start month</button>
      <span class="small muted">${s.rows.length} / ${MAX_GROUP_MEMBERS} members joined</span>
    </form></section>`;
}

async function startManagerGroup() {
  if (savingGroupStart) return;
  const g = managerGroup();
  const errorBox = document.getElementById('groupStartError');
  const showError = message => { if (errorBox) errorBox.textContent = message; };
  if (!g || !groupNeedsStart(g)) return showError('This group is no longer awaiting a start month.');
  const selected = document.getElementById('chitStartMonth').value;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selected) || selected < runningMonth()) {
    return showError('Select the current month or a future month.');
  }
  if (groupHasFinancialActivity(g)) return showError('This group has financial activity. Its start date cannot be changed here.');
  savingGroupStart = true;
  const button = document.getElementById('confirmGroupStart');
  if (button) button.disabled = true;
  showError('');
  try {
    const { count, error: countError } = await supabaseClient.from('members')
      .select('id', { count: 'exact', head: true }).eq('group_id', g.id);
    if (countError) throw countError;
    if (count !== MAX_GROUP_MEMBERS) throw new Error(`The group needs exactly ${MAX_GROUP_MEMBERS} members before it can start.`);
    const { data, error } = await supabaseClient.from('groups')
      .update({ start: `${selected}-01`, status: 'active' })
      .eq('id', g.id).eq('manager_id', currentUser().id).eq('status', g.status)
      .select().single();
    if (error) throw error;
    Object.assign(g, mapGroup(data));
    month = runningMonth();
    managerUI.key = null;
    render();
    toast(`Chit start month confirmed: ${selected}`);
  } catch (error) {
    showError(error.message || 'Unable to confirm the start month.');
  } finally {
    savingGroupStart = false;
    if (button) button.disabled = db.members.filter(m => m.groupId === g.id).length !== MAX_GROUP_MEMBERS;
  }
}

function managerGroup() {
  const u = currentUser();
  return u?.role === 'manager'
    ? db.groups.find(g => g.id === activeGroup && g.managerId === u.id)
    : null;
}

// Reuse monthly balances and historical obligation snapshots; never add the
// monthly contribution again to its unpaid balance.
function calculateMemberOutstanding(g, m) {
  const current = paymentForMonth(g, m, month);
  const previous = duesFor(g, m);
  const items = [...previous.items];
  if (current.balance > 0) items.push({ ym: month, amount: current.balance,
    amountDue: current.due, amountPaid: current.paid });
  const amount = previous.amount + current.balance;
  const status = !groupHasStarted(g) ? 'Not started'
    : previous.amount > 0 ? 'Overdue'
    : amount > 0 ? (current.paid > 0 ? 'Partially Paid' : 'Due') : 'Paid';
  return { amount, items, status };
}

function outstandingCaption(r) {
  if (!r.outstanding.amount) return 'No dues';
  if (r.outstanding.items.length === 1 && r.outstanding.items[0].amountPaid > 0)
    return `${money(r.outstanding.items[0].amountPaid)} paid`;
  return r.outstanding.items.map(item => new Date(`${item.ym}-01T12:00:00`)
    .toLocaleDateString('en-IN', { month: 'short' })).join(' + ');
}

function getManagerSummary(g) {
  const cycle = monthIndex(g, month);
  const started = groupHasStarted(g);
  const inCycle = started && cycle >= 1 && cycle <= g.duration;
  const members = db.members.filter(m => m.groupId === g.id);
  const rows = members.map(m => {
    const summary = paymentForMonth(g, m, month);
    const payment = summary.records[0];
    const due = started ? summary.due : 0;
    const paid = started ? summary.paid : 0;
    const balance = Math.max(0, due - paid);
    const dues = duesFor(g, m);
    const lift = liftFor(g.id, m.id);
    const outstanding = calculateMemberOutstanding(g, m);
    return { m, payment, due, paid, balance, dues, lift, started, outstanding,
      status: outstanding.status };
  });
  const expected = rows.reduce((sum, r) => sum + r.due, 0);
  const collected = rows.reduce((sum, r) => sum + r.paid, 0);
  const pending = rows.reduce((sum, r) => sum + r.balance, 0);
  const paidCount = rows.filter(r => r.started && r.due > 0 && r.balance === 0).length;
  const pendingCount = rows.filter(r => r.balance > 0).length;
  const duesCount = rows.filter(r => r.dues.amount > 0).length;
  const previousDues = rows.reduce((sum, r) => sum + r.dues.amount, 0);
  const bidDone = rows.filter(r => r.lift).length;
  const auction = db.auctions.find(a => a.groupId === g.id && a.month === month);
  return { g, cycle, started, inCycle, rows, expected, collected, pending, paidCount, pendingCount,
    duesCount, previousDues, bidDone, eligible: members.length - bidDone, auction,
    winner: members.find(m => m.id === auction?.winnerMemberId),
    percent: expected > 0 ? collected / expected * 100 : 0 };
}

function managerCycleLabel(s) {
  return !s.started ? 'Not started' : s.cycle > s.g.duration ? 'Cycle completed' : `Month ${s.cycle} of ${s.g.duration}`;
}

function renderSummaryCards(s) {
  const cards = [
    ['Total chit value', money(s.g.value), escapeHtml(s.g.name)],
    ['Monthly collection', money(s.expected), 'Expected from current members'],
    ['Collected', money(s.collected), `${s.paidCount} of ${s.rows.length} members paid`],
    ['Pending', money(s.pending), `${s.pendingCount} members · this month`],
    ['Current cycle', managerCycleLabel(s), `${s.g.duration} total months`]
  ];
  return `<section class="manager-summary" aria-label="Monthly summary">${cards.map(([label, value, sub]) => `
    <div class="card metric"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`).join('')}</section>`;
}

function renderCollectionProgress(s) {
  if (!s.started) return '<section class="collection-overview"><h2>Monthly collection</h2><p class="muted">Collections begin from the confirmed chit start month. No payments are due yet.</p></section>';
  return `<section class="collection-overview" aria-label="Monthly collection summary">
    <div class="section-title"><div><p class="collection-period">${escapeHtml(month)} / COLLECTION SUMMARY</p><h2>Monthly collection</h2></div><span class="collection-percentage">${s.percent.toFixed(0)}% collected</span></div>
    <div class="collection-layout"><div class="collection-primary">
      <p class="collection-amount"><strong>${money(s.collected)}</strong><span class="muted"> collected of ${money(s.expected)}</span></p>
      <progress class="collection-progress" max="100" value="${Math.min(100, Math.max(0, s.percent))}" aria-label="Amount collected">${s.percent.toFixed(0)}%</progress>
      <p class="progress-caption">${s.paidCount} of ${s.rows.length} members fully paid</p>
    </div><dl class="collection-balances"><div><dt>Remaining this month</dt><dd>${money(s.pending)}</dd></div><div><dt>Previous dues</dt><dd>${money(s.previousDues)}</dd></div></dl></div>
    <div class="collection-bottom"><span>Payments allocated to ${escapeHtml(month)}. Previous dues are separate.</span><a href="#/group/${encodeURIComponent(s.g.id)}/payments">Manage payments <svg class="line-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></a></div></section>`;
}

function renderNeedsAttention(s) {
  if (!s.started) return `<section class="card"><h2>Group Setup</h2><p>${s.rows.length} of ${MAX_GROUP_MEMBERS} members joined.</p><p class="muted">${groupNeedsStart(s.g) ? 'Complete the group and confirm its start month.' : `Scheduled to start in ${escapeHtml(s.g.start.slice(0, 7))}.`}</p></section>`;
  const items = [];
  if (s.pendingCount) items.push(`<button class="attention-item" onclick="setManagerFilter('pending', true)"><span><b>${s.pendingCount} payments pending</b><small>Review this month's outstanding payments</small></span><strong>${money(s.pending)} <svg class="line-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></strong></button>`);
  if (s.duesCount) items.push(`<button class="attention-item" onclick="setManagerFilter('dues', true)"><span><b>${s.duesCount} members have previous dues</b><small>Unpaid balances from earlier cycles</small></span><strong>${money(s.previousDues)} <svg class="line-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></strong></button>`);
  if (!s.auction && s.inCycle && s.eligible) items.push(`<button class="attention-item" onclick="openAuction()"><span><b>This month's bid is not recorded</b><small>${s.eligible} eligible members</small></span><strong>Record <svg class="line-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></strong></button>`);
  return `<section class="card attention-card"><div class="section-title"><h2>Needs Attention</h2><span class="attention-dot" aria-hidden="true"></span></div>
    ${!s.pendingCount && !s.duesCount && s.rows.length ? '<p class="success-note">All payments are up to date &#10003;</p>' : ''}
    ${items.join('') || (!s.rows.length ? '<p class="muted">Add members to begin tracking collections.</p>' : '<p class="muted">Nothing needs your attention.</p>')}</section>`;
}

function renderBidCard(s) {
  if (!s.started) return `<section class="card manager-bid"><p class="eyebrow">MONTHLY BID</p><h2>Not started</h2><p class="muted">${groupNeedsStart(s.g) ? 'Confirm the chit start month after all 20 members join.' : `Bidding begins in ${escapeHtml(s.g.start.slice(0, 7))}.`}</p></section>`;
  const a = s.auction;
  return `<section class="card manager-bid"><p class="eyebrow">${a ? "THIS MONTH'S BID" : 'NEXT MONTHLY BID'}</p>
    ${a ? `<h2>${escapeHtml(s.winner?.name || 'Recorded recipient')}</h2><p class="bid-payout">Payout: <strong>${money(a.payoutAmount ?? a.bidAmount)}</strong></p>
      <p class="muted">Month ${a.liftMonth || s.cycle}${a.date ? ` &middot; ${escapeHtml(a.date)}` : ''}</p><span class="pill paid">Bid completed</span>`
      : `<h2>${s.inCycle ? `Month ${s.cycle} bid` : managerCycleLabel(s)}</h2><p class="muted">${s.eligible} eligible members &middot; Schedule not set</p>
      <button class="btn primary" onclick="openAuction()" ${!s.inCycle || !s.eligible ? 'disabled' : ''}>Run / Record Bid</button>`}</section>`;
}

function renderQuickActions(s) {
  return `<section class="card quick-actions"><div class="section-title"><h2>Quick Actions</h2></div><div class="quick-action-grid">
    <button class="btn primary" onclick="modal('managerPaymentPicker')" ${!s.rows.length || !s.started ? 'disabled' : ''}>Record Payment</button>
    <button class="btn secondary" onclick="modal('memberModal')">+ Add Member</button>
    <button class="btn secondary" onclick="openAuction()" ${s.auction || !s.inCycle || !s.eligible ? 'disabled' : ''}>${s.auction ? 'Bid Completed' : 'Run Monthly Bid'}</button>
    <button class="btn secondary" onclick="modal('managerReports')">View Reports</button></div></section>`;
}

function getManagerActivity(s) {
  const events = [];
  const txs = db.transactions.filter(t => t.group_id === s.g.id);
  const names = new Map(s.rows.map(r => [r.m.id, r.m.name]));
  for (const t of txs) {
    events.push({ date: t.date || t.created_at || '', title: `${names.get(t.member_id) || 'Member'} paid ${money(t.amount)}`, detail: 'Payment recorded', kind: 'payment' });
  }
  // When receipt history is missing, show payment-record summaries, not invented transactions.
  for (const p of db.payments.filter(p => p.groupId === s.g.id && p.amountPaid > 0)) {
    const covered = txs.some(t => t.member_id === p.memberId && Array.isArray(t.allocations) && t.allocations.some(a => String(a.month).slice(0, 7) === p.month));
    if (!covered) events.push({ date: p.date, title: `${names.get(p.memberId) || 'Member'} · ${money(p.amountPaid)} paid for ${p.month}`, detail: 'Payment record summary', kind: 'payment' });
  }
  for (const a of db.auctions.filter(a => a.groupId === s.g.id)) {
    events.push({ date: a.date, title: `${names.get(a.winnerMemberId) || 'Member'} selected for Month ${a.liftMonth || monthIndex(s.g, a.month)} bid`, detail: `Payout ${money(a.payoutAmount ?? a.bidAmount)}`, kind: 'bid' });
  }
  for (const { m } of s.rows) {
    if (m.createdAt) events.push({ date: m.createdAt, title: `${m.name} added to group`, detail: 'Member added', kind: 'member' });
  }
  // TODO: An optional activity_log would capture edits, reversals, and exact event timestamps.
  // This dashboard never queries or requires such a table.
  return events.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}

function renderActivityItems(events) {
  return events.length ? `<ul class="activity-list">${events.map(e => `<li><span class="activity-icon ${e.kind}" aria-hidden="true">${e.kind === 'member' ? '+' : e.kind === 'bid' ? '&#9734;' : '&#10003;'}</span>
    <div><b>${escapeHtml(e.title)}</b><span class="small muted">${escapeHtml(e.detail)}</span></div><span class="small muted activity-date">${escapeHtml(e.date ? String(e.date).slice(0, 10) : 'Date not recorded')}</span></li>`).join('')}</ul>` : '<p class="muted">No recent activity.</p>';
}

function renderRecentActivity(s) {
  const events = getManagerActivity(s);
  return `<section class="card"><div class="section-title"><h2>Recent Activity</h2>${events.length > 4 ? '<button class="linkbtn" onclick="modal(\'managerActivity\')">View all activity <svg class="line-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></button>' : ''}</div>${renderActivityItems(events.slice(0, 4))}</section>`;
}

function memberMatchesSearch(name, term) {
  return String(name || '').toLowerCase().includes(String(term || '').trim().toLowerCase());
}

function renderMemberFilters(s) {
  if (!s.started) return `<div class="member-filters"><button class="filter-chip" data-filter="all" aria-pressed="true" onclick="setManagerFilter('all')">All <span>${s.rows.length}</span></button><span class="pill neutral">Chit not started</span></div>`;
  const filters = [['all', 'All', s.rows.length], ['paid', 'Paid', s.rows.filter(r => r.status === 'Paid').length], ['pending', 'Pending', s.pendingCount], ['dues', 'With dues', s.duesCount], ['bid', 'Bid completed', s.bidDone], ['eligible', 'Yet to bid', s.eligible]];
  return `<div class="member-filters" role="group" aria-label="Filter members">${filters.map(([key, name, count]) => `<button class="filter-chip" data-filter="${key}" aria-pressed="${managerUI.filter === key}" onclick="setManagerFilter('${key}')">${name} <span>${count}</span></button>`).join('')}</div>`;
}

function positionMemberMenu(menu) {
  if (!menu.open) return;
  document.querySelectorAll('.row-menu[open]').forEach(other => {
    if (other !== menu) other.open = false;
  });
  const anchor = menu.querySelector('summary').getBoundingClientRect();
  const panel = menu.querySelector('div');
  const bounds = panel.getBoundingClientRect();
  const below = anchor.bottom + 6;
  panel.style.left = `${Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8))}px`;
  panel.style.top = `${Math.max(8, below + bounds.height <= window.innerHeight - 8 ? below : anchor.top - bounds.height - 6)}px`;
}

function closeMemberMenus() {
  document.querySelectorAll('.row-menu[open]').forEach(menu => { menu.open = false; });
}
document.addEventListener('click', event => {
  if (!event.target.closest('.row-menu') || event.target.closest('.row-menu button')) closeMemberMenus();
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  document.querySelector('.row-menu[open] summary')?.focus();
  closeMemberMenus();
});
window.addEventListener('resize', closeMemberMenus);
document.addEventListener('scroll', event => {
  if (!event.target.closest?.('.row-menu')) closeMemberMenus();
}, true);

function renderMemberRow(r) {
  // IDs stay in data attributes instead of being interpolated into JavaScript.
  const id = escapeHtml(r.m.id);
  return `<tr data-member-name="${escapeHtml(r.m.name)}" data-paid="${r.status === 'Paid'}" data-pending="${r.balance > 0}" data-dues="${r.dues.amount > 0}" data-bid="${!!r.lift}" data-eligible="${!r.lift}">
    <td><button class="linkbtn" data-id="${id}" onclick="openHistory(this.dataset.id)"><b>${escapeHtml(r.m.name)}</b></button></td>
    <td><span class="pill ${r.status === 'Paid' ? 'paid' : r.status === 'Overdue' ? 'overdue' : r.outstanding.amount ? 'warning' : 'neutral'}">${r.status}</span></td>
    <td>${!r.started ? '&mdash;' : `<button class="linkbtn amount-due" data-id="${id}" onclick="openDues(this.dataset.id)">${money(r.outstanding.amount)}<small class="cell-detail">${escapeHtml(outstandingCaption(r))}</small></button>`}</td>
    <td><span class="pill ${r.lift ? 'winner' : 'neutral'}">${r.lift ? 'Bid Won' : 'Yet to Bid'}</span></td>
    <td><div class="member-actions"><button class="btn secondary" data-id="${id}" onclick="openPayment(this.dataset.id, true)" ${!r.started ? 'disabled' : ''}>${!r.started ? 'Not started' : r.outstanding.amount === 0 ? 'Edit/View Payment' : 'Record Payment'}</button>
        ${r.outstanding.amount > 0 ? `<button class="reminder-button" data-group="${escapeHtml(r.m.groupId)}" data-id="${id}" onclick="openMemberReminder(this.dataset.group,this.dataset.id)" title="Prepare a WhatsApp reminder"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4M12 2V1"/></svg><span>Remind</span></button>` : ''}
      <details class="row-menu" ontoggle="positionMemberMenu(this)"><summary aria-label="More actions for ${escapeHtml(r.m.name)}">&hellip;</summary><div>
        <button class="linkbtn" data-id="${id}" onclick="openHistory(this.dataset.id)">View Details</button>
        <button class="linkbtn" data-group="${escapeHtml(r.m.groupId)}" data-id="${id}" onclick="openMemberStatement(this.dataset.group,this.dataset.id)">View statement</button>

        ${r.paid > 0 ? `<button class="linkbtn due-text" data-id="${id}" onclick="markPending(this.dataset.id)">Mark Pending</button>` : ''}</div></details></div></td></tr>`;
}

function renderMemberTable(s) {
  return `<section class="card member-overview" id="managerMembers"><div class="section-title"><div><h2>Member Overview</h2><p class="small muted">${s.rows.length} of ${MAX_GROUP_MEMBERS} member places filled</p></div>
    <div class="toolbar">${pendingReminderButton(s)}<button class="btn secondary" onclick="modal('memberModal')">+ Add Member</button></div></div>
    ${!s.rows.length ? '<div class="empty"><p>No members have been added yet.</p><button class="btn primary" onclick="modal(\'memberModal\')">Add Member</button></div>' : `
      ${renderMemberFilters(s)}<div class="member-search"><label class="sr-only" for="memberSearch">Search members by name</label><input id="memberSearch" type="search" placeholder="Search members" value="${escapeHtml(managerUI.search)}" oninput="filterMemberRows(this.value)"><span id="memberResultCount" class="small muted" role="status"></span></div>
      <div class="table-wrap" tabindex="0" aria-label="Member payments"><table><thead><tr><th scope="col">Member</th><th scope="col">Status</th><th scope="col">Amount Due</th><th scope="col">Bid Status</th><th scope="col">Actions</th></tr></thead>
      <tbody id="managerMemberRows">${[...s.rows].sort((a, b) => ({ Overdue: 0, 'Partially Paid': 1, Due: 2, Paid: 3 }[a.status] ?? 4) - ({ Overdue: 0, 'Partially Paid': 1, Due: 2, Paid: 3 }[b.status] ?? 4)).map(renderMemberRow).join('')}<tr id="noMemberMatches" hidden><td colspan="5" role="status">No members match this search and filter.</td></tr></tbody></table></div>
      <button id="expandMemberList" class="btn secondary expand-members" onclick="expandManagerMembers()" hidden>View all members</button>`}</section>`;
}

function setManagerFilter(filter, scroll = false) {
  if (!['all', 'paid', 'pending', 'dues', 'bid', 'eligible'].includes(filter)) return;
  if (scroll && typeof navigateManager === 'function'
      && (getManagerRoute().page !== 'group' || getManagerRoute().tab !== 'members')) {
    navigateManager(`group/${encodeURIComponent(activeGroup)}/members`);
  }
  managerUI.filter = filter;
  managerUI.explicitFilter = true;
  managerUI.expanded = false;
  // Attention links reveal the entire category, even after a previous search.
  if (scroll) {
    managerUI.search = '';
    const search = document.getElementById('memberSearch');
    if (search) search.value = '';
  }
  filterMemberRows(managerUI.search);
  if (scroll) document.getElementById('managerMembers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterMemberRows(term) {
  managerUI.search = term;
  const rows = [...document.querySelectorAll('#managerMemberRows tr[data-member-name]')];
  const matches = rows.filter(row => memberMatchesSearch(row.dataset.memberName, term) && (managerUI.filter === 'all' || row.dataset[managerUI.filter] === 'true'));
  const limited = !term.trim() && !managerUI.explicitFilter && !managerUI.expanded;
  const visible = new Set(limited ? matches.slice(0, MEMBER_PREVIEW_COUNT) : matches);
  rows.forEach(row => { row.hidden = !visible.has(row); });
  document.querySelectorAll('.member-filters [data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === managerUI.filter)));
  const empty = document.getElementById('noMemberMatches');
  if (empty) empty.hidden = matches.length > 0;
  const count = document.getElementById('memberResultCount');
  if (count) count.textContent = `Showing ${visible.size} of ${matches.length} matching members`;
  const expand = document.getElementById('expandMemberList');
  if (expand) {
    expand.hidden = matches.length <= visible.size;
    expand.textContent = `View all ${matches.length} ${managerUI.filter === 'all' ? 'members' : 'matching members'}`;
  }
}

function expandManagerMembers() {
  managerUI.expanded = true;
  filterMemberRows(managerUI.search);
}

function renderGroupInformation(s) {
  const remaining = s.started ? Math.max(0, s.g.duration - Math.max(0, s.cycle)) : s.g.duration;
  const next = !s.started ? 1 : s.cycle + 1;
  return `<section class="card"><div class="section-title"><h2>Upcoming / Group Information</h2></div><dl class="group-facts">
    <div><dt>Current cycle</dt><dd>${managerCycleLabel(s)}</dd></div><div><dt>Remaining cycles</dt><dd>${remaining}</dd></div>
    ${!groupNeedsStart(s.g) && next <= s.g.duration ? `<div><dt>Next collection month</dt><dd>${escapeHtml(ymFor(s.g, next))}</dd></div>` : ''}
    <div><dt>Payment due date</dt><dd>Not configured</dd></div><div><dt>Next bid date</dt><dd>Not scheduled</dd></div></dl></section>`;
}

function renderGroupSettings(s) {
  const g = s.g;
  return `<section class="card"><details class="group-settings"><summary>Manage Group / Group Settings</summary><dl class="group-facts">
    <div><dt>Group name</dt><dd>${escapeHtml(g.name)}</dd></div><div><dt>Chit value</dt><dd>${money(g.value)}</dd></div>
    <div><dt>Monthly contribution</dt><dd>${money(g.monthly)}</dd></div><div><dt>After winning a bid</dt><dd>${money(g.postLiftMonthly)}</dd></div>
    <div><dt>Commission</dt><dd>${g.commission ?? 4}% (informational)</dd></div><div><dt>Start date</dt><dd>${groupNeedsStart(g) ? 'Not confirmed' : escapeHtml(g.start)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(g.status)}</dd></div></dl>
    <details class="danger-zone"><summary>Danger Zone</summary><p class="small muted">Deleting a group removes its related data. This cannot be undone.</p><button class="btn danger" onclick="deleteGroup()">Delete Group</button></details></details>
    <p class="small muted">View group terms and manage this group.</p></section>`;
}

function renderManagerDialogs(s) {
  const dialog = (id, title, content) => `<div id="${id}" class="modal" role="dialog" aria-modal="true" aria-labelledby="${id}Title"><div class="dialog"><div class="section-title"><h3 id="${id}Title">${title}</h3><button class="btn secondary" onclick="closeModal('${id}')" aria-label="Close ${title}">Close</button></div>${content}</div></div>`;
  return dialog('managerPaymentPicker', 'Record Payment', `<p class="muted">Select a member to open the existing payment form.</p><div class="field"><label for="quickPaymentMember">Member</label><select id="quickPaymentMember"><option value="">Select a member</option>${s.rows.map(r => `<option value="${escapeHtml(r.m.id)}">${escapeHtml(r.m.name)} — ${money(r.balance + r.dues.amount)} outstanding</option>`).join('')}</select></div><p id="quickPaymentError" class="due-text" role="status"></p><button class="btn primary" onclick="openManagerPayment()">Continue</button>`)
    + dialog('managerReports', 'Collection Summary', `<p>${escapeHtml(s.g.name)} &middot; ${escapeHtml(month)}</p><dl class="group-facts"><div><dt>Expected this month</dt><dd>${money(s.expected)}</dd></div><div><dt>Collected for this month</dt><dd>${money(s.collected)}</dd></div><div><dt>Pending this month</dt><dd>${money(s.pending)}</dd></div><div><dt>Previous dues</dt><dd>${money(s.previousDues)}</dd></div><div><dt>Total outstanding</dt><dd>${money(s.pending + s.previousDues)}</dd></div><div><dt>Members paid</dt><dd>${s.paidCount} / ${s.rows.length}</dd></div></dl><p class="small muted">Based on loaded payment records and the group's contribution schedule. Previous dues are separate from this month's collection.</p>`)
    + dialog('managerActivity', 'All Activity', renderActivityItems(getManagerActivity(s)));
}

function openManagerPayment() {
  const id = document.getElementById('quickPaymentMember').value;
  const g = managerGroup();
  if (!g || !db.members.some(m => m.id === id && m.groupId === g.id)) {
    document.getElementById('quickPaymentError').textContent = 'Select a member from this group.';
    return;
  }
  closeModal('managerPaymentPicker');
  openPayment(id);
}
