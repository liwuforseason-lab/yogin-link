'use strict';
/* 요긴상회 · 공개 핫딜 수집 (키 없이 동작하는 피드)
   - 이토랜드 핫딜 목록: 쿠팡 상품명·가격·배송·상품 URL·썸네일 (한 장에서)
   - 클리앙 알뜰구매 게시판: 쿠팡 글이 있으면 본문에서 상품 ID·이미지·가격
   - 뽐뿌 RSS: '[쿠팡] 상품명 (가격)' 항목
   모두 공개 목록이고, 다른 사람의 제휴 링크는 버리고 상품 URL만 다시 만듭니다. */

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
  s = s.replace(/^[([]\s*쿠팡\s*[)\]]\s*/i, '');
  s = s.replace(/^쿠팡\s*와우\s*/, '').replace(/^쿠팡\s*/, '').replace(/^coupang\s*/i, '');
  s = s.replace(/^선착순\s*특가\s*[)\]]\s*/, '');
  // 끝의 (12,900원/무료), 4,850원 (와우 3,850원), 3,130원 와우무료 같은 가격 표기는 이름에서 뺍니다
  s = s.replace(/\s*[([[]\s*[\d,]+(?:\.\d+)?\s*(?:만\s*)?원?\s*(?:\/|,)?\s*[^)\]]{0,28}[)\]]\s*$/, '');
  s = s.replace(/\s*[\d,]+(?:\.\d+)?\s*(?:만\s*)?원\s*(?:\([^)]{0,20}\))?\s*(?:와우\s*무료|와우무료|무료배송|무배|무료)?\s*$/, '');
  s = s.replace(/^[\s.·,\-/]+/, '');
  return s.trim();
}

function normTitle(t) {
  return String(t || '').toLowerCase().replace(/[\s[\](){}·,./+%-]/g, '').replace(/[^0-9a-z가-힣]/g, '');
}

/* ---------------- 이토랜드 핫딜 ---------------- */
/* robots.txt(2026-11)는 로봇 전체에 Allow: / 만 두고 /private/ 만 막습니다.
   목록 한 장에 상품명·가격·배송·쿠팡 상품 URL·썸네일이 모두 들어 있어 한 번만 읽습니다. */
const ETO_LIST = 'https://www.etoland.co.kr/b/hotdeal';
const BS = String.fromCharCode(92);   // backslash
const QT = String.fromCharCode(34);   // "
const BSQ = BS + QT;                  // \"

/* 페이지에 심긴 JSON은 역슬래시가 2~3겹으로 이스케이프돼 있습니다. 한 겹으로 줄입니다. */
function collapseBackslashes(html) {
  let s = html;
  const two = BS + BS + QT;
  const one = BS + QT;
  let guard = 0;
  while (s.indexOf(two) !== -1 && guard < 10) {
    s = s.split(two).join(one);
    guard += 1;
  }
  return s;
}

/* \"key\":\"value\" 형태에서 값만 꺼냅니다. */
function jsonField(chunk, key) {
  const marker = BSQ + key + BSQ + ":";
  const i = chunk.indexOf(marker);
  if (i === -1) return "";
  const rest = chunk.slice(i + marker.length);
  if (rest.slice(0, 2) !== BSQ) {
    let raw = "";
    for (let j = 0; j < rest.length && ",}".indexOf(rest.charAt(j)) === -1; j += 1) raw += rest.charAt(j);
    return raw.trim();
  }
  const a1 = rest.indexOf(BSQ + ",", 2);
  const b1 = rest.indexOf(BSQ + "}", 2);
  let end = a1 === -1 ? b1 : (b1 === -1 ? a1 : Math.min(a1, b1));
  if (end === -1) end = rest.length;
  let raw = rest.slice(2, end);
  raw = raw.split(BS + "u0026").join("&");
  raw = raw.split(BS + "u003d").join("=");
  raw = raw.split(BS + "u002F").join("/");
  raw = raw.split(BS + "/").join("/");
  return raw;
}

function etoImage(src) {
  if (!src) return '';
  if (src.indexOf('https://btcdn.etoland.co.kr/static/') !== 0) return src;
  return 'https://btcdn.etoland.co.kr/optimize/w_600,h_600,format_webp,q_90,position_entropy/' + src;
}

