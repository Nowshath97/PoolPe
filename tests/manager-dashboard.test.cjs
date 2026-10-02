const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

test('statement includes missing months, partial payments and stored due amounts without double counting transactions', () => {
  const { run } = setup();
  run(`month='2026-10'; db.payments=[{groupId:'g1',memberId:'m0',month:'2026-09',amountDue:24000,amountPaid:10000,status:'Partial',reference:'receipt-1'}];
    db.transactions=[{group_id:'g1',member_id:'m0',amount:10000}];`);
  const s = run(`buildMemberStatement('g1','m0')`);
  assert.equal(s.rows.length, 2);
  assert.equal(s.totals.due, 49000);
  assert.equal(s.totals.paid, 10000);
  assert.equal(s.totals.balance, 39000);
  assert.equal(s.rows[0].status, 'Partial');
  assert.equal(s.rows[1].status, 'Unpaid');
  assert.match(run(`renderMemberStatement(buildMemberStatement('g1','m0'))`), /receipt-1/);
});

test('statement respects ownership, membership, selected period and escaped text', () => {
  const { run } = setup();
  run(`db.groups.push({...db.groups[0],id:'private',managerId:'other'});
    db.members.push({id:'private-member',groupId:'private',name:'Private'});
    db.members[0].name='<img src=x onerror=alert(1)>';
    db.payments=[{groupId:'g1',memberId:'m0',month:'2026-10',amountDue:25000,amountPaid:25000}];`);
  assert.equal(run(`buildMemberStatement('private','private-member')`), null);
  assert.equal(run(`buildMemberStatement('g1','private-member')`), null);
  assert.equal(run(`buildMemberStatement('g1','m0').totals.paid`), 0);
  assert.match(run(`renderMemberStatement(buildMemberStatement('g1','m0'))`), /&lt;img/);
  run(`db.users[0].role='member'; db.members[0].userId='manager'`);
  assert.ok(run(`buildMemberStatement('g1','m0')`));
  assert.equal(run(`buildMemberStatement('g1','m1')`), null);
});

test('statement handles setup, completed groups, post-bid dues and unapplied excess payments', () => {
  const { run } = setup();
  run(`db.groups[0].status='inactive'`);
  assert.equal(run(`buildMemberStatement('g1','m0').rows.length`), 0);
  run(`db.groups[0].status='active'; db.groups[0].duration=2; month='2027-01';
    db.auctions=[{groupId:'g1',winnerMemberId:'m0',month:'2026-09',liftMonth:1,payoutAmount:480000}];
    db.payments=[{groupId:'g1',memberId:'m0',month:'2026-09',amountDue:25000,amountPaid:26000}];`);
  const s = run(`buildMemberStatement('g1','m0')`);
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[1].due, 27000);
  assert.equal(s.totals.credit, 1000);
  assert.equal(s.totals.balance, 27000);
  assert.equal(s.lift.payoutAmount, 480000);
});

test('report statement opens the document directly without changing the report route', () => {
  const { run, context } = setup();
  run(`navigateManager('reports'); openMemberStatement=(gid,mid)=>{window.statementArgs=[gid,mid]}; openPortalStatement('g1','m0')`);
  assert.equal(run('getManagerRoute().page'), 'reports');
  assert.deepEqual(Array.from(context.window.statementArgs), ['g1', 'm0']);
});

