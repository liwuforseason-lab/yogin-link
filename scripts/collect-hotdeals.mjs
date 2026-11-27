// 요긴상회 · 공개 핫딜 수집 (GitHub Actions에서 30분마다 실행)
// 결과: src/data/hotdeals.json  (앱이 키 없이 바로 읽는 피드)
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { collect, mergeFeed } = require('../lib/hotdeal-sources.js');

const OUT = path.join(process.cwd(), 'src', 'data', 'hotdeals.json');

async function readPrev() {
  try {
    const raw = await fs.readFile(OUT, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { items: [] };
  }
}

function stamp(list) {
  const now = new Date().toISOString();
  return list.map((it) => (it.foundAt ? it : Object.assign({}, it, { foundAt: now })));
}

const prev = await readPrev();
const live = await collect(40);
const fresh = stamp(live.items);
const items = mergeFeed(prev, fresh, 60);

const payload = {
  shop: {
    name: '요긴상회',
    updated: new Date().toISOString().slice(0, 10),
    note: '공개 핫딜 게시판(이토랜드·클리앙 알뜰구매·뽐뿌)에서 쿠팡 상품만 모은 목록입니다. 다른 사람의 제휴 링크는 버리고 상품 주소만 남깁니다.'
  },
  updatedAt: new Date().toISOString(),
  count: items.length,
  items
};

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log('[hotdeals] 수집', fresh.length, '건 · 저장', items.length, '건 →', path.relative(process.cwd(), OUT));
