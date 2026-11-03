# 2026-11-03 정산 구조 확정 — 토스 지급대행(꺼 둠) · 정산 달력 · 월간 명세서 · 대외 문구

결재: `docs/decisions/2026-11-03-settlement-structure.md` (대표 말 그대로 기록)

## 1. 이 작업을 이어서 하라고 했을 때의 첫 액션
- 대표가 토스 지급대행 계약을 마쳤다고 하면:
  1. Cloudflare Pages 시크릿 `TOSS_PAYOUT_SECRET_KEY`·`TOSS_PAYOUT_SECURITY_KEY` 등록(대표가 대시보드에서 — 세션은 env 쓰기 안 함)
  2. 토스 개발자센터 웹훅에 `https://urdeal.kr/api/webhooks/toss-payouts` 등록(payout.changed)
  3. staging 에서 `docs/STAGING_CHECKLIST.md` **S-TOSSPAYOUT-1~8** → 통과 후 대표가 `platform_settings.toss_payouts_enabled=true`
  4. 판정: `GET /api/admin/payouts/toss/status` 가 `enabled:true` + 잔액을 돌려주면 연결된 것.
- 월 정산일 첫 회차: **2026-11-10 04:00 KST** cron `influencer-payout` 로그에 `statements=N agency_queued=N` 이 찍혀야 한다(다른 날은 `queue=wait_for_payout_day`).

## 2. 완료분
- 커미션 월 정산일 SSOT `src/shared/commission-payout-day.ts`(기본 10, `commission_payout_day` 1~28)
- 인플루언서 cron: 성숙은 매일, 지급 대기 알림은 정산일만 · 같은 날 에이전시 자동 신청(`autoRequestAgencyPayouts`) · 매장 월간 명세서(`store-monthly-statement.ts`, UNIQUE(seller_id, period))
- 인플루언서 정산 화면 "다음 지급일", 에이전시 정산 시트 "매월 10일" 안내(서버 값)
- 토스 지급대행 `src/worker/utils/toss-payouts.ts` + 어드민 `POST /api/admin/payouts/:id/toss` + 웹훅 + [토스로 보내기] 버튼(꺼져 있으면 안 보임). JWE 는 jose 와 양방향 교차 검증.
- 대외 문구: 랜딩 FAQ(매장 매주 목요일 · 커미션 매월 10일), 덱 FACTS(`influencerPayoutDay` 10일 · `storePayoutDay`), 덱 문장 3곳, 인플루언서 약관, 사업계획서, 셀러·어드민 가이드(GUIDE_SEED_VERSION 58), 플랫폼 모델 §5-2
- 가드: `commission-payout-day-2026-11-03.test.ts`(21) · `toss-payouts-2026-11-03.test.ts`(17) · 주입 5건 전부 빨간불 확인

## 3. 이번에 틀렸던 판단
- 처음엔 "지급대행이 의무"라고 말했다 → 정정: 의무는 *남의 돈을 맡아 정산하면 등록·예치*이고 지급대행은 그걸 피하는 방법 중 하나.
- "소개비는 매장이 직접 지급하게 두고 명세서만" 이라고 계획했는데, 코드를 보니 **소개비·중개사 몫은 지금도 유어딜이 정산금에서 떼어 대신 보낸다**. 명세서는 그 사실대로 "유어딜이 대신 지급"으로 적는다.
- 덱 PDF 는 매일 자동 빌드(`proposals.yml`)라 PDF 를 다시 뽑아 커밋하지 않았다(README 규칙).

## 4. 남은 결정/대기
- 토스 지급대행 계약·요금·고정 IP 대안(대표 → 토스 문의)
- 소개비·중개사 몫(매장 돈) 흐름을 지급대행에 함께 태울지 / 매장 직접 지급으로 바꿀지 — 법무 확인
- 인플루언서 약관 변경(매월 1일 → 10일) 사전 고지 여부 — 약관이 "초안" 표기라 현재는 문구만 바꿨다
- 세금계산서 역발행(매입 전제) 장치를 중개 구조(유어딜 → 매장 수수료 세금계산서)로 바로잡는 일
