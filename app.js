
/* =========================================================
   PoolPay - Supabase powered application
   ========================================================= */

/*
  IMPORTANT:
  1. Replace the two values below with your Supabase project values.
  2. Use ONLY the Supabase Publishable/Anon key here.
  3. NEVER put the service_role/secret key in this file.
*/


const names = [
  "Nowshath",
  "S Nagaraju",
  "G Venkat",
  "P Veeraiah",
  "S Upendar",
  "Balu",
  "C Mahesh",
  "M Rakesh",
  "Phalguna",
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

let db = {
  users: [],
  groups: [],
  members: [],
  payments: [],
  auctions: [],
  transactions: [],
};

let session = null;
let activeGroup = null;
function runningMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit'
  }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
}
let month = runningMonth();
let savingAuction = false;
let savingMember = false;
const MAX_GROUP_MEMBERS = 20;
const GROUP_MEMBER_LIMIT_MESSAGE = "A group can have a maximum of 20 members.";

/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", init);

async function init() {

  console.log("=== POOLPAY DASHBOARD START ===");

  try {

    // STEP 1 - Check authentication
    const {
      data,
      error: sessionError
    } = await supabaseClient.auth.getSession();



    if (sessionError) {
      console.error(
        "STEP 1 FAILED - Session error:",
        sessionError
      );

      showDashboardError(
        "Unable to verify login session."
      );

      return;
    }

    if (!data.session) {

      console.error(
        "STEP 1 FAILED - No Supabase session"
      );

      redirectToLogin();

      return;
    }

    session = data.session;

    console.log(
      "STEP 1 PASSED - Logged in:",
      session.user.email,
      session.user.id
    );


    // STEP 2 - Load database data
    console.log(
      "STEP 2 - Loading PoolPay data..."
    );

    await loadUserData();

    console.log(
      "STEP 2 PASSED - Database loaded"
    );

    console.log(
      "Profiles:",
      db.users
    );

    console.log(
      "Groups:",
      db.groups
    );

    console.log(
      "Members:",
      db.members
    );


    // STEP 3 - Find PoolPay profile
    const user = currentUser();

    console.log(
      "STEP 3 - Current PoolPay user:",
      user
    );


    if (!user) {

      console.error(
        "STEP 3 FAILED - No matching profile found"
      );

      showDashboardError(
        "Your login succeeded, but your PoolPay profile could not be loaded. Check the browser console for details."
      );

      return;
    }


    // STEP 4 - Determine initial group
    activeGroup =
      db.groups.find(
        g =>
          g.managerId === user.id
      )?.id ||

      db.members.find(
        m =>
          m.userId === user.id
      )?.groupId ||

      null;


    console.log(
      "STEP 4 - Active group:",
      activeGroup
    );


    // STEP 5 - Render
    console.log(
      "STEP 5 - Rendering dashboard"
    );

    render();

    console.log(
      "=== POOLPAY DASHBOARD READY ==="
    );

  }

  catch (error) {

    console.error(
      "POOLPAY INITIALIZATION FAILED:",
      error
    );

    showDashboardError(
      "PoolPay login succeeded, but the dashboard could not load. " +
      (error.message || "Please try again.")
    );

  }

}
/* =========================================================
   LOGIN REDIRECTION
   ========================================================= */

function redirectToLogin() {

  window.location.replace(
    new URL(
      "index.html?login=1",
      window.location.href
    ).href
  );

}


/* =========================================================
   LOGOUT
   ========================================================= */

function redirectToHome() {
  window.location.replace(new URL("index.html", window.location.href).href);
}

async function logout() {

  try {

    const {
      error
    } =
      await supabaseClient.auth
        .signOut();


    if (error) {

      console.error(
        "Supabase logout error:",
        error
      );

    }

  }

  catch (error) {

    console.error(
      "Logout error:",
      error
    );

  }


  session = null;


  /*
    Remove old PoolPay login value
    if it exists from previous versions.
  */

  localStorage.removeItem(
    "poolpe_supabase_user"
  );


  redirectToHome();

}


function currentAuthUser() {

  return session?.user || null;

}
/* =========================================================
   LOAD DATA FROM SUPABASE
   ========================================================= */

