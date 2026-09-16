# 🎟️ 이용권 상세 주소 이전 `/group-buy/:id` → `/pass/:id` (#1149 조각 ④ = 항목 ⑫)

**[E2 검증됨]** — tsc 0 · 전체 유닛 통과 · 주입 5건 되돌려-검증. 배포·라이브 판정은 아직.

대표 확정 2026-08-12. 원 커밋 `62816f8a3`(2026-08-16)이 PR #1149 에 묶여 한 달간 머물러 있었다.
`docs/decisions/2026-09-15-stalled-pr-triage.md` 의 마지막 조각.

## 🔴 체리픽하지 않았다 — 다시 짰다

원 커밋은 34파일이었는데 **오늘 대상은 51파일**이다. 그 사이 09-15·09-16 에 워커가 상세의
`#root` 에 첫 화면을 직접 그리게 됐고(`detail-ssr-body.ts`·`boot-first-screen.ts`), 카드 목적지가
`canonicalDetailPath` SSOT 로 모였고, 표면이 여럿 늘었다(`VideosPage`·`SearchPage`·`SameStoreDeals`·
`home-hero-photo`·`voucher-checkout` …). 한 달 된 diff 를 얹으면 충돌이 본문보다 커진다.
⇒ **설계는 원안 그대로, 적용은 오늘 트리에 새로.**

## 무엇이 달라졌나

- 정본 `/pass/:id` (화면은 그대로 `GroupBuyDetailPage`)
- 옛 주소는 **살려 둔다** — 서버 301(`consumer-redirects`) + 앱 내부 폴백 라우트(`PathRedirect`)
  서버 301 은 **하드로드에만** 걸린다. 앱 안 링크는 서버를 안 타므로 라우트가 없으면 갈 곳이 없다.
- `RESERVED_SLUGS` 에 `pass` 등재 — 예약 안 하면 누가 그 슬러그로 몰을 만드는 순간
  `urdeal.kr/pass` 가 그 가게가 되고 **이용권 상세가 통째로 사라진다**
- 인프라: SSR 시드 매처 · 청크 프리로드 표면 · **서버 첫 화면 분기** · sitemap loc · prerender 힌트 ·
  PC 풀블리드 접두사 · 빵부스러기 2곳
- 링크 67곳/51파일(SSOT `product-flow.detailPath` 포함) · 운영 가이드 + `GUIDE_SEED_VERSION` 32

## 🩸 원안에 없던 것 — R6(서버 첫 화면)

원 커밋(08-16) 뒤에 생긴 분기라 원안엔 검사가 없다:

```ts
} else if (ssrSlot === 'DETAIL' && ssrPayload && url.pathname.startsWith('/group-buy/')) {
```

이 줄은 **pathname 문자열**로 가른다(`/vouchers/:id` 가 같은 DETAIL 슬롯이지만 다른 페이지라서).
정본만 옮기고 여기를 빼먹으면 `/pass/:id` 하드로드에서 서버가 그리던 [빵부스러기 + 히어로]가
**조용히 사라진다** — 에러도 빈 화면도 없고 그냥 종전 로더로 돌아갈 뿐이라 아무도 신고하지 않는다.
⇒ 가드 R6 신설 + 주입 1건.

## ⚠️ 옮기지 **않은** 것 (접두사를 공유하는 형제들)

| 남긴 것 | 이유 |
|---|---|
| `/group-buy/confirm-payment` 라우트·`successPath`·`voucher-checkout.successUrl` | **Toss 복귀 URL = 머니 경로.** 대표 확정 범위는 상세뿐 |
| `/api/group-buy/*` 147곳 · `features/group-buy/api/...` import | API·모듈 경로. 옮기면 공구 기능이 import 에러로 전멸 |
| `ogRoutes.get('/group-buy/:id')` | 마운트 지점이 `/api/og` — 문자열만 같아 보인다 |
| 워커의 `startsWith('/group-buy/')` | 301 이 안 걸린 요청도 첫 화면을 받게 남긴 방어선(R6 이 요구) |
| 날짜 박힌 실측·사건 기록 주석 | 역사 고쳐쓰기 금지. `(당시 주소)` 를 덧붙였다 |

