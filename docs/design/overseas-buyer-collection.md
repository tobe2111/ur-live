# 🌐 해외 수출 바이어 DB 자동 수집 (유통스타트 B2B) — 설계 SSOT

> 2026-07-20 대표 확정: **A안 = 유통스타트 수출 바이어** + **무료 우선 하이브리드**.
> 한국 상품(K-뷰티/K-푸드 등)을 사입할 **해외 수입상·유통사·리테일러**를 발굴해 격리 풀에 누적한다.

## 0. 한 줄 요약

유어애즈 인플루언서 자동수집 엔진(`influencer-auto-collect.ts`)의 **B2B 아날로그**. "타깃 순환 → 소스 어댑터 → 공개 컨택 추출 → 멱등 저장 → 어드민 큐레이션 → 게이트 OFF 기본"까지 검증된 패턴을 그대로 미러링. **머지 = 라이브 영향 0**(신규 격리 테이블 + 게이트 기본 OFF).

## 1. 서비스 분리 (CLAUDE.md 준수)

- 이건 **유통스타트(도매 B2B) 수출** 축이다. 소비자(유어딜 공구) 코드/네임스페이스에 새면 안 된다.
- **격리 테이블만 신규** — `overseas_buyer_leads`, `buyer_discovery_targets`. 소비자/도매 트랜잭션 테이블(`orders`/`products`/`sellers`/`wholesale_orders`/원장) **무접촉**.
- 수집 *메커니즘*은 유어애즈(마케팅) 도메인과 동일해 코드는 `src/features/marketing/api/` 에 둔다(인플루언서 엔진과 헬퍼 공유: `extractContacts`/`pickBusinessEmail`). 관리 대상(바이어)은 유통스타트다.

## 2. 데이터 소스 (합법·무료 우선 → 유료 보강)

| Tier | 소스 | 어댑터 | 상태 |
|---|---|---|---|
| ① 무료·공식 | KOTRA **BuyKorea**·**TradeKorea** 바이어 인콰이어리, 전시회 공개 참가사, 정부 무역 오픈데이터 | `fetchDirectory` — 대표가 합법 수집분을 JSON/NDJSON 으로 정제·게시(`BUYER_DIRECTORY_URLS`)하면 코드변경 0 편입 | 배선 완료 (URL 미설정=skip) |
| ② 유료 provider | Apollo.io / Hunter / ZoomInfo — firmographic + 검증 이메일 | `fetchProvider`(Apollo mixed_companies) — `BUYER_PROVIDER_KEY` 있으면 자동 편입, 없으면 skip | 배선 완료 (키 미설정=skip) |
| ③ 주의(ToS) | LinkedIn/Sales Navigator | ❌ 직접 스크래핑 금지 — 공식 API/수동 export 만 | 미구현(의도) |

> ⚠️ **임의 웹 스크래핑을 하지 않는다.** `fetchDirectory` 는 **대표가 등록한 정제 파일**만 읽는다 → 수집 근거·합법성을 대표가 통제. 이 설계의 안전판.

## 3. 법률 (반드시 준수 — 인플루언서 [PIPA] 원칙의 해외판)

- 수집 대상 = **공개된 *비즈니스* 컨택**만. 개인정보 최소화(원시 IP/UA 미저장, 개인 신상 미수집).
- **수집 ≠ 발송.** 콜드 아웃리치는 대상국 규제가 갈린다: **EU GDPR**(정당한 이익 vs 옵트인), **미국 CAN-SPAM**, **캐나다 CASL**(사전동의 강함). 이 엔진은 수집·정리까지만. 발송 자동화는 **별도 동의 트랙**(이 설계 범위 밖).

## 4. 구현 (이 PR)

- **엔진** `buyer-discovery.ts`: 스키마·멱등 upsert(빈 컨택만 백필)·타깃(카테고리×국가) 테이블·2 어댑터·`runBuyerCollection`(게이트/커서/fail-soft).
- **어드민 API** `buyer-pool.routes.ts` → `/api/admin/buyer-pool/*`(requireAdmin): 목록/통계/큐레이션(status·memo·follow_up)/타깃 관리/수동 수집/CSV(수식인젝션 방어).
- **어드민 UI** `AdminBuyerPoolPage.tsx` → `/admin/buyer-pool`(도매몰 · 운영 메뉴).
- **env**: `BUYER_AUTO_COLLECT_ENABLED`(기본 OFF)·`BUYER_AUTOCOLLECT_BATCH`·`BUYER_SUBREQUEST_BUDGET`·`BUYER_DIRECTORY_URLS`·`BUYER_PROVIDER`/`BUYER_PROVIDER_KEY`.

## 5. 활성화 절차 (대표)

1. **소스 등록**: 무료 → 합법 수집분을 JSON 배열로 정제해 R2/gist 게시 후 `BUYER_DIRECTORY_URLS` 에 URL(쉼표구분). 유료 → `BUYER_PROVIDER=apollo` + `BUYER_PROVIDER_KEY`.
2. **수동 1회 검증**: `/admin/buyer-pool` → 「지금 수집」 → 풀에 바이어 적재 + 컨택 추출 확인.
3. **자동화 켜기**: `BUYER_AUTO_COLLECT_ENABLED=true`.
4. **cron 배치(후속 결정)**: 수집 메커니즘상 **ur-ads 워커 cron**이 자연스러운 자리(인플루언서와 동일). 현재는 어드민 수동 트리거만 배선 — cron 은 소스 검증 후 `worker-ads/index.ts` scheduled 에 `runBuyerCollection(env)` 추가(별도 커밋). ⚠️ ur-wholesale 워커엔 cron 금지(정산 이중성숙) — 여기 두지 말 것.

## 6. 스키마

```
overseas_buyer_leads(id, company_key UNIQUE, source, company, country, category,
  website, email, phone, contact_name, description, source_keyword,
  status['new'|contacted|interested|negotiating|contracted|rejected|hold], memo,
  contacted_at, follow_up_at, collected_at)
buyer_discovery_targets(id, category, country, keyword, active, hits,
  found_total, saved_total, last_run_at, created_at, UNIQUE(category,country))
```
멱등 = `company_key`(정규화: 소문자+법인접미사/특수문자 제거) UNIQUE + upsert 백필. cursor = `platform_settings.buyer_collect_cursor`.

## 7. 롤백

env 미설정이면 수집 no-op. 완전 롤백: `index.ts` mount 1줄 + admin route/menu + 5파일 제거(격리 테이블이라 소비자/도매 무영향).

## ✅ 구현 로그
- 2026-07-20 초기 구현(엔진·어드민 API·어드민 UI·env·설계문서) — 게이트 OFF, draft PR. commit: (배포 후 기록)
