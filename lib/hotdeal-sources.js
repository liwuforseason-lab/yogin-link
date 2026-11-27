'use strict';
/* 요긴상회 · 공개 핫딜 수집 (키 없이 동작하는 피드)
   - 클리앙 알뜰구매의 '쿠팡' 검색 결과 → 글 본문에서 상품 ID/이미지/가격 추출 (쿠팡 상품 URL 확보)
   - 뽐뿌 RSS(뽐뿌게시판·알뜰구매) → '[쿠팡] 상품명 (가격)' 항목 (이름·가격 위주, 이미지 없음)
   두 곳 모두 공개 목록이고, 다른 사람의 제휴 링크는 버리고 상품 URL만 다시 만듭니다. */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const TIMEOUT = 12000;

function fetchText(url, headers, timeout) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout || TIMEOUT);
  return fetch(url, {
    signal: ctrl.signal,
    headers: Object.assign(
      {
        'User-Agent': UA,
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
      },
      headers || {}
    )
  })
    .then((r) => r.text().then((text) => ({ ok: r.ok, status: r.status, text })))
    .finally(() => clearTimeout(t));
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

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parsePrice(text) {
  const t = String(text || '');
  const man = /([\d,]+(?:\.\d+)?)\s*만\s*원/.exec(t);
  if (man) return Math.round(parseFloat(man[1].replace(/,/g, '')) * 10000);
  if (/만\s*원/.test(t)) return 10000;
  const m = /([\d]{1,3}(?:,\d{3})+|\d{4,8})\s*원/.exec(t);
  return m ? Number(m[1].replace(/[^\d]/g, '')) : 0;
}

function cleanName(raw) {
  let s = stripTags(raw);
  s = s.replace(/^\s*\[[^\]]{1,12}\]\s*/, '');            // [쿠팡] [클리앙] 같은 머리말
  s = s.replace(/^[(\[]\s*쿠팡\s*[)\]]\s*/i, '');
  s = s.replace(/^쿠팡\s*와우\s*/, '').replace(/^쿠팡\s*/, '').replace(/^coupang\s*/i, '');
  // 끝의 (12,900원/무료), 4,850원 (와우 3,850원), 3,130원 와우무료 같은 가격 표기는 이름에서 뺍니다
  s = s.replace(/\s*[(\[]\s*[\d,]+(?:\.\d+)?\s*(?:만\s*)?원?\s*(?:\/|,)?\s*[^)\]]{0,28}[)\]]\s*$/, '');
  s = s.replace(/\s*[\d,]+(?:\.\d+)?\s*(?:만\s*)?원\s*(?:\([^)]{0,20}\))?\s*(?:와우\s*무료|와우무료|무료배송|무배|무료)?\s*$/, '');
  s = s.replace(/^[\s.·,\-/]+/, '');
  return s.trim();
}

/* ---------------- 클리앙 ---------------- */
const CLIEN_SEARCH =
  'https://www.clien.net/service/search?q=%EC%BF%A0%ED%8C%A1&boardCd=jirum&sort=recency&p=';

async function clienPage(page) {
  const r = await fetchText(CLIEN_SEARCH + page, { Accept: 'text/html' });
  if (!r.ok) return [];
  const html = r.text;
  const out = [];
  const re = /<a[^>]*href="(\/service\/board\/jirum\/(\d+)[^"]*)"[^>]*>([\s\S]{0,300}?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const id = m[2];
    const title = stripTags(m[3]);
    if (!title || title.length < 6) continue;
    if (!/쿠팡|coupang/i.test(title)) continue;
    out.push({ id, title });
  }
  return out;
}

async function clienList() {
  const pages = await Promise.allSettled([0, 1, 2].map((p) => clienPage(p)));
  const out = [];
  const seen = new Set();
  for (const p of pages) {
    if (p.status !== 'fulfilled') continue;
    for (const it of p.value) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
  }
  return out.slice(0, 22);
}

function extractProduct(html) {
  // 1) 제휴 링크 안의 pageKey(=상품 ID) + itemId + vendorItemId
  let productId = '';
  let itemId = '';
  let vendorItemId = '';
  const aff = /(?:link\.coupang\.com|coupa\.ng)[^"'\s<>]*/i.exec(html);
  if (aff) {
    const link = decodeEntities(aff[0]);
    const pk = /[?&](?:pageKey|landingPageId)=(\d+)/.exec(link);
    const it = /[?&]itemId=(\d+)/.exec(link);
    const vv = /[?&]vendorItemId=(\d+)/.exec(link);
    if (pk) productId = pk[1];
    if (it) itemId = it[1];
    if (vv) vendorItemId = vv[1];
  }
  // 2) 일반 상품 URL
  if (!productId) {
    const direct = /coupang\.com\/(?:vp\/products|np\/products)\/(\d+)/i.exec(html);
    if (direct) productId = direct[1];
  }
  if (!productId) return null;

  let url = 'https://www.coupang.com/vp/products/' + productId;
  const qs = [];
  if (itemId) qs.push('itemId=' + itemId);
  if (vendorItemId) qs.push('vendorItemId=' + vendorItemId);
  if (qs.length) url += '?' + qs.join('&');

  // 본문 가격(제목에 없을 때)
  let bodyPrice = 0;
  const bodyStart2 = html.indexOf('post_article');
  if (bodyStart2 !== -1) {
    const bodyText = stripTags(html.slice(bodyStart2, bodyStart2 + 4000));
    bodyPrice = parsePrice(bodyText);
  }

  // 본문 이미지 (첨부 이미지 우선)
  let image = '';
  const bodyStart = html.indexOf('post_article');
  const body = bodyStart !== -1 ? html.slice(bodyStart, bodyStart + 20000) : html;
  const imgRe = /<img[^>]+src="(https?:\/\/[^"]+)"[^>]*>/g;
  let im;
  while ((im = imgRe.exec(body))) {
    const src = im[1];
    if (/edgio\.clien\.net|clien\.net/.test(src)) { image = src; break; }
  }
  if (image && image.indexOf('?') === -1) image += '?scale=width:740';

  return { productId, url, image, bodyPrice };
}

