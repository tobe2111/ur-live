# 런칭 前 보안·무결성 2차 감사 — 6문 (2026-07-11)

> 대표 질문 6건(QR 무결성·인앱 어트리뷰션·어드민 보안·예금주 검증·위치정보·재고 동시성) read-only 코드 감사. 1차(전금법 등 5문)는 `pre-flip-risk-audit-2026-07.md`. **급한 순: 서초 첫 거래부터 적용(R1·R4) / 8월 캠페인 직결(R2·R6) / 상시 보안(R3) / 법무(R5).** 상세 근거는 각 절 file:line.

## 분류 요약 (수리 트랙)

| 트랙 | 항목 |
|---|---|
| **즉시 수리(비-머니, 명확한 버그/방어 공백)** | R1-store_code 무제한 브루트포스 · R2-공구 `?ref=` 미저장(1줄) + 서버측 ref 조기캡처 · R3-payout `/sent` finance 승격 + PIN/2FA 덮어쓰기 자격확인 · R4-셀러 `is_verified=1` 복원경로 부재 · R6-refund restore 멱등화 + 쿠폰 초과발급 + 다품목/공구 재고누수 |
| **대표 액션(거의 0원, 코드 완비)** | R3-`ADMIN_IP_WHITELIST` env 설정 |
| **정책/외부연동(대표 결정+비용)** | R4-1원 인증/오픈뱅킹 도입 · R1-매장 PIN 복잡도·lockout · R3-돈액션 require2FA·finance 2FA 로그인 강제(배포 신중) |
| **법무 트랙** | R5-위치정보법(LBS 신고 + 위치약관 동의 미구현 + 좌표 보유기간/파기) → 전금법 의뢰서에 병합 |

---

## R1. QR/PIN 사용확인 무결성

**견고**: QR = 32^8(≈1.1조) 엔트로피 고정코드(`helpers.ts:419` crypto 난수). 재사용은 3경로 모두 원자적 CAS(`use:56`, `use-by-seller:336`, `self-redeem:858`) `meta.changes` 판정. 캡처 탈취는 모든 경로가 별도 자격증명 요구(매장 PIN 미설정 시 `/use` 거부 `group-buy-voucher.routes.ts:53`, use-by-seller 소유검증 `:328`, self-redeem 소유자 인증 `group-buy-public.routes.ts:836`). 사용 즉시 구매자 알림톡 통지.
**구멍**:
- **[High] `self-redeem` store_code 원격 브루트포스** — self-redeem 라우트에 **rate limit 없음**(`group-buy-public.routes.ts:822`) + store_code **4자리(9000조합)**(`redemption-settings.ts:31`) → 매장 물리 부재로도 원격 돌파 → "현장에서만 사용" 설계 무력화. 수리: `rateLimit` 추가(키=voucher code/user_id, IP 아님) + store_code 6자리 확대.
- **[Med] 매장 PIN**: lockout 없음(`voucher_use_logs`는 기록만) + 4자리 허용(`seller-orders.routes.ts:1221` `>=4`) + rate limit IP 기준이라 로테이션 우회.

## R2. 인플루언서 어트리뷰션(?ref) 인앱 생존성

**서버 이중화 없음 — ref는 클라 localStorage 전용**(`ProductDetailPage.tsx:52`), 서버측 귀속은 주문 생성 이후 `order_referrer_intents`부터만(`affiliate-credit.ts:364`). 카카오 콜백에 ref 처리 0건.
**생존**: 같은 브라우저(로그인 wipe 화이트리스트 KEEP `auth-callback-bootstrap.ts:60`) · 카톡 인앱(자동 외부전환이 전체 URL 운반 `in-app-browser.ts:108`).
**유실**: 인스타 인앱→수동 외부 재방문 · 다른 기기/다음날 구매(브라우저 귀속이라).
**버그**: 공구 상세가 `?aff=`만 저장하고 **`?ref=`(인플 share_url)는 미저장**(`GroupBuyDetailPage.tsx:124`) → share_url 레일이 커미션과 단절.
**핵심 기회**: `affiliate_ref` 쿠키가 **이미 SameSite=Lax라 서버로 전송되는데 서버가 안 읽음** → 저비용 서버측 fallback 캡처 가능. 수리: ①공구 `?ref=` 저장 1줄 ②콜백/주문 시 쿠키 읽어 `first_referrer_id` 서버 기록 ③returnUrl ref/aff/invite 화이트리스트 보존.

## R3. 어드민 계정 보안 (돈 버튼)

