# 유어쇼츠 뷰어 — 자막을 확실히 끄기 위해 재생기를 우리가 쥔다 (2026-09-08)

`[E2]` 검증됨(tsc 0 · 유닛 · 주입 되돌려-검증). **E4(라이브 판정)는 배포 후 대표 눈으로.**

## 1. 다음 세션의 첫 액션

배포되면 **폰에서 `urdeal.kr/videos` 를 열고 세 가지를 본다.**

| 볼 것 | 통과 | 실패면 |
|---|---|---|
| 자막("여기는" 같은 글자) | **안 뜬다** | `unloadModule` 이 그 세대에 안 먹힌 것. 콘솔에서 `document.querySelector('iframe').src` 로 nocookie 인지부터 확인 |
| 화면을 한 번 탭 | **멈추고 가운데 ▶ 가 뜬다**, 다시 탭하면 재생 | 제스처 층이 탭을 못 받는 것(z 순서) |
| 위아래 스와이프 | 다음/이전 영상으로 넘어간다 | **이건 아직 대표 확인 전이다** — 09-08 에 넣고 눈으로 못 봤다 |
| 영상이 끝날 때 | **처음부터 다시 튼다**(끝 화면 안 뜸) | `ENDED` 상태를 못 받은 것 |
| PC 홈 레일에 마우스 올리기 | 좌우 화살표가 뜬다 | `group` 클래스가 또 빠진 것 |

콘솔에서 재생기가 살아 있는지: `window.YT?.Player` 가 함수면 API 경로, `undefined` 면 폴백(고정 iframe)으로
튼 것이다 — 폴백이면 자막이 남는 게 정상이고 탭 일시정지도 안 된다.

## 2. 완료분

- `src/pages/videos/youtube-player.ts` (신규) — IFrame Player API 로더. **절대 reject 하지 않는다**
  (실패·타임아웃 2.5초 → `null`). `killCaptions()` 가 `captions`·`cc` 두 모듈을 내린다.
- `src/pages/VideosPage.tsx` — 재생기를 **한 번 만들고 `loadVideoById` 로 갈아 끼운다**.
  자막은 `onReady` + **`onStateChange` 마다** 끈다(다음 영상이 오면 유튜브가 다시 싣는다).
  탭 일시정지 복원(`togglePlay`) + 멈춤 표시. API 가 안 오면 예전 고정 iframe 으로 폴백.
- `src/shared/urshorts.ts` — `youTubePlayerVars()` **SSOT** 신설. URL 경로와 API 경로가 **같은 값**을
  쓴다(두 벌이면 반드시 갈라진다). `cc_load_policy=0`·`iv_load_policy=3` 추가.
- **끝나면 다시 튼다**(`ENDED` → `playVideo`). 취향이 아니라 방어다 — 안 하면 유튜브가 끝 화면에
  관련 영상을 깔고, 그걸 누른 사람은 우리 화면을 떠난다(`rel=0` 은 같은 채널로 좁힐 뿐이다).
- **`src/components/home/UrShortsRail.tsx` — PC 화살표가 한 번도 뜬 적이 없었다.**
  `group-hover:grid` 인데 조상에 `group` 이 없었다. 기본값이 `hidden` 이라 에러도 경고도 없다.
  대표에게는 "넘길 방법이 없는 레일"로 보였다 — 같은 날 뷰어 스와이프가 정확히 같은 꼴이었다.
- 가드: `urshorts-viewer-chrome.test.ts` +13건 · `urshorts-core.test.ts` 앵커 재조준 +2 describe ·
  주입 매니페스트 `scripts/mutations/urshorts-and-ci.mjs` +12건(전부 되돌려-검증 빨간불 확인).

## 3. 이번에 틀렸던 판단 / 조심할 것

- **`AND p.is_active = 1` 을 LEFT JOIN 옆에 붙이면 INNER 로 조용히 되돌아간다** — 09-08 오전에 밟았고,
  `src/shared/urshorts.ts` 헤더가 그때까지 *"INNER JOIN 으로 강제한다"* 라고 **낡은 지도**로 남아 있었다.
  이번에 함께 고쳤다. 문서가 코드보다 오래 사는 전형이다.
- **주입 `find` 가 유일해야 한다** — `{ autoplay: true, controls: false }` 가 API·폴백 두 곳이 되어
  "대상 2곳"으로 걸렸다. 함수 이름까지 앵커에 넣어 좁혔다.
- **재생기 자리를 React 가 갖게 하면 안 된다.** YT 가 우리 div 를 iframe 으로 갈아치우므로, React 가
  그 노드를 지우려 들면 `removeChild` 로 터진다. 껍데기만 React 가 갖고 안쪽은 우리가 만들고 destroy 한다.
- **`[apiState]` 만 의존성에 두면 안 된다.** 껍데기 div 는 목록이 온 뒤에야 그려져서, API 가 목록보다
  먼저 오면 effect 가 host=null 로 한 번 헛돌고 끝난다(에러 없이 검은 화면). `hasVideo` 를 함께 본다.
- **재생기는 만든 직후엔 명령을 못 받는다.** `onReady` 전 `loadVideoById` 는 던지는데, 그 예외를
  삼키면 `loadedRef` 만 앞서 나가 **넘겨도 영상이 안 바뀐 채 굳는다**(구매 바는 다음 상품인데 화면은
  이전 영상 = 엉뚱한 상품을 파는 것처럼 보인다). `playerReady` 를 함께 보고 준비되면 이어 붙인다.
- **되돌려-검증이 내 가드 둘을 잡았다**: ① 폴백 주입이 **엉뚱한 테스트 파일**을 가리켜 초록이었다
  ② 탭 단언이 `onClick` 쪽 `togglePlay()` 에 걸려, 터치 경로를 통째로 지워도 초록이었다.
  둘 다 "가드가 있는데 아무것도 안 지킨다" 클래스다 — **주입 없이는 못 찾는다.**

## 4. 남은 결정 / 대기

- **유튜브가 안 지워 주는 것**: 상단 제목·채널 띠 · 🔗 링크 · Shorts 로고. **덮으면 embed 약관 위반**이라
  안 덮는다(유어애즈가 곧 접촉할 크리에이터들에게 보낼 신호로도 나쁘다). 없애려면 자체 호스팅뿐 —
  대표 판단 사항.
- **유저 투고(인플루언서 자기 쇼츠)** — 4단계 설계는 있으나 **대표 판단 대기 · 착수 금지**.
  ②(`?ref=` 귀속)는 머니 경로라 결재 + staging 필수.
- **대표 손이 필요한 것**: `Verify` 를 required status check 로 · merge queue · 어드민에서 영상에
  이용권 붙이기(지금 대부분 비어 있어 홈 레일이 허전해 보이는 진짜 이유다).
