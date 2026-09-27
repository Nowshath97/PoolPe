/* Manager presentation only. Supabase access and write handlers remain in app.js. */
const managerUI = { key: null, filter: 'all', search: '', expanded: false, explicitFilter: false };
const MEMBER_PREVIEW_COUNT = 8;

function managerGroup() {
  const u = currentUser();
  return u?.role === 'manager'
    ? db.groups.find(g => g.id === activeGroup && g.managerId === u.id)
    : null;
}

function getManagerSummary(g) {
  const cycle = monthIndex(g, month);
  const inCycle = cycle >= 1 && cycle <= g.duration;
  const members = db.members.filter(m => m.groupId === g.id);
  const rows = members.map(m => {
    const payment = db.payments.find(p => p.groupId === g.id && p.memberId === m.id && p.month === month);
    const due = Number(payment?.amountDue ?? (inCycle ? dueForMonth(g, m, cycle) : 0));
    const paid = Number(payment?.amountPaid || 0);
    const balance = Math.max(0, due - paid);
    const dues = duesFor(g, m);
    const lift = liftFor(g.id, m.id);
    return { m, payment, due, paid, balance, dues, lift,
      status: balance > 0 ? (paid > 0 ? 'Partial' : 'Pending') : due > 0 || paid > 0 ? 'Paid' : 'Not due' };
  });
  const expected = rows.reduce((sum, r) => sum + r.due, 0);
  const collected = rows.reduce((sum, r) => sum + r.paid, 0);
  const pending = rows.reduce((sum, r) => sum + r.balance, 0);
  const paidCount = rows.filter(r => r.status === 'Paid').length;
  const pendingCount = rows.filter(r => r.balance > 0).length;
  const duesCount = rows.filter(r => r.dues.amount > 0).length;
  const previousDues = rows.reduce((sum, r) => sum + r.dues.amount, 0);
  const bidDone = rows.filter(r => r.lift).length;
  const auction = db.auctions.find(a => a.groupId === g.id && a.month === month);
  return { g, cycle, inCycle, rows, expected, collected, pending, paidCount, pendingCount,
    duesCount, previousDues, bidDone, eligible: members.length - bidDone, auction,
    winner: members.find(m => m.id === auction?.winnerMemberId),
    percent: expected > 0 ? collected / expected * 100 : 0 };
}

function managerCycleLabel(s) {
  return s.cycle < 1 ? 'Not started' : s.cycle > s.g.duration ? 'Cycle completed' : `Month ${s.cycle} of ${s.g.duration}`;
}

function managerView(u) {
  const groups = db.groups.filter(g => g.managerId === u.id);
  if (!groups.some(g => g.id === activeGroup)) activeGroup = groups[0]?.id || null;
  const g = groups.find(g => g.id === activeGroup);
  const s = g ? getManagerSummary(g) : null;
  const key = `${u.id}/${activeGroup}/${month}`;
  if (managerUI.key !== key) {
    Object.assign(managerUI, { key, filter: s?.pendingCount ? 'pending' : 'all', search: '', expanded: false, explicitFilter: false });
  } else if (!managerUI.explicitFilter && !managerUI.search) {
    managerUI.filter = s?.pendingCount ? 'pending' : 'all';
  }
  document.getElementById('app').innerHTML = shell(`
    <div class="manager-dashboard">
      <div class="hero"><div><p class="eyebrow">YOUR GROUPS AT A GLANCE</p>
        <h1>Manager Dashboard</h1><p class="muted">Manage groups, dues, collections and monthly bids.</p>
      </div><span class="period-label">${escapeHtml(month)}</span></div>
      ${renderGroupSelector(groups, s)}
      ${s ? renderManagerDashboard(s) : `<section class="card empty manager-empty">
        <h2>You haven't created a PoolPay group yet.</h2><p>Create a group to start managing your collections and monthly bids.</p>
        <button class="btn primary" onclick="modal('groupModal')">Create your first group</button></section>`}
    </div>${modals()}${s ? renderManagerDialogs(s) : ''}`, u);
  if (s) filterMemberRows(managerUI.search);
}

