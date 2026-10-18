# 2026-10-18 — 브랜드 전 지점 사용 (이용권을 같은 주인 지점에서도)

대표: *"다른 지점에서도 쓸 지는 선택하게 하는게 좋지 않아?"* → *"응 진행해줘 그게 가장 이상적인거지?"*
잠금 파일(`group-buy-public.routes.ts`) 두 줄: `AskUserQuestion` 승인 *"허가 — 그 두 줄만 (추천)"*.

## 다음 세션의 첫 액션
1. PR 머지·배포 확인 후 **E4**: 같은 주인 두 지점(A·B)이 한 브랜드인 테스트 셀러가 필요하다(라이브에 아직 없음).
   - A 지점 이용권 펼침 → "같은 주인 지점 1곳에서도 사용" 켜기
   - 손님 상세에 "{브랜드} 2곳 어디서나 사용 가능 · 지점 보기" 가 뜨는지 (`GET /api/brands/of-store/A?product=<id>` → `usable_branches: 2`)
   - B 지점 확인코드로 셀프 사용 → 성공 · `ledger_entries` 상인이 **A** 인지(정산 귀속 불변)
   - 가맹점(주인 다른 C) 확인코드 → 403 이어야 한다

## 완료분
- 판정 SSOT `src/worker/utils/brand-wide-redeem.ts` — 켬 여부(`product_supply_meta.brand_wide_use`), 형제 지점·주인(SQL 판 = `resolveStoreOwnerUserId`), 사용 순간 재판정
- 사용 3경로: 카운터(`group-buy-voucher.routes` → `redeemByCounterSecret` 에 형제 지점 id, CAS 안 비밀 재대조) · 사장님 스캔·챗봇(`voucher-seller-redeem` `canStoreRedeemProduct`) · 손님 셀프(`self-redeem-gate` productId + 잠금 파일 두 줄)
- 설정 API `GET/PUT /api/seller/products/:id/brand-wide` (판 지점 주인만, 60/시간)
- 화면: 이용권 펼침 `BrandWideToggle` · 손님 상세 `BrandBranchesLink` "N곳 어디서나 사용 가능"
- 가드 `brand-wide-redeem-2026-10-18.test.ts` 18건 + 주입 `scripts/mutations/brand-wide-redeem-2026-10-18.mjs` 7건(전부 빨간불 확인)
- 셀러 가이드 '지점이 여러 곳이라면' 절 + `GUIDE_SEED_VERSION` 52 · 플랫폼 모델 §프랜차이즈 갱신

## 이번에 틀렸던 판단 / 주의
- 플랫폼 모델이 "브랜드엔 권한이 안 붙는다" 고 적어 두었다 — 이제 예외 하나(사용 처리)가 있다. 정산은 여전히 안 붙는다.
- 셀프 CAS 자체는 비밀을 안 본다(`code=? AND user_id=?`) → 셀프 경로의 문은 게이트다. 게이트를 약화하면 그대로 소각 구멍.

## 3단계 — 점주가 다른 가맹점끼리 (대표 "결재해줄게" + ①②③ 권장안)
결재 `docs/decisions/2026-10-18-franchise-cross-owner-redeem.md`. **게이트 `brand_cross_owner_redeem_enabled` 기본 OFF** — 켜는 건 대표(staging S-BRANDX 뒤, 어드민 머니 스위치에 손잡이 있음).
- SSOT `src/worker/utils/brand-cross-owner.ts` — 받는 지점 동의(`seller_meta.brand_cross_owner_accept`) · 소개비/추천 적립 붙은 이용권 판정(조회 실패 = 있다고 본다) · 쓴 지점 기록 `voucher_redeem_stores` · 두 정산 레일이 같은 기록을 읽는 `settlementMerchantFor`(Rail B 원장) / `REDEEM_STORE_SETTLEMENT_SQL`(Rail A 주간)
- 판정: `brand-wide-redeem.ts` 의 `crossOwnerOk` + `siblingAccepts` — 다른 점주 지점은 **이용권 id 가 있어야만** 받는다
- 사용 경로: 카운터·사장님 스캔·챗봇은 CAS 직후 받은 지점을 기록(원장보다 먼저 await). **손님 셀프는 잠금 파일이라 이용권 id 를 못 넘겨 다른 점주 지점을 거절**(fail-closed) — 열려면 잠금 파일 한 줄(CAS 뒤 `recordVoucherRedeemStore`) 대표 승인 필요
- 받는 지점 화면: `/store/scan` 의 `CrossOwnerAcceptCard`(게이트 OFF 면 안 보임) · API `GET/PUT /api/seller/cross-owner-accept`(주인만)
- 가드 `brand-cross-owner-2026-10-18.test.ts` 19건 + 주입 `scripts/mutations/brand-cross-owner-2026-10-18.mjs` 8건(전부 빨간불 확인)
- 셀러 가이드는 **안 고쳤다** — 게이트가 꺼져 있는 동안 없는 기능을 안내하면 안 된다. 켤 때 같은 커밋에서 '지점이 여러 곳이라면' 절 + `GUIDE_SEED_VERSION` +1.

