/* Hash routes preserve static hosting and the existing authenticated entry point. */
const managerTabs = ['overview', 'members', 'payments', 'bids', 'settings'];
const managerPages = ['dashboard', 'groups', 'reports', 'activity', 'settings'];

function getManagerRoute() {
  const path = (window.location.hash || '#/dashboard').replace(/^#\/?/, '').split('/');
  if (path[0] === 'group' && path.length === 3 && managerTabs.includes(path[2])) {
    try { return { page: 'group', groupId: decodeURIComponent(path[1]), tab: path[2] }; }
    catch { return { page: 'groups' }; }
  }
  return { page: managerPages.includes(path[0]) ? path[0] : 'dashboard' };
}

function navigateManager(path) {
  if (currentUser()?.role !== 'manager') return;
  window.history.pushState(null, '', `#/${path}`);
  render();
  document.getElementById('managerPageTitle')?.focus();
  window.scrollTo(0, 0);
}

function selectManagerGroup(id) {
  if (!db.groups.some(g => g.id === id && g.managerId === currentUser()?.id)) return;
  navigateManager(`group/${encodeURIComponent(id)}/overview`);
}

function toggleManagerDrawer(open) {
  const drawer = document.getElementById('managerSidebar');
  const overlay = document.getElementById('managerNavOverlay');
  const button = document.getElementById('managerMenuButton');
  if (!drawer || !overlay || !button) return;
  const expanded = open ?? button.getAttribute('aria-expanded') !== 'true';
  drawer.classList.toggle('drawer-open', expanded);
  overlay.hidden = !expanded;
  button.setAttribute('aria-expanded', String(expanded));
  if (expanded) drawer.querySelector('a')?.focus();
  else button.focus();
}

function managerView(u) {
  const groups = db.groups.filter(g => g.managerId === u.id);
  let route = getManagerRoute();
  const g = route.page === 'group' ? groups.find(g => g.id === route.groupId) : null;
  // A deleted or unauthorized deep link must never select another group's data.
  if (route.page === 'group' && !g) {
    route = { page: 'groups' };
    window.history.replaceState(null, '', '#/groups');
  }
  activeGroup = g?.id || null;
  const summary = g ? getManagerSummary(g) : null;
  const key = `${u.id}/${activeGroup}/${month}`;
  if (managerUI.key !== key) {
    Object.assign(managerUI, { key, filter: summary?.pendingCount ? 'pending' : 'all', search: '', expanded: false, explicitFilter: false });
  } else if (!managerUI.explicitFilter && !managerUI.search) {
    managerUI.filter = summary?.pendingCount ? 'pending' : 'all';
  }
  const pages = {
    dashboard: () => renderManagerHome(u, groups),
    groups: () => renderGroupsPage(groups),
    group: () => renderGroupWorkspace(summary, route.tab),
    reports: () => renderReportsPage(groups),
    activity: () => renderActivityPage(groups),
    settings: () => renderAccountSettings(u)
  };
  document.getElementById('app').innerHTML = renderManagerShell(u, route, pages[route.page]())
    + modals() + (summary ? renderManagerDialogs(summary) : '');
  if (route.page === 'group' && route.tab === 'members') filterMemberRows(managerUI.search);
  document.title = `PoolPay | ${route.page === 'group' ? g.name + ' · ' + route.tab : route.page}`;
}

function renderManagerShell(u, route, content) {
  const selected = route.page === 'group' ? 'groups' : route.page;
  const links = [['dashboard', 'Dashboard', '▦'], ['groups', 'Groups', '◫'], ['reports', 'Reports', '▤'], ['activity', 'Activity', '◷']];
  const link = ([page, label, icon]) => `<a href="#/${page}" ${selected === page ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span>${label}</a>`;
  return `<div class="manager-portal"><header class="manager-mobile-header"><img src="logo.jpg" alt="PoolPay"><button id="managerMenuButton" class="btn secondary" aria-controls="managerSidebar" aria-expanded="false" onclick="toggleManagerDrawer()" aria-label="Open navigation">☰</button></header>
    <button id="managerNavOverlay" class="nav-overlay" aria-label="Close navigation" onclick="toggleManagerDrawer(false)" hidden></button>
    <aside id="managerSidebar" class="manager-sidebar"><a href="#/dashboard" class="portal-logo"><img src="logo.jpg" alt="PoolPay"></a>
      <nav aria-label="Manager navigation">${links.map(link).join('')}</nav>
      <div class="sidebar-bottom"><div class="manager-profile"><span class="manager-avatar">${escapeHtml((u.name || 'M').slice(0, 1))}</span><div><b>${escapeHtml(u.name)}</b><small>Manager</small></div></div>
      <nav aria-label="Account navigation">${link(['settings', 'Settings', '⚙'])}<button onclick="logout()"><span aria-hidden="true">↪</span>Logout</button></nav></div></aside>
    <main class="manager-main"><div class="manager-dashboard">${content}</div></main></div>`;
}

// Registered once at script load, never during rendering.
window.addEventListener('hashchange', () => {
  if (session && currentUser()?.role === 'manager') render();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('managerMenuButton')?.getAttribute('aria-expanded') === 'true') toggleManagerDrawer(false);
});
