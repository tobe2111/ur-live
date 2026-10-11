# 마이 헤더 두 버튼 — 올라오는 알림 · 이름 있는 프로필 편집 (2026-10-11)

**[E2]** 작성·검증됨(tsc 0 · 유닛 18 pass · 주입 13건 되돌려-검증 전부 빨간불). 배포 뒤 눈 확인이 남아 있다.

대표(마이 스크린샷, 오른쪽 위 두 버튼에 빨간 박스):
> *"오른쪽 버튼이랑 알림 버튼에 대해서 수정이 필요해. 알림 버튼을 눌렀을 때 알림 페이지가 별도로
> 나오는게 아니라 위에서 올라오는 형태로? 나타나면 좋을 것 같고, 오른쪽 버튼은 눌렀을 때 기껏해야
> 이름이랑 전화번호 변경이네? 프로필 편집이라고 바꾸던지, 뭔가 지금 이상적이지 않아."*

---

## ① 알림 — 시트로 올라온다

### 무엇이 틀려 있었나
**PC 는 이미 그 자리에서 열렸다.** 2026-07-18 에 대표가 *"PC에서 알림 버튼 누르면 바로 보이게"* 라고
해서 `NotificationDropdown` 을 만들었고, 그 파일 머리말이 *"모바일은 기존대로 페이지 이동"* 이라고
적어 두고 있었다. 즉 **같은 지시가 PC 에만 적용된 채 3개월이 지난 것**이다.

그리고 목록 마크업이 **두 벌**이었고 이미 갈려 있었다:
| | 시각 표기 | 못 불러왔을 때 |
|---|---|---|
| `/notifications` 페이지 | `10월 9일 14:03` | 큰 빈 화면 |
| PC 드롭다운 | `3시간 전` | "알림을 불러오지 못했어요" |

모바일 시트를 새로 만들면 **세 벌**이 된다.

### 처방
`components/notifications/NotificationPanel.tsx` 에 **몸통 하나**(헤더·행·빈 화면·오류·모두 읽음·
전체 보기 + 상대 시각 `timeLabel`)를 두고, 셸만 둘:
- `NotificationSheet` — 모바일 바텀 시트(`Z.SHEET_*` · `max-h-[80dvh]` · ESC/백드롭 — `StoreSwitchSheet` 와 같은 관용구)
- `NotificationDropdown` — PC 드롭다운(위치·바깥 클릭만 남았다)

`/notifications` **페이지는 남는다** — 50개 이상 더 보기(페이지네이션)와 딥링크는 패널이 안 한다.

### 벨은 다섯 곳이다 — 전부 바꿨다
`UserProfilePage`(마이) · `MobileHomePage`(홈) · `HomeTopHeader` · `RestaurantMapPage`(지도 목록) ·
`MapTopBar`(지도 오버레이). **한 곳만 고치면 그 화면만 페이지로 남고, 사람 눈엔 안 보인다** — 시험이
다섯 파일을 전수로 본다. 배선은 `useNotificationSheet()` 한 줄(각자 `useState` 를 적으면 다섯 벌이 된다).

⚠️ **PC 쪽 두 벨은 안 건드렸다**: `DesktopTopNav`(이미 드롭다운) · `AccountPcPane`(PC 마이 안의 벨 —
여전히 페이지로 간다). 후자는 PC 마이 개편(아래 ③)에서 같이 본다.

📏 `RestaurantMapPage` 는 **파일 크기 동결(940줄)** 이라 주석 3줄을 1줄로 압축하고 import 를 기존
줄에 붙여 **940 을 유지**했다(`--rebaseline` 은 쓰지 않았다 — 그 명령은 줄였을 때만 쓴다).

## ② 프로필 — 무엇이 열리는지 말하고, 열 만한 것이 있다

### (a) 이름 없는 `>`
행 오른쪽 끝에 **`프로필 편집` 12px 글자**를 뒀다.
⚠️ **2026-09-28 에 없앤 회색 알약을 되살린 게 아니다** — 그건 이름·이메일 *아래 셋째 줄*이라 헤더를
세 층으로 만들었다. 이건 **같은 줄** 오른쪽 끝이라 줄이 안 늘고, 누를 면적(행 전체)도 그대로다.

