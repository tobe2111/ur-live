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

## 3차 (같은 세션 — 대표 "매장 등록에도 쓰이게 해줘")

지도 검색+자동입력을 **매장 등록**에도 배선 (두 방향):
- `components/seller/StoreRegisterModal.tsx` 신설 — SellerStoresPage 인라인 모달을 추출하며
  ①단계를 텍스트 목록 검색 → **KakaoMapPicker(지도+마커 선택+자동입력)** 로 교체.
  `initialPlace` prop 으로 미리 선택된 채 열 수 있다. ②채널 ③국세청 확인·POST /stores 계약 불변
  (kakao_place_id 중복은 서버 409 가 방어).
- `SellerStoresPage` 287→122줄(공용 모달 위임).
- 위저드 1단계: 지도에서 매장을 방금 고르면(placeSelected) "매장 등록" 브릿지 배너 —
  누르면 그 매장이 프리필된 등록 모달 → 성공 시 매장 칩 목록 갱신.
  ⚠️ 자동 등록은 하지 않는다: POST /stores 는 **새 sellers 행**을 만들므로, 첫 셀러의 자기
  좌석 매장까지 자동 등록하면 중복 행이 생긴다. 명시 버튼 + 서버 dedup 이 옳은 형태.

## 4차 (같은 세션 — 대표 "그냥 지금 하자 끝까지 신중하게" = 매장 단일화 + 승인분 2건)

PR #1195 는 squash 머지 완료(8b45409). 이번 조각은 새 PR.

**매장 프로필 단일화** (`src/worker/utils/store-profile.ts` SSOT — 빅뱅 재작성 대신
canonical + 쓰기 시 전파):
- canonical = seller_meta `store_*` 키(sellers 100컬럼 한도 — ALTER 금지 준수).
- `saveStoreProfileAndPropagate`: meta upsert + sellers 라벨 미러(business_name/phone/address)
  + **그 매장(seller_id 스코프) 상품 복사본 한 UPDATE 동기화**(기존 restaurant_name 보유분만 —
  쇼핑 상품에 매장 필드를 새로 만들지 않음). PIN 은 비어 있지 않을 때만(빈 값 전파 = 매장 검증
  무장해제). 읽는 쪽(소비자 상세·지도·SSR·캐시)은 **한 줄도 안 바꿈** — 복사본이 canonical 의
  물질화가 되므로 잠금 영역 무접촉.
- `adoptStoreProfileFromProduct`(fill-if-empty): 상품 등록 성공 시 빈 프로필 키만 채움 —
  첫 이용권 등록 = 매장 프로필 생성. seller-orders POST /products 에 fail-soft 배선
  (파일 1425→1440 rebaseline).
- 라우트: GET/PATCH `/api/seller/stores/:id/profile`(canOperateStore — brokered 매장은 owner
  부재라 owner-only 면 아무도 못 고침) + `/stores/context` 를 `mergeStoreProfile` 공유로 리팩터.
- UI: `StoreProfileModal`(매장 관리 "정보" 버튼) — "저장하면 이용권 N개에 반영" 카운트 표시,
  지도 재선택으로 좌표 갱신.
- 병합 우선순위 불변식: **최근 상품 > meta > sellers 행** — 전파가 상품을 항상 canonical 로
  갱신하고 위저드 상품 단위 수정은 상품을 더 신선하게 만들므로 이 순서가 항상 옳다.
- 테스트 `store-profile.test.ts` 8건(R1 스코프·R2 fill-if-empty·R3 PIN 가드·R4 권한·R5 병합·
  R6 배선) — **되돌려-검증**: 전파 WHERE 에서 seller_id 스코프 제거 → 빨강 확인 후 복원.

**승인 개선 2건**:
- 사진 R2 업로드: VoucherInfoStep 업로드가 base64→DB 대신 `/api/upload/image`(셀러 Bearer)
  → URL 저장. 실패 시에만 종전 data URL 폴백(fail-soft).
- 등록 완료 화면: KakaoShareButton(커머스 카드 — 정가취소선+할인가) + 판매 링크 복사.

