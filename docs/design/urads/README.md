# 유어애즈(UR Ads) 디자인 시안 — Claude Design export

> 대표가 2026-06-27 Claude Design 으로 제작한 유어애즈 시안 원본(.dc.html) + 스크린샷.
> 채팅 이미지는 세션 종료 시 사라지므로 여기 박제(CLAUDE.md 디자인 archive 룰).

## 브랜드 정체성 (Handoff Spec SSOT)
- **컬러**: 단색 `#3B6EF5`(brand) + 그라데이션 `linear-gradient(96deg,#3B6EF5,#8B5CF6,#EC4899)`(강조 문구·수치).
- **톤**: 코스믹 네이비. 유어딜(모노크롬)·유통스타트와 시각적으로 **구분되는 독립 정체성**.
- **폰트**: Pretendard Variable + 수치는 `tabular-nums`.
- **로고**: 4점 스파크 심볼 + "UR Ads" 워드마크 → `src/components/brand/UrAdsLogo.tsx`(SSOT).
- 토큰 전체: `UR Ads Handoff Spec.dc.html` 01~06.

## 시안 파일
| 파일 | 내용 | 구현 |
|---|---|---|
| `UR Ads Handoff Spec.dc.html` | 디자인 토큰·타이포·컴포넌트·반응형·합법성 | 토큰 참조 SSOT |
| `UR Ads Landing Light.dc.html` | **랜딩 — 라이트** | ✅ `src/pages/marketing/MarketingLandingPage.tsx` (`/ads`) |
| `UR Ads Landing v2.dc.html` | 랜딩 — 다크(코스믹 네이비) | ⬜ 미구현 |
| `UR Ads Dashboard.dc.html` | 대시보드 6화면(다크 기본 + 라이트 토글) | ⬜ 미구현(현 `MarketingDashboardPage` 는 기능형) |
| `UR Ads Mobile.dc.html` | 모바일 5폰 | ⬜ 미구현 |
| `UR Ads Brand.dc.html` | 로고 락업·앱아이콘·아이콘 6종 | 🔸 로고만 `UrAdsLogo` 로 구현 |
| `UR Ads Logo Spark 2.dc.html` | 스파크 심볼 변주(S7–S12) | 🔸 캐노니컬 4점 스파크 채택 |

## ✅ 구현 완료
- **랜딩 라이트** — `MarketingLandingPage.tsx`, 라우트 `/ads`(공개). 기존 대시보드는 `/ads/dashboard` 로 이동.
- **로고** — `UrAdsLogo.tsx`(스파크 + 워드마크, 그라데이션 id 충돌 방지).
- 랜딩이 광고하던 미구현 기능을 **실제 구현**(2026-06-27):
  - ✅ **시간대·요일 입찰 전략** — `autobid.ts` schedule(프리셋 피크/마감/주말/야간) + 엔진 + UI. planBid 하드캡 보존(단위테스트).
  - ✅ **CSV 대량 입찰 등록** — `parseCsvRules`/`bulkUpsertRules` + `POST /searchad/autobid/rules/bulk` + UI.
  - ✅ **AI 주간 리포트 자동** — `weekly-report.ts`(월요일 cron + 저장 + Resend best-effort) + 대시보드 패널.
  - → 위 3종 랜딩 카피 복원(POINT 01·05, 프로 플랜).
- 외부 제약으로 구현 불가(랜딩에서 정직하게 표기):
  - 🟡 **발주 수집** = "준비 중" 배지(`order-collection.ts` — 커머스API + 고정IP + 상품주문/배송 권한 필요. 이 환경/계정 제약).
  - 🟡 부정클릭 "자동 차단" → "차단 목록 자동 생성"(네이버 공식 API 에 노출제한IP write 미존재 → 반자동 export 가 상한. API 열리면 자동전환).
  - 통합실적 "채널별" → "캠페인별"(멀티채널 구글/카카오 후순위).
- 수치(CPC 15%↓·ROAS 412.8%·₩8.4억)·고객 로고·후기는 **의도된 더미**(Handoff Spec 명시 — 실데이터 연동 시 교체).

## ⬜ 후속(미구현 시안)
- 랜딩 다크(v2) — 라이트와 같은 컴포넌트에 CSS 변수 오버라이드.
- 대시보드 디자인 적용(현 `MarketingDashboardPage` 는 기능 위주 → 시안 톤 입히기).
- 모바일 정밀 대응(현 랜딩은 `auto-fit`/`clamp` 로 반응형이나 시안 5폰 세부는 별도).
- 앱아이콘·기능 아이콘 6종.

> 구현 현황 전체: `docs/design/urads-boraware-reference.md` 현황표 + (브랜치 `claude/nifty-curie-ofnuxw`) `urads-HANDOFF.md`.