function setup() {
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', value: '', textContent: '', hidden: false, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, scrollIntoView() {}, focus() {} });
    return elements.get(id);
  };
  const context = vm.createContext({
    console: { log() {}, error() {}, warn() {} }, URL, setTimeout() {},
    document: { addEventListener() {}, getElementById: el, querySelectorAll: () => [] },
    window: { addEventListener() {}, scrollTo() {}, location: { hash: '#/group/g1/overview', href: 'http://localhost/dashboard.html', replace() {} } },
    localStorage: { removeItem() {} }, confirm: () => false
  });
  context.window.history = { pushState(_a,_b,url) { context.window.location.hash=url; }, replaceState(_a,_b,url) { context.window.location.hash=url; } };
  for (const file of ['app.js', 'manager-dashboard.js', 'member-statement.js', 'manager-pages.js', 'manager-router.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  const run = source => vm.runInContext(source, context);
  run(`
    month = '2026-09'; session = { user: { id: 'manager' } };
    currentAuthUser = () => ({ id: 'manager' });
    db.users = [{ id: 'manager', role: 'manager', name: 'Manager' }];
    db.groups = [{ id: 'g1', managerId: 'manager', name: 'Family Pool', value: 500000,
      monthly: 25000, postLiftMonthly: 27000, duration: 20, start: '2026-09-01', commission: 4, status: 'Active' }];
    activeGroup = 'g1';
    db.members = Array.from({ length: 20 }, (_, i) => ({ id: 'm' + i, groupId: 'g1', name: 'Member ' + i }));
  `);
  return { run, context, el };
}

test('portal dashboard is compact; group details live on separate routes', () => {
  const { run, el } = setup();
  run(`navigateManager('dashboard')`);
  let html = el('app').innerHTML;
  assert.match(html, /happening across your groups/);
  assert.doesNotMatch(html, /id="managerMemberRows"|id="memberSearch"|Delete Group|Recent Activity|managerGroupSelect/);
  assert.equal(run('activeGroup'), null);
  for (const tab of ['overview','members','payments','bids','settings']) {
    run(`navigateManager('group/g1/${tab}')`);
    html = el('app').innerHTML;
    assert.equal(run('activeGroup'), 'g1');
    assert.match(html, /aria-label="Group navigation"/);
    assert.equal(html.includes('id="managerMemberRows"'), tab === 'members');
    assert.equal(html.includes('onclick="deleteGroup()"'), tab === 'settings');
  }
  run(`navigateManager('group/private/members')`);
  assert.equal(run('activeGroup'), null);
  assert.equal(run('getManagerRoute().page'), 'groups');
});

test('every portal page and report renders with existing handler references', () => {
  const { run, el } = setup();
  const routes = ['dashboard','groups','reports','activity','settings', ...['overview','members','payments','bids','settings'].map(t => `group/g1/${t}`)];
  for (const route of routes) {
    run(`navigateManager('${route}')`);
    for (const match of el('app').innerHTML.matchAll(/(?:onclick|oninput|onchange|onsubmit)="([^"]+)"/g)) {
      for (const call of match[1].matchAll(/\b([A-Za-z_$][\w$]*)\(/g)) {
        if (['getElementById','preventDefault'].includes(call[1])) continue;
        assert.equal(run(`typeof ${call[1]}`), 'function', `${route}: ${call[1]}`);
      }
    }
  }
  run(`navigateManager('reports')`);
  for (const report of ['collections','dues','statements','bids','commission']) run(`updatePortalFilter('report','${report}')`);
  assert.match(el('app').innerHTML, /informational only/);
});

test('shared payment state, deep links and attention links stay consistent', () => {
  const { run, context, el } = setup();
  run(`navigateManager('group/g1/payments'); db.payments=[{groupId:'g1',memberId:'m0',month,amountPaid:25000,amountDue:25000,status:'Paid'}]; render()`);
  assert.equal(run('getManagerSummary(db.groups[0]).paidCount'), 1);
  run(`navigateManager('group/g1/members')`);
  assert.match(el('app').innerHTML, /data-paid="true"/);
  context.window.location.hash = '#/group/g1/bids';
  run('render()');
  assert.match(el('app').innerHTML, /Bid History/);
  run(`openGroupAttention('g1','pending')`);
  assert.equal(run('getManagerRoute().tab'), 'members');
  assert.equal(run('managerUI.filter'), 'pending');
  run(`db.groups=[]; render()`);
  assert.equal(run('getManagerRoute().page'), 'groups');
  assert.equal(run('activeGroup'), null);
});

test('activity filters and reports exclude unowned groups', () => {
  const { run, el } = setup();
  run(`db.groups.push({...db.groups[0],id:'private',managerId:'other',name:'Private'});
    db.transactions=[{group_id:'g1',member_id:'m0',amount:100,date:'2026-09-10'},{group_id:'private',member_id:'m0',amount:999,date:'2026-09-11'}];
    navigateManager('activity')`);
  assert.match(el('app').innerHTML, /paid/);
  assert.doesNotMatch(el('app').innerHTML, /Private|999/);
  run(`updatePortalFilter('activityType','bid')`);
  assert.match(el('app').innerHTML, /No activity recorded yet/);
  run(`navigateManager('reports')`);
  assert.doesNotMatch(el('app').innerHTML, /Private/);
});

test('setup groups never accrue dues even after placeholder start month', () => {
  const { run, el } = setup();
  run(`db.groups[0].status='inactive'; db.groups[0].start='2025-01-01'; render()`);
  assert.equal(run('getManagerSummary(db.groups[0]).pendingCount'), 0);
  assert.equal(run('getManagerSummary(db.groups[0]).previousDues'), 0);
  assert.equal(run('openObligations(db.groups[0], db.members[0]).length'), 0);
  assert.equal(run('getManagerSummary(db.groups[0]).rows[0].status'), 'Not started');
  assert.match(el('app').innerHTML, /Confirm start month/);
  assert.match(run(`auctionBlockReason(db.groups[0],month)`), /Confirm/);
  run(`db.groups[0].status='active'; db.members=db.members.slice(0,1)`);
  assert.equal(run('groupNeedsStart(db.groups[0])'), true);
  run(`db.payments=[{groupId:'g1',memberId:'m0',amountPaid:100}]`);
  assert.equal(run('groupNeedsStart(db.groups[0])'), false);
});

test('start confirmation checks member count and persists selected month', async () => {
  const { run, context, el } = setup();
  run(`db.groups[0].status='inactive'; runningMonth=()=> '2026-09'`);
  el('chitStartMonth').value = '2026-10';
  let count = 19, saved;
  context.supabaseClient = { from(table) {
    if (table === 'members') return { select: () => ({ eq: async () => ({ count }) }) };
    return { update(payload) { saved = payload; const chain = { eq: () => chain, select: () => chain,
      single: async () => ({ data: { id:'g1',manager_id:'manager',name:'Family Pool',monthly:25000,value:500000,duration:20,...payload } }) }; return chain; } };
  } };
  run('toast=()=>{}');
  await run('startManagerGroup()');
  assert.equal(saved, undefined);
  assert.match(el('groupStartError').textContent, /exactly 20/);
  count = 20;
  await run('startManagerGroup()');
  assert.equal(saved.start, '2026-10-01');
  assert.equal(saved.status, 'active');
  assert.equal(run('groupHasStarted(db.groups[0])'), false);
  run(`month='2026-10'`);
  assert.equal(run('getManagerSummary(db.groups[0]).expected'), 500000);
  assert.equal(run('getManagerSummary(db.groups[0]).previousDues'), 0);
});

test('delete requires confirmed row removal and preserves data on rejection', async () => {
  const { run, context } = setup();
  context.confirm = () => true;
  let result = { data: [], error: null };
  context.supabaseClient = { from: () => ({ delete() { const query = {
    eq: () => query, select: async () => result
  }; return query; } }) };
  run(`globalThis.messages=[]; toast=m=>messages.push(m)`);
  await run('deleteGroup()');
  assert.equal(run('db.groups.length'), 1);
  assert.equal(run('db.members.length'), 20);
  assert.match(run('messages[0]'), /Deletion was not confirmed/);
  result = { data: null, error: { code: '23503' } };
  await run('deleteGroup()');
  assert.equal(run('db.groups.length'), 1);
  assert.match(run('messages[1]'), /linked records/);
  run(`db.transactions=[{group_id:'g1'}, {group_id:'g2'}]`);
  result = { data: [{ id:'g1' }], error: null };
  await run('deleteGroup()');
  assert.equal(run('db.groups.length'), 0);
  assert.equal(run('db.members.length'), 0);
  assert.equal(run('db.transactions.length'), 1);
  assert.equal(run('messages.at(-1)'), 'Group deleted');
});

test('summary uses database amounts, partial payments and group isolation', () => {
  const { run } = setup();
  run(`db.payments = [
    {groupId:'g1',memberId:'m0',month,amountDue:25000,amountPaid:25000,status:'Paid'},
    {groupId:'g1',memberId:'m1',month,amountDue:25000,amountPaid:10000,status:'Partial'},
    {groupId:'other',memberId:'m2',month,amountDue:25000,amountPaid:25000,status:'Paid'}];`);
  assert.equal(run('getManagerSummary(db.groups[0]).expected'), 500000);
  assert.equal(run('getManagerSummary(db.groups[0]).collected'), 35000);
  assert.equal(run('getManagerSummary(db.groups[0]).pending'), 465000);
  assert.equal(run('getManagerSummary(db.groups[0]).paidCount'), 1);
  assert.equal(run('getManagerSummary(db.groups[0]).pendingCount'), 19);
  assert.ok(Math.abs(run('getManagerSummary(db.groups[0]).percent') - 7) < 1e-9);
});

test('empty groups, one group, multiple groups and authorized selection', () => {
  const { run, el } = setup();
  run('render()');
  assert.match(el('app').innerHTML, /Family Pool/);
  run(`db.groups.push({...db.groups[0],id:'g2',name:'Second Pool'}, {...db.groups[0],id:'private',managerId:'other',name:'Private Pool'}); selectManagerGroup('g2')`);
  assert.equal(run('activeGroup'), 'g2');
  assert.doesNotMatch(el('app').innerHTML, /Private Pool/);
  run(`selectManagerGroup('private')`);
  assert.equal(run('activeGroup'), 'g2');
  run(`navigateManager('group/g2/members')`);
  assert.match(el('app').innerHTML, /No members have been added yet/);
  run('db.groups=[]; render()');
  assert.match(el('app').innerHTML, /haven't created a PoolPay group yet/);
});

test('pending default, all paid default and completed/uncompleted bids', () => {
  const { run, el } = setup();
  run('render()');
  assert.equal(run('managerUI.filter'), 'pending');
  assert.match(el('app').innerHTML, /NEXT MONTHLY BID/);
  run(`db.payments = db.members.map(m => ({groupId:'g1',memberId:m.id,month,amountDue:25000,amountPaid:25000,status:'Paid'})); managerUI.key=null; render()`);
  assert.equal(run('managerUI.filter'), 'all');
  assert.equal(run('getManagerSummary(db.groups[0]).pendingCount'), 0);
  run(`db.auctions=[{id:'a1',groupId:'g1',month,winnerMemberId:'m0',liftMonth:1,payoutAmount:95000,date:'2026-09-20'}]; render()`);
  assert.match(el('app').innerHTML, /Bid completed/);
  assert.match(el('app').innerHTML, /95,000/);
  assert.equal(run('getManagerSummary(db.groups[0]).eligible'), 19);
});

test('future and completed groups do not invent monthly dues; post-bid rate applies', () => {
  const { run } = setup();
  run(`month='2026-08'`);
  assert.equal(run('getManagerSummary(db.groups[0]).expected'), 0);
  assert.equal(run('getManagerSummary(db.groups[0]).previousDues'), 0);
  run(`month='2026-10'; db.auctions=[{groupId:'g1',winnerMemberId:'m0',liftMonth:1,month:'2026-09'}]`);
  assert.equal(run('getManagerSummary(db.groups[0]).expected'), 502000);
  run(`month='2030-09'`);
  assert.equal(run('getManagerSummary(db.groups[0]).expected'), 0);
  assert.equal(run('duesFor(db.groups[0], db.members[1]).months'), 20);
});

test('search combines with filters, initial preview is 8, attention clears old search', () => {
  const { run, context, el } = setup();
  const rows = Array.from({length:20}, (_, i) => ({dataset:{memberName:`Member ${i}`, pending:String(i !== 0), paid:String(i === 0), dues:String(i === 2), bid:'false', eligible:'true'}, hidden:false}));
  context.window.location.hash = '#/group/g1/members';
  context.document.querySelectorAll = selector => selector.startsWith('#managerMemberRows') ? rows : [];
  run('render()');
  assert.equal(rows.filter(r => !r.hidden).length, 8);
  run(`filterMemberRows('Member 1')`);
  assert.equal(rows.filter(r => !r.hidden).length, 11);
  run(`setManagerFilter('paid')`);
  assert.equal(rows.filter(r => !r.hidden).length, 0);
  run(`setManagerFilter('dues', true)`);
  assert.equal(rows.filter(r => !r.hidden).length, 1);
  assert.equal(el('memberSearch').value, '');
  run(`setManagerFilter('all')`);
  assert.equal(rows.filter(r => !r.hidden).length, 20);
});

test('activity works without transactions and deduplicates allocated receipts', () => {
  const { run } = setup();
  run(`db.payments=[{groupId:'g1',memberId:'m0',month,amountPaid:1000,date:'2026-09-20'}]`);
  assert.equal(run('getManagerActivity(getManagerSummary(db.groups[0])).length'), 1);
  run(`db.transactions=[{group_id:'g1',member_id:'m0',amount:1000,date:'2026-09-20',allocations:[{month:'2026-09',amount:1000}]}]`);
  assert.equal(run('getManagerActivity(getManagerSummary(db.groups[0])).length'), 1);
});

test('rendered handler references exist; user-provided text is escaped', () => {
  const { run, el } = setup();
  run(`db.groups[0].name='<img src=x onerror=evil()> '; db.members[0].name='<script>evil()</script>'; render()`);
  const html = el('app').innerHTML;
  assert.match(html, /&lt;img/);
  // The new manager presentation must not introduce executable user strings.
  assert.doesNotMatch(html.slice(0, html.indexOf('<!-- GROUP MODAL -->')), /<script>evil/);
  for (const match of html.matchAll(/(?:onclick|oninput|onchange)="([^"]+)"/g)) {
    for (const call of match[1].matchAll(/\b([A-Za-z_$][\w$]*)\(/g)) {
      if (['getElementById'].includes(call[1])) continue;
      assert.equal(run(`typeof ${call[1]}`), 'function', `Missing handler: ${call[1]}`);
    }
  }
});

test('quick payment reuses payment handler; full member card remains inline', () => {
  const { run, el } = setup();
  el('quickPaymentMember').value = 'm1';
  run('globalThis.openedMember=null; openPayment=id=>{openedMember=id}; openManagerPayment()');
  assert.equal(run('openedMember'), 'm1');
  run(`modal('memberModal')`);
  assert.match(el('memberLimitNotice').textContent, /Only 20 members/);
  assert.equal(el('addMemberButton').disabled, true);
});

test('role routing and logout still use existing authentication', async () => {
  const { run, context } = setup();
  run(`globalThis.routed=false; memberView=()=>{routed=true}; db.users[0].role='member'; render()`);
  assert.equal(run('routed'), true);
  let signedOut = false;
  context.supabaseClient = { auth: { signOut: async () => { signedOut=true; return {}; } } };
  await run('logout()');
  assert.equal(signedOut, true);
  assert.equal(run('session'), null);
});

// Optional local visual fixture; never loaded by dashboard.html or deployed as data.
if (process.env.POOLPAY_PREVIEW) {
  const { run, el } = setup();
  run(`db.members.forEach((m,i)=>m.name=['S Nagaraju','G Venkat','P Veeraiah','S Upendar','Balu','C Mahesh','M Rakesh','Pragathi','Suresh','Samson'][i%10]+' '+(i+1));
    db.payments=db.members.slice(0,5).map(m=>({groupId:'g1',memberId:m.id,month,amountDue:25000,amountPaid:25000,status:'Paid',date:'2026-09-20'})); render()`);
  fs.writeFileSync(process.env.POOLPAY_PREVIEW, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="manager-dashboard.css"></head><body>${el('app').innerHTML}</body></html>`);
}
