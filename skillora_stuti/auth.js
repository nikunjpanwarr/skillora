// Skillora Authentication Module (Client-Side)
// Integrated with Phase 2 Backend (/api/auth) + Graceful Local Fallback

var API_HOST = (location.port && location.port !== "3000" && location.protocol.startsWith("http")) ? "http://localhost:3000" : "";

var AUTH_CONFIG = {
  clientId: "",
  tenantId: "organizations",
  allowedDomain: "bennett.edu.in",
  apiBase: API_HOST + "/api/auth"
};

(function() {
  var KEY = "skillora_user";
  var D = AUTH_CONFIG.allowedDomain;

  // Retrieve cached user synchronously for immediate UI rendering
  function user() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch(e) {
      return null;
    }
  }

  function setUser(u) {
    try {
      if (u) {
        localStorage.setItem(KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(KEY);
      }
    } catch(e) {}
  }

  async function logout() {
    try {
      await fetch(AUTH_CONFIG.apiBase + '/logout', { credentials: 'include' });
    } catch(e) {}
    setUser(null);
    location.href = "index.html";
  }

  function okEmail(e) {
    return typeof e === "string" && e.trim().toLowerCase().slice(-(D.length + 1)) === "@" + D.toLowerCase();
  }

  function nameFrom(e) {
    return e.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, function(c) {
      return c.toUpperCase();
    });
  }

  function nextPage() {
    var n = new URLSearchParams(location.search).get("next") || "";
    return /^[\w-]+\.html$/.test(n) ? n : "index.html";
  }

  window.Skillora = {
    API_HOST: API_HOST,
    user: user,
    logout: logout,
    isLoggedIn: function() { return !!user(); }
  };

  // Sync session with backend API
  async function syncSession() {
    try {
      var res = await fetch(AUTH_CONFIG.apiBase + '/me', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        if (data.config) {
          if (data.config.allowedDomain) D = AUTH_CONFIG.allowedDomain = data.config.allowedDomain;
          if (data.config.clientId) AUTH_CONFIG.clientId = data.config.clientId;
          if (data.config.tenantId) AUTH_CONFIG.tenantId = data.config.tenantId;
        }
        if (data.user) {
          setUser(data.user);
        } else if (user() && !data.user && !location.pathname.includes('login.html')) {
          // If server reports no session and we are connected to server, clear local
          // only if server was reachable
        }
        renderNav();
      }
    } catch(e) {
      // Backend not running; fallback to local storage
    }
  }

  function renderNav() {
    var u = user();
    document.querySelectorAll("a.login").forEach(function(a) {
      // Clean previous injected spans and dashboard buttons
      var prevHi = a.parentNode.querySelector(".hi");
      if (prevHi) prevHi.remove();
      var prevDash = a.parentNode.querySelector(".nav-dash-link");
      if (prevDash) prevDash.remove();

      if (!u) {
        a.textContent = "Login";
        a.href = "login.html";
        return;
      }

      a.textContent = "Log out";
      a.href = "#";
      a.onclick = function(e) {
        e.preventDefault();
        logout();
      };

      // Add Dashboard Link
      var dashUrl = "consumer-dashboard.html";
      var dashText = "Dashboard";
      if (u.role === "admin") {
        dashUrl = "admin-dashboard.html";
        dashText = "Admin Hub";
      } else if (u.role === "producer") {
        dashUrl = "producer-dashboard.html";
        dashText = "Producer Hub";
      }

      var dLink = document.createElement("a");
      dLink.className = "btn b-out nav-dash-link";
      dLink.href = dashUrl;
      dLink.style.height = "32px";
      dLink.style.fontSize = ".75rem";
      dLink.textContent = dashText;
      a.parentNode.insertBefore(dLink, a);

      var h = document.createElement("span");
      h.className = "hi";
      var firstName = (u.name || "Student").split(" ")[0];
      h.textContent = "Hi, " + firstName;
      a.parentNode.insertBefore(h, dLink);
    });
  }

  // Initial UI Render
  renderNav();
  syncSession();

  // Login Page Logic
  var b = document.getElementById("ms-login");
  if (!b) return;

  var u = user();
  if (u) {
    location.replace(nextPage());
    return;
  }

  var dn = document.getElementById("demo-note");
  if (dn && !AUTH_CONFIG.clientId) dn.hidden = false;

  var err = document.getElementById("err");
  var demo = document.getElementById("demo");
  var em = document.getElementById("demo-email");

  // Show demo registration form immediately if Microsoft Azure Client ID is not configured
  if (demo && !AUTH_CONFIG.clientId) {
    demo.classList.add("on");
  }

  function show(m) {
    if (err) err.textContent = m || "";
  }

  async function finish(email, name, department, mode, accessToken) {
    if (!okEmail(email)) {
      show("Please use your @" + D + " university account.");
      return;
    }

    show("Signing in...");

    var resolvedName = (name && name.trim()) || nameFrom(email);
    var resolvedDept = (department && department.trim()) || "Bennett Student";

    // Try backend authentication first
    try {
      var endpoint = mode === "microsoft" ? "/login/microsoft" : "/login/demo";
      var payload = mode === "microsoft" 
        ? { accessToken: accessToken, username: email, name: resolvedName, department: resolvedDept }
        : { email: email, name: resolvedName, department: resolvedDept };

      var res = await fetch(AUTH_CONFIG.apiBase + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      var data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        location.href = nextPage();
        return;
      } else if (data.message) {
        show(data.message);
        return;
      }
    } catch (apiErr) {
      console.warn("Backend unavailable, using client-side fallback login", apiErr);
    }

    // Graceful offline fallback
    try {
      setUser({ email: email, name: resolvedName, department: resolvedDept, mode: mode, role: "consumer" });
      location.href = nextPage();
    } catch(e) {
      show("Browser storage was blocked. Please allow site data and try again.");
    }
  }

  b.addEventListener("click", function() {
    show("");
    if (!AUTH_CONFIG.clientId) {
      demo.classList.add("on");
      var nm = document.getElementById("demo-name");
      if (nm) nm.focus();
      else em.focus();
      return;
    }
    if (!window.msal) {
      show("The Microsoft sign-in library didn’t load. Check your internet connection.");
      return;
    }

    var app = new msal.PublicClientApplication({
      auth: {
        clientId: AUTH_CONFIG.clientId,
        authority: "https://login.microsoftonline.com/" + AUTH_CONFIG.tenantId,
        redirectUri: location.origin + location.pathname
      },
      cache: { cacheLocation: "sessionStorage" }
    });

    app.loginPopup({ scopes: ["User.Read"], prompt: "select_account" })
      .then(function(r) {
        finish(r.account.username, r.account.name, "", "microsoft", r.accessToken);
      })
      .catch(function(e) {
        if (!e || e.errorCode !== "user_cancelled") {
          show("Sign-in failed. Please try again.");
        }
      });
  });

  demo.addEventListener("submit", function(e) {
    e.preventDefault();
    var nmInput = document.getElementById("demo-name");
    var dpInput = document.getElementById("demo-dept");
    var nameVal = nmInput ? nmInput.value.trim() : "";
    var deptVal = dpInput ? dpInput.value.trim() : "";
    finish(em.value.trim(), nameVal, deptVal, "demo");
  });
})();
