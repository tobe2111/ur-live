# 2026-10-18 — 고객센터 주소가 반송되던 것 수리 + 운영 자동화 점검

## 무엇이 문제였나 (라이브 실측)
- 사이트·메일 하단의 **support@ur-team.com(11곳) · contact@ur-team.com(7곳)** 은 ur-team.com 메일 서버
  (aspmx.daum.net, 다음 스마트워크)에 **없는 계정** — 테스트 메일이 `550 5.1.1 No such user` 로 반송.
  고객 문의가 전부 반송되고 있었고 우리 쪽엔 에러가 안 남았다. `jiwon@ur-team.com` 은 정상 수신(대표 확인).
- 대표 결정: **"지메일로 바로 교체"** → `urteam.corp@gmail.com` (AI 운영팀이 읽는 메일함).

## 한 것
- SSOT `src/shared/support-contact.ts` (`SUPPORT_EMAIL`) + 표기 7파일 + 6개 언어 `faq.supportEmailValue`.
- 가드 `src/tests/unit/support-email-alive-2026-10-18.test.ts` (죽은 주소 재유입 차단, 되돌려-검증 빨간불 확인).
- 매일 점검 예약 작업(trig_018aDshduBrqGnMYLWBthjpq)을 **기술 오류 대응 + 고객응대** 통합, 매일 10:07 KST.
  기술 쪽은 커넥터 없이 어드민 API + GitHub 이슈(`ops-daily`)로 보고, 비-머니 소규모 수정은 PR + auto-merge.

## 같이 확인된 사실
- DISCORD_WEBHOOK_URL **설정돼 있음** — 오류 알림은 디스코드로 간다(누가 그 채널을 보는지는 미확인).
- 시스템 메일(SENS)은 **지금 정상 발송**(mail-test-send 성공). 10-12 실패 144건은 그 전 설정 누락분.
- 그런데 매일 07:00 요약(ops_daily_digest)은 벨엔 생성되는데 **urteam.corp@gmail.com 에 한 통도 없음**(스팸함 포함).
  → 다음 세션 첫 액션: 대표 카카오메일(tobe2111@kakao.com)에 10-18 12시대 "[유어딜] 메일 발송 시험" 도착 여부 확인.
  카카오엔 오고 지메일엔 안 오면 urdeal.kr SPF/DKIM/DMARC 또는 Gmail 거절 문제.

## 틀렸던 판단
- 이전 세션이 "디스코드 웹훅 미설정 가능성"이라 보고 — env-readiness 실측으로 **설정돼 있음**이 맞다.
