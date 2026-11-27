# 핫딜 스튜디오 · 요긴상회

상품 하나만 넣으면 **네이버 블로그 · 인스타그램 · 스레드 글**과 **인스타 카드 이미지(1080×1350)**, **번호허브(`products.json`) 등록**까지 한 번에 만들어 주는 모바일 웹앱(PWA)입니다.

- 주소: https://liwuforseason-lab.github.io/yogin-link/make/
- 안드로이드 크롬: 주소를 연 뒤 `⋮` → **홈 화면에 추가** → 네이티브 앱처럼 실행됩니다. (오프라인에서도 앱이 열려요)

## 사용 순서

1. **번호** — `products.json`을 읽어 마지막 번호 + 1을 자동으로 채워 줍니다. (직접 고쳐도 됩니다)
2. **상품명 · 정가 · 할인가** — 할인율과 아낀 금액이 자동으로 계산됩니다.
3. **한 줄 특징 · 쿠팡 링크 · 상품 사진** — 사진은 갤러리에서 고르면 1080px JPEG로 자동 조절됩니다.
4. **원클릭 생성** — 블로그 / 인스타 / 스레드 / 번호허브 탭이 한 번에 만들어집니다.
5. **복사** — 블로그는 `본문 전체 복사`, 인스타는 `캡션 복사` + `카드 이미지 저장(PNG)`, 스레드는 `글 복사`.
6. **번호허브 반영** — GitHub 토큰을 한 번 저장해 두면 `번호허브에 바로 올리기` 한 번으로 사진과 `products.json`이 같이 커밋됩니다.

## GitHub 토큰 (처음 한 번만)

1. https://github.com/settings/personal-access-tokens/new
2. Repository access → **Only select repositories** → `liwuforseason-lab/yogin-link`
3. Permissions → **Contents: Read and write** → Generate
4. `github_pat_…` 토큰을 앱의 `번호허브` 탭 → `GitHub 토큰 넣기`에 붙여넣고 저장

토큰은 그 브라우저(localStorage)에만 저장되고 사이트에는 올라가지 않습니다.
토큰 없이도 `JSON 복사`로 만든 항목을 `src/data/products.json`에 직접 붙여넣어 등록할 수 있습니다.

## 파일

- `index.html` — 화면
- `app.css` — 크림·로즈 톤 모바일 UI
- `texts.js` — 블로그·인스타·스레드 문구 생성기
- `card.js` — 인스타 카드 Canvas(1080×1350) 렌더러
- `app.js` — 입력·계산·복사·이력·GitHub 커밋
- `sw.js`, `manifest.webmanifest`, `icons/` — PWA 설치용

## 참고

- 생성 문구는 `다시 생성`을 누르면 문장 조합이 바뀝니다.
- 최근 초안은 브라우저에 최대 25개까지 저장되고 `이력`에서 다시 불러올 수 있습니다.
- 글은 확인용 초안이에요. 올리기 전에 가격·옵션을 한 번 더 확인해 주세요.
