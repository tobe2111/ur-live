# 2026-10-18 — 운영 점검 후속 3건

## 1. 미발송 주문 KPI (수정 · 이 PR)
어드민 대시보드 '미발송 주문 6' 중 4건이 이용권 주문(GB-*, 배송 없음)이었다. KPI 쿼리에
`NO_SHIPPING_ITEM_EXCLUDE`(deal_only=1 또는 voucher 카테고리 품목이 있는 주문 제외) 추가.
남는 2건은 2026-03-31 쇼핑 주문(id 69 · 1,331,000원 / id 70 · 48,000원, DONE) — 대표 확인 필요(테스트 흔적인지).
가드: `src/tests/unit/admin-unshipped-kpi-2026-10-18.test.ts`.

## 2. 멈춘 예약작업 표시 (조치 불필요)
d1-backup·__tick·agency-*·group-buy-deadline-push 는 이미 `superseded/retired` 로 분류돼
`/api/_healthcheck/cron` ok:true · stale [] · 어드민 화면은 회색 '유령' 표시. 잔여: orphan lane `ads:weekly-report`.

## 3. 새로고침 반복(boot-stuck) 조사 (코드 결함 근거 없음)
7일 boot-stuck 83건 중 79건이 같은 UA(Windows Chrome/148)의 버스트였고 URL 이
`/zzqqxx/p/abc`·`/vouchers%27`·`/pass/2919`·`/u/jiwon1228` 등 **점검·탐침 주소**다.
문서마다 t≈200~500ms 로 연달아 찍혀 가상 시간(virtual-time) 자동화로 보인다 —
재시도 예산은 Date.now 기준이라 사람 브라우저에선 5분 8회 상한이 작동한다. 실사용자(안드로이드) 4건은 산발.

## cron 실패 일괄 정리 (PR #1903 머지·배포됨)
dry-run 실측: blocked:* <2026-10-15 **501** · ads:* error <2026-10-08 **587**(그중 enrich-company 172) ·
deploy critical <2026-10-14 **10**. 실제 반영(dry_run:false)은 세션 권한 정책에 막혀 미실행 — 대표 허락 대기.
