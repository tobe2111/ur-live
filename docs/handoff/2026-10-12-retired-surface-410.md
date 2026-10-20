# 2026-10-12 — 철거된 도매몰 URL 을 410 Gone 으로 (SEO)

**[E2 검증됨]** 대표 *"SEO 측면에서 말이야 어떻게 해야하는지 알려줘"* → ***"모두 해줘"***.

## 다음 세션의 첫 액션 — E4 판정 (배포 후)

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
for p in /wholesale /wholesale/intro /wholesale/join /wholesale/oem /supplier; do
  printf '%s ' "$p"
  curl -sS -o /tmp/w.html -w '%{http_code}\n' -A "$UA" "https://urdeal.kr$p"
done                                   # ← 전부 410 이어야 한다

# 메타 — robots noindex / 도매 브랜드·utongstart canonical 0건
curl -sS -A "$UA" https://urdeal.kr/wholesale \
  | grep -oE '<meta name="robots"[^>]*>|유통스타트 도매몰|utongstart|rel="canonical"[^>]*' | sort | uniq -c

# 🔴 소비자 표면이 200 인지 (판정이 살아 있는 표면을 삼키지 않았는지 — 가장 큰 사고 방향)
for p in / /vouchers /browse /map /pass/2919 /u/jiwon1228 /blog; do
  printf '%s ' "$p"; curl -sS -o /dev/null -w '%{http_code}\n' -A "$UA" "https://urdeal.kr$p"
done                                   # ← 전부 200
```

⚠️ **색인에서 실제로 빠지는지는 우리가 못 잰다** — 수일~수주 걸리고 판정은 **서치콘솔·네이버
서치어드바이저**에서 **대표만** 볼 수 있다. 여기서 재는 것은 *"우리가 정직한 신호를 주고 있는가"* 까지다.

## 완료분

| | 무엇 | 파일 |
|---|---|---|
| ① | `isRetiredSurface` SSOT + 워커가 **410 Gone** | `worker/utils/surface-ssr-meta.ts` · `worker/index.ts` |
| ② | robots.txt 의 "공개 인덱스 대상" 초대 제거 (**Disallow 는 추가하지 않았다**) | `public/robots.txt` |
| ③ | 도매 브랜드 메타·`utongstart.com` canonical 주입 제거 | `worker/index.ts` |
| ④ | `WHOLESALE` SSR 슬롯 + 3000ms 타임아웃 제거 | `worker/index.ts` · `worker/utils/ssr-payload.ts` |
| ⑤ | utongstart sitemap 브랜치 제거 | `worker/routes/sitemap.routes.ts` |
| ⑥ | utongstart 오리진 예열 4경로 제거 (서브리퀘스트 예산 +4) | `worker/cron/cache-prewarm.ts` |

가드 `src/tests/unit/retired-surface-410-2026-10-12.test.ts` **29건** + 주입
`scripts/mutations/retired-surface-410.mjs` **10건 전부 빨간불 확인**. tsc 0.

## 이번에 틀렸던 판단 (같은 오진 반복 방지)

1. **대표에게 "⑤ sitemap — 손댈 것 없음" 이라고 보고했는데 틀렸다.** urdeal.kr sitemap(453건)엔
   wholesale 이 0건인 게 사실이지만, **별도의 `utongstart.com` 호스트 브랜치**가 네 URL 을
   `priority 1.0~0.7` 로 발행하고 있었다. *"한 sitemap 을 봤다"* 와 *"sitemap 라우트를 읽었다"* 는 다르다.
2. **측정자 오류 4번째** — sitemap 응답 헤더를 `head -25` 로 떴더니 거대한 CSP 헤더에 잘려
   `content-encoding: gzip` 이 안 보였고 "압축 없음" 으로 보고할 뻔했다. ⇒ **0 이 나오면 측정기를 먼저 의심.**
3. **TTFB 0.56~1.5s 를 "느리다" 로 읽을 뻔했다** — 같은 창에서 `/api/version` 이 1.3s 였다.
   이 중계 환경의 편차가 지배한다. **절대 ms 로 성능을 판정하지 말 것.**
4. **가드 단언이 제 주석을 물었다 — 두 번 연속.** 지운 문구를 원문에서 찾는 단언을 쓰면, *지웠다고
   기록하는 주석이 그 문구를 인용*해 거짓 빨간불이 난다. ⇒ **제거를 기록하는 주석과 제거를 검사하는
   단언은 같은 문자열을 공유할 수 없다.** 판정은 주석을 뺀 **실행되는 줄**로.
5. **주입이 가드의 눈먼 자리를 잡았다** — `goneStatus` 의 **계산**만 단언해서, 그 값을 쓰는 쪽을
   `c.res = false ? …` 로 중성화해도 통과했다. **계산과 사용은 다른 자리다.**
6. `site:` 검색은 이 환경 WebSearch 에서 **동작하지 않는다**(미국 일반 검색). 색인 현황은 측정 불가.

## 남은 것 (이번 범위 밖 — 전부 보고만 했다)

- 🔴 **`/u/존재하지않는핸들` → 200 + `index, follow`**. `X-SSR-Status: CURATOR:self-fetch-400` 인데
  `shouldNoindexMissingEntity` 는 `self-fetch-404` 만 본다 → **없는 유어샵이 색인 가능**하다.
  (워커가 400 을 주는 쪽을 고치는 게 맞는지, 판정에 400 을 더하는 게 맞는지 먼저 판단할 것 —
  400 은 "핸들 형식이 틀렸다" 일 수도 있어서 404 와 뜻이 다르다.)
- **크롤러 전용 canonical 중복** — 봇 셸이 한 벌 내고 `applySurfaceMeta` 가 `el.append()` 로 한 벌 더
  (실측 iPhone 1 · Yeti 2 · Googlebot 2). 11개 표면 중 10개는 **값이 같아** 지금은 무해하고,
  갈려 있던 유일한 표면이 `/wholesale` 이라 이번에 사라졌다.
- **`WHOLESALE_HOSTS` 호스트 라우팅은 일부러 남겼다**(`worker/index.ts` 2533·2619) — 공구 서비스
  다중몰 조회(`wholesale_malls` — **이름만 wholesale**)와 한 덩어리다. 떼려면 그쪽을 먼저 갈라야 한다.
- **잠든 지뢰**: 살아남은 `/wholesale` 리다이렉트 3곳(`SellerLoginPage`·`MobileAppLayout`·`SellerLayout`).
  라이브 `sellers` 13행 중 **판매사 0** 이라 그 길을 타는 사람이 없다(끊긴 기능이 아니다).
- `scripts/wholesale-smoke.sh` — 어디에도 배선돼 있지 않은 수동 스크립트인데 죽은 라우트를 두드린다.
- **대표 판단 대기**: 다국어/hreflang(0건 — 제 의견은 "한국어 색인이 먼저") · `llms.txt`(404, 비표준).
