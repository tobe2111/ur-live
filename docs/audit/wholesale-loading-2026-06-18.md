# 유통(도매) 상품 로딩 전수조사 — 2026-06-18

배경: 대표 신고 "도매몰 `/wholesale` 전체 상품 로딩이 너무 느림(상품 카드가 ~5분 뒤 등장), 상품이 안 뜨거나 왔다갔다". + 질문 "유통사 등급에 따라 상품 노출이 결정된다는 거 인지하고 있나?".

조사 방법: 코드 전수(클라 쿼리/SSR/모든 서버 엔드포인트/캐시·프리웜 레이어/등급·노출 touchpoint). **라이브 실측은 불가** — 이 실행 환경이 `live.ur-team.com` egress 차단(403).

---

## 핵심 결론 2가지

### 1) 등급(distributor_grade) → 상품 노출 = **현재 코드에 구현 안 됨** (확인)
- `distributor_grade`(sellers 컬럼)는 **어떤 노출 WHERE 절에도 없음**. 용도는 전부 **가격**(`resolveDistributorPrice`의 margin_pct)·등급관리뿐.
- 노출은 100% 다음 둘로만 결정:
  - `products.supply_visibility` ∈ {`ALL`, `APPROVED_CHANNEL`, `UTONGSTART_ONLY`} (기본 `ALL`)
  - `product_distributor_access` 허용목록 — **관리자/제조사가 특정 유통사를 1명씩 수동 INSERT** (등급 자동 산정 아님)
- products에 등급 게이팅 컬럼(`min_grade`/`required_grade`/`visible_grades`/`tier`) **없음**.
- 근거: `supply-visibility.ts:189-192`(visibilityWhere), `distributor-admin.routes.ts:642`·`supplier-dashboard.routes.ts:540`(allowlist 수동 INSERT), `repair-schema.routes.ts`(게이팅 컬럼 0건), `distributor-admin.routes.ts:59-87`(등급=마진만).
- **시사점**: 상품을 `APPROVED_CHANNEL`/`UTONGSTART_ONLY`로 바꿔놓고 허용목록을 안 채우면 → 그 상품은 **모든 유통사에게 안 보임** → "특정 유통사 빈 카탈로그"의 유력 원인. "등급 B면 이 상품군 자동 노출" 같은 모델을 원하면 **신규 구현 필요(설계 결정 대기)**.

### 2) 느림/빈결과의 구조적 원인 (확인된 것)
| # | 원인 | 근거 | 영향 |
|---|---|---|---|
| 1 | **프리웜 origin 불일치** — cron이 `live.ur-team.com`만 데움. 실사용은 `utongstart.com`. `caches.default`는 origin별 키 → utongstart는 프리웜 혜택 0 | `cache-prewarm.ts:98` vs `wholesale.routes.ts:1109,1359` | utongstart 저트래픽 시 매 요청 cold D1. **5분 cron 주기**와 수치 일치 |
| 2 | **`/catalog` 목록에 edge-cache 미들웨어 미적용** — `edgeCache(120)`이 `/catalog/*`(상세)만 매치, 목록 제외 | `index.ts:1347` | 목록은 핸들러 내부 caches.default 수동 로직에만 의존 |
| 3 | **SSR self-fetch timeout 1500ms** — cold isolate가 초과하면 주입 실패 → 클라가 처음부터 fetch | `index.ts:564,582` | 첫 페인트 지연(초 단위) |
| 4 | **COALESCE 인덱스 무력화** — `COALESCE(p.mall_id,1)=?`, `COALESCE(supply_price,0)>0` 등이 `idx_products_mall_supply` 미사용 유발 → products 풀스캔 | `wholesale.routes.ts:1204,1224` / 인덱스 `:227` | 상품 수↑ 시 쿼리시간↑, cold일수록 체감 |
| 5 | **mall_id=0 / supply_source_id=0 → 빈 결과** — 일부 등록경로가 0을 남김. 카탈로그는 `COALESCE(mall_id,1)=1`(0 제외)·`supply_source_id IS NULL`(0 제외) | `wholesale.routes.ts:1204` | self-heal UPDATE 추가됨(아래 조치) |
| 7 | **보조 훅 빈-결과 위장** — `useWholesaleHome` 등이 오류를 `[]`로 삼킴 → staleTime(60s) 빈 고착 | `useWholesale.ts:199` | 로그인 레일만 해당(게스트 메인 그리드 무관 — 메인 `catalogQ`는 이미 throw로 수정됨) |

**빈-결과 캐시 영구고착은 코드상 차단돼 있음**(guest 빈→no-store `:1351`, 등급캐시 빈→skip `:1372`, SSR 빈→consume 안함 `ssr.ts:16`, 스키마/COUNT 오류→throw `:1155`). 따라서 "빈 채로 영구"보다는 **cold-slow 반복**이 주증상.

**"정확히 5분"은 코드만으로 단정 불가** — 정상 단일요청 경로는 ≤약 51s(api timeout 15s × retry). 5분은 prewarm 주기(원인1)와 일치하거나, 페이지가 빈/실패 상태로 머물다 다음 주기에 풀린 정황. **확증엔 라이브 1회 실측(egress 또는 X-WS-* 헤더) 필요.**

---

## 조치 (이 세션)
- `[done]` `supply-visibility.ts` ensure에 `mall_id=0→1` 멱등 정규화 추가 (원인5 자가치유) — commit dc0c290.
- `[done]` `cache-prewarm.ts` — 도매 path를 `utongstart.com` origin으로도 데움 (원인1) — 이 커밋.

## 남은 권장 (승인/실측 대기)
- **(설계)** 등급 기반 노출을 원하면 신규 구현 — products에 `min_grade`(또는 등급셋) + visibilityWhere에 `OR (등급 >= p.min_grade)` 추가, admin UI. **대표 결정 필요.**
- **(perf 근본)** 저트래픽 도매 카탈로그를 전 지역 즉시화하려면 게스트 카탈로그를 **글로벌 KV 캐시**(cron write + SSR/엔드포인트 KV-first read)로. `caches.default`는 colo별이라 저트래픽은 상시 cold. KV write량은 미미(<무료한도). **라이브 검증 불가 상태라 승인 후 진행 권장.**
- **(index)** mall_id 정규화 완료를 전제로 `COALESCE` 제거 + 부분 복합 인덱스 — 단 WHERE 변경은 결과 영향 가능, 실측 후 진행.
- **(SSR)** WHOLESALE self-fetch timeout 1500→2000ms 검토(밴드에이드).
