const KEY = "poolpe_v2_3_data";
const SESSION = "poolpe_v2_3_session";
const names = [
  "Nowshath",
  "S Nagaraju",
  "G Venkat",
  "P Veeraiah",
  "S Upendar",
  "Balu",
  "C Mahesh",
  "M Rakesh",
  "Venkanna",
  "Suresh",
  "Sachin",
  "Dhoni",
  "Sehwag",
  "Ganguly",
  "Raina",
  "Pandya",
  "Yuvraj Singh",
  "Bumrah",
  "Samson",
  "Anil",
];
const seed = {
  users: [
    {
      id: "u1",
      name: "Demo Manager",
      email: "manager@demo.com",
      password: "demo123",
      role: "manager",
    },
    {
      id: "u2",
      name: "Nowshath",
      email: "nowshath@demo.com",
      password: "demo123",
      role: "member",
    },
  ],
  groups: [
    {
      id: "g1",
      name: "Friends Pool 2026",
      managerId: "u1",
      value: 100000,
      monthly: 5000,
      postLiftMonthly: 6000,
      duration: 20,
      payoutStart: 95000,
      payoutIncrement: 1000,
      commission: 4,
      start: "2026-01",
      status: "Active",
    },
  ],
  members: [],
  payments: [],
  auctions: [],
};
names.forEach((name, i) =>
  seed.members.push({
    id: "m" + (i + 1),
    groupId: "g1",
    userId: i === 0 ? "u2" : undefined,
    name,
    email: i === 0 ? "nowshath@demo.com" : "",
    phone: "900000" + String(i + 1).padStart(4, "0"),
  }),
);
for (let mi = 1; mi <= 9; mi++) {
  seed.auctions.push({
    id: "a" + mi,
    groupId: "g1",
    month: "2026-" + String(mi).padStart(2, "0"),
    winnerMemberId: "m" + mi,
    bidAmount: 94000 + mi * 1000,
    payoutAmount: 94000 + mi * 1000,
    date: `2026-${String(mi).padStart(2, "0")}-05`,
    liftMonth: mi,
  });
}
for (let mi = 1; mi <= 9; mi++) {
  let mon = "2026-" + String(mi).padStart(2, "0");
  for (let i = 0; i < seed.members.length; i++) {
    let mem = seed.members[i],
      lift = seed.auctions.find((a) => a.winnerMemberId === mem.id)?.liftMonth,
      due = lift && mi > lift ? 6000 : 5000;
    let unpaid =
      (i === 5 && mi >= 7) ||
      (i === 6 && mi >= 8) ||
      (i === 7 && mi === 8) ||
      (i === 8 && mi === 9);
    let paid = !unpaid;
    seed.payments.push({
      id: "sp" + mi + mem.id,
      groupId: "g1",
      month: mon,
      memberId: mem.id,
      amountDue: due,
      amountPaid: paid ? due : 0,
      status: paid ? "Paid" : "Pending",
      date: paid ? `2026-${String(mi).padStart(2, "0")}-03` : "",
      mode: paid ? "UPI" : "",
      reference: "",
      notes: "",
    });
  }
}
let db = load(),
  session = JSON.parse(localStorage.getItem(SESSION) || "null"),
  activeGroup = "g1",
  month = "2026-09";
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || structuredClone(seed);
  } catch {
    return structuredClone(seed);
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
}
function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}
function uid(p) {
  return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function user() {
  return db.users.find((x) => x.id === session?.userId);
}
function toast(s) {
  let x = document.createElement("div");
  x.className = "toast";
  x.textContent = s;
  document.body.appendChild(x);
  setTimeout(() => x.remove(), 1800);
}
function render() {
  if (!session) return loginView();
  let u = user();
  if (!u) {
    logout();
    return;
  }
  u.role === "manager" ? managerView(u) : memberView(u);
}
function loginView() {
  document.getElementById("app").innerHTML =
    `<div class="login"><div class="loginbox"><div class="logo">PoolPe</div><h1>Welcome back</h1><p class="muted">Sign in to manage or view your pool group.</p><div class="demo"><b>Demo accounts</b><div class="field"><label>Email</label><input id="email"></div><div class="field"><label>Password</label><input id="password" type="password"></div><button class="btn primary" style="width:100%" onclick="login()">Sign in</button><p class="small muted">GitHub-only demo: authentication and data are stored in this browser.</p></div></div>`;

}
function login() {
  let u = db.users.find(
    (x) =>
      x.email.toLowerCase() === email.value.trim().toLowerCase() &&
      x.password === password.value,
  );
  if (!u) return toast("Invalid demo credentials");
  session = { userId: u.id };
  localStorage.setItem(SESSION, JSON.stringify(session));
  activeGroup =
    db.groups.find((g) => g.managerId === u.id)?.id ||
    db.members.find((m) => m.userId === u.id)?.groupId;
  render();
}
function logout() {
  localStorage.removeItem(SESSION);
  session = null;
  window.location.href = "poolpay_landing_page.html?login=1";
}
function shell(content, u) {
  return `<header class="top"><div class="logo">PoolPe</div><div class="navuser"><span class="muted">${u.name} · ${u.role}</span><button class="btn secondary" onclick="logout()">Logout</button></div></header><main class="wrap">${content}</main>`;
}
function monthIndex(g, ym) {
  let [sy, sm] = g.start.split("-").map(Number),
    [y, m] = ym.split("-").map(Number);
  return (y - sy) * 12 + (m - sm) + 1;
}
function scheduledPayout(g, n) {
  return (
    Number(g.payoutStart ?? g.value) +
    Math.max(0, n - 1) * Number(g.payoutIncrement || 0)
  );
}
function liftFor(gid, mid) {
  return db.auctions
    .filter((a) => a.groupId === gid && a.winnerMemberId === mid)
    .sort((a, b) => (a.liftMonth || 99) - (b.liftMonth || 99))[0];
}
function expectedLifetime(g, liftMonth) {
  if (!liftMonth) return g.duration * Number(g.monthly);
  return (
    liftMonth * Number(g.monthly) +
    (g.duration - liftMonth) * Number(g.postLiftMonthly ?? g.monthly)
  );
}
function memberStats(g, m) {
  let rec = db.payments.filter(
      (p) => p.groupId === g.id && p.memberId === m.id,
    ),
    paid = rec.filter((p) => p.status === "Paid"),
    lift = liftFor(g.id, m.id),
    total = paid.reduce((n, p) => n + Number(p.amountPaid || 0), 0),
    life = expectedLifetime(g, lift?.liftMonth),
    payout = Number(lift?.payoutAmount ?? lift?.bidAmount ?? 0),
    net = payout ? payout - life : 0;
  return { monthsPaid: paid.length, totalPaid: total, lift, life, payout, net };
}
function duesFor(g, m) {
  let current = monthIndex(g, month),
    unpaid = [];
  for (let n = 1; n < current; n++) {
    let ym = ymFor(g, n),
      p = db.payments.find(
        (x) => x.groupId === g.id && x.memberId === m.id && x.month === ym,
      ),
      due = Number(p?.amountDue ?? dueForMonth(g, m, n)),
      paid = Number(p?.amountPaid || 0),
      balance = Math.max(0, due - paid);
    if (balance > 0)
      unpaid.push({ n, ym, amount: balance, amountDue: due, amountPaid: paid });
  }
  return {
    months: unpaid.length,
    amount: unpaid.reduce((s, x) => s + x.amount, 0),
    items: unpaid,
  };
}
function openObligations(g, m) {
  let current = Math.min(monthIndex(g, month), g.duration),
    items = [];
  for (let n = 1; n <= current; n++) {
    let ym = ymFor(g, n),
      p = db.payments.find(
        (x) => x.groupId === g.id && x.memberId === m.id && x.month === ym,
      ),
      due = Number(p?.amountDue ?? dueForMonth(g, m, n)),
      paid = Number(p?.amountPaid || 0),
      balance = Math.max(0, due - paid);
    if (balance > 0) items.push({ n, ym, p, due, paid, balance });
  }
  return items;
}
function ymFor(g, n) {
  let [sy, sm] = g.start.split("-").map(Number),
    d = new Date(sy, sm - 1 + (n - 1), 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
function dueForMonth(g, m, n) {
  let lift = liftFor(g.id, m.id);
  return lift && n > lift.liftMonth
    ? Number(g.postLiftMonthly ?? g.monthly)
    : Number(g.monthly);
}
function managerView(u) {
  let groups = db.groups.filter((g) => g.managerId === u.id);
  if (!groups.length) activeGroup = null;
  else if (!groups.some((g) => g.id === activeGroup))
    activeGroup = groups[0].id;
  let g = groups.find((x) => x.id === activeGroup);
  let side = groups
    .map(
      (x) =>
        `<div class="group ${x.id === activeGroup ? "active" : ""}" onclick="activeGroup='${x.id}';render()"><b>${x.name}</b><span>${money(x.value)} · ${db.members.filter((m) => m.groupId === x.id).length} members</span></div>`,
    )
    .join("");
  document.getElementById("app").innerHTML = shell(
    `<div class="hero"><div><h1>Manager Dashboard</h1><p class="muted">Manage groups, dues, collections and monthly bids.</p></div><button class="btn primary" onclick="modal('groupModal')">+ Create Group</button></div><div class="layout"><aside class="card sidebar"><div class="section-title"><h2>My Groups</h2></div>${side || '<div class="muted small">No groups yet</div>'}</aside><section>${g ? groupPanel(g) : '<div class="card empty">Create your first pool group to begin.</div>'}</section></div>${modals()}`,
    u,
  );
}
function groupPanel(g) {
  let ms = db.members.filter((m) => m.groupId === g.id),
    current = Math.min(monthIndex(g, month), g.duration),
    ps = db.payments.filter((p) => p.groupId === g.id && p.month === month),
    a = db.auctions.find((a) => a.groupId === g.id && a.month === month),
    win = ms.find((m) => m.id === a?.winnerMemberId),
    bidDone = ms.filter((m) => liftFor(g.id, m.id)).length,
    yet = ms.length - bidDone,
    dueMembers = ms
      .map((m) => ({ m, d: duesFor(g, m) }))
      .filter((x) => x.d.months > 0),
    outstanding = dueMembers.reduce((s, x) => s + x.d.amount, 0);
  let rows = ms
    .filter((m) =>
      m.name.toLowerCase().includes((window.searchTerm || "").toLowerCase()),
    )
    .map((m) => {
      let p = ps.find((x) => x.memberId === m.id) || {
          status: "Pending",
          amountDue: dueForMonth(g, m, current),
          amountPaid: 0,
        },
        d = duesFor(g, m),
        lift = liftFor(g.id, m.id);
      return `<tr><td><button class="linkbtn" onclick="openHistory('${m.id}')"><b>${m.name}</b></button></td><td>${lift ? '<span class="pill paid">Bid Completed</span>' : '<span class="pill pending">Yet to Bid</span>'}</td><td>${d.months ? `<button class="linkbtn due-text" onclick="openDues('${m.id}')"><b>${d.months} month${d.months > 1 ? "s" : ""}</b><br><span class="small">${money(d.amount)}</span></button>` : '<span class="pill paid">No dues</span>'}</td><td>${money(p.amountDue)}</td><td>${Number(p.amountPaid || 0) > 0 ? money(p.amountPaid) : "—"}</td><td><span class="pill ${p.status === "Paid" ? "paid" : "pending"}">${p.status}</span></td><td><div class="toolbar"><button class="btn secondary" onclick="openPayment('${m.id}')">${p.status === "Paid" ? "Edit payment" : "Mark paid"}</button>${p.status === "Paid" ? `<button class="btn danger" onclick="markPending('${m.id}')">Mark pending</button>` : ""}</div></td></tr>`;
    })
    .join("");
  return `<div class="cards"><div class="card metric"><div class="label">Current month</div><div class="value">${current} of ${g.duration}</div><div class="sub">Running cycle</div></div><div class="card metric"><div class="label">Bid completed</div><div class="value">${bidDone}</div><div class="sub">${yet} yet to bid</div></div><div class="card metric"><div class="label">Members with dues</div><div class="value">${dueMembers.length}</div><div class="sub">${money(outstanding)} outstanding</div></div><div class="card metric"><div class="label">Manager commission</div><div class="value">${g.commission ?? 4}%</div><div class="sub">Informational only</div></div></div><div class="member-banner"><div class="small">This month's bid recipient</div><div class="big">${win?.name || "Not recorded"}</div><div>${a ? `Payout: ${money(a.payoutAmount ?? a.bidAmount)} · Month ${current}` : "Result pending"}</div></div><div class="card"><div class="section-title"><h2>${g.name}</h2><div class="toolbar"><input placeholder="Search members" oninput="window.searchTerm=this.value;render()"><button class="btn primary" onclick="modal('memberModal')">+ Add Member</button></div></div><div class="table-wrap"><table><thead><tr><th>Member</th><th>Bid status</th><th>Previous dues</th><th>This month due</th><th>Paid</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div></div><div class="auction"><div class="card"><div class="section-title"><h2>Monthly Bid</h2><button class="btn secondary" onclick="modal('auctionModal')">${a ? "Edit" : "Record"}</button></div><div class="big">${win?.name || "Not recorded"}</div>${a ? `<span class="pill winner">Payout: ${money(a.bidAmount)}</span>` : ""}</div><div class="card"><h2 style="font-size:18px">Group settings</h2><p><b>Monthly contribution:</b> ${money(g.monthly)}</p><p><b>Commission:</b> ${g.commission ?? 4}%</p><p><b>Started:</b> ${g.start}</p><p><b>Status:</b> ${g.status}</p><button class="btn danger" onclick="deleteGroup()">Delete group</button></div></div>`;
}
function memberView(u) {
  let memberships = db.members.filter((m) => m.userId === u.id),
    gids = memberships.map((m) => m.groupId),
    groups = db.groups.filter((g) => gids.includes(g.id));
  if (!groups.length) {
    document.getElementById("app").innerHTML = shell(
      '<div class="card empty">You are not linked to any pool group.</div>',
      u,
    );
    return;
  }
  if (!gids.includes(activeGroup)) activeGroup = gids[0];
  let g = groups.find((x) => x.id === activeGroup),
    me = memberships.find((m) => m.groupId === g.id),
    members = db.members.filter((m) => m.groupId === g.id),
    stats = memberStats(g, me),
    myDues = duesFor(g, me),
    current = Math.min(monthIndex(g, month), g.duration),
    a = db.auctions.find((a) => a.groupId === g.id && a.month === month),
    win = members.find((m) => m.id === a?.winnerMemberId),
    history = db.auctions.filter((x) => x.groupId === g.id),
    bidDone = members.filter((m) => liftFor(g.id, m.id)).length,
    yet = members.length - bidDone,
    netLabel = stats.net >= 0 ? "Net Gain" : "Net Cost",
    netClass = stats.net >= 0 ? "gain" : "cost";
  let rows = members
    .map((m) => {
      let lift = liftFor(g.id, m.id);
      return `<tr><td><b>${m.name}</b>${m.id === me.id ? ' <span class="pill">You</span>' : ""}</td><td>${lift ? '<span class="pill paid">Bid Completed</span>' : '<span class="pill pending">Yet to Bid</span>'}</td><td>${lift ? "Month " + lift.liftMonth : "—"}</td><td>${lift ? money(lift.payoutAmount ?? lift.bidAmount) : "—"}</td></tr>`;
    })
    .join("");
  let schedule = Array.from({ length: g.duration }, (_, i) => {
    let n = i + 1,
      lift = history.find((x) => x.liftMonth === n),
      wm = members.find((m) => m.id === lift?.winnerMemberId);
    return `<tr><td>Month ${n}</td><td>${money(g.monthly)}</td><td>${money(scheduledPayout(g, n))}</td><td>${money(g.postLiftMonthly ?? g.monthly)}</td><td>${wm ? wm.name : "—"}</td></tr>`;
  }).join("");
  document.getElementById("app").innerHTML = shell(
    `<div class="hero"><div><h1>My PoolPe Dashboard</h1><p class="muted">Read-only group view. Other members' payment information remains private.</p></div></div><div class="member-banner"><div class="small">This month's bid recipient</div><div class="big">${win?.name || "Not recorded"}</div><div>${a ? `Payout: ${money(a.payoutAmount ?? a.bidAmount)} · Month ${current} of ${g.duration}` : "Result pending"}</div></div><div class="cards"><div class="card metric"><div class="label">Current month</div><div class="value">${current} of ${g.duration}</div><div class="sub">Running cycle</div></div><div class="card metric"><div class="label">Bid completed</div><div class="value">${bidDone}</div><div class="sub">${yet} yet to bid</div></div><div class="card metric"><div class="label">My dues</div><div class="value">${myDues.months ? myDues.months + " month" + (myDues.months > 1 ? "s" : "") : "None"}</div><div class="sub">${myDues.months ? money(myDues.amount) + " outstanding" : "No previous dues"}</div></div><div class="card metric"><div class="label">Manager commission</div><div class="value">${g.commission ?? 4}%</div><div class="sub">Group information</div></div></div><div class="cards"><div class="card metric"><div class="label">My months paid</div><div class="value">${stats.monthsPaid}/${g.duration}</div><div class="sub">Private to you</div></div><div class="card metric"><div class="label">My total paid</div><div class="value">${money(stats.totalPaid)}</div><div class="sub">Private to you</div></div><div class="card metric"><div class="label">My payout</div><div class="value">${stats.lift ? money(stats.payout) : "Not bid yet"}</div><div class="sub">${stats.lift ? "Month " + stats.lift.liftMonth : "—"}</div></div><div class="card metric"><div class="label">${stats.lift ? netLabel : "Expected contribution"}</div><div class="value ${stats.lift ? netClass : ""}">${stats.lift ? money(Math.abs(stats.net)) : money(stats.life)}</div><div class="sub">Your private calculation</div></div></div><div class="card"><div class="section-title"><h2>Group Members</h2><span class="muted small">Payment & dues of other members are private</span></div><div class="table-wrap"><table><thead><tr><th>Member</th><th>Bid status</th><th>Bid month</th><th>Payout</th></tr></thead><tbody>${rows}</tbody></table></div></div><div class="card"><div class="section-title"><h2>Payout Schedule</h2><span class="muted small">Commission: ${g.commission ?? 4}%</span></div><div class="table-wrap"><table class="schedule-table"><thead><tr><th>Month</th><th>Before Bid</th><th>Net Payout</th><th>After Bid</th><th>Recipient</th></tr></thead><tbody>${schedule}</tbody></table></div></div>`,
    u,
  );
}
function modals() {
  return `<div id="groupModal" class="modal"><div class="dialog"><h3>Create pool group</h3><div class="field"><label>Group name</label><input id="gn"></div><div class="field"><label>Pool value</label><input id="gv" type="number"></div><div class="field"><label>Monthly contribution</label><input id="gm" type="number"></div><div class="field"><label>Duration</label><input id="gd" type="number" value="20"></div><div class="field"><label>Commission %</label><input id="gc" type="number" value="4" step="0.1"></div><div class="field"><label>Monthly premium after bid</label><input id="gpost" type="number" value="6000"></div><div class="field"><label>Month 1 net payout</label><input id="gpayout" type="number" value="95000"></div><div class="field"><label>Payout increase per month</label><input id="ginc" type="number" value="1000"></div><div class="actions"><button class="btn secondary" onclick="closeModal('groupModal')">Cancel</button><button class="btn primary" onclick="createGroup()">Create</button></div></div></div><div id="memberModal" class="modal"><div class="dialog"><h3>Add member</h3><div class="field"><label>Name</label><input id="mn"></div><div class="field"><label>Email</label><input id="me"></div><div class="field"><label>Phone</label><input id="mp"></div><div class="actions"><button class="btn secondary" onclick="closeModal('memberModal')">Cancel</button><button class="btn primary" onclick="addMember()">Add</button></div></div></div><div id="paymentModal" class="modal"><div class="dialog"><h3>Record Payment</h3><p class="muted small">The amount will clear the oldest outstanding months first.</p><div id="paymentMemberInfo" class="info-box"></div><input id="paymentMemberId" type="hidden"><div class="field"><label>Amount Paid *</label><input id="payAmount" type="number"></div><div class="field"><label>Payment Date *</label><input id="payDate" type="date"></div><div class="field"><label>Mode *</label><select id="payMode"><option value="">Select mode</option><option>UPI</option><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>Other</option></select></div><div class="field"><label>Reference</label><input id="payReference"></div><div class="field"><label>Notes</label><textarea id="payNotes" rows="3"></textarea></div><div class="actions"><button class="btn secondary" onclick="closeModal('paymentModal')">Cancel</button><button class="btn primary" onclick="savePayment()">Record Payment</button></div></div></div><div id="historyModal" class="modal"><div class="dialog wide"><div class="section-title"><h3 id="historyTitle">Payment History</h3><button class="btn secondary" onclick="closeModal('historyModal')">Close</button></div><div id="historyBody"></div></div></div><div id="duesModal" class="modal"><div class="dialog"><div class="section-title"><h3 id="duesTitle">Outstanding Dues</h3><button class="btn secondary" onclick="closeModal('duesModal')">Close</button></div><div id="duesBody"></div></div></div><div id="auctionModal" class="modal"><div class="dialog"><h3>Record monthly bid</h3><div class="field"><label>Recipient</label><select id="aw">${db.members
    .filter((m) => m.groupId === activeGroup && !liftFor(activeGroup, m.id))
    .map((m) => `<option value="${m.id}">${m.name}</option>`)
    .join(
      "",
    )}</select></div><div class="field"><label>Net payout / bid amount</label><input id="ab" type="number"></div><div class="actions"><button class="btn secondary" onclick="closeModal('auctionModal')">Cancel</button><button class="btn primary" onclick="recordAuction()">Save</button></div></div></div>`;
}
function modal(id) {
  document.getElementById(id)?.classList.add("show");
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove("show");
}
function createGroup() {
  if (!gn.value.trim() || !gv.value || !gm.value)
    return toast("Complete required fields");
  let g = {
    id: uid("g"),
    name: gn.value.trim(),
    managerId: user().id,
    value: +gv.value,
    monthly: +gm.value,
    duration: +gd.value || 20,
    commission: +gc.value || 4,
    postLiftMonthly: +gpost.value || +gm.value,
    payoutStart: +gpayout.value || +gv.value,
    payoutIncrement: +ginc.value || 0,
    start: month,
    status: "Active",
  };
  db.groups.push(g);
  activeGroup = g.id;
  save();
  render();
  toast("Group created");
}
function addMember() {
  if (!mn.value.trim()) return toast("Enter member name");
  let m = {
    id: uid("m"),
    groupId: activeGroup,
    name: mn.value.trim(),
    email: me.value.trim(),
    phone: mp.value.trim(),
  };
  let linked = db.users.find(
    (u) => u.email && u.email.toLowerCase() === m.email.toLowerCase(),
  );
  if (linked) m.userId = linked.id;
  db.members.push(m);
  save();
  render();
  toast("Member added");
}
function ensurePayment(mid) {
  let g = db.groups.find((g) => g.id === activeGroup),
    n = monthIndex(g, month),
    p = db.payments.find(
      (p) =>
        p.groupId === activeGroup && p.month === month && p.memberId === mid,
    );
  if (!p) {
    p = {
      id: uid("p"),
      groupId: activeGroup,
      month,
      memberId: mid,
      amountDue: dueForMonth(
        g,
        db.members.find((m) => m.id === mid),
        n,
      ),
      amountPaid: 0,
      status: "Pending",
      date: "",
      mode: "",
      reference: "",
      notes: "",
    };
    db.payments.push(p);
  }
  return p;
}
function openPayment(mid) {
  let g = db.groups.find((g) => g.id === activeGroup),
    m = db.members.find((m) => m.id === mid),
    p = ensurePayment(mid),
    items = openObligations(g, m),
    total = items.reduce((s, x) => s + x.balance, 0),
    prev = duesFor(g, m);
  paymentMemberId.value = mid;
  paymentMemberInfo.innerHTML = `<b>${m.name}</b><div class="small muted">Previous dues: ${prev.months} month(s) · Total currently outstanding: ${money(total)}</div><div class="small muted">Payments are automatically applied to the oldest unpaid month first.</div>`;
  payAmount.value = total || p.amountDue;
  payDate.value = new Date().toISOString().slice(0, 10);
  payMode.value = "";
  payReference.value = "";
  payNotes.value = "";
  modal("paymentModal");
}
function savePayment() {
  let mid = paymentMemberId.value,
    g = db.groups.find((g) => g.id === activeGroup),
    m = db.members.find((m) => m.id === mid),
    amt = Number(payAmount.value);
  if (!amt || amt <= 0) return toast("Enter a valid amount");
  if (!payDate.value || !payMode.value)
    return toast("Select payment date and mode");
  let items = openObligations(g, m),
    total = items.reduce((s, x) => s + x.balance, 0);
  if (!total) return toast("No outstanding amount to allocate");
  if (amt > total)
    return toast("Amount exceeds total outstanding " + money(total));
  let remaining = amt,
    alloc = [];
  for (let item of items) {
    if (remaining <= 0) break;
    let p = item.p;
    if (!p) {
      p = {
        id: uid("p"),
        groupId: g.id,
        month: item.ym,
        memberId: mid,
        amountDue: item.due,
        amountPaid: 0,
        status: "Pending",
        date: "",
        mode: "",
        reference: "",
        notes: "",
      };
      db.payments.push(p);
    }
    let applied = Math.min(remaining, item.balance);
    p.amountPaid = Number(p.amountPaid || 0) + applied;
    p.status = p.amountPaid >= Number(p.amountDue) ? "Paid" : "Pending";
    p.date = payDate.value;
    p.mode = payMode.value;
    p.reference = payReference.value.trim();
    p.notes = payNotes.value.trim();
    alloc.push({ month: item.ym, amount: applied });
    remaining -= applied;
  }
  db.transactions.push({
    id: uid("t"),
    groupId: g.id,
    memberId: mid,
    amount: amt,
    date: payDate.value,
    mode: payMode.value,
    reference: payReference.value.trim(),
    notes: payNotes.value.trim(),
    allocations: alloc,
  });
  save();
  closeModal("paymentModal");
  render();
  let left = openObligations(g, m),
    prev = duesFor(g, m);
  toast(
    prev.months
      ? `Payment recorded · ${prev.months} month${prev.months > 1 ? "s" : ""} due remaining`
      : "Payment recorded · no previous dues",
  );
}
function markPending(mid) {
  if (!confirm("Mark this payment as pending?")) return;
  let p = ensurePayment(mid);
  Object.assign(p, {
    status: "Pending",
    amountPaid: 0,
    date: "",
    mode: "",
    reference: "",
    notes: "",
  });
  save();
  render();
  toast("Marked pending");
}
function openDues(mid) {
  let g = db.groups.find((g) => g.id === activeGroup),
    m = db.members.find((m) => m.id === mid),
    d = duesFor(g, m);
  duesTitle.textContent = m.name + " · Outstanding Dues";
  duesBody.innerHTML = d.months
    ? `<div class="info-box"><b>${d.months} month${d.months > 1 ? "s" : ""} due · ${money(d.amount)}</b></div><table><thead><tr><th>Month</th><th>Amount</th></tr></thead><tbody>${d.items.map((x) => `<tr><td>${x.ym}</td><td>${money(x.amount)}</td></tr>`).join("")}</tbody></table>`
    : '<div class="empty">No previous dues.</div>';
  modal("duesModal");
}
function openHistory(mid) {
  let m = db.members.find((m) => m.id === mid),
    g = db.groups.find((g) => g.id === m.groupId),
    records = db.payments
      .filter((p) => p.groupId === m.groupId && p.memberId === mid)
      .sort((a, b) => b.month.localeCompare(a.month));
  historyTitle.textContent = m.name + " · Payment History";
  historyBody.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Month</th><th>Due</th><th>Paid</th><th>Status</th><th>Date</th><th>Mode</th></tr></thead><tbody>${records.map((p) => `<tr><td>${p.month}</td><td>${money(p.amountDue)}</td><td>${Number(p.amountPaid || 0) > 0 ? money(p.amountPaid) : "—"}</td><td><span class="pill ${p.status === "Paid" ? "paid" : "pending"}">${p.status}</span></td><td>${p.date || "—"}</td><td>${p.mode || "—"}</td></tr>`).join("")}</tbody></table></div>`;
  modal("historyModal");
}
function recordAuction() {
  if (!aw.value || !ab.value) return toast("Select recipient and enter payout");
  let g = db.groups.find((g) => g.id === activeGroup),
    a = db.auctions.find((a) => a.groupId === activeGroup && a.month === month),
    li = monthIndex(g, month);
  if (a) {
    a.winnerMemberId = aw.value;
    a.bidAmount = +ab.value;
    a.payoutAmount = +ab.value;
    a.liftMonth = li;
  } else
    db.auctions.push({
      id: uid("a"),
      groupId: activeGroup,
      month,
      winnerMemberId: aw.value,
      bidAmount: +ab.value,
      payoutAmount: +ab.value,
      liftMonth: li,
      date: new Date().toISOString().slice(0, 10),
    });
  save();
  render();
  toast("Bid saved");
}
function deleteGroup() {
  if (!confirm("Delete this group and local demo data?")) return;
  db.groups = db.groups.filter((g) => g.id !== activeGroup);
  db.members = db.members.filter((m) => m.groupId !== activeGroup);
  db.payments = db.payments.filter((p) => p.groupId !== activeGroup);
  db.auctions = db.auctions.filter((a) => a.groupId !== activeGroup);
  save();
  activeGroup = null;
  render();
}
window.resetDemo = function () {
  localStorage.removeItem(KEY);
  localStorage.removeItem(SESSION);
  location.reload();
};
render();
