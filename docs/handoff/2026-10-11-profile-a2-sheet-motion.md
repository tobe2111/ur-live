# 프로필 편집 A-2 + 시트가 올라온다 〔2026-10-11〕

대표 지시 두 개를 한 PR 로 처리했다.
1. *"오른쪽 버튼 눌렀을 때 또 설정할 것들 없어?"* → 시안 A-1/A-2/A-3 제시 → **"A-2로 하되"**
2. *"이렇게 올라오는 경우 부드럽게 올라올 수 있나?"* → 시트 등장 동작

## 1) 무엇이 문제였나 — 빠진 게 아니라 **갈려 있었다**

세어 보니 프로필에서 못 고치는 설정은 없었다. 대신 **이름이 두 곳**이었다:

| | 프로필 편집(모달) | 유어샵 관리 |
|---|---|---|
| 사진 | ✓ | |
| **이름** | **✓** | **✓** ← 같은 값, 다른 화면 |
| 전화번호 | ✓ | |
| 소개 · 내 주소 · SNS | | ✓ |

그리고 두 곳이 **다른 엔드포인트**를 썼다. 모달은 `PATCH /api/auth/profile`, 유어샵 관리는
`PATCH /api/curator/me/profile`. 둘 다 `users.name` 을 쓰지만 **후자만 공개 유어샵 엣지 캐시를
purge 한다** ⇒ 모달에서 이름을 바꾸면 본인 화면은 즉시 바뀌고 **남들에겐 한동안 옛 이름**이 떴다.
에러가 없어 아무도 신고하지 않는 종류다. A-2 로 합치면서 고쳤다(전부 `curator/me/profile` 경유).

## 2) 한 일

- **신규** `src/pages/user-profile/profile-edit/ProfileEditSheet.tsx` — 줄 목록(🎫 표면 규칙 ⑦ 안 C).
  사진 + `내 정보`(이름 · 한 줄 소개 · 전화번호) + `내 가게 주소`(내 주소 · SNS 링크).
  줄 부품은 `profile-edit/EditRow.tsx`(`EditRow`/`RowActions`/`RowNote`/`RowGroup`/`ROW_INPUT`).
- **제거** `AccountControlsSection.ProfileEditModal`(+ 쓰는 데가 없어진 import 5줄) ·
  `src/pages/ushop-manage/ShopInfoCards.tsx`. 유어샵 관리에는 프로필 편집으로 보내는 줄 하나만 남겼다.
- **전화번호가 비면 빨갛게** `입력 필요` — 종전 모달의 라벨 빨간 `*` 를 줄 목록 문법으로 옮긴 것
  (`EditRow` 의 `required`). 교환권이 MMS 로 그 번호에 간다.
- **문구는 옛 모달의 `accountSettings.*` 키 7개를 그대로 재사용**. 한국어 리터럴로 새로 적으면
  영어 UI 사용자가 한국어를 보는 **퇴행**이고, 6개 언어 커버리지를 지키는 가드도 앵커를 잃는다.
- **시트 등장** — `.ur-sheet-in` / `.ur-sheet-veil`(`src/index.css`) 두 클래스가 소유한다.
  네 시트(알림 · 가게 전환 · 마이 판매 셸 · 프로필 편집)가 같은 클래스를 쓴다.

## 3) 🩸 이번에 **틀린 판단 셋** — 다음 세션이 같은 데서 넘어지지 않게

### ① 미리보기가 옛 화면을 그려서 "코드가 안 먹었다" 고 볼 뻔했다
`scripts/visual-preview.mjs` 는 **`dist/client` 를 띄운다.** 소스를 고치고 `npm run build` 를
안 하면 **옛 번들**이 그려진다. 새 화면을 만들고 미리보기가 옛 화면이면 **먼저 빌드했는지 볼 것.**

### ② 동작 줄이기(OS 설정) 끄기를 **두 번** 틀렸고 둘 다 소스 검사는 통과했다
브라우저 실측이 아니었으면 "지켰다" 고 보고했을 것이다.
- **1차** `@media (…reduce) { .animate-slide-up { animation: none } }` → 시트는 변형 클래스
  `max-lg:animate-slide-up`(선택자 `.max-lg\:animate-slide-up`)을 쓴다. **다른 클래스**라
  한 글자도 안 걸렸다. 실측 390×844, reduce ON: 시작 y=844 → 끝 444 로 **그대로 올라왔다.**
- **2차** `@media (…reduce) { @keyframes ur-slide-up { from,to { transform:none } } }` →
  Tailwind 가 **변형 블록 안에 같은 키프레임을 다시 emit** 하고(`@media not all and (min-width:1024px)`),
  그게 출력 CSS 뒤쪽(195k)이라 내 재정의(150k)를 이긴다. 역시 안 먹었다.
- **답**: 우리 클래스(`.ur-sheet-in`)를 만들어 **정의를 `index.css` 안에 두고 순서를 우리가 정한다.**
  덤으로 PC 함정이 **구조적으로** 사라진다(아래 ③).

