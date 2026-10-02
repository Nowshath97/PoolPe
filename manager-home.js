/* Dashboard-only model and views. Uses the existing loaded store; no extra queries. */
function homeAmount(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}
function homeMonthLabel(ym, short = false) {
  const [year, m] = ym.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('en-IN', { month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }) });
}
function buildManagerHome(user, now = new Date()) {
  const groups = user?.role === 'manager' ? db.groups.filter(g => g.managerId === user.id) : [];
  const summaries = groups.map(g => {
    // Legacy/incomplete dates must not break the dashboard while setup is pending.
    const safe = { ...g, monthly: homeAmount(g.monthly), duration: homeAmount(g.duration),
      start: /^\d{4}-\d{2}/.test(g.start || '') ? g.start : month + '-01' };
    if (!g.start) safe.status = 'inactive';
    return getManagerSummary(safe);
  });
  const active = summaries.filter(s => s.inCycle && String(s.g.status).toLowerCase() === 'active');
  const rows = active.flatMap(s => s.rows);
  const sum = (values, key) => values.reduce((total, x) => total + homeAmount(x[key]), 0);
  const collection = { expected: sum(active, 'expected'), collected: sum(active, 'collected'),
    paid: rows.filter(r => r.due > 0 && r.balance === 0).length,
    partial: rows.filter(r => r.balance > 0 && r.paid > 0).length,
    pending: rows.filter(r => r.balance > 0 && r.paid === 0).length };
  collection.percent = collection.expected ? Math.min(100, collection.collected / collection.expected * 100) : 0;
  const ageing = [0, 0, 0, 0];
  let overdueMembers = 0;
  const attention = [];
  for (const s of summaries) {
    ageing[0] += homeAmount(s.pending);
    overdueMembers += s.duesCount;
    for (const row of s.rows) for (const due of row.dues.items) {
      const age = (Number(month.slice(0,4)) - Number(due.ym.slice(0,4))) * 12 + Number(month.slice(5,7)) - Number(due.ym.slice(5,7));
      if (age > 0) ageing[Math.min(3, age)] += homeAmount(due.amount);
    }
    const add = (priority, title, detail, tab, filter = '') => attention.push({ priority, title, detail, tab, filter, g: s.g });
    if (s.duesCount) add(0, `${s.duesCount} members have previous dues`, `${money(s.previousDues)} outstanding from earlier months`, 'members', 'dues');
    if (s.inCycle && !s.auction && s.eligible) add(1, 'Monthly bid not recorded', `${s.eligible} members eligible · ${homeMonthLabel(month)}`, 'bids');
    const partial = s.rows.filter(r => r.balance > 0 && r.paid > 0);
    if (partial.length) add(1, `${partial.length} partial payments to complete`, `${money(sum(partial, 'balance'))} remaining this month`, 'payments');
    const unpaid = s.rows.filter(r => r.balance > 0 && r.paid === 0);
    if (unpaid.length) add(2, `${unpaid.length} payments awaiting collection`, `${money(sum(unpaid, 'balance'))} this month`, 'members', 'pending');
    if (groupNeedsStart(s.g)) add(2, 'Group setup incomplete', `${s.rows.length} of ${MAX_GROUP_MEMBERS} member places filled`, 'overview');
  }
  attention.sort((a,b) => a.priority - b.priority);
  const ids = new Set(groups.map(g => g.id));
  const [year, mm] = month.split('-').map(Number);
  const history = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(year, mm - 6 + i, 1);
    const ym = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    return { month: ym, value: db.payments.filter(p => ids.has(p.groupId) && p.month === ym)
      .reduce((total,p) => total + homeAmount(p.amountPaid), 0) };
  });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
  const todayUTC = Date.parse(today + 'T00:00:00Z');
  const upcoming = groups.filter(g => !groupNeedsStart(g) && /^\d{4}-\d{2}-\d{2}$/.test(g.start || ''))
    .map(g => ({ g, date: g.start, days: (Date.parse(g.start + 'T00:00:00Z') - todayUTC) / 86400000, title: 'Group starts' }))
    .filter(e => e.days >= 0 && e.days < 7).sort((a,b) => a.days - b.days);
  const checklist = active.length ? [
    { title:'All monthly subscriptions collected', done: collection.expected > 0 && rows.every(r => r.balance === 0), detail:`${collection.paid} paid · ${collection.partial} partial · ${collection.pending} pending`, tab:'payments' },
    { title:'Monthly bids recorded', done: active.every(s => !!s.auction), detail:`${active.filter(s => s.auction).length} of ${active.length} groups`, tab:'bids' },
    { title:'Bid payout amounts recorded', done: active.every(s => s.auction?.winnerMemberId && homeAmount(s.auction.payoutAmount ?? s.auction.bidAmount) > 0), detail:'Allotment records only; not confirmation of bank transfer', tab:'bids' }
  ] : [];
  return { groups, summaries, active, collection, attention, history, ageing, overdueMembers, upcoming, checklist };
}

