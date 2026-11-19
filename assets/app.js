/* 요긴상회 · 생활꿀템 번호 검색
   - 상품은 src/data/products.json 만 고치면 바로 반영됩니다. (번호, 상품명, 키워드, 가격, 파트너스 링크)
   - 딥링크: https://<주소>/?n=002 또는 #002 로 들어오면 그 번호가 자동 검색됩니다. */
(function () {
  "use strict";

  var DATA_URL = "src/data/products.json";
  var state = { products: [], query: "" };

  var el = {
    list: document.getElementById("list"),
    empty: document.getElementById("empty"),
    q: document.getElementById("q"),
    clear: document.getElementById("clearBtn"),
    count: document.getElementById("resultCount"),
    chips: document.getElementById("heroChips"),
    reset: document.getElementById("resetBtn"),
    searchbar: document.getElementById("searchbar")
  };

  function won(n) {
    return Number(n).toLocaleString("ko-KR") + "원";
  }

  function normalize(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, "");
  }

  function digitsOf(s) {
    var m = String(s || "").match(/\d+/);
    return m ? String(parseInt(m[0], 10)) : "";
  }

  /* ---------- 검색 ---------- */
  function matches(product, rawQuery) {
    var q = normalize(rawQuery);
    if (!q) return true;

    var haystack = normalize(
      [product.no, product.title, product.short, product.point, product.badge]
        .concat(product.keywords || [])
        .join(" ")
    );

    if (haystack.indexOf(q) !== -1) return true;

    // 숫자만 입력한 경우: 2 → 002, 001, 12 → 012
    var qd = digitsOf(rawQuery);
    if (qd && /^\d+$/.test(q)) {
      var pd = digitsOf(product.no);
      if (pd && parseInt(pd, 10) === parseInt(qd, 10)) return true;
      if (haystack.indexOf(qd) !== -1) return true;
    }
    return false;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function highlight(text, rawQuery) {
    var q = (rawQuery || "").trim();
    var safe = escapeHtml(text);
    if (!q) return safe;
    if (/^\d+$/.test(q)) return safe; // 숫자는 배지로 충분
    var needle = escapeHtml(q);
    var re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return safe.replace(re, function (m) {
      return "<mark>" + m + "</mark>";
    });
  }

  /* ---------- 렌더 ---------- */
  function cardHtml(p, rawQuery) {
    var price = "";
    if (p.price) {
      price =
        (p.discount ? '<span class="card__discount">' + p.discount + "%</span>" : "") +
        '<span class="card__now">' + won(p.price) + "</span>" +
        (p.originalPrice
          ? '<span class="card__was">' + won(p.originalPrice) + "</span>"
          : "");
    }
    return (
      '<article class="card">' +
        '<div class="card__top">' +
          '<div class="card__thumb">' +
            '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.title) + '" loading="lazy" width="104" height="104" />' +
            '<span class="card__no">' + escapeHtml(p.no) + "</span>" +
          "</div>" +
          '<div class="card__body">' +
            (p.badge ? '<span class="card__badge">' + escapeHtml(p.badge) + "</span>" : "") +
            '<h2 class="card__title">' + highlight(p.title, rawQuery) + "</h2>" +
            (p.point ? '<p class="card__point">' + highlight(p.point, rawQuery) + "</p>" : "") +
            (price ? '<div class="card__price">' + price + "</div>" : "") +
          "</div>" +
        "</div>" +
        '<a class="card__cta" href="' + escapeHtml(p.link) + '" target="_blank" rel="noopener noreferrer nofollow sponsored">' +
          "쿠팡에서 최저가 보기 →" +
        "</a>" +
        (p.note ? '<p class="card__note">' + escapeHtml(p.note) + "</p>" : "") +
      "</article>"
    );
  }

  function render() {
    var q = state.query;
    var shown = state.products.filter(function (p) { return matches(p, q); });

    el.list.innerHTML = shown.map(function (p) { return cardHtml(p, q); }).join("");
    el.empty.hidden = shown.length > 0;
    el.clear.hidden = !q;

    if (q) {
      el.count.textContent = shown.length
        ? "‘" + q + "’ 검색 결과 " + shown.length + "개"
        : "‘" + q + "’와 맞는 상품이 없어요";
    } else {
      el.count.textContent = "전체 " + state.products.length + "개 상품 · 번호를 눌러도 바로 찾아져요";
    }

    Array.prototype.forEach.call(el.chips.querySelectorAll(".chip"), function (c) {
      c.classList.toggle("is-active", c.dataset.q === q);
    });
  }

  /* ---------- 이벤트 ---------- */
  function applyQuery(q, opts) {
    state.query = q;
    el.q.value = q;
    render();
    if (opts && opts.scroll) {
      window.scrollTo({ top: el.searchbar.offsetTop - 8, behavior: "smooth" });
    }
    var url = new URL(window.location.href);
    if (q) url.searchParams.set("n", q);
    else url.searchParams.delete("n");
    history.replaceState(null, "", url.pathname + (q ? "?n=" + encodeURIComponent(q) : "") + url.hash);
  }

  el.q.addEventListener("input", function () {
    applyQuery(el.q.value.trim(), null);
  });

  el.q.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      el.q.blur();
    }
  });

  el.clear.addEventListener("click", function () {
    applyQuery("", null);
    el.q.focus();
  });

  el.reset.addEventListener("click", function () {
    applyQuery("", null);
  });

  el.chips.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    applyQuery(chip.dataset.q === state.query ? "" : chip.dataset.q, { scroll: true });
  });

  /* ---------- 시작 ---------- */
  function init() {
    fetch(DATA_URL, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        state.products = (data.products || []).slice().sort(function (a, b) {
          return String(a.no).localeCompare(String(b.no));
        });

        if (data.shop) {
          document.title = data.shop.name + " · " + data.shop.tagline;
          var nameEl = document.getElementById("shopName");
          var tagEl = document.getElementById("shopTagline");
          var handleEl = document.getElementById("footerHandle");
          var updEl = document.getElementById("footerUpdated");
          if (nameEl) nameEl.textContent = data.shop.name;
          if (tagEl) tagEl.textContent = data.shop.tagline;
          if (handleEl) handleEl.textContent = data.shop.handle;
          if (updEl) updEl.textContent = "업데이트 " + data.shop.updated;
        }

        el.chips.innerHTML = state.products
          .map(function (p) {
            return (
              '<button type="button" class="chip" data-q="' + escapeHtml(p.no) + '">' +
              escapeHtml(p.no) + " " + escapeHtml(p.short || "") +
              "</button>"
            );
          })
          .join("");

        var param = new URLSearchParams(window.location.search).get("n");
        var hash = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
        var initial = (param || hash || "").trim();
        applyQuery(initial, null);
      })
      .catch(function (err) {
        el.list.innerHTML = "";
        el.empty.hidden = false;
        el.count.textContent = "상품 목록을 불러오지 못했어요. 잠시 후 새로고침해 주세요. (" + err.message + ")";
      });
  }

  init();
})();
