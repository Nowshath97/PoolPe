/* Manual reminders: preview locally, then hand off to WhatsApp. No delivery claims. */
function pendingReminderMembers(groupId) {
  const g = db.groups.find(x => x.id === groupId && x.managerId === currentUser()?.id);
  if (!g || currentUser()?.role !== 'manager') return [];
  return getManagerSummary(g).rows.filter(r => r.started && r.balance + r.dues.amount > 0)
    .map(r => ({ member: r.m, total: r.balance + r.dues.amount, phone: reminderPhone(r.m.phone) }));
}

function pendingReminderButton(s) {
  return `<button class="reminder-button" data-group="${escapeHtml(s.g.id)}" onclick="openPendingReminders(this.dataset.group)" ${!s.rows.some(r => r.started && r.balance + r.dues.amount > 0) ? 'disabled' : ''}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>Remind pending</button>`;
}

function openPendingReminders(groupId) {
  const members = pendingReminderMembers(groupId);
  if (!members.length) return;
  document.getElementById('pendingRemindersDialog')?.close();
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.id = 'pendingRemindersDialog';
  dialog.className = 'reminder-dialog reminder-queue';
  dialog.setAttribute('aria-labelledby', 'pendingReminderTitle');
  const numbers = [...new Set(members.map(r => r.phone).filter(Boolean))].join('\n');
  dialog.innerHTML = `<div class="section-title"><h2 id="pendingReminderTitle">Pending payment reminders</h2><button class="btn secondary" id="closePendingReminders">Close</button></div>
    <p class="muted">${members.length} members with an outstanding balance through ${escapeHtml(month)}, including previous dues.</p>
    <p class="small muted">WhatsApp opens one recipient at a time. Review each message, send it in WhatsApp, then return here for the next member. Opening a reminder does not confirm it was sent.</p>
    <ul class="reminder-recipient-list">${members.map(r => `<li><div><strong>${escapeHtml(r.member.name)}</strong><small>${r.phone ? '+' + escapeHtml(r.phone) : 'Number missing or invalid - enter it in the preview'} · ${money(r.total)} outstanding</small></div><button class="reminder-button" data-member="${escapeHtml(r.member.id)}">Review reminder</button></li>`).join('')}</ul>
    <details class="reminder-export"><summary>Copy numbers for a WhatsApp broadcast</summary><p class="small muted">Create and select the broadcast recipients inside WhatsApp. This list cannot automatically populate a WhatsApp broadcast. Duplicate numbers are listed once; invalid or missing numbers are excluded.</p><label for="pendingReminderNumbers" class="small">Valid international phone numbers</label><textarea id="pendingReminderNumbers" rows="5" readonly>${escapeHtml(numbers)}</textarea><button class="btn secondary" id="copyPendingNumbers" ${numbers ? '' : 'disabled'}>Copy numbers</button><p class="small" role="status" id="pendingCopyStatus"></p></details>`;
  dialog.querySelector('#closePendingReminders').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { dialog.remove(); previousFocus?.focus(); });
  dialog.querySelectorAll('[data-member]').forEach(button => {
    button.addEventListener('click', () => {
      const reminder = buildMemberReminder(groupId, button.dataset.member);
      if (!reminder?.eligible) { button.textContent = 'No longer pending'; button.disabled = true; return; }
      openMemberReminder(groupId, button.dataset.member);
      button.textContent = 'Review again';
    });
  });
  dialog.querySelector('#copyPendingNumbers').addEventListener('click', async () => {
    const field = dialog.querySelector('#pendingReminderNumbers');
    const status = dialog.querySelector('#pendingCopyStatus');
    try { await navigator.clipboard.writeText(field.value); status.textContent = 'Numbers copied. Select recipients inside WhatsApp.'; }
    catch { field.focus(); field.select(); status.textContent = 'Numbers selected. Use your device’s Copy command.'; }
  });
  document.body.appendChild(dialog);
  dialog.showModal();
}

window.addEventListener('hashchange', () => document.getElementById('pendingRemindersDialog')?.close());

function reminderPhone(value) {
  const raw = String(value || '').trim();
  if (!/^[+\d\s().-]+$/.test(raw)) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!raw.startsWith('+') && !raw.startsWith('00') && /^[6-9]\d{9}$/.test(digits)) digits = '91' + digits;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}

