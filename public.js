// Public navigation and an educational pool-size calculator. No account required.
const menuButton = document.querySelector('.menu-toggle');
const publicNav = document.getElementById('publicNav');
function closeMenu() {
  menuButton?.setAttribute('aria-expanded', 'false');
  publicNav?.classList.remove('is-open');
}
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  publicNav?.classList.toggle('is-open', open);
});
publicNav?.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
const members = document.getElementById('memberCount');
const contribution = document.getElementById('contribution');
const total = document.getElementById('poolTotal');
const term = document.getElementById('poolTerm');
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
function updateExample() {
  if (!members || !contribution || !total || !term) return;
  const count = Number(members.value);
  const amount = Number(contribution.value);
  total.textContent = rupees.format(count * amount);
  term.textContent = `${count} members × ${rupees.format(amount)} · ${count} monthly cycles in this example.`;
}
members?.addEventListener('change', updateExample);
contribution?.addEventListener('change', updateExample);
updateExample();