🧭 교훈: **"규칙이 소스에 있다"는 "그 규칙이 이긴다"를 말해 주지 않는다.** CSS 캐스케이드는
브라우저만 안다. 같은 특이도의 유틸을 끄려면 순서를 확인하거나 우리 선택자를 쓸 것.

### ③ PC 함정 — slide-up 이 가운데 정렬을 먹는다
PC 시트는 가운데 정렬을 `transform`(`-translate-x-1/2 -translate-y-1/2`)으로 한다.
`ur-slide-up` 은 **같은 속성**을 `none` 으로 끝내고 `fill-mode: both` 로 유지하므로,
PC 에 slide-up 이 걸리면 다이얼로그가 **오른쪽 아래로 튄다**(1280×800 실측 410,200 → 640,400).
`.ur-sheet-in` 이 lg+ 에서 투명도 전환으로 갈아타므로 호출부는 이 실수를 **할 수 없다**.

### ④ 되돌려-검증이 내 재조준이 **약해진 것**을 잡았다
`사진 업로드가 전화번호에 안 묶인다` 를 `'전화번호'` 리터럴로만 보게 고쳤더니, 주입이 i18n 키
(`accountSettings.phoneRequired`)로 게이트를 심자 **통과**했다 ⇒ `/phone/i` 로 재조준.

## 4) 측정 (브라우저, 실제 빌드 CSS)

| | animation | 시작 | 끝 |
|---|---|---|---|
| 폰 390×844 | `ur-slide-up` | y 844 (화면 밖) | y 444 — 400px 올라온다 |
| 폰 · 동작 줄이기 | `none` | y 444 | y 444 — 안 움직인다 |
| PC 1280×800 | `ur-overlay-in` | 410,200 (정확히 가운데) | 410,200 — 안 튄다 |
| PC · 동작 줄이기 | `none` | 410,200 | 410,200 |

## 5) 가드

- **신규** `src/tests/unit/profile-edit-a2-and-sheet-motion-2026-10-11.test.ts`(12건) +
  `scripts/mutations/profile-edit-a2.mjs`(9건, **전부 빨간불 확인**).
- **재조준(지우지 않았다)** — 코드가 옮겨갔을 뿐 불변식은 그대로다:
  `notification-sheet-and-profile-2026-10-11.test.tsx` §④ · `mypage-cleanup-2026-09-02.test.ts` §⑤ ·
  `ushop-e3-manage-2026-09-28` · `ushop-top-chrome-2026-09-28` ·
  `scripts/mutations/{notification-sheet-profile,ushop-console-refresh,ushop-top-chrome}.mjs` ·
  `check-guard-mutations.mjs` 인라인 1건.
- 래칫: `shape-lock` 74 → **73 으로 내렸다**(`ShopInfoCards` 삭제분 — 안 내리면 조용한 탈출구).

## 6) ⚠️ 못 한 것 · 다음 세션의 첫 액션

1. **E4 미판정.** 이 PR 은 머지·배포까지만 됐다면 **E3** 다. 라이브 `urdeal.kr/user/profile` 에
   로그인해 ⓐ 프로필 편집이 올라오는지 ⓑ 이름을 바꾼 뒤 **다른 브라우저(비로그인)로 내 유어샵**을
   열어 **즉시 새 이름인지**(= purge 가 실제로 도는지) 확인할 것. ⓑ가 이 PR 의 진짜 수리다.
2. **나가는 동작(exit)은 안 넣었다** — `ToolPageSheet` 의 `onClose` 는 *닫기* 가 아니라
   **갈아 끼우기**(전체 도구 → 도구)로도 쓰인다. 퇴장 애니메이션을 위해 onClose 를 미루면
   그 사이 **빈 화면이 한 프레임** 보인다. 별건으로 판단할 것.
3. **`SharePrompt.tsx` · `BottomNav.tsx` 는 아직 생 유틸**(`animate-slide-up`/`animate-overlay-in`)을
   쓴다 ⇒ **동작 줄이기가 안 걸린다.** 둘 다 PC 가운데 정렬이 없어 ③ 함정은 없지만, `.ur-sheet-in`
   으로 옮기면 그 설정까지 지켜진다(이번 범위 밖).
4. **공유 헬퍼의 잠재 결함** — `src/tests/helpers/source-text.ts` 의 `trackedSources()` 는
   `git ls-files` 를 읽어, **파일을 지우고 stage 하기 전**에는 없는 파일을 읽어 `ENOENT` 로
   죽는다(이번에 `udal-mascot-2026-10-07` 가 그렇게 빨개졌다 — 코드 문제가 아니다).
   고치려면 존재하는 파일만 거르면 되지만, `src/tests/helpers/` 를 건드리면 주입 검증이
   **전수(82분)** 로 떨어지므로 다른 작업과 묶어서 할 것.
