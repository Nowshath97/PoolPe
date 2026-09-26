const signupForm = document.getElementById('signupForm');
const verifyForm = document.getElementById('verifyForm');
const method = document.getElementById('method');
const identity = document.getElementById('identity');
const message = document.getElementById('message');
let pendingPhone = null;
let signupRole = null;

function chooseRole(role) {
  if (!['manager', 'member'].includes(role)) return;
  signupRole = role;
  document.getElementById('roleChoices').hidden = true;
  document.getElementById('changeRole').hidden = false;
  signupForm.hidden = false;
  document.getElementById('signupTitle').textContent = `Sign up as ${role}`;
  document.getElementById('signupDescription').textContent = role === 'manager'
    ? 'Create your account to manage pool groups and contributions.'
    : 'Create your account, then ask your manager to link you to your group.';
  message.textContent = '';
  document.getElementById('name').focus();
}
document.getElementById('chooseManager').addEventListener('click', () => chooseRole('manager'));
document.getElementById('chooseMember').addEventListener('click', () => chooseRole('member'));
document.getElementById('changeRole').addEventListener('click', () => {
  signupRole = null;
  signupForm.hidden = true;
  document.getElementById('roleChoices').hidden = false;
  document.getElementById('changeRole').hidden = true;
  document.getElementById('signupTitle').textContent = 'Create your account';
  document.getElementById('signupDescription').textContent = 'Choose how you want to use PoolPay.';
  message.textContent = '';
});

function openDashboard() {
  window.location.replace(new URL('dashboard.html', window.location.href).href);
}

method.addEventListener('change', () => {
  const phone = method.value === 'phone';
  identity.type = phone ? 'tel' : 'email';
  identity.autocomplete = phone ? 'tel' : 'email';
  identity.placeholder = phone ? '+919876543210' : 'you@example.com';
  document.getElementById('identityLabel').textContent = phone
    ? 'Phone number including country code' : 'Email address';
});

signupForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!['manager', 'member'].includes(signupRole)) {
    message.textContent = 'Choose manager or member first.';
    return;
  }
  const name = document.getElementById('name').value.trim();
  const password = document.getElementById('password').value;
  const confirmation = document.getElementById('confirmPassword').value;
  if (!name || password.length < 8 || password !== confirmation) {
    message.textContent = 'Enter your name and matching passwords of at least 8 characters.';
    return;
  }
  const phone = method.value === 'phone';
  const value = phone ? identity.value.replace(/[\s()-]/g, '') : identity.value.trim().toLowerCase();
  if (phone && !/^\+[1-9]\d{7,14}$/.test(value)) {
    message.textContent = 'Enter a phone number with country code, such as +919876543210.';
    return;
  }
  const button = signupForm.querySelector('button');
  button.disabled = true;
  document.getElementById('changeRole').disabled = true;
  message.textContent = 'Creating your account…';
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      ...(phone ? { phone: value } : { email: value }), password,
      options: {
        data: { name, signup_kind: signupRole },
        emailRedirectTo: new URL('dashboard.html', window.location.href).href
      }
    });
    if (error) throw error;
    document.getElementById('password').value = '';
    document.getElementById('confirmPassword').value = '';
    if (data.session) return openDashboard();
    if (phone) {
      document.getElementById('changeRole').hidden = true;
      pendingPhone = value;
      signupForm.hidden = true;
      verifyForm.hidden = false;
      message.textContent = 'Enter the verification code sent to your phone.';
      document.getElementById('code').focus();
    } else {
      message.textContent = 'Check your email for a confirmation link. If you already have an account, log in instead.';
    }
  } catch (error) {
    message.textContent = error.message || 'Unable to create account. Please try again.';
  } finally {
    button.disabled = false;
    document.getElementById('changeRole').disabled = false;
  }
});

verifyForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = verifyForm.querySelector('button');
  button.disabled = true;
  try {
    const { data, error } = await supabaseClient.auth.verifyOtp({
      phone: pendingPhone, token: document.getElementById('code').value.trim(), type: 'sms'
    });
    if (error) throw error;
    if (!data.session) throw new Error('Verification did not create a session. Please log in.');
    openDashboard();
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});

document.getElementById('resend').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const { error } = await supabaseClient.auth.resend({ type: 'sms', phone: pendingPhone });
    if (error) throw error;
    message.textContent = 'A new verification code has been sent.';
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});
