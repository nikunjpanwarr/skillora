// Skillora Explore Services (Phase 3 Dynamic API Integration with Fallback)

(function(){
  var cat = new URLSearchParams(location.search).get("category") || "";
  var q = "";
  var chips = document.getElementById("chips");
  var grid = document.getElementById("grid");
  var count = document.getElementById("count");
  var input = document.getElementById("q");

  var apiHost = (typeof Skillora !== "undefined" && Skillora.API_HOST) || ((location.port && location.port !== "3000" && location.protocol.startsWith("http")) ? "http://localhost:3000" : "");
  var categories = (typeof CATEGORIES !== "undefined") ? CATEGORIES : [];
  var services = (typeof SERVICES !== "undefined") ? SERVICES : [];
  var isApiMode = false;
  var isLoading = false;

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function card(s) {
    var c = categories.filter(function(x) { return x.slug == s.category; })[0] || {
      icon: s.icon || "pen",
      tone: s.tone || "B",
      name: s.category_name || ""
    };
    var creatorName = s.creator || "Student Producer";
    var dept = s.dept || "Bennett University";
    var ini = creatorName.split(" ").map(function(w) { return w[0]; }).join("").slice(0, 2);
    var serviceId = s.id || "";

    return '<article class="card sc lift service-card" data-id="' + esc(serviceId) + '" style="cursor:pointer">' +
      '<div class="top ' + c.tone + '">' +
        '<svg class="ic"><use href="#' + c.icon + '"/></svg>' +
        '<span class="tag">' + esc(s.sample ? "Sample listing" : (c.name || "Service")) + '</span>' +
        '<button class="heart" type="button" aria-label="Save service" aria-pressed="false" onclick="event.stopPropagation()">' +
          '<svg class="ic" style="width:16px;height:16px"><use href="#heart"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="bd">' +
        '<div class="who">' +
          '<b>' + esc(ini) + '</b>' +
          '<span style="font-weight:500">' + esc(creatorName) + '</span>' +
          '<small>· ' + esc(dept) + '</small>' +
        '</div>' +
        '<h3 class="disp">' + esc(s.title) + '</h3>' +
        '<p>' + esc(s.desc) + '</p>' +
        '<div class="foot">' +
          '<div><small>Starting at</small><strong>' + esc(s.price) + '</strong></div>' +
          '<span class="ex ' + c.tone + '">' + esc(s.badge || "Available") + '</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function drawChips() {
    if (!chips) return;
    var h = '<button class="chip' + (cat ? '' : ' on') + '" data-c="" type="button">All</button>';
    categories.forEach(function(c) {
      h += '<button class="chip' + (cat == c.slug ? ' on' : '') + '" data-c="' + c.slug + '" type="button">' +
           '<svg class="ic"><use href="#' + c.icon + '"/></svg>' + esc(c.name) + '</button>';
    });
    chips.innerHTML = h;
  }

  function renderList(list) {
    if (!count || !grid) return;
    count.textContent = list.length + " service" + (list.length === 1 ? "" : "s") + " found";
    grid.innerHTML = list.length 
      ? list.map(card).join("") 
      : '<div class="empty-card" style="grid-column:1/-1">' +
          '<div class="empty-icon"><svg class="ic" style="width:24px;height:24px"><use href="#srch"/></svg></div>' +
          '<h4>No Services Found</h4>' +
          '<p>No services match your search query or filter. Try adjusting your keywords or category.</p>' +
          '<button class="btn b-out" id="clear-filters-btn" style="margin-top:16px" type="button">View All Services</button>' +
        '</div>';

    var clearBtn = document.getElementById("clear-filters-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", function(){
        cat = "";
        q = "";
        if (input) input.value = "";
        drawChips();
        fetchServices();
      });
    }
  }

  async function fetchServices() {
    if (!grid) return;
    isLoading = true;

    // Show skeleton loading placeholders while fetching
    grid.innerHTML = [1, 2, 3, 4].map(function(){
      return '<article class="card sc" style="pointer-events:none;opacity:.7">' +
        '<div class="skeleton" style="height:110px;border-radius:24px 24px 0 0"></div>' +
        '<div class="bd" style="display:flex;flex-direction:column;gap:12px;padding:24px">' +
          '<div class="skeleton" style="height:18px;width:50%"></div>' +
          '<div class="skeleton" style="height:22px;width:85%"></div>' +
          '<div class="skeleton" style="height:14px;width:70%"></div>' +
          '<div class="skeleton" style="height:30px;width:40%;margin-top:10px"></div>' +
        '</div>' +
      '</article>';
    }).join('');

    try {
      var url = apiHost + '/api/services?category=' + encodeURIComponent(cat) + '&q=' + encodeURIComponent(q);
      var res = await fetch(url);
      if (res.ok) {
        var data = await res.json();
        if (data && Array.isArray(data.services)) {
          isApiMode = true;
          renderList(data.services);
          isLoading = false;
          return;
        }
      }
    } catch(err) {
      // API offline or request failed
    }

    isLoading = false;
    renderLocalFallback();
  }

  function renderLocalFallback() {
    var t = q.trim().toLowerCase();
    var list = services.filter(function(s) {
      if (cat && s.category != cat) return false;
      if (!t) return true;
      var c = categories.filter(function(x) { return x.slug == s.category; })[0];
      return (s.title + " " + s.desc + " " + (s.creator || "") + " " + (c ? c.name : "")).toLowerCase().indexOf(t) > -1;
    });
    renderList(list);
  }

  async function loadCategories() {
    try {
      var res = await fetch(apiHost + '/api/categories');
      if (res.ok) {
        var data = await res.json();
        if (data && Array.isArray(data.categories) && data.categories.length > 0) {
          categories = data.categories;
          drawChips();
        }
      }
    } catch(e) {}
  }

  // Click on card opens Service Detail
  if (grid) {
    grid.addEventListener("click", function(e) {
      var cardEl = e.target.closest(".service-card");
      if (!cardEl) return;
      if (e.target.closest(".heart")) return; // ignore heart clicks

      var id = cardEl.getAttribute("data-id");
      if (id) {
        location.href = "service-detail.html?id=" + encodeURIComponent(id);
      }
    });
  }

  // Chips filtering
  if (chips) {
    chips.addEventListener("click", function(e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      cat = b.getAttribute("data-c") || "";
      history.replaceState(null, "", cat ? "?category=" + encodeURIComponent(cat) : location.pathname);
      drawChips();
      fetchServices();
    });
  }

  // Search input debouncing
  var debounceTimer;
  if (input) {
    input.addEventListener("input", function() {
      q = input.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchServices, 250);
    });
  }

  drawChips();
  loadCategories().then(fetchServices);
})();
