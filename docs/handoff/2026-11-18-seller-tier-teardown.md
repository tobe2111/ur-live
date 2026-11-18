# 2026-11-18 셀러 등급제 폐지

대표 *"셀러 등급제는 아예 없애줘. 지금 아예 안쓰지 않아??"* — 답: **돌고 있었다**(매주 월요일, 마지막 11-02). 하는 일은 부작용뿐이었다.

## 없앤 것
- `cron/seller-tier-eval.ts` — 매주 활성 셀러 `sellers.commission_rate` 를 등급표(5%)로 **덮어썼다**(어드민이 바꾼 값이 되돌아감).
- `features/seller-tiers/*` — `POST /recalculate` 가 옛 표(12/10/8%)로 다시 덮어썼다 · `GET /`·`/my`.
- `GET /api/seller/tier` · `/seller/tier` 화면(옛 링크는 `SellerHomeGone` 으로) · `TierBadge`(import 0) · 셀러 검색 메뉴 항목.
- `utils/seller-tier-limits.ts` — 숙소 등록 등급 한도 · 소개 할인 등급 제한 · `/stays-quota`(화면 호출자 0).
- 대외 약속: `/about` 2-3 블록·기능 카드, 사업계획서 "팔수록 등급 진급 → 수수료 인하".
- 어드민 가이드 섹션 → "없어졌습니다" 본문(GUIDE_SEED_VERSION 66). 시드에서 지우면 라이브에 옛 본문이 남는다.

## 남긴 것
- DB 표·칸(`seller_tiers`·`seller_tier_history`·`sellers.tier`·`tier_score`·`exposure_weight`) — 이력. 지우지 않았다.

## 가드
`src/tests/unit/seller-tier-teardown-2026-11-18.test.ts` — 핵심은 **`sellers.commission_rate` 를 쓰는 코드는 어드민 수수료 설정 한 곳뿐**. 주입 3건.

## 이어받는 세션의 첫 액션 (대표가 이어서 하라고 했을 때)
- 배포 뒤 `/about` 화면 측정: `node scripts/measure-live-vitals.mjs /about`(소비자 화면 규칙).
- 다음 월요일 00:45 UTC 회차 뒤 `SELECT tier_updated_at FROM sellers ORDER BY tier_updated_at DESC LIMIT 1` 가 11-02 에 멈춰 있는지(= 평가가 안 돈다).

## 틀렸던 판단
- 앞 보고에서 "등급 한도가 아예 안 걸린다"고 했다 — 실제로는 조회가 던져 **모두 브론즈 5개**였다. `.catch(() => null)` 뒤의 기본값을 끝까지 따라가 볼 것.

## 이어서 — 대표 "남은 과제도 다 해줘"
- **내려간 기능의 예약 작업 삭제**: 도매 등급 평가(매주 · 도매몰 10-11 철거) · 틱톡 동기화(매일 · 라우트는 이미 주석 처리) ·
  안 쓰는 `lib/sse-realtime.ts` · 마운트 안 된 `multi-platform` 라우트 2개와 그 시험. 없는 칸 동결 65 → 32.
- 빈 `weekly-tier-batch` 슬롯은 **남겼다** — 지우면 하트비트가 주간 임계 × 8배(약 8주) 빨갛다(`cron-beat-retirement` 규칙 ②).
- **탈퇴 기록 칸**(`deleted_accounts` original_name·reregister_available_at·reason)을 배포 때 만들게 했다 — 첫 탈퇴 전엔 복구 조회가 없는 칸을 읽었다(행 0이라 피해 없음).
- 확인만 하고 그대로 둔 것: ① `boot-stuck`(로딩 멈춤 신고) — 11-16 숨은 탭 억제 뒤 실사용자 0건(11-17 1건은 내 측정 로봇).
  ② 배포마다 도는 `refunded_amount` 소급 — 빈 값만 채우고 덮어쓰지 않는 멱등 수리라 의도대로다.
