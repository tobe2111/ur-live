# 2026-11-04 에이전시 '인증 전' 을 어드민이 직접 승인

대표: *"에이전시 가입 중에 이메일 인증이 있는데 지금 안돼. 다른 방법 없을까?"* → 안 셋(카카오 가입 안내 / 어드민 승인 / 문자 인증) 중 *"2번. 그리고 아인종합기획 바로 열어줘"*.
레일: 공구 서비스(운영자 SaaS) · 에이전시 계정. 머니 경로 없음. 롤백: revert.

## 진단 (라이브 실측, 메인 D1 읽기)
- 11-04 10:35·10:40(KST) 가입 2건(`아인종합기획` agency 3 / `ㅇㅇㅇ` agency 4 — 대표 테스트로 보임) — 둘 다 `agency_tokens(kind=verify).used_at` NULL.
- `email_failures` 최근 14일 0행 ⇒ 서버는 SENS 에 넘겼고 거절도 없었다. **받은편지함에 안 닿은 것**(둘 다 naver.com — 스팸함 의심). 배달 여부는 여기서 못 본다.

## 완료
- `POST /api/admin/agency-accounts/:id/approve`(super·ops) — `/verify` 와 같은 두 줄(계정·주인 직원 pending→active, CAS) + 남은 verify 토큰 삭제. 정지·이용 중은 409.
- 어드민 `/admin/agencies` '인증 전' 줄에 [승인] 버튼.
- 가드 `agency-admin-approve-2026-11-04.test.ts` 6건(진짜 SQLite·실제 라우트·실제 로그인) + 주입 3건 빨간불 확인(정지 해제 우회 · 직원 미활성 · cs 역할 허용).

## 이어받는 세션의 첫 액션
배포 뒤 아인종합기획(agency_accounts.id=3) 승인 → `SELECT status FROM agency_accounts WHERE id=3` 가 active, `agency_staff` id 3 active.

## 틀렸던 판단
- 시험의 로그인 호출이 처음엔 code 없이 실패했다 — 로그인 레이트리밋이 저장소 없으면 429 로 닫힌다(코드는 맞다, `rate_limit_attempts` 표를 깔아 해결).

## 남은 것
- 메일 배달 자체(네이버 스팸함) 원인은 미규명. 대표 메일함 스팸함 확인이 판정 근거.