async function loadUserData() {

  const authUser = currentAuthUser();

  if (!authUser) {

    db = {
      users: [],
      groups: [],
      members: [],
      payments: [],
      auctions: [],
      transactions: [],
    };

    return;
  }

  try {

    // RLS determines which profiles this account can read. Keep them for
    // linking existing accounts when a manager adds a member.
    const { data: profiles, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*");

    if (profileError) {
      throw new Error("Unable to load profiles: " + profileError.message);
    }
    const profile = (profiles || []).find(p => p.id === authUser.id);
    if (!profile) {
      throw new Error(
        "Your account profile could not be read. Check that profiles.id matches " +
        "your login user ID (" + authUser.id + ") and that the profiles SELECT policy allows you to read it."
      );
    }

    // The database profile is the source of truth for dashboard selection.
    const detectedRole = String(profile.role || "").trim().toLowerCase();
    if (!["manager", "member"].includes(detectedRole)) {
      throw new Error("Your profile role must be manager or member. Please correct profiles.role for your account.");
    }


    /*
      =========================================================
      LOAD GROUPS
      =========================================================
    */

    const {
      data: groups,
      error: groupsError
    } = await supabaseClient
      .from("groups")
      .select("*");


    if (groupsError) {

      throw new Error("Unable to load groups: " + groupsError.message);

    }


    /*
      =========================================================
      LOAD MEMBERS
      =========================================================
    */

    const {
      data: members,
      error: membersError
    } = await supabaseClient
      .from("members")
      .select("*");


    if (membersError) {

      throw new Error("Unable to load members: " + membersError.message);

    }


    /*
      =========================================================
      LOAD PAYMENTS
      =========================================================
    */

    const {
      data: payments,
      error: paymentsError
    } = await supabaseClient
      .from("payments")
      .select("*");


    if (paymentsError) {

      throw new Error("Unable to load payments: " + paymentsError.message);

    }


    /*
      =========================================================
      LOAD AUCTIONS
      =========================================================
    */

    const {
      data: auctions,
      error: auctionsError
    } = await supabaseClient
      .from("auctions")
      .select("*");


    if (auctionsError) {

      throw new Error("Unable to load auctions: " + auctionsError.message);

    }


    /*
      =========================================================
      LOAD TRANSACTIONS
      =========================================================
    */

    const {
      data: transactions,
      error: transactionsError
    } = await supabaseClient
      .from("transactions")
      .select("*");


    if (transactionsError) {

      console.warn(
        "Transactions table could not be loaded:",
        transactionsError
      );

    }


    const rawGroups = groups || [];
    const rawMembers = members || [];
    const metadata = authUser.user_metadata || {};

    /*
      Determine display name.
    */

    const detectedName =

      profile?.name ||

      metadata.name ||

      metadata.full_name ||

      (
        authUser.email
          ? authUser.email.split("@")[0]
          : "PoolPay User"
      );


    /*
      =========================================================
      BUILD APPLICATION DATABASE
      =========================================================
    */

    db = {

      users: [
        ...(profiles || []).filter(p => p.id !== authUser.id),

        {

          id: authUser.id,

          name: detectedName,

          email:
            profile?.email ||
            authUser.email ||
            "",

          role: detectedRole,

        }

      ],


      groups:
        rawGroups.map(mapGroup),


      members:
        rawMembers.map(mapMember),


      payments:
        (payments || []).map(mapPayment),


      auctions:
        (auctions || []).map(mapAuction),


      transactions:
        transactions || [],

    };


    console.log(
      "Loaded PoolPay user:",
      db.users
    );


  }

  catch (error) {

    console.error(
      "Data loading error:",
      error
    );

    throw error;

  }

}

/* =========================================================
   SUPABASE -> APPLICATION OBJECT MAPPING
   ========================================================= */

function mapGroup(g) {
  return {
    id: g.id,
    name: g.name,
    managerId: g.manager_id,
    value: Number(g.value || 0),
    monthly: Number(g.monthly || 0),
    postLiftMonthly: Number(
      g.post_lift_monthly ?? g.monthly ?? 0
    ),
    duration: Number(g.duration || 20),
    payoutStart: Number(
      g.payout_start ?? g.value ?? 0
    ),
    payoutIncrement: Number(g.payout_increment || 0),
    commission: Number(g.commission ?? 4),
    start: g.start,
    status: g.status || "Active",
  };
}

function mapMember(m) {
  return {
    id: m.id,
    groupId: m.group_id,
    userId: m.user_id,
    name: m.name,
    email: m.email || "",
    phone: m.phone || "",
    createdAt: m.created_at || "",
  };
}

function mapPayment(p) {
  return {
    id: p.id,
    groupId: p.group_id,
    // Keep month keys consistent for dues calculations and payment lookup.
    month: String(p.month).slice(0, 7),
    memberId: p.member_id,
    amountDue: Number(p.amount_due || 0),
    amountPaid: Number(p.amount_paid || 0),
    status: ({ pending: "Pending", partial: "Partial", paid: "Paid" })[
      String(p.status || "pending").toLowerCase()
    ] || "Pending",
    date: p.date || "",
    mode: p.mode || "",
    reference: p.reference || "",
    notes: p.notes || "",
  };
}

function mapAuction(a) {
  return {
    id: a.id,
    groupId: a.group_id,
    month: String(a.month).slice(0, 7),
    winnerMemberId: a.winner_member_id,
    bidAmount: Number(a.bid_amount || 0),
    payoutAmount: Number(
      a.payout_amount ?? a.bid_amount ?? 0
    ),
    date: a.date || "",
    liftMonth: Number(a.lift_month || 0),
  };
}

/* =========================================================
   USER
   ========================================================= */

function currentUser() {
  return db.users.find(
    (x) => x.id === currentAuthUser()?.id
  );
}

/* =========================================================
   UI HELPERS
   ========================================================= */

function render() {

  const u = currentUser();

  console.log("================================");
  console.log("CURRENT AUTH USER:", currentAuthUser());
  console.log("CURRENT APP USER:", u);
  console.log("CURRENT USER ROLE:", u?.role);

  console.log("================================");


  if (!session || !u) {

    redirectToLogin();

    return;

  }


  if (
    String(u.role).toLowerCase() === "manager"
  ) {

    console.log(
      ">>> MANAGER DETECTED - OPENING MANAGER DASHBOARD"
    );

    managerView(u);

  } else {

    console.log(
      ">>> MEMBER DETECTED - OPENING MEMBER DASHBOARD"
    );

    memberView(u);

  }

}

function renderLoginError(message) {
  console.error(message);
}

/*
=========================================================
SAFE DASHBOARD ERROR HANDLER
=========================================================
*/

function showDashboardError(message) {

  console.error(
    "PoolPay Dashboard Error:",
    message
  );


  const app =
    document.getElementById("app");


  if (!app) {

    console.error(
      "PoolPay #app element was not found."
    );

    return;

  }


  /*
    Escape HTML so error messages cannot accidentally
    break the page.
  */

  const safeMessage =
    escapeHtml(message);


  app.innerHTML = `

    <div
      class="card empty"
      style="
        max-width:720px;
        margin:60px auto;
        padding:30px;
        text-align:center;
      "
    >

      <h2>
        PoolPay could not load
      </h2>


      <p class="muted">
        ${safeMessage}
      </p>


      <div
        style="
          margin-top:20px;
          display:flex;
          gap:10px;
          justify-content:center;
        "
      >

        <button
          class="btn primary"
          onclick="location.reload()"
        >
          Retry
        </button>


        <button
          class="btn secondary"
          onclick="logout()"
        >
          Logout
        </button>

      </div>

    </div>

  `;

}


/*
=========================================================
HTML ESCAPE HELPER
=========================================================
*/

function escapeHtml(value) {

  return String(value ?? "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");

}

function toast(message) {
  const x = document.createElement("div");

  x.className = "toast";
  x.textContent = message;

  document.body.appendChild(x);

  setTimeout(() => x.remove(), 1800);
}

function money(n) {
  return (
    "₹" +
    Number(n || 0).toLocaleString("en-IN")
  );
}

function uid(prefix) {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 6)
  );
}

/* =========================================================
   GROUP / MONTH HELPERS
   ========================================================= */

function groupHasFinancialActivity(g) {
  return db.payments.some(p => p.groupId === g.id && p.amountPaid > 0)
    || db.auctions.some(a => a.groupId === g.id)
    || db.transactions.some(t => t.group_id === g.id);
}

function groupNeedsStart(g) {
  if (String(g.status).toLowerCase() === 'inactive') return true;
  // Legacy groups were created active immediately. Treat unfilled groups with
  // no financial activity as setup, without changing an operating group's dates.
  return String(g.status).toLowerCase() === 'active'
    && db.members.filter(m => m.groupId === g.id).length < MAX_GROUP_MEMBERS
    && !groupHasFinancialActivity(g);
}

