# 공구 상세 (`/group-buy/:id`) 리디자인 — Claude Design 핸드오프

> 2026-06-16 사용자가 Claude Design(claude.ai/design)에서 제작 → 핸드오프. 원본: `docs/design/group-buy-detail.dc.html`.
> 사용자 지시: "내가 준 파일 그대로 구현. 가장 이상적으로. 기능 미구현이면 추가 구현."

## 컨셉 (chat에서 확정된 의도)
- **정직한 프레이밍**: 공구 연출(카운트다운·"N명 참여 중"·참여자 아바타·confetti) **제거** → "즉시 할인 구매"
- **프리미엄 커머스** (토스/쿠팡/29CM/무신사): **잉크 블랙 CTA**, 블루 최소(아이브로/링크만), 카드수프 대신 **8px 섹션 구분 밴드 + 헤어라인**
- **이미지 갤러리(스와이프)** + 도트 인디케이터
- **라이트/다크 듀얼**
- 셀러는 가격 바로 아래 **컴팩트** (검증배지+프로필 버튼)
- **결제 안심 마이크로카피** ("토스로 3초 안전결제 · 미사용 시 100% 자동환불")

## 디자인 토큰 (CSS vars — index.css `.gbd` / `html.dark .gbd`)
| 토큰 | light | dark |
|---|---|---|
| --gbd-bg | #EDEEF1 | #070809 |
| --gbd-card | #ffffff | #141517 |
| --gbd-ink | #16181B | #F3F4F6 |
| --gbd-ink2 | #3D424A | #C5C9D0 |
| --gbd-sub | #8B929C | #888F99 |
| --gbd-sub2 | #AFB4BC | #5E646D |
| --gbd-line2 | #E6E8EC | #2A2D31 |
| --gbd-chip | #F5F6F8 | #1E2023 |
| --gbd-danger | #F23E4D | #FF5C69 |
| --gbd-cta-bg | #16181B | #F3F4F6 |
| --gbd-cta-fg | #ffffff | #16181B |
| --gbd-accent | #2B6FF0 | #5B93F7 |

## 섹션 순서 (위→아래)
1. 헤더(sticky 56px): 뒤로 · 핀 · 공유 (스크롤 시 투명→solid + 제목 fade). *테마토글은 앱 글로벌(useTheme)이 담당 → 페이지 토글 생략*
2. **이미지 갤러리**(정사각 스와이프, scroll-snap) + 상하 scrim + 좌하 할인배지/식사권 + 우하 도트
3. 타이틀: accent 아이브로(매장·정식등록) + h1 + 핀/주소·전화
4. 가격: 정가 취소선 → 할인%(red) + 가격 + "1매당 N원 저렴 · 즉시 발급"
5. 셀러 행: 아바타 + 이름 + 검증배지 + @핸들 + 프로필버튼
6. 신뢰 3종 인라인 스트립(안전결제/정식판매/환불보장)
7. 상품 안내: 칩 3종(즉시발급/전지점/기한) + 설명
8. **대표 메뉴** (데이터 의존 — 백엔드 menu 필요, 현재 data-gate)
9. 매장 위치: RestaurantMiniMap(잠금 유지) + 주소카드 + 길찾기
10. 이용 안내: 헤어라인 스펙표(기한/사용처/방법) + 점불릿 유의사항
11. **이 셀러의 다른 공구**(가로 스크롤, active 목록에서 seller 필터)
12. sticky 푸터: 할인중 + 수량스테퍼 + 안심카피 + 잉크블랙 "N원 구매하기"

## 🔒 보존 (구현 시 무변경 — CLAUDE.md 잠금)
`__SSR_INITIAL_DETAIL__` 즉시소비 · 결제 `resolveProductFlow`/`resolveTossFlow`(직접 fetch 금지) · 어트리뷰션(?ref/?aff/storeAffiliateRef/fireAffiliateTrack/seller-tracking) · PinButton · KakaoShareButton · SEO JSON-LD · idempotency_key · 듀얼테마 · RestaurantMiniMap lazy.
**공구 연출(카운트다운/참여수/confetti) 제거는 사용자 design 결정** — 폴링은 유지하되 silent(상태/가격 freshness만, 참여 toast/confetti 제거).

## 데이터 의존 (백엔드 후속)
- **대표 메뉴**: products에 menu 데이터 없음 → UI는 `detail.menu` 있을 때만 렌더(data-gate). 채우려면 백엔드 menu 필드/테이블 필요. (TECHNICAL_DEBT)
- **갤러리**: `image_url` + `detail_images`/`image_urls`(JSON) 파싱 — 없으면 단일 이미지.
- **다른 공구**: `/api/group-buy/products?status=active`에서 같은 seller_id 필터(현재 상품 제외).

## 구현 체크리스트
- [ ] index.css `.gbd` 토큰
- [ ] 로직 트림(CountdownRing/Confetti/promo/progress 제거, 폴링 silent)
- [ ] 갤러리(스와이프+도트)
- [ ] 헤더/타이틀/가격/셀러/신뢰/상품안내/매장/이용안내/푸터 리디자인
- [ ] 이 셀러의 다른 공구 fetch+렌더
- [ ] 대표 메뉴 data-gate UI
- [ ] build green + 잠금 보존
