# 요긴상회 · 생활꿀템 번호 검색

인스타·스레드 `@zipora_find`(요긴상회)에서 소개한 생활꿀템을 **번호로 검색해 쿠팡 파트너스 링크로 바로 이동**하는 링크 허브입니다.

- 실제 사이트: https://liwuforseason-lab.github.io/yogin-link/
- 딥링크: `?n=002` (예: https://liwuforseason-lab.github.io/yogin-link/?n=002)

## 새 상품 추가 (5초)

`src/data/products.json` 의 `products` 배열에 항목 하나만 추가하고 푸시하면 끝입니다.

```json
{
  "no": "003",
  "title": "상품명",
  "short": "짧은이름",
  "point": "핵심 한 줄",
  "price": 0,
  "originalPrice": 0,
  "discount": 0,
  "badge": "배지",
  "keywords": ["검색어", "동의어"],
  "image": "assets/img/파일명.jpg",
  "link": "https://link.coupang.com/a/...",
  "note": "가격·배송 메모"
}
```

이미지는 `assets/img/`에 넣고 `image` 경로를 맞춰 주세요.

## 구성

- `index.html` — 화면
- `assets/style.css` — 베이지·핑크 톤 디자인 (모바일 퍼스트)
- `assets/app.js` — 번호/상품명 즉시 검색, 딥링크
- `src/data/products.json` — 상품 데이터
- 하단 공정위 문구: "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."

## 서버리스 프록시 (Vercel · icn1)

- `api/coupang.js` — 쿠팡 파트너스 Open API HMAC 서명 프록시 (키는 요청 헤더로만 받고 저장하지 않음)
- `api/hotdeals.js` — 키 없이 쓰는 공개 핫딜 피드(클리앙 알뜰구매·뽐뿌 수집) + 상품 이미지 CORS 중계
- `lib/hotdeal-sources.js` — 공개 소스 수집기 (스크립트와 함수가 같이 씁니다)
- `scripts/collect-hotdeals.mjs` — `src/data/hotdeals.json` 백업 목록을 만드는 수동 실행 스크립트

배포: https://yogin-link.vercel.app (`main` 푸시 시 자동 배포)