function buildMemberReminder(groupId, memberId) {
  const g = db.groups.find(x => x.id === groupId && x.managerId === currentUser()?.id);
  if (!g || currentUser()?.role !== 'manager') return null;
  const row = getManagerSummary(g).rows.find(x => x.m.id === memberId);
  if (!row) return null;
  const total = row.balance + row.dues.amount;
  const amount = n => `INR ${Number(n).toLocaleString('en-IN')}`;
  const text = `Hello ${row.m.name},\n\nA payment reminder for ${g.name}, through ${month}:\n\nRemaining for ${month}: ${amount(row.balance)}\nPrevious dues: ${amount(row.dues.amount)}\nTotal outstanding: ${amount(total)}\n\nPlease arrange payment with your group manager. If you have already paid, please share the payment reference so we can update our records. Thank you.`;
  return { member: row.m, total, text, eligible: row.started && total > 0 };
}

function openMemberReminder(groupId, memberId) {
  const reminder = buildMemberReminder(groupId, memberId);
  if (!reminder) return;
  document.getElementById('reminderDialog')?.close();
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.id = 'reminderDialog';
  dialog.className = 'reminder-dialog';
  dialog.setAttribute('aria-labelledby', 'reminderTitle');
  dialog.innerHTML = `<div class="section-title"><h2 id="reminderTitle">Payment reminder</h2><button type="button" class="btn secondary" id="closeReminder">Close</button></div>
    <p class="muted">${escapeHtml(reminder.member.name)} · Records through ${escapeHtml(month)}</p>
    ${reminder.eligible ? `<div class="field"><label for="reminderPhone">WhatsApp number</label><input type="tel" id="reminderPhone" autocomplete="off" value="${escapeHtml(reminder.member.phone || '')}" placeholder="+91 98765 43210"><p class="small muted">Include country code. A 10-digit Indian mobile number uses +91. Edits here are for this reminder only.</p></div>
    <div class="field"><label for="reminderText">Message to review</label><textarea id="reminderText" rows="9" maxlength="2000">${escapeHtml(reminder.text)}</textarea></div>
    <p class="small muted">Opening WhatsApp shares this number and message with WhatsApp. Review the recipient, then tap Send there. PoolPay cannot confirm delivery.</p>
    <p id="reminderFeedback" class="small" role="status"></p><div class="toolbar"><a class="btn primary" id="reminderWhatsApp" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open WhatsApp</a><button class="btn secondary" type="button" id="copyReminder">Copy message</button></div>`
    : '<p>No outstanding payment is recorded for this period. No payment reminder is needed.</p>'}`;
  dialog.addEventListener('close', () => { dialog.remove(); previousFocus?.focus(); });
  dialog.querySelector('#closeReminder').addEventListener('click', () => dialog.close());
  document.body.appendChild(dialog);
  if (reminder.eligible) {
    const phone = dialog.querySelector('#reminderPhone');
    const message = dialog.querySelector('#reminderText');
    const link = dialog.querySelector('#reminderWhatsApp');
    const feedback = dialog.querySelector('#reminderFeedback');
    const update = () => {
      const number = reminderPhone(phone.value);
      const valid = !!number && !!message.value.trim();
      link.setAttribute('aria-disabled', String(!valid));
      if (valid) link.href = `https://wa.me/${number}?text=${encodeURIComponent(message.value.trim())}`;
      else link.removeAttribute('href');
      feedback.textContent = !number ? 'Enter a valid number with country code to open WhatsApp.' : !message.value.trim() ? 'Enter a message first.' : '';
      return valid;
    };
    phone.addEventListener('input', update);
    message.addEventListener('input', update);
    link.addEventListener('click', event => {
      // Recheck ownership and balance if the session or records changed during preview.
      if (!buildMemberReminder(groupId, memberId)?.eligible || !update()) event.preventDefault();
    });
    dialog.querySelector('#copyReminder').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(message.value); feedback.textContent = 'Message copied. Paste it into your preferred messaging app.'; }
      catch { message.focus(); message.select(); feedback.textContent = 'Copy is unavailable here. The message is selected; use your device’s Copy command.'; }
    });
    update();
  }
  dialog.showModal();
}

window.addEventListener('hashchange', () => document.getElementById('reminderDialog')?.close());
