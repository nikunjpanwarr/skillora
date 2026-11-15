// Skillora Consumer Dashboard Script (Phase 5, 6 & 8)

(function(){
  var user = window.Skillora && window.Skillora.user && window.Skillora.user();
  if (!user) {
    location.href = "login.html?next=" + encodeURIComponent(location.pathname + location.search);
    return;
  }

  document.getElementById("welcome-title").textContent = "Hi, " + (user.name || "Student");
  var subEl = document.getElementById("welcome-sub");
  if (subEl && user.department) {
    subEl.textContent = user.department + " • Bennett University Student";
  }

  // Tab switching
  var tabs = document.querySelectorAll(".tab-btn");
  var panels = document.querySelectorAll(".panel");

  function setTab(name) {
    tabs.forEach(function(t){ t.classList.toggle("on", t.getAttribute("data-tab") === name); });
    panels.forEach(function(p){ p.classList.toggle("on", p.id === "panel-" + name); });
  }

  tabs.forEach(function(t){
    t.addEventListener("click", function(){ setTab(t.getAttribute("data-tab")); });
  });

  var initialTab = new URLSearchParams(location.search).get("tab") || "orders";
  setTab(initialTab);

  var apiHost = (typeof Skillora !== "undefined" && Skillora.API_HOST) || ((location.port && location.port !== "3000" && location.protocol.startsWith("http")) ? "http://localhost:3000" : "");

  // Active state for review and payment modals
  var activeReviewOrderId = null;
  var activePaymentOrderId = null;
  var selectedRating = 5;

  // 1. Load Consumer Orders
  async function loadOrders() {
    var container = document.getElementById("orders-container");
    try {
      var res = await fetch(apiHost + '/api/orders/my-orders', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        if (!data.orders || data.orders.length === 0) {
          container.innerHTML = '<div class="empty-card" style="grid-column:1/-1">' +
            '<div class="empty-icon">✦</div>' +
            '<h4>No Active Orders</h4>' +
            '<p>You haven’t placed any service orders yet. Connect with verified Bennett student creators!</p>' +
            '<a class="btn b-grad" href="explore.html" style="margin-top:16px;display:inline-flex">Explore Campus Services</a>' +
          '</div>';
          return;
        }

        container.innerHTML = data.orders.map(function(o){
          var actions = '';
          if (o.status === 'pending') {
            actions = '<button class="btn b-grad pay-btn" data-id="' + o.id + '" data-no="' + o.order_number + '" data-amt="' + o.price + '" type="button">Pay & Escrow</button>' +
                      '<button class="btn b-out cancel-btn" data-id="' + o.id + '" style="color:var(--blush-i)" type="button">Cancel</button>';
          } else if (o.status === 'delivered') {
            actions = '<button class="btn b-grad complete-btn" data-id="' + o.id + '" type="button">Confirm Completion</button>';
          } else if (o.status === 'completed') {
            if (o.review_id) {
              actions = '<span style="font-weight:700;color:#f59e0b">' + o.review_rating + ' ★ Reviewed</span>';
            } else {
              actions = '<button class="btn b-dark review-btn" data-id="' + o.id + '" type="button">Leave Review</button>';
            }
          }

          var chatBtn = '<button class="btn b-out chat-btn" data-id="' + o.id + '" data-no="' + o.order_number + '" data-partner="' + o.producer_name + '" style="height:32px;padding:0 12px;font-size:.75rem" type="button">Chat</button>';

          return '<div class="order-card">' +
            '<div>' +
              '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
                '<strong style="font-size:1.05rem">' + o.order_number + '</strong>' +
                '<span class="status-pill status-' + o.status + '">' + o.status.replace('_', ' ') + '</span>' +
              '</div>' +
              '<div style="font-weight:700;font-size:1.1rem;color:var(--fg)">' + o.service_title + '</div>' +
              '<div style="font-size:.875rem;color:var(--muted);margin-top:4px">Producer: <b>' + o.producer_name + '</b> (' + o.producer_dept + ')</div>' +
              '<div style="font-size:.875rem;color:var(--muted);margin-top:4px">Requirements: <i>"' + o.requirements + '"</i></div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">' +
              '<div style="font-size:1.35rem;font-weight:800;font-family:Bricolage Grotesque,sans-serif">₹' + o.price + '</div>' +
              '<div style="display:flex;gap:8px;align-items:center">' + actions + chatBtn + '</div>' +
            '</div>' +
          '</div>';
        }).join('');

        // Wire Action Handlers
        container.querySelectorAll(".cancel-btn").forEach(function(btn){
          btn.addEventListener("click", async function(){
            if (!confirm("Are you sure you want to cancel this order?")) return;
            var id = btn.getAttribute("data-id");
            var cRes = await fetch(apiHost + '/api/orders/' + id + '/cancel', { method: 'PATCH', credentials: 'include' });
            if (cRes.ok) {
              window.showToast("Order cancelled successfully.", "info");
              loadOrders();
            } else {
              window.showToast("Could not cancel order.", "error");
            }
          });
        });

        container.querySelectorAll(".complete-btn").forEach(function(btn){
          btn.addEventListener("click", async function(){
            var id = btn.getAttribute("data-id");
            var compRes = await fetch(apiHost + '/api/orders/' + id + '/complete', { method: 'PATCH', credentials: 'include' });
            if (compRes.ok) {
              window.showToast("Order confirmed complete! Please leave a review.", "success");
              loadOrders();
            } else {
              window.showToast("Failed to confirm order completion.", "error");
            }
          });
        });

        container.querySelectorAll(".review-btn").forEach(function(btn){
          btn.addEventListener("click", function(){
            activeReviewOrderId = btn.getAttribute("data-id");
            document.getElementById("review-modal").classList.add("open");
          });
        });

        container.querySelectorAll(".pay-btn").forEach(function(btn){
          btn.addEventListener("click", function(){
            activePaymentOrderId = btn.getAttribute("data-id");
            document.getElementById("pay-order-no").textContent = btn.getAttribute("data-no");
            document.getElementById("pay-amount").textContent = "₹" + btn.getAttribute("data-amt");
            document.getElementById("payment-modal").classList.add("open");
          });
        });
      }
    } catch(e) {}
  }

  // 2. Load Saved Favorites
  async function loadFavorites() {
    var grid = document.getElementById("favs-grid");
    try {
      var res = await fetch(apiHost + '/api/favorites', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        if (!data.favorites || data.favorites.length === 0) {
          grid.innerHTML = '<p class="empty" style="grid-column:1/-1;text-align:center;padding:48px 16px;color:var(--muted)">You haven’t saved any services yet. Heart services on Explore to view them here.</p>';
          return;
        }

        grid.innerHTML = data.favorites.map(function(s){
          return '<article class="card sc">' +
            '<div class="top ' + s.tone + '">' +
              '<span class="tag">' + s.category_name + '</span>' +
              '<button class="heart rm-fav" data-id="' + s.id + '" style="color:var(--blush-i)" type="button"><svg class="ic" style="fill:var(--blush-i)"><use href="#heart"/></svg></button>' +
            '</div>' +
            '<div class="bd">' +
              '<h3 class="disp">' + s.title + '</h3>' +
              '<p>' + s.desc + '</p>' +
              '<div class="foot">' +
                '<strong>' + s.price + '</strong>' +
                '<a href="service-detail.html?id=' + s.id + '" class="btn b-out" style="height:32px;padding:0 12px;font-size:.75rem">View</a>' +
              '</div>' +
            '</div>' +
          '</article>';
        }).join('');

        grid.querySelectorAll(".rm-fav").forEach(function(b){
          b.addEventListener("click", async function(){
            var id = b.getAttribute("data-id");
            await fetch(apiHost + '/api/favorites/' + id, { method: 'DELETE', credentials: 'include' });
            loadFavorites();
          });
        });
      }
    } catch(e) {}
  }

  // 3. Load Notifications
  async function loadNotifications() {
    var list = document.getElementById("notifs-list");
    var badge = document.getElementById("notif-badge");
    try {
      var res = await fetch(apiHost + '/api/notifications', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        if (data.unreadCount > 0) {
          badge.textContent = data.unreadCount;
          badge.style.display = "inline";
        } else {
          badge.style.display = "none";
        }

        if (!data.notifications || data.notifications.length === 0) {
          list.innerHTML = '<p class="empty" style="text-align:center;padding:32px;color:var(--muted)">No notifications.</p>';
          return;
        }

        list.innerHTML = data.notifications.map(function(n){
          return '<div class="notif-item ' + (n.is_read ? '' : 'unread') + '">' +
            '<div>' +
              '<div style="font-weight:700">' + n.title + '</div>' +
              '<div style="font-size:.875rem;color:var(--muted);margin-top:2px">' + n.message + '</div>' +
            '</div>' +
            (n.link ? '<a href="' + n.link + '" class="btn b-out" style="height:28px;padding:0 10px;font-size:.75rem">View</a>' : '') +
          '</div>';
        }).join('');
      }
    } catch(e) {}
  }

  document.getElementById("mark-all-btn").addEventListener("click", async function(){
    await fetch(apiHost + '/api/notifications/mark-all-read', { method: 'POST', credentials: 'include' });
    loadNotifications();
  });

  // Review Modal Wiring
  var reviewModal = document.getElementById("review-modal");
  var stars = document.querySelectorAll("#star-picker span");
  function setStars(val) {
    selectedRating = val;
    stars.forEach(function(s){
      s.classList.toggle("on", parseInt(s.getAttribute("data-val"), 10) <= val);
    });
  }
  setStars(5);
  stars.forEach(function(s){
    s.addEventListener("click", function(){ setStars(parseInt(s.getAttribute("data-val"), 10)); });
  });

  document.getElementById("cancel-review-btn").addEventListener("click", function(){
    reviewModal.classList.remove("open");
  });

  document.getElementById("submit-review-btn").addEventListener("click", async function(){
    if (!activeReviewOrderId) return;
    var comment = document.getElementById("review-comment").value.trim();

    var res = await fetch(apiHost + '/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        order_id: activeReviewOrderId,
        rating: selectedRating,
        comment: comment
      })
    });

    if (res.ok) {
      window.showToast("Thank you! Your verified review was recorded.", "success");
      reviewModal.classList.remove("open");
      loadOrders();
    } else {
      var err = await res.json();
      window.showToast(err.error || "Failed to submit review", "error");
    }
  });

  // Payment Modal Wiring (Phase 8 Escrow Flow)
  var payModal = document.getElementById("payment-modal");
  document.getElementById("cancel-pay-btn").addEventListener("click", function(){
    payModal.classList.remove("open");
  });

  document.getElementById("confirm-pay-btn").addEventListener("click", async function(){
    if (!activePaymentOrderId) return;
    var btn = document.getElementById("confirm-pay-btn");
    btn.disabled = true;

    try {
      // 1. Create intent
      var intentRes = await fetch(apiHost + '/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order_id: activePaymentOrderId, payment_method: 'campus_upi' })
      });
      var intentData = await intentRes.json();

      // 2. Verify payment
      var verifyRes = await fetch(apiHost + '/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transaction_id: intentData.transaction_id })
      });

      if (verifyRes.ok) {
        window.showToast("Payment successful! Funds held in Bennett Escrow and order is In Progress.", "success");
        payModal.classList.remove("open");
        loadOrders();
      } else {
        window.showToast("Payment verification failed.", "error");
      }
    } catch(err) {
      window.showToast("Payment processing error. Please try again.", "error");
    } finally {
      btn.disabled = false;
    }
  });

  // Chat Modal Wiring (Phase 9)
  var chatModal = document.getElementById("chat-modal");
  var activeChatOrderId = null;
  var chatMessagesEl = document.getElementById("chat-messages");
  var chatInput = document.getElementById("chat-input");

  async function loadChatMessages(orderId) {
    if (!orderId) return;
    try {
      var res = await fetch(apiHost + '/api/messages/order/' + orderId, { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        chatMessagesEl.innerHTML = data.messages.map(function(m){
          var isMe = m.sender_id === user.id;
          return '<div style="align-self:' + (isMe ? 'flex-end' : 'flex-start') + ';max-width:75%;padding:8px 14px;border-radius:14px;background:' + (isMe ? 'var(--primary);color:#fff' : 'var(--bg);border:1px solid var(--border)') + ';font-size:.875rem">' +
            '<div style="font-size:.7rem;opacity:.7;margin-bottom:2px">' + (isMe ? 'You' : m.sender_name) + '</div>' +
            '<div>' + m.message + '</div>' +
          '</div>';
        }).join('');
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      }
    } catch(e) {}
  }

  document.getElementById("close-chat-btn").addEventListener("click", function(){
    chatModal.classList.remove("open");
  });

  document.getElementById("chat-form").addEventListener("submit", async function(e){
    e.preventDefault();
    var msg = chatInput.value.trim();
    if (!msg || !activeChatOrderId) return;
    chatInput.value = "";

    try {
      var res = await fetch(apiHost + '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order_id: activeChatOrderId, message: msg })
      });
      if (res.ok) {
        loadChatMessages(activeChatOrderId);
      }
    } catch(err) {}
  });

  // Attach click listener for chat buttons in loadOrders
  var prevLoadOrders = loadOrders;
  loadOrders = async function() {
    await prevLoadOrders();
    document.querySelectorAll(".chat-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        activeChatOrderId = btn.getAttribute("data-id");
        document.getElementById("chat-order-no").textContent = btn.getAttribute("data-no");
        document.getElementById("chat-partner-name").textContent = "Chat: " + btn.getAttribute("data-partner");
        chatModal.classList.add("open");
        loadChatMessages(activeChatOrderId);
      });
    });
  };

  loadOrders();
  loadFavorites();
  loadNotifications();
})();
