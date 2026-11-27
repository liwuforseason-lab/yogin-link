'use strict';
/* 요긴상회 · 핫딜 API
   - r=feed (기본): 공개 소스(클리앙 알뜰구매·뽐뿌)에서 쿠팡 핫딜을 모아 돌려줍니다. 키 불필요.
   - r=image&url=...: 상품 이미지 CORS 중계(캔버스 저장용)
   - r=coupang / goldbox / best / search / deeplink → 같은 프로젝트의 /api/coupang 으로 안내
*/

const sources = require('../lib/hotdeal-sources.js');

const IMG_HOSTS = [
  'coupangcdn.com',
  'coupang.com',
  'clien.net',
  'ppomppu.co.kr',
  'telesco.pe'
];
const IMG_MAX_BYTES = 10 * 1024 * 1024;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function json(res, status, obj, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(obj));
}

async function proxyImage(res, target) {
  let url;
  try {
    url = new URL(String(target));
  } catch (e) {
    return json(res, 400, { ok: false, error: 'bad_image_url' });
  }
  if (url.protocol !== 'https:') return json(res, 400, { ok: false, error: 'bad_image_url' });
  const host = url.hostname.toLowerCase();
  if (!IMG_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
    return json(res, 403, { ok: false, error: 'image_host_blocked', message: '허용되지 않은 이미지 주소예요.' });
  }
  const r = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; YoginStudio/1.0)',
      Referer: host.endsWith('clien.net') ? 'https://www.clien.net/' : 'https://www.coupang.com/'
    }
  });
  if (!r.ok) return json(res, r.status, { ok: false, error: 'image_fetch_failed', status: r.status });
  let type = r.headers.get('content-type') || '';
  if (!/^image\//.test(type)) {
    const ext = (url.pathname.split('.').pop() || '').toLowerCase();
    const byExt = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
    if (!byExt[ext]) return json(res, 400, { ok: false, error: 'not_an_image', contentType: type });
    type = byExt[ext];
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > IMG_MAX_BYTES) return json(res, 413, { ok: false, error: 'image_too_large' });
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  res.end(buf);
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const q = req.query || {};

  try {
    if (q.r === 'image' || q.img) {
      return await proxyImage(res, q.r === 'image' ? q.url : q.img);
    }

    const limit = Math.min(60, Math.max(4, parseInt(q.limit, 10) || 30));

    if (!q.r || q.r === 'feed' || q.r === 'auto') {
      const live = await sources.collect(limit);
      if (!live.items.length) {
        return json(res, 200, {
          ok: false,
          error: 'no_items',
          updatedAt: new Date().toISOString(),
          items: [],
          message: '지금은 새 핫딜이 없어요. 잠시 뒤 다시 시도해 주세요.'
        }, 'no-store');
      }
      return json(res, 200, {
        ok: true,
        region: process.env.VERCEL_REGION || '',
        updatedAt: live.updatedAt,
        count: live.items.length,
        items: live.items
      }, 'public, max-age=60, s-maxage=180, stale-while-revalidate=600');
    }

    return json(res, 400, {
      ok: false,
      error: 'unknown_resource',
      message: 'r=feed 또는 r=image 만 지원해요. 파트너스 상품은 /api/coupang 을 쓰세요.'
    });
  } catch (e) {
    return json(res, 502, {
      ok: false,
      error: 'collect_failed',
      message: String((e && e.message) || e)
    });
  }
};
