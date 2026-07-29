# 🗂️ Known Errors 사전 (Quick Match)

> **사용법**: 에러 신고 받자마자 본 표에서 정확한 한국어/영어 메시지 grep. 매칭되면 5분 fix.
> **갱신**: 새 사고 해결할 때마다 표에 1줄 추가 필수.

## 결제 (Toss / Stripe)

| 에러 메시지 (단어 그대로) | 발생 SDK / 함수 | 진짜 원인 | 해결 |
|---|---|---|---|
| `API 개별 연동 키의 클라이언트 키로 SDK를 연동해주세요. 결제위젯 연동 키는 지원하지 않습니다.` | `tossPayments.payment()` V2 | widget 키 (`_ck_`/`_wt_`) + payment() V2 호출 미스매치 | TossPaymentWidget v6 dual-mode (commit `28cbfa39`). gck → payment(), ck → widgets() |
| `API 개별 연동 키를 clientKey로 사용한 경우` | `tossPayments.widgets()` | gck 키 + widgets() 호출 미스매치 | dual-mode 분기로 gck → payment() 라우팅 |
| `결제 위젯 설정 누락 — Toss 콘솔 variantKey 등록 필요` (우리 코드 가공 메시지) | `widgets.renderPaymentMethods({variantKey})` | variantKey 'DEFAULT' 가 Toss 콘솔에 미등록 | `VITE_TOSS_VARIANT_PAYMENT` env 로 실제 등록 이름 매칭 |
| `결제 시스템 로딩 중...` 무한 hang | `widgets.renderPaymentMethods` silent fail | gck 키에 widgets() 호출 시 silent fail. variantKey 미등록도 동일 | dual-mode + 8초 timeout (commit `1824c6a6`) |
| `Idempotency-Key required` | Toss confirm `POST /v1/payments/confirm` | confirmTossPayment 헬퍼 미사용 | `confirmTossPayment()` 헬퍼 호출 강제 (CLAUDE.md 룰) |

## DB / SQL