function homeGroupAction(groupId, action) {
  const g = db.groups.find(g => g.id === groupId && g.managerId === currentUser()?.id);
  if (!g || currentUser()?.role !== 'manager') return;
  const s = getManagerSummary(g);
  if (action === 'payment' && s.started && s.rows.length) {
    navigateManager(`group/${encodeURIComponent(g.id)}/payments`);
    modal('managerPaymentPicker');
  } else if (action === 'member' && s.rows.length < MAX_GROUP_MEMBERS) {
    navigateManager(`group/${encodeURIComponent(g.id)}/members`);
    modal('memberModal');
  } else if (action === 'bid' && s.inCycle && !s.auction && s.eligible) {
    navigateManager(`group/${encodeURIComponent(g.id)}/bids`);
    openAuction();
  }
}
function homeQuickAction(action) {
  const model = buildManagerHome(currentUser());
  const eligible = model.summaries.filter(s => action === 'payment' ? s.started && s.rows.length && (s.pending + s.previousDues > 0)
    : action === 'bid' ? s.inCycle && !s.auction && s.eligible : action === 'member' && s.rows.length < MAX_GROUP_MEMBERS && s.cycle <= s.g.duration);
  if (eligible.length === 1) return homeGroupAction(eligible[0].g.id, action);
  if (!eligible.length) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'home-group-picker';
  dialog.setAttribute('aria-label', 'Choose a group');
  const previous = document.activeElement;
  dialog.innerHTML = `<h2>Choose a group</h2><p class="muted">Continue with the existing ${action === 'payment' ? 'payment' : action === 'bid' ? 'bid' : 'member'} flow.</p><div class="home-picker-list">${eligible.map(s => `<button class="btn secondary" data-id="${escapeHtml(s.g.id)}">${escapeHtml(s.g.name)}</button>`).join('')}</div><button class="btn secondary" data-close>Cancel</button>`;
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => { dialog.close(); homeGroupAction(button.dataset.id, action); }));
  dialog.addEventListener('close', () => { dialog.remove(); if (previous?.isConnected) previous.focus(); });
  document.body.appendChild(dialog); dialog.showModal();
}
function renderHomeCollection(m) {
  const c = m.collection;
  return `<section class="home-month"><div class="home-month-title"><span class="home-eyebrow">THIS MONTH</span><h2>${homeMonthLabel(month)}</h2><p>${m.active.length ? `${m.active.length} active ${m.active.length === 1 ? 'group' : 'groups'}` : 'No active collection cycles this month'}</p></div>
    <div class="home-month-progress"><div class="home-collection-value"><strong>${money(c.collected)}</strong><span> / ${money(c.expected)}</span></div><p class="muted small">Collected / expected subscriptions</p><div class="home-progress-line"><progress class="collection-progress" max="100" value="${c.percent}" aria-label="Monthly subscriptions collected">${c.percent.toFixed(0)}%</progress><b>${c.percent.toFixed(0)}%</b></div>
    <div class="home-payment-status"><span><b>${c.paid}</b> Paid</span><span><b>${c.partial}</b> Partial</span><span><b>${c.pending}</b> Pending</span></div></div></section>`;
}
function renderHomeAttention(m) {
  return `<section class="home-section"><div class="section-title"><h2>Needs your attention</h2><span class="small muted">${m.attention.length} open items</span></div><div class="home-attention">${m.attention.map(a => `<a class="home-attention-item priority-${a.priority}" href="#/group/${encodeURIComponent(a.g.id)}/${a.tab}" ${a.filter ? `data-group="${escapeHtml(a.g.id)}" data-filter="${a.filter}" onclick="event.preventDefault();openGroupAttention(this.dataset.group,this.dataset.filter)"` : ''}><span class="home-priority">${['HIGH','MEDIUM','LOW'][a.priority]}</span><div><strong>${escapeHtml(a.title)}</strong><p>${escapeHtml(a.detail)}</p><small>${escapeHtml(a.g.name)}</small></div><span aria-hidden="true">&rarr;</span></a>`).join('') || '<p class="home-positive">All caught up. Nothing needs your attention.</p>'}</div></section>`;
}
function renderHomeUpcoming(m) {
  return `<section class="home-section"><span class="home-eyebrow">COMING UP</span><h2>Next 7 days</h2>${m.upcoming.length ? `<ul class="home-timeline">${m.upcoming.map(e => `<li><time datetime="${escapeHtml(e.date)}">${escapeHtml(e.date.slice(8))}<small>${homeMonthLabel(e.date.slice(0,7),true)}</small></time><a href="#/group/${encodeURIComponent(e.g.id)}/overview"><b>${e.title}</b><span>${escapeHtml(e.g.name)}</span><small>${e.days === 0 ? 'Today' : `In ${e.days} days`}</small></a></li>`).join('')}</ul>` : '<p class="muted">Nothing scheduled in the next 7 days.</p>'}</section>`;
}
function renderHomePulse(m) {
  const max = Math.max(1, ...m.history.map(h => h.value));
  return `<section class="home-section"><div class="section-title"><h2>Collection pulse</h2><a href="#/reports">Reports &rarr;</a></div><p class="small muted">Last 6 months · payments by allocated month</p><div class="home-chart" role="list" aria-label="Monthly collections">${m.history.map(h => `<div class="home-chart-column" role="listitem"><span class="home-chart-value">${money(h.value)}</span><div class="home-chart-track"><div class="home-chart-bar" style="height:${h.value / max * 100}%"></div></div><span>${homeMonthLabel(h.month,true)}</span></div>`).join('')}</div>${!m.history.some(h => h.value) ? '<p class="small muted">No collections recorded in this period.</p>' : ''}</section>`;
}
function renderHomeAgeing(m) {
  if (!m.ageing.some(value => value > 0)) return '<section class="home-section home-dues-clear"><h2>Dues health</h2><p class="home-positive">&#10003; All caught up. No outstanding subscriptions.</p></section>';
  const max = Math.max(1, ...m.ageing);
  return `<section class="home-section"><h2>Dues health</h2><p class="small muted">Outstanding subscriptions by age</p><dl class="home-ageing">${m.ageing.map((value,i) => `<div><dt>${['Current month','1 month overdue','2 months overdue','3+ months overdue'][i]}</dt><dd>${money(value)}</dd><progress max="${max}" value="${value}" aria-label="${['Current','One month overdue','Two months overdue','Three or more months overdue'][i]}"></progress></div>`).join('')}</dl><p class="small ${m.overdueMembers ? 'muted' : 'home-positive'}">${m.overdueMembers ? `${m.overdueMembers} member accounts have previous dues. Review the high-priority items above.` : 'All caught up. No previous dues.'}</p></section>`;
}
function renderHomeChecklist(m) {
  return `<section class="home-section"><div class="section-title"><h2>${homeMonthLabel(month,true)} checklist</h2><span class="small muted">${m.checklist.filter(c => c.done).length} / ${m.checklist.length}</span></div>${m.checklist.length ? `<ul class="home-checklist">${m.checklist.map(c => `<li><span class="home-check ${c.done ? 'complete' : ''}" aria-label="${c.done ? 'Complete' : 'Incomplete'}">${c.done ? '&#10003;' : '&#9675;'}</span><div><b>${c.title}</b><small>${escapeHtml(c.detail)}</small></div>${!c.done ? `<a href="${m.active.length === 1 ? `#/group/${encodeURIComponent(m.active[0].g.id)}/${c.tab}` : '#/groups'}">Review &rarr;</a>` : ''}</li>`).join('')}</ul>` : '<p class="muted">The monthly checklist becomes available when a group starts its collection cycle.</p>'}</section>`;
}
function renderHomeHealth(m) {
  if (m.active.length < 2) return '';
  return `<section class="home-section"><div class="section-title"><h2>Group health</h2><a href="#/groups">View groups &rarr;</a></div><div class="table-wrap"><table><thead><tr><th>Group</th><th>Collection</th><th>Dues</th><th>Next event</th></tr></thead><tbody>${m.active.map(s => `<tr><td><a href="#/group/${encodeURIComponent(s.g.id)}/overview">${escapeHtml(s.g.name)}</a></td><td>${s.percent.toFixed(0)}%</td><td>${money(s.pending+s.previousDues)}</td><td>${m.upcoming.find(e => e.g.id === s.g.id)?.date || 'Not scheduled'}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function renderManagerHome(u) {
  const m = buildManagerHome(u);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Kolkata', hour:'2-digit', hourCycle:'h23' }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const actions = `<div class="home-quick-actions">${m.summaries.some(s => s.started && s.rows.length && s.pending+s.previousDues > 0) ? '<button class="btn primary" onclick="homeQuickAction(\'payment\')">+ Record Payment</button>' : ''}${m.active.some(s => !s.auction && s.eligible) ? '<button class="btn secondary" onclick="homeQuickAction(\'bid\')">Record Bid</button>' : ''}${m.summaries.some(s => s.rows.length < MAX_GROUP_MEMBERS && s.cycle <= s.g.duration) ? '<button class="btn secondary" onclick="homeQuickAction(\'member\')">+ Add Member</button>' : ''}<button class="btn ${m.groups.length ? 'secondary' : 'primary'}" onclick="modal('groupModal')">+ Create Group</button></div>`;
  return `<div class="home-dashboard">${portalHeading(`${greeting}, ${u.name || 'Manager'}`, "Here's what needs your attention today.", actions)}${!m.groups.length ? '<section class="home-welcome"><span class="home-eyebrow">A FRESH START</span><h2>Welcome to PoolPay</h2><p>Create your first pool group to start managing members, payments and monthly payouts.</p><button class="btn primary" onclick="modal(\'groupModal\')">Create your first group</button></section>' : `${renderHomeCollection(m)}<div class="home-grid">${renderHomeAttention(m)}${renderHomeUpcoming(m)}${renderHomePulse(m)}${renderHomeAgeing(m)}</div>${renderHomeChecklist(m)}${renderHomeHealth(m)}`}</div>`;
}
