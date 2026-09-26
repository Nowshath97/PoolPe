const signupForm = document.getElementById('signupForm');
const verifyForm = document.getElementById('verifyForm');
const method = document.getElementById('method');
const identity = document.getElementById('identity');
const message = document.getElementById('message');
let pendingPhone = null;

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
  message.textContent = 'Creating your account…';
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      ...(phone ? { phone: value } : { email: value }), password,
      options: {
        data: { name, signup_kind: 'manager' },
        emailRedirectTo: new URL('dashboard.html', window.location.href).href
      }
    });
    if (error) throw error;
    document.getElementById('password').value = '';
    document.getElementById('confirmPassword').value = '';
    if (data.session) return openDashboard();
    if (phone) {
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
  } finally { button.disabled = false; }
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
