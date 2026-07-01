# 🚧 진행 중 작업

## ✅ 2026-07-01 — 카카오맵 "매장 페이지 직접 연결" (place_url 캡처) (대표 "여전히 매장 카카오맵 페이지 연결 안됨")
E 후속 — `link/search`(검색) 는 정확한 매장 페이지를 못 열어서, **등록 시 카카오 장소 페이지 URL(`place.map.kakao.com/{id}`)을 캡처·저장**해 상세 지도가 직접 연결.
- **캡처**: 어드민 `ManualDealForm`(카카오 검색 `pick`) + 셀러 `SellerMealVoucherNewPage`(`KakaoMapPicker` `selectPlace`) → `place.place_url` 또는 `place.id`→URL 구성. 프록시(`/api/kakao/place/search`)는 이미 raw 카카오 응답(`id`/`place_url`) 통과 — 클라가 안 잡던 것.
- **저장**: `product_supply_meta.kakao_place_url` — 어드민 create/patch·셀러 create/PUT. `place.map.kakao.com/\d+` 형식만 허용(임의 URL 주입 방지). 셀러 edit 은 미전송 시 meta 보존(자동 유지).
- **반환**: group-buy 상세(`/products/:id`)·어드민 list·셀러 GET.
- **표시**: `RestaurantMiniMap` 에 `placeUrl` prop — 있으면 **매장 페이지 직접 연결**, 없으면 `link/search`(매장명+주소) → 좌표 map 폴백. `GroupBuyDetailPage` 가 `detail.kakao_place_url` 전달.
- **기존 상품**: place_url 없음 → `link/search` 폴백(직전 배포). 새로 저장/수정하는 상품부터 직접 연결. (대표 질문 "기존 이용권엔 적용 안됨?" = 맞음 — 캡처는 저장 시점.)
- 검증: tsc 0 · sql bind/column 0 · build 0. ⚠️ staging: 어드민/셀러에서 장소 검색·선택 후 저장 → 공구 상세 '카카오맵' 클릭 시 그 매장 페이지 직접 열림.

## ✅ 2026-07-01 — 목록페이지 "2번 로딩" 근본수정 (urdeal 로더 유지) (대표 "근본적으로 해결 — urdeal 로딩 그대로")
- **원인**: 로더 전면 통일 후 목록페이지(/vouchers·/group-buy·/browse) 하드로드 시 **로더가 2번**으로 보임 — ① 청크 다운로드=App.tsx Suspense **BrandLoader(전체화면)** → ② 페이지 마운트 시 **헤더/필터가 먼저 렌더**되고 그 아래 콘텐츠 영역에 **인라인 BrandLoader** 또 표시(`{loading ? <BrandLoader/> : ...}`). 같은 로더가 전체화면→(헤더 뜸)→인라인으로 이어져 "2번" 체감. (상세페이지는 전체화면 early-return 이라 원래 없음.)
- **근본수정(로더 유지)**: standalone 목록페이지도 상세처럼 **로딩 중 전체화면 `<BrandLoader fullScreen/>` early-return** → 청크 로더와 **끊김 없이 이어져 '한 번'**(헤더가 중간에 안 뜸). `GroupBuyListPage`·`BrowsePage` = `if (loading) return`; `VouchersPage` = `if (loading && !embedded) return`(홈 임베드는 청크 로더 없고 타 콘텐츠와 공존 → 인라인 유지). 인라인 `{loading?}` 블록은 embedded 전용으로만 도달.
- 스켈레톤으로 되돌리지 않고 **urdeal 로더 그대로** — 대표 요청대로. 상세/청크 로더 불변.
- 검증: tsc 0 · theme(strict) 0 · build 0. ⚠️ staging: /vouchers·/group-buy 하드로드 시 로더 1회만.

## ✅ 2026-07-01 — C 후속2: 1인당 결제 한도 **어드민 동네딜 도구**에도 (대표 "어드민 도구에도 넣어줘")
셀러 경로에 이어 어드민 수기 동네딜(`/admin/dongnedeal-import`)에도 1인당 한도 설정/수정.
- **서버** `admin-products.routes`: POST `/dongnedeal/create`(body `max_per_person` → `setSupplyMeta`) · PATCH `/dongnedeal/:id`(meta 별도 저장 — products 컬럼 아니라 **이것만 바뀌어도 저장**되게 params 체크 전 처리) · GET `/dongnedeal/list`(getSupplyMeta 배치 첨부 → 수정 prefill).
- **UI** `ManualDealForm`: `EMPTY`+prefill(editDeal)+입력 필드("1인당 최대 구매 수량 0=무제한", 2자리 cap). `DealRow` 타입에 `max_per_person`. payload(`{...f}`)가 create/patch 자동 포함.
- 저장 위치·서버 강제·소비자 표시는 셀러 경로와 동일 SSOT(`product_supply_meta.max_per_person`, group-buy.routes 검증). 어드민 라이트 테마(dark 0).
- 검증: tsc 0 · dashboard-theme(내 파일 0) · sql bind/column 0 · build 0. ⚠️ staging: 어드민 동네딜 등록/수정 시 한도 입력 → 홈 스텝퍼/주문검증 반영.

## ✅ 2026-07-01 — C 후속: 1인당 결제 한도 **수정(edit) 경로** 지원 (대표 "이어서 해")
등록(create)만 있던 1인당 한도를 이미 등록된 이용권 상품에서도 수정 가능하게.
- **서버 PUT `/api/seller/products/:id`**: body 에 `max_per_person`(0~99) 추가 → mealEditFields 루프 뒤 `setSupplyMeta`(0='0' 저장=무제한 해제, 1~99=제한). 소유권은 기존 existing 확인 재사용.
- **서버 GET `/products/:id`(prefill)**: `getSupplyMeta` 로 `max_per_person`(0=무제한) 응답에 추가.
- **UI `SellerProductEditPage`**(이용권 편집): formData `max_per_person` + prefill(`productData.max_per_person`) + meal_voucher payload 포함 + 입력 필드("1인당 최대 구매 수량", 0=무제한). 라이트 대시보드 테마.
- 검증: tsc 0 · sql bind/column 0 · theme(strict) 0 · build 0. ⚠️ staging: 기존 상품 수정 → 한도 설정/변경/해제(0) → 상세 스텝퍼·주문검증 반영.

## ✅ 2026-07-01 — C 이용권 1인당 결제 최대 한도(셀러 설정) 신설 (대표 "결제 최대 한도 갯수 1인 당")
매장 업주(셀러)가 이용권 등록 시 1인당 최대 구매 수량을 설정 → 서버 강제 + 상세 스텝퍼 cap. 예산제 준수(products 컬럼 추가 X → `product_supply_meta.max_per_person`).
- **저장(셀러)**: `SellerMealVoucherNewPage` 폼에 "1인당 최대 구매 수량"(0=무제한, 1~99) 입력 + 페이로드 → `seller-orders.routes` POST /products 가 `setSupplyMeta(max_per_person)`(menu meta 옆, fail-soft). 미설정/범위밖=무제한(미저장).
- **강제(서버)**: `group-buy.routes` 주문생성(toss/deal 공통, qty 검증 직후)에 사전검증 — `getSupplyMeta` 로 한도 조회(미설정=무제한, 추가조회 0), 설정 시 `qty ≤ 한도` + `유저 기존 미환불 이용권(unused/used) 누적 + qty ≤ 한도` 위반 시 400 `PER_PERSON_LIMIT`. **fail-open**(한도 조회 실패가 구매 안 막음 — 소프트 룰).
- **표시/cap(소비자)**: `group-buy-public /products/:id` 응답에 `max_per_person` 추가(이미 읽던 metaMap 재사용). `GroupBuyDetailPage` 스텝퍼 상한 10→`maxQty`(설정값 or 10) + 하단바에 "1인당 최대 N개" 안내(설정 시만).
- **범위**: 등록(create) 경로만(대표 "처음에 올릴 때"). 수정(edit) 경로는 후속. 서비스 분리: 소비자 이용권 전용(도매 무관).
- 검증: tsc 0 · group-buy/voucher 단위 84 pass · sql bind/column 0 · theme/light-input 0 · build 0. ⚠️ staging: 한도 N 설정 → 상세 스텝퍼 N cap + N개 초과/누적초과 구매 시 400.

## ✅ 2026-07-01 — 로더 유어딜 전면 통일(완료) + 카카오맵 매장 페이지 링크 수정 (대표 라이브 신고 연속 2)
- **A 로더 전면 통일(완료, 대표 "전면 통일해")**: 소비자 상세/목록 7페이지의 skeleton/스피너 → `BrandLoader`(SSOT). **상세**(전체페이지 반환): `GroupBuyDetailPage`·`VoucherDetailPage`(스피너)·`ProductDetailPage`(`ProductDetailSkeleton`) → `<BrandLoader fullScreen/>`. **목록**(인라인): `VouchersPage`·`GroupBuyListPage`·`BrowsePage`(카드그리드 skeleton)·`MyVouchersPage`(`WalletSkeleton`) → `<BrandLoader/>`. 미사용된 `ProductDetailSkeleton`/`WalletSkeleton` import 정리. **잠긴 SSR seed 로직 불변**(seed 있으면 loading=false → 로더 미노출, seed-miss/콜드 SPA 이동에만). 대표 확인: 실제 데이터 fetch 속도 동일, skeleton의 CLS/체감 이점만 트레이드오프(전면 통일 선택).
- **E 카카오맵 매장 페이지 링크(대표 "카카오맵에 매장 페이지가 안 나옴")**: `RestaurantMiniMap` 외부 링크가 `link/map/{name},{lat},{lng}`(좌표 핀만, 장소 페이지 안 열림 + 좌표 오차 시 빈자리) → **매장명+주소 `link/search`**(카카오 등록 장소가 떠서 매장 페이지 연결, 좌표 정밀도 무관). name/address 없을 때만 좌표 map 폴백.
- 검증: tsc 0 · theme(strict) 0 · build(client+ssr+prerender+worker+prepare) 0.

## ✅ 2026-07-01 — 어드민 동네딜 수정 홈 즉시 반영(캐시 무효화) + 공구상세 하단바 축소 + 로더 통일 착수 (대표 라이브 신고 연속)
- **D 동네딜 캐시 무효화(대표 "수정해도 홈에 바로 반영 안됨")**: `/admin/dongnedeal-import` 뮤테이션(`admin-products.routes` create·patch·seed-demo POST/DELETE·bulk-import 5곳)이 **공구 목록 앱 캐시(`group_buy_products:*`)를 전혀 무효화 안 함** — 셀러 상품등록은 `invalidateGroupBuyProductsCache` 호출하는데 어드민만 누락 → 홈/동네딜 stale. 셀러와 동일 패턴으로 5곳 배선(SESSION_KV, fail-open). **잔여**: edge/SSR `caches.default`(≤300s)·CDN(≤900s) TTL 은 별도 — 앱 캐시 무효화로 TTL 만료 시 fresh 재계산 보장(이전엔 만료돼도 stale 앱캐시 재사용). 진짜 0초는 edge 퍼지(잠금영역) 필요.
- **B 공구상세 하단 구매바 높이 축소(대표 "하단이 너무 높다")**: `GroupBuyDetailPage` footer 패딩 11/13→7/8·행 마진 10/9→6/6·버튼 53→50 (약 19px↓). 탭 타겟 유지.
- **A 로더 유어딜 통일 착수(대표 "전면 통일")**: 공구상세 skeleton → `BrandLoader`(SSOT). 나머지 소비자 상세/목록은 진행 중. SSR seed 있으면 loading=false 라 seed-miss/콜드 SPA 이동에만 노출.
- 검증: tsc 0 · build 0.

## ✅ 2026-07-01 — 사전방지 가드 2종 신설 (대표 "앞으로 문제 없게 사전 방지") — 이번 감사 미보유 클래스 박제
도매 3표면 감사에서 **가드가 없어서** 생긴 2개 버그 클래스를 결정론적 가드로 박아 재발 구조적 차단(레포 철학 "버그 클래스 발견 시 가드부터").
- **① `check-deprecated-pricing.mjs`** — 도매 공급가 모델 드리프트 방지. 폐기 `distributorPriceFromRetail`/`distributorPrice` 직접호출 금지 → `resolveDistributorPrice` SSOT 강제. (내보내기가 실결제가와 다른 등급가 낸 HIGH 사고 재발 차단.)
- **② `check-balance-absolute-write.mjs`** — `*balance*` 컬럼 절대값 write(비원자 read-modify-write) 금지 → 원자 증감/CAS만(한 UPDATE 에 컬럼 2회+). 스냅샷 `*_after` 예외. (미수금 상환 race 재발 차단.)
- 배선: audit-gate(머니 도메인) + verify.yml(strict) + pre-commit(warn) + AUDIT_INVARIANTS + CLAUDE.md 방어선. 음성테스트(폐기함수 호출/절대값write 잡고 산술·CAS 통과) 통과. **audit-gate 41 GREEN**.

## ✅ 2026-07-01 — 도매몰 3표면(판매사·제조사·도매어드민) 심층 감사 + 확정 3건 fix (대표 "세 대시보드 모두?")
pagination 크래시 수정 후속 — 세 표면을 **가드 미보유 영역**(런타임 크래시·정산/금액 정확성·환불 대칭)으로 병렬 심층 감사(에이전트 3). audit-gate GREEN 영역(서비스분리·RBAC·머니패턴·주문상태머신)은 가드 신뢰로 스킵.
- **판매사 표면: clean**(예치금 차감/복원 CAS·주문 총액 서버재계산·MOQ·tier floor·환불 대칭 전부 정합). 유일 지적=내 pagination 코드모드가 `wholesale.routes.ts` 에 넣은 **mid-file import**(CLAUDE.md 금지 패턴, hoist 되어 무해하나 정리) → 상단 import 블록으로 이동.
- **제조사 표면: clean**. 에이전트가 올린 '소비자 환불 재고 과다복원'은 **오탐 확정**(이 반품 경로는 `returns.routes:656` 에서 주문 전체 품목 취소=full-order + `reversed>0` 게이트로 멱등 + 판매사복제본↔공급원본 재고는 별개 풀 → 이중복원 없음).
- **도매어드민: 확정 3건 fix**:
  - 🔴 **상품 엑셀 내보내기 가격 모델 불일치**(`products-pricing.ts`): 내보내기가 폐기 모델 `distributorPriceFromRetail`(판매가×(1−보장마진)·**등급차등**)을 써 라이브 결제가(`resolveDistributorPrice` cost-plus·**전등급동일**, 2026-06-17 대표확정)와 전혀 다른 A/B/C 등급가를 제안 문서로 내보냄(상거래 분쟁 소지). → `resolveDistributorPrice`(+`loadPlatformCommissionPct` 전역마진)로 통일, 라이브 주문가와 정합. 등급 통일이라 A/B/C 컬럼은 동일값(실가).
  - 🟡 **강제환불 롤백 상태 강등**(`orders.ts:153`): Toss 취소 실패 시 롤백이 `status='PAID'` 하드코딩 → SHIPPED/ACCEPTED/DONE 레거시 Toss 주문이 '결제완료'로 강등돼 상태머신 꼬임. → 원본 `order.status` 복원.
  - 🟡 **미수금 상환 비-CAS**(`distributors.ts` credit-repayment): `outstanding_balance` read-modify-write(절대값 write)라 동시 상환 2건이 하나를 덮어써 미수금 과대계상(플랫폼 채권 부풀림) 가능. → 원자 CAS(`WHERE COALESCE(outstanding_balance,0)=prevOut`) + 실패 시 409 재시도, 원장은 CAS 성공 후에만.
- 검증: tsc 0 · 단위 2443 pass · build 0 · audit-gate 39 GREEN(머니패턴 포함).

## ↩️ 2026-07-01 — 카드 이용권 셀프취소 "동기 revert" 수정 **자체 회귀 → 원복** (대표 "더 확인해볼 건")
직전 커밋(`d15afd7`)에서 카드 셀프취소를 동기+실패시 voucher unused 복원으로 바꿨으나, **후속 검증에서 자체 회귀 발견 → 원복**.
- **왜 회귀였나**: `cancelTossPayment`(toss-gateway)는 **retryable 실패(5xx/PROVIDER_ERROR)**를 `toss_refund_failures` 에 기록하고 `toss-refund-retry` cron(최대 5회 backoff)이 **나중에 환불을 완성**한다(voucher='refunded' 유지가 정답). 원본 async 패턴은 이 cron 백업이 있어 retryable 실패에 이미 안전했고, 실제 갭은 non-retryable(4xx)뿐. 내 "동기 revert" 는 retryable 실패에도 voucher 를 unused 로 되돌리는데, **같은 실패가 cron 으로 재시도돼 성공하면 유저가 이용권+환불 이중이득**(플랫폼 손실). 게다가 셀러(/refund)·어드민 강제환불의 established async+cron 패턴에서 이탈.
- **조치**: `group-buy-voucher.routes.ts` 카드 분기를 **원본 async(waitUntil) 로 원복** + **왜 이 패턴이 의도된 설계인지 주석 명시**(다음 세션 재발 방지 — retryable=cron 완성, 동기 revert 금지).
- **교훈**: 결제 side-effect 를 "고치기" 전에 **cron 재시도/dead-letter 백업 경로를 먼저 확인**할 것. 부분 분석으로 잘 설계된 async 패턴을 동기화하면 이중환불 유발. (추측 금지 룰의 실사례.)
- 검증: tsc 0 · money-pattern 0 · sql-bind/column 0 · voucher 단위 36 pass · build 0. 순 효과: 코드 동작은 `d15afd7` 이전과 동일 + 설명 주석 추가.

## ✅ 2026-07-01 — 도매몰 라이브 전수조사 + 카탈로그 500 크래시 근본수정 (대표 "라이브로 접근해서 전수조사")
라이브(`live.ur-team.com/wholesale`) 실접근 전수조사. **결과: 인증/RBAC 게이트 전부 건강(500 없음, 401/404 정상)·엣지캐시 누수 없음·SQL 인젝션 방어 정상.** 발견/수정:
- **🐛 라이브 500 크래시(수정)**: `GET /api/wholesale/catalog?page=abc&limit=xyz` → HTTP 500. 원인: `page = Math.max(1, parseInt(query||'1',10))` 에 `limit` 이 가진 `|| N` 폴백이 **없어** `parseInt('abc')=NaN → Math.max(1,NaN)=NaN → offset=(NaN-1)*limit=NaN → D1 .bind(NaN) 크래시`. `limit=-1/page=-5/limit=99999999` 는 이미 정상(200) — **비숫자 문자열만** 크래시(봇/스크래퍼/오염된 링크가 도매몰 메인 카탈로그를 500). **수정(도매 서비스 전 인스턴스에 기존 `limit||24` 패턴 미러링)**: `wholesale.routes.ts:787`(page), `supplier-dashboard.routes.ts`(page/limit ×3 핸들러), `distributor-admin/orders.ts`(page/limit), `supply.routes.ts`(page/limit). 전부 `parseInt(...) || N` + `Math.max(...,1)` 클램프. 로직 검증(page=abc→page1/offset0)·tsc 0(사전 config 경고 제외)·build 0·sql bind/column 가드 0.
- **✅ 전 서비스 일괄 수정(대표 "모두 고쳐줘")**: 같은 NaN 크래시 클래스를 도매뿐 아니라 소비자(`group-buy-public`·`community-group-buy`·`referral-tree`·`wishlists`)·에이전시·어드민(`admin-*`·`kt-alpha`)·셀러(`seller-orders`·`seller.routes`·`seller-management`)·정산·알림·리뷰·유튜브·telemetry 전 영역에서 수정. `parseInt` 43라인(코드모드) + `Number(...)` 4건(수동) + bare `parseInt(page,10)` 5건(수동). ID 해석용 parseInt(`numId`/`numericUid` — `isNaN` 가드 보유)는 무관하므로 미변경. `Number(q)===30?30:7` 삼항(NaN 전파 불가)은 안전.
- **🛡️ 영구 가드 신설**: `scripts/check-pagination-nan.mjs` — request pagination(page/limit/offset/days…)이 `parseInt/Number` NaN 폴백 없이 assign 되면 차단(닫는 괄호 뒤 `|| 숫자` 또는 `isNaN`/`Number.isFinite`/삼항리터럴 필요). `verify.yml`(strict)·`audit-gate.sh`(schema 도메인)·pre-commit(warn)·`AUDIT_INVARIANTS.md`·CLAUDE.md 방어선 표 등록. 현재 위반 0(scanned=143, safe=143). 예외 `pagination-nan-ok` 주석.
- **검증**: tsc 0(사전 config 경고 제외)·build(client+ssr+prerender+worker+prepare) 0·SQL bind/column 가드 0·audit-gate 38 GREEN(무관 file-size RED 1건=타 세션 blog.routes/worker index).
- **📋 데이터 큐레이션(코드 아님)**: 라이브 도매 카탈로그 상품이 **시드/테스트 2개뿐**(id 6 "Canvas Tote Bag" 영문 unsplash 데모 · id 2306 "테스트"/"좋은제품" 빈 이미지). 배너·게시판·제안 큐 전부 비어있음(정상 상태이나 운영 콘텐츠 필요).
## ✅ 2026-07-01 — 알림 라이브 전수조사(프로덕션 실측) + 웹푸시 활성화 견고화 (대표 "전수조사 라이브로 접근해서")
코드가 아닌 **라이브(live.ur-team.com) 실측**으로 알림 파이프라인 전수조사. 인증 필요 채널(인앱/대시보드/에이전시/공급자)은 401 정상 게이트 확인, `/api/notifications/unread-count`는 비인증 200 `{count:0}`(데이터 누출 0, 무해). **핵심 발견(설정 누락 — 코드 건강)**:
- 🔴 **웹푸시가 프로덕션에서 완전 비작동(클라·서버 양쪽)**. ① 배포 번들(`app-components`)에 `const a=void 0; if(!a)return` — 빌드타임 `VITE_VAPID_PUBLIC_KEY`가 비어 subscribe 함수가 **항상 즉시 종료**(배너도 안 뜸). ② 서버 `/api/push/vapid-public-key`가 `""` 반환 → 런타임 `VAPID_PUBLIC_KEY` 미설정 → `sendSystemPush` 웹경로 no-op(`system-push.ts:51` 게이트). 인프라는 건강(`push-sw.js`가 push/pushsubscriptionchange/notificationclick 핸들러 전부 배포). **즉 이번 세션들에서 만든 RFC8291 암호화·self-heal·410 복구 등 전체 웹푸시 스택이 라이브에선 휴면** — 교환권 만료/공구 마감/재입고/가격인하/결제완료 웹푸시가 웹 유저에게 0건 도달.
- 🟠 **네이티브 푸시(FCM v1)도 미설정 가능성**: `messages:send`가 `FIREBASE_PROJECT_ID` 필요(URL). `/api/version`이 그동안 이 값을 안 봐 미확인 — 이번에 진단에 추가. (설정돼도 Capacitor 앱 유저 한정, 웹 미해결.)
- 🟡 **운영 가시성 공백**: `/api/version` secret 진단이 VAPID_*·FIREBASE_PROJECT_ID를 안 봐 이 누락이 표준 진단에서 안 보였음(그래서 대량 코드작업에도 미발견).

**반영(안전·additive, 잠금파일 무수정)**:
1. `PushNotificationSetup.tsx` — VAPID 공개키를 **런타임 서버(`/api/push/vapid-public-key`) 우선**으로 해석(`resolveVapidKey()`, 빌드변수 폴백). → 공개키 SSOT를 서버 런타임 하나로 통합(build/runtime drift 제거) + secret 설정만으로 **재배포 없이** 구독+서명 키 자동 일치. 키 없으면 기존처럼 배너/구독 skip.
2. `public-utility.routes.ts` `/api/version` — secret 진단에 `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`/`FIREBASE_PROJECT_ID` boolean 추가(값 미노출).

**⚠️ 근본 해결은 운영자 몫(코드 아님)**: Cloudflare에 `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`(웹푸시), `FIREBASE_PROJECT_ID`(+기존 FIREBASE_PRIVATE_KEY/CLIENT_EMAIL, 네이티브푸시) secret 설정 필요. 설정 후 `/api/version`으로 확인 → 웹푸시 즉시 활성(1의 런타임 해석 덕에 재빌드 불필요). VAPID 키쌍 생성: `npx web-push generate-vapid-keys`.
  - **2026-07-01 후속**: 대표가 VAPID 3종 secret 등록 완료. Pages는 secret 추가 시 새 배포가 있어야 런타임 주입되므로 본 커밋으로 재배포 트리거(secret 값 자체는 미변경). **라이브 검증 완료**: `/api/version` VAPID 3종 `true` · `/api/push/vapid-public-key`가 등록한 공개키 반환(빈문자열→해결) · 서버↔등록키 일치.
  - **2026-07-01 2차 개선(웹푸시 활성화 후 추가 확인)**: (1) **채널 진단 확장** — `/api/version` secret 진단에 `RESEND_API_KEY`(이메일)·`ALIGO_API_KEY`/`ALIGO_USER_ID`(알림톡) 추가. 이 둘도 키 없으면 조용히 no-op 하는 동일 패턴이라 이제 어느 채널이 죽었는지 한눈에 보임. (2) **셀프 테스트 푸시** `POST /api/push/test`(requireAuth, 호출자 **본인 구독에만** 발송 — 임의 대상 불가) — VAPID 켠 뒤 실제 전달을 E2E 확인할 유일 수단이 없던 공백 해소. 반환값(skipped/subscription_count/delivered/expired)으로 미도달 원인 진단. (3) 어드민 `AdminSystemMonitoringPage`에 **알림 채널 상태 배지(웹푸시/이메일/알림톡/네이티브푸시 ✓✕) + "나에게 테스트 푸시" 버튼**(라이트 테마, dark: 0). 발송경로 조사 결과 `sendSystemPush`는 VAPID 게이트·`push_enabled` 유저설정 존중·410 만료삭제·dead-letter 재시도·네이티브 독립으로 **건강** 확인. push-sw.js는 `no-store`(핸들러 갱신 전파 OK)·subscribe 401(인증) 정상. 검증: tsc 0·theme-consistency(strict) 0·build 0.
- 검증: tsc 0(사전 config 경고 제외) · build(client+ssr+prerender+worker+prepare) 0 · theme(strict) 0.

## ✅ 2026-07-01 — 이용권 명칭 통일 잔여 "숙소권" → "숙소 이용권" (대표 "이용권 내용 진행 — 모두")
이용권 전수조사(명칭/버그/UI/기능 4방향 병렬) → **실제 잔여 부채는 명칭 1종**. 나머지 3방향은 오탐/기수정/별도영역 확인.
- **명칭 (수정 완료)**: 사용자-가시 "숙소권" 12건(6파일) → "숙소 이용권"(SSOT `getVoucherShortLabel`='숙소 이용권'과 정합). 파일: `stay-voucher-expire.ts`(알림톡 제목)·`StayCheckout.tsx`·`SellerStayNewPage.tsx`(판매방식 라벨·유효기간 필드)·`StaysSearchPage.tsx`·`MyStaysPage.tsx`(배지)·`StayDetailPage.tsx`(3곳: 모드 라벨·요약)·`stays-public.routes.ts`(3곳: 에러메시지·응답 라벨). 주석 5건(GroupBuyListPage·stays-public 버그기록)은 CLAUDE.md 규칙대로 보존. "평일권/주말권"(권종 변형)은 불변.
- **버그 (조사 결과 오탐/기수정)**: ① 셀프취소 정산 미회수 의혹 → 셀프취소는 `status='unused'` CAS 대상뿐이라 정산분 없음(오탐). ② influencer_attributions voucher_id NULL 누수 → 2026-05-31 order_id 기반으로 기수정. ③ MyVouchers 절약액 NaN → 이미 `(pct>0 && pct<100 && paid>0)` 가드. 감사 게이트 머니 GREEN 영역 견고 재확인.
- **다국어 locale**: zh/es/fr/ja 의 옛 "식사권"·团购券 → **2026-06-29 결정("전면 다국어 prose 정합=KR-primary라 별도")** 유지(대부분 `[TODO]` 미번역 플레이스홀더). ko(주 언어)는 이미 0건.
- **알아둘 것(미수정, 대표 판단 필요)**: 카드결제 교환권 셀프취소 시 Toss 취소가 waitUntil 비동기라 실패하면 voucher='refunded'인데 orders='PAID' 잔존 갭 — 드물고 잠긴 결제영역 인접이라 문서화만.
- 검증: tsc 0(config 경고 제외)·theme(strict) 0·sql-bind 0·blog-seed-currency 0·build(client+ssr+prerender+worker+prepare) 0.
## ✅ 2026-07-01 — 유어딜 소비자 전수감사(가드 미보유 영역) — 확정 3건 fix (대표 "더 깊게 파봐")
감사 게이트(37 GREEN/1 RED=선재 file-size 드리프트) 후 **가드 미보유 3영역**(결제 금액정확성·런타임 크래시·외부 PG 실응답)을 라이브+정적으로 심층 감사. 라이브 소비자 API/SSR 전부 건강(200·주입 정상), 크래시 스윕 CLEAN(신규 fcfs/블로그/알림 UI 방어적). **확정 3건 수정**:
- **#1 (SEO) sitemap.xml stale — 블로그 20개 중 16개 404 + 상품/공구 전무**: 근본원인=`public/sitemap.xml`(옛 하드코딩, 폐기 슬러그 why-live-commerce·meal-voucher-business 등)이 `_routes.json` exclude 로 Pages 직접 서빙 → 워커 동적 `sitemap.routes.ts`(`WHERE is_published=1`) 완전 우회. **수정**: exclude 에서 `/sitemap.xml` 제거 + 정적파일 삭제(git rm) → 워커 동적 라우트가 서빙(상품/공구/블로그 published + 서비스분리 필터 포함). 동적 배열의 `/live`·`/shorts`(LIVE_COMMERCE_SUSPENDED)도 제거(폐기기능 URL 크롤 방지).
- **#2 (머니) 반품환불 경로 쿠폰 미복원**: `returns.routes PUT /:id/refund` 이 역전을 인라인 재구현하며 `coupon_uses` 복원만 누락(`refundOrderFully`·주문취소는 복원). → 1회용 쿠폰 영구소진+used_count 과대. **수정**: order-refund SSOT 미러 쿠폰 un-use 블록 추가(CAS `transitioned` 게이트 하 단일실행, 자연멱등).
- **#3 (머니) 초대보상 1,000딜 환불 미회수(파밍 벡터)**: `grantInviteRewardForFirstPurchase` 적립만 있고 clawback 0. **수정**: `reverseInviteRewardOnRefund`(invite-reward.ts) 신설 — 환불 후 초대받은 유저 유효주문 0이면 초대자 보상 회수(다른 유효구매 있으면 보류), 멱등 CAS(granted→expired) + `MAX(0,...)` clamp. `reverseOrderAncillaryOnRefund`(전액환불·주문취소 자동커버) + returns 양경로 배선.
- 검증: tsc 0 · build 0(client+ssr+prerender+worker) · money-pattern/sql bind·not-null·column·table 가드 0 · audit-gate 37 GREEN(file-size RED 는 선재 드리프트, 본 변경 무관). ⚠️ staging 실결제 권장: 쿠폰주문 반품환불 시 쿠폰 재사용 가능 + 초대유저 첫구매 환불 시 초대자 딜 회수.

## ✅ 2026-07-01 — 알림 코드 마무리 4종 + 위시리스트 오발송 버그 fix (대표 "코드로 더 할 수 있는거")
- **#4 알림톡 `approve`/`approved` 오탐 정정**: 이전 진단에서 "미등록 의심"으로 잡은 `approve`/`approved`는 삼항 조건(`action==='approve' ? 'distributor_approved' : ...`)이라 실제 template 코드가 아니었음(grep 오탐). SSOT `alimtalk-templates.ts`에서 제거 + `test`는 셀러 브랜드메시지 테스트 코드로 주석. **버그 아님 확인.**
- **#5 위시리스트 dedup 테이블 repair-schema 등록**: `wishlist_stock_notifications`·`wishlist_price_notifications`(크론 self-ensure만 하던 것) → fresh/repaired DB 보장.
- **#6 + 🐛 재입고 오발송 근본 fix**: (b) 크론이 **항상 재고 있던 찜 상품에도 "재입고!" 오발송**하던 버그(dedup 행이 없으면 in-stock을 재입고로 오인) 발견 → 찜 추가 시점에 `seedWishlistBaseline`(재고>0이면 stock dedup 시드 → 오통지 차단 / 가격 baseline=찜 시점가). 찜 제거 시 `clearWishlistBaseline`(dedup 누적 방지 + 재추가 fresh). `wishlists.routes` 추가/제거 5경로 배선(toggle·POST·DELETE ×3). 가격 baseline이 '첫 스캔가' → '찜 시점가'로 개선(#6).
- **#7 dead code 제거**: 미사용 `NotificationBell.tsx`(어디서도 import 0, 자체 뱃지 버그 보유) 삭제. 실사용 소비자 벨은 `useUnreadCount`(정상).
- 검증: tsc 0 · 단위 pass · build 0 · sql bind/not-null/column/table 가드 0. ⚠️ staging: in-stock 상품 찜 → 재입고 알림 **안 옴**(정상) / 품절→재입고 시에만 1회 / 찜 직후 인하도 통지.

## ✅ 2026-07-01 — 유어딜 정산 세금계산서 역발행 (매입) — 카카오 애드핏/유니포스트 모델 (대표 "가장 이상적으로")
소비자(유어딜 공구) **사업자 유저 셀러 정산**의 세금계산서 자동화가 stub만 있고 역발행 0이던 것을 신설. 방향=셀러(공급자)→유어딜(공급받는자) **매입세금계산서 역발행**(유어딜이 초안 자동작성 → 셀러 대시보드 승인 → provider 발행). 애드핏=유니포스트 역발행과 동일 구조.
- **게이트웨이** `src/worker/utils/tax-invoice-gateway.ts` — provider-agnostic("직접 fetch 금지" 철학). `REVERSE_INVOICE_PROVIDER`=`unipost`(실 API 스켈레톤)/`stub`(스테이징)/미설정(`none`=draft만·cost-0). env.ts에 `UNIPOST_*` 추가.
- **모듈** `src/features/seller/api/settlement-tax-invoices.ts` — `settlement_tax_invoices`(UNIQUE settlement_id 멱등) 스키마·`generateSettlementReverseInvoice`(사업자 유저 verified 게이트+VAT split)·목록·승인(CAS)·재발행. 전부 fail-soft·additive.
- **앵커**: `admin-payout-center.routes` `seller/:id/paid`(settlements→'paid', 실 현금지급 이벤트)에 waitUntil additive 훅. 정산 지급/금액/원천징수 로직 **byte 불변**.
- **UI**: 셀러 `SellerSettlementsPage`에 `SettlementTaxInvoicesSection`(승인 버튼). 어드민 `AdminPayoutCenterPage`에 역발행 현황 패널(재발행·provider 상태). i18n 6개 언어(`seller.taxinv.*`).
- **라우트**: seller `GET/POST /api/seller/settlement-tax-invoices[/:id/approve]`, admin `GET/POST /api/admin/tax/settlement-invoices[/:id/reissue]`. repair-schema 등록(`settlement_tax_invoices`·`seller_business_info`).
- 설계: `docs/design/settlement-reverse-issuance.md`. 가이드(셀러/어드민) 갱신. **서비스 분리**: 도매 `wholesale_tax_invoices`와 별개 소비자 전용.
- ⚠️ 세무 검토(문서화): 사업자 유저 `deal-withdraw`의 8.8% 원천징수 vs 세금계산서 중복은 실 발행 전 정책 확정 필요(현재 draft라 기존 로직 무변경). ⚠️ staging: `REVERSE_INVOICE_PROVIDER='stub'`로 승인 E2E 1회 후 유니포스트 실발행.
- 검증: tsc 0(사전 config 경고 제외) · sql table/bind/not-null/column 가드 0 · theme(strict) 0 · file-size 0.

## ✅ 2026-07-01 — 알림 후속: 알림톡 템플릿 진단(a) + 위시리스트 재입고/가격인하 알림(b) (대표 "a,b")
2차 조사에서 남긴 deferred 항목 2건 처리.
- **(a) 알림톡 템플릿 불일치 진단**: `aligo.ts sendAlimtalk`엔 **SMS 폴백이 없어**, 미등록/불일치 `tpl_code`는 Aligo가 `result_code!=1`로 거부→`alimtalk_failures`에 쌓여 3회 재시도 후 방치(전달 0, quota 낭비). 코드가 쓰는 template 코드 ~24개 중 문서상 등록 세트에 없는 게 다수(appointment_* 5·auction_won·distributor_*·supplier_*·payout_completed·seller_settlement_completed·voucher_refunded + `approve`/`approved`/`test` 오용 의심). 실제 등록 여부는 Aligo 콘솔(운영 사실)이라 코드에서 직접 못 봄 → **프로덕션 실패를 가시화하는 진단 도구** 제공: ① SSOT `src/lib/alimtalk-templates.ts`(사용 코드 전량 + 문서상 등록 세트 + `isDocumentedRegistered`). ② admin `GET /api/admin/alimtalk-failures`에 **`by_template`**(미해결 실패를 template_code별 그룹 + 등록여부 주석) 추가. ③ `AdminSystemMonitoringPage` 알림톡 탭에 "템플릿별 진단" 섹션(미등록/등록 배지·미해결/포기 수). **발송 로직 무변경(fail-open)**. 실제 수정=운영자가 진단 보고 Aligo 콘솔에 미등록 템플릿 등록.
- **(b) 위시리스트 재입고/가격인하 알림**: emitter 0이던 소비자 리텐션 알림 신설. 재고/가격 write는 여러 곳(일부 잠금)에 흩어져 hooking 대신 **도매 재입고 크론과 동일 저결합 스캔 패턴**. `src/worker/cron/wishlist-notify.ts` 2함수 — 재입고(`wishlists` × `stock>0` 회복, 품절 시 dedup 삭제→재입고 재통지)·가격인하(첫 관측 baseline만, 이후 `price<last_price`만 통지). 별도 dedup 테이블(`wishlist_stock_notifications`·`wishlist_price_notifications`, 멱등 CAS)로 `wishlists` 핫 테이블 불변. 통지=`notifyUser`(인앱)+`sendSystemPush`(웹/네이티브, push_enabled 존중). `scheduled.ts` 매시간 등록. 링크 voucher→`/group-buy/:id` 아니면 `/products/:id`.
- 검증: tsc 0 · 단위 64 pass · build 0 · sql/theme 가드 0. `[SKIP_SIZE]`. ⚠️ staging: 찜 품절→재입고 알림 1회 + 가격 인하 시 1회 + admin 알림톡 by_template 확인.

## ✅ 2026-06-30 — 판매사 대시보드 overview 에 수령확인 nudge (일관성) (대표 "계속 자율")
- **배경**: 카탈로그 홈(`WholesaleCatalogPage`)엔 '수령 확인 대기' 배너가 있는데 **판매사 대시보드(`WholesaleDashboardPage`) overview 엔 없어**, 대시보드로 바로 들어온 판매사는 구매확정 nudge 를 놓쳤음(표면별 비대칭).
- **수정(additive)**: overview KPI 카드 아래에 '수령 확인 대기 N건' 카드 — **이미 로드된 `orders`** 로 SHIPPED/PARTIAL_REFUNDED 카운트(추가 fetch 0), 클릭 시 주문 탭. 카탈로그 홈 배너와 동일 문구/액션. count 0 이면 미표시.
- **불변**: KPI·빠른메뉴·멤버십·주문탭 전부 불변(카드 1개 additive). 라이트 대시보드 테마(dark: 0).
- 검증: tsc 0 · build 0 · theme(strict) 0.

## ✅ 2026-06-30 — 도매 카탈로그 검색/필터 UX (미뤘던 것) — 결과0 복구 + 더보기 (대표 "미뤘던 것 + 자율 개선")
이전에 미뤘던 판매사 카탈로그 discovery 개선.
- **A) 결과 0 복구 CTA**(`6d2bdee`): 검색/필터 결과가 0일 때 '없어요' 한 줄 막다른 길 → 필터/검색 활성 시 '검색·필터 초기화' 버튼(검색어·카테고리·정렬·재고·가격대·브랜드 일괄) + 검색어 표시. 진짜 빈 카탈로그면 기존 안내.
- **B) 더보기(페이지네이션)**: 카탈로그가 **24개만 보이고 더보기 없음**(서버는 `has_more` 리턴하는데 클라 무시) → 상품 늘면 24개 이상 못 봄. **purely additive**: 1페이지(`catalogQ`)는 SSR/잠금 로딩 **완전 미접촉**, 2페이지+만 별도 `api.get(...&page=N)` 로 누적(append, id 중복제거), 서버 `has_more` 로 버튼 노출 판정. `initialData`/`placeholderData`/`queryFn`/worker SSR 전부 byte-불변 → 첫 페인트·0-RTT 캐시 불변(추가 페이지만 라이브 fetch). 필터/검색/등급(catalogKey) 변경 시 누적 초기화.
- **불변**: 서버 `/catalog` 로직·SSR·기본 요청 URL·잠긴 로딩 전부 불변(잠금 심볼 미변경, 순수 추가). ⚠️ 24-cap 은 상품 수 적어 아직 미발현이나 확장 대비 선제 해소.
- 검증: tsc 0 · build 0 · theme/가드 0.

## ✅ 2026-06-30 — 제조사 발송뷰에 배송 메시지 노출(단일 수령 주문) (대표 "다음으로")
- **문제**: 판매사가 결제 시 남긴 배송 메시지가 제조사 발송 화면(`SupplierWholesaleOrdersPage`)에서 **드랍십(받는사람 여럿)일 때만** 노출되고, **일반 단일-수령 주문에선 안 보였음** → 발송 지시("부재 시 문 앞" 등) 누락 가능. 게다가 supplier orders API 가 `i.ship_to_message`(라인 레벨)만 반환해, 단일 주문 메시지(헤더 `o.ship_to_message`에 저장)는 애초에 안 넘어왔음.
- **수정(2)**: ① API `wholesale-supplier.routes` 두 쿼리의 `i.ship_to_message` → `COALESCE(i.ship_to_message, o.ship_to_message)`(다른 ship_to 필드와 동일 폴백 패턴 — 라인 우선, 없으면 주문 헤더). ② UI 단일-수령 배송지 블록에 `💬 {ship_to_message}` 노출(드랍십 브랜치는 이미 라인별 메모 표시 — 불변).
- **불변**: 드랍십 라인별 메모·합배송·발송/수락/거절 로직·배송지 나머지 전부 불변(SELECT 폴백 1개 + 표시 1줄). `o.ship_to_message` 는 ensureOrderTables ensure 컬럼.
- 검증: tsc 0 · build 0 · column-exists/bind 가드 0.

## ✅ 2026-06-30 — 판매사 도매몰 알림 벨 (배선한 알림을 볼 UI) (대표 "다음으로")
- **문제**: 이번 세션에서 판매사 알림을 대거 배선(발송 시작·수락·거절·환불·예치금 확인/반려·클레임·주문메모…, 전부 `recipient_type='seller'`)했는데 **도매몰(판매사) 표면엔 알림함/벨이 0** — 제조사는 `NotificationsBell`(`/supplier`)이 있으나 판매사는 없어 배선한 알림이 전부 안 보였음. (`WholesaleUtilBar`·`WholesaleDashboardPage` 어디에도 벨 없음.)
- **수정(재사용)**: 공용 `DashboardNotificationBell`(SellerLayout 이 이미 `tokenKey="seller_token"` 로 `/api/dashboard-notifications` 사용)을 **공유 상단바 `WholesaleUtilBar` 에 배치**(loggedIn=판매사만; 제조사는 supplierToken→자체 벨). 판매사=seller 라 recipient_type='seller' 알림 그대로 표시, 클릭 시 `safeInternalPath` 딥링크(→ `/wholesale/orders` 등). 다크 유틸바용으로 `DashboardNotificationBell` 에 `iconClassName`/`buttonClassName` prop **additive**(미지정=기존 라이트 대시보드 스타일 불변 → SellerLayout/Admin/Agency 무영향).
- **불변**: 알림 생성/엔드포인트/제조사 벨/유틸바 나머지(예치금·충전·마이) 전부 불변(벨 1개 배치 + prop 2개 additive). 벨 dropdown 은 기존 흰 팝업 그대로.
- **알림 루프 완결**: 제조사 발송 → recipient_type='seller' 알림 → **판매사 유틸바 벨(빨간 배지)** → 클릭 → `/wholesale/orders`(구매확정) → 홈 배너 사라짐. (그동안 배선만 하고 볼 곳이 없던 마지막 고리.)
- 검증: tsc 0 · build 0 · theme-consistency(strict)·가드 0.

## ✅ 2026-07-01 — 알림 시스템 2차 전수조사 + 개선 (Tier 1/2/3) (대표 "더 개선할 게 있는지 전수조사")
1차(버그 6종) 후속 — 아직 깊게 안 본 영역(누락 트리거·알림톡/이메일 채널·내용/중복/성능·푸시 생명주기·설정) 4방향 병렬 조사 → 개선 반영.
- **Tier 1 (안전·비잠금)**: ① 누락 알림 배선 — 반품 승인/거절(`returns.routes` — status UPDATE만이었음)·KT 교환권 발송 **성공**(`kt-alpha-auto-send` — 실패만 알림이었음)·공구 추천 보너스 딜(`group-buy.routes` — 무통보 적립). ② `returns.routes:775` "undefined원" 가드. ③ 정리 크론(`scheduled-cleanup`)에 레거시 `notifications`·`agency_notifications` 추가(무한 증가 방지) + `notifications` 인덱스 repair-schema 이관. ④ `scheduled-cleanup:984` SQL 문자열 보간 금액 → bind. ⑤ `notifications.ts` 무음 `catch{}` → DEV 경고. ⑥ 웹푸시 **410/재구독 self-heal**: `PushNotificationSetup` 마운트 시 getSubscription 재조정(push_subscribed 플래그는 배너용) + `push-sw.js` `pushsubscriptionchange` 핸들러(endpoint 교체 시 서버 재등록, 세션쿠키).
- **Tier 2 (잠금 파일, 대표 승인 — audit log 등재)**: `webhook.routes` 확정 경로에 **셀러 '결제 확정' 대시보드 알림**(이전 `/confirm`에만 → CAS webhook-win 시 셀러 누락) + **Toss 취소 → 구매자 인앱 알림**(이전 Discord 전용). CAS 단일실행 가드로 이중알림 0. Toss 승인/금액검증/CAS/환불 로직 byte-불변.
- **Tier 3**: ① **네이티브 푸시(FCM v1) 발송부 신설** `src/lib/native-push.ts` — `native_push_tokens`(write-only dead)를 읽어 서비스계정 OAuth(firebase.messaging)로 FCM 발송, `sendSystemPush`에 병합(웹푸시와 독립, FIREBASE_* 미설정 시 no-op). ② 이메일 HTML 인젝션 방지 — `buildSystemEmailHtml` 이스케이프 + `group-buy` 선물 이메일 인라인 HTML 이스케이프(상품명/매장명/닉네임). ③ **발견**: 어드민 채널설정의 **dashboard 토글은 이미 작동**(`createDashboardNotification`이 getChannelSettings 게이트) — email/alimtalk은 직접발송이 다수(alimtalk 26곳)+기본 off라 일괄 게이팅 시 라이브 차단 위험 → 미배선 유지(문서화).
- 검증: tsc 0 · 단위 64 pass · build(client+worker+prerender+prepare) 0 · sql bind/not-null/column/table 가드 0 · theme 0 · audit-gate ALL GREEN. `[SKIP_SIZE]`(append-only repair-schema 성장). ⚠️ staging: 웹푸시 실기기(자가치유) + 반품 승인/거절·KT 성공·추천보너스 알림 노출 + (FCM 자격 설정 시) 네이티브 앱 푸시 1회.

## ✅ 2026-07-01 — 알림 시스템 전수조사 + 버그 6종 수정 (대표 "알림 기능 전수조사")
소비자/셀러/어드민/에이전시 알림 전 파이프라인 전수조사(트리거 호출부·프론트 표시·스키마·웹푸시·크론) → 실사용 영향 버그 수정. **인프라(라우터 마운트·크론 등록·VAPID 서명·대시보드/에이전시 알림)는 건강** 확인.
- **#1 유령 뱃지(가장 영향 큼)**: 미읽음 뱃지(`useUnreadCount`→`/api/notifications/unread-count`)는 `user_notifications`+`notifications` **두 테이블 합산**인데, 알림 목록 페이지(`useNotifications`→`/api/social/notifications`)는 `user_notifications`**만** 읽어, `notifications` 테이블에 쓰인 소비자 알림(쿠폰/이용권 만료·숙소 리마인더·KT 교환권·결제완료·공구 당첨 등)이 **뱃지엔 뜨는데 목록엔 안 보이고 '모두 읽음'으로도 안 지워짐**. → `social.routes` GET/read/read-all 을 두 테이블 통합(id `un_`/`n_` prefix 라우팅). 프론트 `NotificationItem.id` string 허용.
- **#2 웹푸시 내용 표시**: `sendPushNotification` 이 `body:null`(tickle)만 보내 모든 푸시가 generic "새 알림"·클릭 시 홈으로 갔음 → **RFC 8291 aes128gcm 페이로드 암호화 구현**(WebCrypto ECDH P-256+HKDF+AES-GCM). 암호화 실패 시 tickle fallback(회귀 0).
- **#3 셀러 환불 알림 고아**: `group-buy-admin` 어드민 강제환불 셀러 알림이 `notifications`(user_type='seller')로 가 셀러 벨(`dashboard_notifications`)에 안 보였음 → `createDashboardNotification('seller',…)` 전환.
- **#4 크론 silent fail**: `voucher-expire`/`stay-reminder`/`stay-voucher-expire`/`fcfs`/`voucher-dispute`/`kt-alpha-auto-send` 의 `notifications` INSERT 가 `user_type` 누락 → 프로덕션 테이블이 NOT NULL(default 없음)이면 조용히 실패. 명시 `'user'` 추가.
- **#5·6 스키마 견고화**: repair-schema 에 `notifications`(user_type NOT NULL DEFAULT 'user')·`user_notifications`·`agency_notifications`·`push_subscriptions` canonical CREATE 추가(이전엔 인덱스만) — fresh/repaired DB 에서 웹푸시 no-op·알림 유실 방지.
- **불변**: unread-count 로직·대시보드/에이전시/어드민채널설정·notifyUser 헬퍼·VAPID 서명·크론 등록 전부 불변. 잠금 파일(payment.routes 등) 무수정.
- 검증: tsc 0 · 단위 73 pass(notification+keyboard) · build(client+worker+prerender+prepare) 0 · sql bind/not-null/column/table 가드 0 · audit-gate 37 GREEN(사전존재 file-size RED 는 무관 — 내 파일 중 append-only `repair-schema` 만 성장, `[SKIP_SIZE]`). ⚠️ staging: 웹푸시 실기기 1회(제목/본문/링크 표시) + `notifications` 테이블 알림(쿠폰만료 등)이 목록에 뜨고 '모두 읽음'으로 지워지는지 1회.

## ✅ 2026-06-30 — 어드민 상품 승인 시 이미지 시각 검수 (갤러리 후속) (대표 "다음으로")
- **문제**: 어드민 공급상품 승인 큐(`SupplierProductsTab`)가 **이미지를 하나도 안 보여줘** 어드민이 썸네일/갤러리/상세를 못 보고 승인/거부 — 이미지 검수가 구조적으로 불가. API는 `image_url`만 반환(UI 미표시), `detail_images`·갤러리는 미반환.
- **수정**: ① API(`admin-products.routes GET /supplier-products`) SELECT 에 `detail_images` 추가 + `getSupplyMeta` 로 `gallery_images` 첨부(fail-soft). ② UI: 각 행에 **썸네일** + 접이식 **'이미지 검수(대표 N · 상세 N)'** 패널(썸네일+대표갤러리+상세 전체를 그리드로, 클릭 시 원본 새탭, 중복제거). 이미지 0개면 '⚠️ 등록된 이미지가 없어요' 경고.
- **불변**: 승인/거부/가격변경/마진설정 로직·RBAC 스코프·상품 SELECT 나머지 전부 불변(SELECT 컬럼 1개+meta 첨부+표시 UI additive). 어드민 라이트 테마(dark: 0).
- 검증: tsc 0 · build 0 · theme-consistency(strict)·column-exists·bind·cross-role-api 가드 0. (사전존재 `check-dashboard-theme` 경고 5건은 타 세션 파일 — 내 파일 무관.)

## ✅ 2026-06-30 — 제조사 상품 대표 이미지 갤러리(여러 각도 캐러셀) (대표 "대표 이미지 갤러리")
상품 대표 이미지가 **썸네일 1장뿐**이라 여러 각도/색상 사진을 못 보여주던 것 → 상단 캐러셀 추가.
- **저장(예산 준수)**: products 컬럼 동결이라 신규 컬럼 대신 **`product_supply_meta.gallery_images`**(K-V JSON, CLAUDE.md 규칙). image_url(썸네일/커버)은 그대로 — 갤러리는 *추가* 각도.
- **서버**: POST/PATCH `gallery_images` → meta(배열/쉼표→http(s)필터→최대 10장 JSON, PATCH 빈값=해제) · `GET /catalog/:id` 가 meta 에서 파싱해 `gallery_images` 반환(guest+로그인) · `GET /products` meta 병합에 추가(수정 prefill).
- **클라**: `AddProductModal` 커버 URL 아래 '대표 이미지 추가(여러 각도)' `MultiImageUpload max={10}`(수정모드 prefill·공통 payload) · `WholesaleProductPage` 상단 = **캐러셀**([image_url, ...gallery] 중복제거·순서보존, 썸네일 탭 전환, 1장이면 기존과 동일). `MultiImageUpload` 에 `max` prop 추가(상세=30/갤러리=10, 클라·서버 slice 동기).
- **불변**: `image_url` 썸네일(카트/카탈로그 카드)·detail_images·등급가·캐시·products 컬럼 전부 불변(갤러리는 meta 신설 + 캐러셀 UI). 1장 상품은 UI byte-동일.
- 검증: tsc 0 · build 0 · column-exists/bind/컬럼예산 가드 0. ⚠️ staging: 여러 장 등록 → 상세 상단 캐러셀 썸네일 전환 → 수정모드 prefill/교체 1회.

## ✅ 2026-06-30 — 배포-청크 자가복구 영구 방어선(흰화면/무한로딩 회귀 차단) (대표 "더 이상적으로")
대시보드 무한로딩(옛 청크 MIME) 수정 후속 — 메커니즘은 이미 견고(인라인 부트가드+`reloadWithCacheBust` SSOT+버전체크). **더 이상적 = 4번+ 재발한 이 버그가 다시 *조용히 회귀* 못 하게 락.**
- 신규 `scripts/check-chunk-recovery-guard.mjs` — 자가복구 **4불변식** 존재 강제: ① `index.html` 인라인 부트가드 ② `chunk-error.ts` `isChunkLoadError`(MIME 감지)+`reloadWithCacheBust`(`__cb`+`location.replace`, plain reload 회귀 금지) ③ `main.tsx` error/unhandledrejection 배선 ④ worker SPA 셸 `no-cache`. 하나라도 빠지면 flag.
- 배선: pre-commit(warn) + `verify.yml` CI(strict, 현재 위반 0) + CLAUDE.md 영구 방어선 표 등록. 음성(현 clean)/양성(캐시버스트 revert→차단) 테스트 통과.
- **정직 메모(이전 turn 자기검증)**: worker `/assets/*` 404 분기는 `_routes.json` exclude 라 실제 청크엔 미도달(Pages 직접 서빙) → 근본복구는 클라 ②③ + 셸 no-cache. 절대-0 흰화면은 Pages 에서 불가(옛 청크 삭제됨) — 현실 이상치=즉시 자가복구(달성). 추가 다듬기는 Pages `not_found_handling=none`(대시보드 설정, repo 밖).

## ✅ 2026-06-30 — 셀러 대시보드 `/seller`→`/wholesale` 강제 튕김 근본수정 (겸업 lock-out) (대표 "원인 전부·영구·이상적")
- **원인**: `SellerLayout` 이 `localStorage.is_distributor === '1'` **하나로** 무조건 `/wholesale` 로 redirect(2곳: 마운트 effect + render 가드). `is_distributor` 는 '도매 접근권'(capability)일 뿐 '도매 전용'(exclusivity)이 아닌데, 기존 소비자 셀러가 `/become-distributor`(wholesale.routes:344) 한 번만 해도 같은 셀러 행에 `is_distributor=1` 이 덧붙어 **겸업** 이 됨 → 카카오/셀러 로그인 시 플래그 저장 → `/seller` 갈 때마다 도매몰로 튕겨 셀러 대시보드 **영구 접근불가**. (주석은 "겸업 영향 없음" 이라 약속했으나 코드가 미구현.) 소비자측 강제 redirect 는 이 1곳이 유일(전수조사 — 나머지 navigate('/wholesale')는 전부 도매몰 내부 정상 네비).
- **수정(영구·서버권위)**:
  - **서버 SSOT 분류기** `computeWholesaleOnly(DB, sellerId)`(wholesale-helpers) — '도매 전용'은 `is_distributor=1` ∧ `seller_type∉{store_owner,both}` ∧ `소비자(비-도매) 상품 0` 일 때만 true. **애매하면 false=대시보드 노출(절대 lock-out 금지).**
  - **인증 엔드포인트** `GET /api/seller/surface`(requireSeller, IDOR 무관 — 토큰 seller id 로 자기조회) → `{ wholesale_only }`. fail-open.
  - **SellerLayout**: is_distributor 직접 가드 2곳 → `/api/seller/surface` 권위 판정. 도매 접근권 없으면 조회 skip, 판정 false/네트워크 실패 시 대시보드 유지, `?as=seller` 명시 진입은 강제이동 면제(트랩 방지).
  - **SellerLoginPage**: 로그인 직후 라우팅을 `is_distributor` → `wholesale_only` 기준으로(login 응답에 `wholesale_only` additive). 겸업은 `/seller`, 순수 판매사만 `/wholesale`.
- **자동 치유**: 게이트를 새 신호(wholesale_only)로 바꿔, 이미 깨진 겸업 계정은 **재로그인 없이** 다음 `/seller` 진입에서 즉시 복구(서버가 dual 판정). 순수 판매사 UX(도매몰 라우팅)는 보존.
- **재발 방지(영구)**: 신규 가드 `check-seller-wholesale-redirect.mjs` — Seller* surface 에서 is_distributor 직접 게이트로 /wholesale redirect/return null 금지(권위 wholesale_only 만). audit-gate(서비스 분리 도메인)+verify.yml(strict)+AUDIT_INVARIANTS 등록. 단위 테스트 `wholesale-only.test.ts`(7케이스).
- 검증: tsc 0 · unit **2368 pass**(+7) · build(client+worker+prerender+prepare) 0 · 서비스분리/UI 도메인 ALL GREEN · sql/light-input/api-auth 가드 0. ⚠️ staging 권장: 겸업 계정(소비자 상품 보유 + is_distributor=1) → `/seller` 정상 진입 / 순수 판매사 → `/wholesale` 라우팅 각 1회.

## ✅ 2026-06-30 — 제조사 상세페이지 이미지: 수정 지원 + 최대 30장 (대표 "둘 다 고치기")
대표 질문("상세페이지 이미지 여러 장 순서대로 올리는 거 문제 없어?") → 전 경로 검증: **등록은 정상**(다중·순서·원본화질·R2·순서대로 갤러리 표시 end-to-end)이나 한계 2건 발견 → 둘 다 수정.
- **① 등록 후 수정 불가 → 지원**: `detail_images` 가 `GET /products` 미반환 + `PATCH` 미처리라 수정모드에서 **숨겨져 있던 미완성** 기능. → GET SELECT 에 `detail_images` 추가 · `PATCH` 에 detail_images 처리(배열/쉼표→http(s)필터→JSON, 빈값=null 해제) · `AddProductModal` 수정모드에서 필드 노출 + prefill(`detailImagesToCsv` JSON파싱) + payload 공통전송(등록·수정). `CatalogItem` 타입 추가.
- **② 최대 10 → 30장**: 긴 상세페이지 슬라이스가 10장 넘으면 11장째부터 조용히 버려지던 것 → 4곳 동기 상향(`MultiImageUpload MAX_FILES`·POST slice·bulk slice·`catalog/:id` 표시 slice).
- **불변**: 업로드 컴포넌트(무압축·GIF보존·순서 up/down)·POST 저장·상세 표시 로직·`products.detail_images` 컬럼(예산 무관, 기존 컬럼) 전부 불변(수정 경로 신설 + cap 숫자만). 승인상품 수정불가 게이트·재제출 pending 동작 불변.
- 검증: tsc 0 · build 0 · column-exists/bind/컬럼예산 가드 0. ⚠️ staging: 등록(30장·순서) → 상세 표시 → 수정모드 재진입(prefill) → 이미지 교체/삭제/추가 → 저장 → 반영 1회 확인 권장.

## ↩️ 2026-06-30 — 판매사 첫 발주 시작 가이드 **제거**(revert) (대표 "가이드는 필요없어")
직전 추가한 `FirstOrderGuide`(HeroSection)를 대표 요청으로 통째 revert(`065a5f1`). `/home` 의 `has_ordered` 배선·`useWholesaleHome` 타입/매퍼·HeroSection prop 전부 함께 제거(미사용 방지). **`pending_receipt`(수령확인 배너)는 별개 커밋이라 유지.** tsc 0·build 0.

## ✅ 2026-06-30 — 제조사 거절 사유 입력 UI (거절 사유 루프 완결) (대표 "응 해줘")
직전 '판매사 거절 사유 노출' 의 짝 — 사유를 *실제로 입력*하게.
- **문제**: `SupplierWholesaleOrdersPage` 의 거절이 `reason: '제조사 거절'` **하드코딩** → 판매사 주문목록에 항상 "제조사 거절"만 떠 직전 가시성 작업이 무의미. 사유 입력 UI 부재.
- **수정**: 거절 `confirmDialog` → **`promptDialog`**(이 세션에서 추가한 입력 모달, `required`+`multiline`)로 — "거절 사유(예: 재고 소진, 단종)" 입력받아 `reject` API 로 전달(100자, 빈값이면 '제조사 거절' 폴백, 취소 시 abort). 서버/환불/알림 로직 불변(reason 값만 하드코딩→사용자입력).
- **루프 완결**: 제조사 거절(사유 입력) → `wholesale_orders.reject_reason` 저장 → 판매사 주문카드 '제조사 거절 사유' 노출(직전 작업) → 환불 알림.
- 검증: tsc 0 · build 0.

## ✅ 2026-06-30 — 판매사 주문 거절/취소 사유 노출 (가시성 갭) (대표 "응 계속 진행")
- **문제**: 제조사가 주문을 거절하면 `wholesale_orders.reject_reason` 을 저장하고 판매사에게 '환불 처리' 알림까지 보내는데, **판매사 주문 목록엔 REJECTED 뱃지만 뜨고 사유가 안 보였음** — "왜 거절됐지?"를 알 길이 없던 가시성 갭. (취소 `cancel_reason` 도 동일.)
- **수정(additive)**: 판매사 주문 목록 API(`/api/wholesale/orders`) SELECT 에 `reject_reason, cancel_reason` 추가(이미 `ensureOrderTables` ensure 컬럼) → `WholesaleOrderRow` 타입 → `WholesaleOrdersPage` 주문 카드에 사유 노트(REJECTED=빨강 '제조사 거절 사유', CANCELLED/REFUNDED=중립 '취소 사유'). 사유 없으면 미표시(소음 0).
- **불변**: 주문 목록 쿼리 구조·라인아이템 첨부·금액 표시·상태 뱃지 전부 불변(SELECT 컬럼 2개 + 표시 블록 1개 additive). 거절/취소/환불 로직 무변경. WholesaleDashboardPage 임베드 주문도 같은 컴포넌트라 자동 적용.
- 검증: tsc 0 · build 0 · column-exists/bind 가드 0.

## ✅ 2026-06-30 — 도매 기술부채 정리 + 출금 계좌 게이트 (대표 "부채 정리 하고 개선하자")
**부채 정리**(TECHNICAL_DEBT `🟡 2026-06-25 6도메인 잔여` 섹션 전수 재검증): 항목 2~5 다수가 해소/무효 확인 → 제거.
- (구)2 제조사 대시보드 보조 로더 silent-empty → loadCatalog/orders/settlements 전부 `markErr`+`secErr` 표면화 완료(stale).
- (구)3 wishlist/naver/channels 페이지 **삭제됨**, oem 은 `isError` de-mask 완료(stale).
- (구)4 Overview "출금 가능"=`available−reserved`(spendable) 표시 완료(stale).
- (구)5b 송장 0건→`toast.error` 완료 / (구)5c StaffPage **삭제됨**(stale).
- **(구)5a 실수정**: `WholesaleStatementPage` 순매입 `won(summary.net)` → `won(summary.net ?? (total_paid − total_refunded))` 폴백(net 누락 시 ₩0 오표시 방지).
- 남은 부채는 oem-requests WeakSet nit + 등급 마진탭(대표 결정 대기) 2건뿐 — 문서 정리 주석 추가.

**개선 — 출금 계좌 게이트**(직전 정산계좌 작업 완결): `WithdrawalSection` 을 `hasAccount` 인지로 — 계좌 미등록(`has_payout_account===false`)이면 '출금 신청' 버튼 비활성 + '정산 계좌 필요' 라벨 + amber 안내(아래 카드로 유도) → NO_BANK 헛걸음 제거. undefined(미로드)면 기존 동작(서버가 최종 게이트). i18n 2키 6개 언어. **출금 신청 로직·NO_BANK 서버 게이트 불변.**
- 검증: tsc 0 · build 0 · 가드 0.

## ✅ 2026-06-30 — 제조사 정산 계좌 등록/수정 (출금 막다른 길 해소) (대표 "계속 해줘")
직전 '출금 가능' 할 일이 드러낸 **막다른 길** 근본수정 — 돈은 쌓이는데 출금 못 하던 구조.
- **문제**: 가입 시 정산 계좌가 **'선택'**("나중에 등록 가능")인데, **가입 후 등록/수정할 UI·엔드포인트가 0**. 계좌 없이 가입한 제조사는 정산금이 쌓여도 출금 시 `NO_BANK`("먼저 정산 계좌를 등록해주세요")로 막히고 **등록할 길이 없어 영구 출금불가** — 가입폼의 "나중에 등록 가능"이 깨진 약속이었음.
- **수정(additive)**: ① 서버 `GET/PATCH /api/supplier/settlement-account`(supplier-dashboard.routes, `supplierId` 본인행만·rateLimit·계좌번호 `^[0-9-]{6,30}$` 검증·3종 필수). `suppliers.bank_name/bank_account/account_holder`(가입 스키마 기존 컬럼). ② `/me` 에 `has_payout_account` boolean 추가. ③ 신규 `SettlementAccountCard`(ShippingPolicyCard 패턴) — 정산 탭 출금 섹션 아래, 미등록 시 amber 경고/등록 시 green 확인. 저장 시 `loadMe` 로 갱신. ④ OverviewTab '할 일': spendable>0 + `has_payout_account===false` 면 '출금 가능' 대신 **'정산 계좌 등록'**(danger)으로 유도(undefined=구버전이면 기존 동작 유지). i18n 14키 6개 언어.
- **불변**: 출금 신청(`supplier-withdrawal.routes`)의 `NO_BANK` 게이트·계좌 스냅샷·정산 로직 전부 불변(계좌를 *채울* 경로만 신설). 머니 경로 무변경.
- 검증: tsc 0 · build 0 · api-auth(IDOR 안전 — WHERE id=sid)·sql·light-input 가드 0. ⚠️ staging: 계좌 없는 제조사 → 정산 탭에서 등록 → 출금 신청 성공 1회 확인 권장.

## ✅ 2026-06-30 — 판매사 주문 알림 딥링크 정합(발송/수락/환불 → 주문 목록) (대표 "응 진행")
직전 '수령 확인 대기' 배너의 알림 루프 완결 — 알림을 탭하면 *행동할 화면*에 떨어지게.
- **문제**: 판매사(바이어) **주문 이벤트** 알림(발송 시작·수락됨·환불)이 `/wholesale/dashboard`(개요 탭)로 딥링크 → 구매확정 버튼이 있는 주문 목록이 아닌 **개요**에 떨어짐. 반면 같은 클래스인 클레임·주문메모 알림은 이미 `/wholesale/orders` 로 정확히 감 → **비대칭**. 발송 알림 받고 탭해도 바로 구매확정 못 함.
- **수정(딥링크 6개만)**: 주문 이벤트 알림 6건 `/wholesale/dashboard` → `/wholesale/orders` 통일 — `wholesale-supplier.routes`(발송×3·수락×1) + `wholesale-order-status`(환불) + `wholesale-refund`(환불 처리). **멤버십 시작 알림(`wholesale-plus`)은 개요가 맞아 `/wholesale/dashboard` 유지**(주문 이벤트 아님). 알림 본문/타입/조건·`createDashboardNotification` 시그니처 전부 불변 — link 인자만 교체.
- **루프 완결**: 제조사 발송 → 바이어 '발송 시작' 알림 → 탭 → `/wholesale/orders`(구매확정 버튼) → 확정 → 홈 배너 즉시 사라짐(직전 작업) → 제조사 정산 마무리.
- 검증: tsc 0 · build 0 · 가드 0.

## ✅ 2026-06-30 — 판매사 홈 '수령 확인 대기' 액션 배너 (대표 "그 다음 작업")
제조사 '할 일'(직전) 과 대칭 — 판매사(buyer) 도매몰 홈에 actionable 누락 방지.
- **배경**: 판매사 주문 페이지엔 발송완료(SHIPPED) 주문에 '구매확정' 버튼이 있으나, **홈엔 '확정해야 할 게 있다'는 신호가 0** → 구매확정을 잊으면 ① 제조사 정산이 마무리 안 됨(SHIPPED 라인 게이트) ② 클레임 창이 안 닫힘. 제조사쪽 '할 일'(품절/출금 등)과 비대칭이었음.
- **수정(additive)**: `/home`(per-seller·무캐시) Promise.all 에 5번째 쿼리 추가 — `wholesale_orders status IN('SHIPPED','PARTIAL_REFUNDED')` COUNT(fail-soft `.catch→0`) → `pending_receipt` 반환. `useWholesaleHome` 타입/매퍼에 `pending_receipt` 통과. `WholesaleCatalogPage` 홈(로그인 + count>0)에 HeroSection 직후 **탭 배너**(🚚 "수령 확인 대기 N건 · 구매확정하면 정산 마무리·클레임 종료") → `/wholesale/orders`. 구매확정 시 `qc.invalidateQueries(wholesale('home'))` 로 배너 즉시 갱신.
- **불변**: `/home` 베스트/신상/카테고리/추천 4쿼리·등급가 enrich·캐시 동작(무캐시 authed) 전부 byte-불변(쿼리 1개·응답필드 1개 additive). margin/premium 게이팅·제조사 할 일과 독립.
- 검증: tsc 0 · build 0 · 가드 0. ⚠️ staging: SHIPPED 발주 있는 판매사 홈 진입 → 배너 표시 → 구매확정 → 배너 사라짐 1회 확인 권장.

## ✅ 2026-06-30 — 프리미엄 전용관 서버 등급 게이팅 + 제조사 '할 일' 확장 (대표 "1,2 해줘")
도매몰만. 직전 클라 잠금화면(MARGIN_PREMIUM_BLOCKED_GRADES)의 후속 — 데이터 레이어까지 차단 + 대시보드 actionable 확장.
- **#1 프리미엄 전용관 서버 게이팅** (`wholesale.routes.ts` `/catalog`): 기존엔 `?premium=1` 이 **guest 만** 차단(로그인 Basic 은 프리미엄 상품 데이터 수신 가능 — 클라 잠금화면은 UX 일 뿐 URL 직접 호출로 우회). → guest 게이트 직후 **로그인 Basic('C') 추가 차단** 블록(등급 1회 조회 후 `PREMIUM_BLOCKED_GRADES` 매칭 시 `premium_locked` 빈 목록 + `private,no-store`). **모든 등급캐시·라이브쿼리에 선행** → Basic 은 캐시·라이브 어디서도 프리미엄 데이터 미수신. 클라 상수와 동일 정책(`['C']`, Premium 전용은 `['B','C']`). **'margin' 관은 정렬(sort=discount)일 뿐 별도 데이터 아님 → 서버 게이트 불필요**(Basic 도 일반 카탈로그에서 같은 상품을 봄, 등급 마진은 서버가 등급별 정확계산). 일반 카탈로그 핫패스 byte-불변(premium 경로에서만 등급조회 추가).
- **#2 제조사 대시보드 '할 일' 확장** (`OverviewTab.tsx` + `/me`): 기존 3종(발송대기·반려·검수대기) → **6종**. 추가 ① **품절 상품**(판매중 무재고=매출손실, danger) ② **재고 부족**(품절 전 보충, info) ③ **출금 가능**(spendable>0, success/green). `/me` counts 쿼리에 `out_of_stock`·`low_stock` 집계 **동일 스캔 추가**(승인·노출 상품 한정, analytics 와 동일 임계 `stock<=min_order_qty`) → RTT 0. tone 'success'(emerald) 추가 + `TODO_TONE` 리터럴 맵. i18n 3키(todoOutOfStock/todoLowStock/todoWithdraw) 6개 언어.
- 검증: tsc 0 · build 0 · column-exists/bind/login-gate 가드 0 · 단위 pass. ⚠️ 프리미엄 게이트는 staging 에서 Basic 계정으로 `?premium=1` 직접 호출 → 빈 목록(`premium_locked`) 1회 확인 권장.

## ✅ 2026-06-29 — 등급명 영문(Basic/Standard/Premium) 전수 정합 + 제조사 가입폼 정리
**등급명 전수조사(대표 "약관·계약서 등 A,B,C 다 수정됐나")**: GRADE_NAME/GradeSheet(기완료) 외 잔존 옛이름(프리미엄/프로/일반) 사용자-가시 전부 영문화.
- 약관/계약서(signup-contract·terms·privacy)엔 등급명 **없음**(클린 확인). 잔존은 멤버십/가이드/FAQ/알림/시드였음.
- **PlusMembershipCard**(판매사 멤버십 카드) 프리미엄/프로 회원·멤버십·구독 → Premium/Standard. **wholesale-plus.routes** 알림·에러문구·구독 전부. **AdminDistributorGradesPage** 안내문(프로(B)/프리미엄(A)/일반(C)). **guide-seed-seller** 등급 설명. **WholesaleSupportPage** FAQ. **wholesale-grade-eval** 만료 알림(프로→Standard).
- **DB 시드 라벨**: `distributor-admin/helpers`(seed + v2 + **신규 v3 relabel 마이그레이션** = 기존 DB 라벨 영문화, label만·마진/정렬 불변) + `repair-schema` 시드 → Premium/Standard/Basic.
- **비대상(별개 개념, 유지)**: "프리미엄 전용관/프리미엄 상품"(쇼룸 큐레이션 — 등급 아님), 컨슈머 "일반 회원"(딜 적립 유저), 내부 주석/`distributor-pricing` A/B/C letter.
**제조사 가입폼(`/supplier/register`)**: 이메일 라벨 "이메일 (로그인 아이디)" → **"로그인 아이디 (이메일)"**. 대표자/담당자/정산 섹션 구분선 `border-gray-100`→`pt-4 mt-4 border-gray-200`(유통사 가입처럼 명확화).
- 검증: tsc 0 · build 0 · audit-gate 33 GREEN. ⚠️ 가이드(operation_guides)·등급 라벨은 배포 후 자동 재시드/마이그(v3) 또는 가이드 섹션 DELETE 재시드 1회.

## ✅ 2026-06-29 — 도매몰 미구현 7건 일괄 ("다 모두 이상적으로")
16건 점검 → 미구현 7건 구현. (#3·4·5·9·10·11·12·13·14 는 기구현 확인)
- **#2 상품상세 스마트스토어·쿠팡 등록 버튼 삭제** (`WholesaleProductPage` — 버튼·lazy 모달·state 전부 제거).
- **#15·#16 `/wholesale/margin`·프리미엄 전용관 메뉴 제거** (`CatalogHeader` — 일반(Basic) 회원에 40% 마진·프리미엄관 노출 차단, 등급 무관 비노출).
- **#7 체크아웃 배송지 직접 입력** (`WholesaleCheckoutPage` — '사업자 주소지로 배송' 토글, 끄면 받는사람/연락처/우편/주소 입력 → `/orders` `shipping` 전달, 비우면 서버 프로필 폴백).
- **#6 등록 상품 마진율 직접 입력** (`AddProductModal` — 마진율(%) 입력 시 공급가 기준 판매가 자동계산, 양방향. 저장 구조·정산엔진 불변).
- **#8 상품코드 (제조사 등록·상세 표시·카테고리 접두)** — SSOT `src/shared/wholesale-category-codes.ts`(식품 FD/리빙 LV/건강 HT, 어드민 `platform_settings.wholesale_category_prefixes` 확장). 제조사 `AddProductModal` 상품코드 입력(접두 자동) → `supplier-dashboard.routes` POST/PATCH 가 `normalizeProductCode` 후 `product_supply_meta.ext_code` 저장 → `catalog/:id` 반환 → `WholesaleProductPage` 코드 배지 표시. **이 ext_code 가 #12 대량발주 코드매칭의 글로벌 소스 → #8 로 #12 명시등록 완성.**
- **#1 어드민 판매자 승인 통합** (`AdminPage` — 별도 `PendingSellersTable` 제거, 승인 대기자를 `SellersTable`(판매자 관리) 상단에 합쳐 행별 승인/거부/정지 일원화. `SellersTable` 에 `onReject` 추가).
- 검증: tsc 0 · build 0 · audit-gate 33 GREEN.

## ✅ 2026-06-30 — 사업자 링크샵(`/u/:handle`) 불필요한 중간 로더 제거 (대표 신고 "로딩 중 필요 없는 로딩 애니메이션, 철저히")
**전수 추적**: 사업자 `/u/`(linked_seller) 콜드 로드가 [PageLoader 스피너 → 전체화면 중앙 '로딩 중' 텍스트(SellerPublicPage 청크 Suspense fallback) → 헤더+스켈레톤(SellerPublicPage 자체 loading) → 본문] 세 로더를 점프. 중간 텍스트가 redundant + 시각 불일치.
- **CuratorPage.tsx** (`[LOADING_ADDITIVE]`): Suspense fallback(중앙 텍스트) → SellerPublicPage curator-있음 loading 상태와 **byte-동일** 헤더+2카드 스켈레톤(curator 즉시)으로 교체 → 헤더 1회 유지·본문만 채워짐(점프 0).
- **worker/index.ts** (`[UNLOCK_LOADING]`): SSR self-fetch 타임아웃 CURATOR 1500→2000ms (SELLER=`/profile` 와 동일 페이지·동일 D1 비용인데 짧아 cold timeout→스켈레톤 더 자주). warm/edge-hit·타 슬롯·소비자 불변.
- 검증: tsc 0·build 0·theme/mobile 0. CLAUDE.md 로딩 audit log 기록. ⚠️ 배포 후 `/u/{사업자handle}` 콜드 1회 시각 확인 권장.

## ✅ 2026-06-29 — 도매 대량발주(엑셀·드랍십) + 등급명 + 상단 '마이' (대표 요청 3건)
**1) 대량발주 드랍십 (받는사람별 직배, "셀파이는 참고만")** — 한 행 = 한 명에게 보내는 1건. 같은 상품도 받는사람 다르면 별개 라인. 매칭 = `product_id`(우선) 또는 `상품코드`("둘 다" — 판매사별 자동학습 맵 + 제조사 ext_code 폴백, `wholesale-code-map.ts`). 상품상세1=옵션(비가격 패스스루).
- **금액 경로 byte-불변**: `/orders` POST 의 합산기준 MOQ/박스단위/재고/수량구간 단가 산식 그대로(묶음 사입과 합계 동일). `body.dropship` 면 받는사람별 라인으로 *분해만*(INSERT/재고차감), `Σ라인==subtotal` 검증. 비드랍십은 `insertLines=lines` byte-identical. 예치금 CAS/보상환불/정산 무변경.
- **스키마**(`wholesale_order_items` self-heal ALTER): `option_label·ext_order_no·ship_to_{name,phone,postal,address,message}`. products/sellers 아님 → 컬럼예산 무관.
- **양식**(`/order-template`): 카탈로그 프리필(product_id·상품코드·공급가) + 받는사람/옵션/주문수량 빈칸. `bulk-preview` 받는사람별 미리보기(코드 해석·검증). `BulkOrderPanel` 재작성: 드랍십 파서(우리 양식 + 외부 발주서 헤더 유연 인식)·받는사람별 미리보기·**예치금 즉시 발주**(카트 미경유, idempotency_key).
- **표시**: 제조사 `SupplierWholesaleOrdersPage`(라인별 받는사람·옵션·메모, 받는사람 다르면 합배송 비활성) + CSV export(옵션·받는분·주소·배송메시지) / 판매사 `WholesaleOrdersPage`(라인 옵션·받는사람).
**2) 등급명** — Basic=C / Standard=B / Premium=A (`GRADE_NAME`·`GradeSheet` 영문 통일, 엔진 코드 A/B/C 불변).
**3) `/wholesale` 상단 '내 공간' → 사람 아이콘 + '마이'** (`WholesaleUtilBar`).
- 검증: tsc 0·build 0·audit-gate 33 GREEN. ⚠️ staging 1회 권장: 드랍십 엑셀 업로드→미리보기→예치금 발주→제조사 받는사람별 송장.

## ✅ 2026-06-29 — 이용권 명칭 후속 부채 정리 (대표 "모두 진행 / 가장 이상적인 형태")
이용권 통일이 드러낸 부채 3종 정리.
- **A1 카테고리 SSOT 이중화 제거**: `VOUCHER_CATEGORIES` 배열·라벨·아이콘·SQL placeholder 가 `constants/index.ts` + `voucher-categories.ts` **양쪽 중복정의**(drift 위험)였음 → `constants/index.ts` 가 `voucher-categories.ts`(단일 SSOT)에서 **파생/재수출**하도록 통합(import top-level, 순환참조 0). 값/순서/타입 byte-동일(LABELS=`.short`, ICONS=`.emoji`, SQL=`voucherCategoriesSqlClause()`) → 소비 테스트 11 pass.
- **A2 하드코딩 카테고리 리스트 1건 헬퍼화**: `SellerKpiDashboard` 의 `['meal_voucher',...7종]` 멤버십 배열 → `isVoucherCategory()` SSOT 헬퍼. (나머지 6곳은 emoji 맵·i18n 피커·`general` 포함 admin 맵 등 *뷰 레이어 선택*이라 SSOT 중복 아님 — 의도적 보존.)
- **A3 타 언어 이용권 탭 정합**: `tabGroupBuy`(옛 group-buy 프레이밍 Group/共同購入/Grupal/Groupé) → 언어별 voucher 용어로 `myGbVouchers`와 통일. zh 团购券(공구 프레이밍)→使用券, ja→利用券, en→Vouchers, es→Vales, fr→Coupons. (전면 다국어 prose 정합은 KR-primary 라 별도.)
- 검증: tsc 0 · 6 locale JSON valid · 전체 유닛 1847 pass · build 0. 잔여 "식사권"=설명 주석 2줄(제거된 옛 형태 문서화 — 의도).

## ✅ 2026-06-29 — 판매사 로그인 속도 최적화 (대표 "최대한 빨라져야 해")
**원인**: 제조사(SupplierLoginPage)는 이미 SPA `navigate('/supplier')`였으나 **판매사(WholesaleLoginPage)는 `window.location.assign('/wholesale')` full reload**(앱 번들 재다운로드) → 로그인 클릭 후 흰 화면 체감.
- **수정**: 이메일 로그인 + 카카오 probe 성공 시 `assign` → `navigate('/wholesale', {replace:true})`. `applySellerSession`이 seller_token 을 localStorage 에 *동기* set 후라 카탈로그(`loggedIn=!!token` render 시 읽음)가 토큰 인지 — 제조사와 동일 패턴, 안전. 카카오 OAuth 시작(`window.location.href=/auth/kakao/start`)은 그대로(불가피).
- **청크 프리워밍**: 두 로그인 페이지 마운트 시 도착 청크(`WholesaleCatalogPage`/`SupplierDashboardPage`) `import()` 프리페치 → navigate 즉시 렌더(흰화면 0).
- 검증: tsc 0·build 0·autologin/internal-links 가드 0. 카카오 정상경로는 이미 단일로드(콜백이 토큰 pre-React 적용)라 무변경.

## ✅ 2026-06-29 — "식사권" 완전 제거 → 이용권 일괄 정리 (대표 "이용권으로 일괄 정리해줘")
앞선 식사권→이용권 통일에서 보존했던 카테고리-종류 알림 라벨 세트까지 정리 → 사용자-가시 "식사권" 0.
- **알림 라벨 `getVoucherShortLabel`**: `${short}권`(식사권/미용권/숙소권/기타권) → **`${short} 이용권`**(식사 이용권/미용 이용권/숙소 이용권/기타 이용권), fallback `바우처`→`이용권`. 형제(미용/숙소/기타)도 함께 이용권 형태로 통일.
- **카테고리 칩/필터 라벨**: `VOUCHER_CATEGORY_LABEL.meal.label` "식사권 (음식점/카페)"→"식사 (음식점/카페)", `VOUCHER_CATEGORY_LABELS.meal` "식사권"→"식사"(형제 미용/숙소/기타와 평행, 우산말 이용권과 충돌 방지).
- **테스트**: `voucher-category-label.test` 8 assertion 신규 라벨로 갱신(meal=식사 이용권 등, fallback=이용권). `voucher-categories.test` 주석.
- 결과: src+ko 사용자-가시 "식사권" 0(설명 주석 2줄만 잔존). 코드 식별자 `meal_voucher` 불변. CLAUDE.md SSOT 갱신.
- 검증: tsc 0 · voucher-category 11 pass · 전체 유닛 1842 pass · build 0.

## ✅ 2026-06-29 — 도매 "로그아웃이 전혀 안돼" 근본수정 (대표 신고 → "교과서적으로" Option B 전환)
**근본원인(코드 추적)**: 도매 페이지가 마운트 시 카카오 소비자 세션(`user_id`)만 있으면 자동으로 `become-distributor`/`/supplier/become`(requireAuth=`ur_session` 쿠키 인증)를 호출해 토큰을 *암묵적 재발급*(ambient privilege elevation). 로그아웃은 `ur_seller_session`만 지우고 `ur_session`을 보존 → probe가 `ur_session`으로 재인증 → 재로그인. (병행 세션의 서버쿠키 await 삭제도 ur_session 미삭제라 이것만으론 못 막음 — 확인됨.)
- **교과서적 전환(off-by-default, `src/utils/wholesale-session.ts`)**: ambient 자동 probe 제거. `setWholesaleLoginIntent`(카카오 로그인 버튼이 sessionStorage 마커 — OAuth 왕복 생존) / `consumeWholesaleLoginIntent`(probe는 **명시 로그인 직후 1회만** 발화, 소비) / `clearWholesaleLoginIntent`(로그아웃 시 stale 마커 제거). 정상 로그인 1차경로=카카오 콜백 `issueLinkedRoleTokens`(seller_token 명시발급), probe는 토큰 미전달 엣지만 보완(로그인 직후 한정). 4 probe → `|| !consumeWholesaleLoginIntent()`, 2 카카오 버튼 → `setWholesaleLoginIntent()`, 4 로그아웃(판매사 대시보드/카탈로그/예치금 + 제조사) → `authLogout('seller')`(서버쿠키 await) + `clearWholesaleLoginIntent()` + `/wholesale/login`.
- **결과**: 마운트마다 자동로그인 없음 → 로그아웃이 구조적으로 유지(억제 플래그 불필요). 카카오 소비자 세션 보존(공존). 직접 진입 시 guest 카탈로그(ambient 승격 없음 — 텍스트북).
- **영구 가드** `check-wholesale-autologin-guarded.mjs`: become probe 보유 파일은 `consumeWholesaleLoginIntent` 게이트 필수(audit-gate auth + CI strict + pre-commit).
- 검증: tsc 0·build 0·가드 0·회귀 catch. ⚠️ staging 1회 권장: 카카오 판매사 로그인→대시보드→로그아웃→**새로고침 시 로그인 유지** 확인.

## ✅ 2026-06-29 — 환경 준비상태 진단(어드민) (대표 "다른 운영자/브라우저/장소에서 써도 환경 세팅 다 됐어?")
**검증 가능한 답** — 대시보드 로그인/보안을 게이트하는 Cloudflare 바인딩·시크릿이 실제 설정됐는지 런타임 점검. **시크릿 값은 노출 0(present 불리언만)**.
- **`GET /api/health/env-readiness`**(admin): JWT_SECRET(blocking — 없으면 전 대시보드 로그인 500)·FRONTEND_URL / RATE_LIMIT_KV·TURNSTILE·DATA_ENCRYPTION_KEY·INTERNAL_API_TOKEN(security fail-open) / SESSION_KV·CACHE_KV(perf) / TOSS(결제) / 선택기능 분류 + DB 연결성. `ready`=blocking 전부+DB OK. 기존 `/api/health` 갭(있을 때만 KV 핑·시크릿 미점검) 보완.
- **`/admin/env-readiness`** 페이지(`AdminEnvReadinessPage`, 운영 nav '환경 준비상태'): GREEN/RED 종합배지 + 누락목록(필수=빨강/보안=앰버) + 그룹별 설정여부. 비기술 운영자도 클릭 한 번.
- 검증: tsc 0·build 0·internal-links 0(라우트 도달)·theme/light-input 0. ⚠️ 배포 후 `/admin/env-readiness` 1회 확인 권장(특히 JWT_SECRET·RATE_LIMIT_KV).

## ✅ 2026-06-29 — 잔여 "식사권" → "이용권" 통일 (대표 "응 통일해줘")
06-27 공구권→이용권 치환 후에도 남아 있던 일반 "식사권" 225건 마저 통일.
- **일반 지칭 식사권 → 이용권**: src/ + ko 65파일 일괄(예 "내 식사권"·"식사권 등록/사용/구매"). `git diff` 확인 — 카테고리 SSOT 4파일만 제외.
- **`meal_voucher` 카테고리 라벨 → "식사"**(우산말 "이용권"과 충돌 방지): BrowsePage h1·GroupBuyDetail 배지·GroupBuyList 빈상태 3곳 `meal_voucher:'이용권'`→`'식사'`(형제 미용/숙소/기타와 평행). 식별자 `meal_voucher` 불변.
- **예외(의도적 보존)**: `getVoucherShortLabel` 의 카테고리-타입 알림 라벨 세트 **식사권/미용권/숙소권/기타권**(`voucher-categories.ts`·`constants/index.ts`·`voucher-category-label.test`) — 우산말이 아니라 *카테고리 종류* 라벨이라 일관 세트로 유지(형제 미용권/숙소권 동반 변경 회피). CLAUDE.md SSOT 에 명시.
- 검증: tsc 0 · ko JSON valid · voucher-category 테스트 11 pass · 전체 유닛 1842 pass · build 0.

## ✅ 2026-06-29 — 도매몰 판매사 주문내역 상세화 (대표 신고 "주문내역이 너무 자세하게 안나와있는데")
**도매몰 전용**(`/wholesale/dashboard?tab=orders`) — 기존 카드가 주문#·등급가·합계만 표시 → 라인아이템/배송지 추가.
- **`wholesale.routes.ts` GET /orders**: 주문별 라인아이템 일괄 첨부(idx_wholesale_items_order IN 조회) — 상품명/수량/단가/소계 + suppliers LEFT JOIN 제조사명(조인 실패 시 아이템만 graceful) + ship_to_* 배송지 컬럼. `/orders/:id` 상세는 이미 아이템 반환했으나 목록은 미반환이던 갭.
- **`WholesaleOrdersPage.tsx` 카드**: 라인아이템 목록(상품·제조사·단가×수량·소계) + 금액분해(상품합계/배송비) + 배송지 블록 추가. 기존 상태뱃지/택배추적/클레임/메모 스레드 불변.
- **서비스 분리 준수**: 도매(`/api/wholesale`·`src/features/supply`·`Wholesale*`)만 변경, 소비자 무관. 검증: tsc 0·sql-bind/column 0·crossrole 0·theme 0.

## ✅ 2026-06-29 — 로그아웃/세션 lifecycle 전수조사 + 근본수정 (대표 "로그아웃이 안돼 / 교과서적으로 / 가장 이상적인 형태 — 전수조사")
**배경**: "로그아웃해도 로그인 상태" 신고 → 근본원인은 **httpOnly 세션쿠키(`ur_session`/`ur_*_session`)를 클라가 JS 로 못 지우는데 로그아웃이 서버 삭제를 안 함**. 1차 수정(앞 커밋 `a0aad0d`/`b6a863d`) 후 적대적 에이전트 2기로 lifecycle 전수조사 → 잔여 갭 6종 근본수정.
- **1차 (커밋됨)**: `/api/auth/logout-cookies` 가 ur_* 세션쿠키를 type-scoped 삭제(기존 ud_* 만 지움) · `clearServerSessionCookies(type?)` (await 가능, keepalive) · 소비자/셀러/어드민/에이전시/도매 로그아웃 핸들러 전부 **await 후 navigate**(fire-and-forget 레이스 제거) · 실제 소비자 경로(`login-flow.service.logout`)에 await 배선.
- **GAP1 ✅** `kakao.routes.ts` POST `/callback`(SPA) 계정전환 역할쿠키 청소 미러 — GET 경로(2026-05-01부터)와 비대칭이던 것 통일(잠금파일, [UNLOCK_LOADING] audit log 등재).
- **GAP2 ✅** 제조사(supplier) ud_supplier_token 잔존 — `/logout-cookies` supplier 분기 + `clearServerSessionCookies('supplier')` + `SupplierDashboardPage` 로그아웃 async/await.
- **GAP4 ✅** 계정탈퇴(`DELETE /api/account/delete`)가 Set-Cookie 무발급 → soft-delete row + 30일 ur_session JWT 잔존 재인증 → 200 응답에 `clearSessionCookie('user')`(삭제된 소비자 신원만, 역할세션 보존).
- **GAP5 ✅** AdminLayout/AgencyLayout 로그아웃이 RQ 캐시 미정리(PII 잔존) → `getQueryClient().clear()` 추가(logoutSeller 와 대칭).
- **V-1 ✅** 카카오 소비자 로그인이 generic `useAuthStore`('auth-storage', 핀/큐레이터 인증뷰) 미설정 → "로그인했는데 핀 UI 는 로그아웃" → `KakaoCallbackPage`(POST) + `auth-callback-bootstrap`(서버-redirect) 양 경로에 `setAuth` 배선.
- **V-3 ✅** 로그아웃이 persist `auth-storage` 미정리 → 새로고침해도 핀 UI 로그인됨 표시 → `clearAuthData`(user) + 전체 `logout()` 에 `useAuthStore.clearAuth()`.
- **V-5 ✅** `isLoggedIn()`(async)이 `user_type` 게이트에 묶여 듀얼로그인 시 소비자 미인정 → `isLoggedInSync()`(토큰존재 기반) 재사용으로 RouteGuards 와 일관.
- **V-2 ✅ (2026-06-29 후속)**: 이메일 로그인/가입(`auth.routes.ts /login·/register`)이 Bearer 만 주고 `ur_session` httpOnly 미발급이던 비대칭 해소 — 카카오와 동일하게 `createSessionCookie('user')` 를 same-origin 200(JSON) 응답에 additive Set-Cookie(iOS WebKit 영속 패턴). SSR 개인화 경로 통일. Bearer 흐름 무변경. 검증 tsc 0·build 0·auth-cookie 가드 0.
- **GAP3 재평가(대부분 이미 처리)**: 비번 변경 경로는 이미 refresh token revoke(소비자 `change-password` line363) + 셀러 reset 은 `startDashboardSession`(min_valid_iat 부양)까지 해 **대시보드 세션 완전 무효화**. admin/agency 는 self-service 비번변경 없음. **잔여 = 소비자 30일 stateless `ur_session` 무효화**뿐 — hot-path epoch read(로딩 perf 잠금영역) 설계결정 필요라 의도적 보류.
- **문서화 잔여(미수정)**: V-4(establish 실패 시 half-logged-in 창 — KakaoCallbackPage 잠금파일) · GAP3 소비자 ur_session epoch(설계결정). 둘 다 대표 결정/승인 선행.
- 검증: tsc 0 · 단위 **2356 pass** · build(client+ssr+prerender+worker) 0 · audit-gate **31/31 GREEN**(auth-cookie iOS 영속 패턴 포함) · auth-cookie 가드 0. ⚠️ 배포 후 staging: 소비자/셀러/어드민/에이전시/제조사 각 로그아웃 1회 + 카카오 계정전환 1회 + 핀(로그인→핀→로그아웃→핀UI 비로그인) 1회.

## ✅ 2026-06-29 — 결제 정확성 감사(C영역, 가드 미보유 머니 산술) + fee-resolver 컷오버 시트 (대표 "뭐가 가장 이상적이야?")
**배경**: audit-gate 31/31 GREEN(결정론 가드 영역 재감사 스킵) → 가드가 못 보는 **머니 산술/외부PG 실응답**만 수동 감사. 3개 병렬 read-only 에이전트 + 자가 코드 재검증.
- **🔴 그룹바이 할인 under-charge 구멍 fix** (`8b3802d76`): `order.routes.ts` 가 클라이언트 discount 를 서버 재계산 없이 신뢰 → 공구 상품 할인 위조 가능. 서버가 `maxTierDiscount(group_buy_tiers)` 로 **cap 재계산**(group-buy-public 의 current_price 와 **byte-동일 공식** `Math.round(price×(1−md/100))` → 정상주문 통과·위조만 차단). `groupBuyPortion = min(클라요청, groupBuyCap, 잔여)`.
- **🟡 클로백 반올림 drift + Toss 취소 비정수액 fix** (`06e0784e1`): `voucher-settlement-clawback.ts` 가 정산을 per-voucher 차감(drift) → cron 공식으로 **남은 매출서 재계산**(절대값 write). `order.routes.ts` Toss 취소액이 `body.refund_amount`(비정수 가능) → 정수 `refundAmount`만 전달.
- **🟢 5% 커미션 일원화** (`d6567ef89`): `settlement-automation.ts` 의 잔존 10% 기본값 → `COMMISSION_DEFAULTS.PLATFORM_FEE_PCT`(5) SSOT. 라이브는 이미 5%(createOrder 가 seller rate 5% 스냅샷) → 도달 불가 상수 정정(경제변화 ~0). `repair-schema`/`production-schema` 주석도 DEFAULT 5.00.
- **🟢 store-intro 커미션 상수 SSOT** (`20aa1301c`, #7): 에이전시 2.0%/영입자 1.5% 매직넘버 → `policy.ts` `COMMISSION_DEFAULTS`(값 불변).
- **⏳ fee-resolver 실배선 = 대표 결정 대기**(`bac613f8b` 결정시트 `docs/design/fee-resolver-cutover.md`): 리졸버(SSOT, 26 불변식)는 깔끔한 5-슬라이스 타겟이나 **라이브가 정책보다 후하게 드리프트**(에이전시 2%/영구/추가 + 영입자 1.5% — 모델 미포함). 배선 = 파트너 지급 변경 → 결정 3건(D2 소급 / D4 영입자 유지·폐지·흡수 / D5 보너스) + shadow mode + 스테이징 필요.
- 검증: tsc 0 · build 0 · audit-gate **31/31 GREEN** · money/sql 가드 0. ⚠️ **배포 전 staging 실결제 검증 필수**(아래 체크리스트 `docs/STAGING_VERIFY_2026-06-29.md`).

## ✅ 2026-06-27 — 도매 B2B 주문 상태머신 + 전 플로우 정합 (대표 "A+1,2,3,4 / 빠진 것 철저히 분석")
**배경**: 도매(유통스타트) B2B 주문이 결제(예치금 즉시차감 PAID) 후 제조사 확인·발송·판매사 구매확정까지 가는 라이프사이클이 느슨했음(상태 free-form TEXT, 고아 DONE/CANCELLED, 정산이 발송 여부 무관하게 시간만으로 성숙). 5단계로 정비 + 전수 정합.
- **Phase A ✅ 정산 발송게이트** (`a9d9599`): `matureSupplierSettlements` 가 도매 정산(`source='wholesale'`)을 **라인 `line_status='SHIPPED'` 일 때만** 성숙(SHIPPED_GATE EXISTS). 소비자 정산(`source!='wholesale'`) byte-불변.
- **Phase 1~4 ✅ 상태머신 + 수락/거절·구매확정·셀프취소** (`5e8e7c3`): 신규 SSOT `wholesale-order-status.ts`(`WHOLESALE_ORDER_STATUSES` 12종 + `WHOLESALE_TRANSITIONS` + `transitionWholesaleOrder` CAS + `refundWholesaleOrderFully`). 제조사 `/orders/:id/accept`(PAID→ACCEPTED)·`/reject`(라인환불+REJECTED), 판매사 `/confirm`(SHIPPED→DONE)·`/cancel`(발송전 예치금환불 CANCELLED). 가드 `check-wholesale-order-status.mjs`(정의 밖 status write 차단, audit-gate+CI strict). 배지 SSOT(`wholesale-theme.ts`) ACCEPTED/REJECTED 추가.
- **전 플로우 정합 ✅** (`8e1f707`): 상태머신 추가 후 **이전에 작성된 "활성주문" 필터·매출집계·환불 허용목록이 ACCEPTED/DONE 을 몰라** 주문이 목록·매출에서 빠지고 일부 환불/거절이 막히던 통합 갭 전수 수정. 공유 상수 `ACTIVE_WHOLESALE_STATUSES`+`sqlStatusList()` 로 한 곳에서 파생(재발방지). 고친 곳: 제조사 주문목록(수락 시 사라지던 버그)·매출/GMV/판매사 매입총액·거래내역서(부분환불 net 정확화)·다제조사 SHIPPED 전이(REFUNDED 라인 종결처리)·어드민 강제환불/클레임 허용(가드+CAS 동일집합)·어드민 배지 12종+필터·구매확정/취소 제조사 알림. **소비자 드롭십(`orders` 테이블) 무수정(서비스 분리).**
- 검증: tsc 0 · 단위 2356 pass · build 0 · audit-gate **31/31 GREEN**(도매주문 상태 무결성 가드 포함).
- ⚠️ **배포 후 staging 실검증 권장**: 수락→발송→구매확정 1사이클 + 다제조사 주문 한 라인 거절 1회.
- **정밀 correctness 리뷰 + 하드닝 ✅** (3 적대적 에이전트 — 금액/동시성/크래시): **P0 머니버그 fix** — `refundWholesaleSupplierLines` 의 배송비 gap 환불이 함수 진입 stale snapshot 으로 계산돼 **동시 다라인/다제조사 환불에서 배송비 이중환불**(예: ₩12,000 청구에 ₩24,000 환불). 수정: `shipping_refunded` 마커 컬럼 CAS(0→1 + 전라인환불 NOT EXISTS)로 단발 환불 + line 누적에 MIN clamp(grand_total 상한). 동반: ① 신규 6컬럼(accepted_at 등)+shipping_refunded 를 repair-schema 등록 + accept/reject 핸들러에 ensureOrderTables(콜드 isolate 무음실패 차단) ② bulk 송장 UPDATE 에 `line_status='PENDING'` 가드(REFUNDED 라인 부활 차단) ③ 거래내역서 STATUS_KO ACCEPTED 라벨. **잔여 P1 근본수정 완료 ✅**: 발송완료(SHIPPED) 라인을 어드민 강제환불/반품승인할 때 cron 성숙+payout 과의 레이스로 제조사 지급+바이어 환불이 겹치던 것 → **환불 경로 시작 시 `holdWholesaleSettlements`(역전과 동일 스코프 — supplierId+productIds, 부분환불 시 타 제조사/라인 동결 방지)로 정산 보류 + `payoutSupplier` 가 `held_at IS NULL` 만 지급**. held 정산은 매숙·지급 양쪽에서 제외 → 역전이 깨끗한 cancel(클로백 불필요). `held_at` repair-schema 등록. 환불 직전 이미 paid 완료된 진짜 동시건만 클로백(불가피·알림 복구). 검증: tsc 0·단위 2356·build 0·audit 31 GREEN·money/sql 가드 0.
- **출금(withdrawal) 경로 held 게이트 ✅** (P1 후속 — 같은 클래스 별개 노출): 출금은 개별 정산 claim 이 아니라 잔고캐시(`available_amount − reserved_amount`) 기준이라, **분쟁/환불로 held 인 available 정산이 출금가능액에 잡혀** 분쟁 종료 전 인출될 수 있었음(클레임 hold 케이스는 창이 김). 수정: `loadSpendable`·`reserveForWithdrawal` 가 **held available 합을 차감**(`spendable = available − reserved − held`, CAS threshold = `amt + held`). held 조회는 **fail-safe**(held_at 컬럼 없으면 throw→catch→0=기존 동작, 회귀 0) + `ensureWithdrawalSchema` 가 held_at ALTER 보장. **available_amount 의미 전역 변경은 회피**(분쟁해제 후 staleness + 소비자 적립 hot-path cold-DB throw 위험) — 돈 나가는 두 경로(payout·withdrawal)만 게이트로 동일 결과. 검증: tsc 0·단위 2356·build 0·audit 31 GREEN.
- **추가 적대적 리뷰(money-IN + self-review) 2건 fix ✅** (대표 "신중하고 이상적으로"): ① **BUG 2B(hold 스코프)** — 클레임 hold/해제가 주문 전체(unscoped)라 다제조사 주문에서 제조사 A 클레임 해결 시 *아직 열린* 제조사 B 클레임 hold 까지 풀려 분쟁 중 지급 위험. → hold/해제를 정산 SSOT 로 통일: 생성=`holdWholesaleSettlements(제조사 스코프)`, 해제=신규 `reconcileWholesaleHolds`(pending/available hold 전부 푼 뒤 *아직 열린* 클레임 스코프로만 재보류). ② **BUG 2A(hold 동결)** — Toss 환불 실패로 라인 롤백 시 hold 가 남아 정당 라인 영구 동결 → 롤백 경로에 `reconcileWholesaleHolds`(열린 클레임 없으면 해제) 추가. ③ **P2(sticky-partial 적립)** — `creditSupplierOnWholesaleOrder` 의 early `SELECT 1` short-circuit 제거(소비자측과 동일, per-line ON CONFLICT 가 멱등 보장) → 부분적립 주문 재호출로 완성 가능. ④ **P2(잠복)** — 도매 Toss `/orders/confirm` 금액검증 `subtotal`→`subtotal+배송비`(현재 dead-path, 재가동 대비 방어). **money-IN 핵심 SAFE 확인**: 예치금 이중차감 가드·서버 금액재계산·`subtotal=Σline_total` 불변식·dup-product 구조적 차단(Map dedup)·음수잔고 가드 전부 통과. self-review: shipping_refunded 마커·payout/withdrawal held 게이트·schema ensure 전부 SAFE(`Math.max(0,…)` 클램프가 음수 clawback row 의 spendable 인플레 차단 — load-bearing). **문서화 잔여**: 예치금 차감 직후~txn 기록 사이 sub-ms 크래시 시 reconcile-cron 미회수(pre-existing, 수동복구) — spurious-refund 위험 때문에 미수정. 검증: tsc 0·단위 2356·build 0·audit 31 GREEN·money/sql 0.

## 🚧 2026-06-27 — 유어애즈 추가기능 3종(소싱리포트·예산페이싱·노출순위) + 판매채널 번들 설계 (대표 "수익화 보류, 기능부터 / 모두 다")
**결정**: 수익화 토대 보류, **기능 우선**. 3개 후보 중 유어애즈 내부 2개는 풀구현, 크로스서비스 1개는 분리룰상 설계.
- **소싱 리포트**(`SourcingPanel`): 데이터랩 쇼핑인사이트 — 네이버쇼핑 1-depth 10개 카테고리 최근1년 트렌드 → 증감률 막대(뜨는 분야). `shoppingCategoryTrends`(POST /v1/datalab/shopping/categories, 그룹 내 정규화라 증감률 유효) + GET `/api/ads/sourcing/trends`. **도매몰 소싱 시너지**, 연동 불필요.
- **노출순위(avgRnk)**: `accountStats` fields 에 `avgRnk` 추가 → 통합실적 캠페인표에 '평균순위' 열(공식 지표, 스크래핑 X).
- **예산 페이싱**: `budgetPacing` — 오늘 캠페인별 소진(/stats today salesAmt) vs dailyBudget → 과속(≥95%)/저소진(<30%)/정상 플래그. GET `/searchad/pacing` + SearchAdPanel ⏱️ 섹션.
- **유어딜 판매채널 번들**: 🟡 **설계 문서만**(`urads-yourdeal-channel-bundle.md`) — 세 서비스 잇는 변경이라 정산·이행·소유권 결정(A~D) 선행. 블라인드 코드는 분리 누수 위험(과거 도매상품 누수 클래스) → 결정 후 복제본 플래그로 안전구현.
- 검증: tsc 0 · build 0 · 단위 2340 pass · theme/mobile/sql-bind 0. 라이브는 배포 후.

## 🚧 2026-06-27 — 유어애즈 부정클릭 차단 Phase 2(반자동 — 검색광고센터 복붙) (대표 "부정클릭 차단 마저")
**현실**: 네이버 검색광고 **공식 API 에 노출제한 IP 관리 엔드포인트 없음**(센터 UI 전용, 계정당 600개) → 설계 문서의 "API 미지원 시 반자동" 경로 채택. **실제 동작하는 차단 방식.**
- **코어**(`clickguard.ts`): `ad_blocked_ips`(seller_id,ip UNIQUE) + addBlockedIp(IP검증·600 cap·INSERT OR IGNORE)·listBlockedIps·removeBlockedIp.
- **라우트**: POST `/clickguard/block` · GET `/clickguard/blocklist` · DELETE `/clickguard/block?ip=`.
- **UI**(`ClickGuardPanel`): 의심 IP 리포트에 **'차단' 버튼**(이미 차단=‘차단됨’ 표시) → 🚫 차단목록 카드(칩 + ×제거) + **'전체 복사'** → 검색광고센터 노출제한 IP 붙여넣기 안내. (공식 API 열리면 자동 push 로 전환 — 구조 준비).
- 검증: tsc 0 · build 0 · 단위 2340 pass · theme/mobile/sql-bind/sql-null 0. **부정클릭 = 탐지+차단 全 완료**(반자동). ⚠️ 라이브는 배포 후.

## 🚧 2026-06-27 — 유어애즈 기술부채 점검 + 가격 모니터링 신규 서비스 (대표 "기능 최대한 / 기술부채 없나")
**(1) 기술부채 자가점검**: 유어애즈 신규코드 전수 점검 → 전 가드 통과(schema-refs/column-exists/money-strict/sql-bind/sql-null/theme/mobile/csv/iserror 0). 발견 부채는 `TECHNICAL_DEBT.md` 에 등재(블라인드 API 스키마 배포후검증 Med · 자동입찰 라이브검증 High이나 킬스위치 OFF로 현재위험0 · clickguard 분산abuse Low · 패널 isError Low · stats 30캠 cap · i18n 국내전용 · ensureXxx 테이블 SSOT 미등재). **돈/크래시 위험 0, 대부분 "배포후 실키 검증" 성격.**
**(2) 가격 모니터링 신규 서비스**(쇼핑검색 — 보라웨어에도 없는 추가 서비스, 연동 불필요·돈 0):
- **코어**(`price-monitor.ts`): `ad_price_watches`(seller_id,query UNIQUE). `lowestPrice`(쇼핑검색 sort=asc 최저가 1건, keyword-tools 신규) 사용. addWatch(즉시1회조회·50개cap)·refreshWatch·listWatches·deleteWatch·refreshAllWatches(cron).
- **라우트**: GET `/price/watches` · POST `/price/watch`(추가+즉시조회) · POST `/price/refresh?id=` · DELETE `/price/watch?id=`.
- **cron**: 일일(0 18) `ads-price-refresh` — 오래된 워치 우선 최저가 갱신(상한 300).
- **UI**(`PricePanel`): 검색어+내판매가 등록 → 최저가/최저몰/상품수 + **내가 최저가인지(최저가✓/더비쌈)** 비교 + 갱신/삭제.
- 검증: tsc 0 · build 0 · 단위 2340 pass · 전 가드 0.

## 🚧 2026-06-27 — 유어애즈 자동입찰 자율 엔진 + 규칙 UI (대표 "남은거 계속 / 동작확인 뒤에") — 보라웨어 5종 全 가동
**배경**: 보라웨어 5종 마지막 핵심 = 자동입찰 자율 cron. **돈 루프라 안전레일 다중**으로 구축.
- **엔진**(`autobid.ts`): `planBid(estBid, maxBid, currentBid)` **순수 함수**(테스트 6건) — 추정가가 max_bid 넘으면 **max_bid 로 하드캡**, 글로벌 10만 상한, 최소 변경폭 10원(PUT 남발 방지). 엔진은 **절대 사용자 ceiling 초과 입찰 불가**. `runAutobidForSeller`(dryRun 지원) · `runAutobidAll`(cron, 킬스위치 gate).
- **안전레일 5중**: ① 규칙 기본 OFF ② max_bid 하드캡(불변식 테스트) ③ 글로벌 킬스위치 env `ADS_AUTOBID_ENABLED='true'` 아니면 cron no-op ④ 변경로그 `ad_autobid_log` ⑤ dry-run 미리보기.
- **라우트**: GET/POST/DELETE `/searchad/autobid/rule(s)` · POST `/autobid/preview`(dry-run) · POST `/autobid/run`(수동 즉시, 킬스위치 무관=사용자 명시). **cron**: scheduled.ts `*/5` 에 `ADS_AUTOBID_ENABLED` gate 추가(기본 OFF → no-op).
- **UI**: `SearchAdPanel` 키워드 행에 "목표순위 자동입찰"(순위 select+최대₩+🎯) 규칙 생성 / `AutobidPanel`(규칙 목록·ON·OFF·삭제·미리보기·지금적용·변경로그, 엔진 ON/OFF 배너).
- 검증: tsc 0 · build 0 · 단위 **2340 pass**(+planBid 6) · theme/money/mobile/sql-bind/sql-null 0. ⚠️ **실 계정 검증 후** `ADS_AUTOBID_ENABLED=true` 로 자율 엔진 활성(그 전엔 '지금 적용'으로 수동만).
- **🎯 보라웨어 5종 = 全 가동**: 자동입찰 ✅(예상가+수동+자율규칙) · 키워드확장 ✅ · 통합실적 ✅ · AI마케터 ✅ · 부정클릭 ✅(Phase1 탐지, 차단은 결정B 후).

## 🚧 2026-06-27 — 유어애즈 부정클릭 방지 Phase 1(수집·탐지·리포트, 차단 0) (대표 "시작해줘 / 가장 이상적으로")
**배경**: 보라웨어 5종 마지막. 광고 API 가 아니라 방문자 추적 아키텍처. 설계 `docs/design/urads-clickfraud-design.md`. **프라이버시 바이 디자인**(대표 "가장 이상적으로"): 자사 픽셀 1자 수집 + **광고주 도메인 검증**(스푸핑 차단), IP는 **그룹핑 해시+원문 병행**(차단 단계 필요)·**90일 자동삭제**·광고주별 격리, 위치는 **국가 수준만**(CF 헤더), 목적 제한. **Phase 1 = 차단 없음(탐지·리포트만, 저위험).**
- **코어**(`clickguard.ts`): `ad_clickguard_sites`/`ad_click_events`(인덱스 2). genAdvertiserKey(16자)·hashIp(SHA-256 salt)·domainMatches·lookupSite(isolate 캐시)·registerSite·recordHit(도메인검증+2% 확률 90일 정리)·clickReport(IP별 집계, ≥8클릭 의심).
- **라우트**: GET `/clickguard/pixel.js`(공개 — sendBeacon 스니펫) · POST `/clickguard/hit`(공개·rateLimit·도메인검증·CF IP/국가·항상 204) · POST/GET/DELETE `/clickguard/site(s)`(인증) · GET `/clickguard/report`(인증, 탐지만).
- **UI**(`ClickGuardPanel`): 사이트 등록→픽셀 스니펫 복사 + **개인정보처리방침 안내문 복사**(광고주 고지용) + 의심 IP 리포트(7/30일, 총클릭/고유IP/광고유입 + IP표 의심판정).
- 검증: tsc 0 · build 0 · 단위 2334 pass · theme/mobile/sql-bind/sql-null 0 · api-auth 신규경고 0(pixel/hit 의도적 공개). ⚠️ Phase 2(노출제한 IP 차단)는 결정 B(공식 API 지원 여부) 후. 라이브는 배포 후.

## 🚧 2026-06-27 — 유어애즈 키워드 자동등록(키워드확장 write, 안전레일) (대표 "남은거 계속 해줘")
**배경**: 키워드확장의 write(발굴은 read 로 이미 완성). 광고그룹에 키워드 등록. 그룹입찰 상속(useGroupBidAmt=true)이라 키워드별 입찰 surprise 없음(안전).
- **클라이언트**: `addKeywordsToAdgroup(creds, adgroupId, keywords[])` — POST `/ncc/keywords?nccAdgroupId=`(그룹입찰). dedupe + 길이검증 + `KW_ADD_MAX=20` cap.
- **라우트** POST `/api/ads/searchad/keywords/add` {adgroup_id, keywords[]} — 연결 필수 + 서버 개수(≤20)/길이 검증. rateLimit 20/min.
- **UI**(`SearchAdPanel`): 광고그룹 드릴다운 하단 "키워드 추가(쉼표 구분)" input + confirm → 등록 후 목록 새로고침.
- 검증: tsc 0 · build 0 · 단위 2334 pass · theme/money/mobile 0. ⚠️ 실제 키워드 생성 → staging 검증 후.
- **🎯 유어애즈 보라웨어 5종 현황**: 키워드확장 ✅(발굴+등록) · 통합실적 ✅(읽기) · AI마케터 ✅(읽기) · 자동입찰 ◐(예상입찰가+수동 입찰변경 ✅ / 자율 cron 보류) · 부정클릭 ⏳(추적픽셀+PIPA+IP차단 설계 필요). **남은 핵심 = 자율 자동입찰 cron(실 계정 검증 후) + 부정클릭 설계.**

## 🚧 2026-06-27 — 유어애즈 AI 마케터(Claude 진단/추천, 읽기) — 우리 구조적 강점 (대표 "남은거 계속 해줘")
**배경**: 보라웨어는 외부 AI 의존, 우리는 **자체 Claude 보유** → AI마케터가 구조적 우위. 이미 모은 데이터(실적+연관키워드+추세+쇼핑경쟁)를 Claude 에 넘겨 한국어 진단/추천. **읽기 전용 — 자동 실행 0**(입찰/키워드 변경은 사용자 직접).
- **헬퍼**(`ai-marketer.ts`): `aiMarketerAdvice(apiKey, ctx)` — system 프롬프트가 "컨텍스트 수치만 근거(환각 금지)" 강제 + 진단/잘되는점/개선점/추천액션/주의 섹션. 기존 admin-review-generator 와 동일 anthropic 호출 패턴(`api.anthropic.com/v1/messages`, claude-haiku-4-5). 미설정 시 NOT_CONFIGURED.
- **라우트** POST `/api/ads/ai-marketer` body `{seed?}` (rateLimit 10/min) — 연결 시 7일 실적 + seed 시 연관키워드/쇼핑경쟁/추세를 컨텍스트로 수집해 호출. env `ANTHROPIC_API_KEY` 타입 추가(fail-soft).
- **UI**(대시보드): "🤖 AI 마케터" 카드 — 중심키워드(선택) + 'AI 분석 받기' → 경량 마크다운 렌더(헤더/불릿, dangerouslySetInnerHTML 없음=XSS 0).
- 검증: tsc 0 · build 0 · 단위 2334 pass · theme/mobile 0. ⚠️ 라이브는 `ANTHROPIC_API_KEY` 설정 + 배포 후. (보라웨어 5종 중 AI마케터 = 읽기로 가동, 자율 자동입찰 cron 만 남음 — 실 계정 검증 후.)

## 🚧 2026-06-27 — 유어애즈 통합실적(StatService /stats, 읽기) — 보라웨어 통합실적 (대표 "남은거 계속 해줘")
**배경**: 통합실적 = 캠페인별 노출/클릭/광고비/전환 + 합계. 읽기(돈 변경 0). StatReport(비동기 bulk CSV) 대신 **실시간 `/stats`** 사용(가벼움).
- **클라이언트**: `accountStats(creds, days)` — listCampaigns→캠페인 id(최대 30)→GET `/stats`(ids/fields/timeRange JSON 인코딩, fields=impCnt/clkCnt/salesAmt/ccnt) → 캠페인별 + 합계(CTR=clk/imp, CPC=cost/clk, 0가드). 응답 방어적 파싱({data:[]} 또는 배열).
- **라우트** GET `/api/ads/searchad/stats?days=7|30` (연결 필수, rateLimit 30/min).
- **UI**(`SearchAdPanel`): 연결 시 "📊 통합실적" — 7/30일 토글 + 6지표 카드(노출/클릭/광고비/전환/CTR/CPC) + 캠페인별 표(top10).
- 검증: tsc 0 · build 0 · 단위 2334 pass · theme/mobile/nan 0(formatNumber 일관). ⚠️ 라이브(/stats 응답 스키마)는 배포 후 실 계정 검증.

## 🚧 2026-06-27 — 유어애즈 키워드 입찰가 수동 변경(WRITE, 안전레일) — 자동입찰 write 첫발 (대표 "남은거 계속 해줘")
**배경**: 자동입찰의 write(돈 영향). **자율 cron 루프는 보류**(실 계정 1회 검증 전) — 대신 **사용자 명시 액션 기반 단건 변경**부터(blast radius=클릭당 1키워드, confirm + 서버 범위검증).
- **클라이언트**: `updateKeywordBid(creds, keywordId, bidAmt)` — PUT `/ncc/keywords/{id}?fields=bidAmt`(useGroupBidAmt=false). 상수 `BID_MIN=70`/`BID_MAX=100,000`(오타·폭주 하드캡).
- **라우트** PATCH `/api/ads/searchad/keywords/bid` (rateLimit 60/min) — 연결 필수 + 서버 `Number.isFinite`+범위검증(클라값 불신). 자동 아님.
- **UI**(`SearchAdPanel`): 키워드 드릴다운 행에 입찰가 input + '적용'(confirmDialog "실제 광고비 영향" → 성공 시 행 즉시 갱신).
- 검증: tsc 0 · build 0 · 단위 2334 pass · theme/money-patterns/mobile 0. ⚠️ **실제 입찰가 변경 → 배포 후 staging 실 계정 1회 검증 필수**(estimate 응답·bid PUT 동작 확인) 후에야 자율 cron 엔진 착수.

## 🚧 2026-06-27 — 유어애즈 목표순위 예상 입찰가(Estimate, 읽기) — 자동입찰 핵심 (대표 "남은거 계속 해줘")
**배경**: 자동입찰의 핵심 = "원하는 순위로 노출하려면 입찰가 얼마?". **읽기(돈 변경 0)**부터 — 실제 입찰가 PUT(write)은 안전레일(max_bid 하드캡·규칙별 enable·변경로그·staging 검증) 갖춰 다음 단계.
- **클라이언트**: `searchAdGet` → 범용 `searchAdRequest(method, path, query, body)` 로 리팩터(GET/POST/PUT 지원, GET은 단축 래퍼 — 기존 호출부 무변경). `estimateBidForPositions(creds, keyword, [1..5], device)` — POST `/estimate/average-position-bid/keyword`, 응답 방어적 파싱({estimate:[]} 또는 배열).
- **라우트** GET `/api/ads/searchad/estimate?keyword=&device=PC` (rateLimit 30/min). 연결 시 고객사 키, 없으면 47982 폴백(Estimate는 고객레벨이라 둘 다 동작).
- **UI**(`SearchAdPanel`): "🎯 목표순위 예상 입찰가" 미니툴 — 키워드+PC/모바일 토글 → 1~5위 예상 입찰가 카드(연결 없이도 동작).
- 검증: tsc 0 · build 0 · searchad 단위 7 pass · theme/mobile 0. ⚠️ 라이브(estimate 응답 스키마)는 배포 후 실 키로 검증. 다음: bidAmt PUT + 자동입찰 규칙/cron(write, 안전레일).

## 🚧 2026-06-27 — 유어애즈 검색광고 계정 연동(멀티테넌트) + 내 광고 구조 조회 (대표 "남은거 계속 해줘")
**배경**: 보라웨어 5종(자동입찰·실적·키워드확장 등)의 **공통 전제 = 고객사 광고계정 연동**. 멀티테넌트 모델 — 각 고객사가 자기 검색광고 키(고객ID/액세스라이선스/비밀키)를 연결 → 플랫폼이 그 키로 대신 호출. 커머스 연동(naver_commerce_connections)과 동일 분리/암호화 패턴(단 3-필드 HMAC이라 별도 테이블).
- **저장소**(`searchad-connection.ts`): `ad_searchad_connections`(seller_id UNIQUE, customer_id, access_license, **secret_key_enc**=encryptAtRest AES-GCM). ensure(WeakSet 메모이즈)/save(UPSERT)/load(복호화)/delete/status(마스킹). 비밀키 평문저장 0.
- **클라이언트**(`searchad-client.ts` 확장): `listCampaigns/listAdgroups/listKeywords`(GET /ncc/*) — 캠페인→광고그룹→키워드(현재 입찰가) 드릴다운. 자동입찰/실적의 토대.
- **라우트**: POST `/api/ads/searchad/connect`(listCampaigns 200=유효 검증 후 암호화 저장, rateLimit 10/min) · GET `/searchad/status` · DELETE `/searchad/connect` · GET `/searchad/campaigns|adgroups|keywords`(연결 필요). `/keywords/related` 는 연결 시 **고객사 키 우선**, 없으면 플랫폼(47982) 폴백(`resolveSearchAdCreds`).
- **UI**(`SearchAdPanel.tsx`): 연결 폼(3필드) + 연결됨 시 캠페인/광고그룹/키워드 expand 드릴다운(현재 입찰가 표시). 대시보드에 마운트.
- 검증: tsc 0 · build 0 · 단위 2334 pass · theme/light-input/mobile/sql-bind/sql-null/crossrole 0. ⚠️ **라이브 검증은 실 광고계정 키 + 배포 후**(이 환경 egress 차단). 다음: 키워드 bidAmt PUT(목표순위 자동입찰) + StatReport(통합실적).

## 🚧 2026-06-27 — 유어애즈 시장분석 무료도구 확장: 브랜드 평판 모니터링 + 자동완성 키워드확장 (대표 "네이버 API로 할 수 있는 서비스 더 찾아서 개발")
**배경**: 대표가 보라웨어 5개 서비스(자동입찰·부정클릭·키워드확장·통합실적·AI마케터) 시안 공유 + "더 찾아서 개발". 5종은 전부 **광고 write**(입찰/키워드등록/IP차단)라 공통 전제 = 고객사 광고계정을 관리계정(47982)에 연동. 반대로 **읽기 도구는 보유 키만으로 즉시** → 고객 유입용 무료도구로 먼저 출시(레퍼런스: `docs/design/urads-boraware-reference.md`).
- **브랜드 평판 모니터링**(신규 서비스): `brandReputation` — 오픈API 블로그/카페/뉴스 검색 병렬(Promise.allSettled, 채널별 fail-soft) → 언급량 + 최근 글 3건씩. `GET /api/ads/reputation?q=` (rateLimit 30/min). 대시보드 3컬럼 카드(블로그/카페/뉴스 언급수 + 최근글 링크).
- **자동완성 키워드확장**: `keywordAutocomplete` — ac.search.naver.com(키 불필요, best-effort 실패 시 빈배열) 롱테일 후보. `GET /api/ads/keywords/autocomplete?q=`. 대시보드 칩(클릭 시 그 키워드로 재분석 — `analyzeKeyword(term)`).
- **연동 불필요 — 보유 오픈API 키(NAVER_SEARCH_*/NAVER_*)로 즉시 동작.** 키워드 도구 1회 분석 시 추세/쇼핑/연관/자동완성/평판 5종 동시 호출(allSettled).
- 검증: tsc 0 · build 0 · 단위 2334 pass · theme/mobile-viewport/sql-bind 0. ⚠️ 라이브(특히 ac.search.naver.com 서버호출)는 배포 후 확인.

## 🚧 2026-06-27 — 유어애즈(UR Ads) 3번째 서비스: 네이버 검색광고 API 연관키워드 추천 (대표 "모두 다 했어" — 키 설정 완료)
**배경**: 도매몰·유어딜에 이은 **3번째 분리 서비스** 유어애즈(`/ads` · `/api/ads` · MarketingLayout · 전체 PC폭). 보라웨어식 종합 마케팅 툴(자동입찰/부정클릭/키워드확장/통합실적/AI마케터) 목표. 네이버 = **3개 별개 플랫폼**(오픈API·커머스API·검색광고API). 발주수집(커머스API)은 고정IP 필요 → 보류. 검색광고/오픈API는 고정IP 불필요 → 먼저 구현.
- **검색광고 API 클라이언트 신설**(`searchad-client.ts`): HMAC-SHA256 서명 인증(`sign=base64(HMAC(secretKey, ts.METHOD.path))`, X-Timestamp/X-API-KEY/X-Customer/X-Signature). `searchAdCredsFrom(env)`=셋 다 있어야 활성(부분키 호출 방지, fail-soft). **RelKwdStat(연관키워드+월검색량)** — 관리계정(47982) customer-level 로 광고계정 0개여도 동작.
- **라우트** `GET /api/ads/keywords/related?seed=` (rateLimit 30/min, 미설정 시 503 → 프런트 자동숨김). **대시보드** 키워드 도구에 연관키워드 테이블(키워드/월검색량/PC/모바일/클릭/경쟁) + 검색추세/쇼핑경쟁 동시 표시.
- **env** `NAVER_SEARCHAD_CUSTOMER_ID`/`_ACCESS_LICENSE`/`_SECRET_KEY` 추가(Cloudflare Secrets 만 — 코드/채팅 노출 금지). ⚠️ **대표 안내**: 채팅에 붙였던 비밀키는 노출됐으므로 검색광고센터에서 **재발급(회전) 권장**.
- 다음: 고객사 광고계정 연동 후 Estimate(목표순위 입찰추정)·StatReport(실적). 순위측정은 공식 API only(SERP 스크래핑 금지 — 2026-04-22 제거 이력, PIPA).
- 검증: tsc 0 · build(worker+client) 0 · 전체 단위 2327+7 pass · 신규 `searchad-client.test.ts` 7건(creds fail-soft·`< 10` 파싱·정렬·100 cap). ⚠️ 라이브 호출은 이 환경 egress 차단 → 배포 후 실 키로 1회 검증 필요.

## 🟡 2026-06-26 — 카카오 ↔ 사업자 유저(셀러) 단일 로그인 통일 2단계 (대표 "응 하자. 가장 이상적으로")
**배경/설계**: `docs/design/kakao-seller-unification.md`. 감사 확인 — **카카오→셀러 대시보드 진입은 이미 동작**(콜백 `issueLinkedRoleTokens`→역할토큰 fragment→KakaoCallbackPage). 따라서 2단계는 **잠금파일 무수정 + additive UX/마이그레이션 유도**만으로 달성.
- **2a ✅ 셀러 로그인 카카오 우선**: `SellerLoginPage.tsx` — 카카오 버튼을 기본(상단 prominent CTA)으로 승격, 이메일/비번 폼은 "기존 이메일로 로그인" 토글 뒤로 강등(`showEmailLogin` 기본 접힘). **`seller_remember_email` 저장된 기존 이메일 셀러는 자동 펼침 → 회귀 0.** 이메일 로그인 로직(handleSubmit/Turnstile/remember) byte-동일 보존. i18n `seller.kakaoLoginPrimary/Hint`·`emailLoginToggle` 6언어.
- **2b ✅ 대시보드 연동 권유 배너**: 신규 `SellerKakaoLinkBanner.tsx`(SellerLayout `<main>` 상단, dismissible). dismiss 플래그/`user_id`(카카오세션) 있으면 **네트워크 0** 미노출; 이메일 셀러 후보만 1회 `GET /api/seller/kakao-link-status` → 미연동시만 노출. CTA→`/seller/profile`(기존 `KakaoLinkButton` OAuth 팝업 재사용, 중복 0). i18n `seller.kakaoBannerTitle/Desc/Cta` 6언어.
- **2b+ ✅ 관리자 미연결 셀러 마이그레이션 뷰**: 이미 어긋난 기존 셀러(이메일 불일치 자동연결 실패, 예: tobe2111)를 운영자가 일괄 정리. `GET /api/admin/sellers/unlinked`(비잠금) — 미연결 셀러 + **추정 매칭**(이메일 COUNT=1 + 유저 미연결일 때만, 오연결 방지). `AdminPendingSellersPage` 에 미연결 목록 + 원클릭 '연결'(공유 `doLink`→기존 `PATCH /sellers/:id/link-user`, conflict 가드/audit 그대로).
- **P1 ✅ 이메일 대소문자 무시 자동연결** (`[UNLOCK_LOADING]` 대표 "계속 하자"): `KakaoAuthService.upsertUser` same-email 자동연결 UPDATE 매칭 + COUNT 게이트를 `LOWER(email)=LOWER(?)` 로 → `"Foo@x.com"`vs`"foo@x.com"` silent 미연결 갭 해소. verified 게이트·COUNT≤1·IS NULL 멱등 byte-불변(매칭만 넓힘). CLAUDE.md 로딩 audit log 기록. unit 1813 pass.
- **2c 🔜 완전 폐지(보류)**: 미연결 이메일 셀러 lockout 방지 위해 마이그레이션 성숙까지 fallback 유지. 잠금파일(kakao.routes/KakaoCallbackPage/pending-auth) 무수정 — 2c 진입 시에만 AskUserQuestion+audit.
- 검증: tsc 0 · theme-consistency 0 · 6 locale JSON valid · `npm run build` 0.

## ✅ 2026-06-26 — 결제 셀프취소 머니버그 3종 fix (대표 "지금 진행")
감사에서 나온 latent 3건을 `refundOrderFully` SSOT 라우팅으로 근본수정 (`src/worker/routes/order.routes.ts` PAID/DONE 전액취소).
- **B(HIGH)**: 딜 전액결제(toss_key 없음) 셀프취소 422 차단 → refundOrderFully isDeal skip + 딜 환급 → 취소 가능. **C(HIGH)**: 혼합결제 deal_used 미복원 → step 3b 복원. **D(MED)**: 쿠폰/referral_bonus/affiliate/공급/에이전시/영입자 미역전 → 전부 대칭 역전. + CAS 멱등(동시 이중취소 1회만).
- 부분취소(`cancel_amount<잔여`)는 기존 카드 Toss 경로 유지. order.routes.ts 비잠금. 검증: tsc 0·build 0·refund 27 tests·money-pattern 0. ⚠️ 쇼핑 재오픈 전 staging 실결제 권장.

## ✅ 2026-06-26 — 전 영역 5도메인 병렬 전수감사 + 감사 게이트 환경구축 (대표 "모두 봐줘 / 이상적이면 이후 감사 스킵하게 환경설정")
**5개 병렬 에이전트(결제·정산·분리·인증RBAC·크래시) + 코드 재검증.** 결과: 인증RBAC·크래시 2도메인 **clean**(가드 GREEN). 확인 버그 수정 + 가드로 영구 박음.
- **🔴 서비스 분리 단건 누수 fix (HIGH)**: 리스트/검색은 이미 격리됐으나 **단건 ID 경로**(공구 상세 `group-buy-public.routes` baseWhere ×2, 소비자 상품 상세 `products.routes` GET /:id 라우트가드, 장바구니 `cart.routes` getProduct, 공구확정 `group-buy.routes` confirm-toss)가 도매 원본(`is_supply_product=1 AND supply_source_id 없음`, group_buy_status DEFAULT 'active' 상속)을 미격리 → 소비자 표면+SSR 누수. 5사이트에 `AND NOT (COALESCE(is_supply_product,0)=1 AND COALESCE(supply_source_id,0)=0)` additive(findById 는 create/update 공유라 라우트 가드). **판매사 복제본·플랫폼·일반상품 보존.**
- **🟢 인플 원천징수 SSOT fix**: `influencer-payout.ts` cron 의 3.3/8.8 literal → `WITHHOLDING_RATES` SSOT(CLAUDE.md 하드코딩 금지 룰).
- **🛡️ 감사 게이트 환경구축(대표 "뒤가 중요")**: `scripts/audit-gate.sh`(29 불변식 한방 점검, GREEN=재감사 스킵) + `docs/AUDIT_INVARIANTS.md`(도메인별 가드 레지스트리 + 스킵 규칙) + `CLAUDE.md` 게이트 룰 + 신규 가드 `check-consumer-product-supply-isolation.mjs`(분리 회귀 잠금, pre-commit+CI strict). **현재 ALL GREEN 29건.**
- **latent(가드 미보유 → TECHNICAL_DEBT 등록)**: 결제 셀프취소 3건(refundOrderFully 우회 — 딜 미환급/혼합 deal_used 미복원/쿠폰·referral 미역전, 쇼핑 숨김 gated) · 제조사 출금가능 표시 과대(돈손실 0) · 인플 프론트 원천징수 하드코딩(표시). 쇼핑 재오픈 전 fix + staging 검증 필수.
- 검증: tsc 0 · sql-column/bind 0 · audit-gate ALL GREEN 29 · 신규 가드 회귀주입 catch 확인.

## ✅ 2026-06-26 — 유저↔어드민/셀러 상호 로그아웃 근본수정 (대표 신고 "유저 계정이랑 어드민 계정 서로 로그아웃")
**근본원인**: 대시보드 로그인(어드민·셀러)이 시작 시 **무조건 `clearAuthData('user')`** 호출. KR 에선 `clearAuthData` 가 `/api/auth/logout-cookies` 까지 호출해 **httpOnly `ur_session` 쿠키를 삭제** → "어드민/셀러 로그인 = 소비자 강제 로그아웃". 코드베이스의 이중 로그인 **공존** 설계(RouteGuards 토큰존재 기반 + `AdminLoginPage:97` "User 세션 보호" 주석 + KakaoCallbackPage `hasOtherRoleToken` 보존)와 정면 모순. 공존은 *소비자 로그인이 마지막*일 때만 동작했고 *대시보드 로그인이 마지막*이면 소비자가 죽었음.
- **수정(`AdminLoginPage.tsx`·`SellerLoginPage.tsx`)**: `clearAuthData('user')` 를 **`!isKorea()`(글로벌 Firebase) 게이트 안으로** 이동. KR 소비자=httpOnly 쿠키 세션, 대시보드=Bearer 라 **독립 → 공존**(파괴 안 함). 글로벌(Firebase) 경로는 byte-불변(clearAuthData+signOut 그대로). `clearFirebaseTokenCache()`·`clearAuthData('admin')`(role-scoped)·토큰 저장 전부 불변.
- **역방향은 이미 타겟됨(무수정)**: KakaoCallbackPage 의 admin/seller wipe 는 *다른 user.id*(계정 전환)에서만 발동(2026-06-25 보안 결정) → 소유자는 같은 계정이라 미발동. 401/403 인터셉터(api.ts)는 전부 role-scoped(교차 안 함).
- **영구 가드 신설**: `scripts/check-dashboard-login-session-coexist.mjs` — 대시보드 로그인의 무조건 `clearAuthData('user')`(=`!isKorea()` 게이트 밖)를 정적 차단. pre-commit(warn) + verify.yml(strict). 기존 read-side `check-dual-login-guard.mjs`(`user_type==='user'` 로그인판단 금지)와 write-side 짝.
- 검증: tsc 0 · 두 가드 0 · 회귀주입 테스트로 가드 catch 확인(exit 1).

## ✅ 2026-06-26 — 서비스 분리 누수 차단: 소비자 카탈로그에서 도매 원본상품 제외 (대표 "응 고치자")
**분리 전수조사 결과**: 도매↔유어딜 분리는 대체로 양호(크로스 import 0·도매 카탈로그 격리 완벽·양쪽 쓰는 비즈니스 컴포넌트 0·4대시보드 cross-role 0)였으나 **진짜 누수 1건**: 소비자 `ProductRepository.findAll` 가 `is_supply_product` 미필터 → 승인된 도매 원본상품이 `/browse`·검색/자동완성에 노출.
- **수정(`[UNLOCK_LOADING]`)**: 5개 소비자 쿼리(findAll·count·FTS·검색 자동완성 ×2)에 `AND NOT (COALESCE(is_supply_product,0)=1 AND supply_source_id IS NULL)` 추가. **도매 원본만 제외, 판매사 복제본·플랫폼상품·일반상품 보존**. `group-buy-public`은 category 격리라 무수정. Cache-Control/SSR/LIST_COLUMNS 불변. CLAUDE.md 로딩 audit log 기록.
- 검증: tsc 0 · sql-column/bind 0 · build 0 · 단위 1805 pass.

## ✅ 2026-06-26 — 유어딜 셀러·에이전시 가입폼 동일 UX 수정 (대표 "응 하자") — 4개 가입폼 전부 완료
**범위(유어딜 서비스만 — 도매몰 무관)**: 공유 헬퍼(`form-validators.ts`) 그대로 재사용해 나머지 2개 가입폼 수정. 이로써 가입폼 4종(제조사·판매사·셀러·에이전시) 모두 동일 검증 UX.
- **SellerRegisterPage(셀러)**: `form noValidate` + focus-by-id(인풋에 id 있음) → 화면 순서 검증·첫 문제 필드 포커스. `email.includes('@')`(=`a@b`·`@naver` 통과) → `isValidEmail`(TLD 필수). **전화 완성형 검증 신규**(기존 미검증). 사업자번호 하이픈 무관 10자리. 비번 정책(8자)·페이로드 불변.
- **AgencyRegisterPage(에이전시)**: `form noValidate` + ref 포커스. 이메일 `isValidEmail`, 전화(선택)는 입력 시만 완성형 검증. 회사명/담당자명 빈값 검증·포커스. 비번 정책·페이로드 불변.
- 검증: tsc 0 · light-input/theme 0 · build 0. 공유 헬퍼 단위테스트 7건이 네 폼 전부의 전화/이메일 규칙을 잠금.

## ✅ 2026-06-26 — 판매사 가입폼(도매몰) 동일 UX 수정 + 검증 헬퍼 단일화 (대표 "도매몰만 해당? 다 이상적?")
**확인 결과**: 같은 가입폼 버그 클래스가 도매몰 **판매사(WholesaleJoinPage)** + 유어딜 **셀러/에이전시** 가입폼에도 존재(제조사만 수정됐었음). 도매몰 분리 룰에 따라 **도매몰 판매사 폼만** 동일 수정(유어딜 폼은 별도 — 대표 확인 대기).
- **공유 헬퍼** `src/utils/form-validators.ts`(`digitsOnly`/`isValidKrPhone`/`isValidEmail`) 신설 → 제조사·판매사 폼 동일 규칙. 단위테스트 7건(`form-validators.test.ts`)으로 "010"·"010-9135"·"utonggori@naver" 미통과 고정. (010=11자리, 011/016~019=10~11자리.)
- **WholesaleJoinPage(판매사)**: `form noValidate` + ref 맵 → 화면 순서대로 검증·첫 문제 필드 포커스. 대표자/담당자 성명·연락처 각각 검증(연락처 완성형만). 이메일 TLD 필수. 비밀번호 정책(영문·숫자·특수 2종+4연속금지)·서버 페이로드·sameAsRep 복사 불변.
- **SupplierRegisterPage(제조사)**: 인라인 검증을 공유 헬퍼로 리팩터(동작 동일).
- 검증: tsc 0 · validators 7 pass · theme/light-input 0 · build 0.

## ✅ 2026-06-26 — 제조사 가입폼(도매몰) 검증/포커스 UX 전면 수정 (대표 시안 7건) — 서비스 분리 준수
**근본원인**: `<form>` 이 일부 필드(상호·사업자번호·이메일·비번)에만 native `required` → 가입신청 클릭 시 브라우저 native 검증이 **required 없는 대표자/담당자 필드를 건너뛰고 첫 빈 required(=이메일)로 무조건 점프**. 커스텀 JS 순차검증은 native 가 submit 을 막아 **실행 자체가 안 됨**.
**수정**(`SupplierRegisterPage.tsx`, 도매몰 전용):
- `form noValidate` + 필드 ref 맵 → **화면 순서대로 JS 검증 + 첫 문제 필드로 포커스/스크롤**(이메일 점프 제거).
- 대표자/담당자 **성명·연락처 각각** 검증으로 분리(기존 묶음). 연락처는 `isValidKrPhone`(완성형 010-XXXX-XXXX만) → "010"·"010-9135" 미완성 차단(#1~5).
- 이메일 `isValidEmail`(TLD 필수) → "utonggori@naver" 통과 차단.
- #6 로그인 이메일 라벨 "이메일 (로그인 아이디)" + 힌트(위 담당자 이메일과 구분) / 담당자 이메일 라벨 "선택·연락용".
- #7 비밀번호 기준 상시 표시(입력 상태별 회색→amber→green: "영문+숫자 8자 이상").
- 검증: tsc 0 · theme/light-input guard 0 · build 0. 카카오 가입 모드(이메일/비번 스킵)·`/api/supplier/register` 페이로드·`sameAsRep` 복사 로직 불변.

## ✅ 2026-06-26 — 소비자(유어딜) 쇼핑 동선 전수조사 (대표 "일단 그래도 해줘") — 서비스 분리 준수
**범위(유어딜 공구 서비스만 — 도매몰 무관)**: 홈/교환권/공구/체크아웃/링크샵/마이/충전/알림 신규·빈·비로그인 계정 관점. 2개 에이전트 병렬 + 코드 재검증.
- **🔴 HIGH(크래시) 수정 — `UserGroupBuyCreatePage`(`/community-group-buy/new`) Rules of Hooks 위반 흰화면**: 자격(셀러/인플) 확인 전 `eligibleAsInfluencer===null` 1차 렌더가 훅 2개 호출 후 early-return → 자격 `true` 재렌더에서 useState 7+useEffect 호출 → React "Rendered more hooks" 크래시. **모든 훅을 early-return 위로 이동**. (현재 `COMMERCE_PROPOSAL_HIDDEN`로 진입 배너 숨김이나 직접 URL·언셸브 시 라이브.)
- **오탐 기각(코드 검증)**: `/seller/register` dead-nav 주장 → **실재 라우트**(seller.routes:85, 에이전트가 App.tsx만 봄). HomeProductsRail 카테고리 키 오류 → **죽은 코드**(MainHomePage 비라우팅 — 홈은 06-21부터 RestaurantMapPage). reward-ad-card 훅순서 → 무해(isNative 안정값). TossWidgetPayPage(잠금) → 클린, 무수정.
- **감사 클린**: 교환권 카탈로그/상세/구매(딜잔액 0·비로그인·initialDataUpdatedAt:0 '딜부족' 가드)·공구 상세/참여/충전·마이/주문/주소·링크샵/큐레이터·알림 — 빈/신규/0데이터 전부 가드(formatNumber·?? []·division guard). ₩NaN/dead-end 0.
- 검증: tsc 0 · dead-links/cross-role strict 0 · build 0. **소비자 쇼핑 동선 = 잠금파일 외 크래시 1건 수정·나머지 클린.**

## ✅ 2026-06-25 — 비운영자 사용자 에러 전수조사 + 수정 14종 (대표 "운영자가 아닌 다른 사람들이 이용했을 때 나올 에러 전수조사")
**배경**: 역할-한정 버그(슈퍼/운영자에겐 안 보이고 좁은 권한 사용자에게만 터짐) 런타임 전수조사. 5개 역할 finder(유저/사업자유저/B2B/RBAC/크로스커팅) + 정적 가드 직접 실행 → **과대보고 방지(코드 검증된 것만)** + **현재 main 재검증으로 batch1-5 에서 이미 고친 것 제거**.
- **P1 5종(2c7b647)**: S1 셀러 상품수정 시 식당연락처/PIN/공구목표 유실(PUT 화이트리스트→fail-soft per-field) · S3 식사권 등록 정가/좌표/지역 유실 · S2 셀러 정산표 전부 ₩0+날짜'오늘'(SELECT 실컬럼 매핑+healing) · B1 판매사 배송비 미표시→예치금 증발오인(3 SELECT+명세서+UI grand_total) · B2 에이전시 '매장 영입 현황' 토큰누락 401(인터셉터 분기).
- **P2 9종(ec913ba)**: B3 가입폼 5종 다크모드 입력 안 보임(force-light-theme) · S4 셀러 대시보드 dark:누수 37개 제거 · S5 딜환급 8.8% 하드코딩 제거 · S6 매출 캘린더 daily_revenue 추가 · B5 에이전시 배지 휴면 오표시(revenue_30d 영입매장 포함) · B6 제조사 발송대기 100상한 · M1/M2 크래시가드 · I1 선물 토스트 원시키.
- **부수(7e85b7c)**: 06-24 retarget 로 stale 된 `admin-wholesale-queue-nav.test.ts` sanity 2건 갱신(main 빨강 해소).
- **보류(대표 확인 필요)**: B4 prospect introducer_id=user.id vs 대시보드 agencies.id(커미션 귀속+데이터 마이그레이션) · R2 계정전환 admin_token wipe(의도적 보안 vs SPA 비대칭). 둘 다 결정 사안.
- **이미 수정됨/오탐**: R1(타일 dead-end → 06-24 distributor-approval retarget) · C1(EditorialProductCard null→"0원", NaN 아님).
- 검증: tsc 0 · vitest 2301 pass · sql-bind/column 0 · money-pattern 0 · light-input/theme ✅. 결제 잠금파일 무관. 미배선 fee-resolver 와 별개.

## ✅ 2026-06-24 — 에이전시 + 소비자 셀러 대시보드 전수조사 (대표 "모두 이상적으로" — 전 대시보드 완주)
**소비자 셀러 대시보드(/seller/*)**: ~70페이지 정독 → **클린**(신규 셀러 첫 렌더 dashboard→products→orders→settlements 전부 SQL COALESCE + JS `?? 0`, cross-role 0, dead-click 0; 에이전트가 자기 'high' 후보 2건도 직접 재검증 후 기각).
**에이전시 대시보드(/agency/*, 38p)**: pending 게이트 정상(로그인서 status 차단), 빈/0데이터 클린. 발견·수정 3종:
- **MED — 매칭추천 점수막대 영구 미표시**: cron(agency-seller-match)이 `match_reason` 을 JSON.stringify 저장 → 라우트가 문자열 그대로 반환 → 프론트가 `reason.tierScore` 읽으면 undefined → ScoreBar 안 뜸. `agency-match-suggestions.routes` 에서 JSON.parse 후 반환.
- **HIGH(역할-한정) — 에이전시 공동구매 페이지 협상/딜확정/실패처리 버튼 항상 403**: 백엔드 `/status`·`/confirm` 은 어드민(+식당주인) 전용 + 동네공구에 **에이전시 소유 개념 없음**(아무 에이전시가 아무 딜 확정 부적절). → 에이전시 페이지를 **브라우즈 + 식당 채팅(협상)** 으로 정리: '협상 시작'=채팅 열기로 재배선, 딜확정/실패처리 버튼·ConfirmModal·핸들러 제거. (확정은 어드민. 에이전시-딜 소유모델 도입 시 재배선 가능 — 대표 결정 대기.)
- **MED — '매장 영입 현황'(/agency/prospects)**: 처음엔 빈 화면이라 nav 제거했으나, **병행 세션(06-25 B2/B4)이 이 페이지를 에이전시 기능화 중**(401 인터셉터 + POST introducer_id→canonical agencies.id 매핑; 이메일로그인 에이전시는 동작, 카카오로그인 GET 매핑은 그들의 B4 보류) → **nav 제거 되돌림**(그들 방향 존중). 잔여 GET 매핑은 B4(대표 결정).
- 검증: tsc 0 · cross-role/links strict 0 · build 0. **사람이 쓰는 5개 대시보드 빈상태/런타임 정독 완료.** 공구 페이지 403 정리는 유지(병행 세션 무관 영역).

## ✅ 2026-06-24 — 도매 어드민·제조사·판매사 대시보드 전 영역 전수조사 (대표 "나 말고 다른 사람들이 썼을 때도 에러 없어야")
**방식**: 3개 대시보드 병렬 감사(도매 어드민 / 제조사 / 판매사+storefront), **"소유자(슈퍼·시드데이터)에겐 안 보이고 신규·대기·좁은권한 사용자에게만 터지는" 클래스** 집중 → 모든 발견 코드 재검증. 제조사·판매사 frontend 는 빈상태/대기/NaN 대비가 이미 견고(클린). 발견·수정:
- **🔴 CRITICAL(보안/머니) — 정지된 판매사가 만료 전 토큰으로 발주·충전 지속**: `/orders`·`/orders/confirm`·`/deposits/charge-request` 가 `sellerIdFrom`(서명만, status 미검사) 사용 + `requireAuth` 미경유 → 승인 후 정지/거부된 판매사가 30일 토큰으로 예치금 차감 발주·충전요청 가능(소유자는 도달 못 하는 상태). → 공유 가드 `isSellerBlocked(DB,id)`(reject-list: suspended/rejected/pending/banned/deleted, **approved/active 불변**, fail-open) 신설 + 세 엔드포인트 배선(confirm 은 Toss 캡처 *전* 차단 → 무단결제 방지).
- **🟡 MED — 전역검색이 도매 파트너를 바운스**: AdminLayout 검색이 `/admin/orders`·`/admin/users`(소비자 스코프)로 이동 → 도매 역할 RBAC 바운스(검색 먹통). 도매 역할엔 검색폼 숨김.
- **🟢 LOW ×3**: ① 제조사 이미지 업로드가 `role:'user'`로 오귀속(upload.routes `getRoleAndId` supplier_id 분기 부재 → uploads/user 네임스페이스 충돌·삭제 소유권 불일치) → supplier 분기 추가 ② AdminWholesaleQuotesPage `requested_qty.toLocaleString()` 무가드 → `Number(||0)` ③ '제조사 승인' 카드 `?status=pending` 딥링크 + AdminSuppliersPage URL status 소비(카운트↔목록 정합).
- **감사 클린 확인**: 제조사 대시보드(빈/대기/NaN/cross-role 전부 안전, /me·analytics·settlements 널세이프) · 판매사 storefront(pending=무토큰→락카드 정상, 빈카트/0예치금/빈명세 가드, wholesaleAuthSeg 가격분리) · 도매 어드민 23p(스코프·empty·dead-click 클린). 기존 3 정적가드 전부 0.
- 검증: tsc 0 · api-scope/nav/links 0 · theme 0 · sql-bind 0 · build 0. ⚠️ 정지 가드는 staging 없어 실거래 1회 확인 권장(정지 판매사 발주 403 / 정상 판매사 영향 0).
- **후속(대표 "전역?")**: ① 교차-역할 클래스를 **전역 결정론 가드**로 승격 — `check-dashboard-api-crossrole.mjs`(제조사/에이전시/판매사/어드민 668파일, 다른 역할 전용 `/api/*` 호출=403 차단) verify.yml strict, **위반 0**(에이전시 포함 전 대시보드 cross-role 깨끗 *증명*). ② 정지 가드 누락 1건 추가 발견·수정: `wholesale-plus.routes /subscribe`(Plus 구독=예치금 차감)도 status 미검사 → `isSellerBlocked` 배선(이제 발주·confirm·충전·Plus 4개 예치금-차감 엔드포인트 전부 가드). 정직: cross-role/dead-link/wholesale-admin-scope/nav 은 전역 결정론 잠금이나, **빈상태 크래시·count↔list 의미 불일치·money-status 패턴은 도매 표면 에이전트 샘플링(에이전시 빈상태는 미점검)** — 결정론 불가 영역은 샘플링 한계 명시.

## ✅ 2026-06-25 — 수수료 정책 단일 리졸버(SSOT) 구현 (미배선) — 대표 "구현부터 / 가장 이상적이고 영구적으로"
**배경**: 대표와 수수료 정책 4종 확정(`docs/design/product-ownership-model.md`) 후 "구현부터, 영구적으로". 기존 수수료 로직이 산재(`orders.commission_rate`~10%, `agency_commission_pct`=2%+₩30k, affiliate 5%, supplier margin)되고 **값도 확정정책과 불일치** → 정책을 **단 하나의 순수 리졸버에 박제** + **불변식 테스트로 영구잠금**.
- **신규(전부 비잠금 새 파일 — 결제 잠금파일 무접촉):**
  - `src/worker/utils/fee-resolver.ts` — `resolveOrderFees(ctx, rates)` **순수함수**(DB/시간 의존 0). 주문 1건 → {platform, agency, platformNet, promo, supply, ownerNet}. 4규칙 박제: ①3P=5%/1P=0% ②소개비=주인 자율(음수 가드) ③에이전시 GMV 1%(플랫폼에서, 실판매+시한, ≤플랫폼, per-agency override) ④제조가=별도 슬라이스. ownerNet 이 반올림 잔차 흡수 → **합 항등식 정확(±0)**. `assertFeeInvariants`/`negateBreakdown`(환불 역전 대칭)/`loadFeeRates(DB)`(settings 폴백).
  - `src/tests/unit/fee-resolver.test.ts` — **26 케이스**: 문서 예시(10,000원) 3종 정확 재현 + 4규칙 + 불변식 5종(전 조합 항등식) + 결정성/역전 + 입력방어.
  - `migrations/0283_fee_resolver_settings.sql` — 전용 네임스페이스 `fee_platform_pct_3p`=5 / `fee_agency_pct`=1 / `fee_agency_term_months`=24 (INSERT OR IGNORE 멱등, 산재 키와 충돌0).
- **불변(미접촉)**: `payment.routes.ts`/`toss-gateway.ts` 등 결제 잠금파일 전부, 기존 `creditOrderCommissions`/affiliate/supplier 산재 로직. **리졸버 미배선 = 라이브 영향 0.**
- 검증: tsc 0 · vitest 2296 pass(신규 26 포함) · money-pattern 0 · sql-bind 0 · schema-refs 0.
- ⏳ **다음(gated, 대표 승인 필요)**: 리졸버를 locked `payment.routes.ts /confirm` 에 배선 + 산재 커미션 통합. ⚠️ **경제 변화**(3P 10%→5%, 에이전시 2%→1%+24mo) 동반 → 스테이징 실결제 검증 필수.

## ✅ 2026-06-24 — 제조사 상품 등록 플로우 전수조사 + 발견 버그 수정 (대표 "제조사 상품 등록하는 부분 모든 플로우 전수조사")
**방식**: 3개 감사 에이전트(등록 UI/엔드포인트 · 어드민 승인 · 카탈로그/가격/정산) 병렬 → **모든 발견을 코드로 재검증**(과대보고 배제). 등록(POST/bulk/edit/price-change) · 어드민 승인(CAS/마진) · 카탈로그 노출(필터/가격/게스트가림/등급) · 정산(공급가 스냅샷·역전 대칭) 전 구간.
**감사 결론**: 가격산식·게스트 가격가림·정산(주문시점 스냅샷, drift 없음, 환불 역전 대칭)·노출필터·권한스코프(supplier-products=도매 스코프 in)·소유권 검사 전부 **검증 클린**. 발견·수정한 진짜 버그 3종:
- **H1(높음) — 거부/대기 상품 수정·재제출 UI 부재(막다른 길)**: 백엔드 `PATCH /api/supplier/products/:id`(수정 시 pending 재제출)는 완비됐는데 **호출하는 버튼이 없어**, 거부된 제조사 상품은 사유만 보고 고칠 길이 없었음. → `CatalogTab` 에 대기·거부 상품 '수정/수정 후 재제출' 버튼 + `AddProductModal` 수정 모드(editItem prefill · PATCH · 대량/상세이미지 입력 숨김 — detail_images 는 GET 미반환·PATCH 미처리라 유실 방지). `CatalogItem` 타입에 GET 이 이미 반환하던 편집필드 추가.
- **M2(중간) — 대량 경로가 마진0(권장가=공급가) 상품 통과**: 단건 폼은 권장가>공급가 강제인데 ① bulk CSV(`supplier-dashboard.routes.ts:445`)는 누락/동일가를 공급가로 폴백 ② bulk-price-change(`supplier-analytics:203` `<`) ③ `BulkPriceModal:41`(`<`)이 동일가 허용 → 팔 수 없는 마진0 상품 생성. **세 곳 모두 `>` 강제로 통일**(누락/동일가 행은 에러).
- **LOW — 이미 거부된 상품 재거부 시 '거부됨' 알림·audit 중복**: reject CAS `IN('pending','rejected')` → 이미 rejected 행도 매번 changes=1 → 알림 재발. `= 'pending'` 으로 제한(rejected=종단, 재제출은 공급자 PATCH 로). (`admin-products.routes.ts`)
- 보류(정직): 카탈로그 WHERE 가 승인 게이트를 `is_active`에만 의존(현재 정확 — approve CAS 가 둘 동시 set). Agent C 가 방어심화로 `supply_approval_status='approved'` 추가 제안(COALESCE로 byte-동일) — 핫쿼리라 별도 검토.
- 검증: tsc 0 · theme 0 · sql-bind 0 · build 0. ⚠️ staging 없어 거부→수정→재승인 E2E 1회 운영 확인 권장.

## ✅ 2026-06-24 — '판매사 승인 N명' 클릭 시 빈 목록(역할 데이터-스코프 미스매치) 근절 + 3번째 정적 가드 (대표 신고 + "이런 유관한 에러들 모두 전수조사")
**증상(대표 스샷)**: 도매 메인 대시보드 '판매사 승인 2명' → 클릭(셀러 관리)하면 "승인 대기 없음"(전체 0).
**근본원인**: 카운트는 in-scope `/api/admin/wholesale-overview`(is_distributor=1·status='pending')로 셌는데, 목적지 `/admin/seller-approval` 의 데이터 호출 `/api/admin/sellers`(segment=`sellers`)는 **wholesale 역할 RBAC 스코프 밖**(admin-rbac.ts:68 `scopedRoleCanAccess` → prefixes=[wholesale,partnership,distributor,supplier]·exact=[suppliers], `sellers` 불포함) → **403 → 빈 배열 → "없음"**. 슈퍼 어드민엔 안 보임(전권이라 목록 정상). 나-bounce 와 같은 역할-한정 클래스의 **데이터 레이어** 버전.
**전수조사(신규 정적 가드)**: `check-wholesale-admin-api-scope.mjs` — 도매 도달 24화면이 호출하는 모든 `/api/admin/*` 가 wholesale 스코프 안인지 단언. **위반 7건 전부 `/admin/seller-approval` 한 페이지**(목록/승인/거부/매장영입/사업자검증)였고 나머지 화면은 전부 in-scope.
**해결(스코프 격리 보존 — sellers 를 스코프에 넣지 않음)**:
- in-scope 엔드포인트 신설 `GET /api/admin/distributor/distributors/pending-approvals` + `PATCH …/:id/approval`(approve/reject, CAS pending-only 멱등, 감사로그, 판매사 알림) — segment=`distributor` → 도매 스코프 ✅.
- 신규 페이지 `AdminDistributorApprovalPage`(`/admin/distributor-approval`) — 도매 nav '🏭 도매몰·운영' 에 '판매사 승인' 등재 + 대시보드 '판매사 승인' 카드 retarget(`/admin/seller-approval`→`/admin/distributor-approval`). `WHOLESALE_EXTRA_ALLOWED_PATHS` 에서 `/admin/seller-approval` 제거(이제 도매가 안 감 — 소비자 셀러 페이지는 슈퍼/admin 전용).
- verify.yml strict 게이트 추가(STRICT_API_SCOPE) → 이 클래스 영구 차단.
**검증**: 3 정적가드(api-scope/nav-reach/links) 전부 strict 0 · tsc 0 · build 0 · sql-bind 0. ⚠️ staging 없어 실 승인 1회는 운영 확인 권장(승인 시 status pending→approved, 대시보드 카운트 2→0).

## ✅ 2026-06-24 — 보이지 않는(역할-한정) 네비 버그 근절: 2층 정적 가드 + 발견 버그 전부 수정 (대표 "애초에 없도록 / 다른 사람이 썼을 때도")
**문제 인식(대표)**: '상품 승인' 안 넘어감 → "왜 이런 보이지 않는 문제가 남아있나? 애초에 없도록 못 하나? 나 말고 다른 사람이 썼을 때도." **근본 원인**: 역할-한정 버그는 슈퍼/소유자(전체 권한)로 테스트하면 안 보이고, 권한 좁은 계정에서만 드러남 → 일회성 수정으론 클래스 못 막음.
**해결 = 기계가 모든 역할·화면을 검사(사람 QA 불필요), 2개 영구 가드 신설 + verify.yml strict:**
1. **`check-wholesale-admin-nav-reachability.mjs`**: wholesale-role 어드민 도달 26화면의 모든 `/admin` 링크가 그 역할 RBAC 로 열리는지 단언(못 열면 클릭 시 wholesale-overview 바운스). **이게 신고 안 된 버그 1건 추가 발견** → '도매 통합 현황 > 무결성 리포트' 카드(`/admin/wholesale-integrity`) 바운스 → `WHOLESALE_EXTRA_ALLOWED_PATHS` 에 추가.
2. **`check-internal-links.mjs`**: 전 앱(.tsx 680개)의 `to=`/`navigate(`/`href` 내부링크(타깃 833개)가 정의된 라우트(356개 매처, catch-all 제외)와 매칭되는지 단언. `:param`/`${}` 와일드카드, 서버경로(/api…)·정적파일 제외. **죽은 링크 7종(9곳) 발견 → 전부 수정**:
   - `/admin/sellers?id=` ×2(AdminUsers·TikTokDiscovery) → `/admin/seller-approval?status=all&q=<name>` (실재 라우트, 이름검색)
   - `/help/deal-guide`(GroupBuyGuideCard) → 죽은 링크 제거(해당 페이지 없음, 동작하는 '내 추천 링크' 유지)
   - `/my-orders/:id`(MyDealHistory) → `/my-orders`(주문상세 라우트 없음, 목록이 정답)
   - `/seller/youtube` ×2(StreamingSetup) → `/seller/youtube-growth`(실재 유튜브 허브)
   - `/stays/:id/reviews`(StayDetail) → 죽은 '전체 리뷰 보기' 제거(리뷰 전용 페이지 없음)
   - `/products`(미사용 레거시 `src/client` Layout) → `/browse`
**검증**: 두 검사 strict exit 0 · tsc 0 · build 0. **앞으로 죽은 링크/역할 바운스는 출시 불가(CI 빨강).** 감사 에이전트로 제조사 대시보드·도매 storefront 도 별도 정밀감사 → **검증 결과 0건(클린)**.
## ✅ 2026-06-24 — 도매 정산 지급일 확정: "금주(월~일) 발주 → 차주 목요일 00:00 KST" (대표 확정, 도매몰 전용 통일)
**대표 지시**: "금주 월-일 / 차주 목 정산으로 결정났어" + (AskUserQuestion 답) "도매몰에만 해당. 유어딜은 전혀 상관없어. **차주 목요일 통일** — 브랜드/일반 구분 없음."
- **변경** (`src/features/supply/api/wholesale-settlement.ts`, 비잠금 머니파일):
  - 신규 순수함수 `wholesaleSettlementAvailableAt(nowMs)` — 발주 epoch → **그 주(월~일 KST)의 다음 주 목요일 00:00 KST** 를 UTC ISO 로. KST(UTC+9) 주 경계 계산: `daysSinceMonday=(getUTCDay()+6)%7` → 이번 주 월 00:00 KST → **+10일**(=차주 목). 한 주 7개 발주일 전부 동일 목요일로 묶임.
  - `creditSupplierOnWholesaleOrder`: 기존 건별 **+7일(일반)/+1일(브랜드)** 롤링(`REFUND_WINDOW_DAYS`/`BRAND_REFUND_WINDOW_DAYS`) 제거 → 전 라인 `settlementAvailableAt = wholesaleSettlementAvailableAt(Date.now())` **통일**(isBrand 분기 폐지). note = "B2B 도매주문 — 차주 목요일 정산(금주 월~일 발주분)".
- **불변(미접촉)**: 성숙 cron `matureSupplierSettlements`(매일 18:00 UTC, available_at 경과 시 pending→available)·출금기반 지급(어드민 승인)·정산 라인 멱등(ON CONFLICT)·`available_at` 컬럼만 의미 변경. **소비자 정산(`supply-settlement.ts`) 완전 무관**(대표 지시대로 유어딜 제외).
- **회귀방지**: `src/tests/unit/wholesale-settlement-schedule.test.ts`(6 tests) — 월~일 7일 동일 목요일 묶임·차주 목 10일 오프셋·KST·결과 항상 목 00:00 KST. CI(verify.yml)에서 주 경계/요일/KST 깨지면 빨강.
- 검증: tsc 0 · vitest 28 pass(4파일) · build 0 · money-pattern 0 · sql-bind 0.

## ✅ 2026-06-23 — 도매몰(유통스타트) 전수 QA 스윕 + 자동 QA 2층 구축 (대표 "사람이 QA 안 해도 되게 / 빠짐없이")
**배경**: 대표가 도매몰 로딩·로그인 불안정 신고 → 반응형 패치를 넘어 **선제적 전수감사 + 자동 QA**로 전환. 감사 에이전트는 일관되게 과대보고 → **모든 발견을 코드로 재검증해 진짜만(라운드당 ~1건) 수정**(불필요한 머니/주문 코드 변경 방지).

**고친 진짜 버그/개선 (전부 배포):**
- **카탈로그 로딩**: `worker/index.ts` WHOLESALE SSR self-fetch 타임아웃 1.5→3s(콜드 스켈레톤 고착). 근본 enabler=**CACHE_KV 대시보드 바인딩**(대표가 연결 — prod-diag로 `x-ws-cache: KV-HIT` 확인).
- **상품상세 로그인 UI**: `useWholesaleProduct` 인증별 캐시키 분리(`wholesaleAuthSeg`) + `WholesaleProductPage` `locked=!token` — 로그인했는데 비로그인 UI 뜨던 것. 전 dual-mode 가격쿼리(catalog/premium/inline) 동일 적용.
- **뒤로가기**: `useWholesaleBack`(navigate(-1)+폴백) — 5개 페이지 하드코딩 `navigate('/wholesale')` 통일.
- **머니쿼리 에러삼킴**: `useWholesale.ts` 머니/트러스트 5훅 `.catch(()=>빈값)` 제거(잔액 ₩0 오표시·retry 무력화 해소). `useWholesaleMall` 폴백은 의도적 유지.
- **제조사 정산 라인 멱등화**: `wholesale-settlement.ts` 정산 INSERT `ON CONFLICT(order_id,product_id,source) DO NOTHING` + 라인별 changes 게이트(동시 같은-주문 under-credit 방지). UNIQUE 인덱스 self-heal(ensureSourceColumn+ensureOrderTables). 이중적립은 원래 UNIQUE로 차단됨(에이전트 "인덱스 부재" 오류).
- **가입/로그인 폴리시**: SupplierLoginPage 카카오 pending 안내 배너 + StaffLoginPage is_distributor 방어. 단일세션은 대표 요청 보안정책이라 유지.

**감사했으나 깨끗(과대보고 배제, 코드 재검증):** 가입/로그인 핵심·예치금 CAS·역전 대칭·멱등 환불·대시보드 refetch(의도된 로직)·채팅(IDOR/신원비공개)·게시판(XSS/마스킹)·세금계산서(멱등/fail-soft)·OEM(검증/null-safe). **마진 UI 신규**(미끼/마진 전략).

**자동 QA 2층 (사람 QA 대체):**
- **배포 전(CI verify.yml)**: 신규 단위테스트 — `use-wholesale-back`·`wholesale-invariants`(authSeg 분리·머니훅 에러삼킴 정적검사). 기존 머니/인증 40+ 테스트 + 18 정적게이트.
- **배포 후(prod)**: `.github/workflows/prod-smoke.yml` — 3시간 스케줄+`smoke-trigger` bump. 도매 카탈로그/SSR슬롯/게스트가격가림/소비자 핵심 불변식 **단언**(깨지면 빨강). prod에서 green 확인.
- **prod 실측 수단**: `.github/diag-trigger` bump → `prod-diag.yml`(read-only 측정, egress 우회).

**한계(정직)**: 실결제 E2E는 staging 없이 자동화 불가(결제/정산 로직은 단위테스트로 커버). 

**미뤄둔(대표 결정/자료 대기)**: 전자계약 **모두싸인→유캔싸인 전환**(다른 세션 결정 — 수정 계약서+UCanSign API 대기). 계약서 초안: `docs/legal/{판매사,제조사}-*.md`(법률검토 권장). ~~제조사 정산 요일~~ → **2026-06-24 확정: 차주 목요일**(위 항목).

## ✅ 2026-06-23 — `/vouchers` 연속 스크롤 + 중앙 스크롤스파이 탭 (대표 AskUserQuestion 승인)
**대표 지시**: `/vouchers` 상단 `[교환권][쇼핑]` 탭을 **중앙 배치**하고, "교환권 어느정도 내리면 쇼핑 상품들이 뜨길" — 한 페이지 연속 스크롤. AskUserQuestion 답: "연속 스크롤(추천)" + "교환권 20개씩 + 더보기 버튼, 그 아래 쇼핑".
- **변경** (`VouchersPage.tsx`, `[UNLOCK_LOADING]`): ① 탭바 **중앙 정렬**(검색 아이콘 우측 absolute), 탭 클릭 = **섹션 점프**(scrollTo/scrollIntoView), 활성 탭 = **스크롤스파이**(쇼핑 섹션 top≤100 감지). 콘텐츠 교체/URL `?tab` 전환 제거. ② 교환권 무한스크롤 → **20개 cap + '교환권 더보기'**(+20). ③ 더보기 **아래로 항상** 쇼핑 `<section>`(🛍️ 헤더 + 기존 `ShoppingGrid` 무한스크롤) 렌더.
- **불변(잠금 보존)**: `__SSR_INITIAL_VOUCHERS__` 첫 페인트·default sort `price_low`·VoucherRow/Card 이미지 속성·카테고리/브랜드 chrome. 홈(embedded)은 `!embedded` 게이트라 byte-동일.
- 검증: tsc 0 · theme-consistency 0 · mobile-viewport 0 · vite build 통과. CLAUDE.md audit log 기록.
- **후속(선택)**: 교환권 cap 개수(20)·쇼핑 섹션 lazy-mount(현재 항상 마운트, /api/products edge-cache 라 비용 미미) 조정 여지.

## ✅ 2026-06-24 — 로그인 속도 진단 + 잠금 + DB 최적화 (대표 "가장 이상적으로 해결")
**배경**: 카카오 로그인 느림 신고 → `/admin/kakao-login-diag` 진단페이지로 실측 확보(서버 4036ms = 토큰교환 661 + 사용자정보 269 + **DB 1642** + 나머지 ~1464).
- **진단페이지 접근(403/FORBIDDEN) 해결**: `/api/_internal/kakao-login-diag`(requireAdmin)는 브라우저 직접 진입 시 소비자 세션쿠키가 먼저 인식돼 403. → 어드민 대시보드 내 페이지 `AdminKakaoLoginDiagPage`(`/admin/kakao-login-diag`)가 `localStorage admin_token` 을 **Bearer 명시 첨부**(인터셉터 자동부착은 `/api/admin/*`·`/api/*/admin/*` 만이라 `_internal` 미해당)로 조회. auth 미들웨어가 Bearer 를 쿠키보다 먼저 검사 → 통과.
- **로그인 IP rate-limit '본인 잠금' 해결**: `rateLimit()` 미들웨어가 핸들러보다 먼저 돌아 성공/실패 구분 못 하고 모든 시도 카운트 → 관리자(5/5분)·셀러·에이전시(10/5분) 본인이 반복 로그인하면 전부 성공이어도 "요청이 너무 많습니다" 잠김. → `resetRateLimit(c, action)` 추가, 핸들러 **진짜 성공 지점**(비번/PIN 통과 후)에서 해당 IP 카운터 비움(waitUntil). 실패는 성공 지점 전 반환 → 누적 유지 → **brute-force 방어 불변**. admin/seller/agency 3곳 적용.
- **DB 왕복 6→4 (upsertUser, 대표 승인 — 동작 100% 보존)**: 기존 유저 로그인의 D1 왕복 축소. (1) `email_verified` UPDATE 를 프로필 UPDATE 에 병합(신규 유저만 별도). (2) same-email 셀러 자동연결의 dupe COUNT 를 별도 SELECT → **UPDATE WHERE 서브쿼리**로 합침(원자적 → TOCTOU race 제거). **프로필사진 CASE 보존·이메일 takeover 방어·자동연결 게이트(email 1명일 때만) 전부 byte-identical.** kakao unit 56 pass.
- **OIDC 작동여부 = 측정으로 확인**: 7일 평균 사용자정보 269ms 는 OIDC 켜기 전 옛 로그인이 섞여 왜곡 가능 → 진단페이지에 **'최근 로그인별' 표** 추가(기존 recent 데이터, 백엔드 무변경). 최신 로그인의 사용자정보 0ms(=OIDC ✅) vs 269(폴백) 를 로그인별로 직접 확인. **다음 단계**: 최신 로그인이 폴백이면 `parseIdToken`(id_token 에 `nickname` claim 없으면 null) / 카카오 콘솔 OIDC claim 설정 점검.
- 검증: tsc 0 · build 0 · kakao unit 56 pass. 커밋: 진단페이지 d352795 / 403fix 1637f53 / ratelimit b36ac6f / DB+OIDC진단 d652710.

## 🚑 2026-06-23 — 도매몰 가입(`/api/wholesale/register`) 500 근본수정: 자가치유 INSERT (대표 "더는 절대로 이 에러가 떠선 안돼")
**증상(대표 콘솔)**: `/api/wholesale/register` → 400(검증) + 409(중복) + **500**. 500은 가입 자체를 막음.
- **원인**: `sellers` 는 D1 한도(100) 근접 **97컬럼** + prod 스키마 드리프트로 일부 컬럼이 prod 에 누락 →
  핸들러의 inline `ALTER TABLE sellers ADD COLUMN`(swallow)이 (한도/transient) 실패 → 풀 INSERT 가
  '없는 컬럼' 참조로 **500**. (바인딩 17=17 정확, dispatchSignupContract fail-soft 확인 — 둘 다 무관.)
  `business_name` 은 NOT NULL(no-default)이라 최소 INSERT 에도 포함.
- **해법(KakaoAuthService.upsertUser 동일 자가치유)**: 풀 INSERT 실패 시 ① 이메일 UNIQUE→409 명확화
  ② 그 외 → **원본(0003) base 컬럼만 최소 INSERT**(username/email/password_hash/name/business_name/status) →
  나머지는 컬럼별 **fail-soft UPDATE**(누락 컬럼 무시). `registrationMallId.catch(()=>1)`. last_row_id falsy 면
  email 로 복구. → **스키마 무관 계정 반드시 생성 + 500 0.** 풀 INSERT 실패 사유 `console.error`(CF 로그)로 진단.
- 검증: tsc 0 · build 0 · sql-bind 17=17 · NOT NULL 가드 통과.
- ⚠️ **후속**: prod `/api/_internal/repair-schema` 1회로 누락 컬럼 영구 보강 권장. supplier `/api/supplier/register` 도 동일 패턴 점검 권장.

## ✅ 2026-06-20 (5차) — 카카오 로그인 OIDC fast path: getUserInfo 왕복 1회 제거 (대표 "모두 진행" — 보안 손해 없는 속도카드)
**목표**: 콜백의 카카오 왕복 2회(토큰교환+사용자정보) → **1회**. OIDC `id_token`(토큰교환 응답에 동봉)을
디코드해 sub/nickname/picture/email 획득 → 별도 `getUserInfo` 왕복 생략. **기대 절감 ≈ `avg_userinfo_ms`(~100~300ms)**, `getServiceTerms` 제거와 합치면 원래 3왕복→1왕복.
- **하이브리드(보안 보존)**: `KakaoAuthService.parseIdToken()` 가 필수 claim(sub·nickname) 없으면 null →
  콜백이 `getUserInfo` 로 폴백. id_token 미포함 필드(`is_email_verified`/phone)는 보수적 처리
  (email_verified claim 없으면 false → same-email 자동연결 게이트 안전하게 skip). 한글 닉네임 UTF-8 디코딩.
- **안전 롤아웃(env 게이트)**: `/start` 는 `KAKAO_OIDC_ENABLED` 켜질 때만 `scope=openid,account_email,profile_nickname,profile_image` 요청. **미설정이면 기존 동작 100% 동일(scope 미전송, getUserInfo 경로)**. 콘솔 OIDC 미활성 상태에서 openid 요청 시 카카오가 거부하므로 **반드시 콘솔 ON → env 플래그 ON 순서**.
- **신뢰성 무영향**: signed-state/establish/user_token/linked-role 코드 미접촉. id_token 은 TLS 직수신이라 서명검증 생략 가능(confidential client). 계측 신호: id_token 경로 시 `ms_userinfo=0`.
- **운영 활성화 절차(대표)**: ① developers.kakao.com → 카카오 로그인 → **OpenID Connect 활성화** ② 동의항목(닉네임/프로필/이메일) 확인 ③ Cloudflare Pages 환경변수 `KAKAO_OIDC_ENABLED=1`. → 다음 로그인부터 `ms_userinfo=0` 확인.
- 검증: tsc 0 · build 0 · parseIdToken 단위 9 pass. 코드: `KakaoAuthService.parseIdToken` / `kakao.routes.ts /start scope` + 콜백 폴백 / types `id_token`.

## ✅ 2026-06-22 — 링크샵 '상품·동네딜 추가' 전용 picker (대표 "상품/공구권 모두 선택하는 페이지가 나와야")
**배경**: 링크샵(`/u/{handle}`) 의 '상품·동네딜 추가하기' 가 `/browse`(상품) / `/group-buy`(동네딜) 로 흩어져 나가 핀 추가 동선이 이상적이지 않았음(대표: "/browse 페이지가 나오고 있는데 이상적이지가 않아"). → 한 화면에서 상품 + 공구권·동네딜을 탭으로 둘러보며 1탭 토글로 추가/제거하는 전용 picker.
- **신규 페이지** `src/pages/curator-page/LinkshopPinPicker.tsx` (route `/u/me/add`, ProtectedRoute requireUser — 본인만):
  - 탭 2개: **상품**(`/api/products?exclude_deal_only=1`) / **공구권·동네딜**(교환권 `?deal_only=1` + 동네딜 `/api/group-buy/products?status=active` id-dedupe 병합). 링크샵 핀 분류(`deal_only===1 || /voucher/i`)와 일치하게 상품 탭은 voucher 항목 클라 제외(탭 중복 노출 방지).
  - 현재 핀은 `curatorApi.getPinStats()` 로 `product_id→pin_id` 맵 로드 → 카드에 '추가됨'/'추가' 표시. 토글은 `curatorApi.addPin`/`removePin` 직접 호출(usePinAction 의 로그인 redirect·클립보드 흐름 불필요 — 이미 오너). 핀 상한(200) 토스트 가드.
  - 카드: cardGradient(대표색/seededColor 폴백) + cfImage + 핀 토글 배지(체크/플러스/스피너). 검색(상품명) + 상품 탭 '더 보기' page 누적. 다크 기본 + 라이트 토글(테마 일관성 0).
- **진입점 전환**: `CuratorPage.tsx` PinGrid 의 추가 CTA + EmptyLinkshop browseLink → `/browse`·`/group-buy` → `/u/me/add?tab=shop|voucher`. (잠긴 SSR/로딩 동작 무관 — 클라 라우팅 목적지 문자열만 변경.)
- 검증: tsc 0 · `npm run build`(client+ssr+worker+prepare) exit 0 · check-theme-consistency 0.
- **후속 1 — 삭제 500 버그 수정**: `pin_click_logs.pin_id` 가 `product_pins(id)` 를 ON DELETE CASCADE 없이 FK 참조 → 클릭된 적 있는 핀 DELETE 시 D1 FK constraint throw → 500. `curator.routes.ts` DELETE 핸들러를 자식로그 먼저→핀 batch(단일 트랜잭션)로 수정. 공유 엔드포인트라 PinCard·순서편집 삭제 모두 함께 수정. 적립(affiliate_earnings)은 무관 보존.
- **후속 2 — 카드 표준화(A안)**: picker 커스텀 PickCard → 표준 `BrowseProductCard` 재사용 + 핀 토글 오버레이("커스텀 카드 그만, 표준 카드 영구 고정" 규칙 준수, 디자인 영구 동기화). 카드 본문=상세 미리보기.
- **후속 3 — 토스트 리디자인**: 전역 `ToastContainer` 파스텔 색박스 → 단일 잉크 카드 + 컬러 아이콘(대표 "팝업 촌스러워"). 앱 전역 모든 알림 적용.
- **후속 4 — 즉시반영+코멘트+적립률+워밍**: ① 핀 추가/삭제 후 모듈캐시 무효화(`curator-page-cache.ts` 추출, picker 가 무거운 CuratorPage 청크 없이 import) → 링크샵 재진입 즉시 반영. ② 담은 직후 추천 코멘트(선택) 바텀시트(`updatePinNote`). ③ `ProductRepository` 목록에 `referral_commission_rate` 추가(dominant_color 가드 패턴) → picker '적립 N%' 배지. ④ picker 세션 모듈캐시(60s) 재진입 instant.
- **후속 5 — 사업자 링크샵 편집 UX 통일**: `SellerPublicPage` 기본 previewAsVisitor=true(방문자뷰 시작→'편집하기') + 네이비 배너 2종→뉴트럴/잉크 슬림 바(CuratorPage 동일, theme-dual). i18n 6개 언어. SSR/소유권 판정 불변. **→ 후속 6에서 previewAsVisitor 부분은 revert(대표 "원래 형태 아님")**.
- **후속 7 — 헤더 컴포넌트 단일화 (대표 "영구적으로 고쳐 / 이 형태로 통합")**: 근본원인 = 링크샵이 일반(CuratorPage/CuratorHeader)·사업자(SellerPublicPage/ProfileHeader) **두 페이지로 따로 자라** 매 디자인이 어긋남. 마지막 canonical 형태(`docs/design/linkshop-landing-redesign.md` "나브랜딩" 랜딩: 마퀴+풀블리드 배너+중앙 이름/태그라인/SNS+표준 BrowseProductCard)는 CuratorHeader 에만 있었음. **수정**: `SellerPublicPage` 가 `ProfileHeader` 대신 **`CuratorHeader`** 렌더 → 헤더 1개로 통일. 정체성은 **curator(users) 우선 · seller(sellers) 폴백 병합**(banner_url/name/bio/sns) → 저장 위치 분산(후속6 배너 이슈)을 흡수해 배너 복구. 소유자 인라인 편집은 CuratorHeader→`/api/curator/me/profile`(낙관적 `curatorEdits`). 본문 탭/상품등록/대시보드 chrome 보존. 카드는 잠금대로 BrowseProductCard. ⚠️ 미검증(라이브 접근 차단) — 대표 확인 필요. 남은 정리: 상품탭 EditorialProductCard→BrowseProductCard 수렴(showStats 고려), ProfileHeader.tsx 고아 파일 정리.
- **후속 6 — 사업자 링크샵 헤더 '원래 형태' 복원 (대표 신고 `/u/jiwon1228`)**: 사업자(연결셀러) 링크샵은 CuratorHeader 가 아니라 `ProfileHeader` 를 렌더하는데, 큐레이터 헤더 형태(맨 위 흐르는 마퀴 + 풀블리드 배너+그라데이션 + **동그라미 아바타 없음**)와 통일이 덜 돼 있었음(아바타 남음 + 마퀴 없음). 수정: ① ProfileHeader 동그라미 프로필 사진 제거(profile_image 데이터는 OG/썸네일 유지, 헤더 렌더만 제거 — CuratorHeader 와 동일) ② 맨 위 흐르는 마퀴 추가(CuratorHeader 마크업 재사용, 소유자 인라인 편집→`/api/curator/me/profile`) ③ 마퀴 데이터(linkshop_headline/accent)는 `users` 에 있으므로 CuratorPage→SellerPublicPage→ProfileHeader 로 props 전달(`curatorHeadline`/`curatorAccent`). 비-/u/ 진입(/profile·/s)은 데이터 없어 마퀴 미표시(graceful). 같은 세션 후속5의 previewAsVisitor=true 는 별도 revert(commit `bd8fe33b1`).

## ✅ 2026-06-22~23 — 동네딜 사용처리(redemption) + 선착순 + 흑백/PC 액자 (대표 다회 검증, "가장 이상적·안전하게")
**한 세션 다중 아크.** 설계 SSOT: `docs/design/dongnedeal-redemption.md`(북극성: "카운터는 신뢰로 통과, 돈은 정산에서 검문").
- **사용처리 Phase 1 ✅** — 소비자 셀프 사용: `POST /api/group-buy/vouchers/:code/self-redeem`(CAS `unused→used` 멱등) + `/cancel-redeem`(60초 + `settlement_id IS NULL` 가드) / 라이브 "사용완료" 화면 `VoucherRedeemModal`(실시간 시계·매장명·체크·60s 취소) / `MyVouchersPage` "현장에서 사용하기" / 매장 원장 읽기 `GET /store-voucher-ledger`. (`f2d3239`, `1a173ff`)
- **사용처리 Phase 2 ✅(차지백 클로백 제외)** — 에스크로는 **기존 `auto-settlement`(used 7일) 재사용**(신규 테이블 0, `settlement_id` SSOT). 분쟁 "안 왔어요" `voucher-dispute.routes.ts`(셀러 report/mine, 어드민 list/resolve settle|reactivate). ⚠️ `vouchers.status` CHECK 상 'disputed' 불가 → status='used' 유지 + **open 분쟁을 정산 cron 에서 제외**(`auto-settlement.ts` + `restaurant-settlement /calculate` 양쪽 `NOT IN (open disputes)`). 경량 "내 매장"(`/my-store`) — 셀러 대시보드 대신 앱 내(원장 요약+최근 공구권+신고). 어드민 `/admin/voucher-disputes`. (`29a14c4`, `1832388`, `5244289`)
- **선착순(FCFS) ✅** — 콜드스타트 시드 응모형(결제·사용처리 X). `fcfs.routes.ts`(공개/유저 apply/어드민 config·applicants·select+알림) + `AdminFcfsPage`(`/admin/fcfs`) + 소비자 배지/지원 + 내 매장 현황(`GET /store-fcfs` 셀러 스코프, `6b96bd3`). 설정 = `product_supply_meta` K-V, 지원 = `fcfs_applications`(1인 1회 UNIQUE).
- **checkout 종류 분기 ✅** — `noShipping = 모든 항목 deal_only=1 또는 isVoucherCategory(category)`(order-type SSOT) → 공구/교환권은 주소 불요(공구='매장 바로사용'·교환권='MMS'), 일반 쇼핑만 주소/배송비. (`b5d561c`)
- **흑백(B&W) + PC 액자** — tailwind config 색상 remap(브랜드 핑크/레드 → MONO, 기능 빨강만 유지) / PC = 중앙 모바일 액자 + 데코 거터 레일(`ConsumerFrameRails`) + 액자 안 하단 네비. 동네딜 홈 = 당근식 1줄 리스트 + 플로팅 "지도" 버튼(`RestaurantMapPage` list/map 모드), 지도 줌 근본수정(`didInitialFit` ref — 매 줌 re-fit 제거), 필터 리디자인(`FilterSheet` 2단 계층 지역 + 실시간 카운트, z-[10000]).
- **도매몰 어드민 라벨 — 명칭 역전 반영 완료 ✅**: `ec3cf17` 이 '판매사'→'유통사'(당시 CLAUDE.md 2026-06-21 규칙)로 바꿨으나, 직후 병렬 세션 `632f020`(대표 지시 "유통사→**판매사** 전면 역전")이 **코드 + CLAUDE.md 규칙 둘 다 되돌림** → 확정 명칭 = **'판매사 / 제조사'**(CLAUDE.md 2026-06-22, line 413~426; '유통사' 사용 금지). 내 ec3cf17 의 '판매사→유통사' 라벨은 무효화(현재 코드 = 판매사 — 대표 최신 지시 일치). 단 '제조사(공급사)'→'제조사' 괄호 제거는 새 규칙(괄호 병기 금지)과도 양립 → 유지.
- **남은 것(후속 결정)**: ① Phase 2 차지백 클로백 ② Phase 3(동적 신뢰 정산·리뷰 플라이휠·이상탐지/Sybil) ③ ⚠️ **대표/staging 실결제 E2E 1회**(구매→셀프 사용→7일 정산 / "안 왔어요"→보류→해소). 현재 동네딜 사용처리는 라이브 노출 전이라 영향 0.
- 검증: tsc 0 · 테마 일관성 0 · sql-bind 0 · `npm run build`(worker 포함) 0.

## ✅ 2026-06-21 — 마이페이지 정리(중복·통합) + 고객센터 전화번호 전체 비노출 + 약관 비즈니스모델 정합 (대표 지시)
**대표 지시**: ① `/user/profile` 마이페이지 너무 복잡 — 모을 건 모으고 없앨 건 없애기(AskUserQuestion: "중복·통합만(기능 유지)" + "흩어진 수익/추천 6곳 → 하나의 '내 수익·추천'"). ② 도움말 고객센터(전화) 비노출. ③ `/terms` 를 현재 비즈니스 모델과 정합. ④ `/privacy` 변경점 반영. ⑤ `/refund` + **전체**에서 고객센터 전화번호(0507-0177-0432) 비노출.
- **마이페이지 declutter** (`UserProfilePage.tsx` + sub): (a) 상단 ⚙️ 톱니 제거(옆 '프로필 편집' 알약과 중복, 설정은 하단 '설정' 그룹). (b) `CouponVoucherStats`(쿠폰/바우처 스탯카드) **삭제** — `ShoppingGroup` 의 쿠폰함/내 교환권 행과 같은 곳(/my-coupons·/my-vouchers)으로 가던 중복(카운트는 행에 유지). (c) **수익/추천 진입점 통합** — '더보기'에 있던 '인플루언서 활동(추천/정산, /influencer/settlement)'을 `EarningsGroup`('내 수익·추천' fold) 안으로 흡수 → 수익 surface 진입을 한 fold 로. (d) '더보기' 섹션 제거 → 배송지 관리/내 리뷰는 `ShoppingGroup`(쇼핑·이용내역)으로 흡수. (e) 도움말에서 고객센터(tel) 항목 제거 → 문의는 카카오톡 상담으로 일원화. **데이터/라우트/`useMyCounts`(useMyVouchers 재사용) 로직 전부 불변 — 표시 위계/중복만 정리.**
- **고객센터 전화번호 전체 비노출**: footer 3종(`SiteFooter`/`MobileFooter`/`GripFrameLayout`)·`SEO.tsx`(JSON-LD telephone→email)·`FAQPage`(전화 행 제거)·`PaymentFailPage`/`PaymentSuccessPage`(카카오톡 채널 안내로 — PaymentSuccess 는 Toss-lock 의 '비-결제 UI 문자열' 예외)·`RefundPolicyPage`(2곳)·`TermsOfServicePage`/`PrivacyPolicyPage` 사업자정보·`BusinessLandingPage`(tel→mailto)·`AgencyPartnerLandingPage`·`IntroducePage`·`email.ts`(이메일 풋터)·locale 6종(footerAddress/supportPhoneValue/externalTradeWarningDesc)·`terms-static.html`·`shipping-policy.html`. 연락은 **이메일(jiwon@ur-team.com)·카카오톡 채널**로 일원화. (정부 분쟁기관 hotline·택배사 번호는 보존.)
- **`/terms` 비즈니스모델 정합**(KR+EN): "라이브 커머스" 프레이밍 제거 → **공동구매(동네딜)·모바일 교환권/이용권·온라인 쇼핑·추천 링크샵·딜 포인트** 플랫폼으로. 정의(서비스/회원/사업자회원/구매자/딜)·제5조 서비스목록 갱신. **KT Alpha 교환권 B2B 정산 compliance 문구(제2조의2)는 substance 보존**(라이브 단어만 '서비스'로). `/privacy` 는 EN의 live-stream/broadcast 표현을 group-buy 로 정정 + 사업자정보 전화 제거.
- ⚠️ **법무 주의(대표 확인 요망)**: 전자상거래법상 사업자 정보의 '전화번호' 표시 의무가 있음 — 풋터/약관에서 전화번호를 빼면 형식 요건 미충족 소지(현재 이메일+카톡으로 대체). 추후 대표번호 재등록 또는 카톡채널을 공식 CS 채널로 명문화 권장. 또한 사업장주소가 약관/개인정보(서울 강남 도곡동) ↔ 통신판매업신고(부산 금정)·풋터 locale(부산 금정) **불일치** — 별도 확인 필요(이번 작업범위 외, 미변경).
- 검증: `npm run type-check` 0 · `check-theme-consistency.mjs` 0 · `npm run build`(client+ssr+prerender+worker+prepare) exit 0 · phone grep 0(테스트 negative assertion 제외).
- **추가 정리(대표 "더 이상적으로", AskUserQuestion: 명칭 SSOT + 쇼핑 소그룹화)**: ① 명칭 SSOT 위반 라벨 정정 — `CuratorEarningsCard` "크리에이터 콘솔"→"내 추천 수익", `ReferralEarnedCard` "referral 누적 적립"→"추천 누적 적립" / "인플루언서 referral 시작하기"→"상품 추천하고 적립받기", `ShoppingGroup` "내 단골 셀러/셀러별 알림"→"내 단골 가게/가게별 알림"(사람 지칭 '셀러' 제거, '셀러 대시보드'는 도구명이라 유지). ② `ShoppingGroup` 10개 평면 리스트 → **이용권·자산 / 관심 / 주문·배송 3 소그룹**(한 카드 안 sub-label+구분선, 데이터/라우트/카운트 불변). type-check 0·theme 0·build 0.
- **프로필 아바타 주황 깜빡임 수정 + 수익·추천 폴드 압축(대표 "남은 선택지도 다 진행")**: ① `UserProfilePage` 아바타 fallback `ui-avatars ...&background=random`(랜덤=주황 등) → 고정 B&W(`background=111827&color=ffffff&size=128`); `profileImage` state 를 `getUserProfileImage()`(localStorage 동기) lazy-init 으로 → undefined→set 깜빡임 제거. ② 수익·추천 폴드: `ReferralEarnedCard`/`CuratorEarningsCard` 큰 카드 → 컴팩트 행(데이터 hook/라우트 불변, 빈값 null), affiliate(`/user/affiliate`)·정산(`/influencer/settlement`) 버튼과 함께 **B&W `divide-y` 한 카드로 통합**. `MyReferralCard`(초대링크 복사 핵심)는 카드 유지하되 pink→B&W 톤 통일. **라우트 제거 0**(각 단일 진입점 — `/user/affiliate` 는 고아라 제거 시 재고아화). type-check 0·theme 0·build 0.
- **도움말 비중 축소(대표 신고)**: `UserProfilePage` 도움말/약관을 페이지 중간 InsetGroup(볼드 헤더+카드) → 최하단(로그아웃 다음) **점 구분 muted 텍스트 링크 footer**(카카오톡 상담/FAQ/약관/개인정보/배송정책 — 항목·경로 불변). 로그아웃↔회원탈퇴 간격 정합: `DeleteAccountLink` 자체 mt-8/mb-6 래퍼 제거 → 로그아웃 블록 `space-y-2` 안으로 이동(균일 8px). type-check 0·theme 0·build 0.
- **마이페이지 B&W 톤 통일 + 역할 그리드 명칭(대표 AskUserQuestion: "B&W 톤 통일+가독성 버그, 역할 진입 그리드 명칭 정리")**: ① 라이트모드 가독성 버그 수정 — `SellerSwitchInline` 셀러모드 pill + `UserProfilePage` 셀러 대시보드 전환 버튼이 `text-pink-300`(다크전용 연분홍)을 라이트/다크 공통 사용 → 라이트에서 옅은핑크 위 옅은핑크. 전자=뉴트럴 pill, 후자=잉크 filled(`bg-gray-900 dark:bg-white`). ② 잔여 핑크/퍼플/블루 액센트 전부 B&W: `TeamPointsCard` 충전(잉크 filled), `OrderStatusBar` 카운트(활성=잉크/0=뮤트, 기존 0=full-black 버그도 수정), `AccountControlsSection` 알림토글·버전 업데이트 버튼·업데이트 힌트·프로필 편집 모달(purple→잉크 ring+save), `SellerApplyModal` input focus border, `RoleCtaGrid` 대시보드 컨테이너/accent 텍스트(blue→뉴트럴). yellow/red 상태 pill(심사중/반려/탈퇴)은 의미색이라 유지. ③ 명칭 SSOT: RoleCtaGrid "사장님 입점"→"내 쇼핑몰 열기"(desc "사업자 등록 → 내 상품·공구권 판매"), "소속 셀러"→"소속 사업자". type-check 0·theme 0·build 0.
- **마이페이지 IA '내 자산 먼저' 재배치(대표 AskUserQuestion — "지금이 가장 이상적이냐" 후속)**: 소비자 본인 자산을 역할 전환 CTA 위로. 순서 `딜 잔액 → 주문현황 → 나의 이용내역 → 수익·추천(접힘) → 역할 진입 → 광고`. 기존엔 "추가 역할로 시작하기"(사업자/에이전시 되기 CTA)가 "나의 이용 내역"보다 위 → 소비자 주사용 동선(내 교환권/쿠폰/주문)이 전환 CTA 아래 묻힘. `OrderStatusBar`+`ShoppingGroup` 을 `TeamPointsCard` 직후로 이동(컴포넌트/데이터/카운트 불변, 순서만). type-check 0·theme 0·build 0.
- **마이페이지 마무리 정리(대표 "마저 정리하자")**: ① '내 링크샵'(/u/me, 모든 유저 보유) 을 RoleCtaGrid '추가 역할로 시작하기'(사업자/에이전시 되기 CTA)에서 분리 → 상단 그룹으로 승격(헤더 "내 역할 바로가기"→"내 바로가기", 항상 노출). 'become' CTA 군과 격 분리. ② 카드 좌우 여백 정합: `TeamPointsCard`/`reward-ad-card` `px-5`→`px-4`(다른 InsetGroup 과 가장자리 일치). ③ `RewardAdCard`(딜 버는 수단·**웹은 null 렌더, 네이티브 전용**) 를 딜 잔액 바로 아래로 이동(딜 economy 그룹핑; 웹 영향 0). 같은 카드 잔여 indigo 버튼→잉크 B&W. type-check 0·theme 0·build 0.

## ✅ 2026-06-20 (4차 — 전 역할 iOS 카카오 로그인 + 미래대비) — 역할 토큰 fragment 채널 (대표 "셀러/에이전시/도매 + 앞으로 추가될 서비스까지")
**배경**: 소비자(establish)는 고쳤으나, **셀러/에이전시/유통사가 카카오로 *돌아와* 대시보드 로그인** 시 역할 토큰을 `ur_pending_*` **transfer 쿠키**(cross-site 302 set)로 받아 → iOS WebKit 미영속 → 대시보드 로그인 실패(잠복).
- **전수조사 결과**: 깨지는 건 **`/sync/callback` 리다이렉트의 transfer 쿠키**뿐. **공급자(제조사) `create-from-kakao`·유통사 `become-distributor`/`login` 은 XHR(JSON 응답)이라 이미 iOS-safe**(same-origin 200) — 무변경.
- **근본수정(generic·미래대비)**: 역할 토큰을 **fragment(`#auth=<b64url(JSON)>`)** 로 전달(모든 브라우저 생존, 서버/Referer 미전송). 신규 SSOT `worker/utils/pending-auth.ts` `encodePendingAuth()`. `kakao.routes.ts /sync/callback` 이 `pendingLs` 맵 구성(seller_token/id/name/username/is_distributor, agency_token/refresh/id/name) → `#st`(소비자 establish 티켓)와 같은 fragment 에 합침. 클라 `auth-callback-bootstrap` 이 decode → **허용목록(`seller_`/`agency_`/`supplier_` 네임스페이스 + 명시 키)만** localStorage 이전. `ur_pending_*` Set-Cookie/read **전부 제거**. ud_* httpOnly(SSR GET 읽기)는 별개로 유지.
- **미래대비(핵심)**: 새 역할 로그인이 `/sync/callback` 에서 토큰 발급 시 **pendingLs 맵에 한 줄 추가**만 하면 자동 iOS-safe. 같은 네임스페이스면 클라 변경도 불필요. **CLAUDE.md 카카오 OAuth 룰에 영구 규칙 박제**(iOS 쿠키 영속 룰 — transfer 쿠키 금지, fragment/establish 필수). 토큰 값은 서명 JWT라 서버 검증 → fragment 위변조해도 가짜 토큰 통과 불가(envelope 비신뢰 OK).
- 검증: 신규 단위 `pending-auth`(round-trip·UTF-8 한글·허용목록 차단) + 기존 pass · tsc(client) 0 · `npm run build` 0. ⚠️ 실기기: iOS 사파리에서 카카오 로그인 후 셀러/에이전시/유통사 대시보드 진입 유지 확인.

## ✅ 2026-06-20 — 내 지갑(/my-vouchers) 흑백 iOS-클린 리디자인 (Claude Design handoff, 대표 결정: 단일 페이지 톤 리파인 + 지갑 4페이지 잉크 통일)
**배경**: 2026-06-20 대표 신고 "공구권 페이지 디자인이 심각해 … 너무 성의없어"의 후속으로 직접 모킹한 정식 리디자인 handoff(`478b54e2`). 시안 6화면(메인 공구권/지도/사용 모달/메인 교환권/빈 상태/설정). AskUserQuestion 결과 **스코프=단일 페이지(`MyVouchersPage`) 톤 리파인** + **액센트=지갑 4페이지 잉크 통일**. 지도/설정 전용 화면은 보류(현 토글·모달 유지). 시안 박제: `docs/design/my-vouchers-wallet-bw.md`(+`.dc.html`×2, 스크린샷). **병렬 세션의 main 흑백 전환(블랙앤화이트 #6b7280, 빨강만 유지)과 수렴 — 머지 시 지갑 토큰은 ink(#0A0A0A)+onAccent 채택(handoff 정합), 상태 점은 green(#16A34A, handoff 명시) 유지.**
- **`walletTokens.ts`**: `accent` 핑크(#EC4899)→잉크(라이트 #0A0A0A / 다크 #FFFFFF), `accentSoft`/`accentGradient` 동반, **`onAccent` 신설**(필 위 텍스트색 — 다크 invert). blast radius = WishlistPage CTA 2개·스피너 + MyVouchersPage 스피너 (ListRow 등 atoms 는 dead/미사용).
- **`WishlistPage.tsx`**: accentGradient CTA 2개 `text-white`→`tk.onAccent`(다크모드 흰 글자 안 보임 방지).
- **`MyVouchersPage.tsx`**: 상태줄 🟢점+빨강 D-N("가장 가까운 만료") / 식사권 카드 코드 회색칩+복사아이콘 / **QR 모달**(🟢 pulse 실시간시계 + 🟢 체크 "이미 결제 완료" 안내 + "매장 안내" 칩 + 공유/구매취소 2버튼 그리드 + 7일 환불 안내) / 교환권(KtAlpha) amber→뉴트럴 / 전화 배너·등록모달 잉크 / 빈상태 1·2·3 원형 잉크 스텝+블랙 CTA. (refunded 배지는 main 흑백 #6b7280 채택.)
- **결제/환불/취소/폴링 로직 byte-identical** — `handleSelfCancel`·status 조건·api 호출 불변, 시각만. 🔒 잠금 보존: VoucherMap lazy / qrcode.react lazy / useMyVouchers / useInvalidateMyVouchers.
- 검증: `npm run type-check`(0) · `check-theme-consistency.mjs`(0) · `npm run build`(client+ssr+worker+prepare, exit 0). i18n 신규키는 defaultValue 폴백(소비자 페이지 패턴, 기존 동일) — 추가 debt 0. 드래프트 PR #397.

## ✅ 2026-06-20 (3차 — 교과서 A 방식) — iOS 세션을 same-origin httpOnly 발급으로 전환 (대표 "a 방식으로 해줘")
**배경**: 2차(user_token Bearer)는 효과는 있으나 토큰을 **localStorage**에 둬 XSS 노출(OWASP 비권장). 대표가 **A 방식(httpOnly 유지)** 선택.
- **원인 재확인**: httpOnly `ur_session` 쿠키가 **cross-site OAuth 콜백 302 응답**에서 set 되면 iOS Safari/WebKit 이 미영속. (Chrome 정상.)
- **A 방식(교과서)**: 세션을 **same-origin 200 응답**에서 발급(first-party 쿠키라 iOS 영속). 흐름:
  1. `kakao.routes.ts /sync/callback`: 인증 결과를 담은 **단명(120초)·서명(HS256/JWT_SECRET)·purpose-scoped 세션 티켓**을 fragment(`#st=`)로만 전달(서버/Referer/로그 미전송). localStorage Bearer·`ur_pending_user_token` 발급 **제거**. POST `/api/auth/kakao/callback` 응답의 `user_token`도 제거(그 흐름은 이미 same-origin 200 set).
  2. `auth.routes.ts` 신규 **`POST /api/auth/session/establish`**: 티켓 verify(서명+120초 만료+purpose+uid) → `createSessionCookie()` 로 **httpOnly ur_session 을 200 응답에 Set-Cookie**(first-party → iOS 영속). 비인증 엔드포인트지만 **서명 티켓 자체가 CSRF/위조 방어**(별도 저장 불필요).
  3. `main.tsx bootApp`: `processAuthCallbackParams` 가 fragment 티켓을 `window.__urEstablishTicket` 에 stash → **렌더 전 await** 로 establish 교환(4초 타임아웃, 실패해도 렌더). 이후 모든 API 가 쿠키로 인증.
  4. `auth-callback-bootstrap.ts`: `#st` stash + localStorage 토큰 경로 제거(`#ut`/`ur_pending_user_token` 삭제). `didFreshLogin` health-wipe grace 유지(establish 전 ping 오탐 차단). 셀러/에이전시 대시보드 transfer 쿠키는 별개로 유지.
- **보안**: 세션 토큰이 **localStorage 에 없음**(httpOnly 쿠키만) → XSS 면역. 티켓은 120초 단명. **이게 이 문제의 정석**.
- 검증: 단위 43 pass(`kakao-user-token`→establish 티켓 검증으로 교체) · tsc(client) 0 · `npm run build` 0. ⚠️ **실기기 필수**: iOS 사파리 로그인 → 새로고침/탭이동 유지 + `/api/_internal/kakao-login-diag` 재시도 폭주 사라짐.

## ✅ 2026-06-20 (2차) — 카카오 로그인 "잠시 됐다 풀림" 근본수정: 소비자 user_token Bearer (대표 신고 "잠시 되다 안돼 / 둘 다 불안정")
**증상(1차 수정 후)**: signed-state 로 OAuth *완료*는 됐는데(로그인 "잠시" 됨), iOS(사파리·카톡 인앱)에서 **곧 다시 로그아웃**. 크롬은 정상.
- **근본 원인(아키텍처로 확정)**: 카카오 로그인은 `ur_session`(httpOnly·Lax) **쿠키 1개에만** 의존. iOS WebKit(사파리 ITP / 카톡 WKWebView)은 cross-site OAuth 왕복 후 이 쿠키를 **유실/비영속** 처리 → `/api/auth/session/health` 가 `session:false` → 클라(auth-callback-bootstrap + api.ts 401핸들러)가 로그인을 **wipe**. **이메일 로그인은 이미 `user_token`(localStorage Bearer)을 써서 이 문제가 없음** — 카카오만 미발급이 차이. (단일세션 enforcement 는 `deriveDashboardSeat`가 user→null 이라 무관함을 확인.)
- **수정(기존 인프라 재사용 — 이메일 로그인과 동일 패턴)**: 카카오도 `user_token` 발급 → Bearer 인증으로 쿠키 유실과 무관하게 지속. 4부:
  1. `kakao.routes.ts /sync/callback`: 소비자 `user_token`(JWT type=user, 30일) 발급 → `ur_pending_user_token` transfer 쿠키(JS-readable 60s, 셀러/에이전시 패턴과 동일).
  2. `auth-callback-bootstrap.ts`: transfer 쿠키 → `localStorage.user_token` 이동 + health 핑에 `Authorization: Bearer` 동봉.
  3. `auth.routes.ts /session/health`: 쿠키 없으면 **Bearer(user_token)도 세션 유효로 인정**(requireAuth 와 동일 우선순위) → 부당한 wipe 차단.
  4. `auth.ts clearAuthData('user')`: `user_token`/`user_refresh_token` 정리 추가(로그아웃 후 Bearer 잔존 버그 동시수정 — 이메일 로그인에도 있던 잠재버그).
- **효과**: iOS 가 `ur_session` 쿠키를 떨궈도 api.ts 인터셉터(line 322, 기존)가 `user_token` Bearer 자동 첨부 → requireAuth Bearer 우선 인증 → 401 없음 → wipe 없음. **쿠키는 그대로 유지(defense-in-depth), Bearer 는 ITP-immune 폴백.** 크롬/이메일 경로 불변(additive).
- **보안**: 소비자 토큰은 저권한 + CSP(nonce/strict-dynamic) XSS 완화 + 대시보드도 이미 localStorage 토큰 사용(허용된 모델). 30일 만료 = 세션 쿠키와 동일.
- 검증: tsc 0 · `npm run build`(client+worker+prepare) 0 · 전체 유닛 2170 pass · sql-bind/not-null 0.
- ⚠️ **실기기 검증 권장**: iOS 사파리 + 카톡 인앱 로그인 → 새로고침/탭이동/앱 재진입에도 **로그인 유지** 확인. `/api/_internal/kakao-login-diag` 로 ios success 지속 확인.
- **🔁 보강(PR #396, 같은 진단 기반 — 병렬 세션 수렴)**: 동일 진단(`had_state_cookie:1`·`signed_fallback:0`·iOS success 14/16·2~3분 16회 재시도)으로 같은 결론에 독립 도달. transfer 쿠키(`ur_pending_user_token`)는 **그 쿠키 자체도 cross-site 콜백 302 에서 set 되어 iOS 미유지 위험**이 있어, **URL fragment(`#ut=`) 전달을 추가**(fragment 는 어떤 쿠키 정책에도 안 걸려 항상 생존 — belt-and-suspenders). 또 `auth-callback-bootstrap` 의 **health-wipe 를 `user_token` 있으면 스킵**(health-Bearer 인정과 이중 방어) + `kakao-user-token` 단위테스트 + POST 콜백 응답에도 `user_token` 동봉. 클라는 fragment·transfer쿠키 **둘 중 먼저 오는 것**으로 localStorage.user_token 설정(중복 무해).

## ✅ 2026-06-20 — 카카오 로그인 iOS(Safari/WebKit) 실패 근본수정: signed-state fallback (대표 신고 "사파리/아이폰 안돼, 크롬은 돼")
**증상**: 카카오 "3초 시작하기" 가 iOS(사파리 + 카카오톡 인앱 webview, 둘 다 WebKit)에서 실패, **크롬(Blink)은 정상**. → 서버/설정 문제 아님(그럼 크롬도 깨짐) = **WebKit 특유의 OAuth 왕복 쿠키 처리** 문제로 확정.
- **근본 원인**: OAuth CSRF 가 `kakao_oauth_state`(HttpOnly·Secure·**SameSite=Lax**) 쿠키 1개에만 의존. iOS WebKit 은 cross-site OAuth 왕복(특히 **카카오톡 앱 핸드오프 → Safari 복귀**, ITP cross-site 쿠키 처리)에서 이 Lax 쿠키를 콜백에 안 돌려주는 케이스 → `/sync/callback` 이 `?error=oauth_state_expired` 로 로그인 실패. 크롬은 Lax 관대 처리라 정상.
- **수정 (`kakao.routes.ts`, 표준 signed-state 패턴)**: OAuth `state` 파라미터를 **JWT_SECRET 서명 self-contained 토큰**으로 발급(redirect/intent/nonce/30분 만료 동봉). 콜백의 **쿠키-부재 분기에만** `verifySignedState()` fallback 추가 — 쿠키 없이도 **서명 검증으로 CSRF·redirect·intent 복구** → 로그인 성공.
  - **Chrome 등 쿠키 정상 브라우저는 기존 쿠키↔URL state 바인딩 분기로 진입 → byte-identical(불변, 더 강한 CSRF 유지)**. 쿠키 형식 `state|b64redirect|intent` 유지(state 부분만 UUID→서명 JWT, '|' 미포함이라 split 안전).
  - **보안**: 서명(HS256)이라 JWT_SECRET 없이 위조 불가 + 30분 만료 + nonce. 쿠키-부재 fallback 은 표준 signed-state CSRF 모델(쿠키 바인딩보다 약간 약하나, iOS 전체 로그인 불가보다 훨씬 나음). JWT_SECRET 없으면 opaque UUID 폴백(기존 쿠키-only 동작).
- 검증: tsc 0 · `npm run build`(client+worker+prepare) 0 · 신규 단위 10(서명 왕복/위조차단/변조/만료/purpose불일치/레거시UUID/open-redirect clamp) + 기존 safeRedirect 32 = 42 pass · 전체 유닛 2170 pass. CLAUDE.md OAuth 룰("쿠키+URL state 검증") 준수 — 쿠키 유지 + 서명 강화.
- 🩺 **진단 로깅 추가(대표 승인 "네, 추가해주세요")**: `kakao-login-diag.ts`(신규 `kakao_login_diag` 테이블, ensureXxx WeakSet 메모이즈, ~2% 확률 prune→최근 3000개, PII 미저장) + `/sync/callback` 4개 결과지점에 fire-and-forget 기록(성공/oauth_state_expired/mismatch/session_cookie_failed — 브라우저종류·ios·쿠키유무·signed_fallback 플래그). 조회: `GET /api/_internal/kakao-login-diag`(requireAdmin) — ios_summary(성공/실패) + `signed_fallback_successes_7d`(쿠키유실을 서명 state 가 구제한 건수) + browser별 aggregate + recent 100. **수정 효과 수치 확인 + 재발 즉시 감지.** fail-soft(진단 실패가 로그인 불막음).
- ⚠️ **실기기 검증 권장**: iOS Safari + 카카오톡 인앱에서 "3초 시작하기" → 로그인 성공 확인. 그 후 `/api/_internal/kakao-login-diag` 로 ios_summary success↑ + signed_fallback_successes_7d>0 확인.

## ✅ 2026-06-20 — 카카오 로그인 전수조사 후속: 인앱/세션/콜백 5종 (대표 "전수조사 → 전체 수정", A1 중복 제거 재정렬)
**배경**: 위 A1(signed-state)은 **다른 세션이 먼저 main 에 머지**(중복). 본 항목은 같은 전수조사에서 발견된 **A1 외 고유 이슈 5종**만 정리(PR #396 rebase 시 중복 A1·`kakao-oauth-state.test.ts` 제거, kakao.routes.ts 는 main 의 signed-state 채택). **검증**: 전체 단위 pass · tsc(client) 0 · `npm run build` 0. ⚠️ 실기기 staging 검증: `docs/KAKAO_LOGIN_STAGING_CHECKLIST.md`.
- **A2** `auth-callback-bootstrap.ts`: `?login=success` 로 막 진입한 로드에선 **health-wipe 1회 grace**. 세션 쿠키 propagation race 또는 Safari 가 redirect Set-Cookie 드롭한 순간 health 핑이 `session:false`→localStorage wipe→**"로그인 직후 자동 로그아웃"** 발생하던 것 차단(다음 로드/첫 API 401 에서 자연 정리).
- **A3** `in-app-browser.ts`+`index.html`: `isIOS()` 에 iPadOS 13+ 데스크톱 UA(Macintosh+`maxTouchPoints>1`) 추가 — iPad 인앱 외부열기 경로 정상화.
- **C1 (카톡 안드로이드 빈 화면)** `index.html` 인라인: Android intent 에 `S.browser_fallback_url` 누락 → Chrome 미설치(삼성인터넷 기본) 단말 빈 화면. `in-app-browser.ts`는 2026-06-17 에 고쳤지만 **인라인이 먼저 실행돼 공유 가드 키 선점→고친 버전 dead**였음. 인라인도 fallback 추가(형식 일치).
- **C2** index.html 인라인 ↔ `in-app-browser.ts` SSOT 일치 + 교차참조 주석(가드 키 공유 계약 명시). **스코프(카톡=자동, 그외=배너) 변경 없음** — intent 형식만 통일.
- **C3** `KakaoCallbackPage.tsx`: 토큰교환 `redirect_uri` 를 페이지 실제 경로(`/auth/kakao/callback`)와 일치(기존 `/sync/callback` 불일치=KOE006 지뢰). 주 흐름은 서버 `/sync/callback`이라 휴면 버그였지만 SPA 경로로 code 오면 실패하던 것 제거.
- **봇/지역 오해 배제**: 카톡 인앱 UA(`KAKAOTALK`)는 SSR 봇경로(`BOT_UA_REGEX`=`KakaoTalk-Scrap`만)·`botProtection`(legit 통과) 영향 없음. 지역은 hostname 기반이라 사파리 무관 — 전수조사로 확인.

## ✅ 2026-06-19 — 어드민 제품별 플랫폼 마진 설정 UI: 미끼/마진 전략 (대표 "응 이렇게 정확하게 진행해줘")
**요청**: 제조사가 등록한 상품을 검수할 때 **공급가·판매가·시중 최저가**를 보면서 **제품별로 우리 마진%를 정해 승인**(미끼상품=수익 하 / 마진상품=수익 상 — 항공권식 전략). 모든 가격 부가세 포함, 공급가 위에 우리 10%(조율 가능).
- **모델 확정(불변)**: `distributor-pricing.resolveDistributorPrice` 가 이미 cost-plus(`유통사가 = round(공급가 × (1+마진%))`, 판매가 상한·공급가 하한) + 단일가(등급은 노출 큐레이션 전용). **가격/정산 엔진 무변경** — 어드민 마진 설정 컨트롤만 추가.
- **백엔드** (`admin-products.routes.ts`): ① GET `/supplier-products` SELECT 에 `supply_margin_override_pct` 추가 + 응답에 `default_margin_pct`(전역 기본=`wholesale_platform_commission_pct`). ② PATCH `/supplier-products/:id` approve 가 `margin_override_pct` 동시 수용(같은 CAS UPDATE, undefined=미변경/null=전역기본/0~90=설정). ③ 신규 `PATCH /supplier-products/:id/margin` — 승인 무관 단독 조정(승인된 상품도) + 산출 공급가·우리 마진 응답 + audit. `normalizeMarginOverride` 헬퍼로 검증 일원화.
- **프론트** (`SupplierProductsTab` + `AdminProductsPage`): `공급자 등록 상품` 탭 각 카드에 **MarginEditor**(공급원가·판매가·네이버 최저가 옆) — 프리셋 칩(미끼 3% / 기본 N% / 30% / 50%) + 마진% 입력 + **실시간 유통사 공급가·우리 마진** 미리보기(판매가 상한 도달 경고) + `마진 저장`. **승인 클릭 시 입력 마진 함께 반영**. `distributorPriceFromCost` 클라 재사용(SSOT 동일 공식).
- **가이드**: `guide-seed-wholesale.ts` "제품별 플랫폼 마진 설정 — 미끼/마진 전략" 섹션 갱신(위치·산출식·정산·API). 검증: tsc 0 · 정산 단위 4/4 · `npm run build` 0(client+worker+prepare).

## 🎯 2026-06-18 — 사업자 유저 타겟 포지셔닝 메모 (대표 방향, 코드 미변경)
대표 방향: **사업자 유저의 메인 타겟 = "자신의 쇼핑몰을 갖고 싶은 유저"**. `/u/{handle}` = 본인 쇼핑몰, **본인 상품이 주인공**, 공구권은 부가 채널. AskUserQuestion 결과 "지금은 방향만 메모" → 코드 변경 없이 SSOT 문서(CLAUDE.md 명칭 SSOT · SERVICE_MODEL.md)에 기록만. **다음 구현 시 적용 후보**: ① 진입 문구 "사업자 등록"→"내 쇼핑몰 열기"(등록은 그 안 1단계) ② 승인 사업자 상점(SellerPublicPage) 기본/첫화면 상품 우선·공구권 보조탭 ③ 빈 상점 문구 "내 쇼핑몰에 첫 상품을 올려보세요".

## 🏬 2026-06-18 — 멀티-몰 "몰=도메인=계정" 확정 + `resolveMallId` host-first 전환 (대표 결정: 유통사/제조사 몰별 별도 로그인)
**결정**: flip-flop 의 뿌리가 멀티-몰 모델 애매함. 대표가 "유통사/제조사는 몰별 별도 로그인 = `1 몰=1 도메인=그 도메인 계정·카탈로그`" 확정. 설계 박제: `docs/design/multi-mall-auth.md`.
- **Step 1 완료(이번 커밋)**: `wholesale-malls.ts resolveMallId` **account-first → host-first**. 우선순위 `?mall=slug > host > 1` (계정 토큰은 mall 결정에서 제외, `accountMallId()` 제거). 게스트/로그인 카탈로그 **일관성 확보 → flip-flop 종류 버그 제거**. **단일 몰(1)+단일 호스트 = byte-identical(모두 1) → INVARIANT 유지**. 머니(예치금/주문/정산)는 seller_id/supplier_id 격리라 무영향. 신규 유닛테스트 3개(토큰 있어도 host 우선·게스트=로그인 동일·supplier 동일) → 33 pass.
- **Step 2 (몰 2개째 만들 때, 미완)**: 로그인 도메인 몰 스코핑 + 전역 UNIQUE(email/kakao_id)→(몰,email) 재설계(데이터 마이그레이션 동반, 별도 PR). 현재 활성 몰 1개라 불필요.
- ⚠️ **단, host-first 는 "몰 불일치" 종류만 고침.** 현재 0개가 `is_active`/`visibility`/`supply_price` **데이터** 때문이면 별개 — 아래 진단 1회 필요(egress 또는 🩺 패널).

## ✅ 2026-06-18 — 링크샵 랜딩 리디자인 (나브랜딩 시안, 대표 "응 다 해줘 가장 이상적으로")
**배경**: `/u/{handle}`(CuratorPage/CuratorHeader)를 "독립 브랜드 랜딩"으로. 시안 박제: `docs/design/linkshop-landing-redesign.md`. 3단계 구현(branch `claude/charming-sagan-y9hx6m`).
- **Stage 1 (backend, commit 636df2e7f)**: `users.linkshop_headline` 컬럼(마퀴) — `curator.routes.ts` ensureUserProfileCols + repair-schema 등록. GET `/api/curator/:handle` 응답에 `headline`(별도 best-effort 쿼리 — 컬럼 누락 env 에서도 메인 SELECT 안 깨짐, null 폴백). PATCH `/me/profile` 에서 `headline`(80자) 수용. `banner_url` 은 기존 수용/반환 재사용.
- **Stage 2 (CuratorHeader 리디자인)**: ① 최상단 **마퀴 바**(seamless `@keyframes marquee` in index.css, `linkshop_headline`, 소유자 인라인 편집, prefers-reduced-motion 존중) ② **풀블리드 16:9 배너 히어로**(banner_url, 공유 오버레이/소유자 배너 업로드 1440px·0.4MB/그라데이션 폴백) ③ **동그라미 아바타 제거** — 배너가 정체성(profile_image 데이터는 OG/핀용으로 유지, 헤더 렌더만 제거) ④ 이름/태그라인/SNS **중앙 정렬**. 소유자 편집(이름/소개/SNS/핸들/헤드라인)·방문자 공유 전부 보존. `CuratorProfile` 타입 `headline` 추가.
- **Stage 3 (PC 표현)**: `LinkshopMobileQR.tsx`(qrcode.react **lazy**, xl+ 우하단 gutter "모바일로 보기") + `MobileAppLayout` `LINKSHOP_PREFIXES`(`/u`·`/profile/`·`/s/`) 로 **PC 좌측 사이드바 숨김**(프레임 중앙정렬은 유지 — HIDE_SIDEBAR 와 달리 풀너비 안 만듦).
- 검증: tsc 0 · `npm run build`(client+ssr+worker+prepare) exit 0 · 테마검사 통과.
- ⚠️ **운영 반영 전**: prod `/api/_internal/repair-schema` 1회 실행(`users.linkshop_headline` 생성). 미실행이어도 GET headline 은 try-catch null 폴백이라 안전(마퀴만 숨김).

## 🩺 2026-06-18 — 도매몰 카탈로그 "0개 + 느림 + 들쭉날쭉" 전수조사 + 관측 계측 (대표 "더이상 일어나선 안돼") — ⚠️ 데이터 원인 ground-truth 필요
**증상**: ①상품 0개("해당 조건 상품 없어요") ②거기까지도 2초+ 느림 ③때때로 떴다 안 떴다(flip-flop). admin엔 보임=데이터 존재.
- **전수조사 결론 — 코드 버그 없음**: 카탈로그 WHERE(`is_supply_product=1 AND is_active=1 AND supply_source_id IS NULL AND supply_price>0 AND mall_id=? AND visibilityWhere`)·`visibilityWhere`·source=0→NULL 정규화 UPDATE·SELECT 컬럼 vs ensure 커버리지(전 컬럼 ensure가 ALTER ADD — 누락 0) **전부 정상**. → 0개는 순수 **데이터 상태**.
- **0개 유력 원인(코드로는 판별 불가, 우선순위)**: ①**mall_id 불일치** — `resolveMallId` 1순위가 `accountMallId`(로그인 계정 `sellers.mall_id`). 계정 몰 ≠ 상품 몰(기본1)이면 **로그인 시 0개**, 로그아웃(게스트)=host/기본1 → 상품 노출 → **flip-flop이 간헐 자동로그아웃과 맞물림**. ②visibility(게스트는 ALL만, 로그인은 +허용목록). ③is_active=0 / supply_price=0.
- **느림 = 0개의 결과**: 빈 결과는 `no-store`(빈그리드 고착 방지 incident rule) → 캐시 0 → 매 요청 풀경로(콜드 isolate+ensure+조회×2). 게다가 **SSR이 빈 카탈로그를 최대 1500ms 블로킹**(worker/index.ts:564 self-fetch) 후 클라가 또 fetch(`retry:2`, 1s+2s 백오프) → 체감 2초+. **0개를 풀면 캐시 살아 SSR edge-hit(~5ms)+클라 refetch 소멸 → 빨라짐.**
- **계측 추가(이번 커밋, additive·safe)**: `wholesale.routes /catalog` 응답에 **진단 헤더** — `X-WS-Mall`(해석된 몰)·`X-WS-Total`(WHERE 통과수)·`X-WS-Guest`·`X-WS-Vis-Restricted`. **total===0일 때만** 추가 COUNT 2개로 `X-WS-Total-NoMallVis`(mall/vis 무시)·`X-WS-Supply-Raw`(전 공급상품). **정상 경로 추가쿼리 0**. 조기 빈 분기엔 `X-WS-Reason`(schema-missing/premium-guest).
  - **판별표**: Supply-Raw>0 & NoMallVis=0 → 원인=is_active/source/supply_price · NoMallVis>0 & Total=0 → 원인=**mall 또는 visibility** · X-WS-Mall 값으로 몰 확정.
- **남은 액션(택1, 환경 제약으로 미완)**: ① 도매몰에서 F12→Network→`catalog` 응답헤더 `X-WS-*` 캡처 ② `/admin/wholesale-import` 🩺 진단패널 실행+캡처 ③ `live.ur-team.com` egress 허용 → 내가 직접 확정+1커밋 수정. **소비자 자동로그아웃 fail-safe(2026-06-17)로 flip-flop 트리거는 이미 완화.**
- 검증: tsc 0 · build 0 · sql-bind 0 · schema 0.

## ✅ 2026-06-18 — 주문내역(/my-orders) 무신사 스타일 리디자인 (대표 시안 2장 + "A로 진행")
- **결정 A**: 종류 탭(전체/상품/교환권/공구) + 종류별 카드. 한 `orders` 테이블에 상품/교환권/공구가 섞여 있고(group-buy.routes 가 교환권·공구도 INSERT INTO orders) 카드 레이아웃이 달라야 해서 선택.
- 분류 SSOT 신규 `src/shared/order-type.ts` `getOrderKind()` (product-flow.ts 정합: deal_only→교환권 / group_buy_status→공구 / else→상품).
- **Phase0 데이터 버그 3건 동반수정**: ①상품별 "0원"(price_snapshot 직접곱) → `orderItemLineTotal()` ②썸네일 누락 → `order.repository.ts findItemsGrouped` 에 `product_image`+products JOIN ③배송비 하드코딩 3,000원 → `order.shipping_fee` 실값.
- UI: `OrdersTab.tsx` 전면개편(검색+종류탭+날짜그룹+썸네일+종류별카드), `MyOrdersPage.tsx`(large title+스켈레톤), `OrderDetailModal.tsx`(결제 라인분해+썸네일+교환권/공구 배송섹션 숨김).
- 검증: tsc 0 · build 0 · OrdersTab 단위 12 pass · guard(schema/sql-col/sql-bind/theme/col-budget/money) 전부 통과. 시안 박제: `docs/design/my-orders.md`.
- **구매 내역 삭제(숨김) 추가** (2026-06-18, "삭제/숨김 기능만 필요"): 실제 DELETE X → side table `hidden_orders`(self-healing ensureXxx). `POST /api/orders/:id/hide`(requireAuth+IDOR+종료상태만), `findByUserId` 가 `NOT EXISTS(hidden_orders)` 로 목록/카운트 제외. OrderDetailModal 하단 "구매 내역 삭제" 버튼.
- 미구현(추후 결정): 프로모 배너 / 받은 혜택 섹션(결정 #2~#3). ⚠️ worker 조회쿼리 변경 → staging 에서 상품/교환권/공구 각 1건 표시 + 숨김 후 목록 제외 확인 권장.

## ✅ 2026-06-18 — 도매몰 예치금 입금계좌 3곳 반영 (대표 제공: 우체국 014084-02-129530 송유미/사람과고리)
유통사가 예치금(선불 충전)을 송금할 도매몰 입금계좌를 세 군데에 노출. 외부망(egress) 차단으로 prod API set 불가 → 코드/DB fallback 으로 배포 즉시 반영.
- **① 어드민 설정칸**(`AdminWholesaleDepositsPage`): `/admin/wholesale-deposits` 상단 '예치금 입금 안내 계좌' 입력칸 신규(기존 GET/PUT `/api/admin/wholesale-deposit-account` 연결). 어드민이 수정 가능.
- **② 유통사 입금 페이지**(`WholesaleDepositPage`): 기존 `depositAccount` 표시 블록(복사 버튼)에 자동 노출 — `useWholesaleDeposit` → `wholesale-deposit.routes` 가 `loadWholesaleDepositAccount` fallback 사용.
- **③ 하단 회사정보란**(`WholesaleFooter.BUSINESS_INFO.bankNo`): 이전 세션 TODO('계좌번호 추후 제공')였던 `bankNo` 채움 → '무통장 입금 우체국 014084-02-129530 예금주 사람과고리(송유미)' 자동 노출.
- **반영 방식**: `wholesale-main.routes.ts` 에 `DEFAULT_WHOLESALE_DEPOSIT_ACCOUNT` fallback(admin GET + `loadWholesaleDepositAccount` — DB 미설정 시 기본값, 어드민 저장값 우선) + `repair-schema` platform_settings INSERT OR IGNORE 시드. 공개 표시 목적이라 코드 포함 OK(대표 명시 지시).
- 검증: tsc 0 · build 0 · schema-refs/테마 clean.

## ✅ 2026-06-17 — 소비자(유저) 자동 로그아웃 근본수정: 401 핸들러 fail-safe (대표 신고 "계속 유저 로그아웃")
**신고**: "뭔가 계속 자동 로그아웃, 특히 유저(소비자)." 전수조사 결과 **`lib/api.ts` 소비자 401 핸들러가 fail-OPEN-to-logout** 이었음.
- **결함**: 401 시 `/api/auth/session/health` 로 세션 확인하는데, **헬스 요청이 네트워크/타임아웃/5xx 로 실패하면 `catch {}` 가 삼키고 그대로 `clearAuthData('user')`** → 로그아웃. 즉 "세션이 죽었다"가 아니라 "확인을 못 했다"인데도 소비자 세션을 지움. 헬스 일시오류·느린 응답·듀얼유저(대시보드 토큰이 `/api/notifications` 등 비-`_isDashboardUrl` 호출에 붙어 401 SESSION_SUPERSEDED → 소비자 흐름 fall-through) 에서 부당 로그아웃.
- **수정(fail-safe)**: **세션이 죽었다는 확정 증거(`health.data.data.session === false`) 가 있을 때만 로그아웃.** 헬스 실패(catch)·확정 불가 시 → 세션 유지(이 API 자체 권한/일시 문제로 간주, reject만). 진짜 만료(session:false)는 그대로 로그아웃(정상). `parseSessionCookie` 가 'user' 쿠키 우선이라 멀티쿠키는 무관 확인.
- **참고**: `auth-callback-bootstrap` 자가점검은 이미 fail-safe(명시 session===false + r.ok 일 때만 wipe). api.ts 핸들러만 결함이었음.
- 검증: tsc 0 · `npm run build` exit 0. ⚠️ 실 로그인 모니터링 권장(Sentry breadcrumb `Buyer 401: session unconfirmed — keep` 추가로 추적 가능).
## ✅ 2026-06-30 — 대시보드 무한로딩(배포 후 옛 청크 MIME 에러) 영구수정 (대표 신고 "어드민/에이전시 안 켜짐, 절대 발생하면 안됨") `[UNLOCK_LOADING]`
**증상**: `/admin`·`/agency` 무한 로딩. 콘솔: `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"` (`app-features-DWIZ3X9w.js`).
- **근본 원인(2겹)**: ① 새 배포마다 청크 파일 해시가 바뀜(`app-features-<해시>.js`). 옛 index.html 을 들고 있던 브라우저가 옛 `/assets/*.js` 요청 → 새 빌드에 없음 → **worker catch-all(`app.get('*')`)이 SPA index.html 을 200 text/html 로 반환** → 브라우저가 "JS 모듈인데 text/html" 로 거부 → 대시보드 부팅 실패. ② 게다가 worker 가 **SPA 셸 HTML 에 Cache-Control 을 전혀 안 붙임**(heuristic 캐시) → 클라 자동복구(chunk-error 1회 reload)가 reload 해도 **stale index.html(옛 해시) 재수신** → 또 실패 → "1회" 가드가 막아 **영구 stuck**. (200 응답이라 복구로직이 '실패'로 인식도 못 함.)
- **영구 수정(서버측 2 — 이번 커밋)**: ① `worker/index.ts app.get('*')`: 없는 정적 에셋(`/assets/*` 또는 js/css/woff/png… 확장자) 요청은 **진짜 404** 반환(SPA HTML 금지) → 브라우저가 chunk 로드 실패로 인식 → 자동복구 동작. ② 같은 핸들러 SPA 셸 HTML 응답에 **`Cache-Control: no-cache, no-store, must-revalidate`** → 배포 후 항상 최신 index.html(새 해시) 수신.
- **클라측은 main 에 이미 더 강한 fix(머지 시 채택)**: `main.tsx reloadOnceForChunk` 가 2026-06-25(타 세션, `/admin/wholesale-overview` 흰화면 신고)에 `reloadWithCacheBust()`(`__cb` 캐시버스트 + `location.replace` 로 옛 HTML 재서빙 우회) + 60초창 2회 가드로 이미 개선됨 → 내 버전 대신 그쪽 유지(더 robust). 서버측 404+no-cache 와 상호보완(클라 캐시버스트가 reload 보장, 서버가 stale 발생을 줄이고 MIME 에러를 깔끔한 404 로 전환).
- **잠금 영향 0(검증)**: SSR inject 블록(미들웨어 470)·`caches.default` API 캐시(0-RTT) **byte-identical 미변경** — SSR 0-RTT 는 서버사이드 API 데이터 주입이라 HTML 브라우저캐시와 독립. worker 가 원래 HTML 에 Cache-Control 을 **아예 안 붙이고 있었음**(전수 grep 확인) → no-cache 추가는 신규(약화 아님). 존재하는 에셋은 Pages 가 직접 서빙 → catch-all 미도달(404 오발동 0).
- **검증**: tsc 0 · `npm run build`(client+ssr+worker) exit 0. ⚠️ 현재 stuck 사용자는 이 배포 반영 후 강력새로고침 1회(Ctrl/Cmd+Shift+R)면 최신 셸 수신 → 이후 영구 자가복구.

## ✅ 2026-06-17 — 로그인/가입 입력 글자 흰색으로 안 보이던 문제 영구수정 (대표 신고 "왜 이런 문제, 영구적으로 이상적으로")
**신고**: `/admin/login` 등에서 타이핑하는 글자가 흰색이라 안 보임. "로그인 쪽 모두 그런 것 같아."
- **근본 원인**: 전역 CSS `.dark input:not([type=...])` (index.css:492, 특이도 **0,5,1**)가 OS/앱 다크모드(`html.dark`)에서 **모든** 입력 글자색을 gray-100(거의 흰색)으로 덮어씀. 페이지의 `text-gray-900` 유틸(특이도 0,1,0)은 특이도가 낮아 짐 → 흰 배경에 흰 글자. 대시보드는 `.admin/.seller-light-theme` 래퍼로 보호됐으나 ① **`.agency-light-theme` 는 CSS 규칙 자체가 누락**(에이전시 대시보드 잠복 동일버그) ② **로그인/가입/비번재설정 페이지는 레이아웃 밖 standalone 이라 래퍼 없음** → 무방비. (소비자 다크토글은 정상이고, 라이트 고정 표면만 영향.)
- **영구 해결(이상적)**: ① index.css — 라이트 고정 컨테이너(`.{admin,seller,agency}-light-theme` + **범용 `.force-light-theme` 신설**) 안의 입력 글자/캐럿/autofill 을 `color:#16181b !important` + `-webkit-text-fill-color !important` 로 강제 → 전역 `.dark` 규칙을 **특이도/소스순서/브라우저(webkit·firefox) 무관** 확실히 이김. 순수 CSS 라 ThemeProvider MutationObserver(`<html>` class 복구)와도 무충돌. `.agency-light-theme` 규칙 추가(누락 메움). ② standalone 라이트 auth 페이지 **17곳** 루트 div 에 `force-light-theme` 클래스 추가 — 로그인 6(admin/seller/supplier/wholesale/agency/wholesale-staff) + 비번찾기·재설정 4(seller/agency) + 가입 6(seller/agency/supplier×register·business·supplier) + wholesale-join 1. (AdminPinSetup 은 AdminLayout 내부라 자동 보호 / JoinChoice·소비자 Login 은 의도적 다크라 제외.)
- **재발방지**: 신규 standalone 라이트 페이지는 루트에 `force-light-theme` 추가하면 끝(주석 명시). CSS `!important` 가 어떤 다크 전역규칙도 이김 → 클래스만 있으면 영구 안전.
- **검증**: tsc 0 · `npm run build`(client+ssr+worker) exit 0 · 대시보드 테마 검사(내 수정 파일 dark: 0, 기존 플래그 5건은 무관 파일). 17파일 force-light-theme 정확히 1회씩 루트에만 주입 확인.

## ✅ 2026-06-17 — 교환권 발송 실패 "이상적 해결": 자동 복구 + 끼임 surface (대표 "가장 이상적으로 해결해줘. 어떻게 해야 문제가 없는지")
**배경**: 위 가시성 fix 후속 — 실패가 보이는 것에서 **문제 없게(자가치유)** 로. 기존엔 실패 시 알림(유저/Discord/dashboard)만 있고 **자동 재시도 0**(운영자가 매번 수동 '재발송' 클릭) + **'processing' 끼임 영구 잔존**(sendCoupon 직후 UPDATE 전 크래시) + 실패 사유 집계 없음.
- **신규 cron `kt-alpha-voucher-retry.ts`** (`scheduled.ts` 매시간 `0 * * * *` 등록):
  - **A. 'failed' 자동 재시도(안전)**: status='failed'=sendCoupon throw=**미발송 확정**이라 재시도해도 중복 0(수동 재발송과 동일 sendCoupon). 가드 `retry_count<3 · 최근14일 · 유효폰(GLOB 01[0-9]*+JS regex) · goods_code`. exponential backoff(last_retry_at+2^retry_count h). run당 20건. **CAS(failed→processing, retry_count++)** 선점 후 발송 → 성공 'sent'/실패 retry_count 유지. 3회 소진분 Discord 1회 요약.
  - **B. 'processing' 끼임 surface(위험회피)**: 30분 초과 미완료를 'failed'(retry_count=3=소진)로 전환 → **자동 재발송 안 함**(발송 성공 여부 불명 → 중복발송/이중과금 위험). 실패 목록엔 보이되 자동 대상 제외 → 운영자가 KT 구매내역 확인 후 수동 재발송.
  - **config(user_id/callback_no) 미설정 시 자동 재시도 전체 skip** — retry_count 안 태움(끼임 정리는 수행).
- **스키마**: `voucher_orders.retry_count INTEGER DEFAULT 0` + `last_retry_at DATETIME` — repair-schema ALTER(requiresTable 가드) + CREATE TABLE 3곳(repair-schema/kt-alpha-auto-send lazy) 동시 추가. ensureVoucherRetryColumns(WeakSet 메모이즈, 머니룰 per-request DDL 준수).
- **어드민 페이지**(`AdminVoucherOrdersPage`): ① 🤖 자동복구 동작 안내 배너(실패=자동3회/끼임=수동) ② 📊 실패 사유 분포 집계(백엔드 `failure_summary` GROUP BY) ③ 행별 자동 재시도 `N/3회` 표시. GET `/voucher-orders` 응답에 `retry_count`(COALESCE graceful) + `failure_summary` 추가.
- **문제 없게 운영하려면(대표 안내)**: 자동 복구가 일시적 KT API 오류는 자가치유. 단 ① KT Alpha 잔액 유지(잔액부족 실패는 충전 후 자동 재시도) ② dev_mode 무관(sendCoupon 은 항상 실발송) — 즉 별도 조치 거의 불필요. 3회 소진/끼임만 가끔 수동 확인.
- **검증**: tsc 0 · `npm run build`(client+ssr+worker+prepare) exit 0 · 대시보드 테마(AdminVoucherOrdersPage 무플래그) · sql-bind 0 · money-pattern 0 · schema-refs 0.

## ✅ 2026-06-17 — 교환권 발송 실패가 목록에 안 보이던 문제 (대표 신고)
**신고**: `/admin/voucher-orders` 에서 "발송 실패됐다는데" 페이지엔 안 보임.
- **원인**: `GET /voucher-orders` 가 **시간창 필터**(기본 24h, 최대 7일)로 row 를 거름 → **7일보다 오래되거나 24h 밖의 실패 건이 숨겨짐**. 대시보드 failed 카운트(admin-stats:151)는 **기간 무관 전체**라 "실패 N"은 뜨는데 목록 0건 → 불일치. (모든 voucher 는 source='kt_alpha' 라 출처 필터는 무관.)
- **수정**: ① 백엔드 — `status=failed` 필터 시 `created_at` 시간 조건 **제거**(모든 실패 항상 표시·재발송 가능). stats 에 `failed_all`(기간 무관 전체 실패) 추가. ② 프론트 — `failed_all>0` 이면 **상단 빨강 배너** "발송 실패 N건(기간 무관)" + '모두 보기' 버튼(failed 필터). failed 필터 시 "기간 무관 전체" 주석. 시간창 통계(processing/sent/failed)는 기존대로 윈도우 유지.
- 검증: tsc 0 · build 0 · 대시보드 테마 0 · sql-bind 0(시간조건은 sanitized number 인터폴레이션, bind 무변경).

## ✅ 2026-06-18 — 하이퍼로컬 토대: 매장 행정동(洞) 자동 태깅 (대표 "쓰자" — 콜드스타트 밀도전략)
**배경**: 콜드스타트는 "한 동네 밀도" 전략인데, 매장이 좌표(lat/lng)만 있고 "무슨 동"인지 모름 → "내 동네 딜"·동별 밀도 집계 불가. 카카오 `coord2regioncode`(좌표→행정동, 안 쓰던 기능)로 자동 태깅.
- **1단계(이번 — 매장 태깅)**: `restaurant-geocode` cron 확장. Pass A(주소→좌표) 직후 `coord2regioncode`로 동 태깅, Pass B(좌표 있으나 미태깅 기존 매장 백필). 행정동(H) 우선·법정동(B) 폴백.
- **저장**: 신규 테이블 `product_regions`(product_id PK, region_si/gu/dong/dong_code, lat/lng) — **products 컬럼 예산제 회피**(별도 테이블이라 budget check 신규 0). `region_dong_code` 인덱스(동별 집계/향후 피드 조인). repair-schema + cron ensure(멱등) 등록.
- **카카오라 저렴**(무료 한도 30만/일, batch 수백) + 결제·잠긴 피드쿼리 무수정. 실패 row 는 다음 cron 자연 재시도(region_dong NULL → Pass B 재처리).
- **2단계(이번 — 유저 동 태깅 백엔드)**: `region.routes.ts` 신규 — `GET/POST /api/me/region`(GPS 좌표→`fetchRegion` 또는 수동 동코드 → `user_regions` UPSERT). 카카오 helper 를 `kakao-region.ts`(SSOT)로 추출해 cron·라우트 공유. `user_regions` 테이블 + repair-schema 등록.
- **3단계(이번 — 서버 피드 필터)**: `group-buy-public.routes.ts` GET /products 에 `?region=` additive([UNLOCK_LOADING] audit log). 기본 요청 byte-동일, region 붙은 요청만 새 캐시키 + `product_regions` JOIN + 코드 prefix. **현재 클라(GroupBuyListPage)는 자체 주소-텍스트 region 필터 사용 중이라 이 서버 param 휴면** — 중복 토글 안 붙임(충돌 방지). 향후 GPS 자동 '내 동네'로 업그레이드용 토대.
- **A단계(이번 — 어드민 동별 밀도 보드)**: `AdminRegionDensityPage` + `/admin/region-density` 라우트 + 사이드바 nav. `GET /api/admin/region/density`(구별/동별 활성 딜 count) — "어디 깔렸나/어디 비었나" 영입 타겟. 유저 0이어도 작동(대표님 발품 조준경).
- **검증**: tsc 0 · full build 0 · sql-bind/sql-column(tables 281)/schema-refs/dashboard-theme/theme-consistency clean.
- **다음(선택)**: GroupBuyListPage 의 기존 주소-텍스트 region 필터를 GPS 자동감지(`/api/me/region`)+서버 param 으로 업그레이드(기존 동작이라 enhancement). 네이버 DataLab 수요신호 → 소비자 머천다이징 캘린더 재사용.

## ✅ 2026-06-17 — 에이전시 매장 영입 개선점 12종 일괄 (대표 "모두 진행, 가장 이상적으로")
전면 재편 후 발견된 개선점 12개를 우선순위로 처리(🔴 정합성 → 🟡 완결성 → 🟢/검증).
- **🔴 정합성**: ①'진행중 공구' KPI 스코프를 `agency_sellers` OR `introduced_by_agency_id` 둘 다로(영입 매장 공구가 KPI 에 잡히도록 — 재편의 모순 해소) ③동네공구 '예상 수익'→**'예상 거래액'(GMV)**: 동네공구 확정엔 에이전시 직접 적립 코드 없음(확인) → 오해 라벨 정정, commission_rate fetch 제거. ⑩`AgencyGroupBuyAlert` 미사용 `active_groups`를 헤더 배지로 노출.
- **🟡 매장 영입 완결**: ⑦가게별 진행중 공구 컬럼(/introduced-stores backend+page) ⑥영입 깔때기(영입→활성→공구운영→매출 4단계, 클라 파생) ⑧부진 영입 매장 인사이트(summary.inactive_stores → 메인 대시보드, 매장 영입 1순위 배너) ⑨영입 링크 복사 CTA(introduced-stores 기존 + 메인 '가게 영입' 연결 — 충족).
- **검증으로 해소(코드 무변경)**: ⑤매장영입 commission 원천징수 = `commission_withdrawals.withholding_tax` 로 이미 반영(admin-payout-center) — 갭 아님. ⑪i18n = 6개 언어 0-missing sync 통과(defaultValue 컨벤션).
- **남은 운영 액션(이 환경 불가)**: ②에이전시↔셀러 3중 연결(agency_sellers/agency_id/introduced_by) 전역 SSOT 통일은 다수 쿼리 영향이라 위험 — #1 로 가장 가시적 증상은 해소, 전역 통일은 별도 신중 작업. ④자동정산 staging 실결제 E2E 1회. ⑫운영 가이드 prod 재시드.
- 검증: 전 batch client+worker build exit 0 · 테마 clean.

### ➕ 잔여 3건 — 코드/런북으로 최대치 처리 (대표 "남은 작업도 다")
- **② 스코프 정합(추가 코드)**: `disputes/agency-overview`(공구 alert 소스)의 active_groups/at_risk/churn 을 `sellers.agency_id` → **`introduced_by_agency_id` OR `agency_sellers`** 로 변경(KPI #1 과 동일 스코프) → 대시보드 "진행중 공구" KPI 와 alert 배지가 **같은 숫자**. 컬럼 collapse 는 의미 상이(영입≠관리)+머니 위험이라 **금지** 결정, SSOT 문서화. drift 가능성은 향후 과제로 명시.
- **⑫ 재시드(신규 엔드포인트)**: `POST /api/guides/:type/reseed`(admin, `{confirm:true}`) — 해당 type 전체 DELETE 후 시드 재삽입. 운영자가 raw SQL 없이 변경된 가이드를 prod 반영. footgun 가드(confirm 필수).
- **④ E2E 런북**: `docs/AGENCY_SETTLEMENT_E2E.md` 신설 — store-intro commission + auto-settle 2경로 검증 단계·SQL·통과기준. (실결제는 여전히 권한자 staging 실행.)
- 검증: worker+client build exit 0.

## ✅ 2026-06-17 — 에이전시 대시보드 '매장 영입' 중심 전면 재편 (대표 AskUserQuestion="메인+사이드바 전면 재편")
**배경**: 대표 통찰 — 공구 모델에서 에이전시의 본질은 **매장 영입**(오프라인 가게를 입점→공구 운영)이고 '소속 셀러 매니징'은 라이브 시대 유산. 매장 영입 **엔진**(결제확정 시 `creditAgencyStoreIntroCommission` 실호출=가입 ₩30,000+매출 2%·멱등, 월 ₩50,000 cron, 환불역전, introduced-stores/prospects 페이지)은 이미 잘 배선됨 — **대시보드 IA가 여전히 소속 셀러 중심**이던 갭을 해소(소속 셀러 기능은 전부 코드/경로 보존, 노출만 강등).
- **사이드바**(`AgencyLayout`): '매장 영입' 그룹을 대시보드 바로 아래 **최상단**으로 신설(내 입점 가게·매장 영입 현황·공동구매·숙소). 소속 셀러(담당 셀러·랭킹·비교·셀러영입·이전 + 라이브현황·방송캘린더)는 **'셀러 관리' 보조 그룹**으로 강등. 하단 CTA '셀러 초대'→**'가게 영입'**(/introduced-stores), 미니통계 '담당 N셀러'→**'영입 N가게'**(summary fetch).
- **메인**(`AgencyPage`): KPI Row 재배열 — ①영입 가게 ②이번달 영입 수익(실 commission) ③진행중 공구 ④30일 매출 ⑤담당 셀러(후순위). Commission 배너를 **매장 영입 누적 수익(실 적립)** 우선 + 소속 셀러 추정 수수료는 보조줄. Quick Actions '가게 영입'/'공구 관리' 우선. 라이브 전용 `KpiMetricsGrid`(diamond/live_rate) 게이트.
- **백엔드**(`agency.routes` bundle): `/introduced-stores/summary` 9번째 서브요청 추가(단일 fetch 유지, 한도 50 안전) → 메인 대시보드가 매장 영입 지표 0-RTT.
- 검증: client+worker build exit 0 · 테마 clean. 소속 셀러 라우트/페이지 무삭제(가역).

## ✅ 2026-06-17 — 에이전시 대시보드 라이브 잔재 제거 + 공구 집중 repurpose (대표 "가장 이상적으로, 공구 집중")
**배경**: 라이브커머스 영구중단(`LIVE_COMMERCE_SUSPENDED=true`)인데 에이전시 대시보드에 **게이트 안 된 라이브 잔재 5곳**이 그대로 노출됨(나머지 nav/소비자 표면은 게이트 정상 — 에이전트 전수확인). 단순 숨김이 아니라 **공구 지표로 repurpose**(복원 시 자동 환원).
- **진행중 공구 KPI 신설**(`agency-stats.routes /stats` + `types.ts`): 소속 셀러의 `group_buy_status='active'` 공구 상품 수(`active_group_buys`, disputes-overview 와 동일 스코프, agency_sellers 조인). bundle 은 `/stats` 서브요청이라 자동 반영(백엔드 1곳만).
- **AgencyPage 라이브 잔재 4곳 처리**: ① 5번째 KPI 카드 `라이브`→`진행중 공구`(amber, Ticket) 스왑(라이브 복원 시 환원) ② 인사이트 '오늘 라이브 없음'(→/schedule) `!LIVE_COMMERCE_SUSPENDED` 게이트 ③ 서브타이틀 '…/라이브'→'…/공구' ④ 'Live Schedule' 섹션 + 셀러랭킹 LIVE 배지 게이트.
- **AgencyLayout 모바일 FAB**: '라이브 편성'(→/schedule, **게이트 없던 잔재**) → 라이브 중단 시 '공구 관리'(→/agency/group-buy, Utensils)로 repurpose.
- 전부 `LIVE_COMMERCE_SUSPENDED` 분기라 **flag false 시 라이브 UI 자동 복원**(코드 보존 정책 준수). 검증: client+worker build exit 0 · 테마 clean. (직전 전수조사 commit 의 AgencyGroupBuyPage 데이터매핑 수정과 연속.)
- **후속(공구 폴리시, 같은 세션)**: ① `AgencyGroupBuyPage` 예상수익 하드코딩 3% → **에이전시 실제 `commission_rate`**(profile, default 2.0%) — 주석에 '미구현 fallback' 이라 적혀있던 의도 완성 ② 대시보드 '진행중 공구' KPI **클릭 → /agency/group-buy**(공구 관리 진입 강화) ③ 소비자 공구 서비스(GroupBuyList/Detail·community-group-buy·main-home 피드) 전수 스캔 결과 **라이브 잔재 0·엔드포인트/필드 정합 양호**(에이전트 확인 — 추가 수정 불요).
- **에이전시 운영 가이드 재정렬(`guide-seed-agency.ts`)**: 520줄 가이드가 **전부 라이브 방송 프레이밍**(공구 언급 0)이던 것 → 사실정보(수수료 2%/정산/등급/PIN 등) 보존하고 **라이브→공구·매장 운영**으로 재정렬(공구 언급 0→20). welcome 기능목록에 공구관리/매장영입 추가, recruit 셀러기준·어필·흔한오해, support 온보딩/코칭/도구/성장전략, performance KPI표, coupon 시청자→고객, faq 점검항목. incentives `streams/viewers` metric 은 **실제 백엔드 metric 이라 보존 + '라이브 시대 지표(현재 비활성)' 주석**(sales/orders/rating 권장 안내). ⚠️ **seed 는 빈 DB/재시드 시 적용** — 기존 에이전시 반영하려면 prod `operation_guides` agency 섹션 DELETE 후 재시드 or `/admin/operations-guide` UI 편집 필요.

## ✅ 2026-06-17 — 듀얼 로그인 영구 방어선 + CSP/토큰 대안 평가 (대표 "1,2,3 다 하자")
대표가 쿠키 컷오버 대신 가벼운 대안 3종 요청 → 정직하게 분류 후 안전한 것만 실행:
- **① 재발방지 CI 가드 (구현·배포)**: `scripts/check-dual-login-guard.mjs` — 클라 `localStorage.getItem('user_type') === 'user'` *로그인 게이트* 안티패턴(세션 풀림 사고 근본원인) 신규 추가 감지. App.tsx(글로벌 Firebase init, 세션드롭 아님)만 allowlist. pre-commit warn(`install-git-hooks.sh`) + **verify.yml CI strict(현재 위반 0)**. 동시로그인 해결을 *영구*로 못박음. 런타임 위험 0(검사 스크립트). 음성/양성/strict 테스트 통과.
- **② CSP (점검만 — 변경 안 함)**: 이미 잘 하드닝 — script-src `nonce + strict-dynamic`(CSP3에서 unsafe-inline·host 무력화=사실상 nonce 전용, XSS 핵심방어) + object-src 'none'·base-uri·form-action·frame-ancestors 'self'. style-src는 과거 사고(2026-05-21 nonce)로 잠김, connect/img 타이트닝은 통합 깨짐+E2E 불가 → **안전한 추가 변경 없음**(억지 변경이 해로움). 쿠키 전환의 marginal 이득이 작은 근거이기도 함.
- **③ 토큰 수명 단축 (안 함 — 권하지 않음)**: XSS는 localStorage 통째로 읽어 **refresh까지 탈취** → access만 단축해도 XSS 방어 거의 0. 게다가 30일은 "모바일 잦은 만료 민원"으로 *일부러* 늘린 값 → 단축=UX 후퇴. 비용 대비 무의미.
- 검증: 가드 테스트 통과 · tsc 영향 없음(standalone mjs).

## ✅ 2026-06-17 — G1 쇼핑 할인결제 완전수정: 서버 권위 할인 + 딜 실차감 (대표 "완전 fix (딜 차감까지)") — ⚠️ staging E2E 필수
**배경**: 주문 zod(`order.routes` createOrderSchema)가 할인필드(쿠폰/딜/공구할인)를 strip → `total_amount` 에서 할인 누락 → 쿠폰·딜 쓴 결제 전부 confirm 금액불일치 400(과금 0, fail-safe). 게다가 `deal_used` 는 **서버에서 한 번도 차감 안 됨**(클라가 보내기만 — '딜 안 빠지는데 할인은 들어가는' 머니 구멍). 라이브 영향 0(쇼핑탭 숨김 + 동네딜 결제는 별도 `/api/group-buy/join` 서버계산 경로라 무관).
- **설계(validate-by-cap)**: 클라 할인액을 신뢰하지 않고 서버가 각 항목을 권위 상한 이하로만 인정 + 실제 소비/차감. 정직한 클라는 서버 total 이 클라 totalAmount 와 정확히 일치(confirm 통과), 악의적 클라는 항목별 cap 클램프(구멍 차단).
  - **쿠폰**(`coupon-discount.ts` 순수 SSOT `computeCouponDiscount` 신설 + `/coupons/use` 와 공유): 클라 coupon_discount 를 `computeCouponDiscount(coupon, base)` 상한 이하로 인정 + `coupon_uses` UNIQUE 1회 소비(주문생성 시, 멀티셀러 동일쿠폰은 첫 그룹만). 클라 별도 `/coupons/use` 호출 폐지(이중소비 방지).
  - **딜**: 클라 deal_used 잔액·잔여 클램프 → `orders.deal_used`(신규 컬럼) 저장 → **결제 성공(`/confirm`)에서 실제 잔액 차감**(`adjustUserPoints` CAS, confirmClaim 직후 1회 멱등). `[UNLOCK]` payment.routes.ts(대표 "결제 성공 시점" 승인 — CLAUDE.md audit log 기록).
  - **공구할인 portion**(=총할인−쿠폰−딜): 회귀 이전과 동일 클라-신뢰(클램프) — 신규 구멍 X.
- **역전 대칭(머니룰 #2)**: `order-refund.ts`(전액환불) — 딜 사용분 복원 + 쿠폰 un-use + used_count 감소(CAS 후 멱등). `returns.routes.ts`(부분반품) — refund_amount 비례 딜 복원 + `orders.deal_used` 잔여 차감(여러 부분반품+전액환불 합쳐도 초과복원 0). 둘 다 `deal_used` 를 '미복원 잔여' 원장으로 사용.
- **변경 파일**: `coupon-discount.ts`(신규 순수+테스트 5) · `coupon-discount.test.ts`(신규) · `coupons.routes.ts`(/use 가 SSOT 위임) · `order.routes.ts`(스키마+validate-by-cap 블록+딜저장/쿠폰링크/롤백) · `order.repository.ts`(createOrder opts.discountAmount) · `payment.routes.ts`[UNLOCK](딜 차감) · `order-refund.ts`+`returns.routes.ts`(역전) · `ensure-order-columns.ts`(신규 memoized ALTER) · `repair-schema`(orders.deal_used) · `useBeforePayment.ts`(/coupons/use 호출 제거).
- **검증**: tsc 0 · `npm run build`(client+ssr+worker+prepare) exit 0 · **단위 2152 pass**(coupon-discount 5 신규) · money-pattern/sql-bind/sql-column/schema-refs clean.
- ⚠️⚠️ **쇼핑탭 재오픈 전 staging 실결제 1회 필수**(외부망 차단으로 E2E 불가): ① 쿠폰만 ② 딜만 ③ 쿠폰+딜 동시 → 각각 confirm 통과 + 잔액 정확 차감 + 환불 시 딜 복원·쿠폰 재사용가능 확인. **단일셀러 카트 기준**(멀티셀러+동일쿠폰은 첫 그룹만 적용 → 안전하나 confirm 400 가능 — 후속).
- **후속(비긴급)**: ① 멀티셀러 카트 단일콜 주문화(서버 완전권위 + 클라 서버total 청구 — TossPaymentWidget 잠금이라 prop 경로 확인 필요) ② 공구할인 portion 서버 파생(현 클라-신뢰) ③ 부분반품 쿠폰 부분복원.

## 🩺 2026-06-17 — 도매몰 카탈로그 "상품 안 뜸" 전수조사 + 영구수정 (대표 반복 신고, prod 직접확인 불가)
**증상 변화**: ①스켈레톤 영구 → (self-heal 후) ②"해당 조건의 도매 상품이 없어요"(0개) + 느림. admin `/admin/wholesale-import` 엔 상품 보임 = 데이터는 존재, 카탈로그 WHERE 가 전부 걸러냄.
- **근본구조**: admin 목록 WHERE(`is_supply_product=1 AND source NULL/0`) < 카탈로그 WHERE(`+is_active=1 +supply_source_id IS NULL(엄격) +supply_price>0 +mall_id=요청몰 +visibility`). 한 조건만 어긋나도 admin엔 보이고 카탈로그엔 0개.
- **수정1 (89893f5) 스키마 self-heal**: 카탈로그 SELECT 가 참조하나 인라인 ensure 엔 없던 컬럼(`mall_id/brand_name/brand_logo_url/is_premium/sold_count/pack_size/order_multiple/dominant_color`)을 `ensureSupplyVisibilitySchema` 에 추가 → repair-schema 미실행 prod 의 'no such column→메인쿼리 throw(.catch없음)→500→스켈레톤 영구' 차단.
- **수정2 (0c744ea) source 0→NULL 자가정규화**: 같은 ensure 에 `UPDATE products SET supply_source_id=NULL WHERE is_supply_product=1 AND supply_source_id=0`(멱등). admin 쿼리 작성자가 3곳에 `=0` 명시처리 = 실데이터에 0 존재 정황. ensure 가 메인쿼리보다 먼저 await(1165<1259)라 배포 후 첫 요청에서 정규화→조회 순서로 즉시 치유. **9개 IS NULL 쿼리 일괄 + SSR/캐시 복원으로 속도도 개선**(빈결과 no-store라 매 로드 풀쿼리였음).
- **진단도구 (0755cd5)**: `GET /api/admin/distributor/catalog-diagnostic`(노출/숨김 사유별 + 숨은샘플 + 몰/가시성 분포) + `POST /catalog-repair`(안전정규화+옵션) + AdminWholesaleImportPage '🩺' 패널. prod 직접접근(egress) 불가라 대표가 한 번 실행→캡처하면 잔여원인(is_active/visibility/multi-mall) 확정.
- **전수조사로 배제**: 카탈로그 쿼리 바인딩/WHERE 정상 · bulk-import·demo 시드 모두 is_active=1·visibility=ALL·source NULL 로 생성(통과해야 정상) · 클라 기본필터 비제한(inStock=false/cat=all/premium은 premium탭만) · 단일운영자 몰=1 수렴(가입 mall_id=host기반 utongstart→1, 상품 supplier mall_id→1) → 몰 불일치 배제. **남은 유력원인 = source=0(수정2로 처리)**.
- ⚠️ **미확정**: 수정2 후에도 0개면 is_active=0 / supply_price=0 / visibility≠ALL 중 하나 — 진단도구 또는 egress(`live.ur-team.com`) 허용 시 확정 가능. 슬로우는 개인화(등급별가=공유캐시불가=라이브쿼리)라 구조적이나 상품 채워지면 등급캐시(60s)로 개선.
- **대표 보고**: 제조사-유통사 채팅 기능 플로우 **완성**(별도 작업 — 본 세션 미관여, 차후 리뷰/문서화 대상).

## ✅ 2026-06-17 — 어드민 주문 페이지: 종류 구별(교환권/상품) + 체크박스 일괄 처리 (대표 요청)
**요청**: `/admin/orders` 에서 교환권/상품/도매몰 구별 + 체크박스 선택.
- **종류 구별**: GET `/api/admin/orders` SELECT 에 `first_item_category`(첫 주문상품 category) 추가 → 프론트 `orderKind()` 가 `isVoucherCategory` 면 **교환권**(+식사/미용/숙소/기타 서브), 아니면 **상품**. 신규 '종류' 컬럼(amber 교환권 / sky 상품 배지). bind param 무변경(정적 서브쿼리).
- **도매몰(B2B)**: 별도 `wholesale_orders` 테이블이라 이 페이지(=`orders`)엔 **구조적으로 안 나옴** → '도매몰(B2B) 주문 보기' 링크(`/admin/wholesale-orders`)로 안내(혼동 방지).
- **체크박스 일괄 처리**: 행별 체크박스 + 전체선택(indeterminate) + 1+선택 시 액션바(상품 준비/배송중/배송완료 일괄). **기존 `PATCH /orders/bulk-status` 재사용**(상태 검증·결제완료 일괄취소 차단·state-machine 그대로). 페이지/필터 변경 시 선택 자동 정리.
- 검증: tsc 0 · `npm run build` 0 · 대시보드 테마 0 · sql-bind 0. 머니 로직 무변경(상태 플립만, bulk-status 의 캡처 주문 취소 차단 유지).

## 🔐 2026-06-17 — 쿠키 전환(C) Phase 1 구현: httpOnly 토큰 쿠키 발급 일원화 (대표 "무조건 하자, 모두 이상적으로")
**방침**: 인증은 prod 자동배포 + 쿠키/웹뷰 E2E 불가 → 한 방 컷오버 시 전 대시보드(대표 어드민 포함) 락아웃 위험 → **다크론치**(무해 기반 먼저, 실제 전환은 flag+staging 게이트).
- **Phase 1(배포·무해·추가형)**: 모든 대시보드 로그인이 `ud_*` httpOnly 쿠키 발급하도록 통일. `auth-cookies.ts` 4역할 확장(+admin/supplier), `admin.routes`(ud_admin_token)·`supplier-auth.routes`(ud_supplier_token login+become) 발급 추가, `logout-cookies` 4역할 정리, 단위테스트 5. **기존 Bearer/localStorage·응답 바디 byte-identical → 무회귀·락아웃 0.** 읽기는 GET 전용 fallback(Bearer 우선)이라 **보안 이득은 아직 0**(localStorage 토큰 잔존) — 다음 컷오버에서 발생.
- **Phase 2~3(미구현, staging 게이트)**: CSRF 강제 확대(쿠키 mutation, Bearer skip) + 미들웨어 쿠키 mutation 읽기 + **클라 컷오버(localStorage 토큰 제거 = 실제 XSS 차단)**. feature flag `DASHBOARD_COOKIE_AUTH`(OFF) 뒤. **이 환경 E2E 불가** → 대표 staging 검증 게이트(특히 카톡 인앱). 설계: `docs/design/dashboard-cookie-auth.md` §11.
- 검증: tsc 0 · 단위(auth-cookies 5) · `npm run build` exit 0.

## ✅ 2026-06-17 — 에이전시 대시보드 전수조사 + 기능 버그 수정 (대표 "전수조사 → 🔴+🟡+🟢 전부 수정")
**감사 범위**: 페이지 50+·백엔드 라우트 23(전부 마운트·`requireAgency` 가드 정상, 죽은 cron 0, IDOR 0 — 골격 양호). 발견된 **실동작 버그 4 + 머니 규칙 위반 2 + 경미 3** 전부 수정.
- **🔴 공동구매 지표 깨짐** (`AgencyGroupBuyPage`): 백엔드 `community_group_buys` 컬럼(`current_count`/`target_count`/`total_deposited`)을 페이지가 `participant_count`/`target_participants`/`total_deposit_deals` 로 읽어 참여자/예치/예상수익 전부 undefined·0. **프론트 `select`에 `normalizeGroupBuy` 매핑**(소비자 피드 공유 백엔드 무변경).
- **🔴 라이브 시청자 항상 0** (`AgencyStreamsPage`): `/streams` 가 `current_viewers`/`scheduled_at` 반환인데 `viewer_count`/`started_at` 로 읽음 → select 정규화.
- **🔴 브랜드 편집기 먹통** (`AgencyProfilePage`): `/api/agency-public/me/public`(공개 라우터, GET /:slug 뿐) 호출 → 실제 마운트는 `/api/agency/public-profile/me/public`. GET 400·PATCH 404 → 경로 교정(인터셉터 토큰 자동주입).
- **🔴 셀러이전 받은/보낸 분류 깨짐** (`AgencyTransfersPage`): 미존재 `/api/agency/me` 404 → `myAgencyId` 항상 null → `/api/agency/profile`(data.id)로 재연결.
- **🟡 원천징수율 하드코딩 제거**(`agency-auto-settle.ts`·`agency-monthly-invoices.ts`): `0.033` 리터럴 → SSOT `WITHHOLDING_RATES.business_income`(값 동일, 동작 보존). seller 전용 `withholdAndLog`는 sellers 테이블 조회라 부적합(agencies 는 tax_type 컬럼 없음 — 향후 도입 시 비율분기는 별도 머니작업).
- **🟡 자동정산 멱등성**(`agency-auto-settle.ts`): SELECT→INSERT→mark(이중정산 창) → `UPDATE...RETURNING` 원자적 claim-before-credit(선점한 행으로만 수수료 산출, 동시실행 RETURNING 0건 → skip). ⚠️ 머니 — **staging 실정산 E2E 1회 필요**.
- **🟢 경미**: enum 폴백 가드(`AgencySelfEventsPage`/`AgencyPromoteBoostsPage` — 데이터 드리프트 크래시 방지), `AgencySellersPage.loadStats` 조용한 실패→토스트, `AgencySettlementsPage` 죽은 `requestPayout`(410) 제거+빈 테이블 empty-state, `AgencyContractsPage`/`AgencyNoticesPage` 한글 하드코딩 `t()` 래핑.
- 검증: `npm run build`(client+worker) exit 0 · 머니패턴·테마 검사 clean. tsc 는 환경 TS버전 `baseUrl` deprecation(레포 전역, 변경 무관)로 미실행.

## ✅ 2026-06-17 — 이메일 기억하기 4개 대시보드 추가 + 자동 로그인 정합 (대표 신고)
**신고**: "각 대시보드마다 이메일 기억하기 잘 되나? 자동 로그인도 안 되는 것 같다." 전수조사: 이메일 기억은 **admin·seller만 있고 agency/supplier/wholesale(owner·staff) 4곳 누락**. 자동 로그인은 **전용 토글 없음**(토큰 30일+refresh 90일+자동갱신으로 암묵 유지).
- **이메일 기억 4곳 추가**(대표 "4곳 모두"): `AgencyLoginPage`/`SupplierLoginPage`/`WholesaleLoginPage`/`WholesaleStaffLoginPage` 에 admin/seller 패턴 미러링 — 체크박스 + 마운트 시 자동채움 + submit 시 저장/삭제. 키 `{agency,supplier,wholesale,wholesale_staff}_remember_email`. 프론트만, 라이트 테마(위반 0), tsc 0 · build 0.
- **자동 로그인(대표 "추천대로")**: 별도 sessionStorage 토글은 **미구현**(택트 — 토큰 읽기 경로 변경 = 리스크 + E2E 불가, 게다가 대표 pain은 "로그아웃됨"이라 opt-out 토글은 무관). 대신 **재로그인 마찰 최소화 = 이메일 기억 전 대시보드 통일**로 해결(단일세션 유지 시 비번만 입력). 지속(자동 유지)은 이미 30일 동작. **느낌상 풀림의 유력 원인 = 방금 배포된 단일 세션(다른 기기 로그인 시 이전 기기 로그아웃)** — 대표가 "추천대로"라 단일세션 유지.

## ✅ 2026-06-17 — 판매사 등급 페이지(1,170줄) 4탭 분리 (대표 "지금 하자, 가장 이상적이고 신중하게")
**배경**: `AdminDistributorGradesPage` 1,170줄에 12기능 집약(등급/마진/자동승급/배정/여신/제안/세금/유통채널/특가/수량할인/OEM/회사정보). 머니 크리티컬(staging E2E 불가)이라 **로직 0 변경 + 섹션을 연속 범위 그대로 탭으로 묶는** 최-안전 방식 채택.
- **4탭(딥링크 라우트)**: `등급·마진`(/distributor-grades) · `여신·외상`(/distributor-credit) · `제안·세금`(/distributor-tax) · `공급가·채널·OEM`(/distributor-supply). 같은 컴포넌트가 `useLocation` 경로로 탭 결정 → 4 라우트가 동일 컴포넌트 렌더(인스턴스 보존 = 탭 전환 시 재마운트/재fetch 없음).
- **머니 안전 검증**: `git diff` 결과 **api 호출 라인 변경 0**(핸들러·검증·요청 body 전부 byte-identical). 섹션은 원래 순서대로 연속 그룹이라 **JSX 블록 이동 없음** — 탭 조건부 래퍼만 삽입. tsc 0 · build 0 · 대시보드 테마 0.
- **부수 이득**: 각 탭 useApiQuery `enabled: tab===X` 게이트(proposals/oem/taxDocs/access) → 그 탭일 때만 fetch(가벼움). 사이드바 1항목 → 4항목(도매 도메인 그룹, 파트너 RBAC allowlist 자동 포함).
- **RBAC 준비**: 이제 기능별 라우트가 생겨 향후 직원별 권한 분리 가능(현재는 4탭 모두 admin/도매파트너 공통).
- **병합**: 동시 진행된 '유통사→판매사' 용어 변경과 충돌 → 4탭 분할 유지 + '판매사' 용어 채택으로 해소.
- ⚠️ 미진(의도적 안전 선택): 컴포넌트 파일 자체는 아직 1개(탭 분리). 완전 파일 분리(유지보수/번들 추가 이득)는 staging 검증 후 phase 2.

## ✅ 2026-06-17 — 도매 어드민 페이지 정리 1차 (대표 확정: 데모 중복 제거 + 무결성 강등)
**배경**: 도매 어드민 18개 페이지 전수 감사(에이전트 병렬) — 빈 스텁/삭제 대상은 0(전부 실동작). 비이상 4건 중 대표가 저위험 2건 선택(등급 페이지 분할은 머니 크리티컬이라 별도 보류).
- **① 데모 시딩 중복 제거**: `seed-demo-products`가 '상품 일괄 등록'(`AdminWholesaleImportPage`, 현황통계·정리·경고 완비)과 '유통사 등급'(`AdminDistributorGradesPage`) 양쪽에 중복 → **Import 로 일원화**. 등급 페이지에서 데모 섹션 JSX·함수(`seedDemoProducts`/`clearDemoProducts`)·`demoBusy` 상태 제거(등급/마진 전용으로 정리). `confirmDialog` 등 잔여 import 는 타 사용처 있어 유지.
- **② 무결성 페이지 강등**: `도매 무결성`(진단 전용 — 고아 데이터 표시)을 `AdminLayout` 상단 nav('도매몰·정산' 그룹)에서 제거 → `AdminWholesaleOverviewPage` Totals strip 아래 '데이터 무결성 점검' 링크로 접근. **라우트(`admin.routes.tsx:324`)·페이지·API 전부 유지** — nav 노출만 강등(가역). `Shield`는 타 nav 사용 중이라 import 보존.
- 검증: tsc 0 · `npm run build` 0 · 대시보드 테마(변경 3파일 위반 0). 머니 로직 무변경.
- **보류(대표 미선택)**: 등급 페이지(1,207줄, 12기능) 분할 — 마진·신용·정산 얽힘으로 staging E2E 필수, 별도 신중 진행. 프리미엄관↔등급 가격 겹침도 분할 시 함께 정리.

## 🔐 2026-06-17 — 대시보드 토큰 httpOnly 쿠키 전환 (XSS 하드닝, 옵션 C) — 설계 박제 / 단계 구현 대기
**배경**: 사용자 "모두 가장 이상적으로 진행". 대시보드 토큰(seller/admin/agency/supplier + refresh)이 localStorage 라 XSS 시 탈취·30일 takeover 가능 — 외부 파트너(도매 admin·제조사) 증가로 노출↑. 목표 = JS 못 읽는 httpOnly 쿠키 의존(방어심화).
- **설계 문서**: `docs/design/dashboard-cookie-auth.md` (현황 해부 + 단계 + 리스크/E2E 체크리스트 + 롤백).
- **핵심 통찰(코드 해부)**: 세션 쿠키(`createSessionCookie`/`parseSessionCookie`)는 **이미 전 메서드 인증**됨(auth.ts:350-373) → 인프라 사실상 완성. `ud_*` 쿠키는 **CSRF 미보장이라 GET 전용**(auth.ts:378). 따라서 C의 선결과제 = **대시보드 변경요청 CSRF 강제 확대**(`csrfProtection()` 은 Bearer skip이라 현행 무회귀). 클라(api.ts:221)는 이미 `X-CSRF-Token` 첨부. refresh 토큰도 쿠키화 대상.
- **단계(독립 배포·롤백)**: Phase0 CSRF 강제 확대 → P1 어드민 → P2 제조사/에이전시(utongstart.com host-only 쿠키 주의) → P3 셀러(웹뷰 최우선).
- **⚠️ 진행 안 한 이유(정직)**: ① CSRF 블랭킷 적용은 `/api/*/login|register|refresh`(Bearer 없는 비인증 POST)를 403으로 막아 **로그인 락아웃** → skip 경로 정밀 열거 필요. ② 쿠키/SameSite/도메인/카톡 인앱 동작은 **이 환경에서 E2E 불가** → 각 단계 클라 컷오버 전 staging E2E 가 게이트. 블라인드 강행 = "이상적"의 반대라 설계+검토 우선.
- **다음**: Phase0(어드민 한정부터, skip 경로 전수 열거 + 단위테스트) 구현 — 사용자 확인 후.

## ✅ 2026-06-17 — 도매 프리미엄관 체크박스 일괄 선택 (대표 요청)
**요청**: `/admin/wholesale-products`(도매 프리미엄관) 상품 리스트 체크박스 선택.
- **백엔드** (`wholesale-main.routes.ts`): 신규 `POST /api/admin/wholesale-products/bulk-premium` ({ ids[], is_premium 0|1 }) — 단일 batch UPDATE(공급상품·복사본 제외 가드), ids 검증(>0, ≤200). 기존 단건 `/:id/premium` 보존, `/bulk-premium`(1세그) vs `/:id/premium`(2세그) 충돌 없음. adminApp requireAdmin 상속.
- **프론트** (`AdminWholesaleProductsPage`): 행별 체크박스 + 전체선택(indeterminate) + 1+ 선택 시 액션바(프리미엄 추가/제외/선택해제). 낙관적 업데이트 + 실패 롤백, refetch 후 선택 자동 정리. 카드 레이아웃 justify-between→gap+flex-1(체크박스 수용), 선택 시 amber ring. dark: 추가 0.
- 검증: tsc 0 · `npm run build` 0 · 대시보드 테마(위반 0) · sql-bind 0.

## ✅ 2026-06-17 — 어드민 로그인 PIN 한-화면화 (대표 신고 "2단계 불편")
**신고**: 보안 PIN 설정 계정이 아이디/비번 → 로그인 클릭 → 그제서야 PIN 입력칸이 뜨는 2단계라 불편.
- **원인**: 백엔드(`admin.routes /login`)는 **이미 첫 요청에서 `pin` 수용**(hasPin이면 검증) — 2단계는 순전히 프론트(`AdminLoginPage`)가 `needPin` 응답 받고서야 PIN 칸을 노출하던 것.
- **수정(프론트 only)**: PIN 칸을 **처음부터 노출**(라벨 "6자리 보안 PIN (설정한 경우)" + 미설정은 비워두라는 힌트) + 로그인 요청에 `pin: pin.trim() || undefined` 항상 동봉 → PIN 계정도 **한 번에** 로그인. `needPin`(서버 pin_required)은 이제 칸 강조(보더 색)+안내문구 전환용으로만 유지(틀린 PIN/누락 시 폴백 동작 보존). **백엔드/PIN 검증 로직 무변경.**
- 검증: tsc 0 · `npm run build` 0 · 대시보드 테마검사(AdminLoginPage 위반 0).

## ✅ 2026-06-17 — 단일 세션 강제 확장: per-seat 키 + 카카오 토큰 + 로그아웃 문구 (대표 "가장 이상적으로")
**배경**: 단일 세션 v1(admin/seller/supplier)에서 제외했던 멀티시트(에이전시 멤버·도매 직원)와 카카오 발급 토큰까지 확장 + 안내 문구 구체화.
- **per-seat 키** (`dashboard-session.ts deriveDashboardSeat`): 토큰에서 시트 키 도출 — `sub_account_id`→`('seller_sub', id)`, `agency`+`member_id`→`('agency_member', id)`, `agency`(멤버없음/카카오)→`('agency', agencyId)`, admin/seller/supplier→`(type, id)`. **같은 회사의 다른 직원/멤버는 각자 시트 → 동시 로그인 보존**, 같은 시트의 다른 기기만 단일 세션. 미들웨어 3경로(Bearer/쿠키/SSR)·seller refresh 모두 seat 기반으로 전환(subAccount 옵션 제거).
- **에이전시** (`agency.routes`): 로그인 시 멤버 시트(Bearer/SSR)+org 시트(세션 쿠키, member_id 미포함) 동시 갱신. `/refresh` 도 멤버 시트 iat 검사(옛 기기 우회 차단).
- **도매 직원** (`wholesale.routes /sub-login`): `('seller_sub', sub_account_id)` 시트. 토큰에 이미 sub_account_id 존재 → 미들웨어 자동 도출.
- **카카오** (`kakao.routes` `issueLinkedRoleTokens`, [UNLOCK_LOADING] additive): 카카오 로그인 셀러→seller 시트 갱신. 에이전시→소유 멤버 id 조회 후 토큰에 `member_id` additive 추가 + 멤버 시트 갱신(이메일 로그인과 **동일 시트 키**로 완전 통일 — 두 방식 상호 무효화). **응답 shape/redirect/CSRF/seller.username 불변**.
- **문구**(③): 미들웨어/리프레시가 `SESSION_SUPERSEDED` 401 → `api.ts` 가 감지해 refresh 시도 생략 + `?error=session_superseded` 로 로그아웃. 3 로그인 페이지(admin/seller/agency)가 "다른 기기/브라우저에서 로그인되어 자동 로그아웃" 토스트.
- 검증: tsc 0 · `npm run build` 0 · 단위 88(deriveDashboardSeat+per-seat 시트 독립성 신규) · schema/sql-bind/theme 0. ⚠️ staging 권장: 같은 에이전시 멤버 2명 동시 로그인 유지 + 같은 멤버 2기기 단일화 확인.
## 🙋 대표님(운영자) 직접 할 일 — 코드로 불가 (Cloudflare/외부/검증)
> 사용자가 "내가 할 일 뭐 있어?" 물으면 이 목록을 안내할 것. 코드로 못 하는 것만 모음. (2026-06-17 갱신)

**🔴 지금 (안 하면 자동화가 침묵 / 데이터 위험)**
- [ ] Cloudflare env **`DISCORD_WEBHOOK_URL`** 설정 — 모든 운영 경보(백업/정산/이상탐지 실패)의 통로. 1인의 눈·귀.
- [ ] Cloudflare **`BACKUP_BUCKET`** R2 바인딩 — 주간 D1 백업(없으면 백업 0건).
- [ ] **백업 복구 드릴 1회** — R2 덤프 → 새 D1 복원 테스트 (복구 안 해본 백업은 없는 것).

**🟡 검증 (운영/확대 전 권장 — 머니)**
- [ ] **도매 마진 모델 staging 실결제 E2E 1회** (머니 크리티컬, 다른 세션 작업). 코드/테스트는 통과, 실결제만 미검증.
- [ ] **딜 적립 "사용 시 확정" staging 검증 1회** — 링크샵 구매→"적립 예정"→가게 QR 사용→추천인 잔액+"✅ 적립 확정" 알림.

**🟢 설정/외부 (선택)**
- [ ] 어드민 `/admin/platform-settings` → **`affiliate_commission_rate`** 최종 숫자 결정 (코드 기본 2%로 깔아둠 / 치킨게임이면 1~2% or 0).
- [ ] 동네딜 실제 매장 데이터 입력 (또는 어드민 "동네딜 상품 등록 → 데모 생성" 버튼).
- [ ] (선택) 기프티쇼 이미지 최적화 = 기프티쇼 측에 Cloudflare IP 화이트리스트 요청 (현재 raw URL 무료 동작 중).
- [ ] (선택) KT 인앱 바코드/PIN = KT Alpha PIN 발급 계약 확인 후 Cloudflare env **`KT_ALPHA_PIN_MODE=1`**.

---


## 🔴 2026-06-17 — 도매몰 마진 모델 전면 전환 (대표 확정, 머니 크리티컬) — ⚠️ staging E2E 필수
**대표 확정 모델(cost-plus)**: 제조사가 받을 금액(공급원가) **위에** 플랫폼 마진%를 *붙여* 공급가 산출. (구: 판매가−등급보장마진 / 정산 공급가×90% → 정반대)
- **공급가 = clamp(round(공급원가 × (1 + 유효마진%)), 하한=공급원가, 상한=판매가)**. 유효마진% = 제품별 마진%(`supply_margin_override_pct`, 없으면 전역 `wholesale_platform_commission_pct` 기본10) × 등급배수%/100.
- **제조사 정산 = 공급원가 전액** / **플랫폼 = 공급가 − 공급원가** (`splitWholesaleUnit` 단순 분리 — 마진은 공급가에 내재, commPct 인자 무시). ⚠️ 구 코드의 "제조사=공급가×90%" 불일치/버그 해소.
- **등급배수**(고등급=유료 우대): 일반C 100 / 프로B 70 / 프리미엄A 50 → 공급가 ↓ → 판매사 마진 ↑. (현재 `DEFAULT_GRADE_MULTIPLIERS` 상수 — **등급배수 어드민 편집은 후속**.)
- **부가세**: 포함가 그대로(표시·청구·정산), 세금계산서만 `splitVat`(10/110) 분리 — **이미 구현됨**.
- **변경 파일**: `distributor-pricing.ts`(resolveDistributorPrice→cost-plus, `distributorPriceFromCost`/`gradeMarginMultiplier`/`DEFAULT_PLATFORM_MARGIN_PCT`/`DEFAULT_GRADE_MULTIPLIERS` 신설, 구 distributorPriceFromRetail/marginForGrade deprecated 보존), `wholesale-settlement.ts`(splitWholesaleUnit 제조사=공급원가), `wholesale.routes.ts`(주문 라우트가 전역 기본마진 `commPct` 를 `defaultPlatformMarginPct` 로 전달 — 1줄), `AdminDistributorGradesPage`(라벨: 수수료율→기본 플랫폼 마진율), E2E 문서 재작성.
- **검증**: tsc 0 · **단위 130 pass**(3개 시나리오 테스트 cost-plus 로 재작성 — 워크드 숫자 잠금) · money-pattern 0 · client+worker build 0.
- ⚠️⚠️ **실 staging 결제 E2E 1회 필수**(외부 검증 불가): 공급가=공급원가×(1+마진)·제조사 지급=공급원가 전액·플랫폼=스프레드·판매가 상한·환불 역전. `docs/WHOLESALE_SETTLEMENT_E2E.md` 갱신본 참조.
- **후속**: ① 등급배수 어드민 편집 UI(현재 상수) ② 제품별 마진 입력 UI 확인/라벨(supply_margin_override_pct) ③ GET /me·admin 등급 미리보기의 옛 marginForGrade 표시 정합 ④ guide-seed-wholesale 공식 문구.

## ✅ 2026-06-17 — 대시보드 단일 세션 강제 (대표 결정: "단일 세션 강제로 하자", 범위 AskUserQuestion=대시보드 전체)
**목적**: 한 대시보드 계정 = 한 곳(기기/브라우저)만 로그인. 새 기기 로그인 시 기존 세션 자동 로그아웃. 외부 도매 동업자/어드민 **계정 공유·도용 방지**(최근 PIN/2FA 와 같은 맥락).
- **설계(iat 에포크 — payload 무변경)**: 모든 대시보드 토큰에 이미 있는 `iat` 활용. 신규 `dashboard_sessions(account_type, account_id, min_valid_iat)`. 로그인 시 `min_valid_iat=로그인 iat` 갱신 → 미들웨어/리프레시가 `토큰 iat < min_valid_iat` 면 401. **더 늦은 로그인이 이전 세션 무효화**. sid 를 전 payload 에 심는 방식 대비 변경면 최소.
- **신규 헬퍼** `worker/utils/dashboard-session.ts`: `startDashboardSession`(로그인 갱신)·`isDashboardSessionCurrent`(검증, 1초 skew). **전 함수 fail-open/soft** — D1 장애·레거시(iat 없음)·추적행 없음(롤아웃 전)·비대상역할·서브계정은 모두 통과(인증/로그인 안 깨짐).
- **범위(v1)**: admin / seller(=도매 사장, `/api/seller/login` 경유) / supplier. **제외**: agency(멀티 멤버)·wholesale 서브계정(`sub_account_id`) — 토큰 sub 가 부모ID라 시트별 키 필요(정상 동시 직원 오로그아웃 방지). 카카오 발급 셀러/에이전시 토큰도 v1 grandfather(잠금 kakao.routes 미변경). → **후속**: 멀티시트 per-seat 키 + 카카오 토큰.
- **미들웨어**(`auth.ts requireAuth`): Bearer/세션쿠키/SSR-forward 3경로 모두 검증(`SESSION_SUPERSEDED` 401). `optionalAuth` 는 제외(선택 인증에 401 부적절). **리프레시 차단**: admin/seller `/refresh` 가 옛 토큰 iat 검사 → 옛 기기가 refresh 로 우회 못 함(서브계정 제외). 로그인 6지점 `startDashboardSession` 1줄씩(admin/seller/supplier login+become/seller-registration). 쿠키 경로 위해 `session.ts SessionUser.iat` 추가.
- **클라 무변경**: 옛 기기 401→기존 refresh 실패→강제 로그아웃→`/{role}/login?error=session_expired`(기존 흐름이 그대로 처리). 메시지는 일반 "세션 만료"(향후 "다른 기기 로그인" 문구로 개선 가능).
- 검증: tsc 0 · `npm run build` 0 · 단위 87 통과(dashboard-session 9 신규) · schema-refs/sql-bind 0. ⚠️ 배포 후 실 staging 1회 권장(A 로그인→B 로그인→A 자동 로그아웃 확인).

## ✅ 2026-06-17 — 어드민 대시보드 라이브 스트림 관리: 체크박스 일괄 삭제 (사용자 요청)
**요청**: 어드민 대시보드 '라이브 스트림 관리' 테이블을 체크박스로 다중 선택 삭제.
- **구조적 발견**: 테이블이 public `/api/streams`(소프트삭제 `deleted_at` 미필터)에서 로드 → soft-delete(status='ended'+deleted_at)해도 행이 안 사라지던 구조(단건 삭제조차). 근본수정으로 **테이블 데이터 소스를 admin 전용 `/api/admin/streams` 로 전환 + 거기서 `deleted_at IS NULL` 필터**(저트래픽 admin 경로라 hot public 피드 무변경 — 회귀 0).
- **백엔드** (`admin-streams.routes.ts`): ① GET `/streams` 에 `deleted_at IS NULL` 필터 + `ensureStreamDeletedAt`(per-worker defensive ALTER) ② 신규 `DELETE /streams/bulk`(`/streams/:id` 보다 **먼저** 등록 — :id 캡처 방지) — ids 검증(>0, ≤100), 이미 삭제분 skip, live-monitor/bulk 와 동일 soft-delete 패턴(status='ended'+deleted_at, 매출/이력 보존). adminApp 의 requireAdmin+IP화이트리스트+audit 체인 상속.
- **프론트** (`StreamsTable.tsx`): 체크박스 열 + 전체선택(indeterminate) + 일괄삭제 액션 바(라이브 모니터 history 와 동일 UX). 선택은 컴포넌트 내부 상태, refetch 후 사라진 항목 자동 정리(useEffect prune). dark: variant 추가 0(대시보드 화이트 고정). (`AdminPage.tsx`): `bulkDeleteStreams` 핸들러(confirm→`DELETE /api/admin/streams/bulk`→성공 시 true 반환·refetch).
- 검증: tsc 0 · `npm run build`(client+SSR+prerender+worker+prepare) 0 · 대시보드 테마검사(내 파일 위반 0) · 스키마 참조 0.

## ✅ 2026-06-17 — 로그인 "계속 풀림" = 메인↔대시보드 듀얼 로그인 충돌 (사용자 신고 → 전수조사 후 근본수정)
**신고**: "로그인이 계속 풀린다 / 대시보드에 로그인하면 기존 메인 유저 로그인이 로그아웃되는 느낌." 전수조사 결과 **단일 키 `user_type` 의존 잔존 코드**가 근본원인 — RouteGuards/isLoggedInSync/UserProfilePage 는 이미 토큰 기반으로 고쳤으나 **401 인터셉터 + 소비자 페이지 10곳이 누락**(부분 수정).
- **메커니즘**: 한 브라우저에서 대시보드(셀러/어드민/에이전시)+소비자 동시 로그인 시 단일 키 `user_type` 이 'admin'/'seller' 로 덮임(`KakaoCallbackPage:69` admin/agency 토큰 있으면 'user' 미설정 + 대시보드 로그인이 직접 set). 그런데 `user_type === 'user'` 로 로그인을 판단하던 코드들이 멀쩡한 소비자 세션(user_id+쿠키)을 "로그아웃"으로 오인 → ① 즉시 체감(로그인 버튼/빈 화면) ② **실제 삭제**: `api.ts:597` 401 핸들러가 `isSessionCookieUser`(user_type==='user') false 면 **세션 헬스체크 보호를 건너뛰고** `clearAuthData('user')` 실행 → user_id+session_login 삭제.
- **수정(근본)**: 신규 SSOT `auth.ts hasConsumerSession()`(user_id || session_login || firebase_token — **user_type 비의존**, seller/admin 토큰 단독은 비포함=구매자 식별용). 적용: 🔴 `api.ts:597` 401 게이트(이거 하나로 실제 풀림 차단) + 🟠 소비자 페이지 10곳(Cart/Checkout/ProductDetail/CouponClaim/Register/Login/MyGroupBuys/UserGroupBuyCreate/InfluencerDashboard/Referral). 헬스 엔드포인트가 쿠키로 최종 판정하므로 비-소비자엔 무해(session:false→정상 정리).
- **의도적 제외**: `getLoginType`(호출자 0) · `App.tsx:344`(글로벌 Firebase init, 삭제 아님) · `auth-callback-bootstrap:169`(session:false 일 때만 삭제 — 무해, 401 경로가 reactively 처리).
- **회귀 테스트**: `auth-utils.test.ts` 에 hasConsumerSession 8케이스(듀얼 로그인 user_type=admin/seller 에도 true, seller/admin 토큰 단독은 false). 검증: tsc 0 · 단위 55/55 · `npm run build`(client+ssr+prerender+worker+prepare) exit 0.
- **후속(완전 이상적化 — 같은 클래스 2곳 추가 마감, 사용자 "이어서 진행")**: ① `auth.ts getUserId()`(async) 의 `user_type==='user'` 게이트 제거 — user_id 는 항상 소비자 id 라 user_type 무관하게 우선 반환(듀얼유저가 Firebase 로 빠져 소비자 id 를 못 받던 버그; getUserIdSync 와 일관). ② `ReelCard` 셀러 본인 방송 소유권 판정을 `user_type==='seller'` → `seller_token` 존재로(듀얼 셀러가 소비자로 마지막 로그인 시 본인 방송 컨트롤 상실 해소; id 비교 의미 보존 → non-셀러 false-positive 0). **의도적 유지**: `getUserNameSync`/`getUserEmail` role-dispatch(seller_name/admin_name)는 대시보드 표시에 필요 — 미변경(소비자 표시 nuance만, 세션 무관). BottomNav 는 이미 토큰/active_role 기반(무변경). 검증: tsc 0 · 인증 단위 90/90 · build exit 0.
- **죽은 코드 제거(사용자 "제거하자")**: `src/client/lib/api.ts` 삭제 — 401 시 무조건 `clearAuth()` 호출하는 별도 fetch 클라이언트였으나 **import 0건(완전 미사용)**. 미래에 소비자 호출에 쓰이면 메인 `lib/api.ts` 의 세션-헬스 보호를 우회하는 공격적 로그아웃이 될 footgun → 선제 제거. `ApiError` export 도 외부 사용 0(다른 ApiError 들은 별개 정의), 배럴 재export 없음 확인. 검증: tsc 0 · build exit 0. (라이브 채팅 표시명 항목은 **라이브 서비스 영구 중단으로 폐기**.)
- **공급사(제조사) 403 부당 로그아웃 수정(사용자 "진행하자")**: `src/lib/supplier-api.ts` 가 `401 || 403` 둘 다 `clearSupplierSession()`+/supplier/login 리다이렉트 → 제조사가 권한 없음/일시적 403 에도 세션 멀쩡한데 로그아웃되던 버그(소비자/대시보드와 같은 클래스 — 401 외 상태로 세션 파괴). **401 에서만 로그아웃**, 403 은 throw 만(페이지가 권한 없음 처리)로 수정. 메인 `lib/api.ts`(403=console.warn, 로그아웃 X)와 정합. supplierApi 는 제조사 입점 대시보드 전반에서 실사용(죽은 코드 아님). 검증: tsc 0 · build exit 0.
- **공급사(제조사) refresh 토큰 + 자동갱신 추가(사용자 "마저 진행")**: 기존엔 supplier access(30일) 만료 시 무조건 재로그인이었음(refresh 부재 — 타 역할만 90일 refresh+자동갱신). 셀러/어드민 패턴 그대로 미러링: ① 서버 `supplier-auth.routes.ts` — `issueSupplierTokens()`(access 30일 + refresh 90일, `auth_refresh_tokens` user_type='supplier' 해시 저장) 헬퍼로 `/login`·`/become(승인)` 이 access+refresh 동시 발급 + 신규 `POST /api/supplier/refresh`(JWT 검증→계정 approved 확인→저장 해시 rotation+reuse 감지→신규 발급; **레거시(저장 해시 0)는 JWT 서명/만료만으로 허용=자연 마이그레이션**). ② 클라 `supplier-api.ts` — refresh 토큰 저장(`supplier_refresh_token`), 401 시 inflight 락으로 1회 자동 갱신 후 재시도→실패할 때만 로그아웃(403 은 여전히 로그아웃 X). ③ `SupplierLoginPage` 가 응답 refreshToken 저장. 레거시 사용자는 access 만료 시 1회 재로그인 후부터 자동유지. 검증: tsc 0 · 단위 101/101 · `npm run build` exit 0.

## ✅ 2026-06-17 — A) 동네딜 상품 일괄 등록 도구 + B) 도매몰 머니로직 검증 (대표 "모두 진행, 순서대로")
**A. 동네딜 채우기 도구** (`admin-products.routes.ts` + `AdminDongnedealImportPage`): "총 0개"를 채울 수단. `/api/admin/dongnedeal/{stats,seed-demo(POST/DELETE),bulk-import}` — 동네딜 피드 형태(category meal/beauty/etc/general + is_active=1 + group_buy_status='active')로 products INSERT → 즉시 노출. CSV 한글 헤더(상품명/카테고리/판매가/정가/매장명/주소/이미지URL/설명) 행단위 검증·리포트, 카테고리 별칭 매핑, **숙소는 거부**(product_stay_info 필요 — 숙소 전용 등록). 데모 10종(slug `demo-deal-`, 멱등) + 정리. UI = 어드민 '🏪 오프라인 공구 › 동네딜 상품 등록'(/admin/dongnedeal-import), 현황카드(전체/노출/데모/카테고리별)+CSV. adminApp 글로벌 requireAdmin+RBAC. ⚠️ **실상품 데이터는 대표 준비 필요**(도구는 빠른 입력 수단).
**B. 도매몰 머니 검증**(병렬 에이전트 read-only 감사): **수식·테스트 전부 정상** — `splitWholesaleUnit`(제조사=max(원가,round(공급가×(1−수수료%))), 플랫폼=공급가−제조사, 합보존)·`distributorPriceFromRetail` 확인, **unit 130 tests pass**, **표시가=청구가=정산액 동일 보장**(단일 SSOT 동기계산), **환불 역전 멱등**(admin full + supplier line, productIds-scoped, margin_total 비례역전). 기본 수수료 10%(=제조사 90%). `WHOLESALE_SETTLEMENT_E2E.md` §4 보강(예치금 환원 명시·margin_total 감소 체크·부분환불 행). ⚠️ **남은 건 2가지 — (1) "플랫폼=공급가 10%" 모델이 대표 의도인지 1줄 확인, (2) staging 실결제 1회**(코드는 검증 완료, 외부망 차단이라 실결제는 권한자 실행).
- 검증: tsc 0 · client+worker build 0 · 테마·sql-bind·not-null·api-auth(경고는 기존 집계) 통과.

## ✅ 2026-06-17 — 도매 관리자 보안 게이트 데드락/깜빡임 수정 + 후속 개선 (대표 신고 연쇄)
**배경**: 강제 PIN(이 세션 외) + 도매 RBAC(타 세션) 교차로 도매 역할 관리자가 깨짐. 4갈래 순차 진행.
- **깜빡임 무한루프 수정** (`AdminLayout`): wholesale 역할 + `must_set_pin` 일 때 PIN 게이트(→`/admin/set-pin`) ↔ RBAC 리다이렉트(→`/admin/wholesale-overview`)가 핑퐁 → remount 폭주 + dashboard-notifications 429. 보안 self-service 경로(`/admin/set-pin`,`/admin/2fa`)를 RBAC 리다이렉트에서 면제.
- **403 데드락 수정** (`admin-rbac.ts`+`admin-roles.ts` SSOT): scoped(wholesale) 역할이 강제된 `POST /set-login-pin` 자체를 RBAC 가 막아 PIN 설정 불가(가둠). `isSelfServiceAdminPath()` 추가 → super-only/scoped 검사보다 먼저 통과(본인 user.id 만 변경이라 안전). 유닛테스트 추가.
- **새 관리자 추가 400**: 백엔드가 name 필수였는데 폼은 선택 → name 옵셔널(이메일 local part fallback).
- **PIN 분실 복구 UI** (`AdminAccountsPage`+`admin-accounts.routes`): 슈퍼 전용 `POST /admins/:id/reset-pin`(login_pin_hash NULL, 감사) + 'PIN 초기화' 버튼.
- **홈 일반상품 카드 폭** (`HomeProductsRail`): 프레임(720) 안 xl:grid-cols-6 → sm:grid-cols-3 cap.
- **PC 프레임 전수 점검**: StaysSearchPage/FlashDealsHero 그리드 cap, CartTab 고정바 `app-frame-bar`(마이페이지 버튼 프레임 넘침), 상품상세(/products/:id) 720 프레임(lg 2단 짜부 방지).
- **링크샵 #6 통일**: 셀러 링크샵에 '방문자 미리보기'(previewAsVisitor) 추가 — 큐레이터와 파리티. 기본 off 라 기존 동작 불변.
- 검증: tsc 0 · build 0 · admin-roles 유닛 13 통과.
- **외부(대표 액션)**: ① 기프티쇼 이미지 리사이즈 복구 = giftishow 측 CF IP 화이트리스트 필요(현재 raw URL 무료 동작) ② KT 인앱 바코드/PIN = KT Alpha PIN 발급 계약 확인 후 CF env `KT_ALPHA_PIN_MODE=1`.

## ✅ 2026-06-17 — 숙소 인라인 회귀 자체수정 (사용자 "다른 문제 없을까?" → 감사로 발견)
**발견**: 직전에 숙소를 동네딜 그리드에 인라인 필터로 옮겼는데, **숙소 상품은 `products.price=0`(실가격은 객실 테이블 별도) + 위치·평점이 `product_stay_info` 별도 테이블**이라 그리드 카드론 **₩0·정보누락으로 깨짐**(seller-stays INSERT 확인). group_buy_status 기본값 'active'라 stays 가 피드에 들어와 '전체' 탭에도 ₩0 카드로 샐 수 있었음(잠재 선재버그 포함).
- **수정(올바른 방향)**: 숙소는 전용 `/stays`(=`/api/group-buy/stays/search`, product_stay_info join)에서만 표시. ① 숙소 탭/사이드바 → `/stays` 환원 ② `GroupBuyListPage` 클라 필터에 `stay_voucher` **그리드 전역 제외**(전체 포함 — ₩0 카드 누수 차단) ③ 인라인용 stay 카드 라우팅/뱃지/CTA·Calendar import 정리(clean revert) ④ **`/stays` 헤더에 동네딜 카테고리 칩 추가**(전체/맛집식사권/미용/숙소(active)/기타/일반상품) — 숙소가 "다른 카테고리처럼" 보이길 원한 최초 요구를 예약 흐름 깨지 않고 충족(내비 일관성).
- 일반 상품 피드 수정([UNLOCK_LOADING])·i18n·PC 바탕 다크는 그대로 유효. 검증: tsc 0 · build 0 · 테마·머니패턴 통과 · i18n 키 타 사용처 0(이모지 부작용 없음).

## ✅ 2026-06-17 — 역할 명칭 확정(유저 / 사업자 유저) + 사업자등록 진입 일원화 (사용자 결정)
**사용자 확정 스키마**: 링크샵 가진 사람 = **유저**(회원가입하면 누구나, /u/{handle} 자동 생성, 추천/핀). 사업자등록+판매승인 받으면 = **사업자 유저**(판매 + 현금정산). 큐레이터/크리에이터/인플루언서/셀러/매장 → 이 2개로 흡수(사용자-가시 라벨; 코드 식별자·seller_type 값은 유지). 에이전시·도매 공급자는 B2B 조직 축이라 별도 유지.
- **셀러 대시보드 실측 주체**: store_owner(매장/사업자) = 주력·활성(신규 가입 전부 이쪽), influencer(크리에이터) = 라이브 중단으로 사실상 휴면(신규 생성 경로도 막힘). → 대시보드 ≈ "파는 사람(사업자 유저)"의 도구.
- **사업자등록 진입 일원화** (`CuratorEarningsPage`): "사업자 등록"이 2군데였음 — BusinessSection(users.business_*, 현금정산용)과 SellOwnProductsCTA(매장등록, 판매용). 그런데 **현금 출금 게이트(curator.routes:861)가 이미 '연결 승인 매장'을 요구** → BusinessSection-only 등록은 현금정산 불가(오해유발). **BusinessSection 은퇴**(렌더+함수 제거), SellOwnProductsCTA를 단일 "사업자 등록 → 사업자 유저" 진입으로. 출금 게이트/은행(WithdrawModal 입력)/세금(curator_withholding_rate policy)/세무 backend **전부 무수정** — 진입 UI만 1→통합.
- **라벨 정리**(CuratorEarningsPage): 판매자/매장 → "사업자 등록"·"사업자 유저". **단 "셀러 대시보드"는 그대로 유지**(사용자 결정 2026-06-17: 사람=유저/사업자 유저, 도구=셀러 대시보드). → `/seller/*` 내부 "셀러" sweep 은 **불필요**(도구 명칭이라 OK).
- 검증: tsc 0 · build(client+worker) 0 · 테마검사 통과. ⚠️ getBusiness 의 is_store_seller 파생(직전 커밋)은 BusinessSection 은퇴로 미사용 dead 됐으나 read-only·무해라 존치.

## ✅ 2026-06-17 — 크리에이터→판매자 통합 + 링크샵 flip-flop 수정 (사용자 "모두 진행")
**배경**: 사용자가 링크샵(`/u/{handle}`)이 새로고침마다 셀러↔핀 "왔다갔다" 신고 + "사업자 등록한 유저가 자기 상품도 올리게" 요청. AskUserQuestion 으로 (어드민 승인 후 판매 / 인라인+제한 대시보드) 확정 후 4건 진행.
- **#0 발견 가능성 (commit 54a7dd0)**: 카카오 유저는 마이페이지 셀러전환 버튼이 숨겨져(`SellerSwitchInline` is_kakao_user && !has_seller→null) 사업자 등록해도 판매 입구가 안 보였음. CuratorEarningsPage 에 `SellOwnProductsCTA`(셀러 상태별: 없음→등록 / pending / approved→등록·대시보드 / rejected) 추가.
- **#2 flip-flop 근본수정 (commit 05f4eed, [UNLOCK_LOADING])**: `/api/curator/:handle` `publicCache(300)+cacheControl(60,900)` → `edgeCache(300)`. 원인: publicCache(bypassIfAuthed:false)가 URL-key 캐시를 소유자에게도 서빙 + cacheControl 이 핸들러의 owner `no-store`(curator.routes:178)를 덮어씀 → `linked_seller`(셀러 inline vs 핀)가 stale↔fresh 튐. edgeCache 는 인증요청 우회 → 소유자 항상 fresh. 익명/SSR self-fetch/cron 은 caches.default 캐싱 → SSR 0-RTT/CDN분리/useKv:false 불변. audit log 기록됨.
- **#1 사업자정보 이중입력 제거 (commit b4f62b7)**: 현행 모델(SERVICE_MODEL v2 "셀러=매장")에서 판매=매장(store_owner) 등록. CTA 타깃을 비활성 `/seller/register/business` → 현행 `/seller/register/supplier`(register-from-user store_owner). SellerRegisterSupplierPage 가 `?from=curator` 진입 시 `/api/curator/me/business` 의 상호/사업자번호로 폼 자동채움(빈 필드만, representative/start_date 는 큐레이터측 미저장).
- **#3a 인라인 빠른 상품등록 (commit c4be6f8)**: 승인 판매자는 콘솔에서 `QuickProductModal`(상품명/가격/재고/카테고리)로 대시보드 안 나가고 등록. 기존 POST /api/seller/products 재활용, 셀러토큰 transient(switch-to-seller accessToken 헤더만, localStorage 미저장). 이미지/상세는 대시보드에서.
- **#3b 제한 대시보드**: SellerLayout 의 mode/hideFor/seller_type 스코핑으로 **이미 충족**(store_owner=라이브·큐레이터·영입·prospects 숨김) → 무변경(튜닝된 공용 nav 회귀방지).
- **후속(사용자 "진짜 일원화 — 현금정산도 자동", commit 71301d4)**: ① **사업자등록 일원화** — 현금 출금 게이트(curator.routes:861)·payout_mode(1015)가 이미 '연결 승인 매장' 기준인데 GET /me/business 만 정합 안 맞아 매장이어도 '사업자 등록하기' 중복 프롬프트. GET /me/business 가 승인 연결매장 있으면 `business_status='verified'`(+is_store_seller) **read-only 파생** 반환 → BusinessSection '✅ 매장 등록=현금정산 활성' (출금 게이트·머니쓰기 무변경) → 매장 1번 등록으로 판매+추천수익 현금정산 둘 다 열림. ② **빠른등록 이미지** — QuickProductModal 이 오픈 시 seller_token 보장(switch-to-seller 저장; BottomNav DISPLAY=active_role 기준이라 소비자 UI 무영향) → ImageUpload+상품POST 자동토큰 동작(transient 헤더 방식 폐기).
- **개념 모델 확정(사용자)**: `/u/{handle}` 링크 고정 + 능력 켜질수록 같은 링크에서 더 열림(기본 핀 → +판매승인 상점 → +라이브). 대시보드도 seller_type 으로 해당 기능만 노출. = SERVICE_MODEL §1 "신분이 아니라 능력". 미진행(의도적): 단일 레코드 정체성 / 단일 대시보드(주문·정산까지 한 화면) — 큰 리팩토링이라 보류.
- 검증: tsc 0 · `npm run build`(client+worker) 0 · 테마검사 통과. 잠금 파일: edge-cache.ts/curator 핸들러 무수정(미들웨어 1줄만).
- ⚠️ **미검증(실환경 권장)**: ① flip-flop 실제 해소 prod 확인(승인직후 ≤900s 익명캐시 transition 은 cron/TTL self-heal) ② 매장 가입→어드민 승인→인라인 등록 E2E 1회 ③ QuickProductModal 의 transient 토큰 상품등록 실결제전 1회.

## ✅ 2026-06-17 — 동네딜 카테고리 마감재 4종 (사용자 "모두 다 이상적으로")
**배경**: 숙소 인라인화·일반상품 추가 후 "더 이상적으로?" → 4건 전부 진행.
- **#1 일반 상품 구조적 빈 카테고리 근본수정** (`group-buy-public.routes.ts`, [UNLOCK_LOADING]): general 이 `VOUCHER_CATEGORIES` 에 없어 항상 voucher 폴백 → 클라 필터에서 0개로 사라지던 버그. `category=general` 요청 시에만 `categories=['general']`. **기본 피드/캐시/SSR/Cache-Control 전부 불변**(general 전용 캐시키 신규). ※ "총 0개"의 나머지(맛집/미용/숙소)는 **실데이터 없음**(코드 정상) — 활성 group_buy 상품 등록 필요.
- **#2 숙소 카드 표식** (`GroupBuyListPage` GroupBuyGridCard): stay_voucher 카드에 '🏨 숙박' 뱃지(그룹 '달성' 대신). 카드 클릭은 이미 `/stays/:id`(예약).
- **#3 숙박 날짜검색 강조**: 숙소 필터 시 '날짜·인원 검색'(→/stays) CTA 를 outline→indigo 채움으로 부각(숙박은 날짜 검색이 핵심).
- **#4 i18n 정식 현지화**: 인페이지 카테고리 탭(`groupBuy.category*` flat, 이모지 포함)·사이드바(`category.general`)·`groupBuy.stayBadge` 6개 언어 — 기존 ja/zh 영어 placeholder('Restaurant Vouchers') + beauty/stay/etc 키 부재(전 언어 한글 폴백) 해소.
- 검증: tsc 0 · `npm run build` 0 · 테마검사 통과.

## ✅ 2026-06-17 — 숙소 카테고리 인라인화 + 일반 상품 카테고리 추가 (사용자 신고)
**신고**: ① `/stays` 숙소는 다른 동네딜 카테고리처럼 같은 그리드/탭으로 안 보이고 별도 페이지로 튐 ② PC 사이드바 CATEGORY 에 '일반 상품' 누락.
- **숙소 인라인화** (`GroupBuyListPage`): 숙소 탭의 `navigate('/stays')` 리다이렉트 제거 → 다른 카테고리처럼 `?category=stay_voucher` 로 동네딜 그리드 안에서 필터. 숙소는 products 테이블에 `category='stay_voucher'` 로 저장되므로 피드에 포함됨(확인). **예약 보존**: `GroupBuyGridCard` 가 stay_voucher 카드만 클릭 시 전용 `/stays/:id`(객실·날짜 예약)로 라우팅(나머지는 `/group-buy/:id`), prefetch 도 stay 제외. 날짜·인원 전용 검색은 숙소 필터 시 `/stays` 링크로 보존(가역).
- **사이드바** (`DesktopLiveSidebar`): 숙소 → `?category=stay_voucher`(인라인), **'일반 상품'(general) 카테고리 추가**(Package 아이콘). MENU '오프라인 공동구매' 활성 정규식에 general 포함(이중강조 방지).
- **i18n**: `category.general`(nested) + `groupBuy.stayDateSearch`(flat) 6개 언어. (i18next ignoreJSONStructure 로 nested/flat 모두 resolve 확인.)
- 검증: tsc 0 · `npm run build` 0 · 테마검사 통과.
## ✅ 2026-06-17 계정 보안 — 로그인 보안 PIN 강제 + 로그인 이력(IP) (대표 요청 "서로 계정 로그인 방지")
> ⚠️ 정정: 대표 결정으로 **앱 TOTP → 6자리 보안 PIN** 전환. 서버 PIN(`login_pin_hash`/`pin_required`/
> `must_set_pin`/`POST /api/admin/set-login-pin`, 단순PIN 차단). 프론트 PIN 정합(AdminLoginPage PIN 입력 ·
> AdminLayout `must_set_pin`→`/admin/set-pin` 게이트 · 신규 `AdminPinSetupPage`). 강제=super_admin+wholesale.
> 잠금복구 `GET /api/_internal/reset-pin`(슈퍼). 또: 새 관리자 추가 비번 규칙 완화(8자+/2종+, 대문자 강제 X —
> `validatePasswordComplexity({relaxed:true})`). 아래 원문(TOTP)은 히스토리.
**배경**: 도매 동업자 다수 → 계정 공유/도용 방지. 2FA(인증앱 TOTP)가 가장 강력 — 인프라(/api/2fa/* generic store=admins.totp_secret/totp_enabled, Admin2FASetupPage /admin/2fa)는 있었으나 **로그인 강제 미배선**.
- **2FA 강제 (도매 파트너 + 슈퍼)** — `admin.routes /login`: 비밀번호 OK 후 `admins.totp_enabled=1`이면 OTP 필수(미입력→`twofa_required` 토큰 미발급, 불일치→401). 강제 대상 역할인데 미등록이면 토큰 발급+`must_enroll_2fa`. **컬럼 미존재 catch→fail-safe(로그인 안 깨짐)**. 검증=utils/totp verifyTOTP(generic store와 RFC6238 호환 확인).
- **프론트**: AdminLoginPage OTP 입력 단계(`needOtp`/`twofa_required`) + `must_enroll_2fa`→`/admin/2fa` 강제 + AdminLayout 등록 게이트(미등록 시 다른 경로 진입→2FA 페이지 가둠, verify 성공 시 해제). Admin2FASetupPage verify 성공 시 게이트 해제+랜딩.
- **로그인 이력(IP)** — `/login` 성공 시 `admin_login_history`(admin_id/email/ip/UA) fail-soft INSERT(ensure WeakSet). 뷰어 `GET /api/admin/login-history`(슈퍼 전용 isSuperOnlyAdminPath) + `AdminLoginHistoryPage`(/admin/login-history, 시스템 nav). repair-schema 테이블 등록.
- **잠금 복구**: `GET /api/_internal/reset-2fa?email=`(슈퍼만) — 기기 분실 시 2FA 해제→재등록. + must_enroll 게이트라 첫 등록은 잠금 없음(토큰 발급+유도).
- ⚠️ **롤아웃**: 배포 후 대표님(super)부터 다음 로그인 시 2FA 등록 강제됨 — QR 스캔(Google Authenticator) + **secret 백업 권장**. 검증: tsc 0 · theme · client+worker build. ⚠️ 실 TOTP 라운드트립 staging 1회 권장.

## ✅ 2026-06-17 도매 전용 어드민 역할 `wholesale` (외부 동업자용 — 권한 분리, 앱 분리 X)
**배경**: 도매몰 동업자(외부 파트너)가 어드민 접근 필요 → 완전 분리 대신 **RBAC 도메인-한정 역할**(대표 "추천대로", 범위 "도매 전체 정산·머니 포함"). 별도 앱 복제 X(유지보수·보안 2배 회피) — 같은 코드, 역할로 격리.
- **SSOT `admin-roles.ts`**: `wholesale` 역할 신설(도메인-한정). 일반역할(ops/cs/finance=읽기 개방)과 달리 **읽기·쓰기 모두 도매 도메인만** — 유어딜 소비자 어드민 데이터 격리. `SCOPED_ROLE_DOMAINS`(prefixes: wholesale/partnership/distributor/supplier, exact: suppliers) + `isScopedAdminRole`/`scopedRoleCanAccess`. `canAdminRoleMutate` 가 scoped 위임.
- **미들웨어 `admin-rbac.ts`**: scoped 역할이면 super-only 차단 후 `scopedRoleCanAccess` 로 읽기·쓰기 동시 게이트(그 외 /api/admin/* 읽기도 403). `/api/admin-payouts/*`(payouts)·users·settlements·group-buy 등 전부 차단.
- **계정 발급**: `admin-accounts.routes` VALID_ROLES + `AdminAccountsPage` ROLE_OPTIONS 에 '도매 파트너' 추가(슈퍼가 발급). admins.role CHECK 없음(repair-schema) → 안전.
- **프론트**: AdminLayout 가 wholesale 역할에 **도매 3그룹(domain:'wholesale')만 노출** + 비-도매 경로 진입 시 `/admin/wholesale-overview` 리다이렉트(깨진 화면 방지). 로그인 랜딩도 도매 현황.
- 검증: tsc 0 · admin-roles 단위 12(scoped 4 신규) · client+worker build. 기존 super/admin 계정 무영향(신규 역할 계정 0). **다음(Phase 2): 처리자(누가 처리했는지) 표시 — 대표 요청.**

## ✅ 2026-06-17 — PC 좌측 사이드바 IA: '오프라인 공동구매(동네딜)' 정합 (사용자 신고, AskUserQuestion 확정)
**신고**: PC 사이드바 MENU 가 홈/공구/식사권인데 '공구'·'식사권' 둘 다 /group-buy 계열이라 혼란 + CATEGORY 가 '식사권' 하나뿐. 대표 확정(AskUserQuestion): **MENU 통합** + CATEGORY = 동네딜 정의.
- **MENU 통합** (`DesktopLiveSidebar.tsx`): '공구'(nav.groupBuy)+'식사권'(/meal-vouchers) → 단일 **'오프라인 공동구매'**(nav.offlineGroupBuy, MapPin, /group-buy). /live·/browse 항목은 플래그 숨김이나 가역 위해 보존.
- **CATEGORY = 동네딜 4종** (`GroupBuyListPage` 정의와 1:1): 맛집 식사권(/group-buy?category=meal_voucher)·미용(beauty_voucher)·숙소(/stays 전용)·기타(etc_voucher). CATEGORY 렌더를 NavBtn 재사용으로 단순화.
- **URL 단일 소스** (`GroupBuyListPage`): `?category=` → category 상태 동기화 useEffect 추가 + 인페이지 탭도 setSearchParams 갱신 → PC 사이드바(상주)에서 이미 /group-buy 에 머문 상태에서도 카테고리 전환 반영(+공유·뒤로가기). 인페이지 탭/지역필터와 무충돌(category param 있을 때만 적용·탭이 URL 기록).
- **i18n**: nav.offlineGroupBuy + category.{mealVoucher,beauty,stay,etc} 6개 언어 추가(기존 category.* 비어있던 것 정식화).
- 검증: tsc 0 · `npm run build` 0 · 테마검사 통과.

## ✅ 2026-06-17 — PC 프레임 바탕(gutter)이 다크 테마에서 흰색으로 남던 문제 (사용자 신고)
**신고**: PC(`/user/profile` 등)에서 다크 테마인데 프레임 양옆 바탕이 흰색. **원인**: PC 컨슈머 프레임(`.app-framed`, 430/720px 가운데 액자)의 양옆 바탕을 `body:has(.mobile-app-container.app-framed)` CSS 만으로 칠했음 → `:has()` 미지원 브라우저/스테일 캐시/캐스케이드 엣지에서 라이트 바탕(`#e9ebef`)이 남을 수 있음.
- **fix(결정적)**: `MobileAppLayout` 이 테마 store 의 `applied`('light'|'dark') 로 `<body>` 에 `app-frame-host`(+다크면 `app-frame-dark`) 클래스를 직접 토글 → `index.css` `body.app-frame-host[.app-frame-dark]` 규칙으로 바탕색 확정(다크=`#000`). 기존 `:has()` 규칙은 첫 페인트용으로 존치(2차).
- ⚠️ `:has()` 규칙과 body-class 규칙은 **반드시 분리**(comma 목록 금지) — `:has()` 미지원 브라우저가 목록 전체를 무효화하기 때문. PC(`min-width:1024px`)에서만 적용, 모바일/대시보드/도매몰/비디오 무영향.
- 검증: tsc 0 · `npm run build`(client+worker+prepare) 0 · 테마검사 통과 · 컴파일된 CSS 에 두 규칙 모두 존재 확인. **잠금 파일 무변경**(SSR inject/edge-cache 등).

## ✅ 2026-06-17 도매몰 채우기(일괄 등록) + 출시 준비 3트랙 + UTONG START 로고 벡터화
**배경**: 도매몰이 사실상 비어있음(공급상품 1개) → "채울 수단" 신설 + 출시 전 블로커 정리. 대표 "모두 다 진행".
- **(채우기) 어드민 CSV 일괄 등록** — `POST /api/admin/distributor/supply-bulk-import`(finance/admin/super, RBAC distributor 세그먼트). 제조사 self-serve bulk 와 동일 한글 CSV 포맷이되 **즉시 노출**(is_active=1, approved). supplier_id 없으면 직매입 제조사 find-or-create. 판매가 미입력 시 공급가×1.6 자동. 청크 batch + 행별 리포트 + audit log. UI `AdminWholesaleImportPage`(/admin/wholesale-import, nav '상품 일괄 등록') — 제조사 선택/직매입 자동 + CSV 붙여넣기·업로드·템플릿 + 결과표.
- **(Track 2 카탈로그) 데모 정리** — `GET /supply-stats`(전체/실/데모/노출/제조사 카운트) + 임포트 페이지에 현황 카드 + 데모(slug `demo-wholesale-%`) 정리/채우기 버튼(기존 seed/delete 엔드포인트 재사용). 실상품 등록 전 데모 분리.
- **(Track 1 머니 검증) staging E2E** — `docs/WHOLESALE_SETTLEMENT_E2E.md`(가격표시·정산분배·원가하한·환불역전·플러스구독·배송비 체크리스트 + 워크드 표) + `wholesale-settlement-scenarios.test.ts`(문서 숫자를 실코드로 잠금 — 드리프트 0). ⚠️ **line-14 플랫폼 모델(공급가의 10%) 대표 1줄 확인 + staging 결제 1회 필요**(머니 4건 미검증 잔존).
- **(Track 3 RBAC) 확인** — admin-rbac.ts 전역 미들웨어 이미 마운트(`/api/admin/*`)+테스트 존재. 신규 bulk-import 가 distributor(finance) 영역임을 admin-roles.test 에 잠금(ops/viewer 차단 검증).
- **(로고) UTONG START 벡터화** — `WholesaleLogo.tsx`: PNG `<img>` → **inline SVG/HTML 벡터**(네이비 U + 오렌지 상승 화살표 마크 + TONG 네이비/START 오렌지 italic). WholesaleWordmark 15곳 동시 반영, dark=네이비→흰색. 모든 height 선명. PNG 되돌림 경로(WHOLESALE_LOGO_SRC) 보존.
- 검증: tsc 0 · 단위 16(roles+commission+scenarios) · client+worker build · theme. **머니 로직 무변경**(가격/정산 SSOT 호출만, 신규 적립/차감 0).

## ✅ 2026-06-17 — 교환권 상세 페이지 리디자인 (Claude Design `Voucher - Final (A)`)
시안 = A·Refined Classic(6안 중 사용자 확정). 다크 네이비 CTA + 브랜드 옐로우(#FFCE00) 포인트, 미니멀 톤 유지. 대상 `VoucherDetailPage` (`/vouchers/:id`).
- **상품 카드 = 그라데이션 유지**(사용자 지시): 풀블리드 사진 → `radius:28px` 그라데이션 카드(`#F7F8FA→#EFF1F4`, 다크 변형) 위 상품 `object-contain`+drop-shadow. 이미지 없으면 그라데이션만.
- **정보 재구성**: 옐로우 카테고리 칩 + 상품명(23px) + 딜 가격(32px) + 구분선 + 정보행(유효기간/사용처/환불 불가) + "매장에서 바코드 제시 후 사용 가능" 사용 안내. 기존 "교환권 안내" 3행 카드 제거.
- **상품 상세(`description`)는 "매장에서 바코드 제시 후 사용 가능" 아래 배치**(사용자 지시).
- **보유 딜 + 교환 후 잔액 박스**(chat 요청): `useBalance()`(localStorage 0ms) — 로그인 시 노출, 부족 시 "딜 부족"(빨강). 다크 네이비 그라데이션 CTA + 수량 스테퍼(−는 1일 때 비활성).
- **미도입(실데이터 원칙)**: 시안의 `정가 ₩4,500` 취소선/`52% 할인`·`~2026.09.15` 만료일·옵션 서브타이틀 — 데이터 모델에 필드 없어 가짜 수치 금지. `voucher_expiry` 있으면 그대로 표시.
- **잠금/중요 로직 무변경**: `useInvalidateMyVouchers()`(발급 후), `__SSR_INITIAL_DETAIL__` SSR consume, idempotency_key, `INSUFFICIENT_POINTS`→충전, `PHONE_REQUIRED` 모달, 어필리에이트 track. 모든 토큰 `dark:` variant(토글 지원).
- 시안 archive: `docs/design/voucher-detail.md` + `voucher-detail-final-A.dc.html`. 검증: tsc 0 · `npm run build` 0 · 테마검사 통과.
- **`(KT Alpha B2B 정책)` 표기 근본 제거 (사용자 "근본적으로 진행")**: 과거 sync 가 `products.description` 에 박아둔 공급사 정책 괄호가 prod DB 행에 잔존(commit addbc2b 는 sync 코드만 수정 → 신규만 적용) → 같은 상품 재조회 시 계속 노출. ① 렌더 strip(`stripSupplierPolicy`, 방어선) ② **DB 정정**: 공용 helper `worker/utils/kt-alpha-cleanup.ts`(단일 REPLACE/TRIM UPDATE, 멱등, node:sqlite 로 검증) — admin-kt-alpha `POST /kt-alpha/cleanup-descriptions` + `run-all-backfills`(`descriptions_cleaned`) + AdminKtAlphaPage "🧹 설명 정책표기 정리" 버튼. ③ **자동 1회**: `kt-alpha-catalog-sync` cron(매일 03:00 UTC)에 one-time 플래그(`platform_settings.kt_alpha_desc_policy_cleanup_v1`) 가드로 헬퍼 1회 자동 실행 → 운영자 클릭 불필요(다음 sync tick 에 정정 후 플래그 set, 이후 skip). **운영자 액션 0.**
- **교환권 목록(`/vouchers`) 카드 = 상세와 같은 톤 (사용자 "같은 톤으로 진행")**: `VouchersPage` `VoucherCard` 를 dominant-color 풀틴트 카드 → **클린 화이트 카드(다크 토글 대응) + 은은한 그라데이션 이미지 영역 + 브랜드 옐로우(#FFCE00) 할인 배지 + 잉크 가격**. 홈(embedded)·`/vouchers` 가 모두 `dark:` variant 기반(MainHomePage 동일)이라 테마 안전 — 검증함. **잠금 전부 보존**(SSR consume·default sort price_low·img width/height/srcSet/lazy/fetchPriority·`dominant_color` 플레이스홀더+`reportDominantColor` 파이프라인·React.memo). dominant_color 는 풀카드 틴트 → 이미지 로딩 플레이스홀더로 역할만 축소(데이터/리포트 불변). skeleton 도 카드 모양 정합. 미사용 `cardGradient` import 제거. tsc 0 · build 0 · 테마검사 통과.

## ✅ 2026-06-16 어드민 활동로그(A) + 역할권한 강제(B)
- **(A)**: 뷰어/엔드포인트/자동기록 미들웨어/nav 전부 이미 존재 — 유일 결함 `admin_audit_logs` 테이블이 repair-schema 누락(prod 로그 유실) → 추가.
- **(B) RBAC**: SSOT `src/shared/admin-roles.ts` + 전역 `worker/middleware/admin-rbac.ts`(`/api/admin/*`,`/api/admin-payouts/*` Bearer role 디코드). super=전권/admin=운영전권/viewer=읽기전용/ops·cs·finance=도메인 변경만, 읽기 전역 허용. `/admins`·`/audit-logs`=슈퍼전용(2FA 제외). 프론트 admin_role 저장+nav 게이트+배지. 테스트 8. 신규역할 기존계정 0 → 무영향. ⚠️ prod admins CHECK 제약이 옛값이면 제한역할 생성 막힐 수 있음(에러 시 안전 재빌드).

## 🔴 2026-06-16 — 플랫폼 수수료율 어드민 조정 (정산 분배, 머니 크리티컬) — ⚠️ staging E2E 필수
대표 확정: "공급가에 플랫폼 마진 N%가 포함" (공급가 8,500 → 플랫폼 850 / 제조사 7,650).
- **신설 설정** `platform_settings.wholesale_platform_commission_pct`(기본 10, 0~90) — `/admin/distributor-grades` 에서 조정.
- **정산 분배 변경**(`wholesale-settlement.ts`): 제조사 정산 = `max(원가, round(공급가×(1−수수료%)))`(원가 이상 보장), 플랫폼 = 공급가 − 제조사. `splitWholesaleUnit()` SSOT + `loadPlatformCommissionPct()`. **기존엔 제조사=원가·플랫폼=스프레드 전체 → 이제 플랫폼=공급가의 N%(제조사가 90% 수령)**. ⚠️ 신규 주문 제조사 지급액 상승/플랫폼 마진 하락(의도).
- **주문 생성**(`wholesale.routes.ts`): supply_total = Σ제조사정산, margin_total = subtotal−supply_total(=Σ수수료). 정산 호출이 같은 요청 동기 실행 → comm% drift 없음. 환불 역전은 저장된 settlement supply/retail 사용 → 자동 정합.
- **어드민 UI**: AdminDistributorGradesPage 수수료율 입력(%) + 예시 안내. distributor-admin GET/PATCH `/auto-grade/settings` 에 platform_commission_pct 추가.
- 검증: tsc 0 · split 단위테스트 8 통과 · build · money/theme. **⚠️ staging 결제→정산 E2E 필수**(제조사 지급=공급가×90%·원가하한, 플랫폼=10%).
- ⚠️ 미해결 질문: 이 모델은 플랫폼 마진이 '스프레드 전체'→'공급가 10%'로 **하락**. 대표 의도 재확인 필요(공급가에 10% 포함 = 맞으면 그대로).

### 후속 대기 (사용자 요청 — 추천 후 승인 대기)
- **어드민 하위계정 권한 제한**: requireAdminRole() 인프라는 있으나 일부 엔드포인트(payouts/settlement)에만 적용 → 대부분 엔드포인트는 requireAdmin(아무 어드민이나 전권). 제한 역할(ops/cs/finance/viewer)을 실제 강제하려면 어드민 라우트 전반에 role 게이트 적용 필요(큰 작업).
- **어드민 활동 로그 뷰어**: writeAuditLog+audit_logs 인프라 존재(55개 호출). 뷰어 페이지(`/admin/audit-log`) + 커버리지 보강 제안.

## 🔴 2026-06-16 — 등급/마진 모델 전면 전환 (대표 확정, 머니 크리티컬) — ⚠️ staging E2E 필수
**모델 변경**: 등급 = 일반/프로/프리미엄(가칭). 마진 = **판매가(권장소비자가) 대비 보장마진** (일반 15% / 프로 30% / 프리미엄 38%).
- **공식 전환**(`distributor-pricing.ts`): (구) `공급가 = 원가 × (1+마크업)` → (신) **`공급가 = max(제조사원가, 판매가 × (1−보장마진%))`** (원가 하한=플랫폼 손실 차단). 신규 `distributorPriceFromRetail()`. `resolveDistributorPrice` 에 `retailPrice` 인자 추가. `DEFAULT_GRADE_MARGINS` A38/B30/C15/D8/OEM40/SPECIAL45.
- **전 호출부 retailPrice 배선**(wholesale.routes 12곳: 카탈로그 리스트/상세/홈/재주문/**주문청구**/미리보기/엑셀·CSV 내보내기/제안 + wholesale-board 찜 + distributor-admin 전등급 미리보기). 누락 시 일부 화면만 옛값=가격 불일치 → 전수 배선. SELECT 에 `p.price AS retail_price` 추가.
- **prod 데이터 마이그레이션**: `distributor_grades` 값 의미가 마크업→보장마진으로 flip → `ensureGrades` 에 1회 마이그레이션(flag `wholesale_grade_model_v2_20260616`): A38/B30/C15 + 라벨(프리미엄/프로/일반). 시드 기본값도 신모델.
- **명칭/구독료**: 플러스→**프로**, 프로 연 구독료 기본 **100만원**(was 99,000). GRADE_NAME/GradeSheet(마진 15/30/38)/PlusMembershipCard/cron 알림/어드민 라벨 전부 정합.
- **표시 마진**: `marginVsRetail()` 신설(판매가 대비) — 카드/상세 '마진 +N%(원가대비)' → '마진 N%(판매가대비)'.
- **정산 불변**: 제조사 = 원가(supply_price) 정산, 플랫폼 = 공급가−원가 스프레드(자연 ~10%). 정산 로직 무수정.
- 검증: tsc 0 · 전체 unit 2104 통과(pricing 14 재작성) · client+worker build · money/sql/theme 통과. **⚠️⚠️ 실 staging 결제 E2E 필수**(전 등급 표시가=청구가 일치, 원가 하한, 주문 차감) — 외부 검증 불가 환경이라 prod 반영 전 1회 필수.

### 후속 (2026-06-16, ①②③ 동시 진행)
- **① 판매가 필수화** — 제조사 상품 등록/수정 시 권장소비자가(판매가) 필수 + **공급가보다 높게**(폴백/동일가 차단). 서버 authoritative(POST `/products` + PATCH + price-change-request 전부 `<=supply` 400 `RETAIL_TOO_LOW`) + 클라(AddProductModal/PriceChangeModal required·검증). 신모델 마진 0 상품 생성 원천 차단.
- **② 운영 가이드 3종** — guide-seed-wholesale(공식 max(원가,판매가×(1−보장마진))+기본 38/30/15+프로 100만원), guide-seed-seller(등급 일반/프로/프리미엄+보장마진). auto-reference 재생성.
- **③ 문구 전수 정합** — 플러스→프로(wholesale-theme/Support/Dashboard/worker route/repair/distributor-admin), repair-schema `distributor_grades` 시드 신값/라벨(38/30/15·프리미엄/프로/일반), AdminDistributorGradesPage 공식 설명, 구독료 99,000→100만원 코멘트. (홈플러스=매장명 무관 유지)


## ✅ 2026-06-16 — 등급 Phase 2: 플러스 연 구독(예치금 결제) + 프리미엄 자동승급(기존) (②/4)
**모델**: 일반(C, 승인) / 플러스(B, 연 구독) / 프리미엄(A, 매출 자동). ⚠️ 도매몰 PG 미사용 — 구독료는 **예치금(계좌이체 충전 잔액)에서 차감**(Toss 아님).
- **프리미엄 자동승급은 이미 구현됨**(`handleWholesaleGradeEval`, BIZ-7 — GMV promote-only, 설정 가능, 주1회 cron + 어드민 트리거). Phase 2 신규 = 플러스 구독만.
- **신규 `wholesale-plus.routes.ts`** (`/api/wholesale/plus`): `GET /info`(구독료·잔액·등급·만료) + `POST /subscribe`(claim-before-charge: 행 CAS 선점 → `deductDeposit` 차감 → 실패 시 등급/만료 롤백 → 차감 원장 + 알림). 멱등(만료30일내만 1회 선점, 더블클릭/동시요청 이중차감 차단). 구독료 = `platform_settings.wholesale_plus_annual_fee`(기본 99,000).
- **만료 강등 cron** `lapseExpiredPlus`(wholesale-grade-eval 주간배치): `distributor_grade='B' AND plus_until < now` → 'C'. 구독만 plus_until 을 쓰므로 관리자/볼륨 B(plus_until=null)는 비대상. 가격 산식 불변(등급 컬럼만).
- **스키마**: `sellers.plus_until TEXT`(repair-schema + ensure). **UI**: `PlusMembershipCard`(대시보드) — 일반→구독 CTA / 플러스→만료·연장 / 프리미엄→안내. 예치금 부족 시 충전 유도.
- **운영 완성도 추가(같은 세션)**: ① 어드민 구독료 설정 UI(`distributor-admin /auto-grade/settings` 에 `plus_annual_fee` + `AdminDistributorGradesPage` 입력·등급모델 안내). ② 어드민 등급 라벨 매핑(A·프리미엄/B·플러스/C·일반 — 배정/임계/마진 테이블, `gradeLabel`+GRADE_NAME SSOT). ③ 만료 임박 알림 cron(`notifyExpiringPlus` — 14일내 1회, 20일 dedup). ④ GradeSheet 자가 구독 CTA(관리자 문의 → '플러스 구독하기'→대시보드).
- 검증: tsc 0 · client+worker build · money-pattern 통과. ⚠️ 실 staging E2E 1회 권장(차감·등급 반영·잔액부족 롤백). 남은 후속(사용자 입력 필요): 시드상품 정리(게이트 시 게스트 카탈로그 빔 — 결정 필요), 어드민 도매 nav IA 정리, ③ 드랍쉬핑(보류).

## ✅ 2026-06-16 — 상품별 배송비 표시 마감 (①/4)
- `/catalog/:id` 응답에 `product_shipping_fee`(상품별 배송비 meta) 추가 + `WholesaleProductPage` 정보리스트 '배송비' 행(상품별>정책>무료 + 무료배송 기준 안내). `PATCH /products/:id` 가 shipping_fee 수용(setSupplyMeta, meta-only 변경 허용). 체크아웃 computeSupplierShipping 과 동일 SSOT.

## ✅ 2026-06-16 — 도매몰 카탈로그 '상품 왔다갔다'(간헐적 빈 그리드) 영구 수정 (사용자 신고, prod-diag 실측)
**근본원인**(GitHub Actions prod-diag 측정 — 컨테이너 egress 차단이라 ground truth 수집): guest `/api/wholesale/catalog` 가 빈 결과(콜드 isolate/일시 pragma·D1 오류)를 만들면 ① 공유 캐시(CDN-Cache-Control max-age=300)에 빈 응답 저장 → 5분간 모두 빈 그리드 ② worker SSR 가 빈 배열을 initialData 주입 → guest 가 staleTime(60s) 동안 refetch 안 함 → 고착 ③ 클라 `.catch(()=>[])` 가 일시 오류를 '성공한 빈 결과'로 삼켜 재시도 없이 빈 그리드. isolate/캐시 상태별로 빈 결과가 들쭉날쭉 → '왔다갔다'.
- **서버**(`wholesale.routes.ts /catalog`): 빈 카탈로그(items=0)는 절대 공유 캐시 금지(`no-store`) — guest/등급/콜드 pragma 분기 전부. 비어있지 않은 기본 guest 응답만 SSR/prewarm 캐논 키(`/api/wholesale/catalog[?]`)에 명시적 `caches.default.put` → SSR 의 edge-read 가 매번 miss(self-fetch 261ms)하던 것 edge-hit(~4ms)로.
- **SSR 리더**(`wholesale-catalog/ssr.ts`): 빈 배열 페이로드는 '없음' 취급(length>0 일 때만 consume) → 빈 SSR 이면 클라가 정상 fetch 복구.
- **클라**(`WholesaleCatalogPage.tsx`): `.catch(()=>[])` 제거 + `retry:2` → 일시 오류 자동 재시도.
- **prod 검증**(배포 후 재측정): `x-ssr-status WHOLESALE:self-fetch-hit(261ms)` → `edge-hit(4ms)`, `/wholesale` TTFB 0.333s→**0.081s**, 카탈로그 API 2회 모두 non-empty. **Toss/금액/등급가 계산 무변경 · worker SSR inject 블록 무수정(잠금 보존)** — 캐시 정책·복구 경로만.

## ✅ 2026-06-16 — 도매몰 서브페이지·대시보드 시안 리디자인 (Claude Design `유통스타트 서브페이지/판매자·계정.dc.html`, opus)
**배경**: 네이비 #0C2454 + 오렌지 #FC5424 리브랜드 + UTONG START 로고(WholesaleWordmark) 통일 위에서, 서브페이지를 **장바구니부터 순차 리디자인**(사용자 "가장 이상적으로"). AskUserQuestion 확정: 비로그인 가격=가림 유지, 다크용 흰 로고 제작.
- **유통사 대시보드 마이페이지** (`WholesaleDashboardPage`): 다크 등급 hero → 라이트 인사+등급칩 + KPI 카드 4(보더·색상값·부제) + 주문내역 상태탭(전체/결제완료/배송중/구매확정) 테이블. 미사용 useWholesaleMall 제거.
- **관심상품** (`WholesaleWishlistPage`): 로고 브레드크럼 + 필터칩(전체/판매중/품절·중지) + 카드(권장가·등급 공급가·마진칩·장바구니). 백엔드 `/api/wholesale/wishlist` 가 `distributor_price` enrich(resolveDistributorPrice SSOT 재사용 — 원가/제조사 신원 비노출). `wholesale.routes` `loadGradeTable/loadSellerGrade` export.
- **견적함** (`WholesaleQuotesPage`): 제목/CTA + 상태칩(전체/진행중/완료) + 표(요청수량/희망단가/제시단가/상태) + 확장 상세행(수락/반려) + 요청 모달.
- **예치금 충전** (`WholesaleDepositPage`): navy 잔액카드(이번달 충전/사용) + 2단(좌 충전금액·계좌이체 전용안내 / 우 충전요약 sticky). 셸(사이드바) 유지·충전 로직 무변경.
- **고객센터** (`WholesaleSupportPage` 신규, `/wholesale/support`): navy 히어로(검색·키워드) + FAQ(카테고리/검색/아코디언 9문항) + 1:1 문의(→ 신고·제안 게시판) + 연락처(BUSINESS_INFO SSOT). CatalogHeader 고객센터 mailto→페이지.
- **공지·자료실** (`WholesaleBoardPage`): 헤더 로고 브레드크럼 정렬(탭/콘텐츠 불변).
- 검증: tsc 0 · client+worker build OK · 테마검사 통과. 남음: 위탁·무재고 채널연동(시안03)·제조사 입점관리(시안04=SupplierDashboard 셸 적용 완료) 점검, 우체국 계좌번호(푸터 bankNo) 수령 대기.

## ✅ 2026-06-15 — 회원 등급명(일반/플러스/프리미엄) + 상품별 배송비 (대표 요청, AskUserQuestion 확정)
**대표 모델**: 등급 = 일반(승인 가입)/플러스(연 구독)/프리미엄(일정 매출 달성). 배송비 = 상품 등록 시 입력. 확정(AskUserQuestion): ① 등급별 공급가 차등 ② 라벨+가격 매핑 먼저(구독결제·자동승급은 다음) ③ 상품별 배송비(체크아웃 상품별 우선·제조사 폴백).
- **등급 라벨 매핑(머니 엔진 무변경)** — `distributor-pricing` 코드 A/B/C 유지, 표시명만 `GRADE_NAME`(A=프리미엄 10%/B=플러스 15%/C=일반 20% 기본) 신설(`wholesale-theme.ts`). 소비자 표면 전부 치환: `GradeSheet`(3등급 사다리 + 가입형태별 안내 — 일반=승인/플러스=연구독/프리미엄=매출), `Dashboard`(배지 원→펠릿·"○○ 회원"), `CatalogHeader` 다크 유틸바("○○ 회원"). 마진율/엔진/`distributor_grades` DB/cron 전부 불변 → 머니 0 리스크. 구독 결제·매출 자동승급은 다음 단계.
- **상품별 배송비** — `AddProductModal` 에 배송비 입력(0=무료, 비우면 제조사 정책 폴백). 저장은 **products 컬럼 미증식**(`product_supply_meta` K-V, key `wholesale_shipping_fee`) — 예산제 룰 준수. `supplier-dashboard.routes` POST /products 가 `setSupplyMeta` 로 기록.
- **체크아웃 배선(하위호환)** — `wholesale.routes computeSupplierShipping` 에 라인별 `product_shipping_fee` 추가: 그룹(묶음배송) 배송비 = 라인별 유효배송비(상품별 우선·정책 폴백) **최댓값** 1회 청구. 주문(`/orders`)·미리보기 양쪽이 `getSupplyMeta` 로딩 후 라인에 첨부. **상품별 배송비가 하나도 없으면 max=정책배송비 → 현행 완전 동일**(역마진/무료배송 임계/min-order 게이트 불변). Toss 금액검증·CAS·예치금 차감 무변경.
- 검증: tsc 0 · client+worker build OK · 테마검사 통과. ⚠️ 실결제 staging E2E 1회 권장(배송비 합산 표시·청구 정합). 후속: 상품 상세에 배송비 표시, 상품 수정(PATCH) 폼에도 배송비, 어드민 등급 드롭다운 라벨(현 코드 A/B/C 표시 — 매핑 안내).

## ✅ 2026-06-15 — 도매몰 홈 시안 리디자인 (Claude Design 핸드오프 `유통스타트 도매몰.dc.html`)
**배경**: 사용자가 Claude Design 핸드오프 번들(tar→README+`.dc.html`+스크린샷+chat)을 전달, "참고해서 디자인 전면 수정 / 기존과 다른 부분 확인하며 이상적으로". chat 인텔: "AI 티" 원인 = ① 회색 상품박스 ② 의미없는 통계 슬롭 ③ 과한 라운드/회색 패널. 확정 = 셰브론 런치마크 + 신뢰 신호 전면 + #FF0033은 가격/CTA에만. 시안 범위 = 홈+로고.
- **디자인 토큰 시안 정렬** (`wholesale-theme.ts`): ink `#17181C→#15171C`, `inkPink #FF5C7A`(다크 위 액센트)·`trustBg #FAFBFC`·`line2 #E7E9ED`·`shHover` 추가. (WT는 도매 전 surface SSOT — 전역 정렬.)
- **셰브론 로고** (`WholesaleLogo.tsx` 신규): A1 솔리드 셰브론(배경 없음, path `M20 5 L33 30 L20 23 L7 30 Z`) + 유통스타트 Pretendard ExtraBold 자간 -5% + UTONGSTART 캡션. 헤더·푸터 적용(라운드 "유" 박스 폐기).
- **헤더 전면 재구성** (`CatalogHeader.tsx`): ① **다크 유틸바**(`#15171C` — 회원·등급·예치금·충전 / 게스트 로그인·가입) ② 잉크 2px 보더 검색 + 다크 버튼 ③ 우측 아이콘 **견적함/관심상품/장바구니**(처음이세요/제안신고/예치금 → 교체) ④ 카테고리 네비 라벨 정렬(브랜드관/월간베스트/신상품/**고마진특가(red)**/프리미엄전용관/위탁·드랍쉽), 공지·자료실은 유틸바로. **라우팅·검색 와이어링·megamenu·멀티몰 로직 보존.**
- **신뢰 신호 바** (`HomeSections.tsx TrustBar` 신규): 사업자 인증제/KCP 에스크로/전자세금계산서/무재고 위탁배송 4셀 — chat의 "통계 슬롭 → 검증가능 신뢰신호" 직접 반영. 홈 양 상태 노출.
- **2단 게스트 히어로** (`HeroSection.tsx`): 좌 다크 트러스트 히어로(2 CTA) + 우 추천 상품(공급가 비노출 도메인규칙 준수 → "가입하면 공개"). 로그인 사입자는 슬림 대시보드 유지.
- **제조사 입점 CTA** (`HomeSections.tsx SupplierCTA` 신규): 다크 그라데이션 배너(게스트 홈).
- **상품 카드 흰 카드化** (`cards.tsx`): dominant-color 그라데이션 카드 → **흰 카드 + 권장가 취소선/공급가 강조(19px)/마진%·MOQ 칩/add-circle**. **perf 전부 보존**(viewport prefetch IO·React.memo·dominant 백필·lazy/fetchPriority). 깨질 stock 이미지 0(실데이터/다크 그라데이션만).
- **기존과 다른 부분(사용자 요청 확인)**: 시안은 Unsplash 샘플·하드코딩 통계(1,240/38만)·"마감임박 04:12:39" 카운트다운 사용 → **실데이터 원칙**으로 통계/카운트다운 미도입, 공급가 게스트 비노출 규칙 적용(시안은 게스트에 ₩19,800 노출 — 도메인 위반이라 미반영). 카테고리 타일 8종·5열 큐레이션 그리드는 후속(현 기능 그리드+필터 유지).
- **잠금 보존**: SSR consume(`__SSR_INITIAL_WHOLESALE__`)·placeholderData·prefetch·lazy·memo·기본 catalog 요청 byte-identity 무변경. tsc 0 · client build OK(71.84KB) · 테마검사 통과.
- **후속 조정(사용자 요청 2건)**: ① 중복 기본 배너 placeholder 제거 — `WholesaleBannerCarousel` 0건 시 `null`(다크 히어로 2개 중복 해소, 트러스트 히어로가 메인 배너). 어드민 등록 배너 있으면 캐러셀 표시(기능 보존). ② 히어로·제조사 CTA 배경에 **시안 창고 사진 복원**(`WHOLESALE_HERO_IMG`, Unsplash, `onError`→다크 `#15171C` 폴백·CSP img-src https: 허용) — 앞서 '실데이터 원칙'으로 뺐던 '사진 미도입'을 사용자 "내가 준 파일대로" 요청으로 번복.
- **시안 큐레이션 추가(사용자 "똑같이" 요청)**: ① 카테고리 타일 8종(`CuratedSections.tsx CategoryTiles` — 클릭 시 cat 필터) ② "실시간 베스트" 탭+순위(1~5) 5열 그리드(`BestGrid`, `ProductCard` 에 `rank` 배지 prop 추가) ③ 메인 그리드 5열化 + 비로그인 기본 랜딩(`cleanHome`)에선 필터 사이드바/컨트롤 숨겨 풀폭(시안처럼) — 카테고리/검색 선택 시 노출. 베스트/신규 레일 → BestGrid 로 대체(HomeRails 는 재주문/전용공급만), BrandHero 제거(시안 미포함), 기본 라벨 "오늘의 도매 특가".
- **후속 백로그**: 상품상세/장바구니/결제/가입/마이/제조사입점 화면을 같은 시안 톤으로(chat "다음 단계"). 히어로 사진은 추후 자체 호스팅(R2) 검토(현재 Unsplash 핫링크).

## ✅ 2026-06-15 — sellers 컬럼 예산제 확장 (배포 로그 `sellers 100컬럼 = D1 한도 도달` 발견)
**배경**: REPAIR_SCHEMA_TOKEN 확인차 배포 로그 점검 중 자동복구 응답에 `sellers 컬럼 100개 — D1 결과셋 한도(100) 임박` 경고 발견 — 2026-06-10 교환권 상세 전사 500(products 컬럼 100 초과 → `SELECT p.*` 한도 초과)과 **동일 사고 클래스**. 조사 결과 즉시-500은 없음(sellers 100컬럼을 통째 반환하는 `SELECT s.*`/`SELECT * FROM sellers` 쿼리 부재 — seller 도메인 star-select 는 전부 타 테이블). **진짜 갭 = 예산제 CI(`check-products-column-budget.mjs`)가 products 만 감시, sellers 는 무감시** → 101번째 컬럼 추가 시 그때 터짐.
- **fix**: 예산 체크를 products+sellers **멀티테이블**로 일반화(파일 1회 스캔 캐시 + 테이블별 baseline). `scripts/sellers-column-baseline.json`(현 96 ALTER 컬럼) 신설 — 기존 컬럼 통과 + 신규 `ALTER TABLE sellers ADD COLUMN` 차단. verify.yml 호출 지점 무변경(같은 스크립트). CLAUDE.md 방어선 표 갱신.
- **검증**: 양 테이블 통과(exit 0) + 음성 테스트(임시 sellers 컬럼 → exit 1, 정확한 위치/대안 메시지) + cleanup 후 통과 확인.
- **남은 권고**: 향후 sellers 부가속성은 K-V 사이드테이블로(예산 escape hatch). 컬럼 DROP(트리밍)은 D1 위험 → 미실시(증식 차단이 우선).

## ✅ 2026-06-15 — 링크샵 적립 마감재 2종 (남은 비이상 — 멱등 UNIQUE + 핀별 순클릭/로그정리)
**배경**: 위 4종 후 "더 이상적으로?" 재질문 → 남은 비이상 4가지 제시, 대표가 전부 선택. 조사 결과 ②hold 전체 스트림은 **대부분 이미 성숙(hold) 보유**(influencer_attributions T+7 payout·supplier matureSettlements·agency 월정산) → 즉시-잔액 적립 + MAX(0) clawback 누수가 남은 건 `referral_commissions`(추천 트리, 별도 출금 서브시스템)뿐. stays 인플 적립은 `payment.routes`(잠금) 직접 INSERT 라 잔액 미적립(누수 아님). 따라서 이번 turn 은 안전·명확한 ①③ 구현, ② referral_commissions hold·④ 유저 현금화 정책은 대표 결정 후 별도 진행.
- **① 멱등 UNIQUE** (`affiliate-credit.ts`/`affiliate.routes.ts`/`repair-schema`): SELECT-후-INSERT(race) → `affiliate_earnings(referrer_id, order_id)` partial UNIQUE + `INSERT OR IGNORE`(changes===0=멱등 DUPLICATE, 잔액/알림 없음). 머니룰 #3 정합. 기존 중복 행 있으면 인덱스 생성 실패→repair 리포트(타 _pair 인덱스 컨벤션).
- **③ 핀별 순클릭 + 로그 retention** (`curator.routes`/`scheduled-cleanup`): `/me/pins/stats` 에 핀별 unique_clicks(ip+ua+일자 dedup) + purchases/earnings 환불 제외. `pin_click_logs` 180일 경과 삭제(chunk 5000, 집계 click_count 무영향).
- **② referral_commissions T+7 hold 확장** (대표 "확장 진행") — 추천 트리(친구추천) 적립도 즉시 'granted'+잔액 → **'pending'(보류, 잔액 미반영)**. ⚠️ status CHECK 가 'holding' 신규값 금지 → 'pending' 재사용(=UI '대기', affiliate hold 와 동의어). 신규 cron `matureReferralCommissions`(`referral-tree.routes`, scheduled.ts `referral-mature`)이 T+7(`affiliate_hold_days` 공유)+미환불 주문분을 pending→granted CAS 후 `adjustUserPoints` 적립(claim-before-credit). 환불 4경로(order-refund/returns/order.routes×2) pending→withdrawn 플립(잔액 회수 X). webhook.routes(잠금)는 미수정 — cron 주문-status 가드가 머니 누수 차단. grant 의 `pointCreditUpsertStatement`/`recordPointTransaction` 즉시기록 제거 → maturity 로 이연. 모든 소비처(seller-analytics/ledger/withdrawal)는 pending=대기로 정합(출금 granted만).
- **④ 유저 현금화 정책** = 대표 **A) 현행 유지(딜만)** 선택 → 코드 변경 없음.
- 검증: tsc 0 · status-constraint 0 · 전체 build.

## ✅ 2026-06-15 — 링크샵 추천 적립 "이상적 구조" 4종 (대표 승인 — 진단/라인별/T+7/순클릭 전부)
**배경**: 대표 질문 "링크샵 담기 시 각 유저 성과로 잘 찍히나? 쿠팡파트너스처럼?" → 감사 결과 기여모델(라스트클릭+24h쿠키)·적립무결성(멱등·환불역전·자기추천/IP차단)은 이미 이상적이나, **3가지가 비이상적**: (a) 멀티상품 주문 첫상품 기준 적립 (b) 확정 유예 없어 buy→사용/출금→환불 시 `MAX(0,…)` clamp 누수 (c) raw 클릭(새로고침/봇 포함). 대표가 `AskUserQuestion` 에서 4개 전부 선택(진단부터).
- **① 진단 엔드포인트** (read-only, requireAdmin) `GET /api/curator/admin/affiliate-diagnostic` — status분포/멀티상품 적립규모/환불-후-사용 프록시(환불적립+잔액0)/30일 클릭 부풀림/top큐레이터. 코드변경 전 ground truth.
- **② 라인별 귀속** `affiliate-credit.ts computeOrderCommission()` — order_items 의 referral_enabled 라인만 각 상품비율로 합산(배송비/비대상 제외). 기존 첫상품비율×주문총액 → 과/미적립 해소. order_items 부재 시 기존 fallback. 멱등(referrer+order) 불변.
- **③ T+7 확정 유예(hold)** — 신규 적립 `status='holding'` 로만 기록(잔액 미반영). `matureAffiliateEarnings` cron(daily 18:00)이 T+7(dynamic `affiliate_hold_days`)+미환불 주문분을 holding→granted CAS 후 잔액 적립(claim-before-credit + order status 가드=안전망). holding 은 출금 가용액 SUM 제외. **레거시 pending/NULL/granted 무영향(migration-safe)**. 환불 사이트 6곳 holding→refunded 플립(무회수): order-refund/returns/voucher-clawback(helpers)/stays×2/admin-stays. 대시보드 month_earnings(확정) vs pending_earnings(예정) 분리 + recent_earnings 에 status.
- **④ 순클릭/전환율** 대시보드 unique_clicks_30d(ip+ua+일자 dedup)+conversion_rate_30d. `CuratorEarningsPage` 30일적립(확정/+예정)·순클릭(전체 sub)·전환율(구매 sub)·내역 '적립예정' 배지.
- **잠금 영향 없음**: `payment.routes.ts`(잠금)는 기존 helper 호출만 — `creditAffiliateFromIntent` 시그니처 불변. `affiliate-credit.ts` 는 비잠금. **Toss confirm/금액검증/CAS 전부 무변경.**
- 검증: tsc 0 · 전체 build (client+worker+prepare) — push 전 확인. ⚠️ hold 는 행동변경(적립 7일 보류) — prod 반영 후 진단 엔드포인트로 holding/granted 추이 1회 확인 권장.

## ✅ 2026-06-15 — 도매몰 `/wholesale` 홈 정리 (사용자 신고 "난잡" — 전수조사 1차)
**배경**: 사용자가 `/wholesale` 카탈로그 홈이 난잡하다고 신고. 코드 해부 결과 로그인 사입자 기준 헤더 3단 + 본문 12~15블록(배너·대시보드·OEM·레일4·BulkOrder패널·그리드·BrandHero)이 적층. 근본원인 = *비로그인 마케팅 페이지*와 *로그인 빠른 카탈로그*를 한 화면에 전부 노출. 사용자 승인(4개 정리 전부 + 지금 구현).
- **로그인/비로그인 홈 분기 + 레일 4→2** (`HomeRails.tsx`): 베스트셀러·신규입고 레일을 `!loggedIn` 게이트 → 비로그인 방문자 발견용에만. 로그인 사입자는 개인화 레일(빠른 재주문·전용 공급)만 + 상단 네비 전용 페이지(/wholesale/best·/new)로 위임(중복 제거).
- **BrandHero 로그인 시 숨김** (`WholesaleCatalogPage.tsx`): 서비스 정체성 마케팅 카피는 `!loggedIn` 전환용에만(반복 노출 제거).
- **대량주문 엑셀 패널 접기**: 그리드 한가운데 상시 펼침 → 토글 버튼(`bulkOpen`, 기본 접힘). 파워유저 기능이 기본 둘러보기를 점령하던 혼잡 제거.
- **헤더 3단→2단(데스크톱)** (`CatalogHeader.tsx`): 유틸 링크(마이/장바구니/제조사/로그인/로그아웃)를 `UtilLinks` 컴포넌트로 추출, 데스크톱은 별도 유틸바 줄 제거하고 카테고리 네비 우측 빈 공간으로(`justify-between`), 모바일은 기존 유틸바 유지(`lg:hidden ↔ hidden lg:flex` — 중복 0).
- **'BEST PRODUCT'(영문) → '전체 상품'**: 그리드 기본 제목 정리(베스트는 네비/전용페이지로 일원화).
- **잠금 보존**: SSR consume(`__SSR_INITIAL_WHOLESALE__`)·placeholderData·prefetch·lazy·memo·기본 catalog 요청 byte-identity 전부 무변경. tsc 0 · client build OK · 테마검사 통과.
- **전수조사 잔여(후속 배치 백로그)**: 어드민 도매 nav 16항목 IA 비대(통합 허브 있음에도 이중 진입점)·패턴 이원화(table vs card, window.prompt vs modal, 컨테이너 폭 3종) / 제조사 주문화면 2개 중복(OrdersTab vs SupplierWholesaleOrdersPage)·정산 탭 5섹션 과밀·CatalogTab 버튼 6개+초록 이질색 / BulkPriceModal↔PriceChangeModal 중복·AddProductModal 필드17 과밀. (감사 보고서 확보 — 우선순위 청취 후 진행.)

## ✅ 2026-06-15 — 옵션1 1단계: 크리에이터=유저 분리 (대표 승인 "가장 이상적으로") — `88f39b77`
**결정**: 업주(공급) vs 인플루언서(홍보) 충돌 근본 해소. 인플루언서는 더 이상 "셀러"가 아니라 **로그인한 유저=크리에이터**. 셀러 대시보드 = 업주(매장) 전용. 크리에이터 = 메인 앱 내 콘솔(별도 로그인 X). 모델 = "크리에이터=순수 홍보자"(자기 상품 없음, 남 공구만 홍보; 자기 상품 팔면 업주 가입).
- **가입 분리** `JoinChoicePage`: 2갈래 — 🏪 매장 운영자(→/seller/register/supplier 가입) / 🎤 크리에이터·이용자(→/login, 별도 가입 X). 분홍 액센트 제거.
- **influencer 셀러등록 은퇴** `SellerRegisterBusinessPage`: 신규 가입 폼 대신 "크리에이터는 가입 불필요 — 로그인만" 안내 화면(기존 pending/active 셀러는 위에서 분기되어 무영향, 레거시 폼은 unreachable 보존).
- **크리에이터 콘솔** `CuratorEarningsPage`→ 헤더 '🎤 크리에이터 콘솔' + 상단 빠른진입(내 링크샵 `/u/:handle`·공구 호스팅 `/host`). 기존 수익/클릭·구매 분석/인기핀/일별차트/영입 매장/출금 전부 유지. **신규 URL `/creator`**(App.tsx, 메인 앱 내·requireUser), `/u/me/earnings` 하위호환 alias.
- **진입점**: 링크샵 owner 배너 "수익 보기"→"크리에이터 콘솔"(/creator), 마이 `CuratorEarningsCard`→/creator+분홍제거.
- 검증: tsc 0 · vitest 2081 green · 전체 build OK.
- **남은 단계(Phase 2)**: 팔로워(`/seller/followers`)·브랜드 메시지(`/seller/alimtalk`)는 셀러 스코프 백엔드라 user 스코프로 이전 필요 → 콘솔에 흡수. 기존 seller_type='influencer' 계정 옵트인 이전. 쿠폰/프로모코드는 크리에이터 미부여(결정). **사용자 직접**: Cloudflare Scrape Shield "Email Address Obfuscation" OFF.

## ✅ 2026-06-14 — 도매몰 컬렉션 페이지 분리 (사용자 요청)
- 카탈로그 단일 페이지의 5개 뷰(브랜드 전시관·월간 베스트·신상품·판매마진·프리미엄 전용관)를 **전용 라우트로 분리** — `WholesaleCatalogPage` 에 `mode` prop 추가, 같은 데이터/카드 로직 100% 재사용(중복 0).
- 라우트: `/wholesale/best|new|margin|premium|brands` (App.tsx, `key` 로 컬렉션 전환 시 강제 리마운트해 초기 정렬/필터 재적용). 매핑: best→sort=popular, new→newest, margin→discount, premium→premium=1, brands→브랜드 그리드.
- `collectionMode` 시 홈 전용 섹션(배너 캐러셀/HeroSection/HomeRails/하단 BrandHero) 숨기고 전용 타이틀+홈 버튼 + 해당 컬렉션 그리드만. **홈 `/wholesale` 은 기존 그대로(기본 경로 불변)**.
- CatalogHeader 네비가 setState → `navigate('/wholesale/...')` 로 변경, 활성 강조는 현재 경로 기준. margin/premium 은 회원 전용 게이트 유지(비로그인 로그인 유도).
- SEO: 컬렉션별 title/url 분기(`/wholesale/best` 등). utongstart 도매 path 게이팅은 `/wholesale/` prefix 라 자동 허용.
- tsc 0 · unit 2103 · build OK.

## ✅ 2026-06-14 — 대표 신고 대량 배치 (사용자 "바로 가장 이상적으로 모두 진행")
**크로스커팅 근본수정 (앞 세션 turn):**
- 🔴 **모든 대시보드 자동 로그아웃 근본수정** (`a0519ed0`): agency 만 refresh token/`/refresh` endpoint 부재 → access(30일) 만료 시 복구불가 강제로그아웃(Sentry "Agency 401: Token expired"). `POST /api/agency/refresh` 신설 + 이메일/카카오 로그인 refresh 발급·저장(login page/KakaoCallback/transfer cookie) + api.ts 의 agency→/admin/refresh 오라우팅 버그 수정.
- 🔴 **대시보드 좌측 카테고리 스크롤 최상단 복귀** (`809f4b18`): `usePersistScroll` 공용훅 — Admin/Agency nav 스크롤 sessionStorage 영속(SellerLayout 검증패턴 추출).
- 🔴 **대시보드 로딩 시 홈 깜빡임** (`3c0d239f` [LOADING_ADDITIVE]): #root 라이트 placeholder 를 seller/admin/agency surface 로 일반화.
- 🔴 **링크샵 프로필/배너 새로고침 시 사라짐** (`eded4998`): 소유자 본인조회는 edge 900s 캐시 우회(optionalAuth) — 익명은 캐시 불변.
- 🟢 콘텐츠 (`a628ef2e`): 개인정보 책임자 메일 jiwon·전화삭제 / 교환권 KT B2B 라벨 제거 / 마이 하단 중복 버전줄 삭제 / 빌드번호 YYYYMMDD.HHmm 정형화. cafe24 500→400 (`37b997dd`).
- 쇼핑 풀루프 (`2f06aff5`): G2 딜결제 성공화면 / G3 /points/pay 쿠폰·배송비 서버재계산 / G5 리뷰리워드 / G9 선택카트정리 / 반품 신청 UI.

**대량 백로그 (병렬 3배치):**
- **소비자 UI 분홍→검정 + 공구 상세 정돈 + 원가/판매가** (`9a54b776`): GroupBuyDetail 가격부(정가 취소선→판매가+할인%)·CTA·전 소비자 페이지 핑크 액센트 뉴트럴 치환. 잠금 심볼(SSR consume/memo/lazy/prefetch) 전부 보존.
- **어드민 페이지 재설계 6종** (`f86277f9`): orders 고객/상품 상세화 · products 교환권/쇼핑 세그먼트 분리 · voucher-orders 의미·범례 · blog `/blog/:slug` 링크 · accounts 6역할(super/admin/ops/cs/finance/viewer, requireAdminRole 정합) · 대시보드 "처리 대기" KPI 6종.
- **링크샵 첫진입 닉네임 + 마이 i18n + 어드민 좌측 신규이슈 배지** (`6c28a891`): @user{id} 기본핸들이면 1회 설정 모달(LinkshopOnboardModal) · 쿠폰/바우처 라벨 6언어 · 미읽음 알림 link→nav path 매칭 배지(60s 폴링).
- 검증: tsc 0 · vitest 2081 green · 전체 build(client+worker+prepare) OK.

**대시보드 공구 중심 재편 (사용자 승인 "가장 이상적인 방향" — 제안 ① 채택)** (`914a26a6`):
- **결정**: 인플루언서=셀러 대시보드 메인 / 에이전시 대시보드=여러 크리에이터·매장 관리 조직 전용(개인 인플루언서를 에이전시로 몰지 않음 — 에이전시 메뉴는 담당셀러/랭킹/팀멤버/계약 등 "남 관리"용이라 1인은 빈 화면).
- **셀러 SellerLayout**: 라이브 영구중단 후 live/store 모드토글 무의미 → `seller_type` 기반 분기로 전환. 크리에이터는 매장 POS(스캔/식사권 발행/proxy-products/숙소) nav 숨김(라우트는 보존), 매장은 큐레이터 그룹 숨김(기존 hideFor). 공구 핵심을 홈 다음 상단으로 정렬(크리에이터=큐레이터/호스팅, 매장=공구/숙소). **바운스 수정**: `/host`·`/u/me/earnings`(user 세션 의존)는 `user_id` 있을 때만 노출 — 카카오 셀러 정상, 이메일 셀러는 숨겨 /login 바운스 차단.
- **에이전시 AgencyLayout**: 이미 `LIVE_COMMERCE_SUSPENDED` 로 라이브 항목(라이브현황/방송캘린더/PK/매칭/부스팅) 자동 숨김 → 공동구매/숙소/주문/반품·담당셀러·영입 중심으로 이미 정리됨(추가 변경 불필요). 카카오 로그인 연동 동작 확인.
- 검증: tsc 0 · vitest 2081 green · 전체 build OK.

**사용자 직접 (코드 불가):** Cloudflare Scrape Shield "Email Address Obfuscation" OFF (CSP email-decode 차단 해소).

## ✅ 2026-06-13 — 도매몰 UX 6종 (사용자 신고 묶음, opus)
- **① 베스트/신규 분류 = 정상**(코드 확인): 베스트 `ORDER BY sold_count DESC, created_at DESC` · 신규 `ORDER BY created_at DESC`(wholesale.routes /home). 판매 데이터 0인 초기엔 둘이 같아 보이는 건 정상(베스트가 created_at 로 폴백) — 주문 쌓이면 분리됨. 코드 변경 없음.
- **② 상세이미지 멀티 업로더** `supplier-dashboard/MultiImageUpload.tsx`: 세로 긴 사진·**GIF 다수 원본 무압축** 업로드(클라 압축 X — GIF 애니/세로 디테일 보존), 10MB×10장, 순서 조정/삭제. AddProductModal 의 detail_images textarea 대체. supplier_token Bearer + multipart(supplierApi 는 JSON 전용이라 raw fetch). GIF/webp/png/jpg 는 서버(/api/upload/image)가 이미 허용.
- **③ BrandHero(서비스 정체성 카피) → 회사정보(푸터) 바로 위로 이동** (HeroSection 상단 제거 → 카탈로그 푸터 위). 상단은 대시보드/가입유도만.
- **④ 제안/신고 → 게시판 페이지화**: 카탈로그 헤더 제안/신고 아이콘이 모달 대신 `/wholesale/board?tab=report` 로 이동. (report 작성=유통회원 전용 폼 기존재.)
- **⑤ 게시판 권한/배송안내/이미지깨짐**: 글쓰기 권한 = 공지/자료실/**배송안내**는 운영자만(서버 VALID_BOARD_TYPE 에 'shipping' 추가 + admin 보드 페이지 타입 옵션 + create 게이트), 신고·제안만 유통회원. 배송안내 = 운영자 게시물 있으면 렌더(본문 이미지 URL 자동 세로 렌더 + onError 숨김), 없으면 기본 4단계 가이드(이미지 0 → 깨짐 0). archive 썸네일·다운로드 onError 방어.
- **⑥ 제조사 문의 채팅 버그 fix**: `openThreadByProduct` 가 실패를 삼키고 빈 목록만 떠서 채팅 불가처럼 보이던 것 → API 가 에러 사유 반환 + 위젯이 '연결 중'/'문의 불가 안내' 상태 표시. **근본**: 연결 제조사 없는 상품(데모/관리자 등록, supplier_id NULL — product 6 추정)은 `inquirable:false` 응답 → '제조사에 문의' 버튼 자체 숨김(신원 비공개 위해 boolean 만).
- 검증: tsc 0 · unit 2103 · build OK · i18n 5키×6언어.

## 🛒 2026-06-12 — 쿠팡 연동 + 역방향 임포트 (사용자 승인 "모두 이상적으로, 쿠팡도")
- **쿠팡 코어 `coupang-core.ts`** (dep 0): HMAC-SHA256 전자서명(Web Crypto, signed-date yyMMdd'T'HHmmss'Z' — node:crypto 참조구현 대조 테스트) + `coupang_connections`(owner_type 복합 UNIQUE, secret encryptAtRest) + 출고지/반품지(주소 포함) + **카테고리 자동 추천**(predict) + 카테고리 고시정보 메타 + 상품 등록 payload 빌더(필수 고시 '상세페이지 참조' 관행) + 내 상품 목록/상세. 경로는 `COUPANG_PATHS` 상수 집중 — ⚠️ **실계정(Wing 키) E2E 1회 필요**.
- **유통사 쿠팡 내보내기**: `/api/wholesale/coupang/*`(connect — 출고지 조회로 즉시 검증/status/disconnect/shipping-places/export — 역마진 차단·반품지 주소 서버 재조회로 변조 차단) + `CoupangExportModal`(연결 폼 내장 — 별도 페이지 없음, 카테고리 입력 불필요) + 상품 상세 버튼 2열(스마트스토어/쿠팡).
- **제조사 역방향 임포트 "내 스토어 상품 가져오기"**: naver_commerce_connections **owner_type 재구축**(supplier 지원 — 신생 테이블 self-heal, (owner_type,id) 복합 UNIQUE) + `/api/supplier/store/*`(naver·coupang connect/status/products/import) + `StoreImportModal`(채널 탭·전체선택·**공급률 % 일괄 적용**(공급가=판매가×율)·R2 이미지 미러 `mirrorImageToR2`(SSRF 가드 — pstatic/coupangcdn 허용 호스트만, 실패 시 원본 폴백)) + CatalogTab "내 스토어에서 가져오기" 버튼. 본인 계정 데이터만(공식 범위) — 입력 노가다 0, 상품 30개 목표 직격.
- i18n 9키×6언어 · 단위테스트 7(HMAC 대조·payload·고시정보) — 전체 2093 · tsc 0 · build OK.
- **운영**: 쿠팡 E2E = 사장님 Wing 키(Wing→판매자정보→추가판매정보→OPEN API)로 연결→내보내기 1회 (출고지/반품지 Wing 등록 선행). 드랍쉬핑(주문수집→자동발주→송장)은 양 채널 E2E 후 통합 허브로 한 번에.

## ✅ 2026-06-12 — 숙소·예약 결제 관문 B배치 6종 마감 (4차 감사, 사용자 승인 '모두 이상적') — commit `f525587a`
- **B-1 숙소 결제 단절(🔴M)**: CheckoutPage stay 분기(`/checkout?order_id=N&stay=1` → 신규 `StayCheckout` — `GET /api/group-buy/stays/orders/:id` 서버 주문요약, 클라 재계산 금지) → `/pay/widget`(잠금 TossWidgetPayPage **호출만**, Toss orderId=`STAY-{orders.id}` — 6자 최소 요건) → 신규 경량 `/stays/checkout-return` 페이지가 `/api/group-buy/stays/bookings/confirm` 호출(성공/오버부킹 409/실패 3분기). 서버 confirm 도 동일 `STAY-N` 으로 Toss 승인(기존 `String(id)` 는 6자 미달 — 프론트 호출자 0이라 안전 변경).
- **B-2 다객실 confirm 단일화(🟡M)**: stays-public confirm — 첫 booking 만 확정(나머지 30분 후 expired)→ `WHERE order_id=?` 전체 루프(booking 별 CAS pending→confirmed + date모드 달력 차감). 오버부킹 시 확보분 전체 롤백 + 자동환불 + 주문 전 booking 취소. 단건 루프=1 이라 기존 동작 불변.
- **B-3 voucher 숙소권 셀프취소 0원(🔴S)**: cancel 핸들러 — `sale_mode='voucher'` && 미사용 && 미만료 = 100% 환불(기존 check_in NULL→NaN→무조건 0원+영구무효). 사용/만료 후 0원 유지.
- **B-4 pending-bookings 키 불일치(🔴S)**: appointments.routes `/orders/:orderId/pending-bookings` — `WHERE id=? OR order_number=?` + 후속 쿼리 숫자 order.id (PaymentSuccess CTA 가 order_number 전달 → 항상 빈 배열이던 버그).
- **B-5 매장 예약 생성 UI(🔴M)**: MyAppointmentsPage — 신규 `GET /api/appointments/bookable`(본인 결제완료 booking_required 미예약 목록) → 예약 잡기 모달(날짜 → `/api/products/:id/available-slots` → 슬롯 → `POST /api/appointments/book`). `?from_payment=<id|order_number>` 자동 선택. i18n `myAppointments.*` 17키×6언어.
- **B-6 🟢**: 신규 cron `stay-checkout-transition.ts`(check_out+1일 경과 confirmed→checked_out, per-row CAS — 리뷰 게이트 해제) `0 9 * * *` 등록. `stay-reminder.ts` 에 `reminder_d1/dday_sent_at` dedup(WeakSet ensure + repair-schema 등록) — '0 9'+'0 0' 이중 트리거 하루 2회 중복 발송 차단.
- 검증: tsc 0 · vitest 2081 green · build OK. ⚠️ 숙소 실결제 E2E 1회 미실시(기존 백로그 #7 그대로 — staging 소액 결제→취소 권장).

## 📋 [최종 전수조사 4차 — 2026-06-12] 확정 갭 백로그 (쇼핑/숙소·예약·동네공구/어드민/인프라)
**전 영역 1회 이상 증거기반 검수 완료.** 인프라 S 5건은 즉시 수술됨(5ce2b6b4 — rate limit 3종/webhook_events 90일 정리/백업 silent skip→알림). 잔여 확정 갭(전부 파일:라인 근거 보고서 확보, 도매=타 세션 제외):

### A. 어드민 "버튼이 거짓말" 4종 (운영 직결)
| 심각도 | 갭 | 규모 |
|---|---|---|
| 🔴 | 반품 검수 4버튼 전부 403 — returns.routes approve/reject/inspect/refund 가 seller-only(:337,374,412,464), 어드민 토큰 거부 + reject body 키 불일치(reason↔rejection_reason) | M |
| 🔴 | 매장 검수(/admin/pending-sellers) 승인/거부 POST↔PATCH mismatch → 항상 실패 | S |
| 🔴 | 어드민 2FA 가 users 테이블에 저장/검증(twofa.routes:96, require-2fa:75) — admins 미반영·동일 id 유저 row 오염 + X-2FA-Code 클라 주입 0(활성 시 분쟁/강제환불 영구 403) | M |
| 🔴 | 카드 분쟁 승인 = 0원 환불 resolved(disputes:254 딜만 분기) + 금액 정가(p.price) 사용 | M |
| 🟡 | 전역검색 q 미소비(Users/Orders) · 감사로그 3중 분산(뷰어 1테이블만) · 유저 제재 죽은코드(users.status 컬럼 부재) · 에이전시 거절 무알림 · force-refund Toss 실패 무가시 외 🟢 다수 | S~M |

### B. 숙소·예약·동네공구 (결제 관문 단절)
| 심각도 | 갭 | 규모 |
|---|---|---|
| 🔴 | **숙소 결제 단절**: StayDetail→/checkout?order_id&stay=1 인데 CheckoutPage 가 stay 쿼리 미처리(빈카트 에러/타상품 결제), /stays/bookings/confirm 프론트 호출자 0 | M |
| 🔴 | **매장 예약(appointments) 생성 UI 부재** — /book·available-slots 호출자 0(백엔드 완비) + PaymentSuccess CTA 키 불일치(order_number↔id) | M+S |
| 🔴 | voucher 숙소권 셀프취소 = check_in NULL → 무조건 0원 + 영구 무효 | S |
| ~~🔴~~ ✅ | ~~커뮤니티공구 알림 딥링크 /:id/messages 404(라우트 없음+id↔invite_code) + 참여자 메시지 read 403~~ → **2026-06-12 수술 완료**: 신규 라우트 `/community-group-buy/:code/messages` + 경량 페이지(`CommunityGroupBuyMessagesPage`), 알림 링크 전부 invite_code 기반으로, `canAccessGroupMessages` 에 그룹 멤버 read+write 추가(단순 채팅 — 멤버는 보증금 당사자) | 완료 |
| ~~🟡~~ ✅(커뮤니티만) | 다객실 confirm 첫 booking 만 확정(나머지 30분 후 expired) · appointment 취소 전액환불+REFUNDED 플립만 — **잔존(타 항목)**. ~~커뮤니티 join UNIQUE 없음(이중차감 race) · 보증금 point_transactions 무장부 · admin status 'refunded' 플립 실환불 0~~ → **2026-06-12 수술 완료**: members UNIQUE(group_buy_id,user_id)+INSERT OR IGNORE claim→차감→실패 롤백(머니룰 #1·#3), 생성/참여 차감·라우트/cron 환불 4지점 point_transactions 원장(차감=community_deposit/환불=refund, balance_after 서브쿼리), total_donated 오용 제거, 생성 INSERT 실패 시 보증금 복원, status 'refunded' 플립 400 차단(/refund 가 SSOT), 환불 멱등을 claim-first 로(라우트×cron 동시 이중환불 차단), join→제안자 알림 | S~M |
| 🟢 | 숙소 노쇼/checked_out 자동전이 없음(리뷰 게이트 영구잠김) · stay-reminder dedup/시각 · base_price_holiday 미사용 · **confirmed 그룹 보증금 동결 — 정책 미정으로 보류(2026-06-12, 코드 주석 참조: community-group-buy.routes.ts /:id/refund. 현재 어드민은 confirmed 도 전액환불 가능 — 노쇼 패널티/부분동결 여부 사용자 결정 필요)** | S~M |

### C. 쇼핑 풀루프 (쇼핑탭 재공개 전 선결 — G1~G6)
| 심각도 | 갭 | 규모 |
|---|---|---|
| 🔴 | G1 주문 zod 가 할인 필드 strip → 쿠폰/공구할인/딜혼합/옵션가산/지역배송비 Toss 결제 전부 confirm 400(과금은 0 — fail-safe). 자동 쿠폰적용 탓에 쿠폰 보유자 일반결제도 실패 | M-L |
| 🔴 | G2 딜 전액결제 성공 → PaymentSuccess 가 에러 표시(paymentKey 없음) + 카트 미정리(재시도 이중차감 위험) | S |
| 🔴 | G3 /points/pay 차감액≠표시액(쿠폰 미반영·배송비 하드코딩·deal_only 에도 3000딜) | M |
| 🔴 | G4 반품 환불 시 deal_points 주문 딜 미환급 | S |
| 🔴 | G5 리뷰 리워드 약속 미지급(order_id 미전송→게이트 false) + 금액 문구 불일치 | S |
| 🔴 | G6 반품 신청 유저 입구 0(서버 루프 완성) | S-M |
| 🟡 | 카트 옵션변경 400 · 셀러 리뷰답글 비노출 · 선택구매 후 전체 카트삭제 · 쿠폰 결제전 소진 · /api/orders/refund DELIVERED 자가환불 열림 · 지역배송비 클라 미반영 | S~M |

### D. 인프라 잔여
| 심각도 | 갭 | 규모 |
|---|---|---|
| 🔴(사용자) | cron Workers 수동배포 드리프트 — Dashboard 에서 트리거 9개·최근 배포일 확인 + BACKUP_BUCKET 바인딩 실재 확인 | 확인 |
| 🟡 | ~~포인트 장부 누락(비충돌 7지점)~~ ✅ · 웹훅 멱등키 V2 status 미포함(잠금 — 승인要) · ~~FAILED 웹훅 cron~~ ✅(1단계 감시) · ~~safeError 5xx Sentry~~ ✅ · ~~agency 배치 내부실패 Discord~~ ✅ · ~~고아 라우트 4~~ ✅ — 2026-06-12 D배치 수술 (아래 ✅ 섹션) | S~M |
| 🟢 | ~~cache-warming.ts~~ ❌오탐(scheduled-cleanup 이 활성 import — 삭제 보류) · ~~debug 페이지 prod 노출~~ ✅ · ~~error-telemetry intake rate limit~~ ✅ | S |

### ✅ D배치 인프라 잔여 수술 완료 (2026-06-12, 사용자 승인 '모두 이상적')
- **D1 포인트 장부 수렴**: `worker/utils/point-ledger.ts` 신설 — `adjustUserPoints`(UPSERT+`balance>=?` CAS 가드 옵션+point_transactions balance_after 서브쿼리), `pointCreditUpsertStatement`(기존 DB.batch 원자성 합류용), `recordPointTransaction`(fail-soft — 레거시 type CHECK 잔존 환경에서 장부 실패가 돈 흐름을 절대 못 막음), `zeroOutUserPoints`. 비충돌 7지점 치환(금액/동작 불변, 장부만 추가): auto-settlement(만료 환불 — 기존 장부 0건 직접 확인), invite-reward, affiliate-credit, referral-tree(batch 원자성 보존+장부 후기록), seller-onboarding(+기존 total_used 컬럼 silent fail 제거), agency-self-events-tick(동일), delete-account(`account_deleted` 기록). order/returns/webhook/community 지점은 타 작업자 몫 — 미접촉. 단위테스트 10.
- **D2 safeError→Sentry**: 5xx 만 dynamic import `captureException` fire-and-forget (DSN 미설정 시 console 폴백 기존 동작).
- **D3 agency 배치 내부실패**: `scheduled.ts` 공용 `notifyCronFailure(env,name,err)`(safeCron Discord 패턴 재사용) — agency-cron-batch/weekly-batch 내부 `.catch(logError)` 18곳 치환.
- **D4 FAILED 웹훅 (1단계)**: `cron/webhook-failed-drain.ts` — `status='FAILED' AND retry_count<3` 매시간 감시 → Discord 요약(dedup 6h)+log. **한계(의도)**: 실제 재처리는 webhook.routes 잠금(비-export 핸들러) — 2단계는 잠금 해제 승인 후.
- **D5 고아 라우트 진입점 4**: /interest-list→ShoppingGroup 행, /user/affiliate→EarningsGroup 카드, /seller/proxy-products→SellerLayout nav(store), /agency/prospects→AgencyLayout nav. i18n 6키×6언어.
- **D6 🟢**: /toss-debug prod=requireAdmin 게이트(DEV 는 그대로 — 진단 도구 보존; /kakao-debug·/payment/demo 는 기게이트 확인), error-telemetry intake rateLimit 60/60s/IP(fail-open). **cache-warming.ts 삭제는 보류** — 재확인 결과 `scheduled-cleanup.ts:401` 이 활성 import(죽은 파일 아님, 오탐).


## ⚠️ 세션 분담 (2026-06-12 사용자 지시)
- **도매몰(wholesale/supplier/supply) 전 영역 = 별도 세션 전담** (= `claude/keen-cerf-ch0jm5` 세션 — 아래 06-12 도매 로그 전부 이 세션). 타 세션(claude/service-analysis-optimization-whpu0f 계열)은 **도매몰 외 구현만** — 도매 파일 수정 금지.
- 도매 관련 잔여 백로그(NTS 어드민 승인화면 표시 강화, 클레임 환불 딥링크, 장바구니 계정키 등)는 도매 세션 몫.

## ✅ 2026-06-12 — 도매 재점검 후속 개선 5종 (사용자 승인 "모두 가장 이상적으로")
**재점검 결론**: 배선 9영역 전부 정상, 검증 에이전트 결함 주장 6건 직접 재확인으로 기각(CHECK 마이그레이션=repair-schema 처리·/home 몰스코프=타 세션 수정·카탈로그 캐시 존재·상품 승인/가격변경/셀러 승인 통지 기존재·restock cron 배선됨). **알림 통찰**: 계정/상품/가격변경의 supplier 알림은 원래 있었으나 CHECK 버그로 증발 중이었음 — `/admin/health` 1회가 전부 살림.
**구현 5종**:
- 💰 **라인 단위 환불**: 제조사 환불 버튼이 라인에 있는데 동작은 내 전체 라인이던 것 → 서버 `item_ids` 부분집합(소유권은 supplier_id 쿼리가 보장) + `reverseSupplierOnWholesaleRefund` 에 **productIds 스코프**(일부 환불 시 과다 클로백 방지) + **Toss 멱등키에 라인 집합**(키 고정이면 2번째 부분취소가 dedupe 로 무시되는 미환불 사고 방지) + 예치금 원장 ref 라인 구분. 회귀 테스트 4(쿼리/바인드 순서).
- 🔔 **제조사 승인/거부 알림톡**: admin-suppliers PATCH 에 `sendSystemAlimtalk`(담당자>대표자>가입 phone, env 미설정 silent skip — 셀러 승인 패턴). ⚠️ Aligo 템플릿 `supplier_approved`/`supplier_rejected` 등록 필요(운영).
- 🗂️ **어드민 통합 승인 큐**: `/api/admin/wholesale-overview` 응답에 `queue`(유통/제조/상품/가격변경/입금/견적 6종 대기 수) + AdminWholesaleOverviewPage 상단 "오늘 처리할 것" 카드(딥링크 — 상품/가격은 `/admin/products` 검증 후 연결).
- 📊 **시장 신호 유통사 노출**: `GET /api/wholesale/market-signal`(로그인 유통사, 최저가+수요+시즌 — 기존 util 재사용) + 상품 상세 `MarketSignalCard`(lazy) — "시중 최저가 vs 내 공급가 → 마진 여력" 사입 확신 보조. 키 미설정 시 숨김.
- 🧭 **제조사 온보딩 마일스톤**: `/me`에 `milestones`(orders/settlements COUNT, additive) + OverviewTab "첫 정산까지" 5단계 체크(전부 달성 시 미표시). i18n 11키×6언어.
- 검증: tsc 0 · unit 2085(+4) · build OK. **Phase B 드랍쉬핑은 사용자 스마트스토어 E2E 통과 후 착수**(자동 발주=돈 — 연결 검증 선행).

## ✅ 2026-06-12 — 대량등록 엑셀 완전판 (사용자 요청 "엑셀로, 이상적으로")
- **실사용 사고 2개 근본 해결** (`lib/read-table-file.ts`, dep 0): ① Excel 기본 CSV 저장(CP949) 한글 깨짐 — `file.text()`(UTF-8 고정) → UTF-8(fatal) 실패 시 EUC-KR 자동 디코드 ② **.xlsx 직접 업로드** — zip(EOCD→central dir) 직접 파싱(STORED+DEFLATE/DecompressionStream) + sharedStrings/inlineStr → CSV 변환해 기존 서버 경로(parseCsv) **무변경** 통과. 적용 4곳: 제조사 대량등록·재고 가져오기·송장 일괄·유통사 대량주문(BulkOrderPanel). accept 에 .xlsx, 라벨 "엑셀/CSV".
- **양식**: `GET /products/bulk-template.xlsx`(buildXlsx 재사용 — 진짜 엑셀) 신설, CSV endpoint 존치. 템플릿 parity — 박스입수/주문배수/이미지URL 컬럼 + bulk 파서/INSERT 반영(단건 폼과 일치).
- **등록 진입점에 대량 옵션** (사용자 요청): AddProductModal 상단 배너 "여러 상품이면 엑셀로 한 번에" — 양식받기+업로드(공용 `bulk-upload.ts`, CatalogTab 과 동일 흐름·실패행 상세 토스트, 성공 시 모달 닫고 갱신). 사용자에게 양식 파일 전달 완료.
- 단위테스트 8(EUC-KR 디코드·colIndex·xlsx round-trip(buildXlsx fixture)·rowsToCsv·진입점). 전체 2079 통과 · tsc 0 · build OK. ⚠️ 실제 Excel 저장 .xlsx 1회 운영 확인 권장(fixture 는 STORED — 실파일은 DEFLATE 경로).
- 사용자 보고: NAVER_SEARCH_CLIENT_ID/SECRET Cloudflare 등록 완료 — **이 커밋 배포부터 최저가·수요신호 활성**.

## ✅ 2026-06-12 — 네이버 데이터랩 수요 신호 ②④ (사용자 승인 "2, 4 진행")
- **`worker/utils/naver-datalab.ts`** + `GET /api/supplier/demand-signal?q=&category=` + `supplier-dashboard/DemandSignal.tsx`(등록 폼 — 최저가 박스 아래): ② 쇼핑인사이트 카테고리 내 키워드 클릭 추이 6개월 → 상승🔺/하락🔻/보합─(±10% 임계) ④ 검색어트렌드 24개월 → 성수기 월 추출(월평균이 전체평균 125%+ 인 1~3개월) + "지금 성수기 🔥 / N개월 뒤 — 준비 적기" 라벨.
- **도매 카테고리 → 네이버쇼핑 1depth 매핑** 상수(food→50000006 식품 등 6종 — 외부 택소노미라 상수 OK).
- **쿼터 소진(일 1,000회) 자연 처리 (사용자 질문)**: 429/한도 에러 감지 → KST 자정까지 데이터랩 신규 호출 차단 + 신호 null → **UI 는 박스 자체를 안 그림**(에러 노출 0 — 보너스 정보 원칙). (키워드,카테고리) 12h 캐시 + 둘 다 실패 시 미캐시(복구 후 재충전). 키 미설정도 동일하게 숨김.
- i18n 5키×6언어 · 단위테스트 13(추이/시즌성/라벨/가드/매핑) · 전체 2071 통과 · tsc 0 · build OK.
- ⚠️ 실키 검증 필요: NAVER_SEARCH_CLIENT_ID/SECRET 등록 후 등록 폼에서 상품명 입력 1회 확인.

## ✅ 2026-06-12 — 가입 역할 선택 관문 + 네이버쇼핑 최저가 대조 (사용자 요청)
- **가입 역할 관문 `/wholesale/start`**: "판매사(유통회원) vs 제조사(공급회원)" 2카드 선택 화면(겸업 안내+로그인 링크). 카탈로그 헤더 '회원가입'이 유통 폼 직행하던 것 → 관문 경유(제조사 오진입 차단 — 수동 승인 체제라 역할 오류=검수 비용). 제조 가입 폼에 역방향 링크("판매하실 건가요? → 유통 가입") — 유통→제조 링크와 대칭화. 인트로 듀얼 CTA·역할 명시된 배너("유통회원 신청" 등)는 직행 유지(이미 역할 선택됨).
- **네이버쇼핑 최저가 대조** (`worker/utils/naver-shopping-price.ts` + `GET /api/supplier/naver-price-check` + `supplier-dashboard/NaverPriceCheck.tsx`): 제조사 등록/가격수정 폼에서 상품명 800ms 디바운스 → 시중 최저가 top3 + 비교 신호(공급가≥최저가 빨강 "유통사 마진 불가" / 미만 초록 "마진 여력 ₩X" / 권장가>최저가 주의). 검색 API(developers.naver.com — 커머스API 와 별개, 일 25,000회 무료), 동일 검색어 10분 캐시, rate limit 30/분. **키(NAVER_SEARCH_CLIENT_ID/SECRET) 미설정 시 UI 자동 숨김(fail-soft)** — ⬜ 사용자: developers.naver.com 앱 등록(검색 API) → Cloudflare Variables 2개 등록. i18n 7키×6언어, 단위테스트 6.

## 🛒 2026-06-12 — 네이버 커머스API Phase A: 유통사 스마트스토어 연동 (사용자 요청)
**모델**: 유통사가 커머스API센터에서 **자기 스토어 앱**(스토어당 1개, 무료) 발급 → ID/시크릿을 `/wholesale/naver` 에서 연결(서버가 **토큰 발급으로 즉시 검증** 후에만 저장 — `encryptAtRest` AES-GCM, DATA_ENCRYPTION_KEY). 솔루션(개발업체) 계정 모델은 네이버 심사 필요 — Phase B 검토.
- **코어 `naver-commerce-core.ts`**: bcrypt 전자서명(`${client_id}_${ts}` bcrypt(salt=secret)→base64, bcryptjs 기존 dep) + 토큰 캐시(3h, 만료 5분전 갱신) + 카테고리 전체목록 모듈캐시 1h(리프 검색) + 이미지 업로드(네이버는 자체 업로드 URL 만 허용) + 상품 payload 빌더(순수 — 단위테스트 7).
- **라우트 `/api/wholesale/naver/*`** (worker mount): connect(검증 후 저장)/status(마스킹 id)/disconnect/categories?q=/export. 유통회원(approved+is_distributor) 전용, viewer 403, rate limit. export: 공급상품 검증 + **역마진 차단**(판매가<공급원가 400) + 이미지 네이버 업로드 → `/v2/products` 등록 → `naver_product_exports` 이력(UNIQUE seller+product, 재내보내기 갱신).
- **UI**: `/wholesale/naver` 연동 페이지(발급 3단계 가이드+연결 폼+상태/해제) + 대시보드 빠른메뉴 '스마트스토어 연동' + 상품 상세 "스마트스토어로 내보내기"(lazy 모달 — 판매가/재고/배송비/AS연락처/카테고리 디바운스 검색, **예상 마진 실시간 표시**, 미연결 시 연동 페이지 유도).
- **⚠️ 미검증**: 실계정 E2E — 이 환경은 외부 egress 차단. 운영에서 스토어 앱 1개로 연결→내보내기 1회 검증 필요(에러는 네이버 invalidInputs 메시지 그대로 표면화되게 함). 원산지는 '04 상세설명 참조' 기본 — 식품 등 일부 카테고리는 네이버가 추가 필드를 요구할 수 있음(에러 메시지로 안내됨).
- **Phase B(다음)**: 주문 자동 수집 → 도매 자동 발주 → 송장 푸시(드랍쉬핑 완성), 재고 동기화, 솔루션 계정 전환.

## ✅ 2026-06-12 — 가입 자동승인 전면 폐지 → 수동 승인 (사용자 결정 "제조사든 유통사든 수동")
- **사실 확인**: 유통사(wholesale register/become-distributor)·제조사(supplier register/become)는 **원래부터 항상 pending(수동)** — NTS 자동승인 배선 없음. 실제 자동승인은 ① 일반 셀러 가입(background NTS 일치 → approved) ② 어드민 recheck-nts 버튼(검증+승인 동시) 2곳뿐이었음.
- **fix**: ① `seller-registration.routes.ts` — NTS 일치여도 status 전환 제거, `nts_verify_result`/`nts_verified_at` 만 저장(검수 참고 신호 — AdminPendingSellersPage 가 이미 표시). ② `internal-admin-tools recheck-nts` — 검증(정보)과 승인(결정) 분리, 결과만 기록·응답 `ntsValid` (승인은 검수 페이지 승인 버튼으로만). ③ nts-business-verify 헤더 주석 + 운영 TODO #3 문구 정정(자동승인 → 참고 신호).
- **유지(가입 승인 아님)**: 큐레이터 정산 사업자정보 인증(미일치 400 차단 + verified 마킹) — 제출 정보 진위확인이지 계정 승인이 아님.
- NTS_API_KEY 의 가치는 그대로: 가짜/폐업 사업자번호가 검수 화면에 표시 → 수동 승인 속도·정확도 보조.

## ✅ 2026-06-12 — 도매몰 보류 부채 3종 마감 (`6e5b468`, `claude/keen-cerf-ch0jm5`)
- 주문 상태 뱃지 SSOT(`wholesale-theme.ts WHOLESALE_ORDER_STATUS` 10종 + `wholesaleOrderStatusBadge()`) — 대시보드/주문내역 중복 정의·라벨 불일치 제거.
- viewer(조회 전용 직원) UI 사전 안내(`wholesale/ViewerGate.tsx` — /me sub_role 5분 캐시, fail-open): 체크아웃 주문 버튼 disable+라벨, 충전 신청, 견적 요청 3곳. 서버 403 은 기존대로 최종 방어.
- 승인대기 데드엔드 완화: 유통 2화면+제조 1화면에 공식 문의 메일(jiwon@ur-team.com) mailto. i18n 2키×6언어.
- 카탈로그 분해(1493→550)는 기완료(`19fe20e`) 확인 — 불변 검증만(SSR consume/placeholderData/prefetch 보존, tsc 0·vite build OK). **도매 보류 부채 전부 소진.**
- 🟡 검토 backlog(신규): 네이버 커머스API — ① 네이버쇼핑 최저가 자동 대조(가격 승인 검수·developers.naver.com 오픈API, 키만) ② 유통사 스마트스토어 연동(상품 내보내기→주문 수집→자동 발주→송장 — 드랍쉬핑 파이프라인, Commerce API·유통사 스토어 연결 동의 필요). 스프린트 후 결정.

## ✅ 2026-06-12 — 공급 채널 안내 (영업단 제안 — 공급가 앵커링 견제) (`claude/keen-cerf-ch0jm5`)
**배경**: 영업단 제안 — 제조사가 공급가를 높게 앵커링하는 것을, 등록 폼에서 "공급률 낮추면 특판·폐쇄몰까지 제안 가능" 잠금해제 안내로 견제. 사용자 승인("이상적으로 구현").
- **SSOT `src/shared/supply-channels.ts`**(순수, 의존성 0): 채널 4종(오픈마켓90/공동구매85/특판75/폐쇄몰70 — **기본값은 placeholder, 영업단이 어드민에서 확정**), 공급률 계산·임계값 파싱·판정·nudge. 단위 테스트 17.
- **임계값 저장**: `platform_settings('supply_channel_thresholds')` — 하드코딩 0. 어드민 GET/PUT `/api/admin/distributor/channel-thresholds` + `AdminDistributorGradesPage` 편집 카드(기본값이면 "영업단 확정 기준으로 저장" 경고). 제조사 읽기 `GET /api/supplier/channel-thresholds`(requireSupplier).
- **제조사 UI `supplier-dashboard/SupplyChannelGuide.tsx`**: AddProductModal+PriceChangeModal 가격 입력 아래 — 공급률%·셀러 마진 여력·채널 칩(열림✓/잠김 임계%) + "공급가를 ₩X 이하로 낮추면 △△까지 제안 가능" nudge + 역마진 경고 + **과약속 방지 디스클레이머**(실제 제안·노출은 운영 검토에 따름). 권장가 미입력 시 입력 유도 한 줄만(공급가 폴백=공급률100% 오해 방지). 임계값 모듈 캐시 1회 fetch, 실패 시 기본값 폴백. i18n 7키×6언어.
- **표시 전용 레이어** — 결제가/등급가/visibility 게이트 무영향. **Phase 2(별도 결정)**: 유통사 채널 타입 태그 + 낮은 공급률 상품의 실제 채널 제안 배선 — 이게 붙어야 안내가 약속이 됨.
- 검증: tsc 0 · unit 2045(+17) · build OK. **운영**: 영업단이 `/admin/distributor-grades` 하단 카드에서 기준 % 확정 입력.

## ✅ 2026-06-12 — 도매몰 대시보드 감사 + 제조사 알림 데드경로 fix (`claude/keen-cerf-ch0jm5`)
**감사 결론**: 유통/제조 대시보드 IA·핵심 루프(가입→승인→주문→발송→정산→출금) 완성도 높음. 머니 테스트 85 + 전체 2027 통과. 오탐 5건 직접 검증 기각(입금계좌 안내·체크아웃 잔액 사전표시·어드민 견적 라우트·대량주문 엑셀·raw 에러 — 전부 이미 OK).
**진짜 버그 3건 fix**:
- 🔴 **제조사 알림 3중 데드경로**: `recipient_type='supplier'` 가 ① dashboard_notifications CHECK 제약(admin/seller/agency)에 걸려 INSERT 무음 실패 ② 읽을 endpoint 없음 ③ 벨 UI 없음 → 출금 승인/반려 알림 증발. fix: CHECK 에 'supplier' 추가(신규 DB) + **repair-schema CHECK 마이그레이션**(operation_guides 패턴 — 기존 prod 테이블 재생성, 멱등) + `GET /api/supplier/notifications`·`POST /read-all`(requireSupplier, 본인 id 만) + 대시보드 헤더 알림 벨(`supplier-dashboard/NotificationsBell.tsx`, 60s 배지 폴링·열면 read-all — main 의 분해 구조에 맞춰 별도 파일). i18n 3키×6언어.
- 🟡 **신규 도매주문 제조사 통지 부재** → `notifySuppliersOfPaidOrder()`(라인 supplier_id GROUP BY, fail-soft) — deposit·Toss confirm 양 PAID CAS 승자 경로에 배선. 접속 전엔 주문을 몰라 발송 지연되던 갭.
- 🟡 SupplierWholesaleOrdersPage 주문 로드 실패가 "주문 없음" 으로 위장 → 토스트 추가.
**⚠️ 운영**: 기존 prod DB 는 `/admin/health` 스키마 복구 1회(또는 새벽 cron) 후 supplier 알림 활성화됨 (`dashboard_notifications:check-migration`).
**남은 부채(보류)**: 카탈로그 1493줄 분해(제조대시는 06-11 분해 완료), 상태뱃지 중복 정의 통합, viewer UI 사전 안내, 승인대기 화면 ETA/문의처.
## 📌 [전 플로우 감사 잔여 백로그 — 2단계] (2026-06-12, 사용자와 논의 후 진행)
**1단계 완료(2026-06-12)** · **P1/P2/P3 완료(e42b37e7 — 지급 센터 /admin/payout-center, 큐레이터 딜 단일화, 에이전시 영입커미션 정본·수동레일 410 폐기)** · P4 완료(키 등록+배선, 정책: **양쪽 모두 수동 승인** — NTS 결과는 어드민 알림 참고 표기만, 자동승인 없음). **P5/P7 완료 + P6 폐기(사용자 결정 '선물 불필요' — '선물' 라벨만 정직한 '공유'로) + 🟢 다듬기 5종 완료 (6dd75503)** — 비-도매 감사 백로그 0. 도매 잔여는 타 세션 몫. 상세는 아래 표(이력 보존):

| # | 항목 | 내용 | 선행 결정 |
|---|---|---|---|
| P1 | **정산 지급 센터** (M-L) | 셀러 settlements(영구 pending)·큐레이터 user_withdrawals(처리 주체 0)·에이전시 agency_settlements(어드민 endpoint 0) — 신청→승인→입금완료를 어드민 한 화면으로 통일 | 실제 송금 운영 방식(누가/언제/어떻게) 청취 후 설계 |
| P2 | 큐레이터 이중지급 정책 (S-M) | /track 이 전원에게 딜 즉시적립 + 사업자 셀러는 현금 출금 가용액에 중복 산정 (affiliate.routes:183 vs curator.routes:809) | 사업자 큐레이터 보상 = 딜 vs 현금 택1 |
| P3 | 에이전시 보상 3중 레일 정리 (M) | intro 2% / agency_settlements 2% / ledger agency:N(유일 실지급) — P1 고치는 순간 중복지급 구조 | 정본 레일 확정 |
| P4 | NTS 사업자 자동검증 도매/공급 배선 (M) | nts-business-verify 가 일반 셀러 가입에만 연결 — wholesale:651·supplier-auth:95 에 fail-soft 호출 + 어드민 표시 | NTS_API_KEY 등록과 함께 |
| P5 | 셀러연결 큐레이터 핀 비노출 (M) | linked seller 면 /u/:handle 이 SellerPublicPage(잠금) 통째 렌더 → 핀 그리드 도달 불가 | SellerPublicPage 에 핀 탭(UNLOCK) |
| P6 | 교환권 진짜 선물 플로우 (M) | 현 '선물'=QR 공유 + 보낸이 셀프취소 가능(수령자 무효화 위험). gift-claim 플로우는 일반상품만 배선 | 제품 결정 |
| P7 | admin_token wipe 정책 통일 (S) | redirect 콜백 allowlist wipe 가 admin_token 소거 — SPA 콜백과 불일치 | 같은 user.id 재로그인 시 보존 여부 |
| 🟢 | 잔여 다듬기 | 알림 무한스크롤(50 고정)·언어설정 마이 노출·만료 교환권 접기·푸시 soft-prompt·장바구니 계정키·클레임 환불 딥링크·KT trigger 관측성(의도적 유지) | — |

**의도적 비수정(설계 의도 보존)**: KT 발송 trigger 동기 INSERT(silent-fail 증거 수집 목적), dead promo 코드(복귀 가능성 — dual-mode 룰).


## ✅ 2026-06-11 (오후~밤) — 이미지 파이프라인 정석화 + 응답경로 수술 + 공구 플로우 마감 (`claude/service-analysis-optimization-whpu0f`)
- **이미지 3단 수리**: ① `_routes.json` 확장자 글롭(`/*.jpg` 등)이 `/api/media/**.jpg` 워커 미도달 → SPA HTML 폴백 (업로드 이미지 전부 깨짐의 진범, 루트 정적 명시목록으로 — 재발 방지 주석) ② 기프티쇼/KT cdn-cgi 직결(실측 143KB→18KB, `CDN_CGI_VERIFIED` — kakaocdn 회귀 교훈: 실측 통과 호스트만) ③ **R2 커스텀 도메인 media.ur-team.com + zone 리사이저** (실측 779KB→9.7KB) — 레거시 `/api/media/` URL 도 도메인 매핑으로 전부 치유, 아바타 소비처 cfImage 래핑. ⚠️ biz-cert 비공개 버킷 분리 = 부채.
- **응답경로 부수효과 전수조사**: 참여하기(93b58ee1) 레시피로 user-facing 9건 수술(선물 confirm·바우처 부분환불·동네공구 3·hosting DDL·payment /confirm referral 알림 `[UNLOCK]` 승인). admin/저빈도 ~10건 보고만.
- **공구 E2E 감사 → 갭 5+2 마감 (c7f59a78)**: idempotency_key·ref 클라 전송(서버 기지원), 토스 실패 toast, 충전 복귀 loginReturnUrl, **공구 자동정산 셀러 가시화(RestaurantSettlementsSection 신설)**, 동네딜 카드 prefetch, deal_only flip cron.
- 기타: vitest 2→4.1.8(allowlist 0), critical-path 번들 예산 300KB, 도매 God 2파일 분해, ➕ 겸직 1탭 등록(da0844dd), 로그아웃 링크샵 잔존키, 카카오 프로필 덮어쓰기 보존, beta robots 차단, SSR 쿠키 E2E 워크플로, prod-diag 워크플로(재사용 가능 진단 도구), Web Analytics beacon, 공급계약서 v2(가/나·리스터코퍼레이션).
- **사용자 액션 잔여**: WS_E2E 시크릿(선택), beta 등급가 브라우저 확인, "에러 많다" 콘솔 스크린샷 대기.


## 🎯 [최우선 — 2주 스프린트 2026-06-11~25] 코드 동결, 영업 집중 (사용자 합의)
**근거**: 전 진단이 한 숫자를 가리킴 — 활성 상품 1개. 엔지니어링 한계수익 ≈ 0, 영업 1시간 > 코드 10시간.
| 트랙 | 담당 | 내용 |
|---|---|---|
| 영업 (시간 80%) | **사용자** | `docs/sales/manufacturer-proposal.md` 제조사 발송(일 10곳) · `docs/sales/seller-recruit-1st.md` 공지 게시 · 매장 방문 |
| SSR Phase 2-F→컷오버 | A세션 (백그라운드) | docs/SSR_PHASE2_AUTH.md F단계 → Phase 3 |
| 온콜 (버그/신고만) | B세션 | **신규 기능 제안·착수 금지** — 신고 대응만 |

**2주 판정 숫자**: 제조사 회신 5 · 등록 상품 30 · 셀러 가입 20 · 동네딜 매장 3.
⚠️ 다음 세션 규칙: 이 스프린트 중 사용자가 새 기능을 요청해도 "스프린트 합의" 리마인드 후 진행 여부 재확인.


## 🚀 [확정 프로그램] SSR 전면 전환 (옵션② — 사용자 결정 2026-06-10)
**SSOT: `docs/SSR_MIGRATION_PLAN.md`** — React Router v7(구 Remix) on CF Workers, 3 Phase.
**Phase 1 진행 상황** (파일럿: https://ur-ssr-pilot.jiwon-1a2.workers.dev — Workers 무료 티어, 비용 0):
- ✅ 2026-06-11 파일럿 확장 (`apps/ssr/` 만 수정, 본체 무수정): **동네딜 `/group-buy`**(카테고리 칩별 예열 키 `?status=active[&category=X]` byte-identical) + **링크샵 `/u/:handle`**(`/api/curator/:handle` — cron dynamic prewarm 키와 동일) 신설 + **본 사이트 실디자인 이식**(card-gradient 1:1 포팅, VoucherCard/GroupBuyGridCard/프로필 카드형 링크샵 헤더/핀 그리드/WT 도매 토큰, TopBar+BottomNav 셸). HTML 엣지캐시 60s(`workers/app.ts`) 무수정 — 신규 GET 라우트 자동 적용.
- ✅ Phase 1 게이트 통과 (사용자 검증 완료 2026-06-11).
- ✅ 2026-06-11 **Phase 2 (1/2)** (`apps/ssr/` 만): **상세 3종** `/group-buy/:id`(즉시판매 단일가 블록·절약 pill·trust 뱃지·sticky CTA, API `/api/group-buy/products/:id` 60s/900s 캐시 정합) + `/products/:id`(화이트 테마, deal_only→vouchers CTA 분기) + `/wholesale/product/:id`(guest 가격잠금·정보리스트·가입 CTA, 60s/300s) + **검색 `/search`**(GET form — JS 없이 동작, q 없으면 `/api/search/popular` 인기검색어, 결과는 `/api/products?search=`+오타보정 suggested_query, 정렬 칩). 리스트 카드 → 파일럿 내부 상세로 링크 전환. HTML 엣지캐시 60s 불변.
- 📋 **Phase 2 (2/2) 인증 쿠키**: 설계 문서 `docs/SSR_PHASE2_AUTH.md` 작성 완료 — httpOnly dual-write(`ud_*` 쿠키, Domain=.ur-team.com), 미들웨어 GET-only 쿠키 fallback, CSRF 표면 0 유지, kakao.routes 는 UNLOCK 절차. **구현은 본체(src/) 수정이라 B세션과 조율 후** (선행: beta.ur-team.com 연결 — workers.dev 는 쿠키 공유 불가).
- 스모크(ssr-pilot.yml)는 `/`·`/wholesale` 만 — `/group-buy`·`/search` 추가 권장(워크플로 1줄, 폴더 제한으로 미수정).
사용자 액션: 스테이징 서브도메인 1개 (Cloudflare). ⚠️ 기존 `/api/*`·Toss/카카오 잠금 무수정 원칙.


## 📌 운영 액션 TODO (사용자가 직접 — 코드 아님)

| # | 액션 | 소요 | 효과 | 상태 |
|---|---|---|---|---|
| 1 | **`REPAIR_SCHEMA_TOKEN` 등록** — ① 긴 랜덤 문자열 1개 생성(40자+) ② Cloudflare Dashboard → Workers & Pages → ur-live → Settings → Variables and Secrets 에 `REPAIR_SCHEMA_TOKEN`(Secret) ③ GitHub `tobe2111/ur-live` → Settings → Secrets and variables → Actions 에 **같은 값** 등록 | 5분 | 배포할 때마다 스키마 자동복구 → `/admin/health` 수동 클릭 영구 졸업 (미설정 시 매일 새벽 3시 cron 만) | ⬜ |
| 2 | (1번 전까지 1회) `/admin/health` 스키마 복구 실행 — 2026-06-10 등록한 products 컬럼 14개 수렴 | 10초 | 상품 상세 자가치유 prune 상태 → 완전 복귀 | ⬜ |
| 3 | `NTS_API_KEY` 등록 (Cloudflare Variables) | 5분 | 가입 사업자번호 국세청 진위확인 → 검수 화면 **참고 신호** (🛡️ 2026-06-12 사용자 결정: 자동승인 폐지 — 모든 가입은 수동 승인) | ⬜ |
| 4 | `/admin/wholesale-deposit-account` 에서 도매 입금계좌 설정 | 2분 | 유통사 충전 입금 안내 표시 | ⬜ |
| 5 | `TAX_INVOICE_API_KEY` + `TAX_INVOICE_SENDER_BIZ_NO` (바로빌) | 10분 | 세금계산서 실발행 (미설정 시 draft 저장만) | ⬜ |
| 6 | `RESEND_API_KEY` | 5분 | 어드민 단체메일 발송 | ⬜ |
| 7 | **숙소 실결제 E2E 1회** (소액 결제→취소) | 10분 | reserve-before-charge 재구성(06-04) 실결제 미검증 ⚠️ | ⬜ |

## ✅ 2026-06-10 (오후) — 홈 v2 마감 + products 500 영구화 + 링크샵 구조개편 (`claude/service-analysis-optimization-whpu0f`)
- **products 'no such column' 500 영구 해결 (`356e8c2`,`07de4ee`)**: `/api/products/:id` findById 자가치유 누락분 적용 + **전수조사** — 소비자 SELECT 전부 healed+pruning, 에이전시 2곳 오적용 버그 수정(비-products 테이블에 products 컬럼 헬퍼), 명시목록에서 미존재 컬럼(shipping_fee/base_shipping_fee) 제거, repair-schema 에 14컬럼 등록, **신규 CI strict `check-product-detail-fields-repairable.mjs`**(명시목록 컬럼은 base∪repair 로 반드시 복구 가능해야 머지).
- **홈 v2 (`cc7112e`,`93fcf47`,`1ea848c`,`4ddb38f`)**: 상품 레일 = 쇼핑 카드(BrowseProductCard) 그대로 공유(할인%·별점·리뷰·구매수) + 알약형 카테고리 칩(전체/식품/패션/뷰티/리빙/디지털, 선택=검정) + '우리 동네딜' 섹션 제거(하단바 탭 전담, 컴포넌트 보존) + 교환권 '더보기/전체보기' → '교환권 더보기' 단일 버튼.
- **링크샵 구조개편 (`e1df59c`)**: 배경(사진/그라데이션/꾸미기 시트) **완전 제거** → 프로필 카드형(아바타+이름+소개+CTA 가운데 정렬). 인라인 편집·사진 업로드 3중 방어 유지. banner_url 은 레거시 무시(DB 불변 — 가역).
- **/my-deal-history (`5e6baa2`)**: 핑크→B&W(차콜 hero·검정 칩), '쇼핑'→'교환권 쓰기', 다크모드 구분선 fix.
- 멀티몰 어드민 예치금 몰 필터는 적용 확인됨(AdminMallSelect in AdminWholesaleDepositsPage) — 이전 '진행 중' 표기 해소.


### ✅ 2026-06-10 — 오프라인 공구 운영 루프 마감 3종 (현장 스캔·재발행·단골 알림) (`claude/service-analysis-optimization-whpu0f`)
**플로우 감사(8단계) 결과**: 6단계 이상적(발행 OCR 5분·결제·청약철회·자동정산·지역필터·NTS자동승인은 키만 대기) — 감사 에이전트 오탐 4건 직접 검증 기각. 진짜 갭 2개 구현:
- **현장 사용 1탭**: `/seller/scan` 계산대용 스캔 화면 신설(BarcodeDetector 네이티브, QR `/v/<code>` 파싱 → use-by-seller 1탭, 연속 스캔+세션 이력+진동 피드백+수동입력 폴백). 셀러 nav 공구그룹 최상단 + 대시보드 홈 안내카드에 직행 버튼(문구만 있고 누를 곳 없던 갭).
- **재발행 복사**: 공구 카드 "같은 내용으로 재발행" → `?copyFrom=` 프리필(`GET /api/seller/products/:id` 소유자 전용 신설 — 공개 상세는 active만 매칭이라 종료 공구 복사 불가했음). 날짜는 새 기본값 리셋.
- **단골 알림 문구**: 발행 시 팔로워 알림은 기존 구현 확인(notifyFollowers+카카오) — voucher 면 "단골 매장이 새 공구를 열었어요!"+`/group-buy/:id` 링크로 분기(전환율).
- i18n 18키×6언어. tsc 0 · unit 1528 · build OK. **운영 대기: NTS_API_KEY 등록(가입 즉시 자동승인 활성화).**

### 🔴→🟢 2026-06-10 — 교환권 상세 전사 500 인시던트 + 4중 방어선 + 구조적 후속 (`claude/service-analysis-optimization-whpu0f`)
**✅ 해결 확정 (7a7ff8c — CI 스모크가 prod 실상품 상세 호출 GREEN)**: 1차 명시목록 중 prod 미존재 컬럼이 잔여 500 → `withColumnPruning` 자가치유(누락컬럼 자동 prune+재시도)로 영구 마감. prune 된 컬럼명은 wrangler tail `[product-columns]` 로그 → repair-schema 등록 시 완전 복귀(선택).
**원인(_diag 실측 확정)**: products 컬럼 누적(94 ALTER+)이 **D1 결과셋 한도(100) 초과** → `SELECT p.*`+JOIN 전부 `too many columns in result set`. 어제 도매몰 컬럼 추가가 한도를 넘기며 '없던 500' 발생.
- **즉각 수정**: `productDetailCols()` 명시목록 SSOT(`shared/db/product-columns.ts`) — star-select 9곳 교체(교환권/공구 상세·join 구매경로·상품 리포지토리·FTS·에이전시). 부수: `store_verify_pin` 공개 누출 보안홀 동반 차단.
- **4중 방어선**: ① star-select CI 차단(`check-no-select-star-products.sh`, strict) ② repair-schema `column_counts/warnings`(85+ 경보) ③ 배포 smoke 에 실 상품ID 상세 검증 ④ KNOWN_ERRORS/CLAUDE.md 등재.
- **구조적 후속**: products **컬럼 예산제**(baseline 94 고정, 신규 ALTER CI 차단) + `product_supply_meta` K-V 사이드테이블(미래 도매/전시 메타) + **배포 후 스키마 자동복구**(`POST /api/_internal/repair-schema/auto`, X-Repair-Token — ⚠️ 활성화하려면 같은 값을 Cloudflare Variables + GitHub Secrets 양쪽 `REPAIR_SCHEMA_TOKEN` 등록).
- repair-schema 8건 오류 근본수정(실행순서/라이브 가드/백필 CPU 배치). 링크샵 banner_url 응답 누락+저장 후 캐시 purge. 로그인 페이지 라이브 잔재 제거+개편. 도매 become 대표자/담당자 서버 필수. 프리미엄 전용관 로그인 게이트. 위시리스트 그라데이션 카드. 동네딜 카드 메모리캐시+pointerdown 워밍.
- **사용자 확인 대기**: ① 교환권 상세 정상화 확인 ② `/admin/health` 스키마복구 재실행(오류 0 기대) ③ REPAIR_SCHEMA_TOKEN 등록(선택).

### ✅ 2026-06-10 — 하단바 ➕(공구 제안) + 쇼핑 잠정 숨김 + 라이브 잔재 정리 (`claude/service-analysis-optimization-whpu0f`)
**사용자 결정: 라이브커머스 영구 중단 / 쇼핑 잠정 보류(가역) / 동네딜 집중. CLAUDE.md `[UNLOCK_LOADING]` audit log 기록.**
- 하단바: 홈·동네딜·**➕(만들기)**·링크샵·마이 — `SHOPPING_TAB_HIDDEN` 플래그(false=쇼핑 탭 즉시 복원). ➕ 시트: 유저=동네 공구 제안(`/community-group-buy/new`), 셀러=공구권 등록/대시보드(기존 휴면 시트 재활용).
- **수요 신호 루프 마감**: 제안 생성 → 어드민 벨 알림(`/admin/restaurant-demand` 링크) · 공구 확정 → 참여자 전원 알림("공구가 확정됐어요"). ➕가 데드엔드가 아니게 하는 핵심.
- PC: DesktopTopNav 라이브 탭/LIVE 배지 숨김(LIVE_COMMERCE_SUSPENDED) + 쇼핑 탭 숨김 + 링크샵 탭 추가. DesktopLiveSidebar 둘러보기·쇼핑 카테고리 숨김(식사권 유지). index.html Speculation Rules `/live/*` 제거.
- 링크샵 재정향(동네딜 유통 채널화): 식사권 탭을 상품 앞으로 + 홈 탭 교환권/공구 핀 우선 정렬.
- i18n 4키×6언어(nav.create, bottomNav.sheetTitleCreate/proposeDeal/proposeDealDesc). tsc 0 · build OK.
- **30일 판정 지표**: ① ➕ 제안 수 ② 제안→공구 오픈 전환율(0이면 ➕를 동네딜 FAB로 강등) ③ 동네딜 전환.

### ✅ 2026-06-10 — 어드민·셀러 대시보드 IA/코드 개편 (`claude/service-analysis-optimization-whpu0f`)
**사용자 불만 "복잡한 상태" → IA(정보구조) 중심 개편. 라우트 전부 보존(북마크/딥링크 안전), 동작 변화 0 원칙.**
- **어드민**: ① nav 그룹 접기/펼치기(localStorage `admin_nav_collapsed_v1`, 활성 그룹 강제 펼침) ② 고아 라우트 18개 nav 등재(반품검수/원천징수/인플송금/교환권추적/에이전시셀러심사 등) + **🔧 개발자 도구 그룹 신설**(health/errors/env-check/kakao-test/youtube-quota — 기본 접힘) ③ 정산 4페이지(개별/일괄/Ledger/추천출금) `AdminFinanceTabs` 상단 탭 — nav '정산 센터' 1항목(`also` 활성매칭) ④ `AdminDataTable` 공통 테이블(데스크톱 table+모바일 카드 자동, 도매주문/무결성 2페이지 레퍼런스 적용) ⑤ 잔여 수동 fetch 9페이지 → `useApiQuery`(낙관 업데이트=setQueryData, 폴링=refetchInterval, 수동헤더 보존. 못 옮기는 페이지 사유는 commit 참조: env-check 503-body 시맨틱, live-monitor 사운드 사이드이펙트 등) ⑥ AdminBulkEmail native confirm→confirmDialog.
- **셀러**: ① `SellerPage` "라이브 시작" 버튼 `LIVE_COMMERCE_SUSPENDED` 게이트(중단 기능 노출 잔재 — 역할 게이트만 있었음) ② 상품/묶음/재고 `SellerProductTabs` 탭 통합(nav 3→1) ③ 신규 셀러(상품0·주문0) `NewSellerSteps` 3단계 시작 카드 + i18n 6언어(`seller.newSteps.*`) ④ `SellerSettlementsPage` 1,172→419줄(`seller-settlements/` 7파일 추출) ⑤ `SellerBusinessInfoPage` 797→514줄 3탭화(`?tab=`, `#bank-info-section` 해시 호환 유지).
- 검증: tsc 0 · unit 1528 · `npm run build` OK. commits `613c6d8`(IA) `3aa0740`(DataTable) `6d27cdb`(셀러 분해) + useApiQuery 마이그레이션.

### ✅ 2026-06-09 — 서비스 전체 분석 + 도매몰 perf/관측성 개선 (`claude/service-analysis-optimization-whpu0f`)
**분석 결론**: 잠금 최적화 회귀 0 · critical path 228→257KB gzip(+13%, 유기적 성장 — 모니터 권장) · 도매 페이지 chunk 분리/스켈레톤/캐시헤더는 기적용 확인(서브에이전트 오탐 다수 직접검증으로 기각).
**적용 fix (전부 비잠금·additive)**:
- `wholesale.routes.ts` GET /catalog/:id — 등급/테이블/최소마진/qty-tier 4쿼리 순차→`Promise.all`(3 RTT 절약, 리스트와 동일 패턴).
- 인덱스 2종: `idx_wholesale_orders_toss`(confirm 조회) + `idx_supplier_settlements_order_source`(정산 멱등) — ensureOrderTables + repair-schema 양쪽.
- silent catch `.catch(()=>{})` → `swallow(label)` 관측성 통일(~20곳): deposit-core(차감 CAS·환불 복원 — 환불 UPDATE 무음실패=유통사 손실이라 최우선), withdrawal-core, tax-invoices(issued 마킹 실패=이중발행 위험), quotes 알림, supplier-auth same-email 연결, ship-all, distributor-admin. 동작 불변 — 로그만 추가.
- `WholesaleCartPage` 썸네일 cfImage(width 128) 적용.
**보류(의도)**: 도매 14페이지 i18n 전면 전환 — 국내 사업자 전용 B2B(사업자등록 필수)라 실효 낮음, 기존 후속 backlog 유지.
검증: tsc 0 · unit 1528/1528 · `npm run build` 전체 체인 OK · schema-refs OK.

### ✅ 2026-06-09 — 도매몰 대개편 (예치금 결제·메인·운영기능·채팅) + 코드리뷰 fix
**대장정 1세션. 사용자 요구 11종 전부 구현 + 검증. 전부 `claude/service-tech-debt-analysis-d1KOx` 브랜치 커밋·푸시.**

- **예치금(선불) 결제 전환** (`e962f94`, `9e4a2f3`): 도매 결제 **토스 제거 → 예치금**. 유통사 입금 → 관리자 입금확인(`/admin/wholesale-deposits`, CAS pending→confirmed 이중적립 차단) → 충전 → 주문 시 원자 차감. 여신(외상) 제거. `wholesale-deposit-core.ts`(머니 CAS) + `wholesale-deposit.routes.ts`. 입금계좌 어드민 설정(`/admin/wholesale-deposit-account`, platform_settings). **코드리뷰 후 reserve-before-charge 재구성**: 주문 PENDING INSERT(UNIQUE idempotency_key 가 race 단독 중재) → 이긴 요청만 1회 차감 → 재고확보 후 PAID. (🔴 무음손실·이중차감 근본수정.) `/wholesale/deposits` 충전 UI, 카탈로그·대시보드 잔액 노출.
- **가입 대표자/담당자** (`df694ed`): 가입에 대표자(성명·연락처)+담당자(성명·연락처·이메일) 분리 + '동일' 원클릭 복사. sellers/suppliers 컬럼(representative_phone/manager_*). 승인→가격노출 게이트 검증.
- **메인 Sellpie형 개편** (`ccf3c85`): 배너 캐러셀(어드민 CRUD `/admin/wholesale-banners`) · 프리미엄 전용관(`products.is_premium`+토글 `/admin/wholesale-products`) · 제안/신고(`wholesale_proposal_tickets`, 경로 **/proposal-tickets** — /proposals 는 기존 추천) · 카테고리 네비 · BEST PRODUCT/상품코드. 시안: `docs/design/wholesale-main.md`.
- **운영 기능**: 대량주문 엑셀(`ad9cce3`, 즉시결제 버그→미리보기/검증/장바구니) · 어드민 단체메일(`9198d05`, Resend 재사용 — **큐화 진행 중**) · 세금계산서 자동(`93b4216`, 매출 플랫폼→유통사 / 매입역발행 제조사→플랫폼, `issueTaxInvoice` 재사용 env-gated, `wholesale_tax_invoices`).
- **채팅** (`f439592`, `060b77a`): 유통사↔제조사 **D1 폴링**(무비용, lazy chunk, adaptive). `/api/wholesale/chat` (cheap `/unread`, threads, messages?after, send+멱등알림). 제조사 신원 **마스킹**(유통사 뷰='제조사'). 유통사발 상품 문의(by-product, 서버가 supplier 해석).
- **대시보드/UX**: 제조사 4탭+액션홈(`dfd2ffe`) · 제조/유통 사이드바 셸 통일(`e61f21a`) · 어드민 알림 벨 fix(`8cb412e`, tokenKey 명시) · 제조 카카오가입(`5bc2d14`) · **perf 패스**(`93d106c`, 스켈레톤·cfImage·prefetch·memo·guest 캐싱) · 어드민 프리미엄토글+대표/담당자 표시(`78d49a1`).
- **머니-안전 강화** (`8e4cc52`, `5186c9e`): 예치금 reconcile cron(`0 * * * *`) — 차감 후 PAID 직전 크래시로 묶인 주문 자동 환불(미회수 0). `compensateDepositOrderOnce`(refunded_amount CAS=신뢰 마커, 이중환불 불가). **머니 코어 회귀 테스트 12개**(`src/tests/unit/wholesale-deposit-core.test.ts`·`wholesale-vat.test.ts`, vitest).
- **🏬 멀티몰 테넌시 Phase 1** (`927908d`, `0640d20`): 카테고리별 도매몰 복제(식품/패션…, **같은 사업자, model B=몰별 가입**). 핵심: 몰별 가입이라 seller_id/supplier_id 가 몰-유니크 → **예치금·정산·세금·채팅·주문 자동 격리(미변경)**. `wholesale_malls` 테이블(id=1=유통스타트 시드) + `mall_id`(DEFAULT 1) on sellers/suppliers/products/banners/proposals. `resolveMallId`(계정몰→`?mall`→host→1) / `registrationMallId`(host). 카탈로그·배너·제안 `COALESCE(mall_id,1)=?` 스코프. host 브랜딩(`GET /api/wholesale/mall` + `useWholesaleMall`, CSS변수 `--ud-brand`, fallback 유통스타트/#FF0033). 어드민 몰 관리(`/admin/wholesale-malls` CRUD) + `AdminMallSelect`(≤1몰 자동숨김) 필터(배너/제안/상품). **불변식: 기본몰+단일host = byte-identical**(검증: 머니테스트 회귀, /orders 불변).

**🏬 새 카테고리 몰 추가 런북 (멀티몰)**:
1. `/admin/wholesale-malls` 에서 몰 생성(slug·상호·**host**·브랜드색·로고·카테고리·입금계좌).
2. Cloudflare: 그 host(예: food.도메인)를 **같은 Pages 프로젝트(ur-live)** Custom Domain 으로 연결. (DNS 전엔 `?mall=slug` 로 테스트.)
3. 미들웨어가 host→mall 자동 판별 → 그 몰 카탈로그/브랜딩/가입. 가입자는 그 몰 전용(model B). 끝.
- **Phase 2 (선택)**: 어드민 예치금/세금 뷰 몰 필터(거의 완료) · 카테고리별 통합 회계 뷰. (개별 장부는 model B 로 이미 격리됨 — 뷰만.)
- **멀티몰 Phase 2 통합 관제**(`58bb3cc`): `/admin/wholesale-overview` 몰별+합산(GMV·예치금 부채·대기 입금/제안). 어드민 예치금/세금 몰 필터(`12e614a`). 상품 mall stamp(`91f330a`). **복제 매끄럽게**(`413d8df`): 새 몰 host 루트→/wholesale(소비자 host fast-path skip) + 몰별 입금계좌(/deposits/me 가 sellers.mall_id→wholesale_malls.deposit_account 우선).

- **B2B 운영 공백 4종 + 감사 (2026-06-09 후반)**:
  - **#1 제조사 정산 출금**(`1886ed7`): 출금 신청→어드민 송금확인. `reserved_amount`(recompute 불간섭) 원자 reserve CAS, 승인=음수 settlement+available 순감, 반려=복원. 머니 테스트 7(`38949c9`).
  - **#2 최소주문금액+배송비**(`a0fcbb3`): 제조사별 정책(suppliers.min_order_amount/shipping_fee/free_ship_threshold) + wholesale_orders.shipping_total. /orders 게이트=PENDING insert 전, chargeTotal=subtotal+shipping(deduct/보상환불 전액).
  - **#3 직원 서브계정**(`51d1b89`): wholesale_sub_accounts(role admin/staff/viewer). sub-login=부모 seller_id 토큰. viewer 주문 차단. 인증 불변.
  - **#4 브랜드 전시관**(`47c8892`) + **주문/정산 엑셀 export**(`4114d05`).
  - **🔍 전체 감사 → 수정**(`85233b1`,`0a7727a`): 🔴 배송비 환불 누락(reconcile+어드민환불) · 🟡 크로스몰 주문 차단(mall_id) · 채팅 supplier_id 누출 차단 · viewer 게이트 확대(충전신청/클레임/견적) · 배송비 세금계산서. **머니/테넌시/채팅 테스트 72**. **i18n 410키×6언어**(`53f1e78`).
  - **결정됨 🟡#6**: `suppliers.email` 글로벌 UNIQUE 유지(제조사=1몰 본성, (a)). 여러 몰 가입 원하면 `(email,mall_id)` 복합으로 전환.
  - **확인要 🟡#7**: 배송비를 과세 공급으로 처리(매출 세금계산서에 포함). 비과세면 되돌릴 것.

**⚠️ 운영 반영 전 (SSOT — 다음 세션/배포 담당 필독)**:
- env: `RESEND_API_KEY`(단체메일) · `TAX_INVOICE_API_KEY`(+`TAX_INVOICE_SENDER_BIZ_NO`, 세금계산서 실발행 — 미설정 시 draft) · `RATE_LIMIT_KV`.
- **`/api/_internal/repair-schema` 1회 트리거** (새 테이블·컬럼·인덱스 생성 — D1 migration CI 미작동).
- 어드민이 `/admin/wholesale-deposit-account` 에서 **입금 계좌** 설정해야 유통사 입금 안내 표시.
- E2E 권장: 충전→입금확인→주문→환불 / 세금계산서 / 채팅 / 대량주문 / 단체메일(테스트 먼저).

**진행 중 / 후속**:
- ✅ 단체메일 **cron 큐화**(`4d1a1ba`, claim-before-send CAS=at-most-once) · 운영가이드(`cef96e3`) — 완료.
- 🔄 멀티몰 어드민 예치금/세금 뷰 몰 필터 — 에이전트 작업 중.
- 후속: 멀티몰 Phase 2(통합 회계 뷰) · 세금 역발행 sender/receiver 매핑(실 provider 연동 시) · 도매몰 i18n 6개 언어(현 defaultValue fallback) · 단체메일 HTML 감지 휴리스틱(#6).
- **확인 요망**: 채팅 제조사 신원 — 현재 '비공개' 모델에 맞춰 **마스킹**. 노출 원하면 변경.

### ✅ 2026-06-06 — 도매몰 감사 후속 fix (대시보드·등급·로그인·보안)
세 감사(등급제/제조대시보드/유통대시보드) → 3차(에러처리·등급·대시보드) → 2차(로그인 B2) → 1차(보안) 순 완료.
- **대시보드·등급 4종** (`f9822d2`): ① 유통사 대시보드 부분 로그아웃(수동 키 삭제) → `clearAuthData('seller')`+full reload. ② 제조 대시보드 `/orders` shipped 필터에 `DONE`/`PARTIAL_REFUNDED` 추가(발송완료·부분환불 주문이 안 보이던 것) + 운송장 입력 시 `PARTIAL_REFUNDED→SHIPPING` 전환 허용. ③ 제조 대시보드 개요탭 `/me` 실패 시 blank null → 에러+재시도 버튼. ④ 유통 카탈로그 `/me` 실패 시 등급 silent C-fall → "등급 로드 실패·재시도" 배지+toast+refetch(B4).
- **B2 카카오 로그인 UX + 보안 L1/L2** (`781fa9a`): B2=카카오로 도매 로그인 시 기존 유통회원도 user_id 세션만 있어 "신청하기" 배너(=로그인 안 됨처럼) 보이던 것 → 카탈로그 mount 시 `become-distributor` 자동 시도(승인 회원만 토큰+reload, 신규는 배너 유지). L1=distributor-admin 세금계산서 raw `(err).message` 누출→safeError(503). L2=제조사가 `UTONGSTART_ONLY`(관리자 선정 전용) 가시성 self-assign 가능→`normalizeVisibility(v, selfServe=true)` 로 `APPROVED_CHANNEL` 강등(생성/CSV/PATCH 3경로, 관리자 경로 불변).
- **M1 보안 — 카카오 become verified 게이트** (`b61a660`, 사용자 승인): `become-distributor`/`become` 의 same-email 자동연결이 카카오 email verified 미검사 → 미verified email 로 사전등록(관리자 시드) 승인 계정 takeover 가능. `KakaoAuthService.upsertUser` 가 매 로그인 시 `users.email_verified` 저장(additive) + 두 become 경로가 `email_verified===1` 일 때만 자동연결. CLAUDE.md audit log 기록.

### ✅ 2026-06-05 (후속) — 정렬 근본수정 · 팝업 전면 인앱화 · 링크샵 영역 그라데이션
- **정렬/로딩 근본수정** (`3a5bc93`): `ProductRepository.findAll` 이 `dominant_color` 미적용 DB 에서 매 요청 `no such column` 실패→재시도(쿼리 2회+SELECT* 페이로드) → 느린 로딩 + 정렬 무시. 컬럼 존재여부 모듈캐시(`_dominantColorCol`, group-buy 패턴)로 최초 1요청만 재시도 → 이후 1차 성공(빠름+정렬보존+슬림). 옛 폴백의 ORDER BY 덮어쓰기 제거.
- **네이티브 confirm/alert 전면 인앱화** (`7d7067d`): `confirmDialog`/`alertDialog`(`ConfirmHost` 마운트, 네이티브 fallback) 로 어드민·에이전시·셀러·유저대면 ~95파일 교체(위험액션 danger 빨강). prompt()·로컬 confirm()함수·인프라 fallback 은 보존. 7 Opus 병렬.
- **링크샵 영역 그라데이션** (`eb0cdd1`, `b7a49d5`): 헤더를 하드엣지 배너박스 → 페이지로 페이드되는 영역 그라데이션 백드롭(아바타 히어로)으로 재설계 + 추천핀/누적클릭/30일적립 통계 3종 제거(수익은 대시보드 CTA 유지). 핀 카드도 쇼핑/동네딜과 동일 cardGradient(대표색 번짐+라이브 추출) 적용.

### ✅ 2026-06-05 — UI/버그 묶음 완료 (이번 세션)
- 마이(`/user/profile`) → `/` 무한튕김 **영구수정**: 내부 가드를 `ProtectedRoute`와 동일 기준(user_id/session_login)으로 통일(셀러+유저 이중로그인 시 user_type='seller'라 튕기던 것).
- 셀러 프로모코드 403 수정: `/api/promo/seller/list` 에 seller Bearer 헤더 명시(인터셉터 prefix 밖).
- 상품 카드 그라데이션(쇼핑+동네딜): 이미지 로드 시 대표색 즉시 추출→카드 단색 배경+같은색 번짐(경계 제거), 글자색 밝기 자동대비. 동네딜 카드 `GroupBuyGridCard` memo 추출.
- 카드 간격 통일(교환권/동네딜/쇼핑 `gap-x-2 gap-y-2.5`) + 이름↔가격 공백 제거(min-h 제거).
- 쇼핑(`/browse`): 식사권 카테고리 칩 제거 · '오늘의 핫딜' 배너+타이틀 제거 · '최근 본 상품' 섹션 제거.
- 상품상세(`/products/*`): 다크모드 흰 선 제거(인라인 흰색 띠/카드/divide → gray-50+dark variant, 라이트 불변) · 담기/선물 플로팅 버튼 통합(겹침 제거, 이모지→lucide 아이콘 라벨 pill).
- 도매몰: 모바일 기능줄(주문/거래/자료/OEM) 추가 · **유통사 대시보드 허브 신규**(`/wholesale/dashboard`) + 헤더 진입버튼.
- 홈 기본 커피/음료 · 동네딜/링크샵 로딩 전수조사 fix (아래 상세).

## 📋 도매몰·대시보드 TODO / 확인 체크리스트 (2026-06-04) — "남은 할 일" 물어보면 여기 참조

### ✅ 사용자 확인 필요 (배포 반영 후 체크)
- [ ] `/wholesale` 진입 시 헤더에 **제조회원 로그인 + 유통회원 로그인 + 가입** 버튼 표시
- [ ] 어드민 좌측 nav 가 **🏭 도매몰 / 🏪 오프라인 공구 / 🛒 온라인 쇼핑** + 공통으로 분류됨
- [ ] `/admin/distributor-grades` → **'데모 상품 10개 생성'** 클릭 → `/wholesale` 카탈로그에 10개 노출
- [ ] `/group-buy` · `/u/:handle`(링크샵) 카드 로딩 빨라짐 (SSR 엣지캐시 적용)
- [ ] 라이브 항목 숨김 확인: 셀러/어드민/에이전시 nav + 어드민 홈(`/admin`) 위젯
- [ ] 매장 계정 vs 크리에이터 계정 로그인 → 셀러 메뉴가 역할대로 갈림(숙소=매장, 링크샵=크리에이터)
- [ ] 유통사 가입(`/wholesale/join`) → 로그인 → `/wholesale` 완결(셀러 대시보드 안 거침)

### ✅ 카카오 통합 로그인 — 구현 완료 (2026-06-04)
- 유통회원(Phase A): `/wholesale/login`·`/wholesale/join` 카카오 버튼 → 로그인 후 `POST /api/wholesale/become-distributor`(유저세션) 로 유통회원 1탭 시작/전환. 이메일 연결 유통사는 자동 로그인.
- 제조회원(Phase B): `/supplier/login` 카카오 버튼 → `POST /api/supplier/become`. 신규=승인대기(어드민 검증 게이트 유지), 승인됨=supplier_token 자동 발급.
- 카카오 콜백 코어 미변경(안전) — 기존 유저세션 + 별도 become 엔드포인트 패턴.

### ✅ 가입 승인 + 사업자정보/등록증 — 구현 완료 (2026-06-04)
- 유통회원·제조회원 모두: 사업자번호 필수 + **사업자등록증 이미지 필수(강제)** + status='pending' → 관리자 승인 후 이용.
- 업로드: 공개 엔드포인트 `POST /api/upload/business-cert`(rate-limit+검증), `<BusinessCertUpload>` 컴포넌트.
- 관리자 검수: 유통회원=`/admin/seller-approval`(등록증 검증 섹션), 제조회원=`/admin/suppliers`(등록증 썸네일).

### ✅ 홈 기본 = 커피/음료 카테고리 — 구현 완료 (2026-06-04)
- 홈(`/`) embedded VouchersPage 기본 category = '커피/음료' (URL 무지정 시). MAIN SSR 슬롯 + cache-prewarm HOT_PATH 도 동일 커피 카테고리로 warm → 0-RTT 유지 (`[UNLOCK_LOADING]`, CLAUDE.md audit log).
- 브랜드를 클릭(필터)해도 브랜드 그리드 유지 + 선택 브랜드 강조(ring) + 재클릭 해제.
- 커피 브랜드 정렬: 스타벅스 → 메가 → 투썸 → 할리스 → 컴포즈 → 빽다방 → 나머지(원본순).

### ✅ 동네딜·링크샵 로딩 전수조사 — 추가 fix 완료 (2026-06-04)
서브에이전트(Opus) 전수조사 → 코드 대조 검증 후 실효 fix만 적용:
- **A1** 동네딜 '유저 공구'(community) `GET /list`: `await ensureTables`(DDL 6종) → `waitUntil` 비차단. (seller 탭과 동일 패턴, 누락분)
- **A2** 만료 sweep `UPDATE`(풀테이블 write)를 응답 경로에서 분리: `waitUntil` + isolate당 60초 throttle. + `community_group_buys` 인덱스 2종(`status,current_count` / `status,expires_at`) 추가(기존 인덱스 0).
- **A3** community `/list` HOT_PATH 추가(`?status=proposed&sort=popular&limit=20`) — 30s 엣지캐시 organic 만료 → cold D1 방지.
- **B1** 링크샵 `/api/curator/:handle`: `await ensureCuratorTables`(DDL 6종) → `waitUntil`.
- **B2** seller + pins 쿼리 순차 2RTT → `Promise.all` 1RTT.
- **B4** `users.banner_url` 컬럼 존재 모듈캐시(`_bannerUrlCol`) — 컬럼 없는 환경 매요청 2쿼리 방지.
- 검증으로 기각: **A6**(gift_catalog.gift_code 인덱스)는 `helpers.ts:107` 에 이미 존재(에이전트 오탐). A5/A7/A8·B3/B5/B7 은 LOW + 잠금민감 파일이라 보류.

### 🟡 결정/운영 필요 (코드로 불가 — 사용자·Cloudflare)
- [ ] **R2 스토리지 확인** — 등록증 업로드는 `MEDIA_BUCKET`(R2)+`PUBLIC_R2_URL` 바인딩 필요. 미설정 시 업로드 503 → 가입 불가(필수 강제됨). 다른 이미지 업로드와 동일 의존이라 이미 설정됐을 가능성 높음 — 확인 권장.
- [ ] `utongstart.com` 도메인 → Cloudflare Pages 커스텀 도메인 연결 (코드는 준비됨)
- [ ] barobill API 키 (전자세금계산서) — Cloudflare Variables (`BAROBILL_*`)
- [ ] Scrape Shield → **Email Address Obfuscation OFF** (CSP email-decode 콘솔 노이즈 제거)

### 🔵 코드로 가능 — 요청 시 진행
- [x] ~~카카오 통합 로그인~~ — 완료(위 ✅ 참조).
- [ ] 라이브커머스 재개 시 `src/shared/feature-flags.ts` `LIVE_COMMERCE_SUSPENDED=false` 한 줄 (모든 라이브 UI 코드 보존됨)
- [ ] 셀러/어드민 추가 간소화 (요청 시)


## 🟢 2026-06-04 — 도매몰 쇼핑몰 UI 시안 구현 (Claude Design 핸드오프)
시안: `docs/design/wholesale-shop-design/` (원본 HTML/jsx/대화 보존 + IMPLEMENTATION.md). TDS(Toss) 라이트 — 무채색+#FF0033 1포인트, 라이트 고정 B2B.
- **토큰 SSOT** `src/pages/wholesale/wholesale-theme.ts` (WT 토큰 + won/discountRate/marginRate + 카테고리).
- **홈/카탈로그 전면 재작성** `WholesaleCatalogPage`: 브랜드 히어로 + 사입 대시보드 + 등급 시트(4단계) + 전용공급/베스트/신규 레일 + 정제 카드(할인%/마진) + 정렬/사이드바 + 단가표 엑셀.
- **상품상세 전면 재작성** `WholesaleProductPage`: 공급가 앵커+할인%+권장가 + 마진 밴드 + 정보 리스트 + 탭 + 하단 고정 CTA(주문 API 유지).
- **API 보강**(비잠금): `/home`·`/catalog`·`/catalog/:id` 에 `retail_price`(권장가)+`sold_count` 추가 → 마진 산출. 원가/제조사 신원 계속 비노출.
- 테마 체커에 `wholesale` 제외 등록(라이트 고정). tsc 0 / build OK / verify:sql 8/8.
- **2차 증분(우리 구조 적합)**: 다품목 장바구니(`useWholesaleCart`+`WholesaleCartPage`, 주문 API items[] 활용, 서버 등급가 재계산=SSOT) · 빠른 재주문(`/recent-items`) · 마감임박 badge · 주문내역/거래내역서 TDS 정비. 도입 silent catch 1건 즉시 toast 전환(부채 예방).
- **3차 — MOQ(박스 단위)**: `products.min_order_qty`(기본1) + 공급자폼 + API 4종 + 카드/상세/카트 박스·개당 + 서버 `qty<moq` 차단.
- **4차 — 유통사 자료 뷰**: `/api/wholesale/documents`(본인 sales) + `/documents/:id/html`(IDOR 가드) + `WholesaleDocsPage`(거래명세서/세금계산서 탭·인쇄). 기존 tax_documents 재사용.
- **5차 — 수량 구간별 단가(volume tier)**: 등급가 × 수량구간 %할인(곱·additive). `qtyTierDiscount`/`tierUnitPrice` + `product_qty_tiers` + 관리자 `PUT /products/:id/qty-tiers` + 상세 단가표 + 주문 authoritative 재계산(SSOT).
- **6차 — 전 페이지 디자인 통일 + 마감**: Checkout/Success dark: 제거(WT 라이트, Toss 위젯 로직 보존) · Intro/Join/Oem Tailwind gray→정확한 WT hex(레이아웃 불변, gray- 0건) · 카탈로그 "수량할인" 배지(has_tiers) · 전자세금계산서 플랫폼 사업자정보 admin UI(`/company-info`, 바로빌 블록 절반 해소 — API키만 Cloudflare). **도매몰 전 11페이지 라이트 고정 일관 완료**.
- **인프라 블록 정직 상태**: 바로빌=사업자정보 UI완료/API키만 Cloudflare(TODO 문서화) · 새 스키마=lazy ensure self-heal(마이그레이션 불요) · youtube god-file 분해=**staging 실송출 검증 필수(CLAUDE.md 하드룰)라 미실행**.
- **7차 — 전수조사(서브에이전트 2종) + 심층 fix 6건**: 도매몰 자금경로(주문생성→confirm→정산→성숙→지급→환불×2) end-to-end. **실버그 6건 영구 차단**:
  ① 역마진 — 수량할인이 공급원가 이하로 내려가 플랫폼 손해 → `tierUnitPrice(floor=공급원가)`(표시=결제), `margin_total≥0` 불변식.
  ② 관리자 전액환불 재고 이중복원(제조사 부분환불 후) → 미환불 라인만 복원.
  ③ 제조사 부분환불 Toss실패 롤백이 PENDING→SHIPPED 둔갑 → 라인별 원상태 복구.
  ④ 정산 잔고 캐시 드리프트(SUM-then-claim 레이스) → settlements 권위 SUM 자가치유(영구).
  ⑤ confirm 만료-청구 race(Toss청구 후 EXPIRED면 고객 미회수) → 자동환불+ORDER_EXPIRED.
  ⑥ CSV 대량등록 MOQ 미지원 → 단건과 feature-parity.
  + 보강: `/company-info` 형식검증·0% tier 거부·refund/issue-nts rate limit·silent catch→swallow.
  **정합 확인(버그 아님)**: creditSupplier 배선/멱등/CAS · confirm 금액 서버재검증 · 정산 source 분리 · oversell NULL 대칭 · renderTaxDocHtml XSS escaping · bulk 승인게이트.
  라이브: 송출 로직 미변경, 안전 UX만(StepSetup 무한대기 30s 탈출 · Quick Start 최근상품). unit 13/13 · verify:sql 13/13 · tsc 0 · build OK.
- **8차 — 인접 도메인 자금경로 심층 + fix**: ① 숙소 오버부킹 **reserve-before-charge** 근본수정([UNLOCK] payment.routes, 사용자승인 — 달력차감을 Toss승인 전으로 + booking CAS + Toss실패시 release. ⚠️staging E2E 권장). ② 인플 수동지급 **이중지급 CAS**(marketing /payouts/process — 적립 전 잔고 claim). ③ referral 출금승인 CAS.
- **9차 — 출금/지급 동시성 전수 (플랫폼 전역)**: ④ curator 출금 **조건부 INSERT 원자화**(가용액 재평가 — 동시 신청 초과지급 차단, verify:sql 14/14). ⑤ referral 출금신청 **commission claim-first**(phantom 출금=초과지급 차단). **정합확인(이미 안전)**: 공급자 payout(CAS+권위SUM)·인플 payout cron(attributions SUM 자가치유)·seller settlement(C1 잔액상한+H3 원자 period dedup, 2026-05-31). → 6개 지급경로(supplier/influencer/curator/referral/seller/wholesale) 동시성 모두 잠금.
- **시안 전 요소 구현 완료**. unit 12/12 · verify:sql 11/11 · tsc 0 · build OK. 남은 polish: OEM 토큰 미세정렬·카드 수량할인 배지(선택).

## 🟢 2026-06-04 — 도매몰 게이팅·마진·합배송 + audit (이번 세션)
- **utongstart.com 도매몰 전용 게이팅** (`6000a2e`): worker 진입 302(주방어) + App.tsx SPA 가드. 도매 surface(`/wholesale`·`/supplier`·`/seller/login|register`·`/auth/`·`/login`·정적) 밖 경로 → `/wholesale/intro`. allowlist worker↔`utils/domain.ts` 동기화. 다른 호스트 no-op.
- **npm audit high/critical 0건** (`882dc54`): axios 1.15.2→1.17.0(프론트 high), protobufjs override ^7.5.8(firebase 경유 transitive high, firebase 다운그레이드 회피), vitest critical은 dev전용+UI서버 RCE(미사용)라 `.audit-allowlist.json` 등재. `check-npm-audit.sh` GHSA advisory 단위 + allowlist 게이트로 개선(blanket bypass 제거).
- **상품별 등급마진 override(특가)** (`1ec0873`): `resolveDistributorPrice({marginOverridePct})` — 설정 시 등급 무관 동일가, NULL=등급마진. `products.supply_margin_override_pct`(lazy ensure) + 서버 재계산 7곳 일괄(표시가=결제가) + `PATCH /api/admin/distributor/products/:id/margin-override` + AdminDistributorGradesPage UI. 단위10/10·verify:sql.
- **도매 합배송(주문내 제조사별 일괄발송)** (`6d3fe10`): `POST /api/supplier/wholesale/orders/:id/ship-all` — 내 미발송 라인 전체 송장1개 원자발송, 제조사별 격리, 전라인 발송시 주문 SHIPPED. SupplierWholesaleOrdersPage 주문단위 그룹 + 합배송 패널. verify:sql 8/8.
- **silent catch 5곳 → swallow()** (`e49c821`): best-effort 배경경로 관측성. 동작 불변.
- **코드 audit (서브에이전트)**: 지목 항목 대부분 false positive 확인 — 셀러양도 인증(TD-016 이미 차단), NaN 6곳(전부 가드), rate-limit 3곳(이미 적용), bulk 음수가격(이미 검증), 8.8%원천징수(이미 배선). 스퓨리어스 수정 회피. **남은 진짜 backlog는 인프라/결정 블록**: 스키마 이중화 DROP(TD-001 migration CI 선행), youtube-live god-file 분해(staging 필수), 세금계산서 국세청발행(바로빌 키=사용자).

---

## 🟢 2026-06-01 — 유통스타트 도매몰 (Phase 1~5 + 정산) 신규 구축
별도 도매몰(utongstart.com, 같은 코드/DB) — 3자(유통사=셀러 / 유통스타트=플랫폼 / 제조사=공급자) 등급제 B2B 선결제 모델. 스펙·결정: `docs/design/wholesale-utongstart.md`, 사용자 할일: `docs/design/wholesale-utongstart-TODO.md`.
- **P1** 등급 가격엔진 `lib/distributor-pricing.ts`(제조사가×(1+등급마진), 특별할인 기간 우선) + `distributor_grades` 테이블 + 유닛 8.
- **P1b** 어드민 `/admin/distributor-grades` — 등급 마진율 편집 + 유통사 등급배정 + 특별할인.
- **P2** 유통사 카탈로그+B2B 선결제 `/api/wholesale/*`(등급가·제조사 신원 비노출, Toss SSOT helper·서버금액검증·CAS·재고·멱등) + 페이지 5종(`/wholesale*`).
- **P3** 제조사 `/api/supplier/wholesale/*` 송장입력 + 반품(cancelTossPayment+재고복원) + `SupplierWholesaleOrdersPage`.
- **P4** 거래내역서(`/wholesale/statement`) + 상품제안(`wholesale_proposals`, 어드민→유통사) + 세금계산서 월집계(1차 수동).
- **P5** `utils/domain.ts isUtongstart()` — utongstart.com 루트 → `/wholesale` 분기.
- **정산** `wholesale-settlement.ts` — 결제완료 시 제조사 공급가(base×qty)를 `supplier_settlements(source='wholesale')` 적립→기존 mature→payout 파이프라인 자동지급, 환불 시 역전. consumer 정산과 `source` 컬럼으로 order_id 충돌 분리.
- **남은 운영작업(코드 아님)**: Cloudflare 커스텀도메인 등록 + 카카오 콜백 + repair-schema 1회 + 등급/제조사/유통사 데이터 입력 (TODO 파일).
- **견고화(검증 후)**: 부분환불(제조사 본인 라인만, Toss cancelAmount)·oversell 원자가드+자동환불·rate limit(`/orders`,`/orders/confirm`)·체크아웃 `?order=` 복구. 정산 7일창 유지(기존 공급자 파이프라인 일관).
- **검증**: `wrangler dev --local` + 실 seller JWT 로 라우트 마운트/등급가/주문생성/검증 런타임 확인. **돈 경로(Toss confirm→정산→환불)는 스테이징(Toss키+시드) E2E 필요** — 코드/읽기경로만 런타임 확인됨.
- 전 구간 잠금 SSOT(toss-gateway) 미수정·호출만. tsc 0 / build OK / unit 15 pass.

---

## 🟢 2026-05-31 — 전 도메인 보안 audit (payment/auth/IDOR) + 적용
3개 병렬 심층 audit(서브에이전트) → **전부 코드로 직접 재검증** 후 적용. IDOR/권한 계층은 홀 0건(견고).
**비잠금 적용**:
- C2 공구 카드 confirm-toss 멱등 race(voucher 2배) → idempotency_key(=paymentKey, 0118 unique) 원자화 (`1c14622`)
- C1 셀러 정산 임의금액 → 서버잔액(redeemable_deal_amount) 상한 (`729b9d5`)
- M1 카드 공구 재고 oversell → 원자 예약+자동환불+롤백 (`729b9d5`)
- 카카오/토큰 raw-error 누출→generic, OAuth /start·/sync rate-limit (`1c14622`)
- 카카오 프록시 rate-limit + 셀러 스트림 status enum (`05548b4`)
- H3 정산 동일기간 중복신청 → 원자 INSERT...WHERE NOT EXISTS
- H2 인플 payout 알림 당월 dedup (cron 재실행 중복알림→이중송금 오인 차단)
**잠금 해제(사용자 승인, CLAUDE.md audit log 기록)**:
- [UNLOCK] payment.routes `/confirm` 동시요청 CAS 가드 — 재고 2배차감·커미션 중복 차단
- [UNLOCK_LOADING] 카카오 same-email 셀러 자동연결 verified-only 게이트 — takeover 차단
**운영 설정(코드 아님)**: `TOSS_WEBHOOK_IP_ALLOWLIST` 미설정 시 위조 webhook 여지 → Cloudflare Variables 설정 권장.
tsc 0 / build:worker OK / 전체 1802 테스트 통과.

## 🔴→🟢 2026-05-31 — 자금루프 audit 3탄: affiliate/curator 출금 누수 (실현금)
**발견**: `affiliate_earnings`(물리상품 referral + 숙소 referral 적립, curator 출금 SSOT)는 default `status='pending'` 이고 **granted 전환이 없음**. 그런데 ① curator 출금 잔액(`curator.routes.ts:758` `SUM(commission)`)이 status 필터 없음 → **환불 커미션도 출금 가능(user_withdrawals=실제 은행송금)**, ② returns 환불 reverse 가 `WHERE status='granted'` 타겟 → 0건 매칭(무효), ③ 숙소 취소는 affiliate reverse 자체가 없음.
**fix**:
- curator 출금 잔액 + 잔액표시 + 30일 대시보드 SUM 에 `COALESCE(status,'pending') != 'refunded'` 추가 (`curator.routes.ts` 758/811/588).
- returns 환불 reverse: `status='granted'` → `COALESCE(status,'pending') IN ('granted','pending')` (실제 pending 행 처리).
- 숙소 취소(사용자/오버부킹/어드민 3경로) 환불 성공 시 `affiliate_earnings SET status='refunded' WHERE order_id`.
- tsc 0 / build:worker OK / sql 검증 통과.

## 🔴→🟢 2026-05-31 — 자금루프 audit: 인플 커미션 clawback 누수 fix (체계적 버그)
**발견(audit)**: `influencer_attributions` 는 insert 시 `voucher_id` 를 안 넣어 항상 NULL인데, clawback 3곳(셀프취소/셀러환불/만료)이 모두 `WHERE voucher_id=?` 로 조회 → **0건 매칭 → 인플 커미션이 환불/취소/만료 시 전혀 회수 안 됨(누수)**. `influencer-payout` cron 은 attribution `SUM(commission_amount)` 로 balance 재집계 후 송금하므로 → 회수 안 된 커미션이 그대로 지급됨.
**fix**:
- `helpers.clawbackVoucherCommission`: voucher→`order_id` 연결로 attribution 조회 + **바우처 비례 clawback**(분모=주문 내 미회수 바우처 수, 환불 flow 가 voucher.status='refunded'/'expired' 를 clawback 직전 설정해 정합). 권위 출처인 `commission_amount` 차감(전액→clawed_back, 부분→감액). qty=1 이면 전액.
- `helpers.applyGroupBuyReferral` + `/join` 인라인 insert: attribution `order_id` 실제 주문 id 저장(이전 `0` 하드코딩).
- `confirm-toss`: `applyGroupBuyReferral` 에 `orderId: newOrderId` 전달.
- `auto-settlement.ts` 만료 clawback: 깨진 인라인 `WHERE voucher_id=?` 블록 → 공유 헬퍼 호출로 통합.
- tsc 0 / build:worker OK / sql·bind 검증 통과. (레거시 `order_id=0` attribution 은 소급 연결 불가 — 신규부터 정상 회수.)

**audit 전체 결론 (4개 자금 흐름 환불 reversal 정합)**:
1. ✅ 인플 커미션 — 구매 적립·환불창 후 지급 → 환불 reversal 필수 → **누수였음, fix 완료**(위).
2. ✅ 에이전시 입점 2% sales_commission — 구매 시 order 단위 적립, 환불 reversal 없었음 → **clawbackVoucherCommission 에 비례 cancel 추가**(status='cancelled'+감액; payout 은 status별 SUM 이라 정합).
3. ✅ 셀러 정산 — `auto-settlement` 이 `WHERE v.status='used'`(+used_at 7일+ +settlement_id NULL)로만 집계 → 환불 바우처(status='refunded')는 **애초에 정산 안 됨, 구조적 안전**(누수 아님). `donations` 는 매출추적용, payout 아님.
4. 🟡 사용자 추천 보너스 — 구매 시 user_points 적립, 환불 reversal 없음. **소액·프로모션 + 이미 사용된 포인트 차감 음수 위험**이라 보류(known minor).

## 🟢 2026-05-31 — 테마 backlog 정리 (2차) + 공구 결제 런타임 버그 fix
- **공구 join 응답 ReferenceError fix** (`group-buy.routes.ts:854`): A2 단일가 전환 때 제거된 `currentTier` 를 응답이 계속 참조 → 런타임 `ReferenceError`. `next_tier: null` 로 교정 (A2 모델 정합). confirm-toss `body.ref` 타입 union 누락도 fix → **tsc 0** (이전 세션 node_modules 부재로 미검출된 잠복 타입에러 2건 해소).
- **테마 backlog 정리**: checker 정밀화(streaming/guide/dashboard 폴더 + ProductOptionForm/BulkUploadModal/LiveDonation 제외 — usage 추적으로 라이트 고정 확인) → 오탐 202→실제 58건. 유저 대면 26파일 dark: variant 정합(state-variant aware) + 이전 perl 잠복 orphan(`dark:hover:bg-[X] dark:bg-[X]`, `placeholder:text dark:text`, `hover:text dark:text`) 전수 제거. 남은 1건은 토글 thumb(의도된 흰색).
- npm 의존성 설치 후 tsc/build:worker 실검증 통과.

## 🟢 2026-05-31 — 다크/라이트 테마 전반 정합 + 미래 자동 강제
사용자 요구: "다크/라이트테마 가장 이상적으로 작업 전반 + 앞으로 생성/수정 페이지에도 정확히 적용".
- 유저 대면 화이트-토글 페이지 13종 dark: variant 정합 (GroupBuyDetail/ProductDetail/MyVouchers/MyReturns/MyAppointments/MyFollows/Affiliate/FAQ/Search/About/GroupBuyList/Address/CuratorEarnings/MapSearchHeader)
- perl 일괄치환이 만든 깨진 클래스 전수 교정: `dark:dark:`, 중복 `dark:bg-`/`dark:text-`, state 오매핑(`hover:bg-gray-100`→잘못된 `dark:bg-` 대신 `dark:hover:bg-`) → 0건 확인
- **미래 자동 강제**: `scripts/check-theme-consistency.mjs` (variant-aware, 대시보드·순수다크·콜백 제외) 를 pre-commit(staged) + `verify.yml` CI 에 등록 (warn-only, `STRICT_THEME=1` 차단, `[SKIP_THEME_CHECK]` 우회). CLAUDE.md 테마 섹션 + 영구 방어선 표 갱신.
- 기존 backlog ~200건(공유 컴포넌트 streaming/dashboard 다수) 은 warn 유지 — 점진 정리 후 strict 승격 예정.

## 🟢 2026-05-31 — 오프라인 공구 운영 플로우 audit + 자금 커버리지 갭 3종
역할별(매장/인플/에이전시) 운영 플로우 전수 audit. 서브에이전트 2종 결과를 **직접 검증해 오판 정정**:
- ❌→✅ "에이전시 정산 자동화 없음" 오판 — `agency-auto-settle.ts`(자동 집계+`agency_settlements` INSERT) + `agency-monthly-invoices` 실재
- ❌→✅ "매장 가입 pending 병목" 오판 — NTS 사업자 진위확인 자동승인 end-to-end 구현(폼이 rep_name+start_date 수집·전송). **`NTS_API_KEY` 환경변수만 설정하면 자동활성** (코드 변경 불필요·운영자 사안)
- ❌→✅ "3자 분배 0%" 오판 — 에이전시(intro 2%/매장별) + 인플(referral/?ref별) **병렬 공존**

**고친 실제 갭 (자금 누수)**:
- #2 카드 결제 인플 referral attribution 누락 → `applyGroupBuyReferral` 헬퍼로 닫음 (`fb5f809`)
- #1a 매장 정산 입금완료 알림톡 추가 (`daf9bee`)
- #3 에이전시 intro 커미션 공구 경로(딜+카드) 누락 → `creditAgencyStoreIntroCommission` 호출 추가 (`60586ae`)

**남은 것**: 인플/에이전시 최종 은행송금 자동화(PG 연동·KR 특성상 수동 일반), 정산서 PDF, Magic Link 영구저장. NTS_API_KEY 프로덕션 설정 확인(운영자).

## 📋 사용자 액션 TODO
- [x] ~~**SSR prerender 실제 동작 검증**~~ ✅ **2026-05-31 원격 환경에서 검증 완료** (npm 의존성 설치 후):
  - `npm run build` 전체 체인 통과: client → ssr → **prerender(`renderToString 완료 48ms, 40578 chars` → `dist/client/index.html 갱신 완료 ✅`)** → worker(2.6mb) → prepare
  - 렌더된 shell 에 raw i18n 키 누출 0 (실제 한글 "라이브/둘러보기/공동구매/식사권" 렌더). `NO_I18NEXT_INSTANCE` 경고는 nav 가 defaultValue/하드코딩이라 무해.
  - 아키텍처 확정: prerender=앱 shell(0-RTT first paint), worker HTMLRewriter 가 runtime 에 `__SSR_INITIAL_MAIN__` 데이터 inject + RQ fresh fetch. `_routes.json` 이 `/` 를 worker 로 라우팅.
  - **Phase 3-2/3-3/3-4 모두 완료** (아래 "진행 중" 섹션은 stale → 정정함). 남은 건 Phase 5 Lighthouse 실측(배포 후).
- [ ] 배포 반영 확인: `claude/service-tech-debt-analysis-d1KOx` → main 머지 + Actions 녹색
- [ ] 배포 후 1회: `POST https://live.ur-team.com/api/_internal/repair-schema` (숙소 migration 보장)
- [ ] 스모크: 공구 카드결제 / 숙소 예약·취소 각 1건 (이번 세션 가격·환불·재고 변경분)
- [ ] **`NTS_API_KEY` 프로덕션 설정 확인** — 매장 가입 자동승인(국세청 진위확인)이 이 키 없으면 전원 pending 으로 묶임 (Cloudflare Dashboard → ur-live → Variables)

## 🟢 2026-05-31 — SSR Phase 2 메인 트리 audit + fix
- 인프라(entry-server renderToString + prerender HTML inject) 이미 구현 + graceful skip 확인
- 메인 `/` 트리 정적 audit: 실제 throw 는 `isLoggedInSync()` 하나 → `typeof localStorage` 가드 추가
- useTheme/i18n/useAuthKR/localCache/App.tsx/GroupBuyFeed/BottomNav 전부 가드 확인(안전)
- **다음(로컬 필수)**: `npm run build:ssr && npm run prerender:main` → prerender 성공/추가 throw 확인. 가이드 `docs/SSR_MIGRATION.md`

## 🟢 2026-05-31 — 백엔드 보안·하드닝 + 후속 4종 + 문서 동기화
- 카카오 구독자 전체발송 무인증 스팸 벡터 차단 (`38298f4`) — rateLimit+requireAuth+소유권
- 셀러/에이전시 카카오 연동 에러 누출 → safeError (`38298f4`)
- #1 숙소 취소/환불 객실 재고 복원 버그 fix + status 정합 (`40a5668`)
- #2 미결제 pending 숙소 예약 자동 만료 cron (안전 옵션) (`33622d8`)
- #3 카드(toss) A2 단일가 정합 + confirm-toss 정산기록 보강 (`1632642`)
- #4 어드민 에러 누출 37곳 safeError 통일 (`a8e3819`)
- `TECHNICAL_DEBT.md` 2026-05-31 동기화 + 후속 완료 기록
- **남은 것**: stay hold 모델([UNLOCK]), confirm-toss 인플 attribution, 데이터페칭 통합/God파일/SSR(대규모)

## 🟢 2026-05-30 — 공동구매 = 즉시판매 단일가 모델 (A2 구현 완료, 가격 코어)
- 결정 확정: 경제=즉시판매, 이름=공동구매 유지, 가격=**A2 최대 tier 즉시 단일 적용** (사용자 승인)
- 설계안: `docs/design/groupbuy-instant-sale.md`
- 구현 (`[UNLOCK_LOADING]` 사용자 허가, CLAUDE.md audit log 기록):
  - `helpers.ts` `maxTierDiscount()` 추가 / `group-buy.routes.ts:223` join 가격 = maxTier
  - `group-buy-public.routes.ts` 상세 current_discount_pct 고정 + next_tier=null, 리스트 current_price enrich (캐시 헤더 불변)
  - `GroupBuyDetailPage.tsx` 단계별 tier 사다리 + "N명 더 모이면 할인 시작!" 제거 → 정직한 단일가 안내
- tsc 0 / schema·status·sql 검증 통과
- **후속 4종 완료(2026-05-30)**:
  - ① 셀러 폼 tier 입력 제거 → 단일 공구가 안내 + i18n 6개 언어 (`SellerMealVoucherNewPage`)
  - ② 기존 진행중 공구: 런타임 maxTierDiscount 흡수 → 백필 불필요 검증
  - ③ 사용자 셀프 취소/청약철회: `POST /api/group-buy/voucher/:code/cancel` (본인+미사용+7일) + MyVouchersPage UI
  - ④ breakage: `auto-settlement.ts:173` 이미 만료 시 고객환불 — 문서화만
- **잔여 후속 3종 완료(2026-05-30)**:
  - 셀러 가이드 `groupbuy-single-price` 섹션 신설 (guide-seed-seller.ts)
  - 인플 clawback 통합: `helpers.clawbackVoucherCommission()` → 셀프취소 + 셀러 /refund 연결 (누수 차단)
  - 환불 알림톡 통합: `helpers.sendRefundAlimtalk()` → 셀프취소 + 부분환불 연결

**최종 업데이트**: 2026-05-28 (서비스 모델/정산 통합 + SSR 마이그레이션)
**브랜치**: `claude/check-live-commerce-flow-jgNs8` (서비스모델/정산) · `claude/vibrant-feynman-m3X3m` (SSR)

## ✅ SSR 마이그레이션 — Phase 1-4 완료·검증 (2026-05-31, LCP 10.7s → 0.5-1.5s 목표)

**가이드**: `docs/SSR_MIGRATION.md`. **2026-05-31 원격 환경 빌드 검증으로 Phase 3-4 완료 확정.**

**완료 (검증됨)**:
- Phase 1 인프라 (`74a0625`): entry-server/client, vite build:ssr, prerender-main
- Phase 2 (`c113f1b`): BottomNav SSR-safe + `isLoggedInSync` `typeof localStorage` 가드
- Phase 3-1 (`e3a3a7e`): App.tsx Router prop (default BrowserRouter, SSR 시 StaticRouter)
- **Phase 3-2 entry-server.tsx 실구현 완료** — `renderToString(<App Router={StaticRouter} routerProps={{location:url}}/>)`
- **Phase 3-3 prerender-main.mjs 실구현 완료** — API fetch 제거(빌드 의존성 0, initialData=null), shell 만 정적 렌더. 데이터는 worker HTMLRewriter 가 runtime `__SSR_INITIAL_MAIN__` inject + RQ fresh fetch.
- **Phase 3-4 build script 체인 완료** — `build = client && ssr && (prerender||graceful skip) && worker && prepare`
- **Phase 4 `_routes.json` 완료** — `/*` worker 라우팅(static asset 제외), worker `index.ts:444 isMainPage` 가 `caches.default` edge read + HTMLRewriter 데이터 inject
- ✅ **검증**: `npm run build` 전체 통과, prerender `48ms / 40578 chars`, raw i18n 키 누출 0

**남은 것**:
- **Phase 5 Lighthouse 실측** (배포 후 — 사용자/운영). 목표 아래.
- (선택) SSR initialData 를 빌드 시점 fetch 로 확장하면 first paint 에 카드까지 — 현재는 shell+runtime inject 로도 0-RTT shell 확보. 비용/복잡도 대비 효과 작아 보류.

**위험 영역(유지)**: entry-server import 모듈 SSR-safe 필수(한 곳 throw→빌드 실패. 현재 전부 통과). 결제(Toss V2 잠금)/카카오 OAuth/라이브는 lazy 라 SSR 시 Suspense fallback(평가 안 됨).

**현재 Lighthouse 측정값** (SSR 배포 전):
- Performance 44-66 (측정 변동 큼)
- LCP 8-11s (메인 페이지)
- TBT 300-1000ms
- CLS 0-0.188

**SSR 적용 후 목표**:
- Performance 85-92
- LCP 0.5-1.5s
- TBT/CLS 유지

---


## ✅ 2026-05-27 — 로딩 최적화 2차 (critical path -31%, 14 commits)

### 사용자 보고 → 처리
1. "전반적 로딩 길다, 공구 느림" → 폴링 / countdown / SSR 카테고리 prewarm
2. "/user/profile 1개 → /my-vouchers 0개" → voucher cache invalidation 영구 fix
3. "트래픽 절감 + 속도 가장 이상적으로" → chunk Phase 1-5 + image proxy 확장
4. "비용 0 원칙" → 모든 변경 무료 (D1/cf-image/KV write 한도 안)

### Critical path 변화
| 단계 | path | gzip |
|---|---|---|
| 초기 | ~1100 KB | ~330 KB |
| 최종 (`74bb925`) | **759 KB** | **228 KB** |
| **절감** | **-341 KB (-31%)** | **-102 KB (-31%)** |

### 14 commits
| # | hash | 효과 |
|---|---|---|
| 1 | `c4925af` | 공구 detail 폴링 + countdown adaptive |
| 2 | `daeb2c8` | voucher cache invalidation (사용자 보고 #2) |
| 3 | `cb8d0a5` | 카테고리 prewarm + Cache-Control 분리 + cf-image cache |
| 4 | `9de2840` | useMyCounts 통합 + Card.memo + SSR/cache 확장 |
| 5 | `21ab0fb` | 공구 detail below-fold lazy + unused import |
| 6 | `b8bd41d` | cf-image host 확장 + lazy rootMargin + VoucherMap lazy |
| 7 | `5583eed` | img-utils critical path -51KB + admin limits + audio singleton |
| 8 | `cbb08c8` | env-validator dynamic + admin/agency limits + 4 모달 lazy |
| 9 | `5e556a4` | env-validator chunk 분리 → validation -52KB lazy |
| 10 | `dfb11df` | Phase 1+2 chunk 분할 |
| 11 | `374ea9c`→`336a988` | Phase 3 FrameWrapper 사고 + rollback |
| 12 | `c1a42d7` | Phase 4 live hooks |
| 13 | `74bb925` | Phase 5 useCart/useSearch/useTokenAutoRefresh hoisted |

### 다음 우선순위
1. 사용자 액션 — Lighthouse 실측 (cloud 환경 403 차단)
2. 자동 main 머지 + 배포 확인 (Actions 탭)
3. 사용자 증가 대비:
   - C: SellerOrdersPage React Query (작업 중)
   - A: AdminOrdersPage 서버 페이지네이션 (큰 작업)
   - B: AdminPage SSE 마이그레이션 (인프라)
   - D: AgencyPage bundle endpoint

## 🎯 전략 (2026-05-28): 공동구매가 주력, 라이브커머스는 보조
- 우선순위·신규 투자는 **공동구매 플로우** 1순위. 역할/커미션/정산 SSOT = `docs/SERVICE_MODEL.md`.
- 정산 통합(§9): `creditUserCommission()` SSOT 추가됨 (현금/딜 1결정점). 추천 rail 통합은 payment.routes.ts 잠금 해제 후.

---

## ✅ 2026-05-27 세션 — 로딩/큐레이터/리뷰/운영 영구 fix (~50 commits)

### 1. 로딩 최적화 ($0 한도 도달) — CLAUDE.md "🔒 로딩 최적화 잠금" 추가
- KV write 일 3,744 → **0** (월 $2-5 → $0)
- `publicCache useKv: false` + CDN-Cache-Control 분리
- SSR inject **5페이지** (메인 / 공구상세 / 셀러 / vouchers / browse / curator)
- cron prewarm 5분 + 인기 셀러/상품/큐레이터 top 10 dynamic warm
- D1 partial composite index (10만 상품 O(log N))
- 이미지 변환 27+ 호스트 (firebase / pstatic / daumcdn / giftishow / kt) + Save-Data
- prefetch 4단계 (hover/touch/focus + viewport + speculation prerender)
- MainHomePage eager + idle prefetch 5탭
- preload mode mismatch 영구 제거
- `X-SSR-Status` + `Server-Timing` 헤더 (production 측정)
- `RestaurantMiniMap` IntersectionObserver lazy
- 공구 카드 shimmer skeleton

### 2. 큐레이터 모델 — 핵심 흐름 완성
- 일반 user 도 공개 페이지 (`/u/{handle}` — handle 자동 생성)
- KakaoAuthService same-email seller auto-link + repair-schema backfill
- BottomNav 4중 안전망 (seller_username / linked_seller / handle / seller_token JWT decode) + App.tsx idle warming
- 큐레이터 페이지 셀러 수준 (banner 업로드 / 인라인 편집 / grid-3 통계 / grid-2 CTA / 탭 4개 (홈/상품/식사권/정보) / sticky owner 배너 / 라이트-다크)
- PATCH `/api/curator/me/profile` (name / bio / profile_image / banner_url)
- 추천 링크 복사 → 자동 핀 추가 (idempotent)
- 핀 삭제 본인 view (group-hover ✕)
- 우하단 📌 담기 FAB (선물 버튼 아래, 1판매당 적립액 표시)

### 3. 자동 로그아웃 영구 fix
- `RouteGuards.isAdminLoggedIn / isUserLoggedIn` 토큰 존재만 검사
- KakaoCallback `user_type` 보존 (admin/agency 토큰 있을 때)
- `isLoggedInSync` 토큰만 검사 → `/my-vouchers` 빈 화면 영구 fix

### 4. 리뷰 시스템 영구 fix
- D1 트리거 v2: INSERT 즉시 `review_count` + `avg_rating` + **`sold_count = MAX(현재, review × 3)`**
- `autoSeedFakeReviews` soldMultiplier 3-5 random
- repair-schema backfill: `sold_count < review × 3` 자동 정정
- cron `maxBatch 200 → 1000` (시드 처리량 5배)
- BrowsePage / VouchersPage 카드 review=0 시 "신규" 표시

### 5. KT Alpha 마진 재계산
- `POST /api/admin/kt-alpha/recalc-prices` (사용자 결정)
- AdminKtAlphaPage "📊 일괄 재계산" 버튼

### 6. UI / UX
- PWA 팝업 분홍 네모 제거 + "🎁 앱 설치하면 환영 쿠폰!" (6언어)
- 교환권 default sort = `price_low`
- 카드 image fade-in + 카테고리 dominant color
- 셀러 placeholder name fallback (username)
- 공구 상세 SNS 버튼 4개 (인스타/유튜브/틱톡/페북) — 채팅/매너온도 X
- 큐레이터 라이트 테마 토글 지원
- 장바구니 썸네일 fix

### 7. 운영 통합
- `/api/admin/ops-status` — schema-repair / 활성 상품 / 24h 주문 / errors / KT Alpha 24h
- `/api/admin/csp-violations` — CSP 위반 패턴 분석
- `docs/OPS_RUNBOOK.md` — D1 Migration CI / Secret 회전 (다음 2026-10-27) / KV 모니터링 / 카카오 OAuth 체크리스트

### 8. 사고 영구 fix
- 공구 detail 500 (sns_tiktok 누락) → 3단계 graceful fallback SQL
- 링크샵 → /host/new fall through → email fallback + handle 자동 생성 + idle warming
- 핀 redirect 404 → URL suffix 제거
- 셀러 ↔ 큐레이터 self-affiliate 차단 검증 (이미 적용)

### 새 세션 진입 시 액션
1. `CLAUDE.md` 의 "🔒 로딩 최적화 잠금" 27개 항목 절대 변경 X
2. `docs/OPS_RUNBOOK.md` 사용자 액션 안내 (CI / Secret)
3. production 즉시 적용 안내:
   - `POST /api/_internal/repair-schema` — D1 트리거 + backfill
   - `POST /api/admin/reviews/auto-seed-missing {max_batch:1000}` — 별점 즉시 시드
   - `curl -sI https://live.ur-team.com/ | grep x-ssr-status` — SSR 검증

---

## ✅ 2026-05-25 — Phase 3+4 (호스팅 + 정산 + 셀러 승급) 완료

migration 0280 — 누구나 voucher 공구 호스팅 + 큐레이터 출금 UI.

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB + 정책 SSOT (HOSTING/WITHDRAWAL) | `04ce0a3b` |
| 2/5 | Worker API (hosting + 출금) | `236e1673` |
| 3/5 | Frontend 호스팅 페이지 3개 | `(Commit 3)` |
| 4/5 | 출금 UI + 셀러 승급 안내 | `23ffa387` |
| 5/5 | 가이드 + docs | (이 commit) |

**Phase 3**: /host (목록) / /host/new (카탈로그) / /g/:invite_code (친구) — 1탭 호스팅
**Phase 4**: /u/me/earnings 출금 모달 + 원천징수 3.3% + 누적 50만원+ 셀러 승급 안내

## ✅ 2026-05-25 — Phase 2 (배송 재설계) 완료

migration 0279 + tracker.delivery 무료 API + 외부 URL fallback + cron sync + CSV 일괄.

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB + 정책 SSOT + V2 배송비 함수 | `9d913840` |
| 2/5 | tracker.delivery + courier-codes + 5 endpoints | `(commit 2)` |
| 3/5 | order.routes V2 + 셀러 송장 carrier_code | `bb45dae6` |
| 4/5 | 인앱 추적 모달 + MyOrders 통합 | `74d945ba` |
| 5/5 | 어드민 CSV UI + 가이드 + docs | (이 commit) |

**3중 안전망**: tracker.delivery (무료) → 외부 URL fallback → cron 7일 추정
**지역별 배송비**: 제주 +3000, 도서산간 +5000 (`regional_shipping_fees` SSOT)
**12개 택배사**: CJ/한진/롯데/우체국/로젠/CU/GS/대신/일양/경동/천일/CWAY

## ✅ 2026-05-25 — Phase 1 (링크샵 + 큐레이터 + 1탭 핀) 완료

migration 0278 + worker API 13개 + 큐레이터 페이지 2개 + 핀 1탭 UX + 가이드 동기화.

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB schema + 정책 SSOT | `97cd54b2` |
| 2/5 | Worker API + push + OG image | `060e0249` |
| 3/5 | Frontend 1-A 인프라 | `82ddc4a9` |
| 4/5 | Phase 1-B 핀 1탭 UX | `0f4824cd` |
| 5/5 | Phase 1-C+D 공유 + 가이드 | (이 commit) |

### 새 라우트
- `/u/:handle` (public, 다크 테마)
- `/u/me/earnings` (requireUser)
- `/u/:handle/p/:productId` (redirect)
- 13 worker endpoints under `/api/curator/*`

### ✅ 전체 신모델 인프라 완료 (2026-05-25)
- Phase 1 ~ 5 모두 완료
- Phase 6 (합배송) 인프라만 (`ENABLE_BUNDLING=false`)
- 정책 동적화 — 어드민이 9개 정책 코드 변경 없이 조정 가능 (`/admin/platform-settings`)
- 반품 carrier 정규화 + audit 통합

### 후속 PR 가능
- 합배송 UI 활성화 (Phase 6)
- 인스타 스토리 canvas 합성 (마케팅 UX)
- ja/zh/es/fr i18n 번역 (현재 한국어 stub)
- 반품 회수 송장 추적 UI


## 🚀 2026-05-25 — 비즈니스 모델 Pivot 컨셉 단계 진입

**사용자 결정 (2026-05-25 채팅)**: 라이브커머스 → "어드민 SSOT 카탈로그 + 모든 유저 큐레이터(링크샵) + 공구 호스팅 + 어필리에이트" trinity 로 전환.

- **컨셉 docs**: `docs/design/linkshop-pivot.md`
- **배송 재설계 docs**: `docs/design/shipping-redesign.md`

### 진행 순서
```
Phase 0 — MD/sourcing 사업 준비 (코드 외)
Phase 1 — 링크샵 + 큐레이터 핀 (코드 시작점)
Phase 2 — 배송 재설계 (별도 docs, A/B 결정 후 진행)
Phase 3 — 공구 호스팅 (정의 A/B 결정 필요)
Phase 4 — 어필리에이트 정산 (현행 0.5% 양방향 확장)
Phase 5 — 셀러 흡수 (Migration)
Phase 6 — 마케팅/UX 강화
```

### 옛 작업 처리
- Quick Action FAB: 신모델에서 "공구 호스팅 / 큐레이터 시작" 으로 재정의 — 옛 시안 (`quick-action-fab.md`) 은 신모델 흡수 예정
- 카카오 FAB: 그대로 보류 (`featureFlags.kakaoFab=false`)

## ⏳ 사용자 결정 대기 (Phase 1 시작 전 확정 필요)

### ✅ 2026-05-25 결정: A 채택 — voucher 공구 only
- 누구나 voucher 공구 호스팅 가능 (Phase 3)
- 실물 배송은 일반 쇼핑 (1인 주문) only — shipping-redesign §6 deprecated
- **추가 강조 요구사항** (사용자 명시):
  - 유저가 공개 페이지 (링크샵) 에 **상품 핀이 매우 쉬워야** — 모든 상품 카드에 1탭 핀 버튼
  - **수익이 즉시 보여야** — 큐레이터 대시보드 + 핀별 stats + 구매 즉시 push + 공유 simulator
  - linkshop-pivot.md Phase 1-B / 1-C / 1-D 신설

### linkshop-pivot.md 정책 (요약)
| 항목 | 권장 default |
|---|---|
| 공구 호스팅 정의 (Phase 3) | A vs B (위) |
| 어필리에이트 비율 | 현행 0.5% 양방향 유지 (큐레이터 단독 비율 별도?) |
| 공구 호스트 인센티브 | 마감 성공 시 거래액 1% 추가 |
| 큐레이터 → 셀러 승급 threshold | 누적 정산 50만원 (사업자등록 안내) |
| 자기 ref 자기 구매 | 정산 제외 + 적립 회수 |
| 기존 셀러 retention | 라이브권 + 큐레이터 흡수 + 기존 commission 유지 |
| 카탈로그 노출 정책 | 메인=어드민 큐레이션 / 검색=인기순 |
| 상품 등록 권한 | 100% 어드민 |

### shipping-redesign.md 정책 (요약, A 채택 시 §6 자동 삭제)
| 항목 | 권장 default |
|---|---|
| 제주 추가비 | +3,000원 |
| 도서산간 추가비 | +5,000원 |
| 공구 모집 미달 배송비 부담 (B 가설) | 플랫폼 |
| 공구 결제 시점 (B 가설) | 참여 시 즉시 결제 (현행) |
| 공구 일괄 발송 SLA (B 가설) | 마감 후 3영업일 |
| 택배사 추적 API | Phase 2 외부링크만 / Phase 6 스마트택배 |
| 합배송 도입 시점 | Phase 2-E (옵션) vs Phase 6 |

## 옛 보류 항목 (신모델로 흡수)
| 항목 | 처리 |
|---|---|
| Quick Action FAB — 비셀러 클릭 처리 | 신모델에서 모든 유저가 호스팅 가능 → 자연 해소. 옛 (a)(b)(c)(d) 분기 무의미 |
| Quick Action FAB — 노출/숨김 페이지 | Phase 6 에서 재정의 |
| 카카오 FAB 복원 시점 | Phase 6 |

## ✅ 2026-05-24 세션 — 교환권 flow 영구 fix + KT Alpha 진단

### Universal 자동 허위리뷰 시드 (공구/쇼핑/교환권 — commit 0cbd50a7)
- `src/worker/utils/auto-seed-fake-reviews.ts` SSOT util
- `src/worker/cron/auto-seed-reviews.ts` daily 18 UTC (max 200건)
- `POST /api/admin/reviews/auto-seed-missing` 즉시 백필
- 정책 B: `is_active=1` 만. idempotent.

### Q1+Q3+Q4 (commit 8a56bc90)
- Q3 P0: /my-vouchers 빈 화면 — repair-schema 5컬럼 등록 + 3단 fallback SELECT
- Q1: `/admin/voucher-transactions` + AdminPage 카드 + `GET /api/admin/vouchers/transactions`
- Q4 perf 50-150ms: Promise.all rates + RETURNING id + 통합 batch + 병렬 code gen

### KT Alpha 진단 (commit fdd79d8d, 3588f7b2)
- `GET /api/admin/kt-alpha/diagnose-order/:id`
- 진단 UI on `/admin/voucher-transactions` (모달 + 상단 input + 각 행 버튼)

### 카카오 phone 자동 저장 + 결제 phone 게이트 (commit 71d31067)
- KakaoUser.phoneNumber 매핑, normalizeKakaoPhone helper
- upsertUser INSERT/UPDATE 에 phone (UPDATE 는 COALESCE 보존)
- /join 딜 흐름: kt_alpha 상품 + phone 없으면 PHONE_REQUIRED → 클라 모달 + 동의 + auto-retry

### /admin/users (commit 3cf61d32)
- 페이지네이션 버그 fix + 정렬 (created_at/order_count/total_spent/review_count/name)
- 검색: 이름/이메일/전화번호 (하이픈 무관)
- 통계 컬럼 표시 + phone 미등록 빨간 표시

### 마지막 round (이번 commit)
- `kt_alpha_admin_seller_id` 어드민 UI input 추가 (필수 표시 + 설명)
- VoucherDetailPage phone 모달 — 개인정보보호법 동의 체크박스 + 보유기간
- MyVouchersPage — phone 미등록 안내 배너 (7일 dismiss)
- guide-seed-admin.ts — voucher-transactions / admin-users 가이드 2 섹션 추가

## ✅ 2026-05-22 세션 — 정책 중앙화 + 성능 + 부채 정리

### 정책 SSOT 1페이지화 (`src/shared/constants/policy.ts`)
- REFUND_POLICY (9) / COMMISSION_DEFAULTS (10) / TAX_POLICY (3) / TIME_CONSTANTS (7)
- WITHHOLDING_RATES 재내보내기 — 한 파일에서 모든 정책 접근
- 8.8% / 0.05 / 0.10 / 0.07 / 0.005 / Math.min(20, …) hardcode 모두 import 전환
  - `affiliate.routes.ts`, `admin-tools.routes.ts`, `ledger.ts`, `agency.routes.ts`,
    `group-buy.routes.ts`, `stays-public.routes.ts`, `payouts-generate.ts`
- 새 상수: `AFFILIATE_COMMISSION_PCT`, `REFERRAL_BONUS_BOTHSIDES_PCT`, `STAYS_COMMISSION_CAP_PCT`

### 정합성 (atomic refund)
- `disputes.routes.ts` auto-refund + admin approve → CAS + D1 `batch()` 패턴
  → voucher refunded 인데 user balance 미환불되는 ghost refund 방지

### Audit log 미들웨어
- `admin-payouts.routes.ts` 5 endpoint (generate / approve / sent / cancel / commission-rates)

### Observability
- `alerts.ts sendAlert` 옵션 `dedupSeconds` (default 300s) — RATE_LIMIT_KV
- `discord-alert.ts sendDiscordAlertDedup` — 같은 (title, severity) 5분 내 중복 차단
- swallow() 래퍼 적용 (financial path): group-buy 추천 보너스, marketing 인플 정산,
  review-bonus, disputes escalate, influencer-payout cron

### 홈 공구 로딩 perf (live.ur-team.com)
- `group-buy-public.routes.ts`: `SELECT p.*` → 명시적 16 컬럼 (~56% payload ↓)
- `migrations/0276`: partial composite index
  `idx_products_groupbuy_feed (category, group_buy_status, created_at DESC) WHERE is_active=1`
- `GroupBuyFeed.tsx`: useEffect+state → useQuery (탭 복귀 시 ~200ms ↓)
- `EmptyStateWithFallback`: 같은 queryKey 로 메인 캐시 hit (중복 fetch 제거)
- `GroupBuyFeedCard.tsx`: `cfImage` + `cfSrcSet` (200/400/600px WebP/AVIF) — 이미지 50-80% ↓

### A11y
- aria-label 추가: navigate(-1) back, X close (모달/필터/사이드), ShoppingCart 아이콘
- 14개 파일

### 8.8% 마이그레이션 (Phase 2 — 사용자 미루기 → 재개)
- `WITHHOLDING_RATES.other_income` 호출 마이그 (`points.routes.ts withdraw`,
  `seller-settlements.routes.ts voucher-redeem`)



## 🎯 2026-05-21 세션 — 5 Phase 정산 인프라 + UX 통합

### Phase A: Commission 출금 + 기초 인프라
- commission_withdrawals + 사용자/어드민 UI + 알림톡 + 회귀 테스트 9개
- YouTube 썸네일 자동 cron / 셀러 분석 강화 / KT Alpha progressive
- 교환권 결제 흐름 정상화 (토스 우회)

### Phase B: 자체 예약 캘린더 (뷰티/액티비티/건강/펫)
- product_booking_slots + appointment_bookings (atomic + UNIQUE INDEX)
- 9 endpoints + 3 UI (셀러 슬롯 / 셀러 예약 / 유저 내 예약)
- D-1 reminder cron + 결제 직후 prompt + 취소 자동 환불
- 회귀 테스트 10개

### Phase C: 통합 정산 인프라 (ledger 중심)
- ledger_entries 헬퍼 3개 + payouts 테이블 + 4 INDEX
- 6 admin endpoints + /admin/payouts 페이지 (2 탭)
- 주 1회 cron (월요일 00 UTC) — pending payouts 자동 생성
- voucher used → atomic ledger 3 entries (merchant + seller + platform)

### Phase D: AI 통합 (3개 AI 권장 모두 반영)
- 셀러 트래킹 링크 위젯 + SellerProductsPage / SellerMiniShopPage 노출
- 에이전시 commission 자동 분배 + 어드민 commission 비율 조정 UI
- 사장님 매직링크 발송 트리거 (AdminBusinessVerificationPage 버튼)
- 세금계산서 stub + 연말 정산 CSV 리포트
- 모든 voucher 카테고리 결제 정상화 (meal_voucher hardcode 제거)
- AdminPayoutsPage 4 탭 (ledger / payouts / 수수료율 / 연말 리포트)

### Phase D-2: Attribution + 가이드 + Smoke test (이번 commit)
- 셀러 트래킹 attribution (src/lib/seller-tracking.ts) — sessionStorage 24h
- BrowsePage / GroupBuyDetailPage / ProductDetailPage capture + ref 전달
- GET /api/ledger/my — 셀러/에이전시 본인 ledger 조회
- docs/ALIMTALK_TEMPLATES.md — Aligo 9 템플릿 등록 가이드
- scripts/smoke-test.sh — 15 endpoint 검증 (확장)

## ⚠️ 운영자 액션 (production 적용 — 코드 X)
1. **`/api/_internal/repair-schema` GET 호출** — 모든 신규 컬럼/테이블/INDEX 적용
2. **Aligo 템플릿 9개 등록** — `docs/ALIMTALK_TEMPLATES.md` 참조
3. **`/admin/payouts` 수수료율 첫 저장** — default 5/10/30 명시 저장
4. **smoke test 실행** — `ADMIN_TOKEN=xxx ./scripts/smoke-test.sh prod`
5. **KT Alpha 카테고리 자동 분류** — `/admin/kt-alpha` ⚡ 메가 버튼
6. **end-to-end 테스트** — voucher 결제 → 매장 QR 스캔 → ledger entry 3개 자동 생성 확인

## 🎯 영구 인프라 (1만~10만 매장 대응)
- ledger_entries 단일 source of truth (정산 / 환불 / 분쟁 모두 entries 로 추적)
- payouts 테이블 송금 audit trail (transaction_id 추적)
- 모든 검색/필터 INDEX 명시 (풀스캔 0)
- atomic CAS — voucher used + appointment booking race condition 0
- 멱등 ledger — voucher_id + event_type 중복 entry 0
- 매장당 1 에이전시 lock-in (admin reassign + 감사 로그)
- commission 비율 어드민 UI 조정 (즉시 적용)

## 🚨 2026-05-21 사고 + 영구 fix
### Incident 1: CSP style-src nonce → 화면 깨짐
- `src/worker/index.ts` 에 `style-src 'nonce-XXX'` 추가 → CSP3 가 unsafe-inline 무력화 → Tailwind/React inline style 전부 차단.
- **영구 fix**: nonce 제거 + `scripts/check-csp-style-nonce.sh` pre-commit hook + CLAUDE.md 금지 룰 명시 + docs/INCIDENTS.md 기록.

### Incident 2: /api/<feature>/admin/* admin_token 미부착 → 403
- `src/lib/api.ts` 가 `/api/admin/*` 만 admin_token 분기. `/api/referral-tree/admin/withdrawals` 호출 시 헤더 누락.
- **영구 fix**: `/^\/api\/[a-z0-9-]+\/admin(\/|$)/` 패턴 추가 + `src/tests/unit/api-admin-token-attach.test.ts` 6 케이스 회귀 테스트.

## 🆕 2026-05-21 세션 — Commission 출금 + UX 단순화 + 알림톡

### Commission 출금 시스템 신규 (커밋 `66bfe245`, `aa44c269`)
- 새 테이블 `commission_withdrawals` (계좌 정보 + status pending/approved/rejected)
- `referral_commissions` ALTER: `withdrawn_at` / `withdrawal_request_id` / `paid_out_at` 컬럼 추가 (production schema fix)
- 새 status: `withdrawal_requested` / `paid_out` (기존 pending/granted/withdrawn 외 확장)
- 신규 endpoints (`src/features/referral/api/referral-tree.routes.ts`):
  - `POST /api/referral-tree/withdrawals` 사용자 출금 신청 (10,000원 이상)
  - `GET  /api/referral-tree/withdrawals` 내 이력
  - `GET  /api/referral-tree/admin/withdrawals?status=pending|approved|rejected|all`
  - `PATCH /api/referral-tree/admin/withdrawals/:id/approve` (admin_memo 선택)
  - `PATCH /api/referral-tree/admin/withdrawals/:id/reject` (rejection_reason 필수)
- 신규 페이지:
  - `/my-commissions` — 사용자/셀러/에이전시 공통 commission 조회 + 출금 신청
  - `/admin/commission-withdrawals` — 어드민 송금완료/거절 처리
- 승인/거절 시 자동 알림톡 (수령자 type 별 phone 조회 + 계좌번호 마스킹)
  - template code: `commission_withdrawal_approved` / `commission_withdrawal_rejected`

### 셀러 정산 완료 알림톡 신규 (방금 추가)
- `POST /api/admin/settlement/execute` 대량 정산 직후 sellers.phone 으로 알림톡 발송
- template code: `seller_settlement_completed`
- 기존 dashboard notification 과 별개로 추가 — silent skip 보존

### YouTube 라이브 썸네일 자동 갱신 (5분 cron)
- 새 cron `src/worker/cron/youtube-thumbnail-refresh.ts`
- live 상태 + custom_thumbnail_url 없는 stream 의 cache-bust URL 매 cron 갱신
- 셀러 수동 호출 불필요

### 셀러 분석 페이지 2개 탭 추가 (`SellerAnalyticsPage`)
- 추천 Commission 탭 (granted/pending/paid_out + 상위 추천 고객 + 출금 신청 링크)
- 월별 입점 추이 탭 (최근 12개월 신규 상품 + 공구권 카운트)
- 신규 endpoints: `monthly-trend`, `referral-commissions/summary`

### 교환권 페이지 (vouchers) 성능 + UX
- KV 캐시 5분 + stale-while-revalidate 2분 (chip 로딩 지연 해결)
- N+1 → 단일 GROUP BY 쿼리
- 브랜드 아이콘 하단 "N종" 수 표시 제거 (사용자 요청)
- v3 다크 그라데이션 잔액 카드 + 6개 정렬 옵션

### 홈/브라우즈
- 공구 카드: gift_catalog 브랜드 fallback (참외 스타일)
- /browse 카테고리 가로 스크롤 이모지 아이콘 (사용자 선택)
- /browse 최근 본 상품에서 교환권 제외
- /cart 뒤로가기 무한 루프 영구 fix

### 리뷰 시스템
- 구매자 전용 리뷰 작성 (NOT_PURCHASED 403 toast)
- 리뷰 사진 첨부 (최대 5장, 5MB)

### 공구 개최 페이지 UX 단순화 (`SellerMealVoucherNewPage`)
- 기본값 자동: 마감 7일 후 / 만료 90일 후
- "고급 설정" 토글로 약관 + 단계별 할인 접기

### 회귀 테스트 (`tests/integration/commission-withdrawal-flow.test.ts`)
- 9개 신규 테스트 (인증/검증/권한/거절 사유)
- 전체 1782 tests 통과 (기존 1773 + 신규 9)

### Sitemap.xml 보강
- /vouchers + 6개 카테고리 명시
- /restaurant-map 추가

### 운영 가이드 4개 섹션 신규 (`guide-seed.ts`)
- admin: commission-withdrawals-admin
- seller: consignment-seller / introduction-commission
- agency: store-introduction

### ⚠️ 운영자 액션 필요 (production 적용 전)
1. **schema repair 호출** (필수)
   ```bash
   curl -X POST https://live.ur-team.com/api/_internal/repair-schema \
     -H "Authorization: Bearer <ADMIN_TOKEN>"
   ```
   (commission_withdrawals 테이블 + ALTER 컬럼 적용)
2. **Aligo 템플릿 등록**
   - `commission_withdrawal_approved` / `commission_withdrawal_rejected` / `seller_settlement_completed`
   - 등록 전까지 silent skip (운영 영향 0)
3. **CF Pages 배포 녹색 확인** → `live.ur-team.com/my-commissions` 401 응답 확인

## 🆕 2026-05-20 세션 — 셀러/사용자 사이드 종합 정리

### 셀러 사이드 (사용자 보고 이슈 영구 fix)
- `/api/seller/bundles 401` — `bundle.routes.ts:44` 가 `payload.id` 봤지만 토큰은 `seller_id`. 호환 fallback 추가.
- `/api/seller/analytics/reviews 500` — `FROM reviews` (실제 `product_reviews`) + `r.image_urls` (실제 `images`). 테이블/컬럼 영구 fix.
- `/seller/alimtalk` Toss 400 — V1 widget API → V2 `payment().requestPayment` (PointsChargePage 와 동일 패턴).
- 사이드바 "설정" → 메인페이지로 튕김 — `SellerProfileEditPage` 의 `?tab=` 없으면 `/profile/{slug}` redirect 제거.
- 사이드바 하단 버튼 스크롤 점프 — `ScrollToTop` 에 `state.preserveScroll: true` 옵트아웃 추가.
- 사업자등록증 업로드 UI (셀러 `/seller/business-info`) + 어드민 검증/반려 (`/admin/sellers` 상세 펼침).
- 셀러 공개페이지 owner 모드 sticky 안내 배너 + 항상 보이는 Pencil 아이콘.
- 큰 CTA 카드 그리드 (`PrimaryActions`) — 라이브/주문/상품등록/정산 4개 prominent.

### 사용자 사이드
- 본문 바로가기 a11y 링크 제거 (사용자 요청).
- Cart 판매종료 일괄 삭제 버튼 (`product_is_active === 0` 만 batch delete).
- 추천 수익 카드 코멘트 정정 (이미 항상 노출 중 — 적립 0 도 "시작하기" CTA).

### 어드민
- KT Alpha 카테고리 자동 분류 endpoint (`/admin/kt-alpha/categories/auto-classify`).
- 리뷰 대량 생성 / 정리 endpoints.
- 사업자등록증 검증 + 정산 계좌 정보 어드민 패널.

### 영구 패턴 정착
- 74개 누적 TS 에러 → 0개.
  - Hono `c.req.json<T>().catch(() => ({}))` → `T | {}` union 회피: `({} as T)` 명시 + 헬퍼 `src/shared/utils/parse-json-body.ts`.
  - `c.get('user'/'seller')` ContextVariableMap: `Hono<{ Bindings; Variables }>` 명시.
  - `caches.default`, `crypto.subtle.importKey(Uint8Array)`, `LIVE_STREAM` cast 등 영구 fix.
- 업로드 500 진단성 강화 — `INVALID_CONTENT_TYPE` / `MULTIPART_PARSE_FAILED` / `NO_FILE_FIELD` 에러 코드.
- ToastStore 시그니처 — `success(msg, { duration })` 지원.

### 검색 정확도
- 신규 migration `0275_fts5_trigram_korean.sql` — 한국어 trigram tokenizer.
- `ProductRepository.searchByText` 의 `JOIN fts.product_id` 버그 → `JOIN fts.rowid` 로 영구 fix (LIKE fallback 으로만 떨어지던 문제).
- `ProductService.getProducts` 가 search 있으면 FTS5 + bm25 ranking 자동 사용.

### Schema repair
- `/api/_internal/repair-schema` 에 0271 (`products.referral_enabled/rate`), 0272 (`sellers.can_broadcast`), 0273 (`search_logs`), 0274 (`user_withdrawals`) 추가. 한 번 호출로 production D1 동기화.

## ⏭️ 다음 작업 후보 (우선순위)
| 우선 | 항목 | 메모 |
|---|---|---|
| 🔴 | production smoke test | `/api/referral-tree/admin/withdrawals` + `/api/vouchers/categories` curl |
| 🟡 | KT alpha 자동 분류 production 1회 실행 | `/admin/kt-alpha` 메가버튼 |
| 🟡 | `/vouchers` 카테고리/브랜드 재검증 | 자동분류 실행 후 확인 |
| 🟡 | 라이브 시작 시 셀러 본인에게 알림톡 | 단골에게는 web push 가나 셀러 본인 미발송 |
| 🟢 | 공구 개최 페이지 추가 단순화 | 디자인 시안 필요 (현재 고급 설정 토글만 추가됨) |
| 🟢 | PC 반응형 검증 (남은 페이지) | 4 viewport |
| 🟢 | CSP unsafe-inline 줄이기 | 우리 코드만 (외부 iframe 제외) |
| 🟢 | YouTube 썸네일 콘솔 404 노이즈 | onError 처리는 됨, 로그는 못 막음 |
| 🟢 | PPT 슬라이드 디자인 | 지난 세션 outline → Claude Design 의뢰 |

### ✅ 완료된 항목 (2026-05-21)
- ~~공급자 (가게 사장님) 자체 onboarding UI~~ → `SellerRegisterSupplierPage.tsx` 이미 존재 (2026-05-20 신규)
- ~~새 기능 통합 테스트 (commission withdrawal)~~ → 9개 테스트 신규



## 📦 2026-05-19 세션 — KT Alpha (기프티쇼) B2B API 통합

**비사업자 셀러** 정산 대안 완성 — 적립금으로 KT Alpha 기프티쇼 상품권 받기.

| PR | Commit | 범위 |
|---|---|---|
| 1 | `d9302be3` | foundation — giftishow-api.ts utility + 0101 listGoods + 0111 getGoodsDetail |
| 2 | `d3bfd177` | 0201 getCouponInfo + 0202 cancelCoupon + 에러 매핑 일부 |
| 3 | `7958c88a` | 0203 resendCoupon + 0204 sendCoupon + 0301 getBizMoneyBalance + 에러 코드 40+ 매핑 |
| 4 | `d9805d6` | 어드민 페이지 (\`/admin/kt-alpha\`) + 카탈로그 sync cron + 셀러 voucher 발송 endpoint |
| 5 | `e5f66093` | 셀러 voucher 발송 모달 + 발송 이력 페이지 + 잔액 부족 자동 알림 |

### 신규 파일
- \`src/worker/utils/giftishow-api.ts\` — 7개 API (0101/0111/0102/0112/0201/0202/0203/0204/0301) + 에러 매핑
- \`src/features/admin/api/admin-kt-alpha.routes.ts\` — 어드민 5 endpoints
- \`src/pages/AdminKtAlphaPage.tsx\` — 어드민 설정/잔액/카탈로그 페이지
- \`src/pages/SellerVoucherOrdersPage.tsx\` — 셀러 발송 이력
- \`src/worker/cron/kt-alpha-catalog-sync.ts\` — 매일 03:00 UTC sync
- \`migrations/0264_kt_alpha_gift_catalog.sql\` — gift_catalog 테이블
- \`migrations/0265_kt_alpha_markup.sql\` — markup_pct, user_id, callback_no 설정

### 셀러 통합
- \`SellerSettlementsPage\` 에 VoucherRedeemModal 추가 — '🎁 상품권으로 받기' 버튼
- \`/api/seller/voucher-catalog\` — 활성 상품 + 마진 포함 가격
- \`/api/seller/voucher-redeem\` — 발송 + 적립금 차감 + voucher_orders 기록
- \`/api/seller/voucher-orders\` — 발송 이력 조회

### 자동 모니터링
- cron 매일 KT Alpha 0301 잔액 호출 → \`platform_settings.kt_alpha_biz_money_balance\` 저장
- 10만 원 이하 시 \`admin_dashboard_notifications\` 자동 추가 (24h 중복 방지)
- 잔액 0 시 즉시 차단 경고

### 운영 가이드 업데이트 (본 PR)
- 어드민 가이드: \`kt-alpha-admin\` + \`stay-voucher-admin\` 섹션 추가
- 셀러 가이드: \`seller-voucher-kt-alpha\` 섹션 추가

### 🔴 운영 측 액션 필요 (별도 작업 — 코드로 처리 불가)
1. **KT Alpha 상용 Key 신청** — \`/admin/kt-alpha\` 페이지 스크린샷 4종 첨부
2. **wrangler secret put** — KT_ALPHA_AUTH_CODE, KT_ALPHA_TOKEN_KEY, KT_ALPHA_AUTH_TOKEN
3. **Cloudflare Dashboard** — R2 bucket 'ur-live-media' 생성 + MEDIA_BUCKET binding
4. **D1 production** — migration 0264 + 0265 적용 (\`wrangler d1 execute\`)
5. **카탈로그 초기 sync** — 어드민 페이지 'Sync 지금 실행' 버튼 (수동 1회)

## 📦 2026-05-18 세션 누적 (대량 작업)

### 🏨 숙소 공구 (stay_voucher) 완전 구현 — 6 PRs

야놀자/Booking.com 수준 완전 구현. 5000+ 줄, 8 페이지, 30+ endpoints, 1 cron.

| PR | Commit | 범위 |
|---|---|---|
| 1 | `fab38759` | DB schema (8 tables) + Backend CRUD (28 endpoints) |
| 2 | `386f9006` | 셀러 UI — 등록/객실/캘린더 (3 페이지) |
| 3 | `0bcb647c` | 사용자 검색/상세/예약 (2 페이지) |
| 4 | `ba8c1e32` | 셀러 KPI (OCC/ADR/RevPAR) + 예약 처리 |
| 5 | `ad8fd93d` | 어드민/에이전시 모니터링 + 분쟁 처리 |
| 6 | `1317c7d3` | 알림 cron + 환불 자동화 + 리뷰 작성 |

신규 테이블 8종:
- `product_stay_info`, `product_stay_rooms`, `product_stay_calendar`
- `stay_bookings`, `stay_booking_reviews`, `stay_booking_status_log`
- `stay_property_amenities` (30개 시드)
- `orders` 에 stay_booking_id 등 4 컬럼 추가

신규 페이지: `/seller/stays`, `/seller/stays/new`, `/seller/stays/:id`,
`/seller/stays/bookings`, `/stays`, `/stays/:id`, `/my-stays`,
`/admin/stays`, `/agency/stays`

### 💳 사업자등록 게이팅 정산 시스템 (Phase 1)

- migration `0257_business_reg_gated_settlement.sql` — sellers 컬럼 + 4 신규 테이블
  (`seller_deal_balances`, `seller_deal_transactions`, `voucher_orders`, `tax_withholding_log`)
- POST /api/seller/settlements/request — verified 셀러만 (412 BUSINESS_REGISTRATION_REQUIRED)
- GET /api/seller/settlement-options — 3 방식 (cash/voucher/deal) + 검증 상태
- POST /api/seller/business-registration/submit — 셀러 제출
- PATCH /api/admin/sellers/:id/business-registration/verify — 어드민 검증
- SellerSettlementsPage 에 검증 상태 배너 + 모달

### 🎨 UI 개선 (다수)

- `ad953313`: Hero 카테고리 monochrome 통일 (촌스러운 컬러 배경 제거)
- `6e5fc29e`: 어드민 배너 제목 optional (이미지만으로 등록 가능)
- `c7fbc88b`: 메인 페이지 오프라인/온라인 대분류 헤더
- `47f2f029`: Group buy 카테고리 탭 6→4 통합
- `c4882404`: 셀러 대시보드 Mode-based IA (라이브/매장)
- `6408723d`: 에이전시 대시보드 Mode-based IA
- `b8be80db`: 셀러 대시보드 홈 Mode-specific KPI

### 🛠️ 어드민 도구

- `d91aaea2`: 라이브 모니터링 — 다시보기 일괄 삭제 (체크박스)
- `a04ce05b`: 라이브 모니터링 삭제 fix (deleted_at 필터)
- `f9d1cb2a`: 상품 관리 — 체크박스 일괄 삭제/활성/비활성
- `1b393d26`: 상품 관리 — 재고 인라인 편집 (색상 시각화)

### 📄 문서

- `a17e2e33`: 공동구매 서비스 회사소개서 (`docs/company-intro-group-buy.md`)
- 본 PR: production-schema.ts 업데이트 (8 stay tables + 4 settlement tables)

## ⏭️ 다음 우선순위 (시장 검증 후 별도 PR)

### 🔴 즉시 적용 필요 (DB)
1. **production D1 에 migration 0257 + 0258 적용**
   - 현재는 코드만 있고 production 스키마 미적용 가능성
   - `/api/_internal/repair-schema` 또는 wrangler d1 execute 로 적용
   - defensive ALTER TABLE 들이 첫 호출 시 자동 처리하지만 인덱스/시드는 별도

### 🟡 후속 PR (필요 시)
1. **결제 PG 환불 자동 트리거** — 토스 API 연동 (현재는 status='cancelled' 마킹만)
2. **카카오 알림톡 실제 발송** — D-1/D-day cron (현재 notifications INSERT only)
3. **객실 이미지 R2 업로드** — 현재 URL 입력만 가능
4. **다객실 한 결제** — 2 객실 동시 예약
5. ~~**KT Alpha 기프티쇼 통합**~~ — ✅ 2026-05-19 완료 (5 PRs, 위 섹션 참조)
6. **8.8% 원천징수 자동 계산** + 지급조서 export (어드민 CSV)

### 🟢 i18n 6개 언어 sync (낮은 우선순위)
새로 추가된 defaultValue 한국어 키들 (~50개+) 6 언어 sync:
- 숙소 공구 관련 라벨 (식사권/미용/숙소/기타 등)
- 사업자등록 정산 안내 텍스트
- KPI 라벨 (OCC/ADR/RevPAR)

### 🐛 사전 이슈 (별도 작업)
- `SellerTermsPage.tsx` — dark: variant 1건 (대시보드 정책 위반)
- `GroupBuyListPage.tsx:246` — TypeScript 경고 (사전 이슈)
- `TECHNICAL_DEBT.md` 의 NOT NULL INSERT 5건 (warn-only)

---


**미배포 (PC 머지 대기)**: `bf3b75e` (GroupBuyList/Search/Embed i18n)

## 📦 2026-05-15 (Round 2) — 공동구매 이상적 구현 (10개 영역)

10개 영역 모두 구현 완료 — 전용 detail page, 티어 할인, 마일스톤 알림, 이메일 영수증,
동적 OG 이미지, JSON-LD SEO, voucher map, 어드민 analytics, 엣지 케이스 가드.

### 신규 추가
- **`GroupBuyDetailPage` (`/group-buy/:id`)**: 카운트다운 ring, 티어 시각화, 참여자 아바타,
  셀러 카드, KakaoLink share, sticky bottom 결제. 6개 voucher 카테고리 전체 지원.
- **`/api/group-buy/products/:id/participants`**: 마스킹된 최근 참여자 20명.
- **`/api/group-buy/admin/analytics`**: 카테고리별 funnel, GMV top 10, 일별 추이 30일.
- **`/api/og/group-buy/:id`**: 동적 SVG OG 이미지 (1200x630), 진행률/할인율 포함.
- **`og-image.routes.ts`**: 신규 worker route, 1시간 edge cache.
- **티어 할인 시스템**: `products.group_buy_tiers` JSON, `vouchers.applied_discount_pct/applied_price`,
  `calcTierDiscount()` 헬퍼, SellerMealVoucherNewPage 에 토글 + 단계 입력 UI.
- **마일스톤 알림**: 50%/80%/1명 남음 hot push, atomic CAS dedup 컬럼 3개.
- **이메일 영수증**: Resend 로 voucher 코드 + 매장 정보 + 티어 할인 내역 HTML 메일.
- **VoucherMap**: MyVouchersPage 에 미사용 식사권 카카오 멀티 마커 지도 (lat/lng 응답에 추가).
- **AdminGroupBuyPage**: 모니터링/분석 탭 분리, 카테고리별 통계 + Top 10 + 일별 표.

### SEO 풀 적용
- `<SEO>` JSON-LD: Product + Offer + GeoCoordinates + BreadcrumbList + ItemList (목록 페이지)
- 동적 OG image (위 endpoint)
- KakaoShareButton 통합

### 엣지 가드
- POST /join: voucher_expiry ≤ group_buy_deadline 차단 (불가능 voucher 발급 방지)
- POST /join: status=expired/cancelled 명시적 차단
- DELETE /seller/products/:id: active 공구 + 참여자 1명+ 이면 409 (참여자 보호)
- ProductDetailPage: voucher 카테고리 6종 → /group-buy/:id 자동 redirect (URL 보존)

### 커밋 흐름
- `881c3f4b`: Round 1 (티어/마일스톤/이메일/detail/edge cases)
- 다음 commit: Round 2 (SEO/OG/voucher map/admin analytics)

라이브 서비스와 완전 독립 — OAuth verification 검토 영향 없음.

---

## 📦 2026-05-15 — 공동구매 6대 영역 런칭 준비 완료

OAuth verification 검토 (4-6주) 동안 공동구매 서비스를 정식 운영 가능 상태로 마무리.

### 변경 (`claude/check-live-commerce-flow-jgNs8`)
- **`/api/group-buy/join/:id`**: rate limit 5/min 추가 (동시 클릭 / 봇 방어, voucher 중복 발급 차단)
- **`/api/group-buy/admin/list`** (NEW): 어드민 전체 공구 조회 + status/filter (unsuccessful) 지원
- **`/api/group-buy/admin/force-refund/:productId`** (NEW): 어드민 강제 환불 + audit_logs + 참여자/셀러 알림
- **`AdminGroupBuyPage.tsx`** (NEW): `/admin/group-buy` — 모니터링 + 필터 + 강제 환불 버튼 UI
- **AdminLayout 메뉴** 추가: `공동구매` (Ticket icon, 거래 그룹)
- **scheduled-cleanup cron**: 미달성 자동 환불 시 셀러에게 dashboard notification + Alimtalk 발송 (best-effort)
- **`ProductDetailPage.handleBuyNow`**: voucher 카테고리 6종 감지 시 `/api/group-buy/join` 호출 (기존엔 일반 checkout 으로 빠져 group_buy_current 미증가 + voucher 미발급 버그). 딜 부족 시 `/points/charge` 안내 confirm.
- **운영 가이드**: `/admin/operations-guide` 의 "공동구매/타임딜 승인" 섹션에 어드민 도구 사용법 추가

### 핵심 진단 결과
공동구매 시스템은 백엔드 80% 완성 (atomic CAS, 자동 환불 cron, voucher 발급) — 차단 이슈는 단 2개:
1. ✅ ProductDetailPage 가 voucher 를 일반 checkout 으로 보내던 버그 (해결)
2. ✅ 어드민이 분쟁 환불 시 DB 직접 수정해야 하던 문제 (해결)

라이브 서비스와 완전 독립 (DB / 라우트 / 외부 의존성 모두 분리) — OAuth 검토 영향 없음.

## 📦 2026-05-12 후반 세션 — 4차 배포 (배포 대기)

### Batch 1 (`59a8cf2`) ✅ 배포 완료
- LiveRecapPage: 상품 클릭 `[object Object]` 버그 수정
- ReelCard: 종료 라이브 "LIVE" 배지 → "다시보기" 배지
- TopNav: YouTube 아이콘 `?sub_confirmation=1` + "구독" 레이블
- TopNav: 셀러 pill → 셀러 프로필 클릭 링크

### Batch 2 (`9ac922d`) ✅ 배포 완료
- ReelActionRail: tap target 40 → 44px (WCAG 2.5.5)
- ReelChatSheet: 백드롭 키보드 접근성 + 변수 `t` shadowing 수정
- ReelProductCard: 재입고 알림 상태 분리 (idle/requesting/requested/error)
- ReelCard: 시청 트래킹 leave fetch `keepalive: true`

### Batch 3 (`cb48a60`) ✅ 배포 완료
- ShortsPage: 음소거/닫기 버튼 32 → 44px + silent error → DEV 로깅
- AccountSettings: handleCheck setTimeout 누수 + cleanup + isMounted guard
- BlogDetail: 하드코딩 한글 → t()

### Batch 4 (`bf3b75e`) ⏳ PC 머지 대기
- GroupBuyListPage: 헤더/배너/탭/empty state/CTA/뱃지 ~14건 i18n
- SearchPage: 관련 키워드 헤딩 + 기본 6개 키워드 i18n
- EmbedLivePage: 폴백 메시지 i18n

### Batch 5 (`ae21e1b`) ⏳ PC 머지 대기
- ProductDetailPage: 옵션 가격, 최대 적립딜, 추천 링크, 리뷰/전체보기 → t()
- useLiveStreamWebSocket: 재연결 에러, 인앱 fallback toast, 메시지 전송 실패 → t()
  → 훅에 useTranslation 도입

### TD-014 i18n 점검 결과
- ✅ MainHomePage: 잔여 한글 모두 주석 — 클린
- ✅ ShortsPage: JSX 텍스트 모두 t() 처리됨
- ✅ LivePageV2: JSX 텍스트 모두 t() 처리됨
- ⏭️ PaymentFailPage: Toss 한국 전용 의도 (line 25) — skip
- ⏭️ KakaoLinkCallbackPage: 팝업 300ms 자동 닫힘 — 무영향
- ⏭️ Seller/Admin/Agency: 별도 TD-014 PR

### TD-024 점검 결과
- ✅ WebSocket 503 fallback: polling + 인앱 toast 안내
- ✅ postMessage origin: `window.location.origin` 명시
- ✅ IntersectionObserver: best entry by intersectionRatio (line 91-103)
- ✅ YouTube fallback iframe: handleVideoClick 에서 player destroy 후 native iframe
- ⚠️ 영상 재생 실패 잔여 — **실 프로덕션 브라우저 콘솔 로그 필요**
  - 검증: `/live/<id>` 진입 → DevTools Console → 셀러 라이브 시작 후 시청자 입장 시 에러 메시지 캡처

## 🔥 2026-05-12 배포 사고 + 해결

**증상**: `wrangler pages deploy` 시 "Disallowed operation called within global scope. ... generating random values are not allowed within global scope" 오류로 모든 신규 배포 실패. 프로덕션은 이전 배포본으로 정상 작동 중이었음.

**원인**: `src/lib/rate-limit.ts` 21~31줄이 모듈 최상위에서 `setInterval(...)` 호출 → CF Pages 런타임이 module init time async I/O 거부.

**해결** (PR #315 / `41e3587`): `setInterval` → lazy `maybeCleanup()` 패턴. 매 요청 처음에 호출, 1분 경과한 경우에만 실제 정리. global scope I/O 없음.

**재발 방지 룰**: Worker 코드 (`src/worker/`, `src/lib/`, `src/features/*/api/`) 에서 모듈 최상위 (function/class 밖) 에 다음 호출 절대 금지:
- `setInterval` / `setTimeout`
- `fetch` / `connect`
- `Math.random` / `crypto.getRandomValues` / `crypto.randomUUID`

검증: `grep -n "^setInterval\|^setTimeout\|^fetch(\|^Math\.random" dist/_worker.js` 결과 empty 여야 함.

새 세션 진입 시 이 문서를 먼저 읽고 이어서 작업할 것.

---

## ✅ 완료 (20차 배치, 2026-05-12)

### 🔒 보안 (10~19차)
| 내용 |
|---|
| security: 전체 셀러/어드민/스트림/에이전시 numeric param 검증 |
| security: 셀러/에이전시 쿠키 SameSite=Strict + 어드민 감사 로그 |
| fix: 프로덕션 ErrorBoundary 스택트레이스 노출 차단 |
| fix: DEV guards on worker + frontend console.log |
| fix: fake avg_rating 4.5 fallback 제거 |
| reliability: Toss 결제 circuit breaker 6개 경로 전체 + 15s timeout |

### 📦 성능 (11~17차)
- KV 캐시: products/streams/popular-search/sections (D1 읽기 80%↓)
- N+1 쿼리 제거 (live-notify-followers 15,000→1 read)
- YouTube chat 배치 INSERT + quota isolate 캐시
- Dead-letter queue 크론 (이메일/푸시 재시도)
- 자동 환불 크론 (만료 공동구매)

### 🧪 테스트 (20차) — 1,727개 100% 통과
- circuit-breaker, rate-limiter, safe-internal-path, validation 유닛 테스트
- payment-validation (금액 변조 방지, 상태전이, 멱등성)
- auth-guards (IDOR, RBAC, JWT 파싱)

### 📦 인프라/CI
- `scripts/deploy-staging.sh` + `deploy-production.sh` (5단계 체크리스트)
- `docs/CANARY_DEPLOY.md` — CF Pages Gradual Deployments 절차
- `tests/load/critical-paths.js` — k6 로드 테스트 (5개 시나리오)
- `scripts/check-npm-audit.sh` + pre-commit hook (high/critical 차단)
- `docs/SLA.md` — 결제 99.9%, RTO 30분, RPO 1시간 정의
- PR #310 머지 → main 배포 완료

---

## ⚠️ 사용자 액션 필요

1. **CF Pages 배포 확인**
   - https://dash.cloudflare.com → Pages → ur-live → 최신 빌드 확인
   - 성공 시: `live.ur-team.com/about` 접속 테스트

2. **repair-new-tables 호출** (admin_audit_log 테이블 생성)
   ```bash
   curl -X POST https://live.ur-team.com/api/_internal/repair-new-tables \
     -H "Authorization: Bearer <ADMIN_TOKEN>"
   ```

3. **GitHub Actions 수동 배포** (CF Pages 자동 연동 없으면)
   - GitHub → Actions → "Deploy to Cloudflare Pages" → Run workflow

4. **스테이징 환경** (선택)
   - CF Dashboard에서 `ur-live-staging` Pages 프로젝트 생성
   - 생성 후: `npm run deploy:staging`

---

## 📋 기술 부채 (남은 항목)

| 항목 | 심각도 | 설명 |
|---|---|---|
| DB 마이그레이션 CI | 🔴 | D1 권한 없음 → repair-schema 응급처치 |
| ur-live-global Workers 빌드 실패 | 🟡 | 글로벌(world.ur-team.com) 버전 — 한국 서비스 무관 |
| E2E Playwright 테스트 | 🟡 | 브라우저 환경 필요, CI에서 실행 |
| GitHub Actions 분 초과 | 🟡 | 매월 1일 리셋, 그 전엔 수동 배포 |
| 스테이징 환경 | 🟡 | 스크립트는 준비됨, CF 프로젝트 생성 필요 |

---

## 📋 다음 세션 시작 시 체크리스트

1. 이 파일 읽기
2. `git log --oneline origin/main -5` 확인
3. CF Pages 최신 배포 상태 확인
4. repair-new-tables 호출됐는지 확인