| 에러 메시지 | 발생 위치 | 진짜 원인 | 해결 |
|---|---|---|---|
| `D1_ERROR: too many columns in result set` — 특정/전체 상세 500 | `SELECT p.*` + JOIN 하는 모든 라우트 (교환권/공구 상세 등) | products 컬럼 누적(ALTER 90+개)이 **D1 결과셋 컬럼 한도(100)** 초과 — 새 컬럼 추가 commit 이 배포되는 순간 '없던 500' 발생 | star-select 금지 → `productDetailCols()` 명시 목록(src/shared/db/product-columns.ts). CI `check-no-select-star-products.sh` 가 차단, repair-schema 가 85개+ 시 column_warnings 경보, 배포 smoke 가 실 id 상세 검증 (2026-06-10) |
| `no such column: orders.commission_rate` | order.repository createOrder | repair-schema 미적용 / 새 컬럼 ALTER 안 됨 | dual-path INSERT (with/without column) + repair-schema 등록 (commit `f69b5e2c`) |
| `no such column: address at offset NN` | OrderRepository.findByIdempotencyKey | SELECT 가 존재하지 않는 컬럼 (`address`, `address_detail`, `notes`) 참조 — production 스키마 컬럼은 `shipping_address` (JSON), `shipping_name`, `shipping_phone`, `shipping_memo` | SELECT 컬럼을 production-schema 기준 정합 (commit `cc60adce`) |
| `GET /api/group-buy/products/<id> 500` (직전 fix 회귀) | `/api/group-buy/products/:id` | SQL WHERE 에 추가한 `group_buy_active` 컬럼이 production 스키마에 존재하지 않음 — `group_buy_status='active'` 만 정합 | SQL 에서 `group_buy_active` 제거, `group_buy_status='active'` 만 유지. product-flow.ts SSOT 도 동일 정합. 교훈: 컬럼 추가 시 production-schema.ts 와 group-buy-types.ts 양쪽 확인 필수 |
| Group-buy / voucher 관련 endpoint 의 SQL 이 `category IN (voucher 7종)` 만 매칭 → `deal_only=1` 인 non-voucher category 상품 404 | `/api/group-buy/products/:id`, `/api/group-buy/join/:id` (2곳) | VouchersPage 필터는 `deal_only=1` 만 — SQL 도 `OR deal_only=1` 추가해야 정합 | 모든 group-buy 관련 SELECT 의 WHERE 절에 `(category IN (...) OR deal_only=1)` 패턴 적용 (commit `df4a417d`). 같은 패턴 3번 발생 — 향후 새 group-buy endpoint 추가 시 동일 필터 적용 필수 |
| Toss SDK V2 `agreementStatusChange` 이벤트 callback 안 불림 → 약관 체크해도 결제 버튼 활성 안 됨 | TossPaymentWidget renderAgreement | `widgets.on('agreementStatusChange', ...)` 호출 → silent fail. SDK 사양: `agreementWidget` 인스턴스 (renderAgreement 반환값) 의 `.on()` 만 작동 | `const agreementWidget = await widgets.renderAgreement(...); agreementWidget.on(...)` 패턴 사용 (commit `e3059583`) |
| 결제 flow 분기 (voucher vs group_buy vs standard) 가 여러 파일에 분산되어 한 곳 수정 시 다른 곳 회귀 | ProductDetailPage / GroupBuyDetailPage / 등 | `VOUCHER_CATEGORY_SET.has()` 직접 사용 — legacy 카테고리 / deal_only / group_buy_active 매칭 누락 | `src/shared/product-flow.ts` SSOT helper 도입: `resolveProductFlow(product)` → `{ flow, config }` (commit `8ccd4d04`) |
| `UNIQUE constraint failed: users.email` | KakaoAuthService.upsertUser | 같은 이메일로 가입된 다른 인증 방식 존재 | `EMAIL_ALREADY_LINKED_TO_OTHER_METHOD` 코드 + 한국어 메시지 |
| `wrong number of bindings supplied` | D1 prepare/bind | SQL `?` 개수 ≠ bind 인자 개수 | `check-sql-bind-params.mjs` pre-commit hook |
| `CHECK constraint failed: status` | orders / streams INSERT | status 값이 enum 밖 (대소문자 / 오타) | orders: 대문자 (`PAID` 등) / payment_status: 소문자 (`approved`) — `docs/SCHEMA.md` |

## 인증 / OAuth

| 에러 메시지 | 발생 위치 | 진짜 원인 | 해결 |
|---|---|---|---|
| OAuth state mismatch | kakao callback | cookie state 불일치 | `kakao_oauth_state` 쿠키 + URL state 검증 (`safeRedirect`) |
| webview 무한 reload | kakaotalk:// scheme | scheme redirect 가드 없음 | `sessionStorage` 가드 (inline + module script 동시) |

## UI / 빌드

