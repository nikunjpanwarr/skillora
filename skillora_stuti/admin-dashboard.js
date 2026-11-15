// Skillora Admin Moderation Script (Phase 7)

(function(){
  var user = window.Skillora && window.Skillora.user && window.Skillora.user();
  if (!user || user.role !== 'admin') {
    if (typeof window.showToast === 'function') {
      window.showToast("Access restricted: Administrator role required.", "error");
    }
    location.href = "login.html?next=" + encodeURIComponent(location.pathname);
    return;
  }

  // Tabs
  var tabs = document.querySelectorAll(".tab-btn");
  var panels = document.querySelectorAll(".panel");
  function setTab(name) {
    tabs.forEach(function(t){ t.classList.toggle("on", t.getAttribute("data-tab") === name); });
    panels.forEach(function(p){ p.classList.toggle("on", p.id === "panel-" + name); });
  }
  tabs.forEach(function(t){
    t.addEventListener("click", function(){ setTab(t.getAttribute("data-tab")); });
  });

  var apiHost = (typeof Skillora !== "undefined" && Skillora.API_HOST) || ((location.port && location.port !== "3000" && location.protocol.startsWith("http")) ? "http://localhost:3000" : "");

  // 1. Stats
  async function loadStats() {
    try {
      var res = await fetch(apiHost + '/api/admin/stats', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        document.getElementById("stat-gmv").textContent = "₹" + (data.orders.total_gmv || 0).toLocaleString();
        document.getElementById("stat-users").textContent = data.users.total_users || 0;
        document.getElementById("stat-services").textContent = data.services.active_services || 0;
        document.getElementById("stat-orders").textContent = data.orders.total_orders || 0;
        document.getElementById("stat-completed").textContent = data.orders.completed_orders || 0;
      }
    } catch(e) {}
  }

  // 2. Services Moderation
  async function loadServices() {
    var tbody = document.getElementById("services-tbody");
    try {
      var res = await fetch(apiHost + '/api/admin/services', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        tbody.innerHTML = data.services.map(function(s){
          var toggleBtn = s.status === 'suspended'
            ? '<button class="btn b-grad mod-btn" data-id="' + s.id + '" data-status="active" style="height:30px;padding:0 12px;font-size:.75rem">Activate</button>'
            : '<button class="btn b-out mod-btn" data-id="' + s.id + '" data-status="suspended" style="height:30px;padding:0 12px;font-size:.75rem;color:var(--blush-i)">Suspend</button>';

          return '<tr>' +
            '<td><b>' + s.title + '</b></td>' +
            '<td>' + s.category_name + '</td>' +
            '<td>' + s.producer_name + '<br><small style="color:var(--muted)">' + s.producer_email + '</small></td>' +
            '<td>' + s.price_display + '</td>' +
            '<td><span class="status-pill status-' + s.status + '">' + s.status + '</span></td>' +
            '<td>' + toggleBtn + '</td>' +
          '</tr>';
        }).join('');

        tbody.querySelectorAll(".mod-btn").forEach(function(btn){
          btn.addEventListener("click", async function(){
            var id = btn.getAttribute("data-id");
            var status = btn.getAttribute("data-status");
            var modRes = await fetch(apiHost + '/api/admin/services/' + id + '/status', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: status })
            });
            if (modRes.ok) {
              loadServices();
              loadStats();
            }
          });
        });
      }
    } catch(e) {}
  }

  // 3. User Management
  async function loadUsers() {
    var tbody = document.getElementById("users-tbody");
    try {
      var res = await fetch(apiHost + '/api/admin/users', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        tbody.innerHTML = data.users.map(function(u){
          return '<tr>' +
            '<td><b>' + u.name + '</b></td>' +
            '<td>' + u.email + '</td>' +
            '<td>' + (u.department || 'Bennett University') + '</td>' +
            '<td><span class="status-pill status-' + (u.role === 'admin' ? 'suspended' : 'active') + '">' + u.role + '</span></td>' +
            '<td>' +
              '<select class="role-select" data-id="' + u.id + '" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border);font-family:inherit;font-size:.8rem">' +
                '<option value="consumer"' + (u.role === 'consumer' ? ' selected' : '') + '>Consumer</option>' +
                '<option value="producer"' + (u.role === 'producer' ? ' selected' : '') + '>Producer</option>' +
                '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Admin</option>' +
              '</select>' +
            '</td>' +
          '</tr>';
        }).join('');

        tbody.querySelectorAll(".role-select").forEach(function(sel){
          sel.addEventListener("change", async function(){
            var id = sel.getAttribute("data-id");
            var newRole = sel.value;
            var uRes = await fetch(apiHost + '/api/admin/users/' + id + '/role', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ role: newRole })
            });
            if (uRes.ok) {
              if (typeof window.showToast === 'function') {
                window.showToast("User role updated to " + newRole, "success");
              }
              loadUsers();
              loadStats();
            }
          });
        });
      }
    } catch(e) {}
  }

  // 4. All Orders Audit
  async function loadOrders() {
    var tbody = document.getElementById("orders-tbody");
    try {
      var res = await fetch(apiHost + '/api/admin/orders', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        tbody.innerHTML = data.orders.map(function(o){
          return '<tr>' +
            '<td><b>' + o.order_number + '</b></td>' +
            '<td>' + o.service_title + '</td>' +
            '<td>' + o.consumer_name + '</td>' +
            '<td>' + o.producer_name + '</td>' +
            '<td><b>₹' + o.price + '</b></td>' +
            '<td><span class="status-pill status-' + o.status + '">' + o.status + '</span></td>' +
            '<td><small>' + new Date(o.created_at).toLocaleDateString() + '</small></td>' +
          '</tr>';
        }).join('');
      }
    } catch(e) {}
  }

  // 5. Platform Reports (Phase 10)
  async function loadReports() {
    var tbody = document.getElementById("reports-tbody");
    try {
      var res = await fetch(apiHost + '/api/reports', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        tbody.innerHTML = data.reports.map(function(r){
          var item = r.service_title ? ('Service: ' + r.service_title) : (r.order_number ? ('Order: ' + r.order_number) : 'Platform');
          var actionBtn = r.status === 'pending'
            ? '<button class="btn b-grad rep-act" data-id="' + r.id + '" data-status="resolved" style="height:28px;padding:0 10px;font-size:.7rem">Resolve</button> ' +
              '<button class="btn b-out rep-act" data-id="' + r.id + '" data-status="dismissed" style="height:28px;padding:0 10px;font-size:.7rem">Dismiss</button>'
            : '<span style="color:var(--muted);font-size:.8rem">Closed</span>';

          return '<tr>' +
            '<td><b>' + item + '</b></td>' +
            '<td>' + r.reporter_name + '<br><small style="color:var(--muted)">' + r.reporter_email + '</small></td>' +
            '<td><b>' + r.reason + '</b></td>' +
            '<td><small>' + r.details + '</small></td>' +
            '<td><span class="status-pill status-' + (r.status === 'resolved' ? 'active' : 'suspended') + '">' + r.status + '</span></td>' +
            '<td>' + actionBtn + '</td>' +
          '</tr>';
        }).join('');

        tbody.querySelectorAll(".rep-act").forEach(function(btn){
          btn.addEventListener("click", async function(){
            var id = btn.getAttribute("data-id");
            var status = btn.getAttribute("data-status");
            await fetch(apiHost + '/api/reports/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: status })
            });
            loadReports();
          });
        });
      }
    } catch(e) {}
  }

  loadStats();
  loadServices();
  loadUsers();
  loadOrders();
  loadReports();
})();
