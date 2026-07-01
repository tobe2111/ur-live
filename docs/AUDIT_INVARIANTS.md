# 🛡️ 감사 불변식 레지스트리 (AUDIT INVARIANTS)

> **대표 지시 (2026-06-26)**: "이상적인 상태라면 더는 이후 감사에선 보지 않고 넘어갈 수 있도록 환경 설정을 해줘."
>
> 한 번 깨끗하다고 확인된 영역의 불변식을 **결정론적 가드로 박아 기계가 지키게** 한다.
> 미래 세션은 수동 전수감사 대신 **`bash scripts/audit-gate.sh`** 를 돌려, GREEN 도메인은 가드를
> 신뢰하고 **재감사를 건너뛴다**. RED 만 보면 된다.

## 🚦 한 줄 점검

```bash
bash scripts/audit-gate.sh           # 전체 (39개 불변식)
bash scripts/audit-gate.sh money     # 특정 도메인만 (separation|auth|money|schema|classify|ui|structure|deploy)
```

- **ALL GREEN** → 아래 표의 "감사 스킵" ✅ 도메인은 수동 재감사 불필요. 그 영역의 *새 코드*만 가드가 통과하는지 보면 됨.
- **RED** → 그 가드가 가리키는 사이트만 재감사/수정. 전수조사 불필요.
- 가드가 **없는** 영역(아래 "🔍 가드 미보유")만 수동 감사 대상.

## ✅ 감사 스킵 가능 도메인 (가드 GREEN = 신뢰)

| 도메인 | 불변식 (무엇을 보장) | 지키는 가드 | 마지막 수동 전수감사 |
|---|---|---|---|
| **서비스 분리** | 도매몰↔유어딜↔유어애즈 3-서비스가 안 샘: 교차역할 API 0(유어애즈 `/api/ads` 포함), 도매 어드민 스코프 내, 소비자 상품조회가 도매 원본 격리, 유어애즈가 도매 폴더에 비의존(공용 인프라는 `@/worker/utils/seller-auth`·`@/services/naver-commerce-core`), **대시보드 라우팅이 다중역할/겸업 계정을 lock-out 안 함(대시보드 레이아웃/페이지가 가산 권한 플래그 `is_*` 단독 게이트로 서비스간 redirect/return null 0 — 셀러↔도매=서버권위 `wholesale_only`, 또는 다중역할 보호 동반조건 `!loggedIn`/단일역할 `role !==`)** | `check-dashboard-api-crossrole`(5그룹) · `check-wholesale-admin-api-scope` · `check-wholesale-admin-nav-reachability` · `check-consumer-product-supply-isolation` · `check-seller-wholesale-redirect` | 2026-06-30 (셀러 대시보드 겸업 lock-out fix + 신규 가드: is_distributor=capability ≠ exclusivity, computeWholesaleOnly SSOT) |
| **인증·세션·RBAC** | 역할-한정 403 0, 유저↔대시보드 상호 로그아웃 0, OAuth iOS 영속, dead-link 0, 권한 누락 0, **로그인 유도는 토큰으로만(가격 null/0 을 로그아웃으로 오판 0)**, **도매 로그아웃 유지(자동 재로그인 probe 가 명시 로그아웃 무력화 0)**, **도매 엣지캐시 인증 누수 0(비로그인 public CDN 캐시가 로그인 판매사에 서빙 → '공급가 미설정' 0)** | `check-dual-login-guard` · `check-dashboard-login-session-coexist` · `check-auth-cookie-pattern` · `check-internal-links` · `check-api-auth` · `check-light-input-guard` · `check-login-gate-by-price` · `check-wholesale-autologin-guarded` · `check-wholesale-login-spa-navigate` · `check-wholesale-cache-auth-leak` | 2026-06-29 (도매 엣지캐시 인증 누수 — 인증별 응답 public 캐시는 캐시키 분리(cache-auth-ok) 필수, 클라 v=in 부착) |
| **머니·정합성(패턴)** | CAS-선점/무환불 CANCELLED/빈화면-위장/CSV 인젝션 안티패턴 0 | `check-money-patterns` · `check-status-constraints` · `check-query-iserror` · `check-csv-injection` | 2026-06-26 (정산 clean·결제 셀프취소 latent 별도) |
| **DB·스키마** | 컬럼/bind/NOT NULL/SELECT* /컬럼예산/복구가능성 정합 | `check-schema-refs` · `check-sql-*` · `check-no-select-star-products` · `check-products-column-budget` · `check-product-detail-fields-repairable` | (상시 가드) |
| **런타임 크래시(pagination NaN)** | request page/limit/offset/days 등이 비숫자('abc')일 때 `parseInt/Number → NaN → SQL .bind(NaN) → 500` 금지(전 서비스 목록 엔드포인트) — 정수 파싱은 `intParam(raw, def)`(`@/shared/pagination`) 경유 강제(0/음수 클램프 보존). ID 해석 parseInt(isNaN 가드 보유)는 무관 | `check-pagination-nan` | 2026-07-01 (도매몰 라이브 전수조사 — `/api/wholesale/catalog?page=abc` 500 발견 → 전 서비스 100+ 라인 intParam 전환 후 가드) |
| **상품 종류·라우팅** | group_buy_status 로 종류판별·라우팅 금지(쇼핑↔교환권 오분류) | `check-groupbuy-status-classify` | (상시 가드) |
| **도매주문 상태머신** | wholesale_orders.status 가 canonical 집합만(정의 밖 오타/고아 상태 write 0) — 전이는 transitionWholesaleOrder | `check-wholesale-order-status` | 2026-06-27 (B2B 플로우 상태머신 신설: 수락/거절/취소/구매확정 + 발송 전 정산보류) |
| **UI·테마·첫페인트** | dark variant 일관성, RQ initialData 신선도, 모바일 하단잘림 | `check-theme-consistency` · `check-query-initialdata` · `check-mobile-viewport` | 2026-06-26 (크래시/빈상태 clean) |
| **코드 구조(god 파일 방지)** | 신규 파일 600줄 초과 차단 + 기존 대형 파일이 `file-size-baseline.json`(82개 동결)보다 성장 시 차단(줄이는 건 OK) → god 파일 재발 0 | `check-file-size` (래칫, `--rebaseline` 로 동결값 갱신) | 2026-06-29 (대표 "리팩토링 반복 말고 애초에 막아라" — MyVouchersPage 1296→386·GroupBuyListPage 1309→827 분해 후 동결) |
| **빌드·배포 안전** | vite 단독빌드/405 라우터/SW등록/하드코딩 시크릿 금지 | `check-build-command` · `check-router-patterns` · `check-no-sw-register` · `check-no-secrets` | (상시 가드) |

