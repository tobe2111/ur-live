/**
 * 🛡️ 2026-05-22: guide-seed.ts (2012줄) 분할 — admin 섹션.
 *   본 파일만 수정하면 어드민 가이드 default content 변경됨 (DB 비었을 때만 적용).
 */

import type { SeedSection } from './guide-seed-types'

export const ADMIN_SEED: SeedSection[] = [
  {
    key: 'overview', icon: '📘', title: '서비스 개요', order: 10,
    content: `**유어딜(ur-live)** 은 한국 시장 라이브 커머스 플랫폼입니다. 4개 역할이 상호작용합니다.

### 역할 정의
- **유저(구매자)** — 홈/쇼츠/라이브 시청, 장바구니·결제, 후원(donation)
- **셀러** — 상품 등록, 라이브 방송, 정산 요청, 번들·공동구매·타임딜 생성
- **에이전시** — 셀러 모집·관리, 수수료 수익, 성과 비교
- **관리자(운영팀)** — 승인·정산·모더레이션·지표 모니터링

### 기술 스택
\`Cloudflare Pages + Workers + D1 + R2 + KV + Durable Objects\`. 프론트는 React + Vite, 모바일은 Capacitor 래핑.

### 수익 모델
상품 판매 플랫폼 수수료(기본 5%, 셀러별 조정 가능) + 후원/기부 수수료(15%) + 알림톡 발송비 + 에이전시 수수료.`,
  },
  {
    key: 'daily', icon: '✅', title: '일일 운영 체크리스트', order: 20,
    content: `### 매일 아침 (09:00 권장)
1. **대시보드** → 어제 매출·주문·신규 가입자 확인
2. **셀러 승인** → 대기중 신청 처리 (영업일 기준 24h 이내)
3. **정산** → REQUESTED 상태 신청 검토 및 처리 (3~5 영업일 내 입금)
4. **샘플 신청** → 에이전시에서 셀러에게 보낸 샘플 요청 승인
5. **리뷰 모더레이션** → 신고된 리뷰 확인·숨김 처리
6. **감사 로그** → 전날 관리자 행동 리뷰 (이상 행동 탐지)

### 매일 저녁 (18:00 권장)
1. **라이브 모니터** → 저녁 방송 진행 중 셀러 현황, 신고된 채팅 확인
2. **KV 모니터링** → 캐시 히트율, 레이트 리밋 카운터 점검
3. **주문 이상치** → 동일 유저 다중 주문, 비정상 고액 주문 검토

> ⚠️ **주말/공휴일 주의**: 정산 처리는 영업일 기준. 주말 신청은 월요일 처리. 라이브 방송은 주말에 더 활발 → 모니터링 강화.`,
  },
  {
    key: 'seller-ops', icon: '🏪', title: '셀러 관리', order: 30,
    content: `### 승인 프로세스 (\`/admin/seller-approval\`)
- 셀러 가입 → **status: pending** 상태로 대기
- 관리자가 사업자번호, 계좌, 신분증 검증 → **approved** / **rejected**
- 거부 시 반드시 사유 기입 → 셀러에게 브랜드메시지 자동 발송

### 수수료율 조정
- 라이브 판매 기본 5% (\`platform_settings.commission_rate_default\`) — 대형 셀러 / 전략 파트너는 협상에 따라 더 낮춤 가능
- 식사권 기본 5% (\`commission_rate_meal_voucher\`)
- 후원 수수료 기본 15% (\`commission_rate_donation\`) — 인플루언서 셀러는 10% 까지 조정
- 변경 시 감사 로그에 자동 기록됨 (롤백 가능)

### 정지 처분
- 허위 광고 / 지속적 배송 지연 / 부적절 콘텐츠 → **suspended**
- 정지 시 해당 셀러의 active 라이브는 즉시 종료
- 대기 주문은 관리자가 판단 (셀러 정지되어도 주문 처리 가능)

> 🚨 **주의**: 셀러 삭제는 불가(소프트 삭제만). 사업자번호는 변경 불가 — 변경 필요 시 계정 새로 생성.`,
  },
  {
    key: 'seller-tier-admin', icon: '🎖️', title: '셀러 등급제 운영 (2026-05-05)', order: 35,
    content: `### 5단계 자동 등급화 (매주 월요일 02:00 KST 실행)
| 등급 | 수수료 | 노출 가중치 | 최소 score |
|---|---|---|---|
| 💎 다이아몬드 | 3% | 4.0× | 85 |
| ⭐ 골드 | 4% | 2.5× | 70 |
| 🥈 실버 | 5% | 1.5× | 50 |
| 🥉 브론즈 | 5% | 1.0× | 25 |
| 🆕 신규 | 5% | 0.7× | — |

**Score 산정**: GMV(35%) + CVR(20%) + 후원(15%) + 재구매율(15%) + 환불 안전성(10%) + 어뷰징 클린(5%)

**변경 이력**: \`seller_tier_history\` 테이블. 셀러 대시보드에서 본인 등급 확인 가능 (\`/api/seller/tier\`).

### 🚨 어뷰징 탐지 (매시간 자동, \`/admin/abuse\`)
- **donation_spike**: z-score > 3 (baseline 대비 후원 폭증)
- **repeat_donor_24h**: 같은 buyer가 24h 내 ≥3건 후원
- **new_account_donation_pattern**: 신규 가입자(1일 미만) 후원 비율 ≥50%
- **rapid_signups_same_ip**: 동일 IP 24h ≥5명 가입
- HIGH severity → admin dashboard_notifications + \`/admin/abuse\` 즉시 검토 필요

### 광고 슬롯 입찰 (\`/admin/ad-slots\`)
매일 18시 최고 입찰자 낙찰. 5개 슬롯 (메인 hero, 카테고리 top, 라이브 추천 1/2/3). 낙찰 후 셀러가 결제 완료하면 24시간 우선 노출 적용.`,
  },
  {
    key: 'agency-ops', icon: '🤝', title: '에이전시 관리', order: 40,
    content: `**에이전시 = 여러 셀러를 대표하는 중개 조직**. 관리자 페이지: \`/admin/agencies\`

### 가입 플로우
- 에이전시 자체 가입 → **status: pending** → 관리자 승인 필요
- 승인 후 에이전시는 \`/seller/register?agency=<id>\` 링크로 셀러 초대 가능
- 초대로 가입한 셀러는 **agency_id** 가 자동 연결 → 에이전시 수수료 적용

### 수수료 구조
- 기본 2% (에이전시가 유치한 셀러의 매출에서 플랫폼 수수료와 별도)
- 플랫폼 수익 = 총매출 × 10%
- 에이전시 수익 = 총매출 × 2%
- 셀러 수익 = 총매출 × 88%

### 🛡️ 셀러 심사 워크플로우 (2026-04-26 추가)
- 에이전시가 \`POST /api/agency/invite-seller\` 로 셀러 초대 시 **status='pending'** 으로 생성됨
- \`agency_creator_approvals\` 테이블에 심사 대기 row 생성
- 어드민이 \`/admin/agency-creator-approvals\` 에서 검증 후 승인/반려
- 승인 → sellers.status='approved', is_active=1 → 로그인/판매 가능
- 반려 → sellers.status='rejected', is_active=0 → 비활성, 사유 기록

**API:**
- \`GET /api/admin/agency-creator-approvals?status=pending\` — 심사 대기 목록
- \`POST /api/admin/agency-creator-approvals/:id/approve\`
- \`POST /api/admin/agency-creator-approvals/:id/reject\` — body: { reason }

### 계약 변경
\`/admin/agencies\` → 에이전시 상세 → 수수료율 수정. 변경 이력은 감사 로그에 기록.

### 🤖 신규 셀러 자동 매칭 (2026-05-05)
- 매일 18시 배치가 가입 60일 이내 무소속 셀러를 자동으로 에이전시에 매칭 제안
- 에이전시는 \`/agency/match-suggestions\` 에서 수락/거절
- 수락 즉시 \`agency_sellers\` 에 추가, 셀러에게 알림 발송`,
  },
  {
    key: 'orders', icon: '📦', title: '주문 관리', order: 50,
    content: `### 주문 상태 흐름
\`\`\`
PENDING → PAID → SHIPPING → DELIVERED → DONE
              ↓
       CANCELLED / REFUNDED
\`\`\`

### 상태 정의
- **PENDING**: 결제 대기. 24시간 경과 시 cron 이 자동 취소
- **PAID**: 결제 완료 — 셀러가 배송 처리 대기
- **SHIPPING**: 운송장 등록 완료, 배송 중
- **DELIVERED**: 배송 완료 — 14일 후 cron 이 자동 **DONE** 처리 (구매확정)
- **DONE**: 구매확정 — 셀러 정산 가능 상태
- **CANCELLED**: 결제 전/후 취소
- **REFUNDED**: 환불 완료 (부분 환불 포함)

### 관리자 개입 시나리오
1. 셀러가 배송 지연 사유 없이 3일 이상 미처리 → 셀러에게 알림 발송
2. 유저가 환불 요청했으나 셀러 무응답 → 관리자 직권으로 환불 처리
3. 결제 시스템 오류로 결제는 되었으나 주문 미생성 → \`/admin/orders\` 에서 수동 재생성

> ⚠️ Toss 결제 취소는 **7일 이내**만 자동 처리 가능. 그 이후는 수동 송금 환불.`,
  },
  {
    key: 'settlement', icon: '💰', title: '정산 처리', order: 60,
    content: `### 정산 프로세스 (\`/admin/settlement\`)
1. 셀러가 정산 신청 → 상태 **REQUESTED**
2. 관리자 검토 → 승인 시 **APPROVED** 상태로 전환
3. 실제 송금 완료 시 **PAID** 로 변경 — 이체 증빙 업로드
4. 문제 있으면 **REJECTED** + 사유 기입 → 셀러에게 알림

### 일괄 처리 (\`/admin/settlements-bulk\`)
- 매주 수요일 일괄 정산 권장 — CSV 다운로드 → 은행 일괄이체 → 완료 후 업로드
- 금액 = 총매출 − 플랫폼 수수료(10%) − 에이전시 수수료(2%) − 환불액 − 배송비 정산

### 정산 검증 포인트
- DONE 상태 주문만 집계됨 (구매확정 14일 경과)
- 환불된 주문은 자동 차감
- 셀러 크레딧 잔액(알림톡 선구매 등)은 별도 회계

> 🚨 **주의**: 정산 완료(PAID) 후 수정 불가. 오류 발견 시 다음 정산분에서 조정.`,
  },
  {
    key: 'live', icon: '🔴', title: '라이브 방송 운영', order: 70,
    content: `### 실시간 모니터링 (\`/admin/live-monitor\`)
- 현재 방송 중(status=live) 스트림 목록 + 시청자 수 실시간 표시
- 각 스트림 클릭 시 채팅/구매 흐름 확인 가능
- YouTube 채널 연동 상태, RTMP 연결 상태 점검

### 방송 중 개입 권한
- 채팅 메시지 **숨김** — 욕설/스팸/광고 메시지 제거
- 방송 **강제 종료** — 정책 위반 시 (허위 광고, 성희롱 등)
- 셀러 **일시 정지** — 재발 시 계정 정지

### 방송 지표
- **시청자 수** (current_viewers) — 90초 heartbeat 기반, 실제 활성 세션
- **피크 시청자** (peak_viewers) — 방송 중 최대 동시 접속
- **총 뷰** (total_viewers) — 중복 제거된 유니크 시청자
- **채팅 수, 주문 수, 후원액** — 참여도 지표

### 플래시세일/타임딜 모니터링
- 허위 할인율(원가 부풀리기) 감지 → 상품 비활성화
- 재고 0인 상품으로 타임딜 생성 → 시스템이 자동 차단하나 추가 점검

### 셀러 페인 포인트 (지원 시 참고)
- **YouTube 토큰 만료**: 7일마다 refresh_token 무효화 (Google OAuth 테스트 모드 한계). 셀러는 채널 카드에 "만료" 뱃지 + [재연동] 버튼으로 해결 가능. 근본 해결 = Google 심사 통과
- **Quick Start / YouTube Studio 사용 시**: 자동으로 Studio 새 탭이 열림. 팝업 차단 시 [다시 열기] 링크 안내
- **첫 OBS 사용 시**: RTMP URL/Key를 OBS에 한 번 입력해야 함. 다음 방송부터는 "✓ 저장됨" 표시되어 자동 사용

> ⚠️ **방송 30분 미활동** 시 cron 이 자동 종료. 셀러가 재방송 원하면 새 스트림 생성 필요.`,
  },
  {
    key: 'moderation', icon: '🛡️', title: '콘텐츠 모더레이션', order: 80,
    content: `### 리뷰 모더레이션 (\`/admin/review-moderation\`)
- 신고된 리뷰 우선 처리 — 혐오/욕설/허위 내용은 **숨김** 처리
- 가짜 리뷰 감지: 동일 IP 다중 작성, 비슷한 문구 반복 → 일괄 숨김
- 관리자가 직접 리뷰 생성 가능(테스트용) — 실제 운영에서는 지양

### 채팅 모더레이션
- 셀러가 1차 모더레이션 담당 (본인 방송 메시지 삭제 가능)
- 관리자는 모든 방송의 채팅에 개입 가능
- 반복 위반 유저는 **채팅 금지** (admin만 설정 가능)

### 리플레이(다시보기) 관리 (\`/admin/replay\`)
- 종료된 방송은 다시보기로 자동 저장
- 문제 있는 방송은 **숨김** 처리 (삭제 대신 권장)

> 🚨 **법적 리스크 콘텐츠** (의료기기 허위광고, 청소년 유해물 등) 발견 시 즉시 숨김 + 법무팀 보고.`,
  },
  {
    key: 'metrics', icon: '📊', title: '핵심 지표 모니터링', order: 90,
    content: `### 매출 분석 (\`/admin/revenue\`)
- **GMV (총거래액)** — 일/주/월 추이 확인, 목표 대비 달성률
- **카테고리별 매출** — 어떤 카테고리가 성장/하락 중인지
- **TOP 셀러** — 상위 10명 매출 집중도 (파레토 원칙 확인)
- **TOP 상품** — 베스트셀러 + 시즌 트렌드

### 유저 지표
- **DAU/WAU/MAU** — 활성 유저 추이
- **신규 가입자** — 마케팅 채널별 유입 분석
- **재구매율** — 한 번 구매한 유저가 다시 구매하는 비율 (중요!)
- **이탈률** — 30일 무접속 유저 비율

### 라이브 지표
- **방송당 평균 시청 시간** — 참여도
- **시청→구매 전환율** — 라이브 커머스의 핵심 지표
- **채팅/시청자 비율** — 몰입도

### 경보 임계치 (Alert)
- 일 매출 전주 대비 **-30% 이상** 하락 → 원인 조사 (결제 장애? 인기 셀러 이탈?)
- 에러율 **1% 초과** → Sentry 로그 확인, 긴급 배포 검토
- 결제 실패율 **5% 초과** → Toss 장애 확인, 대체 결제 안내

💡 **KPI 대시보드**는 주간 회의에서 함께 리뷰합니다. 이상치는 즉시 Slack 알림 설정.`,
  },
  {
    key: 'promo', icon: '🎯', title: '프로모션/마케팅', order: 100,
    content: `### 쿠폰 관리 (\`/admin/coupons\`)
- 신규 가입 쿠폰 — 자동 발급, 7일 유효
- 시즌 쿠폰 — 관리자 수동 생성 (할인율, 최소 주문액, 사용 기간)
- 셀러 전용 쿠폰 — 특정 셀러 상품에만 적용 가능

### 배너 관리 (\`/admin/banners\`)
- 홈 상단 배너 — 최대 5개 슬라이드, 주기적 업데이트
- 카테고리별 배너 — 쇼핑 페이지 상단
- 클릭률(CTR) 모니터링 — 3% 미만 배너는 교체

### 브랜드메시지 (알림톡, \`/admin/alimtalk\`)
- 주문 확인, 배송 시작, 라이브 시작 알림 — 자동 발송
- 마케팅 메시지 — 셀러가 크레딧 구매 후 본인 팔로워에게 발송
- 요금: 건당 25원 (기본 패키지 100건 2,500원)

### 공동구매/타임딜 승인
- 셀러가 자율 생성하나 허위 가격 감지 시 관리자가 중단 가능
- 원가 대비 90% 이상 할인 → 자동 플래그 → 관리자 검토 필요

### 공동구매 모니터링 (\`/admin/group-buy\`) — 2026-05-15 추가
- **모니터링 탭**: 진행중/달성/마감/취소/⚠️미달성 필터로 voucher 카테고리 (식사·뷰티·헬스·펫·숙박·액티비티) 전체 조회
- **분석 탭**: 카테고리별 달성률 / 매출 Top 10 / 일별 추이 (최근 30일)
- 자동 환불 cron (5분 주기, \`scheduled-cleanup\`) 이 \`group_buy_status='expired'\` + \`current<target\` 인 상품의 미사용 voucher 를 자동 환불 + 셀러 알림톡 발송
- **강제 환불** 버튼: 분쟁/긴급 케이스에 어드민이 status 무관하게 직접 환불 (사유 필수, audit_logs 기록)
- 환불 처리: 미사용 voucher → refunded, 딜 결제건 → 자동 환불, 상품 → cancelled, 참여자/셀러에게 푸시

### 공동구매 — 2026-05-15 이상적 구현 완료
1. **전용 detail page** (\`/group-buy/:id\`): 카운트다운, 티어 시각화, 참여자 아바타, KakaoLink share
2. **티어 할인** (\`group_buy_tiers\` JSON): 단계별 할인 자동 적용, voucher 마다 적용가 기록
3. **마일스톤 푸시** (50/80/lastone): interest_list 등록자에게 hot 알림 (atomic CAS dedup)
4. **이메일 영수증**: Resend 로 voucher 코드 + 매장 정보 + 티어 할인 발송
5. **동적 OG 이미지** (\`/api/og/group-buy/:id\`): KakaoLink/Twitter share 시 1200x630 SVG (진행률 포함)
6. **JSON-LD Product/Offer/BreadcrumbList**: Google rich result 노출
7. **VoucherMap**: MyVouchersPage 에 카카오 멀티 마커 지도 (미사용 식사권 위치)
8. **엣지 가드**: voucher_expiry < deadline 차단, 진행 중 공구 상품 삭제 차단

💡 신규 프로모션 기획 전에 과거 지표(쿠폰 사용률, 배너 CTR) 확인 → 효과적이지 않은 방식 반복 방지.`,
  },
  {
    key: 'incident', icon: '🚨', title: '기술 장애 대응', order: 110,
    content: `### 🔴 유저 대량 로그인 실패
1. Cloudflare Dashboard → Workers/Pages → ur-live → Logs
2. JWT_SECRET 환경변수 누락 여부 확인 (2026-04-22 사고 선례)
3. Kakao 로그인이면 Kakao 콘솔에서 앱 키 유효성 확인
4. 해결 안되면 이전 배포로 롤백: \`wrangler pages deployment list\`

### 🔴 결제 실패 급증
1. Toss 페이먼츠 상태 페이지 확인 (\`status.tosspayments.com\`)
2. Toss SDK 키 만료/변경 여부 (Cloudflare Secret)
3. Webhook 수신 여부 확인 — \`/api/webhooks/toss\` 로그

### 🔴 라이브 방송 끊김
1. Durable Object 상태 확인 — Cloudflare Dashboard
2. YouTube API 쿼터 초과 여부 (일일 10,000 units 기본)
3. 셀러의 RTMP 송출 측 문제면 OBS 재시작 안내

### 🟡 특정 기능 에러 (500)
1. Sentry 로그에서 에러 스택 확인
2. D1 컬럼 누락이면 \`/api/_internal/repair-schema\` 호출 (관리자 인증)
3. Worker 재배포 — GitHub Actions → main 브랜치 push

### 배포 롤백
Cloudflare Dashboard → Pages → Deployments → 이전 버전 "Rollback"

> 🚨 **금지 사항**: 운영 중 \`wrangler deploy\` 사용 금지 (이 프로젝트는 Pages, Workers 아님). \`wrangler pages deploy\` 만 사용.`,
  },
  {
    key: 'legal', icon: '⚖️', title: '법적 준수 / 보안', order: 120,
    content: `### 한국 전자상거래법
- 통신판매업 신고번호 — 셀러 공개 프로필에 표시 의무 (자동 표시됨)
- 청약철회 7일 — 환불 가능 기간 법정 준수
- 표시·광고 공정화법 — 허위·과장 광고 감지 시 즉시 조치

### 개인정보 보호법 (PIPA)
- 셀러 phone/email은 공개 프로필에 노출 금지 (이미 API에서 마스킹됨)
- 구매자 닉네임 자동 마스킹 (예: 정종문 → 정*문)
- 회원 탈퇴 시 개인정보 30일 내 완전 삭제 (자동 cron)
- 주문 관련 데이터는 5년 보관 의무 (법적 요건)

### 보안 체크
- **관리자 계정**: 2FA 필수 설정 (TOTP), 비밀번호 90일 변경
- **감사 로그**: 모든 관리자 행동 자동 기록, 수정/삭제 불가
- **세션 타임아웃**: 관리자 30분 무활동 시 자동 로그아웃
- **API 키 rotation**: 분기별 JWT_SECRET, DB 크레덴셜 교체

> ⚠️ **개인정보 유출 의심 시**: 즉시 관리자 계정 잠금 → 감사 로그 확인 → 유출 범위 파악 → 72시간 내 KISA 신고 의무.`,
  },
  {
    key: 'support', icon: '💬', title: '고객 문의 응대', order: 130,
    content: `### 📦 배송 문의
- 운송장 번호 제공 시 → 택배사 추적 링크 안내
- 3일 이상 미출고 → 셀러에게 알림 + 구매자에게 예상일 안내
- 분실/파손 → 셀러와 3자 연결, 필요 시 관리자 직권 환불

### 💳 결제/환불 문의
- 결제는 됐는데 주문 미생성 → \`/admin/orders\` 에서 수동 생성
- 이중 결제 → Toss 콘솔에서 확인 후 한 건 수동 취소
- 7일 초과 환불 요청 → 수동 이체 후 주문 REFUNDED 처리

### 🏪 셀러 문의
- 가입 승인 지연 → 24h 이내 처리 원칙
- 정산 이체 지연 → 은행 이체일 확인, 영업일 5일 초과 시 재전송
- 상품 등록 거부 → 거부 사유 명확히 안내 (허위 정보, 카테고리 부적합 등)

### 🔴 이슈 에스컬레이션
- 법적 문제(사기, 명예훼손) → 법무팀 즉시 전달
- 보안 사고(계정 탈취, 개인정보 유출) → CTO + CEO 즉시 보고
- 대량 환불 요청(10건↑) → CS 팀장 + 영업팀 협의

💡 응답 목표: 일반 문의 24시간, 결제/배송 4시간, 긴급(분쟁) 1시간 내.`,
  },
  {
    key: 'deploy', icon: '🚀', title: '배포 절차', order: 140,
    content: `### 배포 구조
- **Cloudflare Pages** 프로젝트 \`ur-live\`
- 커스텀 도메인: \`live.ur-team.com\`
- 자동 배포: feature 브랜치 → main 머지 시 GitHub Actions 가 Pages 에 배포

### 배포 명령
\`\`\`bash
# 로컬에서 수동 배포 (비상시에만)
npm run build
npx wrangler@3 pages deploy dist/client --project-name=ur-live
\`\`\`

### 배포 전 체크리스트
1. \`bash scripts/quality-check.sh\` — 13개 항목 검증
2. \`npm test\` — 999+ 테스트 통과 확인
3. \`npm run build\` — 빌드 성공 (client + worker 통합)
4. GitHub Actions 녹색 확인 후 main 머지

### DB 스키마 변경
- migration 파일 작성 (\`migrations/0XXX_add_feature.sql\`)
- \`repair-schema\` 엔드포인트에 ALTER/CREATE 추가 (임시 조치)
- 배포 후 관리자가 curl 로 \`/api/_internal/repair-schema\` 호출

> 🚨 **절대 금지**: main 에 직접 push, pre-commit 훅 \`--no-verify\`, 프로덕션 D1 에서 \`DROP TABLE\` 수동 실행.`,
  },
  {
    key: 'faq', icon: '❓', title: '자주 묻는 문제 (FAQ)', order: 150,
    content: `**Q. 셀러가 "로그인이 안 돼요" 라고 하면?**
1) localStorage 초기화 안내 2) 비밀번호 재설정 링크 발송 3) 계정 상태 확인 (status=suspended 여부)

**Q. 주문은 생성됐는데 셀러에게 안 보입니다**
seller_id 매칭 확인. 관리자가 수동으로 \`/admin/orders\` 에서 seller_id 수정 가능.

**Q. 라이브 시청자 수가 부정확합니다**
current_viewers 는 120초 heartbeat 기반. peak_viewers 는 방송 중 누적 최대값. manual_viewer_count 가 설정돼 있으면 그 값이 우선 표시됨.

**Q. 후원/팁 금액이 맞지 않습니다**
donations 테이블에서 payment_status='approved' 만 집계. 수수료(15%) 차감 후 셀러에게 정산됨. refunded 상태는 제외.

**Q. 브랜드메시지(알림톡)가 발송 안 됩니다**
셀러 크레딧 잔액 확인 (\`seller_credits\` 테이블). 부족하면 충전 필요. Aligo API 상태도 확인.

**Q. 환불 처리 후 유저가 "안 들어왔다"고 합니다**
카드 결제는 3~5 영업일 소요 (카드사 영업일 기준). 포인트/적립금은 즉시. Toss 콘솔에서 환불 이력 확인 가능.

**Q. 특정 셀러가 다른 셀러 상품 복사한다고 신고 들어왔어요**
이미지/설명 유사도 확인 → 원본 셀러에게 증빙 요청 → 허위 판매자 경고 → 반복 시 정지.`,
  },
  {
    key: 'voucher-categories-admin', icon: '🎫', title: '공구권 3종 운영 (식사·뷰티·헬스)', order: 600,
    content: `### 공구권 카테고리 enum

\`products.category\` 컬럼에 다음 3종 값:
- \`meal_voucher\` — 식사 공구권 (맛집)
- \`beauty_voucher\` — 뷰티 공구권 (헤어·네일·피부) NEW
- \`health_voucher\` — 헬스 공구권 (PT·요가·필라테스) NEW

같은 \`products\` 테이블 + \`vouchers\` 테이블 인프라 재활용. 셀러 등록 폼에서 카테고리 선택만 다름.

### 운영 시 주의
- 새 카테고리 추가 시 \`src/shared/constants/index.ts\` 의 \`VOUCHER_CATEGORIES\` 갱신
- SQL 쿼리는 항상 \`category IN ('meal_voucher','beauty_voucher','health_voucher')\` 형태로 — 단일 enum 하드코딩 금지
- \`/restaurant-map\` 에서 카테고리 칩으로 필터, API: \`GET /api/group-buy/products?category=...\`

### 모니터링 포인트
- 카테고리별 등록 상품 수 (\`SELECT category, COUNT(*) FROM products GROUP BY category\`)
- 카테고리별 GMV (월 단위)
- 빈 카테고리 (등록 0건) 가 오래되면 카테고리 삭제 검토`,
  },
  {
    key: 'consignment-admin', icon: '🤝', title: 'MD 위탁 판매 운영', order: 650,
    content: `### MD 위탁 판매 시스템

테이블: \`consignment_partnerships\` + \`consignment_settlements\` (감사 로그) + \`order_items.consignment_id\`.

#### 어드민 입장에서 관리할 것
- 분쟁 발생 시 \`consignment_settlements\` 테이블의 분배 기록 조회 (host_amount/owner_amount/platform_amount/rate_snapshot)
- 비정상 수수료율 (50% 초과는 DB CHECK 제약으로 차단) 모니터링
- \`pending\` 상태로 30일 이상 방치된 파트너십 → cron 으로 자동 expire 검토

#### 분배 정책 (변경 시 lib/consignment-split.ts 와 일관성 유지)
1. \`platform_amount = floor(total * 10%)\`
2. \`net = total - platform_amount\`
3. \`host_amount = floor(net * host_rate%)\`
4. \`owner_amount = net - host_amount\` (잔돈은 owner 보호)
5. **합계 = total\` 보장**

#### 정산 자동화 통합 (후속)
- 현재는 별도 헬퍼 (\`getConsignmentSettlementsForSeller\`) 만 존재 — 어드민이 조회 가능
- 정식 자동 분배는 settlement-automation 의 calculateSellerSettlement 통합 필요`,
  },
  {
    key: 'gift-admin', icon: '🎁', title: '선물하기 운영', order: 700,
    content: `### 선물하기 시스템

테이블: \`gifts\` (sender + recipient + product + claim_token + status 머신).

#### 상태 머신
\`pending → paid → claimed → shipped → delivered\`

\`expired\` (30일 미수령) / \`refunded\` (terminal) 도 가능.

#### 어드민이 신경 쓸 것
- **만료 처리** — \`paid\` 상태에서 30일 지나면 \`expired\` 자동 전환 + 환불 처리 cron 필요
- **발송 처리** — 셀러가 \`claimed → shipped\` 전환. shipping address 는 \`gifts.claim_address\` (orders 의 shipping_address 가 아님)
- **알림톡 발송 실패** — \`POST /api/gifts/:id/confirm\` 에서 best-effort 호출. 실패 시 sender 에게 안내 + 재발송 endpoint 필요
- **분쟁** — recipient 가 못 받았다 신고 시 \`gifts.status\` + \`alimtalk_messages\` (수신 로그) 조회

#### 알림톡 템플릿
- \`gift_received\` 템플릿 등록 필요 (Aligo 콘솔)
- 변수: \`#{sender_name}\`, \`#{product_name}\`, \`#{claim_url}\`
- \`gift_refunded\` 템플릿 — sender 에게 30일 미수령 환불 알림 (cron 자동 발송)`,
  },
  {
    key: 'business-monitoring', icon: '📊', title: '비즈니스 모니터링 (gift + consignment)', order: 750,
    content: `### 운영 통계 API

\`/api/admin/business-monitoring/*\` — 어드민 전용 모니터링 endpoint.

#### GET /gift-stats
- \`by_status\` — 상태별 건수 (pending/paid/claimed/shipped/delivered/expired/refunded)
- \`expired_no_payment_key\` — 환불 자동화 못 돌아가는 케이스 (이상 신호, 0 이어야 정상)
- \`refund_failure_recent_24h\` — expired 인 채로 24시간 머문 건 (cron 환불 호출 실패)
- \`pending_24h_overdue\` — pending 24시간 초과 (cron 21번 미작동)
- \`paid_unclaimed_15d\` — paid 후 15일 미수령 (만료 임박)
- \`total_30d\`, \`total_revenue_30d\` — 30일 누적

#### GET /consignment-stats
- \`pending_30d_overdue\` — cron 22번 자동 정리 안 됨 (이상 신호)
- \`active_no_orders_30d\` — 활성이지만 30일 무주문 (협업 비활성)
- \`settlements_recorded_30d\` + \`settlements_total_amount_30d\` — 정산 기록량
- \`distribution_anomalies\` — host + owner + platform != total 인 행 수 (있으면 안됨, 0 정상)

### Cron 자동화 흐름 (scheduled-cleanup.ts, 5분 주기)
1. **#20**: gifts paid + expires_at 경과 → expired
2. **#20-b**: expired + toss_payment_key 보유 → 토스 cancel API → refunded + sender 알림톡
3. **#21**: gifts pending + 24시간 → refunded (결제 미완료)
4. **#22**: consignment_partnerships pending + 30일 → ended
5. **#23**: 당월 consignment 주문 → consignment_settlements 자동 INSERT (멱등)

### 알림 trigger 권장
- expired_no_payment_key > 0 → 즉시 점검 (토스 키 누락 데이터 무결성 문제)
- distribution_anomalies > 0 → 즉시 점검 (분배 식 버그 가능성)
- refund_failure_recent_24h > 5 → 토스 API 장애 의심`,
  },
  {
    key: 'i18n-pc-layout', icon: '🌐', title: '다국어 + PC 레이아웃 운영 (2026-05-03)', order: 800,
    content: `### 6개 언어 다국어 (i18n)

지원 언어: 한국어 / 영어 / 일본어 / 중국어 / 스페인어 / 프랑스어
- 사용자가 본인 언어를 선택하면 \`/account/settings\` "언어 설정" 에서 변경 가능
- 기본은 시스템 언어 자동 감지

다국어 적용 페이지 (사용자 노출 30+):
- 홈 / 라이브 목록 / 쇼핑 / 상품 상세 / 장바구니 / 결제 / 주문내역
- 마이페이지 / 위시리스트 / 쿠폰 / 식사권 / 리뷰 작성 / 공동구매
- 알림 / 검색 / 배송지 관리 / 계정 설정 / 약관 / 환불정책
- 회원 탈퇴 / 선물 받기 / 제휴 마케팅

**한국 시장 전용 (다국어 미적용)**:
- PaymentFailPage — Toss Payments 한국 에러 코드 맵
- IntroducePage / RegisterPage / FAQPage — 한국 마케팅/약관/Q&A
- AccountDeleteWarningPage 동의 항목 — 개인정보 보호법

### 운영자 액션
- **번역 누락 신고**: \`scripts/check-i18n-sync.mjs\` 로 6언어 비대칭 검증
- **신규 페이지 i18n**: \`public/locales/{ko,en,ja,zh,es,fr}/translation.json\` 6개 모두 동시 추가 필수
- **네임스페이스 규칙**: \`<page>.<key>\` (예: \`mainHome.title\`, \`browse.categoryAll\`)

### PC 레이아웃 시스템

**콘텐츠 폭 토큰** (src/index.css):
- \`ur-content-narrow\` (720px) — form / 결제 / 가입
- \`ur-content-medium\` (1024px) — 마이페이지 / 약관
- \`ur-content-wide\` (1280px) — 쇼핑 / 상품 그리드
- \`ur-content-full\` (1536px) — 어드민·셀러 대시보드

**PC 사이드바 패턴** (xl 1280px+):
- 좌측: \`DesktopLiveSidebar\` (224px) — 추천/탐색/팔로잉/라이브/쇼핑/검색/프로필
- 중앙: \`ur-content-*\` 토큰
- 우측 (라이브/쇼츠만, 2xl 1536px+): \`DesktopLiveRightPanel\` (280px) — 핫딜/맛집/친구초대

**제외 페이지** (HIDE_SIDEBAR_PREFIXES):
- /seller, /admin, /agency — 자체 대시보드 레이아웃
- /embed — iframe 임베드
- /checkout/return — 토스 콜백 (간섭 방지)
- /introduce — 랜딩 (FrameWrapper)

### 테마 토글 (모든 페이지 적용)

**위치**: \`/account/settings\` "화면 테마" 섹션 — 시스템/라이트/다크 3-way

**구현**: \`html\` 태그에 \`.dark\` class 토글 + \`src/index.css\` 글로벌 override.
- 다크 모드: 기존 \`bg-[#020202]\` / \`text-white\` 등 그대로
- 라이트 모드: \`html:not(.dark)\` selector 가 hardcoded 다크 색상을 light 로 invert
- 셀러/어드민/에이전시 대시보드는 토글 무영향 (강제 화이트 유지)

**사고 사례 / 운영 노트**:
- 컬러 버튼 (bg-pink/red/blue/gradient) 위 흰 텍스트는 라이트 모드에서도 유지 (invisible 방지 안전장치)
- 사용자가 "테마 변경 안 됨" 신고 시: \`/account/settings\` 토글 클릭 후 페이지 새로고침 권장 (드물게 캐시 fail)`,
  },
  {
    key: 'admin-finance-safety-2026-05', icon: '💰', title: '재무 정합성 자동 검증 (2026-05 신규)', order: 220,
    content: `### Ledger 정합성 cron (\`ledger-reconcile\`)

매일 18:00 (KST) 자동 실행 (\`scheduled.ts\` 등록):

검증 항목:
1. \`Σ debit - Σ credit\` 차이 (모든 계정 합) — 1원 이상 차이 시 alert
2. \`user:*\` 계정 중 잔액 음수 (절대 발생 X) — 1개+ 시 alert

### Discord webhook alert
- \`DISCORD_WEBHOOK_URL\` 시크릿 설정 시 자동 발송
- 알림 받으면 즉시 조치 (수십 분 내 잔액 mismatch 누적되면 환불 분쟁 폭증)

### 수동 점검 SQL
\`\`\`sql
-- 전체 imbalance 확인
WITH per_account AS (
  SELECT debit_account AS account, -SUM(amount) AS net FROM ledger_entries GROUP BY debit_account
  UNION ALL
  SELECT credit_account AS account, SUM(amount) AS net FROM ledger_entries GROUP BY credit_account
)
SELECT SUM(net) AS total_should_be_zero FROM per_account;

-- 음수 wallet 확인
WITH per_account AS (...)
SELECT account, SUM(net) FROM per_account
WHERE account LIKE 'user:%' GROUP BY account HAVING SUM(net) < 0;
\`\`\`

### Partial-refund ledger 통합 (TD-G05)
- \`group-buy-voucher.routes.ts /voucher/:code/partial-refund\` 가 자동으로 reverse entry 기록
- 셀러 receivable 차감 + 유저 wallet 환불 양쪽 모두 \`ledger_entries\` 에 반영`,
  },
  {
    key: 'admin-2fa-sensitive-2026-05', icon: '🔐', title: '2FA 필수 endpoint (sensitive action 보호)', order: 225,
    content: `### \`require2FA()\` 미들웨어 적용 위치 (2026-05 신규)

다음 endpoint 는 어드민 2FA 활성 시 totp 헤더 검증 필수:
- \`POST /api/disputes/admin/:id/approve\` — 분쟁 환불 승인
- \`POST /api/disputes/admin/:id/reject\` — 분쟁 거절
- \`POST /api/group-buy/admin/force-refund/:productId\` — 공구 강제 환불

### 2FA 설정 방법
1. \`/admin/profile\` → 2FA 활성화
2. Google Authenticator / 1Password 등에 QR 등록
3. 위 sensitive endpoint 호출 시 \`X-TOTP-Code: 123456\` 헤더 자동 전송 (UI 가 처리)

### 2FA 없는 어드민
- 미설정 어드민도 위 endpoint 호출은 가능 (호환성)
- 단 audit_logs 에 \`2fa_skipped: true\` 기록
- 정책적으론 모든 어드민 2FA 설정 권장`,
  },
  {
    key: 'admin-ad-slot-auto-push-2026-05', icon: '📣', title: '광고 슬롯 자동 push (2026-05 신규)', order: 230,
    content: `### 동작 원리
1. 셀러가 \`/seller/ad-slots\` 에서 광고 슬롯 입찰
2. 매일 18시 cron (\`ad-slots-award\`) 가 최고가 낙찰 + \`ad_slots.current_seller_id\` 갱신
3. **자동 효과**: 메인 라이브 리스트 (\`/api/streams\`) 쿼리가 EXISTS 서브쿼리로 활성 슬롯 보유 셀러를 status priority 다음 우선순위로 자동 상단 노출

### 모니터링
- \`/admin/ad-slots\` 페이지에서 현재 낙찰자 + 24시간 expires_at 확인
- 입찰 없으면 자동 slot reset → 다음 24시간 다시 오픈

### 부정 사용 방지
- 한 셀러가 여러 슬롯 동시 보유 가능 (정책상 허용)
- EXISTS 서브쿼리 사용 → row 중복 없음`,
  },
  {
    key: 'kt-alpha-admin', icon: '🎁', title: 'KT Alpha (기프티쇼) 운영 — 비사업자 셀러 정산', order: 235,
    content: `### 무엇을 하는 시스템인가?
**비사업자 셀러**(개인) 가 정산받을 적립금으로 **KT Alpha 기프티쇼 교환권**(스타벅스/CU/배민/올리브영 등) 을 받게 해주는 우회 정산. 사업자등록 없이도 셀러 활동 가능.

**왜 필요?** 사업자등록 없는 개인은 세무 신고 의무 부담이 큼. 8.8% 원천징수 후 교환권으로 지급하면 법적 부담 없이 정산 완료.

### 관리자 페이지
- \`/admin/kt-alpha\` — 설정 + 비즈머니 잔액 + 카탈로그 미리보기
- 핵심 설정:
  - **마진율 (markup_pct)** — 원가 + N% 가산해서 셀러에게 차감 (기본 5%)
  - **dev_flag** — 'Y' (테스트 발송, 차감 없음) / 'N' (실제 발송)
  - **user_id** — KT Alpha 콘솔 사용자 ID (0301 잔액 조회에 필요)
  - **callback_no** — 발송 시 MMS 발신번호

### 비즈머니 잔액 모니터링
- cron (UTC 03:00 = KST 12:00) 매일 0301 호출 → 잔액 저장
- 10만 원 이하 시 \`admin_dashboard_notifications\` 자동 알림 (24h 중복 방지)
- **잔액 0 시 즉시 발송 차단** — 잔액 확인 후 KT Alpha 콘솔에서 충전

### 상품 카탈로그 sync (cron)
- 매일 UTC 03:00 → \`runKtAlphaCatalogSync\` (\`src/worker/cron/kt-alpha-catalog-sync.ts\`)
- 0101 listGoods 전체 페이지 (최대 50페이지 = 5000개) UPSERT to \`gift_catalog\`
- 더 이상 SALE 아닌 상품은 \`is_active=0\` 처리
- 수동 sync: \`/admin/kt-alpha\` 'Sync 지금 실행' 버튼

### 발송 실패 시
- \`/api/seller/voucher-redeem\` 에서 \`sendCoupon\` 실패 시 자동 재시도 없음 → 셀러에게 즉시 에러 표시
- 발송 후 환불은 \`cancelCoupon\` (0202) — 24시간 이내만 가능
- 발송 이력: \`voucher_orders\` 테이블

### 운영 액션 우선순위
1. 매일 09:00 \`/admin/kt-alpha\` 접속 → 비즈머니 잔액 확인
2. 카탈로그 sync 실패 시 (sync_at > 24h) 수동 실행
3. 셀러 voucher 발송 실패율 > 5% 시 KT Alpha 콘솔에서 상태 확인`,
  },
  {
    key: 'stay-voucher-admin', icon: '🏨', title: '숙소 바우처 공동구매 운영 (2026-05)', order: 240,
    content: `### 시스템 개요
숙소 공동구매에 **3가지 sale_mode** 지원:
- **'date'** — 기존 방식 (특정 체크인/아웃 날짜)
- **'voucher'** — 날짜 없이 구매 → 나중에 셀러에게 예약 요청 (유효기간 내)
- **'both'** — 두 방식 모두 활성

### 어드민 액션
- \`/admin/stay-bookings\` — 모든 숙소 예약 (date + voucher) 통합 조회
- 셀러 사업자등록증 검증: \`/admin/seller-business-verify\`
  - 미검증 셀러는 숙소 등록 시 \`pending\` 상태 (소비자 노출 안 됨)

### 바우처 환불 처리
- 결제 후 7일 이내 미사용 + 셀러 동의 시 환불 가능
- cron (UTC 18:00) \`refund-expired-vouchers\` 가 자동 처리
- 환불 사유 코드: \`VOUCHER_EXPIRED\`, \`SELLER_CANCELLED\`, \`USER_REQUESTED\`

### 8.8% 원천징수 (비사업자)
- 비사업자 셀러 정산 시 자동 차감 (소득세 8% + 지방세 0.8%)
- 매년 1월 \`/admin/withholding-report\` 에서 지급조서 CSV 다운로드 → 국세청 홈택스 업로드`,
  },
  // 🛡️ 2026-05-21: 추천 commission 출금 승인 (2026-05-21 신규)
  {
    key: 'commission-withdrawals-admin', icon: '💸', title: '추천 Commission 출금 승인', order: 165,
    content: `**페이지**: \`/admin/commission-withdrawals\`

3단계 추천 commission 의 출금 신청을 처리하는 어드민 페이지.

### 흐름
1. 사용자/셀러/에이전시가 \`/my-commissions\` 에서 **출금 신청** 클릭
2. 계좌 정보 입력 → \`commission_withdrawals\` row 생성 (status=pending)
3. 연관된 \`referral_commissions\` 의 status: \`granted\` → \`withdrawal_requested\`
4. 어드민이 이 페이지에서 신청 검토 → **송금완료** OR **거절** 선택

### 송금완료 처리
1. 어드민이 본인 은행 앱에서 실제 송금 (계좌번호 / 예금주 확인)
2. 페이지에서 **[송금완료]** 버튼 클릭 + 메모 (선택)
3. \`commission_withdrawals.status = approved\`
4. \`referral_commissions.status = paid_out\`, \`paid_out_at\` 기록

### 거절 처리
- **반드시** 거절 사유 입력 (계좌번호 오류, 본인 인증 실패 등)
- \`referral_commissions\` status 가 \`granted\` 로 자동 복원 → 사용자가 다시 신청 가능

### 최소 출금 금액
- **₩10,000** (코드: \`MIN_WITHDRAWAL_AMOUNT\` in referral-tree.routes.ts)
- 이하 잔액은 출금 버튼 자체가 비활성화

### 관련 API
- \`GET /api/referral-tree/admin/withdrawals?status=pending|approved|rejected|all\`
- \`PATCH /api/referral-tree/admin/withdrawals/:id/approve\` (admin_memo 선택)
- \`PATCH /api/referral-tree/admin/withdrawals/:id/reject\` (rejection_reason 필수)`,
  },
]