### (b) "기껏해야 이름이랑 전화번호"
**프로필 사진**을 더했다 — 마이 헤더에 내 얼굴이 크게 떠 있는데 바꿀 곳이 **어디에도 없었다**
(카카오가 준 사진 그대로 박혀 있었다. 그게 "기껏해야" 의 실체다).

🔒 **새 인프라는 0이다**:
- 업로드 `/api/upload/image` — 소비자 **쿠키 인증**을 이미 받는다(2026-06-05 에 유어샵 사진 업로드
  401 을 고치며 넣은 폴백). 호출 모양은 `ReviewBonusButton` 과 같다.
  ⚠️ `components/upload/ImageUpload` 는 **못 쓴다** — localStorage 토큰을 요구해 카카오 유저에게
  "로그인이 필요합니다" 를 띄운다.
- 저장 `PATCH /api/curator/me/profile { profile_image }` — **같은 `users` 테이블**이다(유어샵 편집이 쓰는 그 길).
- 🧷 **다시 로그인해도 안 덮인다**: `KakaoAuthService` 의 upsert 가 사진을 덮는 조건이
  *"비었거나 kakaocdn/kakao.com URL 일 때"* 라서, 올린 사진은 그 조건 **밖**이다.

**사진은 고르는 즉시 저장한다**(이름·전화번호의 [저장] 과 분리) — 섞으면 "사진만 바꾸려는 사람"이
전화번호 필수 검증에 막혀 사진을 못 바꾼다. 실패하면 되돌린다. 서버 저장과 **같이**
`localStorage.user_profile_image` 를 갱신한다(한쪽만 바꾸면 저장은 됐는데 헤더는 옛 사진이다).

🩸 **i18n 함정**: `accountSettings.editProfile` 의 ko 값이 `'프로필 수정'` 이었다 — **locale 이
`defaultValue` 를 이긴다**(CLAUDE.md 가 경고한 그 함정). 코드만 고쳤으면 행은 "프로필 편집",
시트 제목은 "프로필 수정" 이 된 채 **에러 0** 이었을 것이다. ko 를 고치고 새 키 6개를 6개 언어에 넣었다.

## 🩸 pre-push 게이트가 이 PR 을 한 번 막았다 — **새 폴더는 catch-all 로 떨어진다**

첫 판은 `check-critical-chunks` 에 걸려 푸시가 거부됐다: **첫 페인트에 새 청크 9개 진입**
(`app-components` · `radix-ui` · `app-kakao-sdk` · `app-features` · `app-ui-utils` ·
`app-utils-deferred` · `app-misc` · `app-constants` · `lucide`).

