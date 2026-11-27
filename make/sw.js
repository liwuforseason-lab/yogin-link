/* 요긴상회 · 핫딜 스튜디오 서비스워커
   앱 껍데기는 캐시해서 오프라인에서도 열리고, 상품 번호는 항상 새로 받아옵니다. */
var CACHE = "yg-studio-v10";
var SHELL = [
  "./",
  "./index.html",
  "./app.css?v=9",
  "./texts.js?v=9",
  "./card.js?v=9",
  "./app.js?v=9",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(SHELL).catch(function () { /* 일부 실패해도 설치 진행 */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== location.origin) return;          // GitHub API 등은 그대로 통과
  if (url.pathname.indexOf("/src/data/") !== -1) return; // 상품 데이터는 항상 네트워크

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req, { cache: "no-store" }).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match("./index.html").then(function (r) { return r || caches.match("./"); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res.ok && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