function selectManagerGroup(id) {
  if (!db.groups.some(g => g.id === id && g.managerId === currentUser()?.id)) return;
  activeGroup = id;
  render();
}

function renderGroupSelector(groups, s) {
  return `<section class="card group-selector" aria-label="Group overview">
    <div class="group-choice"><label for="managerGroupSelect">Group</label>
      <select id="managerGroupSelect" onchange="selectManagerGroup(this.value)" ${groups.length ? '' : 'disabled'}>
        ${groups.length ? groups.map(g => `<option value="${escapeHtml(g.id)}" ${g.id === activeGroup ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('') : '<option>No groups yet</option>'}
      </select>
      ${s ? `<span class="muted small">${money(s.g.value)} &middot; ${managerCycleLabel(s)} &middot; ${s.rows.length} members</span>` : ''}
    </div><button class="btn primary" onclick="modal('groupModal')">+ Create Group</button></section>`;
}

function renderManagerDashboard(s) {
  return `${renderSummaryCards(s)}${renderCollectionProgress(s)}
    <div class="manager-grid">${renderNeedsAttention(s)}${renderBidCard(s)}</div>
    ${renderQuickActions(s)}${renderRecentActivity(s)}${renderMemberTable(s)}
    <div class="manager-grid">${renderGroupInformation(s)}${renderGroupSettings(s)}</div>`;
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
  return `<section class="card collection-card"><div class="section-title"><h2>Monthly Collection</h2><span class="pill winner">${s.percent.toFixed(0)}% collected</span></div>
    <p class="collection-amount"><strong>${money(s.collected)}</strong> <span class="muted">collected of ${money(s.expected)}</span></p>
    <progress class="collection-progress" max="100" value="${Math.min(100, Math.max(0, s.percent))}" aria-label="Amount collected">${s.percent.toFixed(0)}%</progress>
    <div class="progress-caption"><span>${s.paidCount} of ${s.rows.length} members paid</span><span>${money(s.pending)} remaining this month</span></div>
    <progress class="member-progress" max="${Math.max(1, s.rows.length)}" value="${s.paidCount}" aria-label="Members fully paid">${s.paidCount} paid</progress>
    <p class="small muted">Monthly amounts reflect payments allocated to ${escapeHtml(month)}. Previous dues are shown separately.</p></section>`;
}

function renderNeedsAttention(s) {
  const items = [];
  if (s.pendingCount) items.push(`<button class="attention-item" onclick="setManagerFilter('pending', true)"><span><b>${s.pendingCount} payments pending</b><small>Review this month's outstanding payments</small></span><strong>${money(s.pending)} &rsaquo;</strong></button>`);
  if (s.duesCount) items.push(`<button class="attention-item" onclick="setManagerFilter('dues', true)"><span><b>${s.duesCount} members have previous dues</b><small>Unpaid balances from earlier cycles</small></span><strong>${money(s.previousDues)} &rsaquo;</strong></button>`);
  if (!s.auction && s.inCycle && s.eligible) items.push(`<button class="attention-item" onclick="openAuction()"><span><b>This month's bid is not recorded</b><small>${s.eligible} eligible members</small></span><strong>Record &rsaquo;</strong></button>`);
  return `<section class="card attention-card"><div class="section-title"><h2>Needs Attention</h2><span class="attention-dot" aria-hidden="true"></span></div>
    ${!s.pendingCount && !s.duesCount && s.rows.length ? '<p class="success-note">All payments are up to date &#10003;</p>' : ''}
    ${items.join('') || (!s.rows.length ? '<p class="muted">Add members to begin tracking collections.</p>' : '<p class="muted">Nothing needs your attention.</p>')}</section>`;
}

