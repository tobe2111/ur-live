# 2026-08-23 — 이용권 등록 3단계 위저드 (카카오맵 자동입력 · 매장 상속 · 다매장 · 임시저장)

## 대표 지시 (원문 요지)
> "일단 처음에 카카오맵으로 매장 검색하고 최대한 그 정보를 자동입력. 매장 등록이 되어있으면
> 이용권 만들 때는 자동으로 돼야지. 매장이 여러개면 선택하면 되고. 임시저장도 돼야 해"

(선행 승인: 3단계 위저드 · 실수령/미리보기 · 유효기간 기본 "제한 없음" · 목표인원 제거 ·
완료 CTA → 인플루언서 찾기)

## 구현 (이번 세션)

**서버** — `seller-stores.routes.ts` `GET /api/seller/stores/context` 신설(현재 좌석 매장의
프리필: 최근 상품 restaurant_* > seller_meta store_lat/lng·kakao_place_url > sellers 행).
읽기 전용 · 머니 경로 없음.

**클라** — `SellerMealVoucherNewPage.tsx` 797→391줄 재작성(3단계 위저드 셸) + 스텝 추출:
- `seller-meal-voucher/voucher-form.ts` — 폼 타입 + localStorage 드래프트 SSOT
  (`ur_voucher_draft_v1` 단일 키 — 매장 전환을 견디도록 seller 별로 나누지 않음)
- `seller-meal-voucher/StoreStep.tsx` — 다매장 칩(POST /stores/:id/token 좌석 전환 =
  StoreSwitcher 계약) + 자동 상속 요약 카드 + 카카오맵 검색(정보 없으면 주역) + 수동 필드
- `seller-meal-voucher/VoucherInfoStep.tsx` — 종류/이름/가격/사진/실수령(NetProceedsCard)
- `seller-meal-voucher/SaleSettingsStep.tsx` — 재고/1인한도/마감 + **유효기간 기본 무기한**
  (체크 해제 시에만 날짜, 편의 프리필 90일) + 고급 설정 + 미리보기

**행동 변화 (의도된 것)**:
- `group_buy_target` 항상 0 전송(목표인원 입력 제거 — 즉시판매 단일가 모델에서 vestigial)
- `voucher_expiry` 기본 ''(무기한, expires_at NULL — 2026-08-22 대표 정책). 종전 90일 프리셋 폐기
- 등록 성공 → 완료 화면(CTA: 인플루언서 찾기 `/seller/influencers` / 내 이용권 보기)
- OCR 데드코드 제거(UI 는 2026-08-20 대표 지시로 이미 제거돼 있었음 — 함수만 남아 있었다)
- 제출 payload 계약은 그 외 종전과 동일(POST /api/seller/products)

**임시저장**: 자동저장(800ms 디바운스, 내용 있을 때만) + 명시 버튼 + 마운트 복원 배너.
복원 결정 전에는 자동저장 정지(기존 드래프트를 빈 폼으로 덮지 않기 위해).

**i18n**: `seller.mealVoucher.*` 22키 + `common.prev` — 6개 언어 모두 additive.

**테스트 갱신**: `seller-voucher-limit.test.ts` 의 `NEW` 경로를 `VoucherInfoStep.tsx` 로
(카테고리 그리드 이동 — 테스트 메시지가 시킨 갱신).

**파일크기**: 전 파일 600 미만. `--rebaseline` 실행(축소 + main 드리프트 sync —
column-repairs 983→1054 는 선행 머지 성장분 동기).

## 검증
tsc 0 · sql bind/column/table 0 · theme 0 · mobile-viewport 0 · light-input 0 ·
seller-voucher-limit 12 pass. 전체 vitest/빌드/가드는 CI 판정.

## 다음 세션 첫 액션
1. PR CI 판정 → 초록이면 관행대로 draft 해제 + squash 머지.
2. 배포 후 실측: 셀러 로그인 → `/seller/meal-voucher/new`(라우트는 seller.routes.tsx:323)
   진입 → ① 기존 셀러면 매장 카드 자동 표시되는지(GET /stores/context) ② 새 계정이면
   카카오맵 검색이 1단계 주역인지 ③ 작성 중 이탈 후 재진입 시 복원 배너 ④ 등록 완료 화면 CTA.

## 이번에 틀렸던 판단
- 없음(이번 조각). 단 주의: `check-file-size --rebaseline` 은 **전역** 재작성이라 main 드리프트가
  섞인다 — 디프를 반드시 훑고 커밋할 것(이번엔 전부 축소/sync 라 안전).

## 남은 결정/대기 (변동 없음 — 2026-08-22 인계 참조)
- 대표: Resend API 키 등록(미룸) · DMARC · 컨택 단가 · `outreach_auto_send` ON 여부
- 별도 세션(실결제 후): FEE_RESOLVER authoritative · 인플 커미션 사용-시점 확정

## 2차 (같은 세션 — 대표 "응 모두 해줘")

이상형 갭 ①③ 구현 (②매장 엔티티 단일화는 권고대로 보류 — 효익 대비 리스크):

- **① 서버 임시저장(기기 간 이어쓰기)**: `seller_voucher_drafts` 테이블(셀러 좌석당 1행,
  inline ensure + repair-schema 등록) + `GET/PUT/DELETE /api/seller/voucher-draft`.
  PUT 은 upsert(ON CONFLICT) + 900KB 상한 + rate limit(120/h). `updated_ms` 를 epoch 로
  내려 클라 Date 파싱 금지 계약(check-utc-date-parse 클래스 차단).
  ⚠️ seller_meta 를 안 쓴 이유: getSellerMeta 가 전 키를 읽어 수백 KB 드래프트가 모든
  meta 조회(fee-context 등)에 끌려다닌다 — 라우트 주석 + 테스트 R5 로 고정.
  클라: 마운트 시 로컬(동기 캡처) vs 서버 중 더 최근 것 복원 배너(`pickNewerDraft` 순수함수),
  서버 자동저장 5s 디바운스 + 명시 버튼 + 제출/폐기 시 양쪽 삭제. 전부 fail-soft.
- **③ 소비자 카드 실시간 미리보기**: `CardPreview.tsx` — 그루폰 위계(커버+할인 pill →
  머천트 → 제목 → 주소 → 정가취소선·판매가 → 유효기간) 미러. 2단계 하단 + 3단계(종전
  텍스트 요약 대체). ⚠️ 실제 GroupBuyFeedCard 를 안 쓴 이유: prefetch 계약이 미존재
  상품 id 로 허수 API 요청을 쏜다 — 컴포넌트 주석에 명시.
- 테스트: `voucher-draft.test.ts` 9건(R1 병합 우선순위 · R2 upsert+상한 · R3 epoch 계약 ·
  R4 양쪽 삭제 · R5 seller_meta 금지). **되돌려-검증**: upsert 를 DO NOTHING 으로 바꿔
  빨강 확인 후 복원.
- i18n: draftSaved 문구 갱신 + previewTitle — 6개 언어.

검증: tsc 0 · sql 3종 0 · theme 0 · voucher-draft 9 + seller-voucher-limit 12 pass.
