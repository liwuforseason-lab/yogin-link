'use strict';
/* 요긴상회 · 쿠팡 파트너스 Open API 프록시
   - 브라우저에서 직접 부를 수 없는 api-gateway.coupang.com 을 HMAC-SHA256 서명해 중계합니다.
   - 키는 요청 헤더(x-coupang-access-key / x-coupang-secret-key)로만 받고 저장하지 않습니다.
   - r=goldbox | best | search | deeplink  ·  r=image 는 상품 이미지 CORS 중계(캔버스 저장용)
*/

const crypto = require('crypto');

const GATEWAY = 'https://api-gateway.coupang.com';
const BASE_PATH = '/v2/providers/affiliate_open_api/apis/openapi/v1';
const MAX_BODY = 64 * 1024;
const IMG_MAX_BYTES = 10 * 1024 * 1024;
const IMG_HOSTS = ['coupangcdn.com', 'coupang.com', 'coupangcorp.com'];

/* ---------- 공통 ---------- */
function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Coupang-Access-Key, X-Coupang-Secret-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function fail(res, status, code, message) {
  json(res, status, { ok: false, error: code, message: message });
}

function cleanQuery(pairs) {
  const parts = [];
  for (const [k, v] of pairs) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
  }
  return parts.join('&');
}

function intIn(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (!isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

/* ---------- HMAC 서명 (파트너스 문서 그대로) ---------- */
function signedDate() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return (
    String(d.getUTCFullYear()).slice(2) +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    'T' +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds()) +
    'Z'
  );
}

function authorization(method, path, query, accessKey, secretKey) {
  const datetime = signedDate();
  const message = datetime + method + path + (query || '');
  const signature = crypto.createHmac('sha256', secretKey).update(message, 'utf8').digest('hex');
  return (
    'CEA algorithm=HmacSHA256, access-key=' + accessKey +
    ', signed-date=' + datetime + ', signature=' + signature
  );
}

/* ---------- 요청별 경로 만들기 ---------- */
function buildTarget(q, reqBody) {
  const r = String(q.r || '');
  const limit = intIn(q.limit, 1, 100, 20);
  let method = 'GET';
  let path = '';
  let query = '';
  let body;

  if (r === 'goldbox') {
    path = BASE_PATH + '/products/goldbox';
    query = cleanQuery([['limit', limit]]);
  } else if (r === 'best') {
    const categoryId = String(q.category || '').replace(/[^0-9]/g, '');
    if (!categoryId) return { error: ['missing_category', '카테고리 ID가 필요해요.'] };
    path = BASE_PATH + '/products/bestcategories/' + categoryId;
    query = cleanQuery([['limit', limit]]);
  } else if (r === 'search') {
    const keyword = String(q.keyword || '').trim().slice(0, 60);
    if (!keyword) return { error: ['missing_keyword', '검색어를 넣어 주세요.'] };
    path = BASE_PATH + '/products/search';
    query = cleanQuery([['keyword', keyword], ['limit', limit]]);
  } else if (r === 'deeplink') {
    const urls = Array.isArray(reqBody && reqBody.coupangUrls) ? reqBody.coupangUrls : [];
    const clean = urls
      .filter((u) => typeof u === 'string' && u.length < 700)
      .filter((u) => {
        try {
          const h = new URL(u).hostname.toLowerCase();
          return h === 'coupang.com' || h.endsWith('.coupang.com') || h === 'coupa.ng' || h.endsWith('.coupa.ng');
        } catch (e) {
          return false;
        }
      })
      .slice(0, 20);
    if (!clean.length) return { error: ['missing_urls', '쿠팡 상품 주소가 필요해요.'] };
    method = 'POST';
    path = BASE_PATH + '/deeplink';
    body = { coupangUrls: clean };
  } else {
    return { error: ['unknown_resource', 'r 값은 goldbox, best, search, deeplink 중 하나여야 해요.'] };
  }
  return { method, path, query, body };
}

/* ---------- 상품 이미지 중계 ---------- */
async function image(req, res, target) {
  let url;
  try {
    url = new URL(decodeURIComponent(String(target)));
  } catch (e) {
    return fail(res, 400, 'bad_image_url', '이미지 주소가 올바르지 않아요.');
  }
  if (url.protocol !== 'https:') return fail(res, 400, 'bad_image_url', 'https 주소만 돼요.');
  const host = url.hostname.toLowerCase();
  if (!IMG_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
    return fail(res, 403, 'image_host_blocked', '쿠팡 이미지 주소만 중계할 수 있어요.');
  }
  const upstream = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YoginStudio/1.0)', Referer: 'https://www.coupang.com/' }
  });
  if (!upstream.ok) return fail(res, upstream.status, 'image_fetch_failed', '이미지를 못 가져왔어요 (' + upstream.status + ').');
  const len = Number(upstream.headers.get('content-length') || 0);
  if (len && len > IMG_MAX_BYTES) return fail(res, 413, 'image_too_large', '이미지가 너무 커요.');
  const type = upstream.headers.get('content-type') || 'image/jpeg';
  if (!/^image\//.test(type)) return fail(res, 400, 'not_an_image', '이미지가 아니에요.');
  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.length > IMG_MAX_BYTES) return fail(res, 413, 'image_too_large', '이미지가 너무 커요.');
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  res.end(buf);
}

/* ---------- 핸들러 ---------- */
module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const q = req.query || {};

  try {
    if (q.r === 'image' || q.img) return await image(req, res, q.r === 'image' ? q.url : q.img);

    if (req.method !== 'GET' && req.method !== 'POST') {
      return fail(res, 405, 'method_not_allowed', 'GET, POST, OPTIONS만 됩니다.');
    }

    const accessKey = String(req.headers['x-coupang-access-key'] || '').trim();
    const secretKey = String(req.headers['x-coupang-secret-key'] || '').trim();
    if (!accessKey || !secretKey) {
      return fail(res, 401, 'missing_keys', '쿠팡 파트너스 Access Key와 Secret Key를 넣어 주세요.');
    }
    if (accessKey.length > 200 || secretKey.length > 400) {
      return fail(res, 400, 'bad_key', '키 길이가 이상해요.');
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
    }
    if (body && JSON.stringify(body).length > MAX_BODY) {
      return fail(res, 413, 'body_too_large', '요청이 너무 커요.');
    }

    const target = buildTarget(q, body);
    if (target.error) return fail(res, 400, target.error[0], target.error[1]);

    const url = GATEWAY + target.path + (target.query ? '?' + target.query : '');
    const headers = {
      Authorization: authorization(target.method, target.path, target.query, accessKey, secretKey),
      'Content-Type': 'application/json;charset=UTF-8',
      'X-EXTRA-PAYLOAD': ''
    };

    const upstream = await fetch(url, {
      method: target.method,
      headers: headers,
      body: target.body ? JSON.stringify(target.body) : undefined
    });

    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    // 게이트웨이 응답을 그대로 전달 (JSON이면 JSON으로)
    let out = text;
    try { out = JSON.stringify(JSON.parse(text)); } catch (e) { /* 원문 유지 */ }
    res.end(out);
  } catch (e) {
    return fail(res, 502, 'upstream_error', '쿠팡 API에 연결하지 못했어요: ' + (e && e.message ? e.message : 'unknown'));
  }
};
