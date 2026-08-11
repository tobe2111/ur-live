# 2026-08-11 — 소비자 전면 AB 스윕 (브라우저 프록시 돌파 + 죽은 cron 부활)

> 대표: *"테스트 계정 만들어서 전체적으로 AB테스트 유어딜 해주면 안돼? 그리고 에러나 개선점 찾아주고."*
> → *"모두 빠짐없이 다 AB테스트 진행해줘. 개선점 빠짐없이 끝까지."*

## 0. 다음 세션의 첫 액션

```bash
# ① 데모 사진 정비가 실제로 도는지 — 이번 배포의 핵심 판정
#    (이전엔 하트비트가 아예 없었다. 지금은 매시 :25 에 찍혀야 한다)
curl -sS "https://live.ur-team.com/api/admin/cron-heartbeats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print([x for x in d if 'demo-image' in str(x)][:2])"

# ② v4 재조정 수렴 — 294건이 demo_cond_v=3 에 멈춰 있었다. 줄어들어야 한다(시간당 3건)
#    D1: SELECT COALESCE(m.value,'(미처리)') v, COUNT(*) n FROM products p
#        LEFT JOIN product_supply_meta m ON m.product_id=p.id AND m.key='demo_cond_v'
#        WHERE p.slug LIKE 'demo-%' GROUP BY 1

# ③ 한글 파일명 사진 404 수리 확인
curl -sS -o /dev/null -w '%{http_code}\n' "https://urdeal.kr/cdn-cgi/image/width=900,quality=85,format=auto,onerror=redirect/https://ldb-phinf.pstatic.net/20260618_1/1781789159233fqISB_JPEG/%25B8%25DE%25B4%25BA%25C6%25C7_-001_-_4.jpg"
# → 200 이면 수리됨 (이전: 원본 % 그대로 넣으면 404)
```

## 1. 🔓 브라우저가 프록시를 뚫는 법 — **원인은 프록시가 아니라 TLS 1.3**

여러 세션이 *"이 환경은 브라우저가 프록시를 못 뚫어 스크린샷을 못 찍는다"* 고 인계해 왔다.
**그 판정이 틀렸다.** `--proxy-server` 를 줘도 `ERR_CONNECTION_RESET` 이 나던 것은 **TLS 1.3 핸드셰이크**
때문이고, 1.2 로 낮추면 그냥 된다:

```
ech-off / quic-off  → ERR_CONNECTION_RESET
--ssl-version-max=tls1.2 → OK 200   ←
```
```js
chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-quic','--ssl-version-max=tls1.2',
         '--disable-features=EncryptedClientHello,UseDnsHttpsSvcb,UseDnsHttpsSvcbAlpn,PostQuantumKyber'],
  proxy: { server: 'http://127.0.0.1:38871' },   // = $HTTPS_PROXY
})
```
⇒ **라이브 클릭 테스트가 된다.** 이 세션의 결함 대부분은 이걸 뚫고 나서야 보였다.
⚠️ 다만 **카카오 OAuth 는 여전히 불가**(실제 계정 자격이 필요) → 로그인 후 화면은 못 본다.
"테스트 계정 만들어서"는 이 환경에서 **수행 불가**이고, 그래서 비로그인 전수 + API + D1 로 대신했다.

## 2. 완료 (커밋/PR)

| 항목 | 커밋 |
|---|---|
| 죽은 cron 슬롯 4개 부활 (죽은 cron 20 → 7) | `66e6db9` |
| 딜 충전 실패 화면 막다른 길 수리(메인으로 + 종료 중엔 재시도 숨김) | 이 커밋 |
| `/meal-vouchers` 301 · `/introduce` 라이브커머스 액자 제거 · 404 오배선 · 사진 `%` 404 | 이 커밋 |

### 2-a. 죽은 cron — **이번 세션 최대 발견**

`scheduled.ts` 에 `if (cron === '0 * * * *')` 같은 블록이 있었지만 그 표현식들은 **`wrangler.toml` 에
등록된 적이 없다.** 에러도 하트비트도 없이 그냥 안 돌았다.