function groupHasStarted(g, ym = month) {
  return !!g && !groupNeedsStart(g) && !!g.start && monthIndex(g, ym) >= 1;
}

function monthIndex(g, ym) {
  let [sy, sm] = g.start.split("-").map(Number);
  let [y, m] = ym.split("-").map(Number);

  return (
    (y - sy) * 12 +
    (m - sm) +
    1
  );
}

function ymFor(g, n) {
  let [sy, sm] = g.start
    .split("-")
    .map(Number);

  const d = new Date(
    sy,
    sm - 1 + (n - 1),
    1
  );

  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0")
  );
}

function scheduledPayout(g, n) {
  return (
    Number(g.payoutStart ?? g.value) +
    Math.max(0, n - 1) *
      Number(g.payoutIncrement || 0)
  );
}

function liftFor(gid, mid) {
  return db.auctions
    .filter(
      (a) =>
        a.groupId === gid &&
        a.winnerMemberId === mid
    )
    .sort(
      (a, b) =>
        (a.liftMonth || 99) -
        (b.liftMonth || 99)
    )[0];
}

function expectedLifetime(g, liftMonth) {
  if (!liftMonth) {
    return (
      g.duration *
      Number(g.monthly)
    );
  }

  return (
    liftMonth *
      Number(g.monthly) +
    (g.duration - liftMonth) *
      Number(
        g.postLiftMonthly ??
          g.monthly
      )
  );
}

function dueForMonth(g, m, n) {
  const lift = liftFor(g.id, m.id);

  return lift && n > lift.liftMonth
    ? Number(
        g.postLiftMonthly ??
          g.monthly
      )
    : Number(g.monthly);
}

// Payments are monthly balance records; transactions are receipt history, never
// an additional source of paid totals. Historical amount_due is a snapshot.
function paymentForMonth(g, m, ym, excludeId = null) {
  const records = db.payments.filter(p => p.groupId === g.id && p.memberId === m.id && p.month === ym);
  const n = monthIndex(g, ym);
  const due = groupHasStarted(g, ym) && n <= g.duration
    ? Number(records[0]?.amountDue ?? dueForMonth(g, m, n)) : 0;
  const paid = records.filter(p => p.id !== excludeId || excludeId === null)
    .reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
  const balance = Math.max(due - paid, 0);
  return { records, due, paid, balance,
    status: paid > 0 ? (paid >= due ? 'Paid' : 'Partial') : due > 0 ? 'Pending' : 'Not due' };
}

/* =========================================================
   MEMBER CALCULATIONS
   ========================================================= */

function memberStats(g, m) {
  const rec = db.payments.filter(
    (p) =>
      p.groupId === g.id &&
      p.memberId === m.id
  );

  const paid = [...new Set(rec.map(p => p.month))].filter(ym => paymentForMonth(g, m, ym).status === 'Paid');

  const lift = liftFor(
    g.id,
    m.id
  );

  const total = rec.reduce(
    (n, p) =>
      n + Number(p.amountPaid || 0),
    0
  );

  const life = expectedLifetime(
    g,
    lift?.liftMonth
  );

  const payout = Number(
    lift?.payoutAmount ??
      lift?.bidAmount ??
      0
  );

  const net = payout
    ? payout - life
    : 0;

  return {
    monthsPaid: paid.length,
    totalPaid: total,
    lift,
    life,
    payout,
    net,
  };
}

function duesFor(g, m) {
  if (!groupHasStarted(g)) return { months: 0, amount: 0, items: [] };
  const current = monthIndex(
    g,
    month
  );

  const unpaid = [];

  for (
    let n = 1;
    n < current && n <= g.duration;
    n++
  ) {
    const ym = ymFor(g, n);

    const { due, paid, balance } = paymentForMonth(g, m, ym);

    if (balance > 0) {
      unpaid.push({
        n,
        ym,
        amount: balance,
        amountDue: due,
        amountPaid: paid,
      });
    }
  }

  return {
    months: unpaid.length,
    amount: unpaid.reduce(
      (s, x) => s + x.amount,
      0
    ),
    items: unpaid,
  };
}

function openObligations(g, m) {
  if (!groupHasStarted(g)) return [];
  const current = Math.min(
    monthIndex(g, month),
    g.duration
  );

  const items = [];

  for (
    let n = 1;
    n <= current;
    n++
  ) {
    const ym = ymFor(g, n);

    const { records, due, paid, balance } = paymentForMonth(g, m, ym);
    const p = records[0];

    if (balance > 0) {
      items.push({
        n,
        ym,
        p,
        due,
        paid,
        balance,
      });
    }
  }

  return items;
}

/* =========================================================
   MANAGER DASHBOARD
   ========================================================= */

// Manager presentation lives in manager-dashboard.js.

/* =========================================================
   MEMBER DASHBOARD
   ========================================================= */

