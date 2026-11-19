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