**로그인 1회 인증이 유일 방어선. 이후 24h~30일 재인증 0**으로 payout 승인·송금·1,000만딜 발행이 API 호출만으로 가능.
- 2FA: 옵트인, **로그인 미강제**(`admin.routes.ts:92-280`에 totp 검사 없음 — 문서는 "강제"라 주장, 코드 미반영). 실강제는 분쟁 등 4개 엔드포인트뿐, 그나마 미설정 통과.
- PIN: 로그인 1회용, payout 화면 재확인 없음.
- IP allowlist: 코드 완비(`admin-security.ts:29`)나 **env 미설정 = 꺼짐**.
- 돈 액션 재인증 **전무**.
**버그**: ① payout `/sent`가 `requireAdmin`만(승인은 finance — **게이트 불일치** `admin-payouts.routes.ts:226`) ② `set-login-pin`/`2fa/setup`이 **기존 자격 확인 없이 덮어쓰기 가능**(`:450`, `twofa.routes.ts:113`) → 토큰 탈취자가 재설정.
**보강(비용순)**: ①ADMIN_IP_WHITELIST env(0원) ②/sent finance 승격+덮어쓰기 자격확인(소) ③돈액션 require2FA(반나절, 인터셉터 기존 `api.ts:425`) ④finance/super 2FA 로그인 강제(1일) ⑤고액/새IP payout 경보.

## R4. 정산 계좌 예금주 검증

**자동 실명확인(1원인증/오픈뱅킹/예금주조회) 0건** — 전 주체가 문자열 형식검증만, 예금주 자유텍스트, 송금은 어드민 육안+수동. 사업자 진위확인(NTS)은 계좌 예금주와 단절. payout 자동생성은 `business_name`을 예금주 칸에 그대로 복사(`admin-payouts.routes.ts:123`).
**버그**: 셀러 계좌변경 시 `is_verified=0`으로 출금 차단되는데 **`sellers.is_verified=1` 복원 코드가 저장소에 없음**(admin-sellers는 `seller_business_info.is_verified`만 갱신) → 계좌 바꾼 셀러 정상 출금 재개 불가. + 가이드 문서 "예금주 다르면 자동 거부" 구현 없음(문서-코드 불일치).
**방어**: (즉시) is_verified 복원경로 수정 + 계좌변경 알림톡 · (정책) 계좌 저장시점 오픈뱅킹 예금주 조회 1회 or 유저출금 `account_holder===users.name` 대조.

## R5. 위치정보 — GPS 실수집 (법무)

**"GPS 수집 + 서버 전송 + 원시좌표 일부 DB 저장 + 위치약관 동의 부재"**. 홈 `/` 진입 시 자동 `getCurrentPosition`(`RestaurantMapPage.tsx:198`) 포함 6지점. **이용권 셀프사용 시 손님 원시 GPS가 `voucher_redemptions`에 voucher_id 연결 영구 저장**("분쟁 증거" `voucher-redemption.ts:3`) = 개인위치정보 보관. `location` 약관 타입은 정의만, 실제 동의 UI/기록 없음.
**법무 의뢰 병합 문안**: "동의 절차 없이 브라우저 GPS를 수집·서버 전송하고 이용권 사용처리 시 원시 좌표를 DB 보관(voucher_redemptions)하는바, 위치정보법상 LBS 사업 신고 대상 여부 + 위치약관 동의(미구현) + 보관 좌표 보유기간·파기 검토 요청."

## R6. 재고 동시성 (초과판매)

**핵심 견고**: 주문 생성 reserve-before-charge + 조건부 `stock=stock-? WHERE stock>=?` + changes 검사(`order.repository.ts:497`). /confirm은 status flip만. 상품/공구/이용권/숙소 원자적. D1 단일라이터가 뒷받침.
**잔존**:
- **[실질 oversell] `refund.ts:66` restore 비멱등** — 필터/마킹 없어 중복 환불 시 유령재고. 리포 버전(`order.repository.ts:446`)은 멱등.
- **[실질 oversell] 한정수량 쿠폰** — `used_count` 증가 결과 미검사 + INSERT 선행(`order.routes.ts:356`).
- **[조기품절] 다품목 카트 유실** — batch가 `changes==0` 비롤백(`order.repository.ts:506`).
- **[조기품절] 공구 `/join` 조기 return 누수** — promo 검증 실패가 복원 없이 return(`group-buy.routes.ts:280-357`), 인플 코드 배포 시나리오와 겹침.
**수리**: 전부 조건부 UPDATE/멱등화(refund restore를 리포 버전과 통일, 쿠폰 used_count 선검사, batch 보상복원, join 조기return 앞 복원).

---

## 후속 트래킹

| 항목 | 트랙 | 상태 |
|---|---|---|
| R1 store_code · R2 ref 3종 · R3 게이트/덮어쓰기 버그 · R4 is_verified 복원 · R6 쿠폰/다품목/공구누수 | 즉시 수리(비-머니) | ✅ 구현·커밋(2026-07-11) |
| **R6 fix1 refund.ts restoreStock 멱등화** | 즉시 수리이나 **Toss 잠금 파일** — 커밋 보류 | ⏸ **잠금 대기**: 변경은 재고복원 SQL만(Toss 게이트웨이/환불금액 무접촉), 방어심화(processRefund 에 이미 status='REFUNDED' 이중환불 가드 존재). 대표 `[UNLOCK]` 허가 시 반영 예정 |
| R3 ADMIN_IP_WHITELIST | 대표 액션(env) | ⏳ |
| R4 1원인증 · R1 PIN정책 · R3 2FA강제 | 정책+외부연동 | 대표 결정 |
| R5 위치정보법 | 법무(전금법 의뢰 병합) | ⏳ |
