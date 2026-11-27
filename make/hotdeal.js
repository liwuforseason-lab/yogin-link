/* 요긴상회 · 핫딜 스튜디오 — 쿠팡 파트너스 API 연동
   골드박스·카테고리·키워드로 상품을 찾아 → 제목·가격·사진·단축링크를 한 번에 채우고 4채널 초안까지 만듭니다.
   키는 이 폰 브라우저(localStorage)에만 저장하고, 서명은 Vercel 프록시에서 대신합니다. */
window.YG = window.YG || {};

(function (YG) {
  "use strict";

  var STORE = {
    access: "yg.coupang.access.v1",
    secret: "yg.coupang.secret.v1",
    api: "yg.coupang.api.v1",
    src: "yg.hotdeal.src.v1",
    cat: "yg.hotdeal.cat.v1",
    keysOpen: "yg.hotdeal.keysOpen.v1"
  };

  var DEFAULT_API = "https://yogin-link.vercel.app/api/coupang";

  /* 파트너스 API 카테고리 코드 (요긴상회에서 자주 쓰는 것부터) */
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
    src: "goldbox",
    cat: "1014",
    keyword: "",
    items: [],
    loading: false,
    sample: false,
    picked: null,
    cache: {}      // key -> { at, items }
  };

  /* ---------------- 저장소 ---------------- */
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

  function friendlyError(status, data) {
    var raw = (data && (data.message || data.error)) || "";
    if (status === 401 && /not registered|Unknown error/i.test(raw)) {
      return "키가 등록돼 있지 않아요. Access Key·Secret Key를 다시 확인해 주세요.";
    }
    if (status === 401 && /Invalid signature/i.test(raw)) {
      return "서명이 맞지 않아요. 키를 다시 저장해 주세요.";
    }
    if (status === 401) return "키를 확인해 주세요. (" + (raw || "401") + ")";
    if (status === 403) return "권한이 없어요. " + raw;
    if (status === 429) return "잠깐 호출이 많았어요. 1분 뒤 다시 시도해 주세요.";
    if (status >= 500) return "쿠팡 서버가 잠깐 불안정해요. 잠시 뒤 다시 시도해 주세요.";
    return raw || ("요청이 실패했어요 (" + status + ")");
  }

  /* ---------------- API 호출 ---------------- */
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

  /* 응답 모양이 골드박스/카테고리/검색에서 조금씩 달라서 한 모양으로 맞춥니다. */
  function normalize(json) {
    var out = [];
    function push(x) {
      if (!x || !x.productId) return;
      out.push({
        id: String(x.productId),
        productId: String(x.productId),
        name: String(x.productName || "").trim(),
        price: Number(x.productPrice) || 0,
        image: String(x.productImage || ""),
        url: String(x.productUrl || ""),
        rocket: !!x.isRocket,
        free: !!x.isFreeShipping,
        category: x.categoryName || ""
      });
    }
    var d = json && json.data;
    if (Array.isArray(d)) {
      d.forEach(function (x) {
        if (x && Array.isArray(x.productData)) x.productData.forEach(push);
        else push(x);
      });
    }
    // 같은 상품 중복 제거
    var seen = {};
    return out.filter(function (x) {
      if (seen[x.id]) return false;
      seen[x.id] = 1;
      return true;
    });
  }

  function imageProxy(src) {
    return apiBase() + "?" + query({ r: "image", url: src });
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

  function load(force) {
    if (S.loading) return;
    if (!hasKeys()) { renderState(); renderList(); return; }
    if (S.src === "search" && !S.keyword) {
      setState("검색어를 넣고 🔍 버튼을 눌러 주세요.", "idle");
      if ($("#findKeyword")) $("#findKeyword").focus();
      return;
    }

    var key = JSON.stringify(paramsFor());
    var hit = S.cache[key];
    if (!force && hit && Date.now() - hit.at < 3 * 60 * 1000) {
      S.items = hit.items;
      S.sample = false;
      renderList();
      setState(labelFor() + " · " + S.items.length + "개 (3분 캐시)");
      return;
    }

    S.loading = true;
    S.picked = null;
    setState("불러오는 중…", "loading");
    $("#findList").innerHTML = '<div class="find-empty">쿠팡에서 상품을 가져오고 있어요…</div>';

    request(paramsFor()).then(function (json) {
      S.items = normalize(json);
      S.sample = false;
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
      var retry = $("#findRetry");
      if (retry) retry.addEventListener("click", function () { load(true); });
      if (e.status === 401) openKeys();
    });
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
    if (hasKeys()) {
      setState("키 연결됨 · 골드박스를 바로 불러올 수 있어요", "ok");
    } else {
      setState("파트너스 API 키를 넣으면 실시간 상품이 떠요", "idle");
    }
    var btn = $("#keysBtn");
    if (btn) btn.textContent = hasKeys() ? "키 연결됨" : "API 키";
  }

  /* ---------------- 등록 여부 확인 ---------------- */
  function normTitle(t) {
    return String(t || "").toLowerCase().replace(/[\s\[\](){}·,.\-+/%]/g, "").replace(/[^0-9a-z가-힣]/g, "");
  }
  function dupOf(it) {
    var list = (YG.app && YG.app.products()) || [];
    var b = normTitle(it.name);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.productId && String(p.productId) === String(it.productId)) return p;
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
      box.innerHTML = hasKeys()
        ? '<div class="find-empty">‘불러오기’를 누르면 상품이 나와요.</div>'
        : '<div class="find-empty">아직 API 키가 없어요.<button type="button" class="mini-btn" id="findKeys2">키 넣기</button>' +
          '<button type="button" class="mini-btn mini-btn--plain" id="findSample">샘플로 미리보기</button></div>';
      bindEmptyButtons();
      return;
    }

    box.innerHTML = S.items.map(function (it) {
      var dup = dupOf(it);
      var chips =
        (it.rocket ? '<span class="chip chip--rocket">로켓배송</span>' : "") +
        (it.free ? '<span class="chip">무료배송</span>' : "");
      return '<div class="pitem' + (S.picked === it.id ? " is-picked" : "") + '" data-id="' + esc(it.id) + '" role="button" tabindex="0">' +
        '<div class="pitem__thumb">' +
          (it.image
            ? '<img loading="lazy" src="' + esc(S.sample ? it.image : imageProxy(it.image)) + '" alt="" onerror="this.style.display=\'none\'" />'
            : '<span class="pitem__noimg">🛍️</span>') +
        "</div>" +
        '<div class="pitem__body">' +
          '<div class="pitem__name">' + esc(it.name) + "</div>" +
          '<div class="pitem__meta"><b>' + esc(won(it.price)) + "</b>" + chips + "</div>" +
          (dup ? '<div class="pitem__dup">이미 등록됨 · ' + esc(dup.no) + " " + esc(dup.title || "") + "</div>" : "") +
          '<div class="pitem__go" data-go="' + esc(it.id) + '"><span>' + (S.picked === it.id ? "준비 중…" : "이 상품으로 만들기") + "</span></div>" +
        "</div>" +
      "</div>";
    }).join("") + (S.sample ? '<p class="find-note">샘플 화면이에요. 실제 상품이 아니고, 링크는 비워 둡니다.</p>' : "");

    bindEmptyButtons();
  }

  function bindEmptyButtons() {
    var b1 = $("#findKeys2");
    var b2 = $("#findSample");
    if (b1) b1.addEventListener("click", openKeys);
    if (b2) b2.addEventListener("click", showSample);
  }

  /* ---------------- 상품 하나 담기 ---------------- */
  function pick(id) {
    if (S.picked || S.filling) return;
    var it = S.items.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    if (S.sample) { fillSample(it); return; }

    S.filling = true;
    S.picked = id;
    renderList();
    setState("‘" + shortName(it.name) + "’ 담는 중…", "loading");

    var fill = {
      title: it.name,
      price: it.price,
      originalPrice: "",
      point: it.rocket ? "로켓배송" : (it.free ? "무료배송" : ""),
      note: "",
      link: "",
      keywords: [],
      productId: it.productId
    };

    var steps = [];
    if (it.image) {
      steps.push(
        fetchImageData(it.image)
          .then(function (dataUrl) {
            return YG.app.useImageSource(dataUrl, "coupang-" + it.productId + ".jpg");
          })
          .catch(function () { toast("상품 사진은 못 가져왔어요. 직접 넣어 주세요"); })
      );
    }

    steps.push(
      request({ r: "deeplink" }, { body: { coupangUrls: [it.url] } })
        .then(function (json) {
          var row = json && json.data && json.data[0];
          if (row && row.shortenUrl) fill.link = row.shortenUrl;
          else fill.link = it.url;
        })
        .catch(function (e) {
          fill.link = it.url;
          toast("단축 링크를 못 만들었어요: " + e.message);
        })
    );

    Promise.all(steps).then(function () {
      YG.app.fill(fill);
      S.filling = false;
      S.picked = null;
      setState("‘" + shortName(it.name) + "’ 채웠어요 · 아래에서 4채널 초안 확인");
      renderList();
      YG.app.generate();
      if (fill.link && fill.link.indexOf("coupa.ng") === -1) {
        toast("단축 링크 대신 상품 주소가 들어갔어요. 그대로 올리지 마세요");
      }
    });
  }

  function shortName(t) {
    var s = String(t || "");
    return s.length > 22 ? s.slice(0, 22) + "…" : s;
  }

  function fillSample(it) {
    S.picked = it.id;
    renderList();
    var fill = {
      title: it.name,
      price: it.price,
      originalPrice: "",
      point: it.rocket ? "로켓배송" : "",
      note: "",
      link: "",
      keywords: [],
      productId: ""
    };
    var done = function () {
      S.picked = null;
      renderList();
      setState("샘플로 채웠어요 · 링크는 비어 있어요");
      YG.app.generate();
      toast("샘플이에요. 링크는 직접 넣어 주세요");
    };
    if (!it.image) { YG.app.fill(fill); done(); return; }
    YG.app.useImageSource(it.image, "sample.jpg")
      .catch(function () {})
      .then(function () { YG.app.fill(fill); done(); });
  }

  /* ---------------- 샘플 데이터 ---------------- */
  function svgImage(emoji, label, bg) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">' +
      '<rect width="600" height="600" fill="' + bg + '"/>' +
      '<text x="300" y="320" font-size="190" text-anchor="middle">' + emoji + "</text>" +
      '<text x="300" y="470" font-size="44" text-anchor="middle" fill="#a2806f" font-family="sans-serif">' + label + "</text>" +
      "</svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function showSample() {
    S.sample = true;
    S.items = [
      { id: "s1", productId: "s1", name: "듀플렉스 무자계 열선 전기요 (샘플)", price: 52600, image: svgImage("🧣", "전기요", "#fdeee6"), url: "", rocket: true, free: true },
      { id: "s2", productId: "s2", name: "깨끗한나라 순수 3겹 화장지 30롤 (샘플)", price: 15900, image: svgImage("🧻", "화장지", "#f3f0e4"), url: "", rocket: true, free: false },
      { id: "s3", productId: "s3", name: "스타벅스 하우스 블렌드 캡슐 100개입 (샘플)", price: 27800, image: svgImage("☕", "커피", "#efe6dd"), url: "", rocket: true, free: true },
      { id: "s4", productId: "s4", name: "이케아 접이식 수납박스 3개 세트 (샘플)", price: 9900, image: svgImage("📦", "수납", "#f6ece4"), url: "", rocket: false, free: true },
      { id: "s5", productId: "s5", name: "무선 핸디 청소기 2in1 (샘플)", price: 89000, image: svgImage("🧹", "청소기", "#eef0ea"), url: "", rocket: false, free: false },
      { id: "s6", productId: "s6", name: "강아지 배변패드 100매 대형 (샘플)", price: 13900, image: svgImage("🐶", "반려동물", "#f7efea"), url: "", rocket: true, free: false }
    ];
    setState("샘플 미리보기 · 실제 상품이 아니에요", "idle");
    renderList();
    $("#findList").scrollIntoView({ behavior: "smooth", block: "start" });
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
    load(true);
  }

  function clearKeys() {
    del(STORE.access);
    del(STORE.secret);
    $("#cpAccess").value = "";
    $("#cpSecret").value = "";
    $("#cpNote").textContent = "키를 지웠어요.";
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

    request({ r: "goldbox", limit: 1 }).then(function (json) {
      var list = normalize(json);
      $("#cpNote").textContent = list.length
        ? "연결 성공 · 골드박스에서 상품 " + list.length + "개 확인"
        : "연결은 됐는데 상품이 비어 있어요 (잠시 뒤 다시 시도)";
    }).catch(function (e) {
      $("#cpNote").textContent = "실패: " + e.message;
    }).then(function () {
      btn.disabled = false;
      btn.textContent = "연결 테스트";
    });
  }

  /* ---------------- 이벤트 ---------------- */
  function bind() {
    $$(".ftab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".ftab").forEach(function (b) { b.classList.remove("is-on"); });
        btn.classList.add("is-on");
        S.src = btn.getAttribute("data-src");
        set(STORE.src, S.src);
        S.sample = false;
        S.picked = null;
        toggleBars();
        load(true);
      });
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
    if (go) go.addEventListener("click", function () { submitSearch(); });
    var kw = $("#findKeyword");
    if (kw) {
      kw.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); submitSearch(); }
      });
    }

    $("#findList").addEventListener("click", function (e) {
      var card = e.target.closest(".pitem");
      if (!card) return;
      var id = card.getAttribute("data-id");
      if (id) pick(id);
    });
    $("#findList").addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var card = e.target.closest(".pitem");
      if (!card) return;
      e.preventDefault();
      pick(card.getAttribute("data-id"));
    });

    $("#keysBtn").addEventListener("click", openKeys);
    $("#apiClose").addEventListener("click", closeKeys);
    $("#apiSheet").addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close")) closeKeys();
    });
    $("#cpSave").addEventListener("click", saveKeys);
    $("#cpClear").addEventListener("click", clearKeys);
    $("#cpTest").addEventListener("click", testKeys);
    $("#cpSample").addEventListener("click", function () { closeKeys(); showSample(); });
  }

  function submitSearch() {
    var v = ($("#findKeyword").value || "").trim();
    if (!v) { $("#findKeyword").focus(); toast("검색어를 넣어 주세요"); return; }
    S.keyword = v;
    S.src = "search";
    $$(".ftab").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-src") === "search");
    });
    toggleBars();
    load(true);
  }

  function toggleBars() {
    var catRow = $("#findCatRow");
    var searchRow = $("#findSearchRow");
    if (catRow) catRow.hidden = S.src !== "best";
    if (searchRow) searchRow.hidden = S.src !== "search";
  }

  /* ---------------- 시작 ---------------- */
  function init() {
    S.src = get(STORE.src) || "goldbox";
    S.cat = get(STORE.cat) || "1014";
    $$(".ftab").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-src") === S.src);
    });
    bind();
    toggleBars();
    renderState();
    renderList();
    if (hasKeys()) setTimeout(function () { load(false); }, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  YG.hotdeal = {
    load: load,
    openKeys: openKeys,
    showSample: showSample,
    hasKeys: hasKeys
  };
})(window.YG);
