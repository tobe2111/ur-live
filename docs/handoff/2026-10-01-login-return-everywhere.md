# 로그인 복귀를 **공식**으로 — 전수 (2026-10-01)

**[E2]** 작성·검증됨(유닛 37건 · 주입 5건 되돌려-검증 빨간불 · tsc 0). 배포 전.

대표: *"로그아웃 된 상태에서의 페이지에서 로그인을 하고 다시 그 같은 페이지로 가는 플로우는 모든
경우의 수에 적용이 되어야 할텐데 모두 되어있어? 이건 당연한 공식같은거잖아."*

---

## 1. 답 — **아니었다**

앞선 수리(#1588)는 **읽는 쪽**을 고쳤다. 그런데 **보내는 쪽**을 전수로 세어 보니:

```
로그인으로 보내는 자리  59곳
  ✅ ?returnUrl= 명시       27
  ✅ localStorage 에 적음    12   ← #1588 로 비로소 살아난 것들
  🔗 메뉴·안내 링크           6
  ❌ 복귀를 전혀 안 남김     14
```

그 **14곳**에 이런 게 있었다:

| 자리 | 왜 나쁜가 |
|---|---|
| `CheckoutPage` 배송지 | **결제 중**인 사람을 홈으로 |
| `TossWidgetPayPage` 딜 충전 | **결제 중**인 사람을 홈으로 (Toss 잠금 파일) |
| `auth-api.ts` 세션 만료 ×2 | 작업 중 끊긴 사람의 **하던 일이 통째로 사라진다** |
| `UserProfilePage`·`MyGroupBuysPage`·`AddressManagementPage`·`PointsChargePage`·`UserGroupBuyCreatePage` | 보호 페이지 바운스 |

## 2. 공식 — 셋 중 하나

1. **`loginPathFromHere()`** 로 URL 에 복귀를 실어 보낸다 ← 기본
2. 바로 앞에서 `localStorage.loginReturnUrl` 에 적는다(옛 방식, LoginPage 가 읽는다)
3. 돌아가면 **안 되는** 자리면 `login-return-ok` 주석으로 의도를 밝힌다

🔑 **1번을 기본으로 삼은 이유**: URL 에 있으면 `localStorage` 가 막힌 브라우저(사생활 보호)에서도,
다른 탭에서 로그인해도 성립한다. 2번은 그 두 경우에 조용히 실패한다.

⚠️ **`'/'` 는 복귀로 치지 않는다** — 붙이면 홈이 복귀 주소가 되어 저장값을 이긴다(#1588 결함의 마지막 고리).

## 3. 고친 것 — 13곳 + 예외 9곳 명시

**복귀를 심은 곳**: CheckoutPage · TossWidgetPayPage(🔓 대표 허가) · auth-api ×2 · UserProfilePage ·
MyGroupBuysPage · AddressManagementPage · PointsChargePage · UserGroupBuyCreatePage ·
AccountDeleteWarningPage(진입) · RestoreAccountModal

**`login-return-ok` 로 의도를 밝힌 곳**: 탈퇴 **직후** · 카카오 로그인 **실패** 후 재시도 ×2 ·
가입 완료 후 · 가입 화면의 "로그인" 링크 · 소개 랜딩 CTA · 가입 선택 화면 · `src/client` 옛 레이아웃 ×2
(**참조 0인 죽은 코드** — 실측).

## 4. 🔓 Toss 잠금 파일 1건 (대표 허가 "그 한 줄만 고치기")

`TossWidgetPayPage.tsx` — `navigate('/login')` → `navigate(loginPathFromHere())` + import 1줄.
위젯이 뜨기 **전**, 비로그인일 때만 타는 분기라 결제 경로와 무관하다.
**잠긴 계약 전부 byte-불변(grep 대조 전후 동일)**: `requestPayment`(3) · `widgets(`(3) · `setAmount`(5) ·
`safePaymentReturnPath`(5) · `STEP_TIMEOUT_MS`(2) · SDK 마운트 id ×2 · `USER_CANCEL`(1).
✅ CLAUDE.md Toss audit log 에 `[UNLOCK]` 기재 완료(머지 `b1f30603` 뒤 후속 커밋 — 잠긴 계약 8종 grep 카운트 전후 동일 기록 포함).

## 5. 가드 — 전수 + 자기 자신

`login-return-everywhere-2026-10-01.test.ts` 13건. `git ls-files` 로 트리를 훑어 **모든 진입점을 다시
세고**, 복귀 없는 자리가 하나라도 있으면 파일·줄까지 찍어 빨간불. 결제·세션 6개 파일은 따로 못 박는다.

🩸 **작성 중 배운 것 셋**:
1. 고친 자리는 `/login` 리터럴이 사라져 **검사 대상에서 빠졌다** — 고칠수록 가드가 눈머는 구조였다.
   `loginPathFromHere(` 도 진입점으로 세도록 고쳤다.
2. **래칫은 스스로 느슨해지는 걸 못 막는다** — "예외 ≤10" 상한을 올리는 주입은 원리상 빨간불이 안 난다.
   그래서 **그 숫자 자체를 소스에서 읽어** 앵커했다.
3. 주입 앵커가 **2곳에 매치**되어 두 번 거부당했다(`check-guard-mutations` 가 유일성을 요구한다).

⚠️ 이 가드가 **못** 보는 것: 변수로 조립한 경로 · 서버 리다이렉트 · 로그인 **후** 실제 이동
(그건 `login-return-url` 시험과 라이브 판정) · 대시보드 로그인(별도 흐름).

## 6. 배포 후 판정 (E4)

로그아웃 상태에서 **결제 경로**로 확인한다(가장 값이 큰 자리):
`/checkout` 배송지 · `/points/charge` → 로그인 유도 → 카카오 → **그 화면으로 돌아오는지**.
브라우저 없이도 판정 가능: `/auth/kakao/start?redirect=` 에 그 경로가 실리는지(#1588 때 쓴 방법).