async function etolandItems() {
  let html = '';
  try {
    const r = await fetchText(ETO_LIST, { Accept: 'text/html' }, 15000);
    if (!r.ok) return [];
    html = r.text;
  } catch (e) {
    return [];
  }

  const norm = collapseBackslashes(html);

  // 1) 목록 썸네일 (alt = "[쿠팡] 상품명")
  const imgByTitle = {};
  const imgRe = /<a[^>]*href="(\/b\/hotdeal\/view\/[^"]+)"[\s\S]{0,900}?<img[^>]*?(?:data-src|src)="([^"]+)"[^>]*alt="([^"]+)"/g;
  let im;
  while ((im = imgRe.exec(html))) {
    const src = decodeEntities(im[2]);
    const alt = decodeEntities(im[3]).trim();
    const key = normTitle(alt.replace(/^\[[^\]]{1,8}\]\s*/, ''));
    if (key && !imgByTitle[key]) imgByTitle[key] = src;
  }

  // 2) 페이지에 심긴 핫딜 JSON
  const out = [];
  const seen = new Set();
  const marker = BSQ + 'hotdeal' + BSQ + ':{';
  let pos = 0;
  while ((pos = norm.indexOf(marker, pos)) !== -1) {
    const chunk = norm.slice(pos, pos + 1800);
    pos += marker.length;

    const store = jsonField(chunk, 'store');
    if (store !== '쿠팡') continue;

    const titleRaw = jsonField(chunk, 'title');
    const priceRaw = jsonField(chunk, 'price');
    const link = jsonField(chunk, 'link');
    if (!titleRaw || !priceRaw || !link) continue;

    const pid = /coupang\.com\/vp\/products\/(\d+)/.exec(link);
    if (!pid) continue;
    if (seen.has(pid[1])) continue;
    seen.add(pid[1]);

    const title = cleanName(titleRaw);
    if (!title) continue;

    out.push({
      productId: pid[1],
      title,
      price: Number(String(priceRaw).replace(/[^\d]/g, '')),
      originalPrice: 0,
      image: etoImage(imgByTitle[normTitle(title)] || ''),
      url: link,
      source: 'etoland',
      sourceLabel: '이토랜드',
      postUrl: ETO_LIST,
      rocket: false,
      note: ''
    });
    if (out.length >= 20) break;
  }
  return out;
}

/* ---------------- 클리앙 ---------------- */
/* 클리앙 알뜰구매 게시판. robots.txt 정책상 게시판(/service/board/)은 열려 있고
   검색(/service/search)·쿼리 문자열은 막혀 있어 게시판 목록 첫 페이지만 읽습니다. */
const CLIEN_BOARD = 'https://www.clien.net/service/board/jirum';

async function clienList() {
  try {
    const r = await fetchText(CLIEN_BOARD, { Accept: 'text/html' });
    if (!r.ok) return [];
    const html = r.text;
    const out = [];
    const seen = new Set();
    const re = /<a[^>]*href="(\/service\/board\/jirum\/(\d+)[^"?]*)"[^>]*>([\s\S]{0,300}?)<\/a>/g;
    let m;
    while ((m = re.exec(html))) {
      const id = m[2];
      const title = stripTags(m[3]);
      if (!title || title.length < 6) continue;
      if (!/쿠팡|coupang/i.test(title)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, title });
    }
    return out;
  } catch (e) {
    return [];
  }
}

function extractProduct(html) {
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

  let bodyPrice = 0;
  let image = '';
  const bodyStart = html.indexOf('post_article');
  if (bodyStart !== -1) {
    const body = html.slice(bodyStart, bodyStart + 20000);
    bodyPrice = parsePrice(stripTags(body.slice(0, 4000)));
    const imgRe = /<img[^>]+src="(https?:\/\/[^"]+)"[^>]*>/g;
    let im;
    while ((im = imgRe.exec(body))) {
      const src = im[1];
      if (/edgio\.clien\.net|clien\.net/.test(src)) { image = src; break; }
    }
  }
  if (image && image.indexOf('?') === -1) image += '?scale=width:740';

  return { productId, url, image, bodyPrice };
}

async function clienItems() {
  const list = await clienList();
  const out = [];
  const queue = list.slice(0, 8);
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
  await Promise.all(Array.from({ length: 4 }, run));
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
  return 't:' + normTitle(it.title);
}

async function collect(limit) {
  const results = await Promise.allSettled([etolandItems(), clienItems(), ppomppuItems()]);
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

/* 이미 있는 목록과 합쳐서 오래된 항목은 정리합니다. */
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
  const kept = list
    .filter((it) => {
      const t = Date.parse(it.foundAt || it.postedAt || '');
      return !t || t > cutoff;
    })
    .slice(0, max || 60);
  return kept;
}

module.exports = { collect, etolandItems, clienItems, ppomppuItems, mergeFeed, cleanName, parsePrice };