function memberView(u) {
  const memberships =
    db.members.filter(
      (m) =>
        m.userId === u.id
    );

  const gids =
    memberships.map(
      (m) => m.groupId
    );

  const groups =
    db.groups.filter(
      (g) =>
        gids.includes(g.id)
    );

  if (!groups.length) {
    document.getElementById(
      "app"
    ).innerHTML = shell(
      `
        <div class="card empty">
          You are not linked to any pool group.
        </div>
      `,
      u
    );

    return;
  }

  if (!gids.includes(activeGroup)) {
    activeGroup = gids[0];
  }

  const g = groups.find(
    (x) =>
      x.id === activeGroup
  );

  const me =
    memberships.find(
      (m) =>
        m.groupId === g.id
    );

  const members =
    db.members.filter(
      (m) =>
        m.groupId === g.id
    );

  const stats =
    memberStats(g, me);

  if (!groupHasStarted(g)) {
    document.getElementById('app').innerHTML = shell(`
      <div class="hero"><h1>My Group</h1><div class="field"><label for="waitingGroup">Group</label>
      <select id="waitingGroup" onchange="activeGroup=this.value;render()">${groups.map(x => `<option value="${escapeHtml(x.id)}" ${x.id === g.id ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('')}</select></div></div>
      <section class="card"><h2>${escapeHtml(g.name)}</h2><span class="pill neutral">Not started</span>
      <p>${groupNeedsStart(g) ? 'The manager is gathering members and will confirm the chit start month.' : `The chit starts in ${escapeHtml(g.start.slice(0, 7))}.`}</p>
      <p class="muted">Payments and dues begin only from the confirmed start month.</p></section>`, u);
    return;
  }

  const myDues =
    duesFor(g, me);

  const current =
    Math.min(
      monthIndex(g, month),
      g.duration
    );

  const a =
    db.auctions.find(
      (a) =>
        a.groupId === g.id &&
        a.month === month
    );

  const win =
    members.find(
      (m) =>
        m.id ===
        a?.winnerMemberId
    );

  const history =
    db.auctions.filter(
      (x) =>
        x.groupId === g.id
    );

  const bidDone =
    members.filter(
      (m) =>
        liftFor(
          g.id,
          m.id
        )
    ).length;

  const yet =
    members.length -
    bidDone;

  const netLabel =
    stats.net >= 0
      ? "Net Gain"
      : "Net Cost";

  const netClass =
    stats.net >= 0
      ? "gain"
      : "cost";

  const rows =
    members
      .map((m) => {
        const lift =
          liftFor(
            g.id,
            m.id
          );

        return `
          <tr>

            <td>
              <b>${escapeHtml(m.name)}</b>

              ${
                m.id === me.id
                  ? `
                    <span class="pill">
                      You
                    </span>
                  `
                  : ""
              }

            </td>

            <td>
              ${
                lift
                  ? `
                    <span class="pill paid">
                      Bid Completed
                    </span>
                  `
                  : `
                    <span class="pill pending">
                      Yet to Bid
                    </span>
                  `
              }
            </td>

            <td>
              ${
                lift
                  ? "Month " +
                    lift.liftMonth
                  : "—"
              }
            </td>

            <td>
              ${
                lift
                  ? money(
                      lift.payoutAmount ??
                        lift.bidAmount
                    )
                  : "—"
              }
            </td>

          </tr>
        `;
      })
      .join("");

  const schedule =
    Array.from(
      {
        length: g.duration,
      },
      (_, i) => {
        const n = i + 1;

        const lift =
          history.find(
            (x) =>
              x.liftMonth === n
          );

        const wm =
          members.find(
            (m) =>
              m.id ===
              lift?.winnerMemberId
          );

        return `
          <tr>

            <td>
              Month ${n}
            </td>

            <td>
              ${money(g.monthly)}
            </td>

            <td>
              ${money(
                scheduledPayout(
                  g,
                  n
                )
              )}
            </td>

            <td>
              ${money(
                g.postLiftMonthly ??
                  g.monthly
              )}
            </td>

            <td>
              ${wm ? wm.name : "—"}
            </td>

          </tr>
        `;
      }
    ).join("");

  document.getElementById(
    "app"
  ).innerHTML = shell(
    `
      <div class="hero">

        <div>
          <h1>
            My PoolPe Dashboard
          </h1>

          <p class="muted">
            Read-only group view.
            Other members' payment
            information remains private.
          </p>
        </div>

      </div>

      <div class="member-banner">

        <div class="small">
          This month's bid recipient
        </div>

        <div class="big">
          ${win?.name || "Not recorded"}
        </div>

        <div>
          ${
            a
              ? `
                Payout:
                ${money(
                  a.payoutAmount ??
                    a.bidAmount
                )}
                · Month ${current}
                of ${g.duration}
              `
              : "Result pending"
          }
        </div>

      </div>

      <div class="cards">

        <div class="card metric">
          <div class="label">
            Current month
          </div>

          <div class="value">
            ${current} of ${g.duration}
          </div>

          <div class="sub">
            Running cycle
          </div>
        </div>

        <div class="card metric">
          <div class="label">
            Bid completed
          </div>

          <div class="value">
            ${bidDone}
          </div>

          <div class="sub">
            ${yet} yet to bid
          </div>
        </div>

        <div class="card metric">
          <div class="label">
            My dues
          </div>

          <div class="value">
            ${
              myDues.months
                ? myDues.months +
                  " month" +
                  (myDues.months > 1
                    ? "s"
                    : "")
                : "None"
            }
          </div>

          <div class="sub">
            ${
              myDues.months
                ? money(
                    myDues.amount
                  ) +
                  " outstanding"
                : "No previous dues"
            }
          </div>
        </div>

        <div class="card metric">
          <div class="label">
            Manager commission
          </div>

          <div class="value">
            ${g.commission ?? 4}%
          </div>

          <div class="sub">
            Group information
          </div>
        </div>

      </div>

      <div class="cards">

        <div class="card metric">
          <div class="label">
            My months paid
          </div>

          <div class="value">
            ${stats.monthsPaid}/${g.duration}
          </div>

          <div class="sub">
            Private to you
          </div>
        </div>

        <div class="card metric">
          <div class="label">
            My total paid
          </div>

          <div class="value">
            ${money(
              stats.totalPaid
            )}
          </div>

          <div class="sub">
            Private to you
          </div>
        </div>

        <div class="card metric">
          <div class="label">
            My payout
          </div>

          <div class="value">
            ${
              stats.lift
                ? money(
                    stats.payout
                  )
                : "Not bid yet"
            }
          </div>

          <div class="sub">
            ${
              stats.lift
                ? "Month " +
                  stats.lift.liftMonth
                : "—"
            }
          </div>
        </div>

        <div class="card metric">

          <div class="label">
            ${
              stats.lift
                ? netLabel
                : "Expected contribution"
            }
          </div>

          <div
            class="value ${
              stats.lift
                ? netClass
                : ""
            }">

            ${
              stats.lift
                ? money(
                    Math.abs(
                      stats.net
                    )
                  )
                : money(
                    stats.life
                  )
            }

          </div>

          <div class="sub">
            Your private calculation
          </div>

        </div>

      </div>

      <div class="card">

        <div class="section-title">

          <h2>
            Group Members
          </h2>

          <span class="muted small">
            Payment & dues of other
            members are private
          </span>

        </div>

        <div class="table-wrap">

          <table>

            <thead>
              <tr>
                <th>Member</th>
                <th>Bid status</th>
                <th>Bid month</th>
                <th>Payout</th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>

          </table>

        </div>

      </div>

      <div class="card">

        <div class="section-title">

          <h2>
            Payout Schedule
          </h2>

          <span class="muted small">
            Commission:
            ${g.commission ?? 4}%
          </span>

        </div>

        <div class="table-wrap">

          <table class="schedule-table">

            <thead>
              <tr>
                <th>Month</th>
                <th>Before Bid</th>
                <th>Net Payout</th>
                <th>After Bid</th>
                <th>Recipient</th>
              </tr>
            </thead>

            <tbody>
              ${schedule}
            </tbody>

          </table>

        </div>

      </div>
    `,
    u
  );
}

/* =========================================================
   COMMON SHELL
   ========================================================= */

function shell(content, u) {
  return `
    <header class="top">

      <div class="logo">
        PoolPe
      </div>

      <div class="navuser">

        <span class="muted">
          ${escapeHtml(u.name)} · ${escapeHtml(u.role)}
        </span>

        <button
          class="btn secondary"
          onclick="logout()">
          Logout
        </button>

      </div>

    </header>

    <main class="wrap">
      ${content}
    </main>
  `;
}

/* =========================================================
   MODALS
   ========================================================= */

function modals() {
  const auctionMembers =
    db.members
      .filter(
        (m) =>
          m.groupId ===
            activeGroup &&
          !liftFor(
            activeGroup,
            m.id
          )
      )
      .map(
        (m) =>
          `<option value="${escapeHtml(m.id)}">
             ${escapeHtml(m.name)}
           </option>`
      )
      .join("");

  return `

    <!-- GROUP MODAL -->

    <div
      id="groupModal"
      class="modal">

      <div class="dialog">

        <h3>
          Create pool group
        </h3>

        <div class="field">
          <label>Group name</label>
          <input id="gn">
        </div>

        <div class="field">
          <label>Pool value</label>
          <input
            id="gv"
            type="number">
        </div>

        <div class="field">
          <label>
            Monthly contribution
          </label>
          <input
            id="gm"
            type="number">
        </div>

        <div class="field">
          <label>Duration</label>
          <input
            id="gd"
            type="number"
            value="20">
        </div>

        <div class="field">
          <label>
            Commission %
          </label>
          <input
            id="gc"
            type="number"
            value="4"
            step="0.1">
        </div>

        <div class="field">
          <label>
            Monthly premium after bid
          </label>
          <input
            id="gpost"
            type="number"
            value="6000">
        </div>

        <div class="field">
          <label>
            Month 1 net payout
          </label>
          <input
            id="gpayout"
            type="number"
            value="95000">
        </div>

        <div class="field">
          <label>
            Payout increase per month
          </label>
          <input
            id="ginc"
            type="number"
            value="1000">
        </div>

        <div class="actions">

          <button
            class="btn secondary"
            onclick="
              closeModal('groupModal')
            ">
            Cancel
          </button>

          <button
            class="btn primary"
            onclick="createGroup()">
            Create
          </button>

        </div>

      </div>
    </div>


    <!-- MEMBER MODAL -->

    <div
      id="memberModal"
      class="modal">

      <div class="dialog">

        <h3>
          Add member
        </h3>

        <p id="memberLimitNotice" class="info-box" role="status" aria-live="polite">
          Only 20 members are allowed per group.
        </p>

        <div class="field">
          <label>Name</label>
          <input id="mn">
        </div>

        <div class="field">
          <label>Email</label>
          <input id="me">
        </div>

        <div class="field">
          <label>Phone</label>
          <input id="mp">
        </div>

        <div class="actions">

          <button
            class="btn secondary"
            onclick="
              closeModal('memberModal')
            ">
            Cancel
          </button>

          <button
            id="addMemberButton"
            class="btn primary"
            onclick="addMember()">
            Add
          </button>

        </div>

      </div>
    </div>


    <!-- PAYMENT MODAL -->

    <div
      id="paymentModal"
      class="modal">

      <div class="dialog">

        <h3>
          Record Payment
        </h3>

        <p class="muted small">
          Choose the contribution month this payment belongs to.
        </p>

        <div
          id="paymentMemberInfo"
          class="info-box">
        </div>

        <input
          id="paymentMemberId"
          type="hidden">

        <div class="field"><label for="payRecord">Payment record</label>
          <select id="payRecord" onchange="selectPaymentRecord()"></select>
          <p class="small muted">Existing records may contain several receipts. Editing corrects the total for that record.</p></div>
        <div class="field"><label for="payMonth">Contribution Month *</label>
          <select id="payMonth" required onchange="updatePaymentContext()"></select></div>
        <div id="payMonthContext" class="info-box" aria-live="polite"></div>
        <div class="field">
          <label>
            Amount Paid *
          </label>

          <input
            id="payAmount"
            type="number">
        </div>

        <div class="field">
          <label>
            Payment Date *
          </label>

          <input
            id="payDate"
            type="date"
            aria-describedby="payDateHelp">
          <p id="payDateHelp" class="small muted">
            Select the date the payment was received. Past dates are allowed.
          </p>
        </div>

        <div class="field">
          <label>
            Mode *
          </label>

          <select id="payMode">

            <option value="">
              Select mode
            </option>

            <option>UPI</option>
            <option>Cash</option>
            <option>Bank Transfer</option>
            <option>Cheque</option>
            <option>Other</option>

          </select>
        </div>

        <div class="field">
          <label>
            Reference
          </label>

          <input
            id="payReference">
        </div>

        <div class="field">
          <label>
            Notes
          </label>

          <textarea
            id="payNotes"
            rows="3">
          </textarea>
        </div>

        <div class="actions">

          <button
            class="btn secondary"
            onclick="
              closeModal('paymentModal')
            ">
            Cancel
          </button>

          <button
            class="btn primary"
            onclick="savePayment()">
            Record Payment
          </button>

        </div>

      </div>
    </div>


    <!-- HISTORY MODAL -->

    <div
      id="historyModal"
      class="modal">

      <div class="dialog wide">

        <div class="section-title">

          <h3 id="historyTitle">
            Payment History
          </h3>

          <button
            class="btn secondary"
            onclick="
              closeModal('historyModal')
            ">
            Close
          </button>

        </div>

        <div id="historyBody">
        </div>

      </div>
    </div>


    <!-- DUES MODAL -->

    <div
      id="duesModal"
      class="modal">

      <div class="dialog">

        <div class="section-title">

          <h3 id="duesTitle">
            Outstanding Dues
          </h3>

          <button
            class="btn secondary"
            onclick="
              closeModal('duesModal')
            ">
            Close
          </button>

        </div>

        <div id="duesBody">
        </div>

      </div>
    </div>


    <!-- AUCTION MODAL -->

    <div
      id="auctionModal"
      class="modal">

      <div class="dialog">

        <h3>
          Record monthly bid
        </h3>

        <div class="field">

          <label>
            Recipient
          </label>

          <select id="aw">
            ${auctionMembers}
          </select>

        </div>

        <div class="field">

          <label>
            Net payout / bid amount
          </label>

          <input
            id="ab"
            type="number">

        </div>

        <div class="actions">

          <button
            class="btn secondary"
            onclick="
              closeModal('auctionModal')
            ">
            Cancel
          </button>

          <button
            class="btn primary"
            onclick="recordAuction()">
            Save
          </button>

        </div>

      </div>
    </div>

  `;
}

/* =========================================================
   MODAL HELPERS
   ========================================================= */

function modal(id) {
  if (id === "memberModal") {
    showMemberLimit(groupIsFull(activeGroup));
  }
  document
    .getElementById(id)
    ?.classList.add("show");
}

function closeModal(id) {
  document
    .getElementById(id)
    ?.classList.remove("show");
}

/* =========================================================
   CREATE GROUP
   ========================================================= */

async function createGroup() {
  const u = currentUser();

  if (!u || u.role !== "manager") {
    return toast(
      "Only managers can create groups"
    );
  }

  if (
    !gn.value.trim() ||
    !gv.value ||
    !gm.value
  ) {
    return toast(
      "Complete required fields"
    );
  }

  const payload = {
    name: gn.value.trim(),
    manager_id: u.id,
    value: Number(gv.value),
    monthly: Number(gm.value),
    duration:
      Number(gd.value) || 20,
    commission:
      Number(gc.value) || 4,
    post_lift_monthly:
      Number(gpost.value) ||
      Number(gm.value),
    payout_start:
      Number(gpayout.value) ||
      Number(gv.value),
    payout_increment:
      Number(ginc.value) || 0,
    // Keep a valid DATE for existing schemas; inactive means no start confirmed.
    start: `${month}-01`,
    status: "inactive",
  };

  try {
    const { data, error } =
      await supabaseClient
        .from("groups")
        .insert(payload)
        .select()
        .single();

    if (error) throw error;

    const g = mapGroup(data);

    db.groups.push(g);

    activeGroup = g.id;

    closeModal("groupModal");

    selectManagerGroup(g.id);

    toast("Group created");
  } catch (err) {
    console.error(err);
    toast(
      err.message ||
        "Unable to create group"
    );
  }
}

/* =========================================================
   ADD MEMBER
   ========================================================= */

function groupIsFull(groupId) {
  return db.members.filter(m => m.groupId === groupId).length >= MAX_GROUP_MEMBERS;
}

function showMemberLimit(full = true) {
  const notice = document.getElementById("memberLimitNotice");
  if (notice) {
    notice.textContent = full
      ? "This group is full. Only 20 members are allowed per group."
      : "Only 20 members are allowed per group.";
    notice.classList.toggle("pending", full);
  }
  const button = document.getElementById("addMemberButton");
  if (button) button.disabled = full;
}

async function addMember() {
  if (savingMember) return;
  const u = currentUser();

  if (!u || u.role !== "manager") {
    return toast(
      "Only managers can add members"
    );
  }

  if (groupIsFull(activeGroup)) {
    return showMemberLimit();
  }

  if (!mn.value.trim()) {
    return toast(
      "Enter member name"
    );
  }

  const payload = {
    group_id: activeGroup,
    name: mn.value.trim(),
    email: me.value.trim(),
    phone: mp.value.trim(),
  };

  /*
    If the member has already created
    a PoolPay account, link their auth
    profile automatically.
  */

  const linked = db.users.find(
    (x) =>
      x.email &&
      mEmailMatches(
        x.email,
        payload.email
      )
  );

  if (linked) {
    payload.user_id =
      linked.id;
  }

  savingMember = true;
  try {
    const { count, error: countError } = await supabaseClient
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", payload.group_id);

    if (countError) throw countError;
    if (count >= MAX_GROUP_MEMBERS) {
      return showMemberLimit();
    }

    // Preserve setup for legacy unfilled groups before the final member joins.
    const group = db.groups.find(g => g.id === payload.group_id);
    if (group && groupNeedsStart(group) && String(group.status).toLowerCase() === 'active') {
      const { data: updatedGroup, error: setupError } = await supabaseClient.from('groups')
        .update({ status: 'inactive' }).eq('id', group.id).eq('manager_id', u.id).select().single();
      if (setupError) throw setupError;
      Object.assign(group, mapGroup(updatedGroup));
    }

    const { data, error } =
      await supabaseClient
        .from("members")
        .insert(payload)
        .select()
        .single();

    if (error) throw error;

    db.members.push(
      mapMember(data)
    );

    closeModal("memberModal");

    render();

    toast("Member added");
  } catch (err) {
    if (err.message === GROUP_MEMBER_LIMIT_MESSAGE) {
      return showMemberLimit();
    }
    console.error(err);
    toast(
      err.message ||
        "Unable to add member"
    );
  } finally {
    savingMember = false;
  }
}

function mEmailMatches(a, b) {
  return (
    String(a || "")
      .trim()
      .toLowerCase() ===
    String(b || "")
      .trim()
      .toLowerCase()
  );
}

/* =========================================================
   PAYMENT
   ========================================================= */

let paymentSaving = false;
function contributionMonthLabel(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym)) return 'Unassigned month';
  const [year, mm] = ym.split('-').map(Number);
  return new Date(year, mm - 1, 1).toLocaleDateString('en-IN', {month:'long', year:'numeric'});
}
function validPaymentMonths(g) {
  if (!groupHasStarted(g)) return [];
  // Preserve the existing policy: collect elapsed months, with no future advances.
  return Array.from({length: Math.max(0, Math.min(monthIndex(g, month), g.duration))}, (_, i) => ymFor(g, i + 1));
}
function paymentFormData() {
  const g = db.groups.find(g => g.id === activeGroup);
  const m = db.members.find(m => m.id === paymentMemberId.value && m.groupId === g?.id);
  const p = db.payments.find(p => p.id === document.getElementById('payRecord').value && p.groupId === g?.id && p.memberId === m?.id);
  return {g, m, p};
}
async function openPayment(mid) {
  const g = db.groups.find(g => g.id === activeGroup);
  const m = db.members.find(m => m.id === mid && m.groupId === g?.id);
  if (!m || g.managerId !== currentUser()?.id) return toast('Member unavailable.');
  const months = validPaymentMonths(g);
  if (!months.length) return toast('Payments begin from the confirmed chit start month.');
  paymentMemberId.value = mid;
  paymentMemberInfo.innerHTML = `<b>Member: ${escapeHtml(m.name)}</b>`;
  const records = db.payments.filter(p => p.groupId === g.id && p.memberId === mid);
  document.getElementById('payRecord').innerHTML = '<option value="">Record additional payment</option>' + records.map(p =>
    `<option value="${escapeHtml(p.id)}">Edit ${escapeHtml(p.month)} &middot; ${money(p.amountPaid)} &middot; ${escapeHtml(p.date || 'No date')}</option>`).join('');
  document.getElementById('payMonth').innerHTML = months.map(ym => `<option value="${ym}">${escapeHtml(contributionMonthLabel(ym))}</option>`).join('');
  document.getElementById('payMonth').value = months.includes(month) ? month : months.at(-1);
  const summary = paymentForMonth(g, m, month);
  document.getElementById('payRecord').value = summary.status === 'Paid' ? summary.records[0]?.id || '' : '';
  selectPaymentRecord();
  modal('paymentModal');
}
function selectPaymentRecord() {
  const {p} = paymentFormData();
  if (p) document.getElementById('payMonth').value = p.month;
  payDate.value = p?.date || new Date().toISOString().slice(0, 10);
  payMode.value = p?.mode || '';
  payReference.value = p?.reference || '';
  payNotes.value = p?.notes || '';
  updatePaymentContext();
  if (p) payAmount.value = p.amountPaid;
}
function updatePaymentContext() {
  const {g, m, p} = paymentFormData();
  const ym = document.getElementById('payMonth').value;
  const summary = paymentForMonth(g, m, ym);
  const available = paymentForMonth(g, m, ym, p?.id ?? null);
  document.getElementById('payMonthContext').innerHTML = `<b>${escapeHtml(contributionMonthLabel(ym))}</b>
    <div>Required ${money(summary.due)}</div><div>Already Paid ${money(summary.paid)}</div>
    <div>Remaining ${money(summary.balance)}</div>${summary.balance === 0 ? '<p>This month is fully paid.</p>' : ''}
    ${p ? '<p class="small muted">The amount replaces the selected record. Other payments remain allocated to their months.</p>' : ''}`;
  payAmount.value = available.balance;
}
async function savePayment() {
  if (paymentSaving) return;
  const {g, m, p} = paymentFormData();
  const ym = document.getElementById('payMonth').value;
  const amt = Number(payAmount.value);
  if (!g || !m || g.managerId !== currentUser()?.id) return toast('Member unavailable.');
  if (!validPaymentMonths(g).includes(ym)) return toast('Select a valid contribution month.');
  if (!Number.isFinite(amt) || amt <= 0) return toast('Enter a valid amount.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate.value) || !Number.isFinite(Date.parse(payDate.value)) || !payMode.value) return toast('Select payment date and mode.');
  const available = paymentForMonth(g, m, ym, p?.id ?? null);
  // Existing excess can be corrected without inventing an advance-credit rule.
  const limit = p?.month === ym ? Math.max(available.balance, p.amountPaid) : available.balance;
  if (amt > limit) return toast('Amount exceeds remaining contribution ' + money(available.balance));
  paymentSaving = true;
  try {
    // Keep the existing cumulative monthly record model. Sum all records when
    // reading, but add new receipts to one record to respect possible unique keys.
    const target = p || available.records[0];
    const newPaid = p ? amt : Number(target?.amountPaid || 0) + amt;
    const payload = {group_id:g.id, member_id:m.id, month:ym + '-01',
      amount_due:available.due, amount_paid:newPaid,
      status:available.paid + amt >= available.due ? 'paid' : 'partial',
      date:payDate.value, mode:payMode.value, reference:payReference.value.trim(), notes:payNotes.value.trim()};
    let query = supabaseClient.from('payments');
    query = target ? query.update(payload).eq('id', target.id).eq('group_id', g.id).eq('member_id', m.id)
      .eq('month', target.month + '-01').eq('amount_paid', target.amountPaid) : query.insert(payload);
    const {data, error} = await query.select().single();
    if (error) throw error;
    if (target) Object.assign(target, mapPayment(data));
    else db.payments.push(mapPayment(data));
    let receiptWarning = false;
    if (!p) {
      try {
      const receipt = await supabaseClient.from('transactions').insert({group_id:g.id, member_id:m.id,
        amount:amt, date:payload.date, mode:payload.mode, reference:payload.reference, notes:payload.notes,
        allocations:[{month:ym, amount:amt}]}).select().single();
      if (receipt.error) receiptWarning = true;
      else db.transactions.push(receipt.data);
      } catch { receiptWarning = true; }
    }
    closeModal('paymentModal');
    render();
    toast(receiptWarning ? 'Payment saved, but receipt history could not be saved. Do not submit again.' : 'Payment saved. Monthly balances updated.');
  } catch (err) {
    toast('Unable to save payment: ' + (err.message || 'Reload and try again.'));
  } finally { paymentSaving = false; }
}
async function markPending(mid) {
  if (paymentSaving || !confirm('Reverse all payments allocated to this contribution month? Receipt history is retained.')) return;
  const g = db.groups.find(g => g.id === activeGroup);
  if (!g || g.managerId !== currentUser()?.id) return;
  paymentSaving = true;
  try {
    const {data, error} = await supabaseClient.from('payments')
      .update({amount_paid:0, status:'pending', date:null, mode:null, reference:'', notes:''})
      .eq('group_id', g.id).eq('member_id', mid).eq('month', month + '-01').select();
    if (error) throw error;
    for (const row of data) {
      const p = db.payments.find(p => p.id === row.id);
      if (p) Object.assign(p, mapPayment(row));
    }
    render();
    toast('Monthly payments reversed.');
  } catch (err) { toast('Unable to reverse payment: ' + err.message); }
  finally { paymentSaving = false; }
}

/* =========================================================
   DUES
   ========================================================= */

function openDues(mid) {
  const g = db.groups.find(
    (g) =>
      g.id === activeGroup
  );

  const m = db.members.find(
    (m) => m.id === mid
  );

  const d = duesFor(g, m);

  duesTitle.textContent =
    m.name +
    " · Outstanding Dues";

  const rows = validPaymentMonths(g).map(ym => ({ym, ...paymentForMonth(g, m, ym)}));
  duesBody.innerHTML = `<p>Total previous dues: <b>${money(d.amount)}</b></p><div class="table-wrap"><table>
    <thead><tr><th>Contribution Month</th><th>Required</th><th>Paid</th><th>Due</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${escapeHtml(r.ym)}</td><td>${money(r.due)}</td><td>${money(r.paid)}</td><td>${r.balance ? money(r.balance) : 'No dues'}</td></tr>`).join('')}</tbody></table></div>`;

  modal("duesModal");
}

/* =========================================================
   PAYMENT HISTORY
   ========================================================= */

function openHistory(mid) {
  const m =
    db.members.find(
      (m) => m.id === mid
    );

  const records =
    db.payments
      .filter(
        (p) =>
          p.groupId ===
            m.groupId &&
          p.memberId === mid
      )
      .sort(
        (a, b) =>
          b.month.localeCompare(
            a.month
          )
      );

  historyTitle.textContent =
    m.name +
    " · Payment History";

  historyBody.innerHTML = `
    <p class="small muted">Monthly payment records; amounts may combine multiple receipts. Status reflects all payments for the contribution month. Payment date is the latest recorded date for this record.</p>
    <div class="table-wrap">

      <table>

        <thead>
          <tr>
            <th>Contribution Month</th>
            <th>Required</th>
            <th>Paid</th>
            <th>Status</th>
            <th>Payment Date</th>
            <th>Mode</th>
          </tr>
        </thead>

        <tbody>

          ${records
            .map(
              (p) => `
                <tr>

                  <td>
                    ${p.month}
                  </td>

                  <td>
                    ${money(
                      p.amountDue
                    )}
                  </td>

                  <td>
                    ${
                      Number(
                        p.amountPaid ||
                          0
                      ) > 0
                        ? money(
                            p.amountPaid
                          )
                        : "—"
                    }
                  </td>

                  <td>

                    <span
                      class="pill ${
                        p.status ===
                        "Paid"
                          ? "paid"
                          : "pending"
                      }">

                      ${paymentForMonth(db.groups.find(g => g.id === m.groupId), m, p.month).status}

                    </span>

                  </td>

                  <td>
                    ${p.date || "—"}
                  </td>

                  <td>
                    ${p.mode || "—"}
                  </td>

                </tr>
              `
            )
            .join("")}

        </tbody>

      </table>

    </div>
  `;

  modal(
    "historyModal"
  );
}

