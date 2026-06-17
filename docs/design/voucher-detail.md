# 교환권 상세 페이지 리디자인 — Final (A) · Refined Classic

- **시안 받은 날**: 2026-06-17
- **출처**: Claude Design 핸드오프 번들 (`claude.ai/design`) — `Voucher - Final (A).dc.html`
- **원본 시안 HTML**: [voucher-detail-final-A.dc.html](./voucher-detail-final-A.dc.html)
- **대상 페이지**: `/vouchers/:id` (`src/pages/VoucherDetailPage.tsx`)
- **상태**: ✅ 구현 완료 (아래)

## 배경 (chat 인텔)

사용자가 6개 방향(A~F)을 비교 후 **A · Refined Classic** 으로 확정. chat 에서 도출된 의도:

- pain point: "전체적으로 밋밋하고 브랜드 느낌이 없음"
- 추가할 콘텐츠: **상품명/금액권 가치**, **내 보유 딜 잔액 + 교환 후 남는 딜**
- 비주얼: 현재 톤 유지(미니멀) + **브랜드 옐로우(#FFCE00) 포인트** + 다크 네이비 CTA
- 범위: 이 바우처 상세 화면 1개
- 확정 디테일: 상단 "바우처" 타이틀 제거 / 브랜드명 제거 / **환불 불가** / 유효기간 명시 / **사용 안내("매장에서 바코드 제시 후 사용 가능")** / "오늘 N개 남음" 재고칩은 **제거**

## 사용자 추가 지시 (이번 구현)

1. **상품 상세 내용(`product.description`)은 "매장에서 바코드 제시 후 사용 가능" 아래에 배치.**
2. **상품 이미지 영역은 그라데이션으로 유지** — 풀블리드 사진이 아니라 그라데이션 카드 위에 상품을 `object-contain` 으로 올림.

## 핵심 레이아웃 (시안 사양)

| 영역 | 사양 |
|---|---|
| 헤더 | 흰 배경, 좌측 뒤로가기 (54px) — 상단 "바우처" 타이틀 없음 |
| 상품 카드 | `height:278px` · `radius:28px` · `linear-gradient(180deg,#F7F8FA,#EFF1F4)` · 상품 `object-contain` + drop-shadow |
| 카테고리 칩 | 브랜드 옐로우 `#FFCE00` 배경 + 진한 글자 `#171B24` |
| 상품명 | 23px / extrabold / `#171B24` |
| 가격 | 32px `2,160` + 18px `딜` |
| 구분선 | `#EEF0F3` |
| 정보행 | 유효기간 / 사용처(전국 가맹 매장) / 환불(환불 불가) — label `#9AA0AB`, value `#3A404C` semibold |
| 사용 안내 | info 아이콘 + "매장에서 바코드 제시 후 사용 가능" (회색 12px) |
| 잔액 박스 | `#F6F7F9` 라운드 — "보유 12,480딜" / "교환 후 **10,320딜**"(강조) |
| 수량 스테퍼 | 보더 라운드 14px, `−` 1일 때 비활성(회색) |
| CTA | `linear-gradient(180deg,#222B3F,#10172A)` · 흰 글자 · "2,160딜로 교환하기" |

## 현재 구현 vs 시안 — 차이/조정

| 시안 항목 | 처리 |
|---|---|
| 상품 컵 PNG(투명 cutout) | 실 데이터 `product.image_url` 을 그라데이션 카드 위 `object-contain` 으로 표시(사용자 "이미지=그라데이션 유지" 반영). 이미지 없으면 그라데이션만. |
| `정가 ₩4,500` 취소선 + `52% 할인` | **미도입** — 데이터 모델에 원가/할인율 필드 없음. 가짜 수치 금지(실데이터 원칙) → 딜 가격만 표시. |
| `~2026.09.15` 만료일 | `product.voucher_expiry` 있으면 표시, 없으면 "발급 후 사용 기간 적용". 날짜 fabricate X. |
| `4,500원권 · ICED · Tall` 서브타이틀 | 옵션 데이터 없음 → `restaurant_name`(있으면)을 서브타이틀로. |
| 보유/교환 후 잔액 | `useBalance()`(localStorage cache 0ms) 로 **실 잔액**. 로그인 시에만 박스 노출. 부족하면 "딜 부족"(빨강). |
| 헤더 우측 link 아이콘 / 카드 heart | 비기능 버튼 회피 위해 미도입(뒤로가기만 기능). |
| 다크 모드 | 시안은 라이트 전용 — 이 페이지는 토글 지원이라 모든 토큰에 `dark:` variant 추가(그라데이션도 다크 변형). |

## 보존한 잠금/중요 로직 (무변경)

- `useInvalidateMyVouchers()` — 발급 후 navigate 직전 호출 (RQ stale 방지, CLAUDE.md 잠금)
- `__SSR_INITIAL_DETAIL__` SSR consume (첫 페인트)
- idempotency_key, `INSUFFICIENT_POINTS`→충전 유도, `PHONE_REQUIRED`→휴대폰 모달(+동의)
- 어필리에이트 `storeAffiliateRef` / `fireAffiliateTrack`

## ✅ 구현 완료

- 파일: `src/pages/VoucherDetailPage.tsx` (success-state JSX 전면 교체 — 핸들러/SSR/멱등 로직 무변경)
- 추가: `useBalance()` + `isLoggedInSync()` (보유/교환 후 잔액 박스)
- 제거: 기존 "교환권 안내" 3행 카드(Ticket/CalendarDays/ShieldAlert) → 시안 인라인 정보행으로 대체
- 검증: `tsc --noEmit` 0 · `npm run build` 0 · `check-theme-consistency` 통과
- commit: (이 커밋)
