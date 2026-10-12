# 2026-10-12 — 대표 지시 "내 판단이 필요한 3가지 모두 가장 이상적으로"

> 브랜치 `claude/taste-skill-install-n1s63z` · 직전 PR [#1731](https://github.com/tobe2111/ur-live/pull/1731)
> (목록 네 표면 noscript + `/stays` ItemList) 이 auto-merge 대기 중이던 시점에 이어서 작업.

대표가 제가 "판단 필요" 로 올린 셋을 **전부, 가장 이상적으로** 하라고 지시했다.

| | 항목 | 결론 |
|---|---|---|
| ① | `/region/*` 항목 커버리지 | **결함이었다** — cron 요약 한 키로 수리 |
| ② | 시드 없는 표면의 thin content | 12표면 수리 · `/privacy`·`/refund` 는 **일부러 안 했다** |
| ③ | hreflang 0건 | **짓지 않는 것이 정답**이었고, 반대쪽에 실제 결함이 있었다 |

---

## ① 지역 요약 캐시 — 커밋 `4bbd34883`

**실측(활성 359건 전수)**: 색인 대상은 **시/도 11 + 시군구 32 = 43개**인데, 그 표면의 시드가
홈과 같은 1페이지 50건(분포 `서울 44 · 강원 3 · 전북 1 · 부산 1 · 경북 1`)이라 **6개 시/도가
본문 0자 · ItemList 0건**이었다. 딜이 **49건 있는 경기**도 그랬다.

🩸 **제가 전에 이걸 "설계의 대가" 라고 보고했는데 틀렸다.** 재 보고 정정했다 — 결함이다.

**처방**: cron 이 `:15` 한 슬롯에서 전량(`limit=100` 4페이지)을 받아 (시/도, 시군구) 묶음마다
10행 + 숙소 전용 묶음을 한 KV 키(`ssr:region-digest`)에 접고, 워커는 지역·`/stays` 에서만 읽어
**크롤러 본문·ItemList 를 만들 때만** 쓴다. 주입(`__SSR_INITIAL_MAIN__`)은 **종전 MAIN 시드 그대로**.

전·후(라이브 시드 50행 vs 요약 258행/98KB): `경기 0→379자·10항목` · 전남 0→367·10 ·
충남 0→401·10 · 제주 0→366·8 · 대구 0→387·8 · 충북 0→398·8 · 부산 58→399 · 강원 165→428 ·
`경기/파주시 0→383·10` · `/stays` 268→428(5→10) · 서울·종로구 **불변**(이미 꽉 찼다).

버린 길 넷과 그 이유는 `src/shared/seo/region-digest.ts` 머리말에 적어 뒀다.

## ② 시드 없는 표면의 본문

**실측(Googlebot UA · sitemap 제출 정적 경로 전수)**: `/join 15 · /terms 15 · /refund 17 ·
/creators/apply 20 · /privacy 21 · /influencer 28 · /creators 28 · /introduce 30 ·
/experience 33 · /area-report 36 · /partners 37 · /region 38` — 전부 "색인해 달라" 고
선언한 URL 인데 20~40자였다.

**처방 셋**:
1. `shared/seo/surface-copy.ts` — 경로별 문장 SSOT. **모든 줄이 그 페이지 소스에 실재해야
   한다**(가드가 공백 정규화로 대조 → 클로킹 구조적 불가).
2. `/terms`·`/terms/seller` 는 **문서 자체(`TermsDoc`)의 조항 제목**을 파생한다 — 손 요약은
   개정될 때 갈린다. `/terms` 15 → 318자.
3. 문구가 정말 없던 셋(`/experience`·`/new-openings`·`/region`)은 **화면에 한 줄 먼저 쓰고**
   그 문장을 SSOT 로 옮겼다(사람에게도 이득).

⚠️ **`/privacy`·`/refund` 는 일부러 안 했다** — 본문이 JSX 에 박혀(게다가 `/privacy` 는 국문·
영문 분기) 문서에서 파생할 수 없고, 손으로 요약하면 **화면에 없는 말**이 되어 그 SSOT 의 규율을
내가 깨는 셈이다. 올바른 수선은 그 둘도 `TermsDoc` 같은 콘텐츠 SSOT 로 옮기는 것이고 **별건**
(법정 문서라 문구 변경 = 대표 확인).

## ③ hreflang — **짓지 않았고, 거짓 선언을 지웠다**

처음엔 "hreflang 0건" 을 결함으로 올렸다. **재 보니 그게 올바른 상태**이고 결함은 반대쪽이었다:

    hreflang 0건  ·  og:locale:alternate **5건**(en_US·ja_JP·zh_CN·es_ES·fr_FR)

`og:locale:alternate` 는 *"같은 URL 이 그 언어로도 있다"* 는 뜻인데 — 언어 전환이
`i18n.changeLanguage` + localStorage 라 **URL 이 안 바뀐다**(가리킬 대상이 없다). 게다가 공유·크롤은
**서버 HTML** 을 받고 거기엔 `ko_KR` 하나뿐이라, 그 5건은 **크롤러에게 닿지도 않으면서 서버와만
어긋났다.** ⇒ 제거하고 `og:locale` 을 서버와 같은 고정 `ko_KR` 로.

**다국어 hreflang 을 짓지 않은 근거 넷**(가드 머리말에 상세): 가리킬 URL이 없다 · 구글이 단일
언어 사이트엔 불필요라고 명시 · 재고가 한국 오프라인(영어 질의 전환 ≈ 0) · 로케일은 UI 문구뿐이고
상품·매장 콘텐츠는 한국어라 언어별 URL 을 내면 thin/duplicate 가 5배로 색인된다.

🔑 가드 ③이 **전제 조건을 기계로** 걸어 뒀다 — 언어 접두 라우트(`/en/...`)가 라우터에 생기면
그때 hreflang 을 짝으로 넣는다. 순서가 뒤집히면 구글에 거짓을 말하는 것이다.

---

## 다음 세션의 첫 액션

1. **PR 상태 확인** — `gh api repos/tobe2111/ur-live/pulls/<N> --jq '{mergeable,merged}'`.
   #1731 은 auto-merge(squash) 무장 상태였다.
2. **E4 판정(배포 + cron 1회 뒤)** — `:15` 회차가 한 번 돌아야 KV 키가 생긴다:
   ```
   UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
   curl -sL -A "$UA" https://urdeal.kr/region/경기 | grep -c ItemList     # 0 → 1 이어야
   curl -sL -A "$UA" https://urdeal.kr/partners | <본문 글자수>            # 37 → 100+
   curl -sL -A "$UA" https://urdeal.kr/terms    | <본문 글자수>            # 15 → 330+
   curl -sL -A "$UA" https://urdeal.kr/ | grep -c og:locale:alternate      # 5 → 0
   curl -sL -A "$UA" https://urdeal.kr/ | <홈이 종전과 동일한지>            # 요약 누수 증거
   ```
   ⚠️ **"전" 값을 잴 때 입력이 라이브와 같은지 먼저 확인할 것** — 이 작업에서 `limit=100&page=1`
   (100행)을 MAIN 시드(50행)로 착각해 "이미 되고 있다" 로 오판할 뻔했다(세션 다섯 번째).
3. **`/privacy`·`/refund` 콘텐츠 SSOT 이전**(별건, 대표 확인 필요) — ②에서 유일하게 남긴 자리.

## 이번에 틀렸던 판단

- 🩸 **"`/region` 의 빈 본문은 설계의 대가"** → 결함이었다. 공유 시드의 분포를 안 재고 설계
  의도만 보고 단정했다.
- 🩸 **"hreflang 0건이 결함"** → 올바른 상태였고, 결함은 `og:locale:alternate` 5건이었다.
  **"없는 것" 을 결함으로 부르기 전에 "있어야 하는가" 를 먼저 물을 것.**
- 🩸 **전·후 측정에서 "전" 입력을 틀렸다**(`limit=100` 4페이지 vs 실제 50행 시드).
- 🩸 **탐침이 그 경우를 담지 않아 주입 4건이 헛돌았다** — 같은 시/도의 다른 구가 없었고, 숙소가
  빈 시군구에 있었고, 교환권에 주소가 없었다. **규칙을 없애도 초록이면 탐침이 틀린 것이다.**
- 🩸 **설명 주석이 자기 단언을 오발시켰다**(`og:locale:alternate`·`hreflang` 인용) — 부재 판정은
  **주석을 걷어낸 실행되는 줄**로. 이 레포가 세 번째로 밟은 자리다.
- 🩸 **대소문자**: JSX 는 `hrefLang`, HTML 은 `hreflang`.

## 남은 결정 / 대기

- **`/privacy`·`/refund`** 콘텐츠 SSOT 이전(법정 문서 문구 — 대표 확인).
- **`/refund` 에 다른 서비스 문구가 섞여 있다** — "제22조 (환불) · 가. 경기 결제 회원 ·
  나. 연간 결제 회원" 은 유어딜 모델이 아니다(발견만 하고 손대지 않았다).
- cron `:15` 슬롯이 실제로 KV 키를 만드는지는 **배포 후에만** 확인된다(레포가 못 본다).