### 후속 — 누가 무엇을 보나 (대표 "응", 읽기·표시만)
- 손님 상세 `BrandBranchesLink`: 다른 점주 지점 수를 같은 주인 지점과 섞지 않고 따로 + "소개 링크로 산 이용권은 가맹점에서 못 쓸 수 있어요"(문구 SSOT `pages/group-buy/brand-branches-label.ts`, 서버 `of-store` 가 `cross_owner_branches` 를 싣는다)
- 판 지점 주문 상세 `VoucherCodes`: 다른 점주 지점이 받은 이용권에 "○○에서 사용 · 정산도 그 지점으로" (`order-list-enrich` 조인, 기록 테이블이 없으면 종전 조회로 폴백)
- 어드민 정산 화면 `CrossOwnerRedemptionsCard` ← `GET /api/admin/brand-cross-owner/redemptions`(읽기 전용, 게이트 꺼짐·0건이면 카드 안 보임)
- 가드 `brand-cross-owner-visibility-2026-10-18.test.ts` 13건 + 주입 5건(전부 빨간불 확인)

### 정정 — "사용 취소 원장 틈"은 실재하지 않는다
- 앞서 *사용 취소 뒤 다른 지점에서 다시 쓰면 원장이 첫 지점 그대로* 라고 적었는데, 코드에 사용됨 → 미사용 경로가 **없다**(유일한 되돌림은 분쟁의 환불됨 → 미사용). 실제로 일어나지 않는 경우다.

### 테스트 사장님 계정 (E4 용 — 비밀번호는 레포에 없다, 대표에게 채팅으로만 전달)
- 유저 `users.id = 44` · 이메일 `test-owner-brandwide@ur-team.com`
- 매장 27 · 28 (같은 주인) · 브랜드 `urdeal-test-brand`(store_brands id 1)
- ⚠️ 이용권이 아직 없다 — 테스트 이용권을 올리면 공개 피드에 보이고, 사용 검증엔 실결제 1건이 필요하다(대표 판단).
- 다른 점주 지점 검증엔 **주인이 다른 세 번째 매장**이 같은 브랜드에 있어야 한다(아직 없음).

## 남은 결정 (대표)
- 3단계 게이트 ON (S-BRANDX staging 실결제 뒤)
- 손님 셀프 사용도 다른 점주 지점에서 되게 할지(잠금 파일 한 줄)
- E4 용 테스트 이용권 등록 + 결제 1건

## 🔎 마이 점검 (대표 *"마이페이지들 모두 가장 이상적이야? 막힌 기능도 없고?"*) — 하네스 렌더로 찾은 넷
- ① 사진 없는 사람 프로필 = 외부 `ui-avatars.com` → 실패 시 이름 왼쪽 빈 칸(폰·PC) + 이름이 외부 전송 ⇒ 유달이(`profile-avatar.ts`, 세 자리 공용)
- ② PC 오른쪽 위 빈 흰 카드(이용권 0장 사용자) ⇒ 응답 후 매장 이용권 0장이면 카드째 접음
- ③④ '관심 맛집'(추가 버튼이 숨겨진 쇼핑에만 · 라이브 누적 1건)·'배송지 관리'(배송 상품 없음) ⇒ `SHOPPING_TAB_HIDDEN` 동안 감춤(쇼핑 열면 복귀)
- 가드 `my-avatar-empty-rows-2026-10-18.test.ts` 7건 + 주입 5건(반대 방향 1 포함) 전부 빨간불 확인
- 못 잰 것: 실제 로그인 라이브(에이전시 콘솔은 에이전시 계정 필요) · 남은 작은 것: PC '가게 열기' 줄만 카드 밖 · `/my-orders` '상품' 탭(쇼핑 숨김인데 노출)
