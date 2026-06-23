# 🎟️ 동네딜 공구권 사용처리(redemption) — 이상적 전략 SSOT

**확정일**: 2026-06-20 · **대표 다회 검증 후 수렴** · 상태: ⏳ Phase 1 구현 대기

## 북극성
> **카운터는 신뢰로 통과시키고, 돈은 정산에서 검문한다.**
> 마찰은 소비자에게(셀프), 안전은 정산(에스크로)에, 검증은 시스템에. **인앱결제+에스크로가 "순간 완벽증명"을 불필요하게 만드는 무기.**

## 왜 이 형태인가 (제거된 대안 + 이유)
| 버린 것 | 이유 |
|---|---|
| 점원 QR 스캔/로그인 | 알바생 미로그인·바쁜시간 마찰 |
| 우리가 QR 스티커 배포 | 운영부담 + 콜드스타트엔 진짜 매장 없음 |
| 사장님 알림톡 실시간 감시 | 바쁜 매장은 못 봄 |
| GPS 하드 게이트 | 스푸핑·밀집지 오차·오처리 |
| 순간 완벽증명 추구 | 불가능(스캔=마찰/코드=유출/GPS=스푸핑). 셀프사용 부정=자해. 진짜 위협(담합·차지백)=정산레이어 |

## 핵심 모델 = "매장 공구권 원장 + 느슨한 카운터 + 정산 검문"
소비자가 공구권 구매 → **[소비자 지갑]** + **[사장님 매장 원장]** 동시 등재.

### 플로우
```
구매(인앱결제) → 공구권 = [소비자 지갑] + [매장 원장(unused)]
  ↓ 매장에서
소비자 "사용하기"(기본) or 4자리 코드→사장님 대리(폴백)
  → voucher used(일회성·불가역, CAS) + 라이브 "사용완료" 화면(실시간 시계·매장명·회전코드)
  → 매장 원장 '방금 사용됨' 상단 하이라이트
  ↓ (즉시 정산 X)
에스크로 홀드 → 매장 원장 '정산 대기'
  ↓
사장님 한가할 때 원장 검토 → 이상無 T+N 자동정산 / "안 왔어요" 신고 → 분쟁·클로백
  ↓
사용 후 "리뷰 쓰면 딜 적립"(review-bonus 연결) → 신뢰점수·랭킹 되먹임
```

### 엣지/실수 방어
- **60초 "취소" grace**(매장 미확인·미정산 한정) → unused 복귀.
- used = 환불 마감 + CAS 일회성(중복 차단).
- 라이브 화면 위조방지: 실시간 시계(초)·매장명 크게·회전 4자리/컬러·일회성.

## 보안 스택 (정산 레이어에 집중)
사업자 KYC · 정산 지연 · 한도 · 이상탐지(담합/급증/동일기기) · 차지백 클로백 · Sybil(전화인증·1계정1회).
- 머니룰 준수(CLAUDE.md): **claim-before-credit(CAS)** · **적립-역전 대칭** · **UNIQUE 멱등** · status플립≠취소.

## "더 이상적" 진화 — 동적 신뢰
- 정적 T+N → **매장 신뢰점수(이력·분쟁율·리뷰) 기반 가변 정산**: 신규/이상=긴 홀드+검토, 우량=거의 즉시정산+검문면제.
- 리뷰·이력 → 신뢰점수·검색랭킹·정산속도 **플라이휠**.

## 데이터 모델 (스키마 규칙 준수)
- `vouchers`: status(unused→used→settled / disputed / refunded), product_id(→seller), user_id, applied_price, **used_at, used_lat/lng(소프트), used_method(self|code), settle_at**. (컬럼 추가는 baseline/사이드테이블 규칙 확인 후 — 가능하면 `voucher_redemptions` 별도 테이블)
- **매장 원장** = `vouchers JOIN products WHERE products.seller_id=?` 뷰(신규 테이블 불필요).
- `voucher_disputes`(voucher_id, store_id, reason, status).
- 신뢰점수 = 집계(사이드테이블 or 계산).

## 선착순(시드) — 별도 트랙
응모형(결제·사용처리 없음), 상위노출, 어드민 선정+알림. 위 redemption 안 거침. (이미 구현됨: fcfs.routes + AdminFcfsPage + 소비자 배지/지원)

## 구현 단계
- **Phase 1**: 매장 원장(읽기) + 소비자 셀프 사용처리(used·라이브 화면·CAS·60s 취소) — 정산은 status만(돈 이동 X). ✅
- **Phase 2**: 에스크로 홀드 + 매장 정산 검토/신고 + 분쟁 중재 + 차지백 클로백. ✅(차지백 클로백 제외)
- **Phase 3**: 동적 신뢰 정산 + 리뷰 플라이휠 + 이상탐지/Sybil. ⏳ 미착수

## 구현 완료
**2026-06-22~23 (대표 — "가장 이상적·안전하게")**

- **Phase 1 ✅**
  - 소비자 셀프 사용처리: `POST /api/group-buy/vouchers/:code/self-redeem` (CAS `unused→used`, 멱등) — `group-buy-public.routes.ts` (`f2d3239`).
  - 60초 취소: `POST .../cancel-redeem` (CAS `used→unused`, 60초 이내 + `settlement_id IS NULL` 가드).
  - 라이브 "사용완료" 화면: `VoucherRedeemModal.tsx` (실시간 시계·매장명·애니메이션 체크·60s 취소) + `MyVouchersPage` "현장에서 사용하기" 진입.
  - 매장 원장(읽기): `GET /api/group-buy/store-voucher-ledger` (요약 + 최근 50건, `vouchers JOIN products WHERE seller_id=?`).
