# 2026-10-13 — 유어쇼츠 두 표면의 서버 메타 (`/urshorts` · `/videos`)

대표 *"머지해줘 seo, geo 더 개선할건?"* — PR #1751 머지(`e569c519d`) 후 더 찾은 것.

## 실측 (라이브 · Googlebot UA)

| 표면 | robots | title/description | 본문 | h1 | Breadcrumb |
|---|---|---|---|---|---|
| `/urshorts` | `index, follow` | **홈과 완전히 동일** | 32자 | 0 | 0 |
| `/videos` | `index, follow` | **홈과 완전히 동일** | 32자 | 0 | 0 |
| (대조) `/vouchers` | `index, follow` | 전용 | 268자 | — | 있음 |

원인 하나: **둘 다 `CONSUMER_SURFACE_SEO`(26경로)에 없었다** → 서버 메타 rewrite 를 안 탄다.

🔴 **`/videos` 는 그 페이지가 이미 `noindex` 를 선언하고 있었다**(클라 `<SEO ... noindex />`).
서버가 `index, follow` 를 줘서 **JS 안 돌리는 크롤러(Yeti·AI 봇)에는 그 선언이 무효**였다 —
2026-07-29 에 `/search`·`/gb-market` 에서 고친 것과 **같은 결함**이고 이 둘만 빠져 있었다
(`/videos` 는 2026-09-07 신설 — 그 뒤 표에 등록되지 않았다).

## 한 것

1. `CONSUMER_SURFACE_SEO` 에 `/urshorts`(색인 · crumb `유어쇼츠`) + `/videos`(**noindex** · crumb 비움)
2. 두 페이지의 `<SEO>` 를 그 표에서 읽게 — 문구가 두 벌이면 반드시 갈린다(그 파일 머리말의 확장 레시피)
3. `/urshorts` 화면에 **설명 한 줄** 추가. 종전 이 페이지엔 설명 문장이 **0줄**(제목 + 편수 + 칩 라벨뿐)
   이었다 — 메타에만 설명을 두면 검색 스니펫과 도착 화면이 다른 말을 한다. 메타와 **같은 글자**다.

## 🔴 일부러 안 한 것 (다음 세션이 "빠졌다" 고 채우지 말 것)

- **`VideoObject` 선언** — 영상이 **전부 남의 유튜브 채널**이다(실측 채널: 부산일보TV 2 · 해피푸게더 ·
  슬아투니 · 부산이야 · 파인예플 · 재슐랭가이드 · 미분류 3). 우리 페이지의 영상이라 선언하면 **거짓
  주장**이고, 이 레포가 브랜드 `sameAs` 를 *실제 계정이 없다*는 이유로 비워 둔 것 · 리뷰 0 에
  `aggregateRating` 을 안 내는 것과 **같은 규율**이다. 우리 것은 **큐레이션**(어느 가게·도시·종류)이다.
  재료는 다 있다(`video_id`·`thumb_url`·`duration_sec`·`title`) — **그래서 더 위험하다.**
