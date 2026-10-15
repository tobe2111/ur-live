# 2026-10-15 — 꺼진 카카오맵 후기 보너스, 남은 약속 정리

**무엇**: 후기 보너스는 2026-10-12 종료(`KAKAO_REVIEW_BONUS_ENABLED=false`, 제출 API 410)인데
남은 자리가 넷 있었다 — 입점 사실 `partners-facts.ts` "1,000딜" · 덱 원본 `deck-common.mjs` + 덱 메모 4곳 ·
사장님 화면 `ReviewBonusCard`(없는 보너스 금액을 설정하게 함) · 셀러/어드민 가이드 섹션.

**한 것**: 사실값 → "지금은 운영하지 않음" · 카드 플래그 게이트 · 가이드 맨 앞에 중단 표기 + `GUIDE_SEED_VERSION` 49.
가드 `review-bonus-off-copy-2026-10-15.test.ts` + 주입 2건(빨간불 확인).

**다음 세션 첫 액션**: 배포 후 `/admin/operations-guide`·`/seller/guide` 의 후기 섹션 첫 줄이 "운영하지 않습니다" 인지.
보너스를 다시 켜면 이 가드가 빨간불이 된다 — 플래그·사실값·덱·가이드를 함께 고칠 것.

**못 한 것**: 이미 내보낸 PDF 덱은 다시 빌드해야 반영된다.

**확인한 것(라이브)**: ur-ads 에 `ANTHROPIC_API_KEY`(secret) · `SOCIAL_AUTO_DRAFT_ENABLED=true` 존재.
