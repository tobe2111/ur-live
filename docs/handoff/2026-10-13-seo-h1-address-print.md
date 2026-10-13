# 크롤러 문서의 제목 요소 · 매장 주소 · 인쇄판 색인 (SEO 세 건)

작성: 2026-10-13 · 대표 지시 *"SEO, GEO 개선할 것 더 찾아줘"* · **[E2]**

## ① 크롤러가 받는 홈 문서에 `<h1>` 이 0개였다

Googlebot UA 로 받아 파싱해 세니 색인 대상 7표면 중 **홈만** 제목 요소가
`<h3>이런 이용권은 어떠세요?</h3>`(섹션 라벨) 하나였다. 나머지는 전부 h1 정확히 1개.

소스 실측: `PcHomePage.tsx` 에는 h1 이 있는데 `MobileHomePage.tsx` 는 0개고, 워커 첫 화면
빌더도 h3 하나다. 🔑 그런데 **2026-10-11 부터 검색 크롤러는 모바일 첫 화면을 받는다**
(`shouldRenderMobileFirstScreen`) ⇒ PC 의 h1 은 크롤러에 **영영 안 간다.**

**왜 그렇게 됐나**: 2026-08-31 대표 지시(*"더 대기업 수준의 완성도"*)로 **보이는** 머리글을
일부러 뺐는데(그 결정은 그대로 유효하다 — 동네 이름이 화면의 제목 역할을 한다) 그때
**요소까지 같이 사라졌다.**

⇒ `sr-only` h1. 박스가 0이라(`index.css:164` `.sr-only` = `position:absolute;width:1px`)
2026-10-08 홈 첫 화면 잠금(박스 실측 일치)에 안 걸리고, h1 없이 h3 가 단독으로 서던
접근성 문제(제목 단계 건너뛰기)도 함께 해소된다. 값은 `HOME_H1` SSOT 하나 — 워커와 React 가
**같은 자리에 같은 값**을 그린다(두 벌이면 마운트 때 제목이 바뀐다).

## ② 매장 `addressLocality` 가 전 건 0개였다

```
/pass/2919   FoodEstablishment  {"streetAddress":"서울 서초구 방배중앙로 165","addressCountry":"KR"}
/stays/2887  LodgingBusiness    addressRegion:"강원" 만 · addressLocality 없음
```

구글 `LocalBusiness` 가 권하는 필드이고 **로컬 질의가 이 서비스의 본류**다. 재료(주소)와
도구(`region-slugs.ts` 의 `parseRegionFromAddress` — `/region/*` 44개를 그걸로 가른다)가 둘 다
있었는데 서로 안 만나고 있었다. 신규 `postalAddress()` 가 둘을 잇는다. 빌더를 돌려 본 출력:

```
식사권  streetAddress 서울 서초구 방배중앙로 165 · addressRegion 서울 · addressLocality 서초구
숙소    streetAddress 강원특별자치도 양양군 … · addressRegion 강원 · addressLocality 양양군
```

🔴 **`streetAddress` 는 전체를 그대로 둔다** — 앞머리를 떼면 파싱이 어긋난 주소에서 길 이름이
잘려 *틀린 주소*가 된다. 시/도가 두 번 나오는 것은 구글이 허용하고 숙소가 이미 그 모양이었다.
🔴 **파싱이 실패하면 아무것도 안 넣는다**(지어내지 않는다).

### 🩸 덤으로 드러난 데이터 불일치 (고치지 않았다 — 코드가 아니라 데이터다)

숙소 2887 의 시드는 `region_sigungu: '속초시'` 인데 `address` 는 **양양군**이다. 둘 중 하나가
틀렸고 여기서는 가릴 수 없다. `PostalAddress` 안에서 `streetAddress` 와 `addressLocality` 가
서로 다른 곳을 가리키면 안 되므로 **주소를 권위로** 삼았고, 시험이 그 선택을 고정한다.
⚠️ 다음 세션이 `region_sigungu` 를 쓰도록 "통일" 하지 말 것 — 그러면 주소와 어긋난다.

## ③ `/about/print` 만 제네릭 홈 제목을 받았다

색인 가능 16표면을 전수로 훑으니 `index.html` 의 fallback 제목(`유어딜 - 돈버는 쇼핑, …`)을
받는 것은 **이 경로 하나뿐**이었다(나머지 15개는 고유 제목). 본문 32자 · `index, follow` 인데
**`/about`(295자)의 인쇄/PDF 판**이라 내용이 겹친다 ⇒ **noindex**(인쇄판 표준 처방).
🔴 canonical 을 `/about` 으로 돌리지 **않았다** — noindex + cross-canonical 은 서로 반대 신호다.

## 🔧 곁다리로 고친 것 — main 에 있던 중복 규칙

`vite.config.ts` 에 `'/src/shared/kakao-place-url'` 청크 규칙이 **두 벌**이었다. 같은 장애
(청크 순환 TDZ)를 두 세션이 각자 고쳤고 **각각은 초록인 채** 둘 다 머지됐다. 두 번째는 첫
`return` 때문에 **닿지 않는 죽은 규칙**이었고, 주입 앵커가 *"여러 곳에 맞는다"* 로 잡았다.
설명은 합치고 규칙은 하나만 남겼다. ⇒ `check-stale-mutation-anchors` 가 main 에서 빨간불이던
것이 해소된다.

## 검증

tsc 0 · build 0 · 신규 14건 pass · 인접 가드 4파일 **123건** pass(홈 첫 화면 박스 잠금 포함) ·
주입 **9건 되돌려-검증 전부 빨간불 확인** · 낡은 앵커 0(3,468건) · pre-push 게이트 가드 100개.
빌더를 실제로 돌려 출력을 눈으로 봤다(위 ②의 표, 그리고 홈 첫 화면 HTML 머리에 `sr-only` h1).

⚠️ **못 본 것**: 구글이 실제로 그 h1·주소를 쓰는지(외부 판정, 수일~수주, 서치콘솔은 **대표만**
본다) · `sr-only` 가 정말 0px 인지(CSS 가 정한다 — jsdom 에 레이아웃이 없다) · HTMLRewriter 배선.

⚠️ **E4 는 배포 후 라이브 UA 실측**:
```
curl -A '<Googlebot UA>' https://urdeal.kr/ | grep -c '<h1'            # 0 → 1
curl -A '<Googlebot UA>' https://urdeal.kr/pass/2919 | grep addressLocality   # 0 → 서초구
curl -A '<Googlebot UA>' https://urdeal.kr/about/print | grep 'name="robots"' # index → noindex
```
그리고 **반대 방향** — `/about` 본체가 여전히 `index, follow` 인지, 홈 첫 화면이 안 밀리는지.

## 다음 세션의 첫 액션

남은 SEO 할 일: **#45**(대표 지시 — 로고·유달이 구글 이미지. 실측은 끝났고 `/about` 에 올릴
시안을 대표에게 먼저 보여야 한다) · #47(og:image:alt) · #48(`/urshorts`) · #49(블로그 썸네일) ·
#43(sitemap 미제출 5표면). **#46**(죽은 디자인 토큰 파일 2개) 는 별건.