- **Phase 2 ✅ (차지백 클로백 제외)**
  - 에스크로: **신규 테이블 없이** 기존 `auto-settlement` cron(used 7일 후 정산) 재사용 — `vouchers.settlement_id` 가 SSOT (`1a173ff`).
  - 분쟁 "안 왔어요": `voucher-dispute.routes.ts` — 셀러 `POST /report`·`GET /mine`, 어드민 `GET /`·`POST /:id/resolve(settle|reactivate)` (`29a14c4`).
    - ⚠️ `vouchers.status` CHECK 제약상 'disputed' 불가 → voucher.status 는 'used' 유지, **별도 `voucher_disputes` open 건을 정산 cron 에서 제외**(보류). `auto-settlement.ts` + `restaurant-settlement /calculate` 양쪽 `NOT IN (open disputes)`.
  - 경량 "내 매장"(`/my-store`): 셀러 대시보드 대신 앱 내 — 원장 요약 + 최근 공구권 + "안 왔어요" 신고 (`1832388`).
  - 어드민 분쟁 중재 화면(`/admin/voucher-disputes`) + 진입 동선(마이 '내 매장' 카드 / 어드민 공구 메뉴) (`5244289`).
  - 내 매장에 선착순 지원 현황 합치기: `GET /api/group-buy/store-fcfs`(셀러 스코프) (`6b96bd3`).
- **선착순(별도 트랙) ✅**: `fcfs.routes.ts` + `AdminFcfsPage`(`/admin/fcfs`) + 소비자 배지/지원 + 내 매장 현황.

**남은 것(후속 결정 필요)**
- Phase 2 잔여: **차지백 클로백**(PG 차지백 시 매장 정산 회수) — 미구현.
- Phase 3 전체: 동적 신뢰 정산(가변 T+N)·리뷰 플라이휠·이상탐지/Sybil — 미착수.
- ⚠️ **운영 검증(대표/staging)**: 실결제 E2E 1회 — 공구권 구매 → 현장 셀프 사용 → 7일 정산 진입 / "안 왔어요" 신고 → 정산 보류 → 어드민 해소. (현재 쇼핑/도매 외 동네딜 사용처리는 라이브 노출 전이라 영향 0)

## 🧭 최종 이상형 로드맵 (2026-06-23 — 대표 검토 후 우선순위 합의)
v1(위)은 "콜드스타트 최적 안전 v1". 아래를 채우면 최종 이상형. (대표: "이게 최종 이상형이냐?" → 아래 6개가 남은 격차)

**진행 — 코드로 막음 (대표 "나머지는 다")**
- 1️⃣ **차지백 클로백 ✅** — `voucher-settlement-clawback.ts` `clawbackVoucherSettlementOnRefund()` 신설 → `refundOrderFully`(모든 환불 경로 수렴, 확정주문 차지백은 webhook 이 거부하고 환불 API 로 강제)에 배선. 미사용/미정산 used→refunded(돈 이동 0, cron 미지급) / 미지급 정산→금액 차감+detach / 지급완료 정산→`settlement_clawbacks` 회수의무 기록+경고. **감사 부산물: "사용된 공구권 환불 시 매장 과지급" 일반 누수도 동시 차단**(refundOrderFully 가 그간 vouchers 자체를 안 건드렸음). ⏳후속: `settlement_clawbacks`(지급완료 회수의무) 어드민 회수 화면.
- 2️⃣ **양방향 분쟁 ✅** — 손님 항변권. 사장님 "안 왔어요" → **손님 알림 → 이용했어요(contest)/아직 안 갔어요(concede)**. concede=자동 재사용 복원, contest=어드민이 양쪽 보고 판단. (`b3a56e6`)
- 3️⃣ **사용 위치 증거(소프트, 게이트 X)** + 가게측 선택 확인 — self-redeem 시 GPS *기록만* → 분쟁 시 "사용 위치↔가게 거리" 증거. 하드 게이트 금지(스푸핑/실내오차). + 사용완료 화면에 "카카오맵 후기 남기기" 유도(아웃링크). ⏳ 다음.

**대표 결정 대기 — 보류 (⏰ 다시 안내할 것)**
- 4️⃣ **정산일**: 고정 7일 → 신뢰도 기반 가변 T+N(우량 즉시·신규 길게) + 신규 누적 한도. → **대표 검토 중(2026-06-23). 결정 오면 진행.** 도매 distributor_grade(GMV 임계 승급) 패턴 재활용.
- 6️⃣ **공동구매 동력**: (약)소셜 증거 "N명 구매중" / (중)친구초대 추가할인=딜포인트(상품가 고정, 정산 무영향, referral 재사용) / (강)동적가격=정산 재설계라 비권장. → **대표 검토 중(2026-06-23).**

**라이브 데이터 쌓인 후**
- 5️⃣ **리뷰→신뢰→랭킹 플라이휠** + 자생 입점. ⚠️ **카카오맵/네이버 리뷰 연동은 불가** — 공개 API 없음(Kakao Local API = 장소검색/좌표/place_url 만, 별점·후기 미제공). 스크래핑은 ToS 위반+불안정+법적리스크라 사용 안 함. **대안**: (a) place_url 로 "카카오맵 후기 보기" 아웃링크, (b) **자체 리뷰**(기존 인프라)에 딜 적립 → 우리 랭킹 가중치. 랭킹 변경은 잠긴 SSR/캐시키 영향이라 신중.
