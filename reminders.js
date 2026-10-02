/* Manual reminders: preview locally, then hand off to WhatsApp. No delivery claims. */
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