🐛 원안은 **이 구분을 한 번 놓쳤다** — 치환 패턴에 `confirm-payment` 예외를 빼먹어 `successPath` 가
존재하지 않는 `/pass/confirm-payment` 가 됐고, **문자열이라 타입도 빌드도 통과**했다. 돈이 빠져나간
직후에 터지는 자리다. 301 정규식을 `(\d+)` 로 좁힌 것도 같은 이유.

## 가드

`src/tests/unit/pass-route-migration.test.ts` **25건** — R1 예약어(+런타임 배선) · R2 301 생존 ·
R3 결제화면 비휩쓸림 · R4 SSOT · R5 인프라 6종 · R6 서버 첫 화면 ·
**R7 옛 주소 링크 잔존 0**(src 전수 스캔, 문서화된 예외만).
주입 `scripts/mutations/pass-route-migration.mjs` **6건**.

🩸 **R1 이 처음엔 헛돌 수 있는 모양이었다**(머지 뒤 보강). `expect(RESERVED_SLUGS).toContain('pass')`
는 **목록에 이름이 있는지**만 본다 — 런타임 판정(`isMallSlugCandidate`)이 그 목록을 안 보게 바뀌면
**단언은 초록인 채로** `urdeal.kr/pass` 가 남의 가게가 된다. 실제로 주입해 확인했다: 해석기에서
`pass` 만 빼자 목록 검사는 통과하고 **새로 넣은 런타임 호출 검사만** 빨간불이 됐다.
⇒ 교훈은 이 레포가 여러 번 적은 그것과 같다 — **등재된 것 · 쓰이는 것 · 실제로 도는 것은 다르다.**

R7 은 "검사 대상이 200개 미만이면 통과가 아니라 실패" 를 스스로 선언한다(경로가 낡아 조용히 비는 것 차단).

**못 막는 것**: 실제 배포에서의 301(워커 런타임은 유닛 밖) · 카카오 스크랩 캐시에 **이미 박힌** 옛
공유 카드(코드로 못 고친다 — 카카오 캐시가 갱신돼야 한다).

## ✅ E4 판정 통과 — 배포 후 라이브 실측 (2026-09-16, 머지 `377833ccc`)

```
① 옛 주소      curl -I urdeal.kr/group-buy/2888        → 301 → https://urdeal.kr/pass/2888
② 결제 확인    curl -I urdeal.kr/group-buy/confirm-payment → 200 (301 아님 — 휩쓸리지 않았다)
③ 추천 파라미터 .../group-buy/2888?ref=abc123          → 301 → .../pass/2888?ref=abc123  (살아남는다)
④ 서버 첫 화면 urdeal.kr/pass/2888                     → ur-first-screen 1건 (정본에서도 그려진다)
⑤ sitemap      /pass/ 358건 · 옛 urdeal.kr/group-buy/ 0건
```

③ 이 제일 중요하다 — 301 이 쿼리를 떨구면 **추천 적립이 조용히 0** 이 된다(에러가 안 난다).
④ 는 R6 이 막으려던 바로 그것이고, 라이브에서 실제로 그려지는 것을 확인했다.

## ⚠️ 배포 후 확인 (E4) — 위에서 이미 수행함, 재확인용 명령

```bash
curl -sI https://urdeal.kr/group-buy/2888 | grep -i "^HTTP\|^location"   # → 301 · /pass/2888
curl -sI https://urdeal.kr/group-buy/confirm-payment | grep -i "^HTTP"   # → 301 아님(200)
curl -s  https://urdeal.kr/pass/2888 | grep -c 'ur-first-screen'          # → 1 (서버 첫 화면)
curl -s  https://urdeal.kr/sitemap.xml | grep -c '/pass/'                 # → 0 보다 큼
```

그리고 **`?ref=` 가 301 을 건너 살아 오는지** — 워커가 `url.search` 를 이어 붙인다(추천 적립의 전제).