**의도적으로 안 한 것**: 기존 상품 대량 백필(전파는 다음 프로필 저장 때 자연 수렴 — 프로덕션
대량 UPDATE 를 선제로 쏘지 않음), 읽기 경로 참조 전환(효익 0 리스크 +).

## 5차 (같은 세션 — 대표 AB테스트 개시: 셀러 대시보드 컴팩트화)

대표 지시: "여백이 많잖아. 컴팩트하게. 중요한 작업들이 모여있어야 해. 왼쪽 카테고리에도
이용권 등록 버튼. 재고부족 같은 라이브커머스 잔재 다 지워."

- **사이드바**: `seller-nav.ts` 홈 그룹에 '이용권 등록'(대시보드 바로 아래) + 심플 모드
  (`SellerSimpleNav`)에도 첫 항목으로(내 딜의 meal-voucher also 중복 활성 제거).
- **핵심 작업 결집**: PrimaryActions 를 가로형 컴팩트 5버튼으로 재작성해 헤더 바로 아래로 —
  [이용권 등록(다크 주역)·주문 확인·이용권 관리·정산·인플루언서 찾기]. QuickActions 는 흡수·삭제.
- **잔재 제거**: AlertsGrid(재고 부족 타일 포함 — 나머지는 stat 카드와 중복)·ConversionFunnel
  (시청자 지표)·라이브 stat 카드·both 모드 배지·GroupBuyOverview 이중 렌더·
  `/api/inventory/stock/alerts` 호출·재고 인사이트·할 일 재고 칩 전부 삭제.
  '상품 없음' 인사이트 CTA → /seller/meal-voucher/new.
- **컴팩트**: 4번째 stat = 정산 예정(실데이터, 종전 '진행 현황👇' 필러 대체).
  내 공개 페이지 = 큰 이미지 카드 → 한 줄(아이콘+경로+팔로워 칩+링크복사/새 탭/프로필 편집).
- SellerPage 695→593줄. 삭제: QuickActions/AlertsGrid/ConversionFunnel.tsx.
- 검증: tsc 0 · dashboard-theme 0 · theme 0 · seller 앵커 테스트 13 pass · i18n 2키 6언어.

## 6차 (2026-08-24 — 대표 AB테스트 2차: "첫 단계는 매장 등록, 무조건 선행")

대표: "대시보드 가장 첫번째 단계는 매장 등록. 선행 없이는 다음 단계·다른 서비스 이용 불가.
등록된 매장 정보도 보이고, 여러개면 여러 매장, 각 매장마다 이용권 설정."

- **서버 판정 SSOT**: `/stores/context` 에 `store_ready` — 주소/등록채널/좌표/**운영이력
  (lastProduct — grandfather: 게이트 신설이 기존 실운영 셀러를 잠그는 lock-out 방지)**.
  `listOperableStores` 에 address 추가(매장 카드 표시 + 등록 판정).
- **대시보드 1번 섹션 = `MyStoresPanel`**: 등록 매장 카드(이름·주소·상태·현재 좌석) —
  카드마다 [이용권 등록](좌석 전환→위저드) + [정보](프로필 수정·전파) + [매장 추가].
  등록 매장 0 → **STEP 1 게이트 히어로**(단계 프리뷰 ①매장→②이용권→③판매·협업→④정산)가
  그 자리를 차지하고 **아래 전부 잠김**(문의 경로만 예외). fail-open: 판정 중/실패엔 안 잠금.
- **위저드 하드 게이트**: storeReady===false 면 1단계에서 [매장 등록] 완료 전 다음 단계 차단
  (필수 배너 amber). 등록 성공 → **자동 좌석 전환**(이용권 귀속 정확) → 게이트 해제.
  pending(사업자 미확인)이면 전환 거부 = 잠금 유지(의도).
- 테스트 R7~R9(grandfather 되돌려-검증 완료). i18n seller.stores.* 18키 + mealVoucher 5키 6언어.
- ⚠️ 컨테이너 재시작으로 로컬이 옛 스냅샷(c79e52d)이었음 — origin/main 재체크아웃으로 복구.
  main 에 타 세션 머지(#1214 어드민 설정 저장 수리, #1215) 선반영돼 있음.
