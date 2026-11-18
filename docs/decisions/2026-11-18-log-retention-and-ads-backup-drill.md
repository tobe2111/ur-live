# 쌓이기만 하는 기록 표를 오래된 것부터 지울까요, 그리고 유어애즈 DB 복구 연습을 만들까요?

상태: open
등급: C
역할: dev
올린 날: 2026-11-18
기한: 2026-11-25

## 질문
1) 아래 기록 표를 "N일 지난 것부터 자동 삭제" 할지, 표마다 보관 기간을 골라 주세요. 2) 유어애즈 DB 2개 복구 연습을 매주 돌릴지.

## 근거 (실측·코드)
- 삭제(DELETE)하는 코드가 **어디에도 없는** 표: `audit_logs`(감사 미들웨어가 30개 경로에서 요청마다 기록) · `search_logs`(검색 1번에 1행, 2주 984행) ·
  `referral_clicks` · `ad_autobid_log` · `ad_rank_snapshots` · `ad_daily_metrics` · `dashboard_sessions` · `alimtalk_logs` ·
  `alimtalk_dispatch_log` · `bulk_email_log` · `admin_login_history` · `moderation_log` · `digital_download_logs` ·
  `shipping_tracking_events` · `supply_price_history` · `ledger_integrity_log` · `admin_audit_logs`/`admin_audit_log`.
- 메인 DB 는 지금 57.6MB(한도 10GB)라 당장 급하지 않다. 사람이 몰리면 `audit_logs`·`search_logs` 가 가장 빨리 큰다.
- 백업: 주간 GitHub 백업(`d1-backup.yml`)과 복구 연습(`d1-restore-drill.yml`)은 **메인 DB 만** 다룬다. 유어애즈 리드 DB(1.25GB)·업체 DB(424MB)는
  서버 분할 백업(`d1-backup-chunked.ts`, R2)에만 있고 **복구해 본 적이 없다**.

## 선택지
1. **기록 표 정리 — 권장 기간으로 자동 삭제**: 검색·클릭·광고 스냅샷·알림톡 발송 기록 90일 · 대시보드 세션 30일 · 로그인 이력 1년 ·
   **감사·원장 무결성·관리자 감사 기록은 삭제 안 함**(회계·분쟁 증빙). 매일 청소 cron 에 넣는다. 머니 접촉 없음.
2. **기록 표 정리 — 지금은 안 함**: 크기가 문제 될 때(1GB 넘으면) 다시 본다.
3. **유어애즈 DB 복구 연습 추가**: 매주 R2 분할 백업을 임시 DB 에 되살려 행 수를 대조하는 워크플로. 1회 읽기 비용은 DB 크기만큼(주 1회).

## 기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않는다)
1번 + 3번. 삭제는 되돌릴 수 없어서 표마다 기간을 먼저 정해 두는 것이 안전하고, 복구해 본 적 없는 백업은 백업이라고 부르기 어렵다.

## 롤백
1번: 청소 항목 revert(이미 지운 행은 되돌릴 수 없다 — 주간 백업에서만 복구). 3번: 워크플로 삭제.

## 결정 (대표가 한 말 그대로)

## 반영 커밋
