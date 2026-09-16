# 2026-09-07 — 운영(ops) 역할 신설 + 1인 운영 결재 3건 (대표 "모두 진행")

[E2] 역할 파일·결재 항목·SSOT 갱신 · 테스트 통과 · 코드 변경 0 · 머니 경로 무접촉.

## 대표 지시 (그대로)
*"지금 구현된 이 유어딜의 시스템적인 부분에서 더욱 운영을 체계적으로 하거나 자동화할 수 있는 부분을 전반적으로 찾거나
1인 운영이 가능하게끔 하도록 하려면? 지금 형태의 팀원 구성으로 두면 돼?"* → 제안 후 *"모두 진행"*.

## 실측 (2026-09-07)
- 어드민 수동 처리 엔드포인트 **58개**(approve/reject/paid/sent/publish/resolve/refund/payout) · 어드민 페이지 126 · cron 62
- 라이브 큐 전부 0: 셀러 승인 대기 0(승인 1) · payouts 0 · 환불 대기 0 · 30일 알림 0 · 총 주문 88 · 유저 17
- **사업자번호 진위확인 API 연동 없음**(grep 0)
- 판정: 팀 6개는 전부 *판정* 역할이고 *큐를 비우는* 역할이 없었다 → `ops` 추가. 큐 0 이라 큐 자동화는 게이트 OFF 규칙으로만. 진짜 병목은 매장 확보.

## 완료분
- `.claude/agents/ops.md` (읽을 SSOT·결정권·큐 목록·SLA 48h·금지·완료 판정)
- 결재 3건(open · 기본안 포함 · 기한 09-14): `docs/decisions/2026-09-07-store-acquisition-pipeline.md` · `-seller-auto-approval.md` · `-payout-auto-approve-threshold.md`
- 운영 SSOT §3 역할 7 · §6 운영 일일 큐 루틴 행 · "1인 운영의 원칙" 문단 · CLAUDE.md 역할 목록 · 테스트 ROLES 7 · design README
- Routine `[ops] 운영 일일 큐 08:15 KST`(ID 는 아래)

## 다음 세션의 첫 액션
1. 결재 3건에 대표 답이 왔는지 → 한 말 그대로 `결정` 에 옮기고 approved. 실행기가 집는다(정산 임계는 머니 경로 → PR 까지, 켜기는 staging 뒤 대표).
2. 실행기(승인 결재 실행기) 재시도 결과 `docs/handoff/2026-09-07-exec-retry.md`(브랜치 `claude/exec-retry-2026-09-07`) — fresh-session 루틴이 푸시를 못 하는 구조인지 판정. 못 하면 루틴을 세션 바인딩으로 전환하거나 대표가 UI 에서 push 허용.

## 이번에 틀렸던 판단
- 첫 grep 이 `(app|router)\.` 패턴이라 수동 엔드포인트 **0개**로 나왔다 — 이 레포는 `route.post(` 등 다른 변수명을 쓴다. 패턴을 `\.(post|patch|put)\(` 로 넓혀 58개. **0 이 나오면 검사기부터 의심할 것**(이 레포의 반복 교훈).

## 루틴
| 이름 | 주기 | ID |
|---|---|---|
| [ops] 운영 일일 큐 | 매일 08:15 KST | `trig_01ULiAeDrjKC4Vu4T6jp9ywX` |
