/* Read-only statements. Browser printing keeps account data on the device. */
function buildMemberStatement(groupId, memberId, through = month) {
  const user = currentUser();
  const g = db.groups.find(x => x.id === groupId);
  const m = db.members.find(x => x.id === memberId && x.groupId === groupId);
  if (!g || !m || !user || !(user.role === 'manager' && g.managerId === user.id
    || user.role === 'member' && m.userId === user.id)) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(through)) return null;

  const records = db.payments.filter(p => p.groupId === groupId && p.memberId === memberId
    && p.month <= through);
  const months = new Set(records.map(p => p.month));
  if (groupHasStarted(g, through)) {
    for (let n = 1; n <= Math.min(monthIndex(g, through), g.duration); n++) months.add(ymFor(g, n));
  }
  const rows = [...months].sort().map(ym => {
    const p = records.find(x => x.month === ym);
    const {due, paid} = paymentForMonth(g, m, ym);
    const balance = Math.max(0, due - paid);
    const credit = Math.max(0, paid - due);
    return { month: ym, due, paid, balance, credit,
      status: credit ? 'Credit' : !balance ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
      date: p?.date || '', mode: p?.mode || '', reference: p?.reference || '' };
  });
  const totals = rows.reduce((sum, r) => {
    for (const key of ['due', 'paid', 'balance', 'credit']) sum[key] += r[key];
    return sum;
  }, { due: 0, paid: 0, balance: 0, credit: 0 });
  const lift = liftFor(groupId, memberId);
  return { g, m, through, rows, totals,
    lift: lift && lift.month <= through ? lift : null,
    generated: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) };
}

function renderMemberStatement(s) {
  const e = escapeHtml;
  const amount = n => `INR ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `<article class="statement-paper" aria-label="Member account statement">
    <header class="statement-heading"><img src="logo-teal.png" alt="PoolPay" width="155" height="55">
      <div><span class="statement-kicker">MEMBER ACCOUNT</span><h1 id="statementTitle">Statement</h1>
      <p>Through ${e(s.through)} · Generated ${e(s.generated)}</p></div></header>
    <section class="statement-parties"><div><span class="statement-kicker">PREPARED FOR</span>
      <h2>${e(s.m.name)}</h2><p>${e(s.m.email || '')}${s.m.phone ? `<br>${e(s.m.phone)}` : ''}</p>
      <p class="statement-id">Member ID: ${e(s.m.id)}</p></div>
      <div><span class="statement-kicker">CHIT GROUP</span><h2>${e(s.g.name)}</h2>
      <p>Group value: ${amount(s.g.value)}<br>Regular subscription: ${amount(s.g.monthly)}<br>
      Term: ${e(s.g.duration)} months · Start: ${e(s.g.start?.slice(0, 7) || 'Not set')}</p></div></section>
    <section class="statement-totals" aria-label="Statement totals">
      <div><span>Subscription due</span><strong>${amount(s.totals.due)}</strong></div>
      <div><span>Payments recorded</span><strong>${amount(s.totals.paid)}</strong></div>
      <div><span>Outstanding balance</span><strong>${amount(s.totals.balance)}</strong></div></section>
    ${s.totals.credit ? `<p class="statement-note">Excess payments recorded: ${amount(s.totals.credit)}. These have not been offset against other months in this statement.</p>` : ''}
    <h2 class="statement-section-title">Monthly account details</h2>
    <p class="statement-caption">Includes unpaid scheduled months through ${e(s.through)}. Amounts in Indian rupees (INR).</p>
    <div class="statement-table-wrap"><table class="statement-table"><thead><tr><th>Contribution Month</th><th>Due</th><th>Paid</th><th>Balance</th><th>Status</th><th>Payment Date / details</th></tr></thead>
    <tbody>${s.rows.length ? s.rows.map(r => `<tr><td>${e(r.month)}</td><td>${amount(r.due)}</td><td>${amount(r.paid)}</td><td>${amount(r.balance)}</td><td>${e(r.status)}</td>
      <td>${e(r.date || 'No date recorded')}<br>${e(r.mode || '-')}${r.reference ? `<br>Ref: ${e(r.reference)}` : ''}</td></tr>`).join('')
      : '<tr><td colspan="6" class="statement-empty">No scheduled dues or payment records for this period.</td></tr>'}</tbody>
    <tfoot><tr><th>Total</th><td>${amount(s.totals.due)}</td><td>${amount(s.totals.paid)}</td><td>${amount(s.totals.balance)}</td><td colspan="2"></td></tr></tfoot></table></div>
    <section class="statement-note"><h2>Bid / payout record</h2><p>${s.lift
      ? `Bid allotted in ${e(s.lift.month)}. Recorded payout amount: ${amount(s.lift.payoutAmount ?? s.lift.bidAmount ?? 0)}. This is an allotment record, not confirmation of a bank transfer.`
      : 'No bid allotment recorded for this member within the statement period.'}</p></section>
    <footer class="statement-footer"><p>Prepared from the group records currently available in PoolPay. Partial payments are included; the balance includes the current statement month. Later updates to records may change these figures.</p>
    <p>Payment details show the latest information recorded against each month, not an itemised receipt ledger. Contact your group manager for corrections or individual receipts.</p>
    <strong>PoolPay · Clear records. Shared progress.</strong></footer></article>`;
}

let statementReturnFocus = null;
let statementOriginalTitle = '';
function openMemberStatement(groupId, memberId) {
  const s = buildMemberStatement(groupId, memberId);
  if (!s) return;
  document.getElementById('memberStatementViewer')?.close();
  statementReturnFocus = document.activeElement;
  statementOriginalTitle = document.title;
  const viewer = document.createElement('dialog');
  viewer.id = 'memberStatementViewer';
  viewer.className = 'statement-viewer';
  viewer.setAttribute('aria-labelledby', 'statementTitle');
  viewer.innerHTML = `<div class="statement-toolbar"><div><strong>Member statement</strong>
    <span>Choose “Save as PDF” in the print destination.</span></div><div class="statement-actions">
    <button class="btn primary" id="statementPrint" type="button">Print / Save as PDF</button>
    <button class="btn secondary" id="statementClose" type="button" autofocus>Close</button></div></div>${renderMemberStatement(s)}`;
  viewer.addEventListener('close', () => {
    document.body.classList.remove('statement-open');
    document.title = statementOriginalTitle;
    viewer.remove();
    statementReturnFocus?.focus();
  });
  viewer.querySelector('#statementClose').addEventListener('click', () => viewer.close());
  viewer.querySelector('#statementPrint').addEventListener('click', () => window.print());
  document.body.appendChild(viewer);
  document.body.classList.add('statement-open');
  document.title = `PoolPay - ${s.m.name} - Statement ${s.through}`;
  viewer.showModal();
}

// Do not leave a private statement visible after navigating away or signing out.
window.addEventListener('hashchange', () => document.getElementById('memberStatementViewer')?.close());
