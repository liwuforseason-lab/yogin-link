/* 요긴상회 · 핫딜 스튜디오 — 핫딜 자동 찾기
   · 키 없이: 공개 핫딜 게시판(클리앙 알뜰구매·뽐뿌)에서 모은 쿠팡 핫딜 (src/data/hotdeals.json, 30분마다 갱신)
   · 키 있으면: 쿠팡 파트너스 API 골드박스·카테고리·검색 + 단축 링크 자동 발급까지
   키는 이 폰 브라우저(localStorage)에만 저장하고, 서명은 Vercel 프록시가 대신합니다. */
window.YG = window.YG || {};

(function (YG) {
  "use strict";

  var STORE = {
    access: "yg.coupang.access.v1",
    secret: "yg.coupang.secret.v1",
    api: "yg.coupang.api.v1",
    src: "yg.hotdeal.src.v1",
    cat: "yg.hotdeal.cat.v1"
  };

  var DEFAULT_API = "https://yogin-link.vercel.app/api/coupang";
  var FEED_JSON = "../src/data/hotdeals.json";
  var LINK_GEN = "https://partners.coupang.com/#affiliate/ws/link";

  var CATS = [
    { id: "1014", name: "생활용품" },
    { id: "1013", name: "주방용품" },
    { id: "1012", name: "식품" },
    { id: "1016", name: "가전디지털" },
    { id: "1015", name: "홈인테리어" },
    { id: "1010", name: "뷰티" },
    { id: "1024", name: "헬스/건강식품" },
    { id: "1029", name: "반려동물용품" },
    { id: "1020", name: "완구/취미" },
    { id: "1017", name: "스포츠/레저" },
    { id: "1001", name: "여성패션" },
    { id: "1011", name: "출산/유아동" }
  ];

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var S = {
    src: "public",
    cat: "1014",
    keyword: "",
    items: [],
    loading: false,
    picked: null,
    filling: false,
    cache: {},
    updatedAt: ""
  };

  /* ---------------- 저장소·키 ---------------- */
  function get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function keys() {
    return { access: get(STORE.access).trim(), secret: get(STORE.secret).trim() };
  }
  function hasKeys() {
    var k = keys();
    return !!(k.access && k.secret);
  }
  function apiBase() {
    return (get(STORE.api).trim() || DEFAULT_API).replace(/\/+$/, "");
  }
  function feedApi() {
    return apiBase().replace(/\/coupang$/, "") + "/hotdeals";
  }

  /* ---------------- 작은 도구 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function won(n) {
    if (n === null || n === undefined || n === "" || isNaN(n)) return "";
    return Number(n).toLocaleString("ko-KR") + "원";
  }
  function query(params) {
    return Object.keys(params)
      .filter(function (k) { return params[k] !== "" && params[k] !== undefined && params[k] !== null; })
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); })
      .join("&");
  }
  function toast(msg) { if (YG.app && YG.app.toast) YG.app.toast(msg); }
  function shortName(t) {
    var s = String(t || "");
    return s.length > 22 ? s.slice(0, 22) + "…" : s;
  }

  function friendlyError(status, data) {
    var raw = (data && (data.message || data.error)) || "";
    if (status === 401 && /not registered|Unknown error/i.test(raw)) {
      return "키가 등록돼 있지 않아요. Access Key·Secret Key를 다시 확인해 주세요.";
    }
    if (status === 401 && /Invalid signature/i.test(raw)) return "서명이 맞지 않아요. 키를 다시 저장해 주세요.";
    if (status === 401) return "키를 확인해 주세요. (" + (raw || "401") + ")";
    if (status === 403) return "권한이 없어요. " + raw;
    if (status === 429) return "잠깐 호출이 많았어요. 1분 뒤 다시 시도해 주세요.";
    if (status >= 500) return "쿠팡 서버가 잠깐 불안정해요. 잠시 뒤 다시 시도해 주세요.";
    return raw || ("요청이 실패했어요 (" + status + ")");
  }

  /* ---------------- 파트너스 API (키 필요) ---------------- */
  function request(params, opts) {
    opts = opts || {};
    var k = keys();
    if (!k.access || !k.secret) return Promise.reject(new Error("키를 먼저 넣어 주세요"));

    var url = apiBase() + "?" + query(params);
    var init = {
      method: opts.method || "GET",
      headers: {
        "X-Coupang-Access-Key": k.access,
        "X-Coupang-Secret-Key": k.secret
      }
    };
    if (opts.body) {
      init.method = "POST";
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }

    return fetch(url, init).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(friendlyError(res.status, data));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        if (data && data.code === "ERROR") throw new Error(data.message || "쿠팡 API 오류");
        return data;
      });
    });
  }

  function normalize(json) {
    var out = [];
    function push(x) {
      if (!x || !x.productId) return;
      out.push({
        productId: String(x.productId),
        title: String(x.productName || "").trim(),
        price: Number(x.productPrice) || 0,
        originalPrice: Number(x.originalPrice || 0) || 0,
        image: String(x.productImage || ""),
        url: String(x.productUrl || ""),
        rocket: !!x.isRocket,
        free: !!x.isFreeShipping,
        source: "api",
        sourceLabel: "파트너스"
      });
    }
    var d = json && json.data;
    if (Array.isArray(d)) {
      d.forEach(function (x) {
        if (x && Array.isArray(x.productData)) x.productData.forEach(push);
        else push(x);
      });
    }
    var seen = {};
    return out.filter(function (x) {
      if (seen[x.productId]) return false;
      seen[x.productId] = 1;
      return true;
    });
  }

  /* ---------------- 이미지 ---------------- */
  function imageProxy(src) {
    if (!src) return "";
    return feedApi() + "?" + query({ r: "image", url: src });
  }

  function fetchImageData(src) {
    return fetch(imageProxy(src)).then(function (r) {
      if (!r.ok) throw new Error("사진을 못 가져왔어요");
      return r.blob();
    }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { reject(new Error("사진을 읽지 못했어요")); };
        fr.readAsDataURL(blob);
      });
    });
  }

  /* ---------------- 목록 불러오기 ---------------- */
  function paramsFor() {
    if (S.src === "goldbox") return { r: "goldbox", limit: 20 };
    if (S.src === "best") return { r: "best", category: S.cat, limit: 20 };
    return { r: "search", keyword: S.keyword, limit: 10 };
  }

  function loadPublic(force) {
    if (S.loading) return;
    S.loading = true;
    S.picked = null;
    setState("핫딜 목록을 불러오는 중…", "loading");
    $("#findList").innerHTML = '<div class="find-empty">쿠팡 핫딜을 모으고 있어요…</div>';

    var jsonUrl = FEED_JSON + "?t=" + Date.now();
    var liveUrl = feedApi() + "?r=feed&limit=30&t=" + Date.now();

    var fromJson = function () {
      return fetch(jsonUrl, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
    };
    var fromLive = function () {
      return fetch(liveUrl, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
    };

    var first = fromLive().catch(fromJson);

    first.then(function (data) {
      var items = (data && data.items) || [];
      S.items = items.filter(function (x) { return x && x.title && x.price; });
      S.updatedAt = (data && data.updatedAt) || "";
      S.loading = false;
      if (!S.items.length) {
        setState("핫딜 목록이 비어 있어요");
        $("#findList").innerHTML = '<div class="find-empty">지금은 모인 핫딜이 없어요. 새로고침을 눌러 보세요.<button type="button" class="mini-btn" id="findRetry">새로고침</button></div>';
        bindRetry();
        return;
      }
      setState("쿠팡 핫딜 " + S.items.length + "개" + (S.updatedAt ? " · " + agoText(S.updatedAt) : ""), "ok");
      renderList();
    }).catch(function (e) {
      S.loading = false;
      setState("불러오기 실패", "error");
      $("#findList").innerHTML = '<div class="find-empty find-empty--err">핫딜 목록을 못 가져왔어요.<button type="button" class="mini-btn" id="findRetry">다시 시도</button></div>';
      bindRetry();
      console.warn(e);
    });
  }

  function bindRetry() {
    var b = $("#findRetry");
    if (b) b.addEventListener("click", function () { load(true); });
  }

  function agoText(iso) {
    var t = Date.parse(iso);
    if (!t) return "";
    var m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return "방금 갱신";
    if (m < 60) return m + "분 전 갱신";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "시간 전 갱신";
    return Math.floor(h / 24) + "일 전 갱신";
  }

  function loadApi(force) {
    if (S.loading) return;
    if (!hasKeys()) {
      setState("파트너스 API 키가 있어야 쓸 수 있어요", "idle");
      $("#findList").innerHTML =
        '<div class="find-empty">골드박스·카테고리·검색은 파트너스 API 키가 필요해요.' +
        '<button type="button" class="mini-btn" id="findKeys2">키 넣기</button>' +
        '<button type="button" class="mini-btn mini-btn--plain" id="findPublic">오늘의 핫딜 보기</button></div>';
      var k2 = $("#findKeys2");
      var p2 = $("#findPublic");
      if (k2) k2.addEventListener("click", openKeys);
      if (p2) p2.addEventListener("click", function () { switchTab("public"); });
      return;
    }
    if (S.src === "search" && !S.keyword) {
      setState("검색어를 넣고 찾기를 눌러 주세요", "idle");
      if ($("#findKeyword")) $("#findKeyword").focus();
      return;
    }

    var key = JSON.stringify(paramsFor());
    var hit = S.cache[key];
    if (!force && hit && Date.now() - hit.at < 3 * 60 * 1000) {
      S.items = hit.items;
      setState(labelFor() + " · " + S.items.length + "개 (3분 캐시)");
      renderList();
      return;
    }

    S.loading = true;
    S.picked = null;
    setState("불러오는 중…", "loading");
    $("#findList").innerHTML = '<div class="find-empty">쿠팡에서 상품을 가져오고 있어요…</div>';

    request(paramsFor()).then(function (json) {
      S.items = normalize(json);
      S.cache[key] = { at: Date.now(), items: S.items };
      S.loading = false;
      if (!S.items.length) {
        setState(labelFor() + " · 상품이 없어요");
        $("#findList").innerHTML = '<div class="find-empty">조건에 맞는 상품이 없어요. 다른 카테고리나 검색어로 해보세요.</div>';
        return;
      }
      setState(labelFor() + " · " + S.items.length + "개");
      renderList();
    }).catch(function (e) {
      S.loading = false;
      setState("불러오기 실패", "error");
      $("#findList").innerHTML =
        '<div class="find-empty find-empty--err">' + esc(e.message) +
        '<button type="button" class="mini-btn" id="findRetry">다시 시도</button></div>';
      bindRetry();
      if (e.status === 401) openKeys();
    });
  }

  function load(force) {
    if (S.src === "public") loadPublic(force);
    else loadApi(force);
  }

  function labelFor() {
    if (S.src === "goldbox") return "오늘의 골드박스";
    if (S.src === "best") {
      var c = CATS.filter(function (x) { return x.id === S.cat; })[0];
      return "인기 · " + (c ? c.name : S.cat);
    }
    return "‘" + S.keyword + "’ 검색";
  }

  function setState(text, kind) {
    var el = $("#findState");
    if (!el) return;
    el.textContent = text;
    el.className = "find-state" + (kind ? " is-" + kind : "");
  }

  function renderState() {
    if (S.src === "public") {
      var btn = $("#keysBtn");
      if (btn) btn.textContent = hasKeys() ? "API 연결됨" : "API 키";
      return;
    }
    if (hasKeys()) setState("키 연결됨 · 골드박스를 바로 불러올 수 있어요", "ok");
    else setState("파트너스 API 키가 있어야 쓸 수 있어요", "idle");
    var b2 = $("#keysBtn");
    if (b2) b2.textContent = hasKeys() ? "API 연결됨" : "API 키";
  }

  /* ---------------- 등록 여부 ---------------- */
  function normTitle(t) {
    return String(t || "").toLowerCase().replace(/[\s\[\](){}·,.\-+/%]/g, "").replace(/[^0-9a-z가-힣]/g, "");
  }
  function dupOf(it) {
    var list = (YG.app && YG.app.products()) || [];
    var b = normTitle(it.title);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (it.productId && p.productId && String(p.productId) === String(it.productId)) return p;
      var a = normTitle(p.title || p.short);
      if (!a || !b) continue;
      if (a === b) return p;
      if (a.length > 10 && b.length > 10 && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1)) return p;
    }
    return null;
  }

  /* ---------------- 목록 그리기 ---------------- */
  function renderList() {
    var box = $("#findList");
    if (!box) return;
    if (!S.items.length) {
      box.innerHTML = '<div class="find-empty">불러오기를 눌러 주세요.</div>';
      return;
    }

    box.innerHTML = S.items.map(function (it, idx) {
      var dup = dupOf(it);
      var chips =
        '<span class="chip chip--src">' + esc(it.sourceLabel || (it.source === "api" ? "파트너스" : "핫딜")) + "</span>" +
        (it.rocket ? '<span class="chip chip--rocket">로켓</span>' : "") +
        (it.free ? '<span class="chip">무료배송</span>' : "");
      var img = it.image
        ? '<img loading="lazy" src="' + esc(imageProxy(it.image)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(it.image) + '\'" />'
        : '<span class="pitem__noimg">' + esc((it.title || "?").replace(/[^가-힣a-zA-Z0-9]/g, "").charAt(0) || "?") + "</span>";

      return '<div class="pitem' + (S.picked === idx ? " is-picked" : "") + '" data-idx="' + idx + '">' +
        '<div class="pitem__thumb">' + img + "</div>" +
        '<div class="pitem__body">' +
          '<div class="pitem__name">' + esc(it.title) + "</div>" +
          '<div class="pitem__meta"><b>' + esc(won(it.price)) + "</b>" + chips + "</div>" +
          (dup ? '<div class="pitem__dup">이미 등록됨 · ' + esc(dup.no) + " " + esc(dup.title || "") + "</div>" : "") +
          '<div class="pitem__acts">' +
            '<button type="button" class="mini-btn" data-act="make" data-idx="' + idx + '">' +
              (S.picked === idx ? "만드는 중…" : "이 상품으로 만들기") + "</button>" +
            (it.productId
              ? '<button type="button" class="mini-btn mini-btn--plain" data-act="copy" data-idx="' + idx + '">원본 링크 복사</button>'
              : '<button type="button" class="mini-btn mini-btn--plain" data-act="search" data-idx="' + idx + '">쿠팡에서 찾기</button>') +
            '<a class="mini-btn mini-btn--plain" href="' + LINK_GEN + '" target="_blank" rel="noopener">링크 생성기</a>' +
          "</div>" +
        "</div>" +
      "</div>";
    }).join("") +
      '<p class="find-note">' + (S.src === "public"
        ? "공개 핫딜 게시판에서 모은 쿠팡 상품이에요. 가격·재고는 바뀔 수 있어요."
        : "파트너스 API에서 실시간으로 받아온 상품이에요.") + "</p>";
  }

  /* ---------------- 상품 담기 ---------------- */
  function pick(idx) {
    if (S.filling) return;
    var it = S.items[idx];
    if (!it) return;

    S.filling = true;
    S.picked = idx;
    renderList();
    setState("‘" + shortName(it.title) + "’ 담는 중…", "loading");

    var fill = {
      title: it.title,
      price: it.price,
      originalPrice: it.originalPrice || "",
      point: it.rocket ? "로켓배송" : (it.free ? "무료배송" : ""),
      note: "",
      link: "",
      keywords: [],
      productId: it.productId || ""
    };

    // 글·카드는 바로 채우고, 사진과 링크는 준비되는 대로
    YG.app.fill(fill);
    YG.app.setOrigin(it.url || it.postUrl || "");

    var jobs = [];

    if (it.image) {
      jobs.push(
        fetchImageData(it.image)
          .then(function (dataUrl) { return YG.app.useImageSource(dataUrl, "hotdeal.jpg"); })
          .catch(function () { toast("상품 사진은 못 가져왔어요. 직접 넣어 주세요"); })
      );
    }

    if (it.source === "api" && it.url) {
      jobs.push(
        request({ r: "deeplink" }, { body: { coupangUrls: [it.url] } })
          .then(function (json) {
            var row = json && json.data && json.data[0];
            if (row && row.shortenUrl) YG.app.fill({ link: row.shortenUrl });
          })
          .catch(function (e) { toast("단축 링크를 못 만들었어요: " + e.message); })
      );
    }

    Promise.all(jobs).then(function () {
      S.filling = false;
      S.picked = null;
      renderList();
      YG.app.generate();
      if (it.source === "api" && it.url) {
        setState("단축 링크까지 만들었어요 · 아래 4채널 확인", "ok");
      } else {
        setState("‘" + shortName(it.title) + "’ 채웠어요 · 링크만 붙여넣으면 끝", "ok");
        toast("4채널 초안을 만들었어요 · 링크는 '링크 생성기'에서 만들어 주세요");
      }
    });
  }

  /* ---------------- API 키 시트 ---------------- */
  function openKeys() {
    var k = keys();
    $("#cpAccess").value = k.access;
    $("#cpSecret").value = k.secret;
    $("#cpApi").value = get(STORE.api);
    $("#cpApi").placeholder = DEFAULT_API;
    $("#cpNote").textContent = "";
    $("#apiSheet").hidden = false;
  }
  function closeKeys() { $("#apiSheet").hidden = true; }

  function saveKeys() {
    var a = $("#cpAccess").value.trim();
    var s = $("#cpSecret").value.trim();
    var api = $("#cpApi").value.trim();
    if (!a || !s) { $("#cpNote").textContent = "Access Key와 Secret Key를 둘 다 넣어 주세요."; return; }
    set(STORE.access, a);
    set(STORE.secret, s);
    if (api) set(STORE.api, api); else del(STORE.api);
    $("#cpNote").textContent = "저장했어요. 연결 테스트를 해보세요.";
    renderState();
  }

  function clearKeys() {
    del(STORE.access);
    del(STORE.secret);
    $("#cpAccess").value = "";
    $("#cpSecret").value = "";
    $("#cpNote").textContent = "키를 지웠어요. 이제 '오늘의 핫딜'만 쓸 수 있어요.";
    renderState();
  }

  function testKeys() {
    var a = $("#cpAccess").value.trim();
    var s = $("#cpSecret").value.trim();
    if (!a || !s) { $("#cpNote").textContent = "키를 먼저 넣어 주세요."; return; }
    var btn = $("#cpTest");
    btn.disabled = true;
    btn.textContent = "확인 중…";
    $("#cpNote").textContent = "";
    set(STORE.access, a);
    set(STORE.secret, s);

    request({ r: "goldbox", limit: 1 }).then(function (json) {
      var list = normalize(json);
      $("#cpNote").textContent = list.length
        ? "연결 성공 · 골드박스에서 상품 " + list.length + "개 확인"
        : "연결은 됐어요 (지금은 골드박스가 비어 있어요)";
    }).catch(function (e) {
      $("#cpNote").textContent = "실패: " + e.message;
    }).then(function () {
      btn.disabled = false;
      btn.textContent = "연결 테스트";
    });
  }

  /* ---------------- 탭 ---------------- */
  function switchTab(src) {
    S.src = src;
    set(STORE.src, src);
    $$(".ftab").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-src") === src);
    });
    toggleBars();
    renderState();
    load(false);
  }

  function toggleBars() {
    var catRow = $("#findCatRow");
    var searchRow = $("#findSearchRow");
    if (catRow) catRow.hidden = S.src !== "best";
    if (searchRow) searchRow.hidden = S.src !== "search";
    var tip = $("#findTip");
    if (tip) tip.hidden = S.src !== "public";
  }

  function submitSearch() {
    var v = ($("#findKeyword").value || "").trim();
    if (!v) { $("#findKeyword").focus(); toast("검색어를 넣어 주세요"); return; }
    S.keyword = v;
    switchTab("search");
  }

  /* ---------------- 이벤트 ---------------- */
  function bind() {
    $$(".ftab").forEach(function (btn) {
      btn.addEventListener("click", function () { switchTab(btn.getAttribute("data-src")); });
    });

    var catSel = $("#findCat");
    if (catSel) {
      CATS.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.name;
        catSel.appendChild(o);
      });
      catSel.value = S.cat;
      catSel.addEventListener("change", function () {
        S.cat = this.value;
        set(STORE.cat, S.cat);
        load(true);
      });
    }

    var go = $("#findGo");
    if (go) go.addEventListener("click", submitSearch);
    var kw = $("#findKeyword");
    if (kw) {
      kw.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); submitSearch(); }
      });
    }

    $("#findList").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var idx = Number(btn.getAttribute("data-idx"));
      var act = btn.getAttribute("data-act");
      var it = S.items[idx];
      if (!it) return;
      if (act === "make") pick(idx);
      else if (act === "copy") copyLink(it.url);
      else if (act === "search") openCoupangSearch(it.title);
    });

    $("#keysBtn").addEventListener("click", openKeys);
    $("#findRefresh").addEventListener("click", function () { load(true); });
    $("#apiClose").addEventListener("click", closeKeys);
    $("#apiSheet").addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close")) closeKeys();
    });
    $("#cpSave").addEventListener("click", saveKeys);
    $("#cpClear").addEventListener("click", clearKeys);
    $("#cpTest").addEventListener("click", function () { set(STORE.access, $("#cpAccess").value.trim()); set(STORE.secret, $("#cpSecret").value.trim()); testKeys(); });

    var copyBtn = $("#copyOrigLink");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var orig = (YG.app && YG.app.originLink && YG.app.originLink()) || "";
        if (!orig) { toast("원본 링크가 없어요. 상품을 먼저 골라 주세요"); return; }
        copyLink(orig);
      });
    }
  }

  function copyLink(url) {
    if (!url) { toast("복사할 링크가 없어요"); return; }
    var done = function () { toast("링크를 복사했어요 · 링크 생성기에 붙여넣으세요"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () { toast("복사가 안 돼요. 길게 눌러 복사해 주세요"); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("복사가 안 돼요"); }
      document.body.removeChild(ta);
    }
  }

  function openCoupangSearch(title) {
    var q = String(title || "").replace(/\s+/g, " ").trim().slice(0, 40);
    window.open("https://www.coupang.com/np/search?q=" + encodeURIComponent(q), "_blank", "noopener");
  }

  /* ---------------- 시작 ---------------- */
  function init() {
    var saved = get(STORE.src);
    S.src = (saved === "goldbox" || saved === "best" || saved === "search") && hasKeys() ? saved : "public";
    S.cat = get(STORE.cat) || "1014";
    $$(".ftab").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-src") === S.src);
    });
    bind();
    toggleBars();
    renderState();
    load(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  YG.hotdeal = {
    load: load,
    openKeys: openKeys,
    hasKeys: hasKeys,
    renderList: renderList
  };
})(window.YG);
