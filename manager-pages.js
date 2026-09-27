/* View composition uses the shared db and calculations in manager-dashboard.js. */
const portalFilters = { activityGroup: '', activityType: '', activityMonth: '', report: 'collections' };

function portalHeading(title, subtitle, action = '') {
  return `<div class="hero"><div><h1 id="managerPageTitle" tabindex="-1">${escapeHtml(title)}</h1><p class="muted">${escapeHtml(subtitle)}</p></div>${action}</div>`;
}

function emptyManagerGroups() {
  return `<section class="card empty"><h2>You haven't created a PoolPay group yet.</h2><button class="btn primary" onclick="modal('groupModal')">Create your first group</button></section>`;
}

function portalMetrics(items) {
  return `<div class="portal-metrics">${items.map(([label, value, detail = '']) => `<div class="card metric"><div class="label">${escapeHtml(label)}</div><div class="value">${value}</div><div class="sub">${escapeHtml(detail)}</div></div>`).join('')}</div>`;
}

function groupRouteLink(g, tab = 'overview', text = 'Open Group →') {
  return `<a class="btn secondary" href="#/group/${encodeURIComponent(g.id)}/${tab}">${text}</a>`;
}

function groupDisplayStatus(s) {
  return groupNeedsStart(s.g) ? 'Gathering members' : !s.started ? 'Scheduled' : s.cycle > s.g.duration ? 'Completed' : s.g.status;
}

function renderGroupCard(g) {
  const s = getManagerSummary(g);
  const progress = s.started ? Math.min(100, Math.max(0, s.cycle / g.duration * 100)) : 0;
  return `<article class="card group-snapshot"><div class="section-title"><h2>${escapeHtml(g.name)}</h2><span class="pill neutral">${escapeHtml(groupDisplayStatus(s))}</span></div>
    <div class="big">${money(g.value)}</div><p class="muted">${money(g.monthly)} / month · ${s.rows.length} members</p>
    <p>${managerCycleLabel(s)}</p><progress class="collection-progress" max="100" value="${progress}" aria-label="Group cycle progress">${progress.toFixed(0)}%</progress>
    <p class="small muted">Collection: ${money(s.collected)} / ${money(s.expected)}</p>${groupRouteLink(g)}</article>`;
}

function renderManagerHome(u, groups) {
  const summaries = groups.map(getManagerSummary);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const active = summaries.filter(s => String(s.g.status).toLowerCase() === 'active' && !groupNeedsStart(s.g) && s.cycle <= s.g.duration);
  const metrics = portalMetrics([
    ['Active groups', active.length], ['Total members', summaries.reduce((n,s) => n + s.rows.length, 0)],
    ['This month collected', money(summaries.reduce((n,s) => n + s.collected, 0)), month],
    ['Outstanding', money(summaries.reduce((n,s) => n + s.pending + s.previousDues, 0)), 'Current balances and previous dues']
  ]);
  const attention = summaries.flatMap(s => {
    const rows = [];
    const item = (text, tab, filter = '') => `<a class="portal-attention" href="#/group/${encodeURIComponent(s.g.id)}/${tab}" ${filter ? `data-group="${escapeHtml(s.g.id)}" data-filter="${filter}" onclick="event.preventDefault();openGroupAttention(this.dataset.group,this.dataset.filter)"` : ''}><div><b>${text}</b><small>${escapeHtml(s.g.name)}</small></div><span>View →</span></a>`;
    if (s.pendingCount) rows.push(item(`${s.pendingCount} payments pending`, 'members', 'pending'));
    if (s.duesCount) rows.push(item(`${s.duesCount} members have previous dues`, 'members', 'dues'));
    if (s.inCycle && !s.auction && s.eligible) rows.push(item(`${escapeHtml(month)} bid not completed`, 'bids'));
    if (groupNeedsStart(s.g)) rows.push(item('Complete group setup', 'overview'));
    return rows;
  });
  return portalHeading(`${greeting}, ${u.name || 'Manager'}`, "Here's what's happening across your groups.")
    + (groups.length ? `${metrics}<section><h2>Needs Attention</h2><div class="card">${attention.slice(0, 6).join('') || '<p class="success-note">All payments are up to date ✓</p>'}${attention.length > 6 ? '<p><a href="#/groups">View all groups for more items →</a></p>' : ''}</div></section>
    <section><div class="section-title"><h2>Group snapshots</h2><a href="#/groups">View All Groups →</a></div><div class="group-card-grid">${(active.length ? active.map(s => s.g) : groups).slice(0, 4).map(renderGroupCard).join('')}</div></section>` : emptyManagerGroups());
}

function openGroupAttention(id, filter) {
  if (!db.groups.some(g => g.id === id && g.managerId === currentUser()?.id)) return;
  navigateManager(`group/${encodeURIComponent(id)}/members`);
  setManagerFilter(filter, true);
}

