// Skillora Service Detail Page Script (Phases 3, 5, 6)

(function(){
  var id = new URLSearchParams(location.search).get("id");
  var loadingEl = document.getElementById("service-loading");
  var contentEl = document.getElementById("service-content");

  var tagEl = document.getElementById("s-tag");
  var titleEl = document.getElementById("s-title");
  var descEl = document.getElementById("s-desc");
  var avatarEl = document.getElementById("s-avatar");
  var creatorEl = document.getElementById("s-creator");
  var deptEl = document.getElementById("s-dept");
  var priceEl = document.getElementById("s-price");
  var deliveryEl = document.getElementById("s-delivery");
  var badgeEl = document.getElementById("s-badge");
  var sampleBanner = document.getElementById("s-sample-banner");
  var orderBtn = document.getElementById("order-btn");
  var favBtn = document.getElementById("fav-btn");
  var favLabel = document.getElementById("fav-label");

  // Modal elements
  var orderModal = document.getElementById("order-modal");
  var modalPrice = document.getElementById("modal-service-price");
  var modalReqs = document.getElementById("order-requirements");
  var modalErr = document.getElementById("order-modal-err");
  var confirmOrderBtn = document.getElementById("confirm-order-btn");
  var cancelOrderModalBtn = document.getElementById("cancel-order-modal-btn");

  var apiHost = (typeof Skillora !== "undefined" && Skillora.API_HOST) || ((location.port && location.port !== "3000" && location.protocol.startsWith("http")) ? "http://localhost:3000" : "");
  var currentService = null;
  var isFavorited = false;

  function render(s) {
    if (!s) {
      loadingEl.innerHTML = '<p class="empty" style="color:var(--muted)">Service listing not found. <a href="explore.html" style="text-decoration:underline">Return to Explore</a></p>';
      return;
    }

    currentService = s;
    document.title = (s.title || "Service Details") + " — Skillora";

    var creator = s.creator || "Student Producer";
    var initials = creator.split(" ").map(function(w){ return w[0]; }).join("").slice(0, 2);
    var tone = s.tone || "B";

    tagEl.textContent = s.sample ? "Sample Listing" : (s.category_name || s.category || "Service");
    tagEl.className = "detail-tag tag " + tone;

    titleEl.textContent = s.title;
    descEl.textContent = s.desc || s.description || "No description provided.";

    avatarEl.textContent = initials;
    creatorEl.textContent = creator;
    deptEl.textContent = s.dept || "Bennett University";

    priceEl.textContent = s.price || "Contact for price";
    modalPrice.textContent = s.price || "Contact for price";
    deliveryEl.textContent = s.delivery_time || "2-3 days";
    badgeEl.textContent = s.badge || "Available";

    if (s.sample && sampleBanner) {
      sampleBanner.hidden = false;
    }

    loadingEl.style.display = "none";
    contentEl.style.display = "block";

    loadReviews();
    checkFavorite();
  }

  async function loadDetail() {
    if (!id) {
      render(null);
      return;
    }

    try {
      var res = await fetch(apiHost + '/api/services/' + encodeURIComponent(id));
      if (res.ok) {
        var data = await res.json();
        if (data && data.service) {
          render(data.service);
          return;
        }
      }
    } catch(err) {}

    // Fallback
    if (typeof SERVICES !== "undefined" && SERVICES[0]) {
      var match = SERVICES[0];
      render({
        id: id,
        title: match.title,
        desc: match.desc,
        category: match.category,
        category_name: "Graphic Design",
        tone: "B",
        creator: match.creator,
        dept: match.dept,
        price: match.price,
        badge: match.badge,
        sample: true
      });
      return;
    }

    render(null);
  }

  // Check if service is favorited
  async function checkFavorite() {
    if (!favBtn || !id) return;
    try {
      var res = await fetch(apiHost + '/api/favorites/check/' + encodeURIComponent(id), { credentials: 'include' });
      if (res.ok) {
        var data = await res.json();
        isFavorited = Boolean(data.favorited);
        updateFavBtn();
      }
    } catch(e) {}
  }

  function updateFavBtn() {
    if (!favBtn) return;
    var heartSvg = favBtn.querySelector("svg");
    if (isFavorited) {
      favLabel.textContent = "Saved in Favourites";
      heartSvg.style.fill = "var(--blush-i)";
      favBtn.style.color = "var(--blush-i)";
    } else {
      favLabel.textContent = "Save to Favourites";
      heartSvg.style.fill = "none";
      favBtn.style.color = "var(--fg)";
    }
  }

  if (favBtn) {
    favBtn.addEventListener("click", async function() {
      var u = window.Skillora && window.Skillora.user && window.Skillora.user();
      if (!u) {
        location.href = "login.html?next=" + encodeURIComponent(location.pathname + location.search);
        return;
      }
      var method = isFavorited ? 'DELETE' : 'POST';
      try {
        var res = await fetch(apiHost + '/api/favorites/' + encodeURIComponent(id), {
          method: method,
          credentials: 'include'
        });
        if (res.ok) {
          isFavorited = !isFavorited;
          updateFavBtn();
        }
      } catch(e) {}
    });
  }

  // Order Placement Modal
  if (orderBtn) {
    orderBtn.addEventListener("click", function() {
      var u = window.Skillora && window.Skillora.user && window.Skillora.user();
      if (!u) {
        location.href = "login.html?next=" + encodeURIComponent(location.pathname + location.search);
        return;
      }
      modalErr.textContent = "";
      modalReqs.value = "";
      orderModal.classList.add("open");
    });
  }

  if (cancelOrderModalBtn) {
    cancelOrderModalBtn.addEventListener("click", function() {
      orderModal.classList.remove("open");
    });
  }

  if (confirmOrderBtn) {
    confirmOrderBtn.addEventListener("click", async function() {
      var reqs = modalReqs.value.trim();
      if (reqs.length < 5) {
        modalErr.textContent = "Please describe your project requirements (at least 5 characters).";
        return;
      }

      modalErr.textContent = "";
      confirmOrderBtn.disabled = true;

      try {
        var res = await fetch(apiHost + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            service_id: id,
            requirements: reqs
          })
        });

        var data = await res.json();
        if (res.ok) {
          orderModal.classList.remove("open");
          if (typeof window.showToast === 'function') {
            window.showToast("Order " + data.order.order_number + " placed successfully!", "success");
          }
          setTimeout(function() {
            location.href = "consumer-dashboard.html?tab=orders";
          }, 600);
        } else {
          modalErr.textContent = data.error || "Failed to place order.";
        }
      } catch(err) {
        modalErr.textContent = "Network error. Please try again.";
      } finally {
        confirmOrderBtn.disabled = false;
      }
    });
  }

  // Load Reviews
  async function loadReviews() {
    var listEl = document.getElementById("reviews-list");
    var avgBadge = document.getElementById("rating-avg-badge");
    var subEl = document.getElementById("reviews-sub");
    if (!listEl) return;

    try {
      var res = await fetch(apiHost + '/api/reviews/service/' + encodeURIComponent(id));
      if (res.ok) {
        var data = await res.json();
        if (data.stats && data.stats.totalReviews > 0) {
          avgBadge.textContent = data.stats.averageRating + " ★";
          subEl.textContent = "Based on " + data.stats.totalReviews + " verified student review" + (data.stats.totalReviews === 1 ? "" : "s");
        } else {
          avgBadge.textContent = "";
          subEl.textContent = "No student reviews yet for this listing.";
        }

        if (!data.reviews || data.reviews.length === 0) {
          listEl.innerHTML = '<p style="color:var(--muted);font-size:.9rem;padding:8px 0">Be the first Bennett student to order and review this service!</p>';
          return;
        }

        listEl.innerHTML = data.reviews.map(function(r){
          var stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
          return '<div class="review-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
              '<div>' +
                '<b>' + r.consumer_name + '</b>' +
                '<small style="color:var(--muted);margin-left:8px">· ' + (r.consumer_dept || 'Bennett Student') + '</small>' +
              '</div>' +
              '<div style="color:#f59e0b;font-weight:700">' + stars + '</div>' +
            '</div>' +
            '<p style="color:var(--fg);font-size:.95rem;margin:0">' + (r.comment || 'Verified completion.') + '</p>' +
          '</div>';
        }).join('');
      }
    } catch(e) {}
  }

  // Report Modal Wiring (Phase 10)
  var reportModal = document.getElementById("report-modal");
  var openReportBtn = document.getElementById("open-report-btn");
  var cancelReportBtn = document.getElementById("cancel-report-btn");
  var submitReportBtn = document.getElementById("submit-report-btn");

  if (openReportBtn) {
    openReportBtn.addEventListener("click", function(){
      var u = window.Skillora && window.Skillora.user && window.Skillora.user();
      if (!u) {
        location.href = "login.html?next=" + encodeURIComponent(location.pathname + location.search);
        return;
      }
      reportModal.classList.add("open");
    });
  }

  if (cancelReportBtn) {
    cancelReportBtn.addEventListener("click", function(){
      reportModal.classList.remove("open");
    });
  }

  if (submitReportBtn) {
    submitReportBtn.addEventListener("click", async function(){
      var reason = document.getElementById("report-reason").value;
      var details = document.getElementById("report-details").value.trim();
      if (details.length < 10) {
        if (typeof window.showToast === 'function') {
          window.showToast("Please provide at least 10 characters explaining your report.", "error");
        } else {
          alert("Please provide at least 10 characters explaining your report.");
        }
        return;
      }
      submitReportBtn.disabled = true;

      try {
        var res = await fetch(apiHost + '/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            service_id: id,
            reason: reason,
            details: details
          })
        });

        if (res.ok) {
          if (typeof window.showToast === 'function') {
            window.showToast("Your report has been submitted to Bennett Moderation.", "info");
          } else {
            alert("Thank you. Your report has been submitted to Bennett Moderation.");
          }
          reportModal.classList.remove("open");
          document.getElementById("report-details").value = "";
        } else {
          var err = await res.json();
          if (typeof window.showToast === 'function') {
            window.showToast(err.error || "Failed to submit report.", "error");
          } else {
            alert(err.error || "Failed to submit report.");
          }
        }
      } catch(e) {
        if (typeof window.showToast === 'function') {
          window.showToast("Network error. Please try again.", "error");
        } else {
          alert("Network error.");
        }
      } finally {
        submitReportBtn.disabled = false;
      }
    });
  }

  loadDetail();
})();
