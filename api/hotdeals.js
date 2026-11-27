'use strict';
/* 요긴상회 · 핫딜 수집 프록시
   - 파트너스 API 키 없이도 쓸 수 있는 공개 핫딜 피드를 만듭니다.
   - 1순위: 쿠팡 골드박스(공개 페이지) 2순위: 공개 핫딜 RSS
   - 결과는 { ok, source, updatedAt, items:[{title, price, originalPrice, discount, image, url, mall, rocket}] }
*/

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function send(res, status, obj, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
  res.end(JSON.stringify(obj));
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

/* ---------------- 쿠팡 골드박스 (공개 페이지) ---------------- */
async function coupangGoldbox() {
  const urls = [
    'https://www.coupang.com/np/goldbox',
    'https://m.coupang.com/np/goldbox'
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        }
      });
      if (!r.ok) continue;
      const html = await r.text();
      const items = parseCoupangHtml(html);
      if (items.length) return { source: 'coupang-goldbox', url, items };
    } catch (e) {
      /* 다음 후보로 */
    }
  }
  return null;
}

function parseCoupangHtml(html) {
  const out = [];
  if (!html || html.length < 2000) return out;

  // 페이지에 심어 둔 JSON(있으면 가장 정확) — 상품 객체를 훑어 모읍니다.
  const chunks = [];
  const re = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) && chunks.length < 12) chunks.push(m[1]);
  ['__INITIAL_STATE__', 'window.__DATA__', 'window.__PRELOADED_STATE__'].forEach((k) => {
    const i = html.indexOf(k);
    if (i !== -1) {
      const start = html.indexOf('{', i);
      const end = html.lastIndexOf('}');
      if (start !== -1 && end > start && end - start < 900000) chunks.push(html.slice(start, end + 1));
    }
  });

  for (const text of chunks) {
    try {
      walk(JSON.parse(text), out, 0);
    } catch (e) {
      /* JSON이 아니면 무시 */
    }
    if (out.length > 40) break;
  }

  if (!out.length) parseCoupangCards(html, out);

  // 중복 제거 + 상품 URL 보정
  const seen = new Set();
  return out
    .filter((x) => {
      if (!x.productId || seen.has(x.productId)) return false;
      seen.add(x.productId);
      return true;
    })
    .slice(0, 40);
}

function walk(node, out, depth) {
  if (!node || depth > 8 || out.length > 80) return;
  if (Array.isArray(node)) {
    for (const x of node) walk(x, out, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;

  const id = node.productId || node.product_id;
  const name = node.productName || node.product_name || node.title;
  const price = node.productPrice || node.salePrice || node.price;
  if (id && name && price && typeof name === 'string' && name.length > 3) {
    out.push({
      productId: String(id),
      title: String(name).trim(),
      price: Number(price) || 0,
      originalPrice: Number(node.originalPrice || node.basePrice || node.listPrice || node.retailPrice) || 0,
      image: String(node.productImage || node.imageUrl || node.image || ''),
      url: String(node.productUrl || node.productUrlV2 || ''),
      rocket: !!(node.isRocket || node.rocket),
      mall: 'coupang'
    });
  }
  for (const k in node) {
    if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], out, depth + 1);
  }
}

function parseCoupangCards(html, out) {
  // 상품 링크(/vp/products/123) 기준으로 카드 안의 이미지·가격·이름을 긁습니다.
  const re = /\/vp\/products\/(\d+)[^"]*"([\s\S]{0,2500}?)(?=\/vp\/products\/|\Z)/g;
  let m;
  while ((m = re.exec(html)) && out.length < 40) {
    const id = m[1];
    const block = m[2];
    const img = /(https?:)?\/\/[^"'\s]*coupangcdn\.com[^"'\s]+/.exec(block);
    const name = /alt="([^"]{5,120})"/.exec(block) || /class="[^"]*name[^"]*"[^>]*>\s*([^<]{5,120})</.exec(block);
    const price = /([\d,]{4,12})\s*원/.exec(block);
    if (!name) continue;
    out.push({
      productId: id,
      title: decodeEntities(name[1]).trim(),
      price: price ? Number(price[1].replace(/[^\d]/g, '')) : 0,
      originalPrice: 0,
      image: img ? (img[0].startsWith('//') ? 'https:' + img[0] : img[0]) : '',
      url: 'https://www.coupang.com/vp/products/' + id,
      rocket: /로켓배송/.test(block),
      mall: 'coupang'
    });
  }
}

/* ---------------- 공개 핫딜 RSS (보조) ---------------- */
const FEEDS = [
  { name: '뽐뿌', url: 'https://www.ppomppu.co.kr/rss.php?id=ppomppu' }
];