| 증상 | 원인 | 해결 |
|---|---|---|
| 모바일 narrow 화면 버튼 viewport 밖 | flex children `min-width: auto` 기본값 | flex container `min-w-0` + input `min-w-0` + button `shrink-0` (commit `b8254733`) |
| `_worker.js` 갱신 안 됨 / worker 코드 변경 안 반영 | `vite build` 단독 사용 | `npm run build` (= client + worker + prepare) 필수 |
| 글로벌 CSS invert 적용 후 UI 깨짐 | 다크모드 invert hack | 사용 금지 (`docs/INCIDENTS.md`) |
| CSP nonce 적용 후 화면 깨짐 | `style-src` 에 `'nonce-XXX'` | 사용 금지. `'unsafe-inline'` 유지 |
| 특정 브라우저에서만 페이지 무한로딩/"응답 없는 페이지"/흰화면 + 콘솔 무에러 (특히 /admin 등 저빈도 대시보드) | 그 브라우저에 잔존한 캐시(낡은 index.html)·캐시형 서비스워커·만료 토큰 상태 — 서버는 정상인데 원격에서 원인 특정 불가 | **사용자에게 `live.ur-team.com/recover` 열게 하기** — SW/캐시/HTML 신선도/청크/토큰/어드민 API 를 자동 진단 + 원클릭 완전복구 버튼. 결과는 `frontend_errors`(type='admin-diag') 에 자동 기록 (2026-07-04, killer-sw.routes.ts) |
| "화면을 새로 불러올게요" 복구 오버레이가 **가끔** 뜨고(주로 배포 직후, `?__cb=` 붙은 URL) 버튼도 무효, **시간 지나면 저절로 정상** | 배포 전파 창 — 새 index.html 은 서빙되는데 새 청크가 엣지에 퍼지기 전(실제 수십 초~수분) 청크 404 반복. 옛 재시도(0.7~2.5s×3회/90s)는 '수초 창' 가정이라 창 안에서 소진 → 오버레이, 버튼 reload 도 창 안이라 또 실패 | 2026-07-27 수리: 지수 백오프 8회/5분(0.7→30s, 로더 상태로 창 통과) + 워치독 유예 억제 + 오버레이 30s 자동 재시도(index.html 부트가드 ↔ chunk-error.ts SSOT 쌍). 재발 시 어드민 `/api/_errors/recent` 의 `[boot-stuck]` beacon(reason/chunkSeen/lastErr)으로 원인 확증 |
| PC F12(DevTools) 모바일 에뮬레이션에서 **카카오 지도 스와이프/팬이 아예 안 됨** (시트/버튼은 정상, 콘솔 무에러) — Windows 터치 노트북 실기기도 동일 | 카카오맵 코어(4.5.13)가 로드 시 입력 모드를 1회 판정: `H = ontouchstart && (!Chrome UA \|\| Android UA)` — H=false 면 **마우스 핸들러만** 바인딩. DevTools 기본 "Responsive"(UA 스푸핑 없음)·터치스크린 데스크톱 Chrome/Edge 는 "데스크톱 Chrome UA+터치" 라 카카오는 마우스만 듣는데 브라우저는 터치만 보냄 | `src/lib/kakao-touch-shim.ts` `attachKakaoTouchShim(el)` — 해당 환경에서만 터치→마우스 합성(탭은 호환 click 위임 → 핀 클릭 보존). useKakaoMap·VoucherMap 배선 완료(2026-07-27, CDP 3시나리오 검증). 새 지도 표면 추가 시 이 헬퍼 부착. 참고: Pixel/iPhone **프리셋** 선택 시엔 UA 스푸핑으로 원래 정상 |

## 환경변수 / 배포

| 증상 | 원인 | 해결 |
|---|---|---|
| `VITE_TOSS_CLIENT_KEY` 와 `TOSS_CLIENT_KEY` 불일치 | Production / Preview tab 분리 설정 누락 | `/api/_healthcheck/payments` 로 사전 감지 |
| Cloudflare Pages deploy 실패 (`Invalid commit message`) | commit message 에 한글 / em-dash / 이모지 | ASCII only 로 변경 |
| GitHub Actions `actions/checkout@v4` 실패 — `could not read Username for 'https://github.com'` | Workflow permissions 또는 GITHUB_TOKEN 권한 부족 | Settings → Actions → General → Workflow permissions → "Read and write permissions" |
| `_headers` 2000자 초과 줄 | 한 줄에 너무 많은 CSP directive | 줄 나눔 |

## 결제 server 측 500 에러

| 증상 | 원인 | 해결 |
|---|---|---|
| `/api/orders` 500 — 어느 단계인지 모름 | 단일 catch 만 있어 stage 불명 | stage 변수 추적 (`auth`/`parse-body`/`db-insert` 등) + `safeError` `_debug` (commit `b7f2749b`) |
| Toss confirm 후 wallet/order 이중 처리 | CAS 가드 없음 | 옵션 B 헬퍼 (`confirmTossPayment` + caller CAS) |

---

## 수집 / 크롤 (유어애즈 파트너 풀 · 도매 제조사 풀)

