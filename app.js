
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
let month = "2026-09";

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


  redirectToLogin();

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
  };
}

function mapPayment(p) {
  return {
    id: p.id,
    groupId: p.group_id,
    month: p.month,
    memberId: p.member_id,
    amountDue: Number(p.amount_due || 0),
    amountPaid: Number(p.amount_paid || 0),
    status: p.status || "Pending",
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
    month: a.month,
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

/* =========================================================
   MEMBER CALCULATIONS
   ========================================================= */

function memberStats(g, m) {
  const rec = db.payments.filter(
    (p) =>
      p.groupId === g.id &&
      p.memberId === m.id
  );

  const paid = rec.filter(
    (p) => p.status === "Paid"
  );

  const lift = liftFor(
    g.id,
    m.id
  );

  const total = paid.reduce(
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
  const current = monthIndex(
    g,
    month
  );

  const unpaid = [];

  for (
    let n = 1;
    n < current;
    n++
  ) {
    const ym = ymFor(g, n);

    const p = db.payments.find(
      (x) =>
        x.groupId === g.id &&
        x.memberId === m.id &&
        x.month === ym
    );

    const due = Number(
      p?.amountDue ??
        dueForMonth(g, m, n)
    );

    const paid = Number(
      p?.amountPaid || 0
    );

    const balance = Math.max(
      0,
      due - paid
    );

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

    const p = db.payments.find(
      (x) =>
        x.groupId === g.id &&
        x.memberId === m.id &&
        x.month === ym
    );

    const due = Number(
      p?.amountDue ??
        dueForMonth(g, m, n)
    );

    const paid = Number(
      p?.amountPaid || 0
    );

    const balance = Math.max(
      0,
      due - paid
    );

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

function managerView(u) {
  const groups = db.groups.filter(
    (g) => g.managerId === u.id
  );

  if (!groups.length) {
    activeGroup = null;
  } else if (
    !groups.some(
      (g) => g.id === activeGroup
    )
  ) {
    activeGroup = groups[0].id;
  }

  const g = groups.find(
    (x) => x.id === activeGroup
  );

  const side = groups
    .map(
      (x) => `
        <div
          class="group ${
            x.id === activeGroup
              ? "active"
              : ""
          }"
          onclick="
            activeGroup='${x.id}';
            render()
          "
        >
          <b>${x.name}</b>
          <span>
            ${money(x.value)}
            ·
            ${
              db.members.filter(
                (m) =>
                  m.groupId === x.id
              ).length
            }
            members
          </span>
        </div>
      `
    )
    .join("");

  document.getElementById(
    "app"
  ).innerHTML = shell(
    `
      <div class="hero">
        <div>
          <h1>Manager Dashboard</h1>
          <p class="muted">
            Manage groups, dues, collections and monthly bids.
          </p>
        </div>

        <button
          class="btn primary"
          onclick="modal('groupModal')">
          + Create Group
        </button>
      </div>

      <div class="layout">

        <aside class="card sidebar">
          <div class="section-title">
            <h2>My Groups</h2>
          </div>

          ${
            side ||
            '<div class="muted small">No groups yet</div>'
          }
        </aside>

        <section>
          ${
            g
              ? groupPanel(g)
              : `
                <div class="card empty">
                  Create your first pool group to begin.
                </div>
              `
          }
        </section>

      </div>

      ${modals()}
    `,
    u
  );
}

function groupPanel(g) {
  const ms = db.members.filter(
    (m) => m.groupId === g.id
  );

  const current = Math.min(
    monthIndex(g, month),
    g.duration
  );

  const ps = db.payments.filter(
    (p) =>
      p.groupId === g.id &&
      p.month === month
  );

  const a = db.auctions.find(
    (a) =>
      a.groupId === g.id &&
      a.month === month
  );

  const win = ms.find(
    (m) =>
      m.id === a?.winnerMemberId
  );

  const bidDone = ms.filter(
    (m) =>
      liftFor(
        g.id,
        m.id
      )
  ).length;

  const yet =
    ms.length - bidDone;

  const dueMembers = ms
    .map((m) => ({
      m,
      d: duesFor(g, m),
    }))
    .filter(
      (x) => x.d.months > 0
    );

  const outstanding =
    dueMembers.reduce(
      (s, x) =>
        s + x.d.amount,
      0
    );

  const rows = ms
    .filter((m) =>
      m.name
        .toLowerCase()
        .includes(
          (
            window.searchTerm ||
            ""
          ).toLowerCase()
        )
    )
    .map((m) => {
      const p =
        ps.find(
          (x) =>
            x.memberId === m.id
        ) || {
          status: "Pending",
          amountDue:
            dueForMonth(
              g,
              m,
              current
            ),
          amountPaid: 0,
        };

      const d = duesFor(g, m);

      const lift = liftFor(
        g.id,
        m.id
      );

      return `
        <tr>

          <td>
            <button
              class="linkbtn"
              onclick="openHistory('${m.id}')">
              <b>${m.name}</b>
            </button>
          </td>

          <td>
            ${
              lift
                ? `<span class="pill paid">
                    Bid Completed
                   </span>`
                : `<span class="pill pending">
                    Yet to Bid
                   </span>`
            }
          </td>

          <td>
            ${
              d.months
                ? `
                  <button
                    class="linkbtn due-text"
                    onclick="openDues('${m.id}')">

                    <b>
                      ${d.months}
                      month${
                        d.months > 1
                          ? "s"
                          : ""
                      }
                    </b>

                    <br>

                    <span class="small">
                      ${money(d.amount)}
                    </span>

                  </button>
                `
                : `
                  <span class="pill paid">
                    No dues
                  </span>
                `
            }
          </td>

          <td>
            ${money(p.amountDue)}
          </td>

          <td>
            ${
              Number(
                p.amountPaid || 0
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
                p.status === "Paid"
                  ? "paid"
                  : "pending"
              }">
              ${p.status}
            </span>
          </td>

          <td>
            <div class="toolbar">

              <button
                class="btn secondary"
                onclick="openPayment('${m.id}')">
                ${
                  p.status === "Paid"
                    ? "Edit payment"
                    : "Mark paid"
                }
              </button>

              ${
                p.status === "Paid"
                  ? `
                    <button
                      class="btn danger"
                      onclick="markPending('${m.id}')">
                      Mark pending
                    </button>
                  `
                  : ""
              }

            </div>
          </td>

        </tr>
      `;
    })
    .join("");

  return `
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
          Members with dues
        </div>

        <div class="value">
          ${dueMembers.length}
        </div>

        <div class="sub">
          ${money(outstanding)}
          outstanding
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
          Informational only
        </div>
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
            `
            : "Result pending"
        }
      </div>

    </div>

    <div class="card">

      <div class="section-title">

        <h2>${g.name}</h2>

        <div class="toolbar">

          <input
            placeholder="Search members"
            oninput="
              window.searchTerm=this.value;
              render()
            "
          >

          <button
            class="btn primary"
            onclick="modal('memberModal')">
            + Add Member
          </button>

        </div>

      </div>

      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Member</th>
              <th>Bid status</th>
              <th>Previous dues</th>
              <th>This month due</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>

        </table>

      </div>

    </div>

    <div class="auction">

      <div class="card">

        <div class="section-title">

          <h2>Monthly Bid</h2>

          <button
            class="btn secondary"
            onclick="modal('auctionModal')">
            ${a ? "Edit" : "Record"}
          </button>

        </div>

        <div class="big">
          ${win?.name || "Not recorded"}
        </div>

        ${
          a
            ? `
              <span class="pill winner">
                Payout:
                ${money(a.bidAmount)}
              </span>
            `
            : ""
        }

      </div>

      <div class="card">

        <h2 style="font-size:18px">
          Group settings
        </h2>

        <p>
          <b>Monthly contribution:</b>
          ${money(g.monthly)}
        </p>

        <p>
          <b>Commission:</b>
          ${g.commission ?? 4}%
        </p>

        <p>
          <b>Started:</b>
          ${g.start}
        </p>

        <p>
          <b>Status:</b>
          ${g.status}
        </p>

        <button
          class="btn danger"
          onclick="deleteGroup()">
          Delete group
        </button>

      </div>

    </div>
  `;
}

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
              <b>${m.name}</b>

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
          ${u.name} · ${u.role}
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
          `<option value="${m.id}">
             ${m.name}
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
          The amount will clear the
          oldest outstanding months first.
        </p>

        <div
          id="paymentMemberInfo"
          class="info-box">
        </div>

        <input
          id="paymentMemberId"
          type="hidden">

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
            type="date">
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
    start: month,
    status: "Active",
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

    render();

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

async function addMember() {
  const u = currentUser();

  if (!u || u.role !== "manager") {
    return toast(
      "Only managers can add members"
    );
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

  try {
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
    console.error(err);
    toast(
      err.message ||
        "Unable to add member"
    );
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

async function ensurePayment(mid) {
  const g = db.groups.find(
    (g) => g.id === activeGroup
  );

  const m = db.members.find(
    (m) => m.id === mid
  );

  const n = monthIndex(
    g,
    month
  );

  let p = db.payments.find(
    (p) =>
      p.groupId === activeGroup &&
      p.month === month &&
      p.memberId === mid
  );

  if (p) return p;

  const payload = {
    group_id: activeGroup,
    month,
    member_id: mid,
    amount_due:
      dueForMonth(g, m, n),
    amount_paid: 0,
    status: "Pending",
    date: null,
    mode: null,
    reference: "",
    notes: "",
  };

  const { data, error } =
    await supabaseClient
      .from("payments")
      .insert(payload)
      .select()
      .single();

  if (error) {
    console.error(error);
    throw error;
  }

  p = mapPayment(data);

  db.payments.push(p);

  return p;
}

async function openPayment(mid) {
  try {
    const g = db.groups.find(
      (g) =>
        g.id === activeGroup
    );

    const m = db.members.find(
      (m) => m.id === mid
    );

    const p =
      await ensurePayment(mid);

    const items =
      openObligations(g, m);

    const total =
      items.reduce(
        (s, x) =>
          s + x.balance,
        0
      );

    const prev =
      duesFor(g, m);

    paymentMemberId.value =
      mid;

    paymentMemberInfo.innerHTML = `
      <b>${m.name}</b>

      <div class="small muted">
        Previous dues:
        ${prev.months} month(s)
        · Total currently outstanding:
        ${money(total)}
      </div>

      <div class="small muted">
        Payments are automatically
        applied to the oldest unpaid
        month first.
      </div>
    `;

    payAmount.value =
      total ||
      p.amountDue;

    payDate.value =
      new Date()
        .toISOString()
        .slice(0, 10);

    payMode.value = "";
    payReference.value = "";
    payNotes.value = "";

    modal(
      "paymentModal"
    );
  } catch (err) {
    console.error(err);
    toast(
      "Unable to open payment form"
    );
  }
}

async function savePayment() {
  const mid =
    paymentMemberId.value;

  const g = db.groups.find(
    (g) =>
      g.id === activeGroup
  );

  const m = db.members.find(
    (m) => m.id === mid
  );

  const amt =
    Number(payAmount.value);

  if (!amt || amt <= 0) {
    return toast(
      "Enter a valid amount"
    );
  }

  if (
    !payDate.value ||
    !payMode.value
  ) {
    return toast(
      "Select payment date and mode"
    );
  }

  const items =
    openObligations(g, m);

  const total =
    items.reduce(
      (s, x) =>
        s + x.balance,
      0
    );

  if (!total) {
    return toast(
      "No outstanding amount to allocate"
    );
  }

  if (amt > total) {
    return toast(
      "Amount exceeds total outstanding " +
        money(total)
    );
  }

  let remaining = amt;

  const allocations = [];

  try {
    for (const item of items) {
      if (remaining <= 0)
        break;

      let p = item.p;

      if (!p) {
        const payload = {
          group_id: g.id,
          month: item.ym,
          member_id: mid,
          amount_due: item.due,
          amount_paid: 0,
          status: "Pending",
          date: null,
          mode: null,
          reference: "",
          notes: "",
        };

        const { data, error } =
          await supabaseClient
            .from("payments")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        p = mapPayment(data);

        db.payments.push(p);
      }

      const applied =
        Math.min(
          remaining,
          item.balance
        );

      const newPaid =
        Number(
          p.amountPaid || 0
        ) + applied;

      const newStatus =
        newPaid >=
        Number(p.amountDue)
          ? "Paid"
          : "Pending";

      const update = {
        amount_paid: newPaid,
        status: newStatus,
        date:
          payDate.value,
        mode:
          payMode.value,
        reference:
          payReference.value.trim(),
        notes:
          payNotes.value.trim(),
      };

      const { data, error } =
        await supabaseClient
          .from("payments")
          .update(update)
          .eq("id", p.id)
          .select()
          .single();

      if (error) throw error;

      Object.assign(
        p,
        mapPayment(data)
      );

      allocations.push({
        month: item.ym,
        amount: applied,
      });

      remaining -= applied;
    }

    /*
      FIX from your original app.js:
      db.transactions was not initialized
      in the original seed object.
    */

    const transactionPayload = {
      group_id: g.id,
      member_id: mid,
      amount: amt,
      date: payDate.value,
      mode: payMode.value,
      reference:
        payReference.value.trim(),
      notes:
        payNotes.value.trim(),
      allocations,
    };

    const {
      data: transaction,
      error: transactionError,
    } =
      await supabaseClient
        .from("transactions")
        .insert(
          transactionPayload
        )
        .select()
        .single();

    if (
      transactionError
    ) {
      console.warn(
        "Transaction insert failed:",
        transactionError
      );
    } else {
      db.transactions.push(
        transaction
      );
    }

    closeModal(
      "paymentModal"
    );

    render();

    const left =
      openObligations(
        g,
        m
      );

    const prev =
      duesFor(g, m);

    toast(
      prev.months
        ? `Payment recorded · ${prev.months} month${
            prev.months > 1
              ? "s"
              : ""
          } due remaining`
        : "Payment recorded · no previous dues"
    );
  } catch (err) {
    console.error(
      "Payment error:",
      err
    );

    toast(
      err.message ||
        "Unable to record payment"
    );
  }
}

/* =========================================================
   MARK PAYMENT PENDING
   ========================================================= */

async function markPending(mid) {
  if (
    !confirm(
      "Mark this payment as pending?"
    )
  ) {
    return;
  }

  try {
    const p =
      db.payments.find(
        (p) =>
          p.groupId ===
            activeGroup &&
          p.month === month &&
          p.memberId === mid
      );

    if (!p) {
      return toast(
        "Payment record not found"
      );
    }

    const update = {
      status: "Pending",
      amount_paid: 0,
      date: null,
      mode: null,
      reference: "",
      notes: "",
    };

    const { data, error } =
      await supabaseClient
        .from("payments")
        .update(update)
        .eq("id", p.id)
        .select()
        .single();

    if (error) throw error;

    Object.assign(
      p,
      mapPayment(data)
    );

    render();

    toast(
      "Marked pending"
    );
  } catch (err) {
    console.error(err);
    toast(
      "Unable to update payment"
    );
  }
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

  duesBody.innerHTML =
    d.months
      ? `
        <div class="info-box">
          <b>
            ${d.months}
            month${
              d.months > 1
                ? "s"
                : ""
            }
            due ·
            ${money(d.amount)}
          </b>
        </div>

        <table>

          <thead>
            <tr>
              <th>Month</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>

            ${d.items
              .map(
                (x) => `
                  <tr>
                    <td>
                      ${x.ym}
                    </td>

                    <td>
                      ${money(
                        x.amount
                      )}
                    </td>
                  </tr>
                `
              )
              .join("")}

          </tbody>

        </table>
      `
      : `
        <div class="empty">
          No previous dues.
        </div>
      `;

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
    <div class="table-wrap">

      <table>

        <thead>
          <tr>
            <th>Month</th>
            <th>Due</th>
            <th>Paid</th>
            <th>Status</th>
            <th>Date</th>
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

                      ${p.status}

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

async function recordAuction() {
  if (
    !aw.value ||
    !ab.value
  ) {
    return toast(
      "Select recipient and enter payout"
    );
  }

  const g =
    db.groups.find(
      (g) =>
        g.id === activeGroup
    );

  const existing =
    db.auctions.find(
      (a) =>
        a.groupId ===
          activeGroup &&
        a.month === month
    );

  const li =
    monthIndex(
      g,
      month
    );

  try {
    if (existing) {
      const update = {
        winner_member_id:
          aw.value,
        bid_amount:
          Number(ab.value),
        payout_amount:
          Number(ab.value),
        lift_month: li,
      };

      const {
        data,
        error,
      } =
        await supabaseClient
          .from("auctions")
          .update(update)
          .eq(
            "id",
            existing.id
          )
          .select()
          .single();

      if (error) throw error;

      Object.assign(
        existing,
        mapAuction(data)
      );
    } else {
      const payload = {
        group_id:
          activeGroup,
        month,
        winner_member_id:
          aw.value,
        bid_amount:
          Number(ab.value),
        payout_amount:
          Number(ab.value),
        lift_month: li,
        date: new Date()
          .toISOString()
          .slice(0, 10),
      };

      const {
        data,
        error,
      } =
        await supabaseClient
          .from("auctions")
          .insert(payload)
          .select()
          .single();

      if (error) throw error;

      db.auctions.push(
        mapAuction(data)
      );
    }

    closeModal(
      "auctionModal"
    );

    render();

    toast(
      "Bid saved"
    );
  } catch (err) {
    console.error(err);
    toast(
      err.message ||
        "Unable to save bid"
    );
  }
}

/* =========================================================
   DELETE GROUP
   ========================================================= */

async function deleteGroup() {
  if (
    !confirm(
      "Delete this group and all related data?"
    )
  ) {
    return;
  }

  try {
    const { error } =
      await supabaseClient
        .from("groups")
        .delete()
        .eq(
          "id",
          activeGroup
        );

    if (error) throw error;

    db.groups =
      db.groups.filter(
        (g) =>
          g.id !== activeGroup
      );

    db.members =
      db.members.filter(
        (m) =>
          m.groupId !==
          activeGroup
      );

    db.payments =
      db.payments.filter(
        (p) =>
          p.groupId !==
          activeGroup
      );

    db.auctions =
      db.auctions.filter(
        (a) =>
          a.groupId !==
          activeGroup
      );

    activeGroup = null;

    render();

    toast(
      "Group deleted"
    );
  } catch (err) {
    console.error(err);

    toast(
      err.message ||
        "Unable to delete group"
    );
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

        redirectToLogin();

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


