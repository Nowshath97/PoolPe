

/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

const landing =
  document.getElementById("landingPage");

const loginPage =
  document.getElementById("loginPage");

const loginError =
  document.getElementById("loginError");


function showLogin(event) {

  if (event) {
    event.preventDefault();
  }

  landing.style.display = "none";
  loginPage.style.display = "block";

  window.scrollTo(0, 0);
}


function showHome(event) {

  if (event) {
    event.preventDefault();
  }

  loginPage.style.display = "none";
  landing.style.display = "block";

  window.history.replaceState(
    {},
    "",
    window.location.pathname
  );

  window.scrollTo(0, 0);
}


/* =========================================================
   LOGIN BUTTONS
   ========================================================= */

document
  .querySelectorAll(".login-trigger")
  .forEach(button => {

    button.addEventListener(
      "click",
      showLogin
    );

  });


document
  .getElementById("backHome")
  ?.addEventListener(
    "click",
    showHome
  );


document
  .getElementById("logoBack")
  ?.addEventListener(
    "click",
    showHome
  );


/* =========================================================
   OPEN LOGIN AFTER REDIRECT FROM DASHBOARD
   ========================================================= */

const params =
  new URLSearchParams(
    window.location.search
  );

if (params.get("login") === "1" || window.location.hash === "#loginPage") {
  showLogin();
}


/* =========================================================
   CHECK WHETHER USER IS ALREADY LOGGED IN
   ========================================================= */

/* =========================================================
   LOGIN
   ========================================================= */

document
  .getElementById("landingLoginForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const email =
        document
          .getElementById("landingEmail")
          .value
          .trim()
          .toLowerCase();


      const password =
        document
          .getElementById("landingPassword")
          .value;


      const button =
        document.querySelector(
          "#landingLoginForm button[type='submit']"
        );


      loginError.style.display =
        "none";

      loginError.textContent =
        "";


      if (!email || !password) {

        showError(
          "Please enter your email or phone number and password."
        );

        return;
      }


      const originalText =
        button.textContent;


      button.disabled = true;

      button.textContent =
        "Signing in...";


      try {

        const {
          data,
          error
        } =
          await supabaseClient.auth
            .signInWithPassword({
              ...(email.includes("@") ? { email } : { phone: email.replace(/[\s()-]/g, "") }),
              password
            });


        if (error) {

          console.error(
            "Login error:",
            error
          );

          showError(
            error.message ||
            "Invalid email or password."
          );

          return;
        }


        if (!data?.session) {

          showError(
            "Login session could not be created."
          );

          return;
        }


        console.log(
          "PoolPay login successful:",
          data.user.email
        );


        /*
          Supabase automatically persists
          the authenticated session.

          We therefore DON'T need our own
          localStorage login mechanism.
        */


        window.location.replace(
          new URL(
            "dashboard.html",
            window.location.href
          ).href
        );

      }

      catch (error) {

        console.error(
          "Unexpected login error:",
          error
        );


        showError(
          "Unable to sign in. Please try again."
        );

      }

      finally {

        button.disabled = false;

        button.textContent =
          originalText;

      }

    }
  );


function showError(message) {

  loginError.textContent =
    message;

  loginError.style.display =
    "block";

}


/* =========================================================
   FORGOT PASSWORD
   ========================================================= */

document
  .getElementById("forgotPassword")
  ?.addEventListener(
    "click",
    async event => {

      event.preventDefault();


      const email =
        document
          .getElementById("landingEmail")
          .value
          .trim()
          .toLowerCase();


      if (!email) {

        showError(
          "Enter your email address first."
        );

        return;
      }


      try {

        const {
          error
        } =
          await supabaseClient.auth
            .resetPasswordForEmail(
              email,
              {
                redirectTo:
                  window.location.origin +
                  "/reset-password.html"
              }
            );


        if (error) {

          console.error(
            "Password reset error:",
            error
          );

          showError(
            error.message
          );

          return;
        }


        showError(
          "Password reset instructions have been sent to your email."
        );

      }

      catch (error) {

        console.error(error);

        showError(
          "Unable to send password reset email."
        );

      }

    }
  );


/* =========================================================
   START
   ========================================================= */

// Public pages remain accessible with or without a session.

