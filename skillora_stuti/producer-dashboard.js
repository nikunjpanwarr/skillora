// Skillora Producer Dashboard Script (Phase 4)

(function(){
  var user = window.Skillora && window.Skillora.user && window.Skillora.user();
  if (!user) {
    location.href = "login.html?next=" + encodeURIComponent(location.pathname + location.search);
    return;
  }

  document.getElementById("welcome-name").textContent = "Hi, " + (user.name || "Producer");
  var deptEl = document.getElementById("welcome-dept");
  if (deptEl && user.department) {
    deptEl.textContent = user.department + " • Bennett Verified Campus Creator";
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

  var initialTab = new URLSearchParams(location.search).get("tab") || "listings";
  setTab(initialTab);

  var apiHost = (typeof Skillora !== "undefined" && Skillora.API_HOST) || ((location.port && location.port !== "3000" && location.protocol.startsWith("http")) ? "http://localhost:3000" : "");

  document.getElementById("btn-create-top").addEventListener("click", function(){
    setTab("create");
  });

  // 1. Fetch Stats
  async function loadStats() {
    try {
      var res = await fetch(apiHost + '/api/producer/stats', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        document.getElementById("stat-earnings").textContent = "₹" + (data.orders.earnings || 0).toLocaleString();
        document.getElementById("stat-listings").textContent = data.listings.active || 0;
        document.getElementById("stat-pending").textContent = data.orders.pending || 0;
        document.getElementById("stat-completed").textContent = data.orders.completed || 0;
      }
    } catch(e) {}
  }

  // 2. Load Categories (Supports selection or writing custom category)
  async function loadCategories() {
    var select = document.getElementById("srv-cat");
    var customBox = document.getElementById("custom-cat-box");
    var customInput = document.getElementById("srv-cat-custom");
    if (!select) return;

    function populate(list) {
      if (!list || !list.length) return;
      var curVal = select.value;
      select.innerHTML = '<option value="">-- Choose a Category --</option>' +
        list.map(function(c){
          return '<option value="' + c.slug + '">' + (c.name || c.slug) + '</option>';
        }).join('') +
        '<option value="__custom__">✍️ Other / Write your own category...</option>';
      if (curVal) select.value = curVal;
    }

    // 1. If options not present, immediately use local CATEGORIES fallback
    if (select.options.length <= 1 && typeof CATEGORIES !== "undefined" && CATEGORIES.length) {
      populate(CATEGORIES);
    }

    // 2. Try updating from dynamic backend API
    try {
      var res = await fetch(apiHost + '/api/categories');
      if (res.ok) {
        var data = await res.json();
        if (data && data.categories && data.categories.length) {
          populate(data.categories);
        }
      }
    } catch(e) {
      // Backend offline: static HTML options and CATEGORIES fallback ensure dropdown is never empty
    }

    select.addEventListener("change", function(){
      if (select.value === "__custom__") {
        if (customBox) customBox.style.display = "block";
        if (customInput) {
          customInput.required = true;
          customInput.focus();
        }
      } else {
        if (customBox) customBox.style.display = "none";
        if (customInput) {
          customInput.required = false;
          customInput.value = "";
        }
      }
    });
  }

  // 3. Load Producer Services
  async function loadServices() {
    var grid = document.getElementById("listings-grid");
    try {
      var res = await fetch(apiHost + '/api/producer/services', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        if (!data.services || data.services.length === 0) {
          grid.innerHTML = '<p class="empty" style="grid-column:1/-1;text-align:center;padding:48px 16px;color:var(--muted)">You haven’t published any services yet. Click "+ New Service" to get started!</p>';
          return;
        }

        grid.innerHTML = data.services.map(function(s){
          return '<article class="card sc">' +
            '<div class="top ' + s.category_tone + '">' +
              '<span class="tag">' + s.category_name + '</span>' +
              '<span class="status-pill status-' + s.status + '" style="position:absolute;right:16px;top:16px">' + s.status + '</span>' +
            '</div>' +
            '<div class="bd">' +
              '<h3 class="disp">' + s.title + '</h3>' +
              '<p>' + s.description + '</p>' +
              '<div class="foot">' +
                '<strong>' + s.price_display + '</strong>' +
                '<div style="display:flex;gap:6px">' +
                  '<a href="service-detail.html?id=' + s.id + '" class="btn b-out" style="height:32px;padding:0 12px;font-size:.75rem">View</a>' +
                  (s.status === 'active' 
                    ? '<button class="btn b-out deact-btn" data-id="' + s.id + '" style="height:32px;padding:0 12px;font-size:.75rem;color:var(--blush-i)" type="button">Deactivate</button>' 
                    : '') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</article>';
        }).join('');

        grid.querySelectorAll(".deact-btn").forEach(function(b){
          b.addEventListener("click", async function(){
            if (!confirm("Are you sure you want to deactivate this listing?")) return;
            var id = b.getAttribute("data-id");
            var delRes = await fetch(apiHost + '/api/producer/services/' + id, { method: 'DELETE', credentials: 'include' });
            if (delRes.ok) {
              loadServices();
              loadStats();
            }
          });
        });
      }
    } catch(e) {}
  }

  // 4. Load Incoming Orders
  async function loadOrders() {
    var list = document.getElementById("orders-list");
    try {
      var res = await fetch(apiHost + '/api/producer/orders', { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        if (!data.orders || data.orders.length === 0) {
          list.innerHTML = '<p class="empty" style="text-align:center;padding:48px 16px;color:var(--muted)">No orders received yet.</p>';
          return;
        }

        list.innerHTML = data.orders.map(function(o){
          var actions = '';
          if (o.status === 'pending') {
            actions = '<button class="btn b-grad order-act" data-id="' + o.id + '" data-status="accepted" type="button">Accept</button>' +
                      '<button class="btn b-out order-act" data-id="' + o.id + '" data-status="rejected" style="color:var(--blush-i)" type="button">Reject</button>';
          } else if (o.status === 'accepted') {
            actions = '<button class="btn b-dark order-act" data-id="' + o.id + '" data-status="in_progress" type="button">Start Work</button>';
          } else if (o.status === 'in_progress') {
            actions = '<button class="btn b-grad order-act" data-id="' + o.id + '" data-status="delivered" type="button">Mark Delivered</button>';
          }

          var chatBtn = '<button class="btn b-out prod-chat-btn" data-id="' + o.id + '" data-no="' + o.order_number + '" data-partner="' + o.consumer_name + '" style="height:32px;padding:0 12px;font-size:.75rem" type="button">Chat</button>';

          return '<div class="order-card">' +
            '<div>' +
              '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
                '<strong style="font-size:1.05rem">' + o.order_number + '</strong>' +
                '<span class="status-pill status-' + o.status + '">' + o.status.replace('_', ' ') + '</span>' +
              '</div>' +
              '<div style="font-weight:600;color:var(--fg)">' + o.service_title + '</div>' +
              '<div style="font-size:.875rem;color:var(--muted);margin-top:4px">Buyer: <b>' + o.consumer_name + '</b> (' + o.consumer_dept + ')</div>' +
              '<div style="font-size:.875rem;color:var(--muted);margin-top:4px">Requirements: <i>"' + o.requirements + '"</i></div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">' +
              '<div style="font-size:1.25rem;font-weight:800;font-family:Bricolage Grotesque,sans-serif">₹' + o.price + '</div>' +
              '<div style="display:flex;gap:8px;align-items:center">' + actions + chatBtn + '</div>' +
            '</div>' +
          '</div>';
        }).join('');

        list.querySelectorAll(".order-act").forEach(function(btn){
          btn.addEventListener("click", async function(){
            var orderId = btn.getAttribute("data-id");
            var status = btn.getAttribute("data-status");
            btn.disabled = true;

            var res = await fetch(apiHost + '/api/producer/orders/' + orderId + '/status', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: status })
            });

            if (res.ok) {
              if (typeof window.showToast === 'function') {
                window.showToast("Order status updated successfully!", "success");
              }
              loadOrders();
              loadStats();
            } else {
              var errData = await res.json();
              if (typeof window.showToast === 'function') {
                window.showToast(errData.error || 'Failed to update order status', 'error');
              } else {
                alert(errData.error || 'Failed to update order status');
              }
              btn.disabled = false;
            }
          });
        });
      }
    } catch(e) {}
  }
  // 5. Handle Service Creation (Mobile-Optimized & Form Validation)
  var form = document.getElementById("create-service-form");
  var msg = document.getElementById("srv-msg");
  var submitBtn = document.getElementById("btn-publish-submit") || (form && form.querySelector("button[type=submit]"));

  function showFormErr(text, elementId) {
    if (msg) msg.textContent = text;
    if (typeof window.showToast === 'function') {
      window.showToast(text, "error");
    }
    if (elementId) {
      var el = document.getElementById(elementId);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  form.addEventListener("submit", async function(e){
    e.preventDefault();
    if (msg) msg.textContent = "";

    var catSelect = document.getElementById("srv-cat");
    var customInput = document.getElementById("srv-cat-custom");
    var customBox = document.getElementById("custom-cat-box");
    var chosenCategory = (catSelect && catSelect.value === "__custom__") 
      ? (customInput ? customInput.value.trim() : "") 
      : (catSelect ? catSelect.value.trim() : "");

    var titleInput = document.getElementById("srv-title");
    var priceInput = document.getElementById("srv-price");
    var descInput = document.getElementById("srv-desc");
    var deliveryInput = document.getElementById("srv-delivery");
    var badgeInput = document.getElementById("srv-badge");
    var imageInput = document.getElementById("srv-image");

    var titleVal = titleInput ? titleInput.value.trim() : "";
    var priceVal = priceInput ? priceInput.value.trim() : "";
    var descVal = descInput ? descInput.value.trim() : "";

    // Client-side validation with instant mobile feedback
    if (!titleVal || titleVal.length < 5) {
      showFormErr("Service title must be at least 5 characters.", "srv-title");
      return;
    }

    if (!chosenCategory) {
      showFormErr("Please select a category or write your own.", "srv-cat");
      return;
    }

    if (!priceVal || isNaN(priceVal) || Number(priceVal) < 0) {
      showFormErr("Please enter a valid price (₹0 or more).", "srv-price");
      return;
    }

    if (!descVal || descVal.length < 15) {
      showFormErr("Description must be at least 15 characters long.", "srv-desc");
      return;
    }

    var hasFile = imageInput && imageInput.files && imageInput.files.length > 0;
    if (hasFile && imageInput.files[0].size > 5 * 1024 * 1024) {
      showFormErr("The selected image is larger than 5MB. Please choose a smaller photo.", "srv-image");
      return;
    }

    // Set loading state on button to prevent double-tap on mobile
    var origBtnText = submitBtn ? submitBtn.innerHTML : "Publish Listing";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.7";
      submitBtn.innerHTML = "Publishing Listing... ⏳";
    }

    try {
      var res;
      if (hasFile) {
        var formData = new FormData();
        formData.append("title", titleVal);
        formData.append("category_slug", chosenCategory);
        formData.append("price", priceVal);
        formData.append("delivery_time", deliveryInput ? deliveryInput.value.trim() : "2-3 days");
        formData.append("description", descVal);
        formData.append("badge", badgeInput ? badgeInput.value.trim() : "Available");
        formData.append("image", imageInput.files[0]);

        res = await fetch(apiHost + '/api/producer/services', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
      } else {
        var payload = {
          title: titleVal,
          category_slug: chosenCategory,
          price: priceVal,
          delivery_time: deliveryInput ? deliveryInput.value.trim() : "2-3 days",
          description: descVal,
          badge: badgeInput ? badgeInput.value.trim() : "Available"
        };

        res = await fetch(apiHost + '/api/producer/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }

      var data = await res.json();
      if (res.ok) {
        form.reset();
        if (customBox) customBox.style.display = "none";
        if (typeof window.showToast === 'function') {
          window.showToast("Service listing published successfully!", "success");
        } else {
          alert("Service listing published successfully!");
        }
        setTab("listings");
        loadServices();
        loadStats();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        var errStr = data.error || data.message || "Failed to publish service";
        showFormErr(errStr);
      }
    } catch(err) {
      showFormErr("Network error. Please check your connection and try again.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.innerHTML = origBtnText;
      }
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

  var prevLoadOrders = loadOrders;
  loadOrders = async function() {
    await prevLoadOrders();
    document.querySelectorAll(".prod-chat-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        activeChatOrderId = btn.getAttribute("data-id");
        document.getElementById("chat-order-no").textContent = btn.getAttribute("data-no");
        document.getElementById("chat-partner-name").textContent = "Chat: " + btn.getAttribute("data-partner");
        chatModal.classList.add("open");
        loadChatMessages(activeChatOrderId);
      });
    });
  };

  loadStats();
  loadCategories();
  loadServices();
  loadOrders();
})();
