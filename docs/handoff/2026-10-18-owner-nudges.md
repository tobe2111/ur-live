# 2026-10-18 — 자동 안내 셋 (④ 일일 리포트 수리 · ⑤ 후기 요청 · ⑥ 서류 보완)

대표 *"일단 4,5,6번 하자"*. 셋 다 **밖으로 나가는 메시지**라 게이트 기본 OFF — 대표가
`/admin/platform-settings` 에서 하나씩 켠다(등급 C). 머니 경로 무접촉. 매일 growth 배치(18:40 UTC = 03:40 KST).

## 완료분
- ④ `cron/seller-daily-report.ts` 재작성 — **한 통도 나간 적 없던** 원인 5개 수리(동의 0명 · approved 누락 ·
  ISO↔D1 시각 비교 · 월말 32일 · 내용이 영구중단 라이브). 게이트 `seller_daily_report_enabled`
  (켜면 승인 매장 전원, `seller_meta.daily_report_opt_out='1'` 제외 / 끄면 옛 개별 동의만). 활동 0 인 날 미발송.
- ⑤ `cron/review-request.ts` — 24~48시간 전 사용, 유료, 데모 아님, 후기 없음, 미요청 이용권에 앱 알림 1건.
  게이트 `review_request_enabled`. 이용권당 1회(`notifications.type='review_request_'||id`).
- ⑥ `cron/seller-docs-nudge.ts` — 사업자 심사 pending + 빠진 서류(번호·대표자명·개업일·등록증)에
  가입 3일째·7일째 각 1회 대시보드 알림 + 메일. 게이트 `seller_docs_nudge_enabled`. 기록은 seller_meta.
- 공용 `worker/utils/owner-nudges.ts`. 게이트 3개 OPS_GATES + 검증 + 어드민 편집 + STAGING_CHECKLIST `S-NUDGES`.
- 가드 `owner-nudges-2026-10-18.test.ts`(실제 SQLite) + 주입 6건 전부 빨간불 확인.

## 다음 세션의 첫 액션
- 대표가 하나라도 켰다면 다음 날 하트비트/알림으로 판정: 어드민 `GET /api/admin/cron-heartbeats` 의
  `growth-daily-batch` 가 ok 인지 + (후기) `notifications` 에 `review_request_%` 행, (서류) 대기 매장 seller_meta `docs_nudge_count`.

## 이번에 틀렸던 판단
- 가드 첫 판이 `status IN ('approved','active')` 를 파일 전체에서 찾아, 게이트 OFF 분기의 같은 문장에 걸려
  게이트 ON 분기를 망가뜨려도 통과했다(주입이 잡음) → ON 분기(`? \``)로 앵커.

## 남은 결정
- 세 게이트 켜기(대표). 서류 안내는 카카오 알림톡 없이 대시보드 알림+메일뿐 — 사장님이 대시보드를 안 열고
  메일도 없으면 못 본다(대기 매장 4곳의 이메일 보유 여부는 켜기 전 어드민에서 확인).
