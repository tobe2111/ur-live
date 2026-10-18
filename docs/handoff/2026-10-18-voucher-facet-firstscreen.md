# 2026-10-18 — facet 링크가 첫 화면 경로에서 안 나오던 것 (PR #1896 의 E4 실패 수리)

## 한 줄
PR #1896 이 `/vouchers` 허브에 넣은 카테고리 링크 20개가 **라이브에서 0** 이었다.
sitemap 쪽(①)은 통과했고, **허브 링크(②)만 죽어 있었다.**

## 무엇이 틀렸나

`worker/index.ts:1046`:
```js
el.setInnerContent(vouchersFirst || (buildStaticSurfaceNoscript(url.pathname, crawlerPayload) + urdealLoaderHtml))
```
`/vouchers` 는 **둘 중 하나만** 낸다. 서버 첫 화면(2026-10-14)이 성공하는 한
`buildStaticSurfaceNoscript` 는 **한 번도 안 불리고**, #1896 은 facet 링크를 바로 그 안에 넣었다.

라이브 실측(머지 `8d40789e1` 배포 후):
```
sitemap ?category=   3 → 20   ✅   (단 엣지 캐시 age=6394 라 ?cb= 로 우회해야 보였다)
/vouchers 허브 링크  0 → 0    ❌   ← 이 수리의 대상
교환권 상세 링크     0 → 0    ✅   (반대 방향 유지)
```

## 🧭 교훈 — 같은 PR 안에서 같은 함정을 두 번 밟았다

#1896 의 시험은 `buildListSurfaceNoscript('/vouchers', …)` 를 **직접 호출**해 링크 20개를 확인했다.
그건 *계산*이고 **그 결과가 응답에 실리는지**는 다른 질문이다 — 2026-08-02 `goneStatus` 와 같은 클래스.

그 PR 은 **sitemap 축에서 똑같은 함정을 한 번 잡았다**(주입이 `voucherFacetsByStock(` 문자열만 보는
단언을 통과해서, 가짜 D1 로 `sitemapRoutes` 를 실제로 돌리도록 고쳤다). 그런데 **허브 축엔 그 교정을
적용하지 않았다.** 한 축에서 배운 것을 같은 PR 의 다른 축에 옮기지 않으면 그 축은 그대로 남는다.

## 수리

- `crawler-noscript.ts` — `voucherFacetNoscript(path)` export(첫 화면과 함께 낼 수 있는 `<noscript>`).
  🔴 **상품 요약은 안 낸다** — 첫 화면이 이미 그렸다(규율: 첫 화면이 그린 것을 다시 쓰지 않는다).
- `worker/index.ts` — `vouchersFirst ? vouchersFirst + voucherFacetNoscript(url.pathname) : (종전 폴백)`.
  **줄 수 불변(2663)**, 첫 화면 실패 폴백은 그대로(거기엔 이미 링크가 들어 있다 — 중복 없음).

## 가드
`voucher-facet-firstscreen-2026-10-18.test.ts` 6건 + 주입 4건(되돌려-검증 전부 빨간불).
핵심은 ④ — **워커가 첫 화면과 함께 링크를 내는가**(#1896 이 빠뜨린 바로 그 단언).

🕳️ 주입 하나는 **중복이라 지웠다**: 주소 조립 규칙(`%20` ↔ `+`)은 `voucher-facet-discovery` 시험이
리터럴로 이미 지킨다. 내 시험의 같은 단언은 `voucherFacetPath()` **같은 함수**와 비교해서 그 함수를
바꾸면 양쪽이 함께 바뀐다(실제로 주입이 통과했다) — *비교만 두면 둘 다 틀려도 초록*이다.
그 한계를 시험 주석에 적어 뒀다.

## E4 (배포 후) — 양방향
```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
curl -sS -A "$UA" 'https://urdeal.kr/vouchers' | grep -c 'href="/vouchers?category='   # 0 → 20
curl -sS -A "$UA" 'https://urdeal.kr/vouchers' | grep -c 'href="/vouchers/[0-9]'       # 0 유지(noindex)
curl -sS "https://urdeal.kr/sitemap.xml?cb=$RANDOM" | grep -o 'category=[^<]*' | sort -u | wc -l  # 20 유지
```
🔴 **`/vouchers` 에는 `?cb=` 를 붙이지 말 것** — 워커 슬롯 조건이 `!url.search` 라 측정이 꺼진다.
🔴 **sitemap 에는 붙여야 한다** — `publicCache(3600)` 라 안 붙이면 최대 1시간 전 응답을 본다
   (이번에 `age=6394` 를 보고 "미반영" 으로 오진할 뻔했다. 둘의 규칙이 **반대**다).