매니페스트로 추적한 원인:
```
엔트리(App.tsx) → components/main/ConsumerTopChrome → DesktopTopNav → NotificationDropdown
                                      ↑ 전부 app-layout(첫 페인트 청크)
                → (신규) components/notifications/*  ← 규칙이 없어 catch-all `app-components`
```
`app-components` 가 첫 페인트로 들어오는 순간 그 봉투의 radix-ui·카카오 SDK·features 가 **줄줄이**
따라온다. CLAUDE.md 가 2026-08-27·09-02 에 두 번 기록한 그 패턴이다(*"새 import 하나가 catch-all 로
떨어지면 빨강"*).

**수리 두 조각**:
1. **시트는 벨을 누른 뒤에야 필요하다** → `useNotificationSheet.tsx` 가 `lazy()` 로 경계를 긋는다.
   그 파일이 정적으로 쥐는 것은 React 뿐이다.
2. **패널 몸통과 훅만** `vite.config` 에서 `app-layout` 으로 보낸다(둘은 어차피 app-layout 에서
   정적으로 닿는다). **시트 셸은 일부러 제외** — 넣으면 다시 첫 페인트 바이트가 된다.

재측정: `critical-chunks 17개 — 기준과 동일(신규 진입 0)` · `surface-role-leak 0` · 번들 예산 통과.

🧭 **다음에 `src/components/` 아래 새 폴더를 만들 때**: 그 모듈을 **첫 페인트 청크
(`app-shell`·`app-layout`)에서 정적으로 쓰는가**를 먼저 보라. 쓴다면 vite 규칙을 같은 커밋에 넣고,
안 써도 되는 것이면 `lazy()` 로 내릴 것.

## 가드

`src/tests/unit/notification-sheet-and-profile-2026-10-11.test.tsx` 18건 + 주입 13건(전부 빨간불 확인).

🩸 **세 단언이 헛돌았고 주입 러너가 셋 다 잡았다** — 적어 둔다:
1. *"셸이 목록을 직접 그리지 않는다"* 를 `useNotifications(` **호출 모양**으로 앵커했더니, import 만
   두는 주입이 샜다. 지키려는 건 호출 여부가 아니라 **셸이 데이터 모듈을 쥐지 않는가** 다 → 모듈 경로로.
2. *"상대 시각이 UTC-naive 를 UTC 로 읽는다"* — `parseUTCDate` 를 `new Date` 로 바꿔도 통과했다.
   **러너 TZ 가 UTC 라 두 해석이 같았다**(픽스처가 그 경우를 못 담은 전형) → `TZ=Asia/Seoul` 로
   9시간 갈리게 만든 뒤 재고, **환경이 두 해석을 안 가르면 시험이 실패**하게 했다.
3. *"프로필 행이 이름을 말한다"* — 키가 `aria-label` 에도 쓰여서, **보이는 글자를 통째로 지워도** 통과했다
   → `<span>` 안의 텍스트인지를 본다(스크린리더만 아는 이름은 대표 지적을 해결하지 못한다).

## 다음 세션의 첫 액션

배포 뒤 폰으로 `urdeal.kr` → 마이:
1. 벨 → **아래에서 시트가 올라오는가**(페이지 이동 0) · 홈·지도 벨도 같은가
2. 프로필 행 오른쪽에 `프로필 편집` 글자가 보이는가 → 눌러서 **사진 변경**이 되는가(바꾼 뒤 헤더 사진도 같이 바뀌는가)
3. 다시 로그인한 뒤에도 그 사진이 남아 있는가(카카오 사진으로 안 되돌아가는가)

## ③ 남은 과제 — **PC 마이가 좁다**(대표 추가 지시, 이 PR 범위 밖)

대표: *"PC버전에서 보는 마이페이지 형태가 너무 옹졸해.. 전체적인 PC버전의 UI 변경도 필요해"*

**원인을 실측으로 특정해 뒀다.** 1440px 뷰포트에서:
```
.ur-account-pc        w=644   (CSS 는 max-width:1200px 인데 644)
.ur-account-pane      w=580
왼쪽 열(판매)         w=309
오른쪽 열(손님·설정)  w=247   ← **폰(430)보다 좁다**
```
`.ur-account-pc { margin: 0 auto }` 가 **flex column 부모 안의 flex item** 이라, 가로 `margin:auto` 가
`align-self: stretch` 를 무효로 만들고 박스가 **fit-content** 로 줄어든다. 그래서 1200px 상한이
한 번도 닿지 않았다.

**한 줄로 확인했다** — `@media(min-width:1024px){ .ur-account-pc{ width:100% } }`:
```
.ur-account-pc  644 → 1200 · 왼쪽 309 → 618 · 오른쪽 247 → 494
```
⚠️ 그 한 줄만으로는 안 끝난다(같이 가야 하는 것):
- `--narrow` 접힘 규칙(`grid-cols-3/2 → 1`)이 **247px 전제**다. 494px 에서는 테마 버튼 셋이 여전히
  세로로 쌓인다 — 폭에 맞춰 다시 펴야 한다.
- 왼쪽 열(판매)이 '전체 도구' 에서 끝나고 **그 아래 ~800px 가 빈다**(오른쪽 열은 로그아웃까지 내려간다).
  열 배분/블록 배치를 다시 봐야 한다.
- `.ur-ushop-pc` 도 같은 `margin:0 auto` 를 쓴다 — **부모가 flex 인지 확인할 것**(같은 병일 수 있다).
⇒ 별건 PR 로. 그림은 `out/visual/user-profile-dark.png`(현행) · `pc-fix-dark.png`(폭만 고친 것).
