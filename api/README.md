# 요긴상회 · 쿠팡 파트너스 API 프록시

`https://liwuforseason-lab.github.io/yogin-link/make/` (핫딜 스튜디오)에서 쓰는 서버리스 프록시입니다.
쿠팡 파트너스 Open API는 브라우저에서 직접 부를 수 없어(CORS + HMAC 서명) 이 함수가 서명해 중계합니다.

## 엔드포인트

`GET|POST /api/coupang`

| 파라미터 | 설명 |
|---|---|
| `r=goldbox&limit=20` | 오늘의 골드박스 |
| `r=best&category=115573&limit=20` | 카테고리 베스트 |
| `r=search&keyword=전기요&limit=20` | 키워드 검색 |
| `r=deeplink` (POST, `{"coupangUrls":["https://www.coupang.com/..."]}`) | 파트너스 단축 링크 발급 |
| `r=image&url=<상품 이미지 URL>` | 상품 이미지 CORS 중계(캔버스 저장용) |

키는 헤더로만 받습니다: `X-Coupang-Access-Key`, `X-Coupang-Secret-Key`.
서버에는 아무것도 저장하지 않으며, 요청마다 서명에만 쓰고 버립니다.
허용 호스트는 쿠팡 이미지 도메인(`coupangcdn.com` 등)뿐이라 다른 주소 중계에는 쓸 수 없습니다.

## 호출 예

```bash
curl -s "https://<project>.vercel.app/api/coupang?r=goldbox&limit=3" \
  -H "X-Coupang-Access-Key: $ACCESS_KEY" \
  -H "X-Coupang-Secret-Key: $SECRET_KEY"
```