```
💀 0 * * * *    7개   demo-image-rehost, demo-name-heal, 셀러승인 리마인드, 재입고알림 …
💀 0 3 * * *   13개   KT카탈로그, 지오코딩, R2정리, 이미지헬스, 예약/이용권 만료 알림 …
💀 0 9 * * *    8개   숙소·예약 리마인더, 이용권 만료, 상권쿠폰 만료 …
💀 */2          1개   bulk-email-drain
```
**직접 피해**: 2026-08-08 에 배포한 데모 사진 규칙(#1099)이 **한 장도 적용되지 않았다**
(294건이 `demo_cond_v=3` 정체, 현재 규칙 v4).

**고친 방법**: 계정 cron 트리거 한도가 5개(ur-live 4 + ur-ads 1)라 늘릴 수 없어, 살아 있는 `*/5` 틱에서
**분 게이트**로 원래 주기를 복원했다(`src/worker/cron-slot.ts`). 분을 그룹마다 다르게 준 이유는
**서브리퀘스트 예산(무료 50)이 인보케이션 단위**라서다 — 한 분에 몰면 뒤쪽이 조용히 잘린다.

⚠️ **손대지 않은 것**: `0 0 * * 1`(주간) 블록 7개. `payouts-generate`(주간 정산 생성)가 들어 있는
**머니 경로**라 CLAUDE.md 룰상 단독 세션 + 대표 판단이 필요하다. → §4

### 2-b. 소비자 결함 4건

| 증상 | 진짜 원인 |
|---|---|
| `/meal-vouchers` 가 "상품이 없습니다" | `BrowsePage` 의 `exclude_deal_only=1` 이 **이용권 카테고리를 통째로 제외**(`ProductRepository:169`) → 구조적 영구 0건. 데이터는 224건 있었다 |
| PC 회사소개 대문이 "LIVE COMMERCE" | `/introduce` 를 **폐기된 라이브커머스 액자**(`GripFrameLayout`)로 감쌌다. 진짜 회사소개는 폰 액자 안으로 밀림(PC 430자 ↔ 모바일 1,852자). 그 안 `회사소개서 보기` 도 PDF 없이 SPA 셸을 열던 깨진 링크 |
| 404 의 `공동구매` 칩이 추천수익으로 | 라벨 3개가 전부 낡음 — `라이브`(영구중단) · `맛집딜`(폐기 명칭) · `공동구매`→**`/referral`** 오배선 |
| 데모 상세 갤러리 사진 안 뜸 | 한글 파일명 사진의 URL 은 이미 EUC-KR 퍼센트 인코딩인데, 그걸 cdn-cgi **경로**에 그대로 박으면 리사이저가 디코딩해 404. **`onerror=redirect` 도 안 걸린다**(404 를 리사이저가 직접 반환). 활성 상품 **134개** 영향 |

## 3. 이번에 틀렸던 판단 (같은 오진 반복 방지)

1. **"브라우저가 프록시를 못 뚫는다"** — 여러 세션이 그렇게 인계했고 나도 처음엔 그렇게 보고했다.
   실제 원인은 TLS 1.3 이었다. **막혔다고 단정하기 전에 계층을 분리해 찔러볼 것**(A: localhost OK /
   B: 프록시+대상 RESET / C: 다른 호스트는 TUNNEL_FAILED → 에러 코드가 서로 다르면 원인도 다르다).
2. **API 실패 2건이 내 스크립트 버그였다** — `/api/search/suggestions?q=커피` 400 은 **한글 미인코딩**,
   `/api/stays/list` 404 는 **없는 경로**(`/api/group-buy/...` 아래). 서버는 멀쩡했다.
   ⇒ 실패를 보고하기 전에 **curl 로 한 번 더** 재현할 것.
3. **테스트 헬퍼가 파일을 삼켰다** — `code()` 의 `/\/\*[\s\S]*?\*\//` 가 `worker/index.ts` 의 `'/api/*'`
   **문자열**을 주석 시작으로 먹고 뒤쪽을 통째로 지워, 실재하는 배선을 "없다"고 판정했다.
   ⇒ 이 레포에서 소스를 정규식으로 읽을 때 **블록주석 제거는 하지 말 것**(줄 단위 `//` 제거로 충분).
4. **`git add -A` 타이밍** — `audit-gate.sh` 는 `check-guard-mutations` 를 **포함**한다(결함을 실제로
   주입한다). 이 세션에서 그게 도는 동안 커밋할 뻔했다. ⇒ 커밋 전 `pgrep -f check-guard-mutations`.

## 4. 남은 결정 / 대기 (대표 판단)

1. **🔴 주간 cron 7개를 살릴 것인가** — `payouts-generate`(주간 정산 생성)·주간 리포트·블로그 AI 초안.
   지금 백로그는 **0**(payouts 0건 · 만료 대기 이용권 0건 · 예약 0건)이라 당장의 피해는 없지만,
   **실거래가 시작되면 그날부터 정산이 자동 생성되지 않는다.** 머니 경로라 단독 세션 권장.
2. **데모 사진 정비가 처음 돌 때** — v4 규칙은 근거 없는 사진(언론사·스톡·일반검색)을 버리고,
   사진을 못 구한 데모는 `is_active=0` 으로 **내린다**. 시간당 3건이라 급락은 없고(334건 ≈ 4.6일),
   사진이 다시 잡히면 **자동 복귀**한다. 그래도 이용권 매대 개수가 줄어드는 것은 대표가 알아야 한다.
3. **이용권 실결제 1회** (기존 대기) — baseline: order 88 / product 2847 / ledger 2행.

## 4-b. 다크모드 — 전 표면 실측 (2차 스윕)

`localStorage.ur_theme_mode_v1='dark'` 로 16개 표면을 실제 렌더해 **WCAG 대비비**를 계산했다.
결과: **진짜 다크모드 결함 0.** (`html.dark` 적용 · `body bg rgb(12,13,16)` 전 표면 일관)

플래그 4건은 전부 오탐으로 판정했다 — 근거:
- `/browse`·`/u/…` 의 "16%" 할인 배지 → **스크린샷 확인 결과 잘 보인다.** 내 배경 추정이 이미지 위
  요소에서 부모 카드색 대신 엉뚱한 값을 잡았다.
- `/map`·`/blog` 의 흰-글자-흰-배경 → 내용이 **이모지 한 글자**(💇 ✨). 이모지는 글리프 자체 색이라
  `color` 와 무관하다.
- `/group-buy/:id` 의 "100m" → **카카오맵 SDK 가 그리는 축척 라벨**(검정 고정). 우리 CSS 밖.

⚠️ **이 스윕이 처음 돌 때 전 라우트가 초록으로 떴는데 그게 거짓이었다** — 세션 재개로 프록시 포트가
`38871 → 35341` 로 바뀌었는데 스크립트가 하드코딩이라 `ERR_PROXY_CONNECTION_FAILED` 였고,
"저대비 0건"이 **계측 0건**이었다. ⇒ 스윕 스크립트는 `process.env.HTTPS_PROXY` 를 읽게 고쳤고,
**계측이 안 되면 초록 대신 ⚠️** 를 찍도록 바꿨다. (이 레포가 반복해 만난 "측정0=통과" 함정.)

## 4-c. 사진 규칙의 한계 (대표 판단 필요)

사진 폴백은 **"그 매장이 맞는가"만 보고 "상품 종류가 맞는가"는 안 본다.** 실측:

```
demo-deal(매장 이용권)  254   ← 지도 대표사진이 맞다
demo-stay(숙소)          72   ← 맞다 (다만 천장·형광등 컷 같은 매력 없는 사진이 섞인다)
demo-linkshop(쇼핑 상품)  8   ← 🔴 안 맞는다
```
`demo-linkshop-*` 는 **포장 식품**(참기름 선물세트·쌀조청·어묵탕 밀키트·갈치)인데 사진은 그 매장의
**홀/외관 사진**이다. 지도에서 온 사진이라 v4 규칙(근거 있는 사진)은 **통과**한다 — 규칙이 못 잡는 축이다.
선택지: ⓐ 현상 유지 ⓑ 매장 사진뿐이면 그 8개를 내린다 ⓒ 상품 사진 소스를 따로 붙인다.

## 5. 개선 여지 (결함은 아님)

- `/gb-market` 은 비로그인인데 `/api/gb-proposals/mine` · `/api/gb-marketplace/my-performance` 를
  호출해 401 두 번. 코드상 의도적 fail-soft(`catch { /* 비로그인 */ }`)지만 토큰 없으면 건너뛰는 게 낫다.
- `/api/search/popular` 가 항상 빈 배열(`popular_searches` 미적재).
- `/ads` 가 `cdn.jsdelivr.net` 폰트를 부르는데 **404**(유어애즈 축 — 별개).
- `/u/<형식이 틀린 핸들>` 은 API 가 400 을 줘서 `shouldNoindexMissingEntity`(404 만 처리)에 안 걸린다
  → 200 + 빈 화면. 유효 형식이면 정상 404 다(실측 확인).

## 6. 스윕 범위 (실측)

- 라우트 **97개 모바일 + 38개 PC** 전수 · 상세/엣지 **21개**(`?page=abc`, 없는 id, 없는 핸들 포함)
- 판정 축: HTTP · 콘솔/페이지 에러 · 4xx 네트워크 · 깨진 이미지 · raw i18n 키 · 가로 넘침 · 빈 화면
- **PAGEERR 0 · raw i18n 키 0 · 가로 넘침 0** — 이 세 축은 전 표면 깨끗했다.
- 없는 엔티티 404(2026-07-29 수리)와 `?page=abc` 방어(2026-07-01 수리)는 **라이브에서 정상 동작 확인**.
