# 규칙·검사 정리 목록 (2026-11-17)

대표 지시: 서버 관리 점검 후 *"2번부터"* = 늘어난 규칙·검사 중 겹치거나 안 쓰이는 것 정리.
서비스: 레포 운영(전 서비스 공통) · 머니 경로 접촉 없음.

## 실측
- 검사 스크립트 `scripts/check-*` 162개(타입 선언 `.d.mts` 9개 포함). CI(verify.yml)에서 120회 호출, 그중 경고만 내는 단계 7개.
- 어디에서도 실행되지 않는 검사: **`check-react-version.cjs` 1개**(옛 preinstall 훅, `archive/` 문서만 참조).

## 이번에 고친 것 (CLAUDE.md, 코드와 어긋난 줄)
| 줄 | 낡은 내용 | 실측 |
|---|---|---|
| 🔐 인증 | 유저 = Firebase Auth | 2026-07-28 Firebase 인증 수단 제외(`check-no-firebase-auth`) |
| 💰 딜 | 충전 1원=1딜 | `TOPUP_DISABLED = true`(2026-07-18 종료) |
| 🚀 자동 배포 | PostToolUse 훅이 main 자동 머지 | 훅 연결 안 됨(SessionStart 만). 실제는 PR → auto-merge |
| 🎨 다크 테마 | `bg-[#020202]` | 쓰는 페이지 0개, 색 SSOT 는 디자인 시스템 절 |

## 대표 판단이 필요한 정리 후보 (아직 손대지 않음)
1. **`scripts/auto-merge-main.sh` 삭제** — 연결 안 됨 + 손으로 돌리면 PR·CI 를 건너뛰고 main 에 넣는다(위험만 남음).
2. **`scripts/check-react-version.cjs` 삭제** — 아무 데서도 안 돈다.
3. **도매 전용 검사 4개 축소/삭제** — 도매몰 2026-10-11 철거. 지금 스캔 대상이 거의 없다:
   `check-wholesale-admin-nav-reachability`(화면 3) · `check-wholesale-admin-api-scope`(화면 1) ·
   `check-wholesale-order-status`(쓰는 곳 2) · `check-seller-wholesale-redirect`.
   ⚠️ 삭제하면 안 되는 것: `check-consumer-product-supply-isolation`(공유 products 테이블 격리 — 여전히 소비자 보호) ·
   `check-wholesale-cache-auth-leak`(supply 라우트 8파일이 남아 있음 — 공구 서비스 몰 인프라).
   도매 어드민 역할 `wholesale` 자체가 `admin-roles.ts` 에 남아 있어, 역할을 지우는 결정과 함께 가야 한다.

## 이번에 틀렸던 판단
- 전체 감사 게이트를 `timeout 200` 으로 돌렸더니 바깥 스크립트만 끝나고 **`check-guard-mutations` 가 계속 살아서
  소스 파일에 시험용 결함을 넣었다 뺐다 반복**했다. 첫 `kill` 로 안 죽었는데 확인 안 하고 "정리됨"으로 보고했다.
  ⇒ 감사 게이트에 timeout 을 걸지 말 것. 멈췄으면 `pgrep -fl guard-mutations` 로 0 확인 후 `git checkout -- src/`.

## 이어받는 세션의 첫 액션
대표가 위 1~3 중 고른 번호만 실행. 3번은 `wholesale-teardown-2026-10-11.test.ts` 가 지키는 범위를 먼저 읽고 시작.