function renderBidCard(s) {
  const a = s.auction;
  return `<section class="card manager-bid"><p class="eyebrow">${a ? "THIS MONTH'S BID" : 'NEXT MONTHLY BID'}</p>
    ${a ? `<h2>${escapeHtml(s.winner?.name || 'Recorded recipient')}</h2><p class="bid-payout">Payout: <strong>${money(a.payoutAmount ?? a.bidAmount)}</strong></p>
      <p class="muted">Month ${a.liftMonth || s.cycle}${a.date ? ` &middot; ${escapeHtml(a.date)}` : ''}</p><span class="pill paid">Bid completed</span>`
      : `<h2>${s.inCycle ? `Month ${s.cycle} bid` : managerCycleLabel(s)}</h2><p class="muted">${s.eligible} eligible members &middot; Schedule not set</p>
      <button class="btn primary" onclick="openAuction()" ${!s.inCycle || !s.eligible ? 'disabled' : ''}>Run / Record Bid</button>`}</section>`;
}

function renderQuickActions(s) {
  return `<section class="card quick-actions"><div class="section-title"><h2>Quick Actions</h2></div><div class="quick-action-grid">
    <button class="btn primary" onclick="modal('managerPaymentPicker')" ${!s.rows.length ? 'disabled' : ''}>Record Payment</button>
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
  return `<section class="card"><div class="section-title"><h2>Recent Activity</h2>${events.length > 4 ? '<button class="linkbtn" onclick="modal(\'managerActivity\')">View all activity &rarr;</button>' : ''}</div>${renderActivityItems(events.slice(0, 4))}</section>`;
}

function memberMatchesSearch(name, term) {
  return String(name || '').toLowerCase().includes(String(term || '').trim().toLowerCase());
}

function renderMemberFilters(s) {
  const filters = [['all', 'All', s.rows.length], ['paid', 'Paid', s.paidCount], ['pending', 'Pending', s.pendingCount], ['dues', 'With dues', s.duesCount], ['bid', 'Bid completed', s.bidDone], ['eligible', 'Yet to bid', s.eligible]];
  return `<div class="member-filters" role="group" aria-label="Filter members">${filters.map(([key, name, count]) => `<button class="filter-chip" data-filter="${key}" aria-pressed="${managerUI.filter === key}" onclick="setManagerFilter('${key}')">${name} <span>${count}</span></button>`).join('')}</div>`;
}

function renderMemberRow(r) {
  // IDs stay in data attributes instead of being interpolated into JavaScript.
  const id = escapeHtml(r.m.id);
  return `<tr data-member-name="${escapeHtml(r.m.name)}" data-paid="${r.status === 'Paid'}" data-pending="${r.balance > 0}" data-dues="${r.dues.amount > 0}" data-bid="${!!r.lift}" data-eligible="${!r.lift}">
    <td><button class="linkbtn" data-id="${id}" onclick="openHistory(this.dataset.id)"><b>${escapeHtml(r.m.name)}</b></button></td>
    <td><span class="pill ${r.status === 'Paid' ? 'paid' : r.balance ? 'warning' : 'neutral'}">${r.status}</span></td>
    <td>${r.dues.amount ? `<button class="linkbtn due-text" data-id="${id}" onclick="openDues(this.dataset.id)">${money(r.dues.amount)}<small class="cell-detail">${r.dues.months} month(s)</small></button>` : '<span class="pill paid">No dues</span>'}</td>
    <td>${money(r.due)}${r.status === 'Partial' ? `<small class="cell-detail muted">${money(r.balance)} remaining</small>` : ''}</td><td>${money(r.paid)}</td>
    <td><span class="pill ${r.lift ? 'winner' : 'neutral'}">${r.lift ? 'Bid Won' : 'Yet to Bid'}</span></td>
    <td><div class="member-actions"><button class="btn secondary" data-id="${id}" onclick="openPayment(this.dataset.id)">${r.status === 'Paid' ? 'Edit Payment' : 'Mark Paid'}</button>
      <details class="row-menu"><summary aria-label="More actions for ${escapeHtml(r.m.name)}">&hellip;</summary><div>
        <button class="linkbtn" data-id="${id}" onclick="openHistory(this.dataset.id)">View Details</button>
        ${r.payment?.status === 'Paid' ? `<button class="linkbtn due-text" data-id="${id}" onclick="markPending(this.dataset.id)">Mark Pending</button>` : ''}</div></details></div></td></tr>`;
}

function renderMemberTable(s) {
  return `<section class="card member-overview" id="managerMembers"><div class="section-title"><div><h2>Member Overview</h2><p class="small muted">${s.rows.length} of ${MAX_GROUP_MEMBERS} member places filled</p></div>
    <button class="btn secondary" onclick="modal('memberModal')">+ Add Member</button></div>
    ${!s.rows.length ? '<div class="empty"><p>No members have been added yet.</p><button class="btn primary" onclick="modal(\'memberModal\')">Add Member</button></div>' : `
      ${renderMemberFilters(s)}<div class="member-search"><label class="sr-only" for="memberSearch">Search members by name</label><input id="memberSearch" type="search" placeholder="Search members" value="${escapeHtml(managerUI.search)}" oninput="filterMemberRows(this.value)"><span id="memberResultCount" class="small muted" role="status"></span></div>
      <div class="table-wrap" tabindex="0" aria-label="Member payments"><table><thead><tr><th scope="col">Member</th><th scope="col">Payment</th><th scope="col">Previous Dues</th><th scope="col">This Month Due</th><th scope="col">Paid Amount</th><th scope="col">Bid Status</th><th scope="col">Action</th></tr></thead>
      <tbody id="managerMemberRows">${s.rows.map(renderMemberRow).join('')}<tr id="noMemberMatches" hidden><td colspan="7" role="status">No members match this search and filter.</td></tr></tbody></table></div>
      <button id="expandMemberList" class="btn secondary expand-members" onclick="expandManagerMembers()" hidden>View all members</button>`}</section>`;
}

function setManagerFilter(filter, scroll = false) {
  if (!['all', 'paid', 'pending', 'dues', 'bid', 'eligible'].includes(filter)) return;
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
  const remaining = Math.max(0, s.g.duration - Math.max(0, s.cycle));
  const next = s.cycle < 1 ? 1 : s.cycle + 1;
  return `<section class="card"><div class="section-title"><h2>Upcoming / Group Information</h2></div><dl class="group-facts">
    <div><dt>Current cycle</dt><dd>${managerCycleLabel(s)}</dd></div><div><dt>Remaining cycles</dt><dd>${remaining}</dd></div>
    ${next <= s.g.duration ? `<div><dt>Next collection month</dt><dd>${escapeHtml(ymFor(s.g, next))}</dd></div>` : ''}
    <div><dt>Payment due date</dt><dd>Not configured</dd></div><div><dt>Next bid date</dt><dd>Not scheduled</dd></div></dl></section>`;
}

function renderGroupSettings(s) {
  const g = s.g;
  return `<section class="card"><details class="group-settings"><summary>Manage Group / Group Settings</summary><dl class="group-facts">
    <div><dt>Group name</dt><dd>${escapeHtml(g.name)}</dd></div><div><dt>Chit value</dt><dd>${money(g.value)}</dd></div>
    <div><dt>Monthly contribution</dt><dd>${money(g.monthly)}</dd></div><div><dt>After winning a bid</dt><dd>${money(g.postLiftMonthly)}</dd></div>
    <div><dt>Commission</dt><dd>${g.commission ?? 4}% (informational)</dd></div><div><dt>Start date</dt><dd>${escapeHtml(g.start)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(g.status)}</dd></div></dl>
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
