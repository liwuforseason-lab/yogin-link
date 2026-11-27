/* 요긴상회 · 핫딜 스튜디오 — 메인 로직
   입력 → 글 생성 → 카드 이미지 → 번호허브 등록까지 한 화면에서 처리합니다. */
(function (YG) {
  "use strict";

  var texts = YG.texts;

  var CFG = {
    dataUrl: "../src/data/products.json",
    repo: "liwuforseason-lab/yogin-link",
    branch: "main",
    jsonPath: "src/data/products.json",
    imgDir: "assets/img/",
    hub: texts.HQ
  };

  var K = {
    pat: "yg.pat.v1",
    history: "yg.history.v1",
    install: "yg.installHintClosed.v1"
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var S = {
    products: [],
    lastNo: 0,
    nextNo: "009",
    draft: null,
    seed: 0,
    image: null,        // { dataUrl, w, h, name, bytes }
    imgEl: null,        // HTMLImageElement (canvas용)
    busy: false
  };

  /* ---------------- 유틸 ---------------- */
  function num(v) {
    var n = String(v || "").replace(/[^\d]/g, "");
    return n ? parseInt(n, 10) : 0;
  }
  function won(n) { return texts.won(n); }
  function pad(n) { return String(n).padStart(3, "0"); }
  function todayStr() {
    var d = new Date();
    var p = function (x) { return String(x).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }

  /* ---------------- 번호 자동 제안 ---------------- */
  function loadProducts() {
    $("#noHint").textContent = "불러오는 중…";
    return fetch(CFG.dataUrl + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        S.products = (data && data.products) || [];
        var max = 0;
        S.products.forEach(function (p) {
          var n = num(p.no);
          if (n > max) max = n;
        });
        S.lastNo = max;
        S.nextNo = pad(max + 1);
        $("#noHint").innerHTML = "현재 <b>" + pad(max) + "</b>까지 등록됨";
        var noField = $("#fNo");
        if (!noField.value) noField.value = S.nextNo;
        $("#brandNo").textContent = S.nextNo;
        return S.products;
      })
      .catch(function (e) {
        $("#noHint").textContent = "번호를 직접 넣어 주세요";
        if (!$("#fNo").value) $("#fNo").value = "009";
        $("#brandNo").textContent = $("#fNo").value;
        console.warn("products.json 로드 실패", e);
      });
  }

  /* ---------------- 키워드·짧은 이름 자동 ---------------- */
  var CATS = ["전기요", "전기매트", "전기장판", "온수매트", "히터", "난로", "온풍기", "핫팩", "손난로",
    "화장지", "두루마리", "휴지", "물티슈", "키친타월", "콜라", "사이다", "음료", "생수", "커피",
    "크림", "로션", "샴푸", "린스", "세안", "선크림", "클렌저", "마스크", "치약", "칫솔", "세제",
    "섬유유연제", "냄비", "프라이팬", "후라이팬", "웍", "식기", "그릇", "수저", "도마", "칼",
    "맨투맨", "티셔츠", "니트", "후드", "바지", "패딩", "양말", "운동화", "슬리퍼", "가방", "지갑",
    "우산", "이불", "베개", "담요", "매트", "커튼", "조명", "스탠드", "건전지", "충전기", "케이블",
    "이어폰", "헤드셋", "청소기", "공기청정기", "가습기", "선풍기", "도시락", "텀블러", "주전자",
    "수납", "정리함", "행거", "건조기", "간식", "과자", "라면", "햇반", "김치", "참치", "우유",
    "비타민", "영양제", "장난감", "노트", "펜", "필통", "텐트", "캠핑"];

  var STOP = ["세트", "정품", "무료배송", "당일", "국내", "국내생산", "특가", "할인", "1+1", "대용량"];

  function tokenize(title) {
    return String(title || "")
      .replace(/[()\[\]{}]/g, " ")
      .split(/[\s,·/]+/)
      .map(function (t) { return t.replace(/[^\w가-힣+]/g, ""); })
      .filter(function (t) {
        if (t.length < 2) return false;
        if (/^\d+([.,]\d+)?(m|cm|mm|ml|l|g|kg|개|매|롤|팩|입|호|w|v|hz|%|개입)?$/i.test(t)) return false;
        if (STOP.indexOf(t) !== -1) return false;
        return true;
      });
  }

  function deriveKeywords(title) {
    var tokens = tokenize(title);
    var cat = "";
    for (var i = 0; i < tokens.length; i++) {
      for (var j = 0; j < CATS.length; j++) {
        if (tokens[i].indexOf(CATS[j]) !== -1) { cat = CATS[j]; break; }
      }
      if (cat) break;
    }
    var out = [];
    if (cat) out.push(cat);
    tokens.forEach(function (t) {
      if (out.indexOf(t) === -1 && out.length < 6) out.push(t);
    });
    return out;
  }

  function parseKeywords(v) {
    return String(v || "").split(/[,\n]/).map(function (s) { return s.trim().replace(/^#/, ""); })
      .filter(Boolean);
  }

  /* ---------------- 가격 계산 ---------------- */
  function updateCalc() {
    var o = num($("#fOrig").value);
    var p = num($("#fPrice").value);
    var el = $("#calcLine");
    if (o > 0 && p > 0 && o > p) {
      var d = Math.floor((1 - p / o) * 100);
      el.innerHTML = "<b>" + d + "%</b> 할인 · " + won(o - p) + " 절약 (" + won(p) + ")";
      el.classList.add("is-on");
    } else if (p > 0) {
      el.textContent = won(p) + " · 정가를 넣으면 할인율이 자동으로 계산돼요.";
      el.classList.remove("is-on");
    } else {
      el.textContent = "정가와 할인가를 넣으면 할인율이 자동으로 계산돼요.";
      el.classList.remove("is-on");
    }
  }

  /* ---------------- 이미지 ---------------- */
  function readImageFile(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1080;
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var r = Math.min(1, max / Math.max(w, h));
          var cw = Math.round(w * r);
          var ch = Math.round(h * r);
          var cv = document.createElement("canvas");
          cv.width = cw;
          cv.height = ch;
          var cx = cv.getContext("2d");
          cx.fillStyle = "#ffffff";
          cx.fillRect(0, 0, cw, ch);
          cx.drawImage(img, 0, 0, cw, ch);
          var dataUrl = cv.toDataURL("image/jpeg", 0.86);
          resolve({ dataUrl: dataUrl, w: cw, h: ch, name: file.name || "photo.jpg" });
        };
        img.onerror = function () { reject(new Error("이미지를 읽지 못했어요")); };
        img.src = fr.result;
      };
      fr.onerror = function () { reject(new Error("파일을 읽지 못했어요")); };
      fr.readAsDataURL(file);
    });
  }

  function setImage(data, name) {
    if (!data) {
      S.image = null;
      S.imgEl = null;
      $("#uploadPreview").hidden = true;
      $("#uploadPreview").removeAttribute("src");
      $("#uploadEmpty").hidden = false;
      $("#imgRemove").hidden = true;
      $("#imgHint").textContent = "카드 이미지에 그대로 들어가요. 1080px로 자동 조절됩니다.";
      return;
    }
    S.image = data;
    var preview = $("#uploadPreview");
    preview.src = data.dataUrl;
    preview.hidden = false;
    $("#uploadEmpty").hidden = true;
    $("#imgRemove").hidden = false;
    var kb = Math.round((data.dataUrl.length * 0.75) / 1024);
    $("#imgHint").textContent = (name || data.name || "사진") + " · " + data.w + "×" + data.h + " · 약 " + kb + "KB";
    var img = new Image();
    img.onload = function () {
      S.imgEl = img;
      if (S.draft) YG.card.draw($("#cardCanvas"), S.draft, S.imgEl);
    };
    img.src = data.dataUrl;
  }

  /* ---------------- 초안 만들기 ---------------- */
  function buildDraft() {
    var title = $("#fTitle").value.trim();
    if (!title) { toast("상품명을 먼저 넣어 주세요"); $("#fTitle").focus(); return null; }
    var price = num($("#fPrice").value);
    if (!price) { toast("할인가를 넣어 주세요"); $("#fPrice").focus(); return null; }
    var orig = num($("#fOrig").value);
    var discount = orig > price ? Math.floor((1 - price / orig) * 100) : 0;
    var saved = orig > price ? orig - price : 0;

    var userKeywords = parseKeywords($("#fKeywords").value);
    var auto = deriveKeywords(title);
    var keywords = userKeywords.length ? userKeywords : auto;
    if (!keywords.length) keywords = [title.slice(0, 8)];

    var short = $("#fShort").value.trim() || keywords[0] || title.slice(0, 10);
    var badge = $("#fBadge").value.trim();
    // 자동으로 넣었던 "72% 특가" 형태는 할인율이 바뀌면 다시 계산
    if (/^\d+%\s?특가$/.test(badge)) badge = "";
    if (!badge) {
      badge = discount >= 50 ? discount + "% 특가" : (discount ? "오늘의 특가" : "생활꿀템");
    }

    var no = ($("#fNo").value.trim() || S.nextNo).replace(/[^\d]/g, "");
    no = no ? pad(parseInt(no, 10)) : S.nextNo;

    return {
      no: no,
      title: title,
      short: short,
      kw1: keywords[0] || short,
      keywords: keywords,
      point: $("#fPoint").value.trim(),
      price: price,
      originalPrice: orig,
      discount: discount,
      saved: saved,
      badge: badge,
      link: $("#fLink").value.trim(),
      note: $("#fNote").value.trim(),
      imageData: S.image ? S.image.dataUrl : "",
      imageName: S.image ? (S.image.shortName || "") : "",
      seed: S.seed,
      ts: Date.now()
    };
  }

  /* ---------------- JSON 항목 ---------------- */
  function jsonImagePath(d) {
    return d.imageData && S.image ? CFG.imgDir + imageFileName(d) : "";
  }

  function imageFileName(d) {
    if (S.image && S.image.fileName) return S.image.fileName;
    return "hotdeal-" + d.no + ".jpg";
  }

  function buildJson(d, imagePath) {
    var obj = {
      no: d.no,
      title: d.title,
      short: d.short,
      point: d.point,
      price: d.price
    };
    if (d.originalPrice) obj.originalPrice = d.originalPrice;
    if (d.discount) obj.discount = d.discount;
    if (d.badge) obj.badge = d.badge;
    obj.keywords = d.keywords;
    obj.image = imagePath !== undefined ? imagePath : jsonImagePath(d);
    obj.link = d.link;
    if (d.note) obj.note = d.note;
    return JSON.stringify(obj, null, 2);
  }

  /* ---------------- 화면 그리기 ---------------- */
  function render() {
    var d = S.draft;
    if (!d) return;

    $("#outBlogTitle").textContent = texts.blogTitle(d);
    $("#outBlogBody").textContent = texts.blogBody(d);
    $("#outInsta").textContent = texts.instaCaption(d);
    $("#outThreads").textContent = texts.threads(d);
    $("#threadsCount").textContent = "(" + texts.threads(d).length + "자)";

    var imagePath = jsonImagePath(d) || "";
    $("#outJson").textContent = buildJson(d, imagePath);

    YG.card.draw($("#cardCanvas"), d, S.imgEl);
  }

  /* ---------------- 복사 ---------------- */
  function copyText(text, btn) {
    var done = function () {
      toast("복사했어요");
      if (btn) {
        btn.classList.add("is-done");
        var label = btn.textContent;
        btn.textContent = "복사됨";
        setTimeout(function () {
          btn.classList.remove("is-done");
          btn.textContent = label;
        }, 1500);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    try { document.execCommand("copy"); done(); } catch (e) { toast("복사가 안 돼요. 길게 눌러 선택해 주세요"); }
    document.body.removeChild(ta);
  }

  function currentText(key) {
    if (!S.draft) return "";
    var d = S.draft;
    if (key === "blogTitle") return texts.blogTitle(d);
    if (key === "blogBody") return texts.blogBody(d);
    if (key === "instaCaption") return texts.instaCaption(d);
    if (key === "threads") return texts.threads(d);
    if (key === "json") return $("#outJson").textContent;
    return "";
  }

  /* ---------------- 생성 ---------------- */
  function generate(isRegen) {
    var d = buildDraft();
    if (!d) return;
    S.draft = d;
    if (!isRegen) S.seed = 0;
    render();
    $("#result").hidden = false;
    saveHistory(d);
    if (!isRegen) {
      setTimeout(function () {
        $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      toast("4채널 초안 만들었어요");
    }
    updateBar();
  }

  /* 입력 카드를 지나서 내려가면 하단 바를 숨깁니다 (결과 가리지 않게) */
  function updateBar() {
    var form = $("#formCard");
    var res = $("#result");
    if (!form) return;
    var pastForm = form.getBoundingClientRect().bottom < 80;
    var inResults = !res.hidden && res.getBoundingClientRect().top < window.innerHeight * 0.72;
    $("#actionbar").classList.toggle("is-hidden", pastForm || inResults);
  }

  /* ---------------- 이력 ---------------- */
  function readHistory() {
    try { return JSON.parse(localStorage.getItem(K.history) || "[]"); } catch (e) { return []; }
  }
  function writeHistory(list) {
    try { localStorage.setItem(K.history, JSON.stringify(list)); return true; }
    catch (e) { console.warn("이력 저장 실패", e); return false; }
  }

  function saveHistory(d) {
    var list = readHistory();
    var img = S.image ? { dataUrl: S.image.dataUrl, w: S.image.w, h: S.image.h, name: S.image.name, fileName: S.image.fileName } : null;
    var item = {
      id: "h" + d.ts,
      ts: d.ts,
      no: d.no, title: d.title, short: d.short, point: d.point,
      price: d.price, originalPrice: d.originalPrice, discount: d.discount,
      badge: d.badge, link: d.link, note: d.note,
      keywords: d.keywords, image: img
    };
    list = list.filter(function (x) { return !(x.no === item.no && x.title === item.title); });
    list.unshift(item);
    while (list.length > 25) list.pop();
    if (!writeHistory(list)) {
      // 용량 부족 → 이미지 빼고 다시
      item.image = null;
      list = list.filter(function (x) { return x.id !== item.id; });
      list.unshift(item);
      writeHistory(list.slice(0, 15));
    }
  }

  function renderHistory() {
    var list = readHistory();
    var box = $("#historyList");
    if (!list.length) {
      box.innerHTML = '<p class="history__empty">아직 만든 핫딜이 없어요.<br>상품을 하나 넣고 생성을 눌러 보세요.</p>';
      return;
    }
    box.innerHTML = list.map(function (x) {
      var thumb = x.image && x.image.dataUrl
        ? '<img class="hitem__thumb" src="' + x.image.dataUrl + '" alt="" />'
        : '<div class="hitem__thumb"></div>';
      var meta = won(x.price) + (x.discount ? " · " + x.discount + "% 할인" : "");
      return '<div class="hitem" data-id="' + esc(x.id) + '" role="button" tabindex="0">' +
        thumb +
        '<div class="hitem__body">' +
          '<div class="hitem__no">' + esc(x.no) + '</div>' +
          '<div class="hitem__title">' + esc(x.title) + '</div>' +
          '<div class="hitem__meta">' + esc(meta) + '</div>' +
        '</div>' +
        '<button type="button" class="hitem__del" data-del="' + esc(x.id) + '" aria-label="삭제">✕</button>' +
      '</div>';
    }).join("");
  }

  function loadHistoryItem(id) {
    var item = readHistory().filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    $("#fNo").value = item.no;
    $("#fTitle").value = item.title || "";
    $("#fShort").value = item.short || "";
    $("#fOrig").value = item.originalPrice || "";
    $("#fPrice").value = item.price || "";
    $("#fPoint").value = item.point || "";
    $("#fLink").value = item.link || "";
    $("#fBadge").value = item.badge || "";
    $("#fKeywords").value = (item.keywords || []).join(", ");
    $("#fNote").value = item.note || "";
    if (item.image && item.image.dataUrl) {
      setImage({ dataUrl: item.image.dataUrl, w: item.image.w, h: item.image.h, name: item.image.name, fileName: item.image.fileName });
    } else {
      setImage(null);
    }
    updateCalc();
    closeSheet();
    generate();
  }

  /* ---------------- 시트 ---------------- */
  function openSheet() {
    renderHistory();
    $("#historySheet").hidden = false;
  }
  function closeSheet() { $("#historySheet").hidden = true; }

  /* ---------------- GitHub 커밋 ---------------- */
  function getPat() { return localStorage.getItem(K.pat) || ""; }

  function patState() {
    var on = !!getPat();
    var el = $("#patState");
    el.textContent = on ? "토큰 연결됨" : "토큰 없음";
    el.classList.toggle("is-on", on);
  }

  function b64EncodeUtf8(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64DecodeUtf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function gh(path, opts) {
    opts = opts || {};
    var headers = {
      Authorization: "Bearer " + getPat(),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch("https://api.github.com/repos/" + CFG.repo + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var msg = (data && data.message) || ("HTTP " + r.status);
          if (r.status === 401) msg = "토큰이 올바르지 않아요. 다시 저장해 주세요 (401)";
          else if (r.status === 403) msg = "권한이 부족해요. Contents: Read and write 권한을 확인해 주세요 (403)";
          else if (r.status === 404) msg = "저장소를 못 찾았어요. 토큰의 Repository access에 yogin-link가 들어있는지 확인해 주세요 (404)";
          else if (r.status === 409 || r.status === 422) msg = "방금 다른 곳에서 바뀌었어요. 잠시 뒤 다시 눌러 주세요 (" + r.status + ")";
          var err = new Error(msg);
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  function step(html, state) {
    var ul = $("#commitSteps");
    var li = document.createElement("li");
    li.innerHTML = html;
    if (state) li.className = "is-" + state;
    ul.appendChild(li);
    return li;
  }

  function setBusy(v) {
    S.busy = v;
    $("#commitBtn").disabled = v;
    $("#commitBtn").textContent = v ? "올리는 중…" : "번호허브에 바로 올리기";
  }

  async function commitToHub() {
    var d = S.draft;
    if (!d) { toast("먼저 생성을 눌러 주세요"); return; }
    if (S.busy) return;
    if (!getPat()) {
      toast("GitHub 토큰을 먼저 넣어 주세요");
      $("#patDetails").open = true;
      $("#patInput").focus();
      return;
    }
    if (!d.imageData) {
      toast("상품 사진을 넣어야 허브 카드가 보여요");
      return;
    }
    if (!d.link) {
      toast("쿠팡 링크를 넣어 주세요");
      return;
    }
    var dup = S.products.filter(function (p) { return num(p.no) === num(d.no); })[0];
    if (dup) {
      toast("번호 " + d.no + "는 이미 있어요 (" + dup.title + ")");
      return;
    }
    var ok = confirm(
      "번호허브에 올릴까요?\n\n" +
      "번호: " + d.no + "\n" +
      d.title + "\n" +
      won(d.price) + (d.discount ? " (" + d.discount + "% 할인)" : "") + "\n\n" +
      "· 사진 1장 + products.json 이 함께 커밋돼요\n" +
      "· 공개 저장소(yogin-link)에 바로 반영됩니다"
    );
    if (!ok) return;

    setBusy(true);
    $("#commitSteps").innerHTML = "";
    try {
      /* 1) 현재 products.json 가져오기 */
      var s1 = step("products.json 읽는 중…", "");
      var file = await gh("/contents/" + CFG.jsonPath + "?ref=" + CFG.branch);
      var raw = b64DecodeUtf8(file.content);
      var data = JSON.parse(raw);
      s1.className = "is-ok";
      s1.innerHTML = "products.json 읽음 (현재 " + (data.products || []).length + "개)";

      /* 2) 사진 업로드 */
      var fileName = imageFileName(d);
      var imgPath = CFG.imgDir + fileName;
      var b64 = String(d.imageData).split(",")[1] || "";
      var s2 = step("사진 올리는 중… (" + imgPath + ")", "");

      var existing = null;
      try {
        existing = await gh("/contents/" + imgPath + "?ref=" + CFG.branch);
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      await gh("/contents/" + imgPath, {
        method: "PUT",
        body: {
          message: "이미지 추가: " + d.no + " " + d.title,
          content: b64,
          branch: CFG.branch,
          sha: existing && existing.sha ? existing.sha : undefined
        }
      });
      s2.className = "is-ok";
      s2.innerHTML = "사진 올림 (" + imgPath + ")";

      /* 3) products.json 갱신 */
      var s3 = step("products.json 갱신 중…", "");
      var entry = JSON.parse(buildJson(d, imgPath));
      data.products = data.products || [];
      data.products = data.products.filter(function (p) { return num(p.no) !== num(d.no); });
      data.products.push(entry);
      data.products.sort(function (a, b) { return num(a.no) - num(b.no); });
      data.shop = data.shop || {};
      data.shop.updated = todayStr();

      var newRaw = JSON.stringify(data, null, 2) + "\n";
      await gh("/contents/" + CFG.jsonPath, {
        method: "PUT",
        body: {
          message: "추가: " + d.no + " " + d.title + " (" + won(d.price) + (d.discount ? ", " + d.discount + "%" : "") + ")",
          content: b64EncodeUtf8(newRaw),
          branch: CFG.branch,
          sha: file.sha
        }
      });
      s3.className = "is-ok";
      s3.innerHTML = "products.json 갱신 완료 (번호 " + d.no + ")";

      var s4 = step("반영 확인 링크", "");
      s4.className = "is-ok";
      s4.innerHTML = '<a href="' + CFG.hub + '?n=' + encodeURIComponent(d.no) + '" target="_blank" rel="noopener">' +
        CFG.hub + "?n=" + d.no + "</a> 열어서 확인 (1~2분 뒤 반영)";

      S.products.push(entry);
      var max = 0;
      S.products.forEach(function (p) { if (num(p.no) > max) max = num(p.no); });
      S.nextNo = pad(max + 1);
      $("#noHint").innerHTML = "현재 <b>" + pad(max) + "</b>까지 등록됨";
      $("#brandNo").textContent = S.nextNo;
      toast("번호허브에 올렸어요");
    } catch (e) {
      var last = $("#commitSteps").lastElementChild;
      if (last && !last.className) {
        last.className = "is-fail";
        last.textContent = last.textContent.replace("중…", "") + " 실패: " + e.message;
      }
      toast("실패: " + e.message);
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- PWA ---------------- */
  var deferredPrompt = null;
  function setupPwa() {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("./sw.js").catch(function (e) { console.warn("SW 실패", e); });
    }
    var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (!standalone && localStorage.getItem(K.install) !== "1") {
      $("#installHint").hidden = false;
    }
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      $("#installBtn").hidden = false;
      $("#installHint").hidden = false;
    });
    window.addEventListener("appinstalled", function () {
      $("#installHint").hidden = true;
      toast("앱으로 설치됐어요");
    });
  }

  /* ---------------- 이벤트 ---------------- */
  function bind() {
    $("#fOrig").addEventListener("input", function () {
      this.value = this.value.replace(/[^\d]/g, "");
      updateCalc();
    });
    $("#fPrice").addEventListener("input", function () {
      this.value = this.value.replace(/[^\d]/g, "");
      updateCalc();
    });
    $("#fNo").addEventListener("input", function () {
      this.value = this.value.replace(/[^\d]/g, "");
    });

    $("#fTitle").addEventListener("input", function () {
      // 키워드·짧은 이름이 비어 있으면 자동 제안을 placeholder로 보여줌
      var kw = deriveKeywords(this.value);
      $("#fKeywords").placeholder = kw.length ? kw.join(", ") : "전기요, 전기매트, 겨울";
      $("#fShort").placeholder = kw[0] || "전기요";
    });

    $("#fImg").addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { toast("이미지 파일만 넣을 수 있어요"); return; }
      readImageFile(f).then(function (data) {
        data.fileName = null;
        setImage(data, f.name);
        if (S.draft) render();
      }).catch(function (e) { toast(e.message); });
      this.value = "";
    });

    $("#imgRemove").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setImage(null);
      if (S.draft) render();
    });

    $("#genBtn").addEventListener("click", function () { generate(false); });

    $("#regenBtn").addEventListener("click", function () {
      S.seed += 1;
      if (S.draft) { S.draft.seed = S.seed; render(); toast("문장을 새로 골랐어요"); }
    });

    $$(".tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".tab").forEach(function (b) { b.classList.remove("is-on"); });
        btn.classList.add("is-on");
        var id = btn.getAttribute("data-tab");
        $$(".panel").forEach(function (p) { p.hidden = p.id !== "panel-" + id; });
        if (id === "insta" && S.draft) YG.card.draw($("#cardCanvas"), S.draft, S.imgEl);
      });
    });

    $$("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-copy");
        var text = currentText(key);
        if (!text) { toast("먼저 생성해 주세요"); return; }
        copyText(text, btn);
      });
    });

    $("#downloadCard").addEventListener("click", function () {
      if (!S.draft) { toast("먼저 생성해 주세요"); return; }
      YG.card.draw($("#cardCanvas"), S.draft, S.imgEl);
      var canvas = $("#cardCanvas");
      var name = "yogin-" + S.draft.no + ".png";
      YG.card.toBlob(canvas).then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        toast("이미지 저장했어요");
      }).catch(function () {
        var a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = name;
        a.click();
      });
    });

    $("#historyBtn").addEventListener("click", openSheet);
    $("#historyClose").addEventListener("click", closeSheet);
    $("#historySheet").addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close")) closeSheet();
      var del = e.target.getAttribute("data-del");
      if (del) {
        e.stopPropagation();
        var list = readHistory().filter(function (x) { return x.id !== del; });
        writeHistory(list);
        renderHistory();
        return;
      }
      var card = e.target.closest(".hitem");
      if (card) loadHistoryItem(card.getAttribute("data-id"));
    });

    $("#reloadData").addEventListener("click", function () {
      loadProducts().then(function () { toast("번호를 새로 불러왔어요"); });
    });

    /* PAT */
    $("#patSave").addEventListener("click", function () {
      var v = $("#patInput").value.trim();
      if (!/^(gh[pousr]_|github_pat_)/.test(v)) {
        toast("github_pat_ 로 시작하는 토큰을 붙여넣어 주세요");
        return;
      }
      localStorage.setItem(K.pat, v);
      $("#patInput").value = "";
      patState();
      toast("토큰을 저장했어요");
    });
    $("#patClear").addEventListener("click", function () {
      localStorage.removeItem(K.pat);
      patState();
      toast("토큰을 지웠어요");
    });

    $("#commitBtn").addEventListener("click", commitToHub);

    $("#installClose").addEventListener("click", function () {
      $("#installHint").hidden = true;
      localStorage.setItem(K.install, "1");
    });
    $("#installBtn").addEventListener("click", function () {
      if (!deferredPrompt) { toast("브라우저 메뉴에서 '홈 화면에 추가'를 눌러 주세요"); return; }
      deferredPrompt.prompt();
      deferredPrompt = null;
      $("#installBtn").hidden = true;
    });
  }

  /* ---------------- 시작 ---------------- */
  function init() {
    bind();
    patState();
    updateCalc();
    loadProducts();
    setupPwa();
    window.addEventListener("scroll", updateBar, { passive: true });
    updateBar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.YG);
