# 2026-08-20 — 셀러 대시보드 V2 1차 구현 (대표 일괄 지시 "빠짐없이 모두 + 최종 판정")

**브랜치**: `claude/agency-dashboard-review-iqbv5u` (PR #1181 위에 계속)
**설계 SSOT**: `docs/design/seller-dashboard-v2.md` — **대표 지시 전체가 여기 박제돼 있다. 새 세션은 이 문서 먼저.**

## 1. 다음 세션의 첫 액션
1. **PR #1181 CI 판정** — 이 커밋이 Verify green 인지. 파일크기 래칫은 이번에 구조 분리(NAV 추출·guide-seed 분할)로 풀었다. `[SKIP_SIZE]` 는 CI 에서 안 통한다(2회 실증).
2. **배포 후 라이브 판정** (401 폭풍 해소 확인):
   - 셀러 대시보드 두 브라우저 동시 로그인 → 서로 안 끊기는지 (멀티세션)
   - `/api/seller/pin-status` 200 (seller_meta 이전) · `/api/seller/gb/support-contact` 200 · 운영 가이드 로딩
   - `/api/seller/my-stores` · `/api/seller/influencers/list`(ADS_DB) · `/api/seller/fee-context`
3. **대표에게 필요한 것**: ① `PUBLIC_DATA_SERVICE_KEY`(data.go.kr, 국세청) Pages env 등록 — 없으면 매장 등록이 전부 pending ② `influencer_contact_fee_krw` 단가 결정 ③ §4.4 정산 모델(원천 분배 권장) 승인

## 2. 완료분 (이 커밋)
- CI 래칫: SellerLayout NAV→`seller-nav.ts` 추출(622→490) · guide-seed-seller 분할(`-ops.ts`) · worker 주석 압축
- 멀티 로그인: `SINGLE_SESSION_ROLES` 에서 seller/seller_operator 제외 (admin·supplier·agency·도매직원은 유지)
- 명칭: 미니샵→링크샵 설정 · 반품→환불 요청 (6개 언어) · 대시보드 컴팩트(목표 카드 제거·여백 축소)
- 버그: streams 404 호출 제거 · support-contact 경로(`/api/seller/gb/`) · **PIN→seller_meta**(sellers 100컬럼 한도로 ALTER 무음실패→500, 라이브 실측 확증) · 가이드 부제 라이브 문구
- 수수료 최종: fee-resolver `storeChannel`(직접10/중개5, 미지정=5 폴백) + 테스트 5건 + `fee_platform_pct_3p_direct`
- 신규: `/seller/stores`(카카오맵 등록·국세청 검증·채널·삭제·위임) · `/seller/influencers`(ADS_DB 탐색·제안 접수→어드민 벨) · 실수령가 카드 · 소비자 이용권 환불 요청 · about STEP 스트립 · AI 자동입력 제거

## 3. 이번에 틀렸던/조심할 판단
1. **컨테이너 재프로비저닝으로 미푸시 작업이 통째로 소실**됐었다(이전 턴들의 산출물이 로컬에만 있었음). → 큰 지시는 **먼저 설계 문서로 박제하고 커밋**한 뒤 구현할 것.
2. VoucherTicket 삼항식 안에 형제 JSX 를 넣어 파서가 깨졌다 — 삽입 편집 후 반드시 tsc.
3. ADS_DB 리스트에서 연락처는 **SELECT 목록에서 원천 배제**했다 — "응답에서 지운다"가 아니라 "쿼리에 없다"가 가드다.
4. 국세청 `ntsCheckStatus` 는 **배열 입출력**이고 validate 의 valid 는 `'01'|'02'` 문자열 — 시그니처 확인 없이 boolean 으로 짰다가 tsc 가 잡았다.

## 4. 남은 결정/작업 → 설계 문서 §9 로드맵 참조
