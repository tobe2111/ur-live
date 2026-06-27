# 🛡️ 감사 불변식 레지스트리 (AUDIT INVARIANTS)

> **대표 지시 (2026-06-26)**: "이상적인 상태라면 더는 이후 감사에선 보지 않고 넘어갈 수 있도록 환경 설정을 해줘."
>
> 한 번 깨끗하다고 확인된 영역의 불변식을 **결정론적 가드로 박아 기계가 지키게** 한다.
> 미래 세션은 수동 전수감사 대신 **`bash scripts/audit-gate.sh`** 를 돌려, GREEN 도메인은 가드를
> 신뢰하고 **재감사를 건너뛴다**. RED 만 보면 된다.

## 🚦 한 줄 점검

```bash
bash scripts/audit-gate.sh           # 전체 (30개 불변식)
bash scripts/audit-gate.sh money     # 특정 도메인만 (separation|auth|money|schema|classify|ui|deploy)
```

- **ALL GREEN** → 아래 표의 "감사 스킵" ✅ 도메인은 수동 재감사 불필요. 그 영역의 *새 코드*만 가드가 통과하는지 보면 됨.
- **RED** → 그 가드가 가리키는 사이트만 재감사/수정. 전수조사 불필요.
- 가드가 **없는** 영역(아래 "🔍 가드 미보유")만 수동 감사 대상.

## ✅ 감사 스킵 가능 도메인 (가드 GREEN = 신뢰)

| 도메인 | 불변식 (무엇을 보장) | 지키는 가드 | 마지막 수동 전수감사 |
|---|---|---|---|
| **서비스 분리** | 도매몰↔유어딜이 안 샘: 교차역할 API 0, 도매 어드민 스코프 내, 소비자 상품조회가 도매 원본 격리 | `check-dashboard-api-crossrole` · `check-wholesale-admin-api-scope` · `check-wholesale-admin-nav-reachability` · `check-consumer-product-supply-isolation` | 2026-06-26 (clean+1 누수 fix) |
| **인증·세션·RBAC** | 역할-한정 403 0, 유저↔대시보드 상호 로그아웃 0, OAuth iOS 영속, dead-link 0, 권한 누락 0, **로그인 유도는 토큰으로만(가격 null/0 을 로그아웃으로 오판 0)** | `check-dual-login-guard` · `check-dashboard-login-session-coexist` · `check-auth-cookie-pattern` · `check-internal-links` · `check-api-auth` · `check-light-input-guard` · `check-login-gate-by-price` | 2026-06-27 (도매 상세/카탈로그 가격-로그인 혼용 2건 fix + 가드) |
| **머니·정합성(패턴)** | CAS-선점/무환불 CANCELLED/빈화면-위장/CSV 인젝션 안티패턴 0 | `check-money-patterns` · `check-status-constraints` · `check-query-iserror` · `check-csv-injection` | 2026-06-26 (정산 clean·결제 셀프취소 latent 별도) |
| **DB·스키마** | 컬럼/bind/NOT NULL/SELECT* /컬럼예산/복구가능성 정합 | `check-schema-refs` · `check-sql-*` · `check-no-select-star-products` · `check-products-column-budget` · `check-product-detail-fields-repairable` | (상시 가드) |
| **상품 종류·라우팅** | group_buy_status 로 종류판별·라우팅 금지(쇼핑↔교환권 오분류) | `check-groupbuy-status-classify` | (상시 가드) |
| **UI·테마·첫페인트** | dark variant 일관성, RQ initialData 신선도, 모바일 하단잘림 | `check-theme-consistency` · `check-query-initialdata` · `check-mobile-viewport` | 2026-06-26 (크래시/빈상태 clean) |
| **빌드·배포 안전** | vite 단독빌드/405 라우터/SW등록/하드코딩 시크릿 금지 | `check-build-command` · `check-router-patterns` · `check-no-sw-register` · `check-no-secrets` | (상시 가드) |

> "마지막 수동 전수감사 = 2026-06-26" 인 도메인은 그날 5개 병렬 에이전트 + 코드 재검증으로 전수조사 완료.
> 그 결과를 위 가드로 박았으므로, **다음 세션은 가드 GREEN 이면 그 도메인을 다시 전수조사하지 말 것.**

## 🔍 가드 미보유 (= 아직 수동 감사 대상)

가드로 박기 어려운(런타임·문맥 의존) 잔여 영역. 새 작업이 이걸 건드리면 수동 확인.

| 영역 | 왜 가드 어려움 | 대안 |
|---|---|---|
| 결제 환불/취소 **금액 정확성** (셀프취소 ↔ refundOrderFully 대칭) | 머니 *흐름*은 정적패턴으로 안 잡힘 | `check-money-patterns`(패턴만) + staging 실결제 1회 (CLAUDE.md 룰) |
| 신규/빈/로그아웃 **런타임 크래시** | 훅순서/null deref 는 런타임 | 2026-06-26 AST 분석으로 clean 확인. 새 페이지는 `?? []`·`formatNumber`·early-return前 훅 규칙 준수 |
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