| 에러 메시지 (단어 그대로) | 발생 위치 | 진짜 원인 | 해결 |
|---|---|---|---|
| `Too many subrequests by single Worker invocation` | `enrichHeldLeads` 크롤 · `runCompanyAutoCollect` · 프랜차이즈 수집 — 어드민 상태줄 **실패 샘플**에 노출 | **한 인보케이션의 외부 fetch + D1 쿼리 합계가 Cloudflare 서브리퀘스트 한도 초과.** 초과 지점부터 **이후 모든 fetch 가 throw** → `.catch(() => '')` 들이 삼켜 `network`/`fetch_fail` 로 뭉뚱그려짐. ⚠️ **예산(env)은 외부 fetch 만 세는데 D1 쿼리도 같은 한도를 먹는다** → 고정 숫자로는 못 막음 | 관측 학습 상한(`collect-budget.ts` `resolveSubreqBudget`/`nextSubreqCap`) 배선 + `safeFetch` 로 한도 신호(`FetchBudget.limitHit`) 관측 → **도장 없이 즉시 중단** + 다음 실행 상한 자동 하향. 레인별 학습 키 분리(`ads_subreq_cap` / `supply_subreq_cap` — 워커가 다르면 한도도 다름). 2026-07-28 PR #784 |
| 크롤 적중률 0% · 사유가 `network`/`페이지 못가져옴` 일색 · `이메일 미게시(no_contact)` **0건** | 어드민 파트너 풀 상태줄 | `no_contact` 0 = HTML 을 **한 장도 못 받음** → 추출이 아니라 **fetch 문제**. 네트워크가 필요 없는 `blocked_host` 만 정상 집계되면 **전역 실패** 확정 | 위 서브리퀘스트 한도 항목 참조. 판별은 **실패 샘플의 예외 이름**으로: `TypeError/Error: Too many subrequests`=워커 한도 · `AbortError`=상대 서버 무응답 · 그 외=DNS/TLS |
| 실패가 전부 `network` 인데 타임아웃인지 한도인지 구분 불가 | `crawlContact` | 예외를 `.catch(() => '')` 로 삼켜 원인 정보가 소멸 | 사유 버킷 분해: `subreq_limit` / `timeout` / `network`(DNS·TLS). **표본 몇 건이 아니라 분포가 원인을 답하게** 한다 |
| 크롤은 도는데 `blocked_host` 비중이 큼(실측 133 중 59 = 44%) | `enrichHeldLeads` Phase 2 | 저장된 `website` 가 블로그·SNS 등 **제3자 도메인** — 크롤은 거부되는데 대상 슬롯을 먹고 7일 쿨다운 도장까지 받음 | `realSite()` 가 `THIRD_PARTY_HOST` 도 걸러 `site=null` → 네이버 **발견 경로로 넘겨** 진짜 홈페이지를 찾게 함(슬롯 회수). `website` 컬럼은 보존(수동 접촉용) |
| 개선했는데 기존 실패분이 재시도되지 않음 | 보강 대상 쿼리 | `enrich_checked_at` **7일 쿨다운**에 갇혀 있음 | **`CRAWL_RULES_VERSION` +1** — 대상 쿼리의 `COALESCE(enrich_v,0) < VERSION` 이 전량을 즉시 재시도 대상으로 되돌린다. 크롤 경로·추출기를 고치면 **반드시 버전 bump**(분류 규칙 `CLASSIFY_RULES_VERSION` 과 동일 철학) |
| 어드민 API 가 `{"success":false,"error":"Forbidden"}` (키 2개, `code` 없음) | 모든 `/api/*` | **봇 감지**(`bot-detection.ts`)가 `curl` 등 비브라우저 User-Agent 차단. `code:'ADMIN_IP_BLOCKED'` 가 있으면 그건 IP 화이트리스트(`admin-security.ts`)로 **다른 원인** | 진단 호출 시 브라우저 User-Agent 헤더 사용(§ CLAUDE.md 어드민 진단 접근) |

## 새 사고 추가 템플릿

```
| `<에러 메시지 단어 그대로>` | <발생 SDK/함수> | <진짜 원인 한 문장> | <해결 방법 + commit hash> |
```

**갱신 룰**: 사고 해결 후 같은 commit 에 본 파일에 1줄 추가 (CLAUDE.md 강제).