/* =========================================================
   AUCTION
   ========================================================= */

function auctionBlockReason(g, ym) {
  if (!g || g.managerId !== currentUser()?.id) return 'Only the group manager can allot a bid.';
  if (groupNeedsStart(g)) return 'Confirm the chit start month before recording a bid.';
  const cycle = monthIndex(g, ym);
  if (cycle < 1) return 'Bidding starts in the group start month.';
  if (cycle > g.duration) return 'This group cycle has ended.';
  if (db.auctions.some(a => a.groupId === g.id && a.month === ym)) {
    return 'A bid has already been allotted for this month.';
  }
  return '';
}

function openAuction() {
  month = runningMonth();
  const g = db.groups.find(g => g.id === activeGroup);
  const reason = auctionBlockReason(g, month);
  if (reason) return toast(reason);
  modal('auctionModal');
}

async function recordAuction() {
  if (savingAuction) return;
  month = runningMonth();
  const g = db.groups.find(g => g.id === activeGroup);
  const reason = auctionBlockReason(g, month);
  if (reason) return toast(reason);
  const winner = db.members.find(m => m.id === aw.value && m.groupId === g.id);
  const amount = Number(ab.value);
  if (!winner || !Number.isFinite(amount) || amount <= 0) {
    return toast('Select a group member and enter a positive payout.');
  }
  if (liftFor(g.id, winner.id)) return toast('This member has already received a bid.');
  savingAuction = true;
  try {
    const { data, error } = await supabaseClient.from('auctions').insert({
      group_id: g.id,
      month: `${month}-01`,
      winner_member_id: winner.id,
      bid_amount: amount,
      payout_amount: amount,
      lift_month: monthIndex(g, month),
      date: new Date().toISOString().slice(0, 10)
    }).select().single();
    if (error) throw error;
    db.auctions.push(mapAuction(data));
    closeModal('auctionModal');
    render();
    toast('Bid allotted. This month is now closed for bidding.');
  } catch (err) {
    console.error(err);
    toast(err.code === '23505'
      ? 'This month or member already has a bid allotted. Reload to see the latest allocation.'
      : err.message || 'Unable to allot bid');
  } finally {
    savingAuction = false;
  }
}