async function clienItems() {
  const list = await clienList();
  const out = [];
  const queue = list.slice(0, 22);
  const workers = 5;
  let idx = 0;

  async function run() {
    while (idx < queue.length) {
      const cur = queue[idx++];
      try {
        const r = await fetchText('https://www.clien.net/service/board/jirum/' + cur.id, { Accept: 'text/html' });
        if (!r.ok) continue;
        const prod = extractProduct(r.text);
        if (!prod) continue;
        const name = cleanName(cur.title);
        if (!name) continue;
        out.push({
          productId: prod.productId,
          title: name,
          price: parsePrice(cur.title) || (prod.bodyPrice || 0),
          originalPrice: 0,
          image: prod.image,
          url: prod.url,
          source: 'clien',
          sourceLabel: '클리앙',
          postUrl: 'https://www.clien.net/service/board/jirum/' + cur.id,
          rocket: /로켓|와우/.test(cur.title)
        });
      } catch (e) {
        /* 한 글 실패는 넘어감 */
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, run));
  return out;
}

/* ---------------- 뽐뿌 RSS ---------------- */
const PP_FEEDS = [
  { url: 'https://www.ppomppu.co.kr/rss.php?id=ppomppu', label: '뽐뿌게시판' },
  { url: 'https://www.ppomppu.co.kr/rss.php?id=ppomppu2', label: '알뜰구매' }
];

async function ppomppuItems() {
  const out = [];
  for (const feed of PP_FEEDS) {
    try {
      const r = await fetchText(feed.url, { Accept: 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8' });
      if (!r.ok) continue;
      const blocks = r.text.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
      for (const b of blocks) {
        const rawTitle = stripTags((/<title>([\s\S]*?)<\/title>/.exec(b) || [])[1] || '');
        if (!/쿠팡/.test(rawTitle)) continue;
        const link = decodeEntities(((/<link>([\s\S]*?)<\/link>/.exec(b) || [])[1] || '').trim());
        const desc = stripTags((/<description>([\s\S]*?)<\/description>/.exec(b) || [])[1] || '').slice(0, 200);
        const pub = ((/<pubDate>([\s\S]*?)<\/pubDate>/.exec(b) || [])[1] || '').trim();
        const name = cleanName(rawTitle);
        if (!name) continue;
        out.push({
          productId: '',
          title: name,
          price: parsePrice(rawTitle),
          originalPrice: 0,
          image: '',
          url: link,
          source: 'ppomppu',
          sourceLabel: feed.label,
          postUrl: link,
          note: desc,
          postedAt: pub ? new Date(pub).toISOString() : '',
          rocket: /로켓|와우/.test(rawTitle + desc)
        });
      }
    } catch (e) {
      /* 피드 하나 실패는 넘어감 */
    }
  }
  return out;
}

/* ---------------- 합치기 ---------------- */
function keyOf(it) {
  if (it.productId) return 'p:' + it.productId;
  return 't:' + String(it.title || '').toLowerCase().replace(/[\s\[\](){}·,.\-+/%]/g, '');
}

async function collect(limit) {
  const results = await Promise.allSettled([clienItems(), ppomppuItems()]);
  const items = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) items.push(...r.value);
  }
  const seen = new Set();
  const merged = items.filter((it) => {
    if (!it.price || it.price < 500) return false;
    const k = keyOf(it);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    updatedAt: new Date().toISOString(),
    items: merged.slice(0, limit || 30)
  };
}

/* 이미 있는 목록과 합쳐서 오래된 항목은 정리합니다(Action에서 사용). */
function mergeFeed(prev, fresh, max) {
  const list = [];
  const seen = new Set();
  const push = (it) => {
    const k = keyOf(it);
    if (seen.has(k)) return;
    seen.add(k);
    list.push(it);
  };
  (fresh || []).forEach(push);
  ((prev && prev.items) || []).forEach(push);
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  const kept = list.filter((it) => {
    const t = Date.parse(it.foundAt || it.postedAt || '');
    return !t || t > cutoff;
  }).slice(0, max || 60);
  return kept;
}

module.exports = { collect, clienItems, ppomppuItems, mergeFeed, cleanName, parsePrice };