function renderGroupsPage(groups) {
  return portalHeading('Groups', 'Manage your chit groups.', '<button class="btn primary" onclick="modal(\'groupModal\')">+ Create Group</button>')
    + (groups.length ? `<div class="group-card-grid">${groups.map(renderGroupCard).join('')}</div>` : emptyManagerGroups());
}

function renderGroupWorkspace(s, tab) {
  const views = {
    overview: () => `${renderGroupStart(s)}${renderSummaryCards(s)}${renderCollectionProgress(s)}<div class="manager-grid">${renderBidCard(s)}${renderGroupInformation(s)}</div>
      <div class="toolbar"><button class="btn primary" onclick="modal('memberModal')">+ Add Member</button><button class="btn secondary" onclick="modal('managerPaymentPicker')" ${!s.started || !s.rows.length ? 'disabled' : ''}>Record Payment</button>${groupRouteLink(s.g, 'bids', 'Manage Bid')}</div>`,
    members: () => renderMemberTable(s),
    payments: () => renderGroupPayments(s),
    bids: () => renderGroupBids(s),
    settings: () => `${renderGroupStart(s)}<p class="muted">${s.rows.length} members in this group</p>${renderGroupSettings(s)}`
  };
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#/groups">Groups</a><span>/</span><span>${escapeHtml(s.g.name)}</span></nav>
    ${portalHeading(s.g.name, `${money(s.g.value)} · ${money(s.g.monthly)} / month · ${s.rows.length} members · ${managerCycleLabel(s)}`, `<span class="pill neutral">${escapeHtml(groupDisplayStatus(s))}</span>`)}
    <nav class="group-tabs" aria-label="Group navigation">${managerTabs.map(t => `<a href="#/group/${encodeURIComponent(s.g.id)}/${t}" ${tab === t ? 'aria-current="page"' : ''}>${t[0].toUpperCase() + t.slice(1)}</a>`).join('')}</nav>${views[tab]()}`;
}

function renderGroupPayments(s) {
  return `<div class="section-title"><h2>Payments · ${escapeHtml(month)}</h2><button class="btn primary" onclick="modal('managerPaymentPicker')" ${!s.started || !s.rows.length ? 'disabled' : ''}>Record Payment</button></div>
    ${portalMetrics([['Expected',money(s.expected)],['Collected',money(s.collected)],['Outstanding',money(s.pending+s.previousDues),'Includes previous dues'],['Paid members',`${s.paidCount} / ${s.rows.length}`]])}
    ${renderCollectionProgress(s)}${!s.rows.length ? '<p class="empty">No members have been added yet.</p>' : `<div class="card table-wrap"><table><thead><tr><th>Member</th><th>Paid this month</th><th>Date</th><th>Status</th><th>Outstanding</th><th>Action</th></tr></thead><tbody>${s.rows.map(r => `<tr><td>${escapeHtml(r.m.name)}</td><td>${money(r.paid)}</td><td>${escapeHtml(r.payment?.date || '—')}</td><td><span class="pill ${r.status === 'Paid' ? 'paid' : r.balance ? 'warning' : 'neutral'}">${r.status}</span></td><td>${money(r.balance+r.dues.amount)}</td><td><button class="btn secondary" data-id="${escapeHtml(r.m.id)}" onclick="openPayment(this.dataset.id)" ${!s.started ? 'disabled' : ''}>${r.status === 'Paid' ? 'Edit Payment' : 'Record Payment'}</button>${r.payment?.status === 'Paid' ? `<button class="linkbtn" data-id="${escapeHtml(r.m.id)}" onclick="markPending(this.dataset.id)">Mark Pending</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`}`;
}

function renderBidHistory(g) {
  const bids = db.auctions.filter(a => a.groupId === g.id).sort((a,b) => b.month.localeCompare(a.month));
  return bids.length ? `<div class="table-wrap"><table><thead><tr><th>Month</th><th>Winner</th><th>Payout</th><th>Date</th></tr></thead><tbody>${bids.map(a => `<tr><td>${a.liftMonth || monthIndex(g,a.month)}</td><td>${escapeHtml(db.members.find(m => m.id === a.winnerMemberId && m.groupId === g.id)?.name || 'Recorded member')}</td><td>${money(a.payoutAmount ?? a.bidAmount)}</td><td>${escapeHtml(a.date || 'Date not recorded')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No bids have been recorded yet.</p>';
}

function renderGroupBids(s) {
  return `<h2>Bids</h2>${portalMetrics([['Current cycle',managerCycleLabel(s)],['Eligible members',s.eligible]])}${renderBidCard(s)}<section class="card"><h2>Bid History</h2>${renderBidHistory(s.g)}</section>`;
}

function renderActivityPage(groups) {
  const events = groups.flatMap(g => getManagerActivity(getManagerSummary(g)).map(e => ({ ...e, groupId:g.id, groupName:g.name })));
  const filtered = events.filter(e => (!portalFilters.activityGroup || e.groupId === portalFilters.activityGroup)
    && (!portalFilters.activityType || e.kind === portalFilters.activityType)
    && (!portalFilters.activityMonth || String(e.date).slice(0,7) === portalFilters.activityMonth))
    .sort((a,b) => (Date.parse(b.date)||0)-(Date.parse(a.date)||0));
  return portalHeading('Activity', 'Track important changes made across your groups.') + `<div class="toolbar activity-filters">
    <label>Group<select onchange="updatePortalFilter('activityGroup',this.value)"><option value="">All Groups</option>${groups.map(g => `<option value="${escapeHtml(g.id)}" ${g.id === portalFilters.activityGroup ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}</select></label>
    <label>Activity<select onchange="updatePortalFilter('activityType',this.value)">${[['','All Activity'],['payment','Payments'],['member','Members'],['bid','Bids'],['group','Groups']].map(([value,label]) => `<option value="${value}" ${value === portalFilters.activityType ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <label>Month<input type="month" value="${escapeHtml(portalFilters.activityMonth)}" onchange="updatePortalFilter('activityMonth',this.value)"></label></div>
    <p class="small muted">Derived from existing receipts, payment records, member creation dates and bids. Edits, reversals and group changes are not recorded as audit events.</p>
    <section class="card">${filtered.length ? renderActivityItems(filtered.map(e => ({...e, detail:`${e.groupName} · ${e.detail}`}))) : '<p class="muted">No activity recorded yet for these filters.</p>'}</section>`;
}

function updatePortalFilter(key, value) {
  if (!Object.hasOwn(portalFilters, key)) return;
  portalFilters[key] = value;
  render();
}

function renderReportsPage(groups) {
  const reports = [['collections','Monthly Collections'],['dues','Outstanding Dues'],['statements','Member Statements'],['bids','Bid History'],['commission','Manager Commission']];
  const report = reports.some(([key]) => key === portalFilters.report) ? portalFilters.report : 'collections';
  const sections = groups.map(g => {
    const s = getManagerSummary(g);
    const views = {
      collections: () => portalMetrics([['Expected',money(s.expected)],['Collected',money(s.collected)],['Pending',money(s.pending)]]),
      dues: () => s.rows.some(r => r.balance+r.dues.amount > 0) ? `<ul class="report-list">${s.rows.filter(r => r.balance+r.dues.amount > 0).map(r => `<li><span>${escapeHtml(r.m.name)}</span><b>${money(r.balance+r.dues.amount)}</b></li>`).join('')}</ul><p class="small muted">Includes current balances and previous dues.</p>` : '<p class="success-note">All payments are up to date ✓</p>',
      statements: () => s.rows.length ? `<ul class="report-list">${s.rows.map(r => `<li><span>${escapeHtml(r.m.name)}</span><button class="linkbtn" data-group="${escapeHtml(g.id)}" data-member="${escapeHtml(r.m.id)}" onclick="openPortalStatement(this.dataset.group,this.dataset.member)">View statement →</button></li>`).join('')}</ul>` : '<p>No members have been added yet.</p>',
      bids: () => renderBidHistory(g),
      commission: () => `<p class="big">${g.commission ?? 4}%</p><p class="muted">Configured commission rate, informational only. Commission receipts are not tracked.</p>`
    };
    return `<section class="card"><div class="section-title"><h2>${escapeHtml(g.name)}</h2>${groupRouteLink(g)}</div>${views[report]()}</section>`;
  });
  return portalHeading('Reports', `Available summaries for ${month}.`) + `<div class="member-filters">${reports.map(([key,label]) => `<button class="filter-chip" aria-pressed="${key === report}" onclick="updatePortalFilter('report','${key}')">${label}</button>`).join('')}</div>${sections.join('') || emptyManagerGroups()}`;
}

function openPortalStatement(groupId, memberId) {
  if (!db.groups.some(g => g.id === groupId && g.managerId === currentUser()?.id)
    || !db.members.some(m => m.id === memberId && m.groupId === groupId)) return;
  navigateManager(`group/${encodeURIComponent(groupId)}/members`);
  openHistory(memberId);
}

function renderAccountSettings(u) {
  return portalHeading('Settings', 'Your manager account.') + `<section class="card"><h2>Profile</h2><dl class="group-facts"><div><dt>Name</dt><dd>${escapeHtml(u.name)}</dd></div><div><dt>Email</dt><dd>${escapeHtml(u.email || 'Not provided')}</dd></div><div><dt>Role</dt><dd>${escapeHtml(u.role)}</dd></div></dl><p class="small muted">Group configuration is available under Groups → Open Group → Settings.</p></section>`;
}