- **`/urshorts` 크롤러 본문 + sitemap 제출** — `surface-copy` 표는 표면당 **110자 바닥**을 요구하고
  (가드가 그렇게 잡았다) 이 페이지의 내용은 **남의 썸네일 그리드**라 우리 산문이 적다. 바닥을 채우려고
  문장을 지어내는 것은 이 세션이 세운 규율(*"이름만 적어 글자수를 늘리지 않는다 — 측정만 좋아 보이고
  thin 인 사실은 그대로다"*)을 정면으로 어긴다. 같은 이유로 sitemap 미제출.
  ⇒ 본문이 생길 조건은 **우리 산문이 생기는 것**이다(예: 도시별 큐레이션 설명).

## 측정으로 닫은 후보 (파지 말 것)

- **`openingHoursSpecification` / `hasMenu`** — 상세 시드에 영업시간·메뉴 필드가 **없다**(실측: 매장
  관련 키는 `restaurant_name/address/phone/lat/lng` 뿐, `voucher_terms` 는 null). 지어낼 수 없다.
- **개별 `Review` 노드** — 리뷰가 **0건**(2919·2915·2888 전부). `aggregateRating` 을 안 내고 있는 것이 맞다.
- **사업자 유어샵 `Person.sameAs`** — 2026-10-12 인계 ⑬-정정 참조(스키마는 있고 라이브 값이 0).

## 다음 세션의 첫 액션

1. **E4 라이브 판정**(배포 후): `/urshorts`·`/videos` 의 title 이 홈과 **다른지** · `/videos` 가
   `noindex` 인지 · `/urshorts` 에 `BreadcrumbList` 가 생겼는지 · 본문은 **여전히 짧은지**(의도).
2. 바로 앞 머지(`e569c519d`)의 E4 도 아직이다 — `/pass/2919` `FoodEstablishment.sameAs` 0 → 1 ·
   `Product` 에는 없는지 · 색인 17표면 h1 1개 · `xAI-Bot` 홈 본문 34자 → ~395자.
   ⚠️ `sameAs` 는 `@graph` 중첩이라 **재귀로** 훑어야 한다.

## 이번에 틀렸던 것

- 본문 둘째 줄을 **코드 주석**에서 가져왔다 — 주석은 화면에 없으므로 클로킹이다. 가드의 110자 바닥이
  그 줄까지 들추게 만들어 발견했다.
- import 를 `^import .*$` 정규식의 **마지막 매치 뒤**에 넣었는데, 그 패턴이 **여러 줄 import 의 첫 줄**
  (`import {`)에 걸려 **그 안쪽**에 삽입돼 TS1003 이 났다. ⇒ 여러 줄 import 가 있는 파일에 그 방식을
  쓰지 말 것(단일 줄 import 뒤에 붙인다).
- 프로브에서 `code(path)` 에 **호스트를 빼먹어** 전 표면이 `HTTP 000` 으로 나왔다. 결함으로 오진할
  뻔했다 — 같은 창에서 `/urshorts` 는 다른 측정으로 **200** 이었다.

---

## 🩸 main 이 20분 차이로 빨간불이 됐다 — 앵커 재조준 1줄을 이 PR 에 포팅

**PR #1752 의 `Verify` 가 실패했는데 제 diff 와 무관했다.** 실패는
`src/tests/unit/faq-voucher-refund-2026-10-12.test.ts:100` 의
`toMatch(/payment_method === 'deal_points'[\s\S]{0,400}adjustUserPoints/)`.

**타임라인(실측)**

| 시각(KST) | 일 |
|---|---|
| 10:39 | #1751 머지 `e569c519d` — 이 시험이 `adjustUserPoints` 앵커와 함께 main 에 들어옴 |
| 10:59 | #1750 머지 `a1665a4c5` — 그 분기의 복원 호출을 `adjustUserPoints` → `refundDealPoints` 로 바꿈(무상→유상 딜 세탁 수리) |

**#1750 의 CI 는 왜 초록이었나**: PR 의 `Verify` 는 **머지 ref**(그 시점 base + head)에서 돈다.
#1750 의 마지막 Verify 는 10:39 **전** base 로 돌아 **이 시험을 본 적이 없다.** 20분 차이다.
(이 레포는 세션이 여러 개 동시에 돈다 — `check-seed-version-monotonic` 이 막는 것과 같은 클래스의
*시험 앵커* 판이고, `check-stale-mutation-anchors` 는 **주입 매니페스트만** 보므로 못 잡는다.
그 매니페스트의 앵커(`voucher.payment_method === 'deal_points'`)는 멀쩡해서 전수 스캔도 초록이었다.)

**main 이 빨갛다는 증명**: main 의 `auto-settlement.ts` 를 받아 SSOT `stripComments` 로 돌려
앵커를 재니 `adjustUserPoints` **false** · `refundDealPoints` **true**(나머지 단언은 전부 통과).
⚠️ **주석을 안 걷으면 `true` 로 보인다** — 그 분기 주석이 `adjustUserPoints` 를 인용하기 때문이다.
`code()` 는 주석을 걷으므로 CI 와 다른 답이 나온다. **원문으로 재지 말 것.**

**포팅한 수정(이 PR, 시험 1줄 + 주석)**: 앵커를 `(adjustUserPoints|refundDealPoints)\(` 로.
🔑 **둘을 다 받는 것이 의도다** — *어느 함수인지*(무상/유상 버킷 정확성)는 #1750 이 만든
`deal-cash-out-2026-10-12.test.ts:238` 가 **같은 블록을 이미 잠근다.** 여기서 또 잠그면
중복 잠금이 되어 어느 쪽도 출력으로 판정할 수 없다(2026-10-11 에 값을 치르고 배운 규칙).
이 시험이 지키는 것은 FAQ 의 약속 하나다 — *딜로 결제했으면 딜로 돌아간다.*

🩸 **되돌려-검증이 제 첫 판의 눈먼 자리를 잡았다**: 함수 **이름**만 앵커했더니, 바로 위
구조분해 import(`const { refundDealPoints } = await import(...)`)에 걸려 **호출을 딴 함수로
바꿔도 초록**이었다. 여는 괄호까지 요구해 두 방향 전부 빨간불을 확인했다
(분기 제거 → red · 복원 호출 제거 → red · 복원 → green).

⚠️ **이 한 줄은 main 이 그 수정을 품으면 no-op 이 된다**(#1752 의 범위를 넓힌 것이 아니라,
base 가 깨진 동안 모든 PR 이 막혀 있어서 포팅한 것이다 — #1741·#1743·#1722 도 같은 이유로 빨갛다).