/* =========================================================
   DELETE GROUP
   ========================================================= */

let deletingGroup = false;

async function deleteGroup() {
  if (deletingGroup) return;
  const user = currentUser();
  const group = db.groups.find(g => g.id === activeGroup && g.managerId === user?.id);
  if (!group || user?.role !== 'manager') return toast("Only the group manager can delete this group.");
  if (!confirm(`Are you sure you want to delete ${group.name}? This deletes all related data.`)) return;

  // Capture the target: the manager may select another group during the request.
  const groupId = group.id;
  deletingGroup = true;
  try {
    const { data, error } = await supabaseClient.from("groups")
      .delete().eq("id", groupId).eq("manager_id", user.id).select("id");
    if (error) throw error;
    if (!data?.some(row => row.id === groupId)) {
      throw new Error("Deletion was not confirmed. The group may already be deleted, or your account may not have permission to delete it. Refresh the page; if it remains, check the groups DELETE policy in Supabase.");
    }

    db.groups = db.groups.filter(g => g.id !== groupId);
    db.members = db.members.filter(m => m.groupId !== groupId);
    db.payments = db.payments.filter(p => p.groupId !== groupId);
    db.auctions = db.auctions.filter(a => a.groupId !== groupId);
    db.transactions = db.transactions.filter(t => t.group_id !== groupId);
    if (activeGroup === groupId) activeGroup = null;
    render();
    toast("Group deleted");
  } catch (err) {
    console.error(err);
    toast(err.code === '23503'
      ? "This group still has linked records that prevent deletion. Review its database relationships before deleting it."
      : err.message || "Unable to delete group");
  } finally {
    deletingGroup = false;
  }
}

/* =========================================================
   OPTIONAL DEMO RESET
   ========================================================= */

window.resetDemo =
  async function () {
    await logout(false);
    location.reload();
  };

/* =========================================================
   SUPABASE AUTH STATE
   ========================================================= */

if (
  typeof supabaseClient !== "undefined" &&
  supabaseClient.auth
) {

  supabaseClient.auth.onAuthStateChange(

    function (event, newSession) {

      console.log(
        "Supabase auth event:",
        event
      );


      /*
        User logged out
      */

      if (
        event === "SIGNED_OUT"
      ) {

        session = null;

        redirectToHome();

        return;

      }


      /*
        User logged in or token refreshed
      */

      if (

        event === "SIGNED_IN" ||

        event === "TOKEN_REFRESHED"

      ) {

        session =
          newSession;

      }

    }

  );

}


