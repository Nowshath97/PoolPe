# Public manager and member signup

## Enable in Supabase

1. Run `supabase/manager-signup.sql` in the same project configured in
   `supabase-config.js`. It creates profiles with the selected manager or member role for new
   registrations marked `signup_kind: manager` or `signup_kind: member`.
   Re-run this script if you installed the earlier manager-only version. Existing accounts are unchanged.
2. In Authentication settings, allow new user signups. Enable the Email
   provider and email confirmation. Configure SMTP for public email delivery.
3. To offer phone registration, enable the Phone provider, configure an SMS
   provider, and enable phone confirmation.
4. Set the Site URL to `https://poolpay.co.in` and allow the redirect URL
   `https://poolpay.co.in/dashboard.html`. Add the equivalent dashboard URL
   for any local or staging environment you use.
5. Deploy `signup.html`, `signup.js`, and the updated `index.html`, alongside
   the existing dashboard and Supabase configuration.

Passwords are managed only by Supabase Auth. Signup creates an Auth user and
the database trigger creates their profile with the chosen role. Member
registration does not automatically join a group; a manager must link their
membership to the Auth user ID. Verification is enforced by the
Auth provider before a session is issued. A manager can then log in using the
email or phone number they registered with and their password.

Existing group/member/payment policies still control access to pool data.
Registration does not grant access to other managers' groups. Do not add
unrestricted group policies to support signup.

## Verify on your project

- Register a new email account, follow its confirmation link, and check that
  the profile ID matches the Auth user ID and its role matches the selected account type.
- Register a phone account, enter the SMS code, then log out and log in with
  the same phone number (including country code) and password.
- Check incorrect passwords/codes are rejected, and a newly registered
  manager can create a group but cannot see another manager's groups.

If signup reports `Database error saving new user`, inspect the Auth/database
logs and existing triggers on `auth.users`. A pre-existing profile trigger
must also support phone accounts with a null email and must not conflict with
this trigger. Additional required profile columns must have defaults or be
included in the function. The live schema and existing triggers have not been
verified from this workspace.

References: https://supabase.com/docs/reference/javascript/auth-signup,
https://supabase.com/docs/reference/javascript/auth-verifyotp,
https://supabase.com/docs/guides/auth/managing-user-data.