> "마지막 수동 전수감사 = 2026-06-26" 인 도메인은 그날 5개 병렬 에이전트 + 코드 재검증으로 전수조사 완료.
> 그 결과를 위 가드로 박았으므로, **다음 세션은 가드 GREEN 이면 그 도메인을 다시 전수조사하지 말 것.**

## 🔍 가드 미보유 (= 아직 수동 감사 대상)

가드로 박기 어려운(런타임·문맥 의존) 잔여 영역. 새 작업이 이걸 건드리면 수동 확인.

| 영역 | 왜 가드 어려움 | 대안 |
|---|---|---|
| 결제 환불/취소 **금액 정확성** (셀프취소 ↔ refundOrderFully 대칭) | 머니 *흐름*은 정적패턴으로 안 잡힘 | `check-money-patterns`(패턴만) + staging 실결제 1회 (CLAUDE.md 룰) |
| 신규/빈/로그아웃 **런타임 크래시** | 훅순서/null deref 는 런타임 | 2026-06-26 AST 분석으로 clean 확인. 새 페이지는 `?? []`·`formatNumber`·early-return前 훅 규칙 준수. (pagination NaN 크래시 클래스는 이제 `check-pagination-nan` 로 가드 — 위 표) |
| 외부 PG/카카오/Toss **실응답** | 외부 의존 | staging smoke + 진단 엔드포인트 |

## 📋 2026-06-26 전수감사 결과 (5도메인 병렬)

| 도메인 | 결과 | 조치 |
|---|---|---|
| 인증·RBAC·리다이렉트·IDOR | ✅ clean | 가드 GREEN → 스킵 등록 |
| 신규/빈/로그아웃 크래시 | ✅ clean (AST 검증) | 구조적 방어 확인 → 스킵 등록 |
| 서비스 분리 | 🔴 단건 ID 누수 1건 | **fix + 신규 가드** `check-consumer-product-supply-isolation` |
| 정산·지급 | 🟡 low 2건 | 인플 원천징수 하드코딩 → SSOT fix / 제조사 출금가능 표시 → TECHNICAL_DEBT |
| 결제 셀프취소 | 🔴 3건 (쇼핑 숨김 gated, latent) | TECHNICAL_DEBT 등록 + 쇼핑 재오픈 전 fix (staging 검증 필수) |

## 규칙 (이 레지스트리 유지보수)

1. 새 불변식 가드를 만들면 → `audit-gate.sh` 에 추가 + 이 표에 등록.
2. 수동 전수감사를 한 도메인은 → "마지막 수동 전수감사" 날짜 갱신.
3. 가드가 못 잡는 새 사고가 나면 → 가드부터 만들고(애초에 없도록) 이 표 + `audit-gate.sh` 갱신.
4. 미래 세션 감사 요청 시: **먼저 `audit-gate.sh` 실행 → GREEN 도메인 스킵, RED·미보유 영역만 작업.**