async function publicFeeds() {
  const items = [];
  for (const f of FEEDS) {
    try {
      const r = await fetch(f.url, {
        headers: {
          'User-Agent': UA,
          'Accept': 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9'
        }
      });
      if (!r.ok) continue;
      const xml = await r.text();
      for (const it of parseRss(xml, f.name)) items.push(it);
    } catch (e) {
      /* 다음 피드로 */
    }
  }
  return items;
}

function parseRss(xml, feedName) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  for (const b of blocks) {
    const title = decodeEntities((/<title>([\s\S]*?)<\/title>/.exec(b) || [])[1] || '')
      .replace(/^<!\[CDATA\[|\]\]>$/g, '')
      .trim();
    if (!title) continue;
    const link = ((/<link>([\s\S]*?)<\/link>/.exec(b) || [])[1] || '').trim();
    const desc = decodeEntities((/<description>([\s\S]*?)<\/description>/.exec(b) || [])[1] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const pub = ((/<pubDate>([\s\S]*?)<\/pubDate>/.exec(b) || [])[1] || '').trim();

    // 제목: "[쿠팡] 상품명 (12,900원/무료)" 형태
    const mallM = /^\[([^\]]{1,12})\]/.exec(title);
    const mall = mallM ? mallM[1] : '';
    if (!/쿠팡/.test(title + mall)) continue;

    let name = mallM ? title.slice(mallM[0].length).trim() : title;
    let price = 0;
    let ship = '';
    const priceM = /\(([\d,]{3,12})\s*원?\s*(?:\/\s*([^)]{0,20}))?\)\s*$/.exec(name);
    if (priceM) {
      price = Number(priceM[1].replace(/[^\d]/g, ''));
      ship = (priceM[2] || '').trim();
      name = name.slice(0, priceM.index).trim();
    }
    if (!name) continue;

    out.push({
      productId: '',
      title: name,
      price,
      originalPrice: 0,
      image: '',
      url: link,
      rocket: /로켓/.test(title + desc + ship),
      mall: mall || feedName,
      note: desc.slice(0, 160),
      postedAt: pub
    });
  }
  return out;
}

/* ---------------- 핸들러 ---------------- */
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const q = req.query || {};

  // 진단용: 특정 주소를 실제로 받아올 수 있는지 확인
  if (q.probe) {
    const target = String(q.probe);
    if (!/^https:\/\/([a-z0-9-]+\.)*(coupang\.com|ppomppu\.co\.kr|clien\.net|ruliweb\.com)\//i.test(target)) {
      return send(res, 400, { ok: false, error: 'probe_host_blocked' }, 'no-store');
    }
    try {
      const r = await fetch(target, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', 'Accept': 'text/html,*/*;q=0.8' }
      });
      const text = await r.text();
      return send(res, 200, {
        ok: true,
        status: r.status,
        finalUrl: r.url,
        region: process.env.VERCEL_REGION || '',
        size: text.length,
        sample: text.slice(0, 400)
      }, 'no-store');
    } catch (e) {
      return send(res, 200, { ok: false, error: String(e && e.message) }, 'no-store');
    }
  }

  const limit = Math.min(40, Math.max(4, parseInt(q.limit, 10) || 20));
  const want = String(q.source || 'auto');

  let result = null;
  if (want === 'auto' || want === 'coupang') {
    result = await coupangGoldbox();
  }
  if (!result && (want === 'auto' || want === 'rss')) {
    const items = await publicFeeds();
    if (items.length) result = { source: 'public-rss', url: FEEDS[0].url, items };
  }

  if (!result || !result.items.length) {
    return send(res, 502, {
      ok: false,
      error: 'no_items',
      region: process.env.VERCEL_REGION || '',
      message: '핫딜을 가져오지 못했어요. 잠시 뒤 다시 시도해 주세요.'
    }, 'no-store');
  }

  const items = result.items
    .map((x) => {
      const discount = x.originalPrice && x.originalPrice > x.price
        ? Math.floor((1 - x.price / x.originalPrice) * 100)
        : 0;
      return {
        productId: x.productId || '',
        title: x.title,
        price: x.price,
        originalPrice: x.originalPrice,
        discount,
        image: x.image,
        url: x.url,
        rocket: !!x.rocket,
        mall: x.mall || 'coupang',
        note: x.note || '',
        postedAt: x.postedAt || ''
      };
    })
    .filter((x) => x.title && x.url)
    .slice(0, limit);

  send(res, 200, {
    ok: true,
    source: result.source,
    sourceUrl: result.url,
    region: process.env.VERCEL_REGION || '',
    updatedAt: new Date().toISOString(),
    count: items.length,
    items
  });
};
