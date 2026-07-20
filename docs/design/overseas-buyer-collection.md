# 🌐 해외 수출 바이어 DB 자동 수집 (유통스타트 B2B) — 설계 SSOT

> 2026-07-20 대표 확정: **A안 = 유통스타트 수출 바이어** · **최대한 무료**(유료 provider 없음) · **유어딜과 무관**.
> 한국 상품(K-뷰티/K-푸드 등)을 사입할 **해외 수입상·유통사·리테일러**를 발굴해 격리 풀에 누적한다.

> **분리 원칙 (대표 "바이어는 유어딜과 무관")**: 코드는 `src/features/supply/**`(유통스타트 자립), 유어딜/유어애즈
> 코드 의존 0(컨택 추출 헬퍼도 인라인). 마운트는 `mount-wholesale.ts`(도매 워커 전용 — 소비자 ur-live 번들에서
> DCE 제외). 테이블도 격리(`overseas_buyer_leads`/`buyer_discovery_targets`). 소비자/도매 트랜잭션 무접촉.

## 0. 한 줄 요약 — 인플루언서와 **결이 다르다**

인플루언서 수집 = **영입 깔때기**(많이 긁어 큐레이션, 볼륨 게임). 해외 바이어 = **매칭·자격심사 파이프라인**(소수 고가치 B2B 관계). 그래서 인프라(격리 테이블·게이트 OFF·멱등 저장)만 공유하고, **축은 다르게** 설계한다:

| | 🎬 인플루언서 | 🌐 해외 바이어 |
|---|---|---|
| 성격 | 영입 깔때기 | 매칭·자격심사 파이프라인 |
| 발견 | 키워드 × 콘텐츠 플랫폼(무료 검색 API) | **의도 신호**(RFQ·구매리드·수입실적) + 거래데이터 |
| 신호 | 구독자 수 | **한국 수입 이력**(행동 증거) · 취급 카테고리 적합 |
| 컨택 | 채널 주인 이메일 1개 | **회사 → 구매담당자(MD)** 2단 |
| 관계 | 단방향(우리가 원함) | 양방향 적합(바이어도 우리 품목을 원해야) |
| 지표 | 도달수 | **매칭 스코어**(수출품 × 시장 × 의도) |
| 상태 | 컨택/관심 | BD 단계 lead→qualified→sampling→negotiating→won/lost |

**머지 = 라이브 영향 0**(신규 격리 테이블 + `BUYER_AUTO_COLLECT_ENABLED` 기본 OFF).

### 매칭 스코어(0~100) = 의도 티어 + 타깃 부합 + 행동 증거 + 담당자
- 의도 티어(기저): RFQ 50 · 구매리드 48 · 수입실적 45 · 전시회 30 · 담당자보강 20 · 디렉토리 15.
- +25 우리 활성 타깃(수출 카테고리×시장)에 부합 · +20 한국 수입 이력 · +10 담당자 직통 이메일 확보.
- 타깃 테이블이 "무엇을 어디로 미는가"의 SSOT → 별도 수출 카탈로그 없이 자기완결. 타깃 변경 시 풀 자동 재스코어.

## 1. 서비스 분리 (CLAUDE.md 준수)

- 이건 **유통스타트(도매 B2B) 수출** 축이다. 소비자(유어딜 공구) 코드/네임스페이스에 새면 안 된다.
- **격리 테이블만 신규** — `overseas_buyer_leads`, `buyer_discovery_targets`. 소비자/도매 트랜잭션 테이블(`orders`/`products`/`sellers`/`wholesale_orders`/원장) **무접촉**.
- 코드는 `src/features/supply/api/`(유통스타트 자립). 유어딜/유어애즈 의존 0 — 컨택 추출 헬퍼(`pickBusinessEmail`/`pickPhone`)도 **인라인**. 마운트는 `mount-wholesale.ts`(도매 워커 전용 → 소비자 ur-live 번들 DCE 제외).

## 2. 데이터 소스 (⭐ 최대한 무료 — 유료 provider 없음)

| Tier | 소스 | 어댑터 | 상태 |
|---|---|---|---|
| ① 무료·공식 | KOTRA **BuyKorea**·**TradeKorea** 바이어 인콰이어리/구매리드, 전시회 공개 참가사, **data.go.kr 무료 오픈API**(무료 serviceKey) | `fetchFeeds` — 대표가 무료 소스를 JSON 게시/직결(`BUYER_FEED_URLS`)하면 코드변경 0 편입. JSON 배열/NDJSON/오픈API 응답(`response.body.items` 등) 자동 파싱 | 배선 완료 (URL 미설정=skip) |
| ② 유료 provider | ~~Apollo/Hunter/ZoomInfo~~ | **미채택** (대표 "최대한 무료") | 제거됨 |
| ③ 주의(ToS) | LinkedIn/Sales Navigator | ❌ 직접 스크래핑 금지 | 미구현(의도) |

> ⚠️ **임의 웹 스크래핑을 하지 않는다.** `fetchFeeds` 는 **대표가 등록한 무료 소스 URL**만 읽는다 → 수집 근거·합법성을 대표가 통제. 이 설계의 안전판.

## 3. 법률 (반드시 준수 — 인플루언서 [PIPA] 원칙의 해외판)

- 수집 대상 = **공개된 *비즈니스* 컨택**만. 개인정보 최소화(원시 IP/UA 미저장, 개인 신상 미수집).
- **수집 ≠ 발송.** 콜드 아웃리치는 대상국 규제가 갈린다: **EU GDPR**(정당한 이익 vs 옵트인), **미국 CAN-SPAM**, **캐나다 CASL**(사전동의 강함). 이 엔진은 수집·정리까지만. 발송 자동화는 **별도 동의 트랙**(이 설계 범위 밖).

## 4. 구현 (이 PR)

- **엔진** `src/features/supply/api/buyer-discovery.ts`: 스키마·멱등 upsert(빈 컨택/담당자만 백필, 더 높은 score만)·타깃(카테고리×시장)·매칭 스코어·`fetchFeeds`(무료 유일 어댑터)·`runBuyerCollection`(게이트/커서/fail-soft). 컨택 추출 헬퍼 인라인(유어딜 무관).
- **어드민 API** `src/features/supply/api/buyer-pool.routes.ts` → `/api/admin/buyer-pool/*`(requireAdmin): 목록/통계/큐레이션/타깃/수동수집/재스코어/CSV(수식인젝션 방어). **마운트 = `mount-wholesale.ts`**(소비자 워커 DCE).
- **어드민 UI** `AdminBuyerPoolPage.tsx` → `/admin/buyer-pool`(도매몰 · 운영 메뉴).
- **env**: `BUYER_AUTO_COLLECT_ENABLED`(기본 OFF)·`BUYER_AUTOCOLLECT_BATCH`·`BUYER_SUBREQUEST_BUDGET`·`BUYER_FEED_URLS`. (유료 provider env 없음.)

## 5. 활성화 절차 (대표)

1. **무료 소스 등록**: KOTRA BuyKorea/TradeKorea 구매리드·전시회 명단·data.go.kr 무료 오픈API(무료 serviceKey 발급) 를 JSON 으로 게시/직결 → `BUYER_FEED_URLS` 에 URL(쉼표구분). 응답은 JSON 배열/NDJSON/오픈API(`response.body.items`) 자동 파싱. 항목에 `intent`(rfq/buying_lead/import_record/exhibitor) 명시하면 그 티어로 스코어.
2. **수동 1회 검증**: `/admin/buyer-pool` → 「지금 수집」 → 풀 적재 + 매칭 스코어 + 담당자 추출 확인.
3. **자동화 켜기**: `BUYER_AUTO_COLLECT_ENABLED=true`.
4. **배포**: 유통스타트(도매) 워커 소관이라 `mount-wholesale.ts` 경유 — **ur-wholesale 배포**(WHOLESALE_BUNDLE=1)에 포함. 소비자 ur-live 번들엔 미포함(DCE). cron 자동화는 소스 검증 후 별도 결정(도매 워커 cron 제약 고려 — 현재는 어드민 수동 트리거만).

## 6. 스키마

```
overseas_buyer_leads(id, company_key UNIQUE, source, intent_signal, company, country,
  target_market, category, imports_from_korea, website, email, phone,
  decision_maker, decision_maker_title, decision_maker_email, est_volume, match_score,
  description, source_keyword,
  status['lead'|qualified|sampling|negotiating|won|lost|hold], memo,
  contacted_at, follow_up_at, collected_at)
buyer_discovery_targets(id, category, country, keyword, active, hits,
  found_total, saved_total, last_run_at, created_at, UNIQUE(category,country))
```
멱등 = `company_key`(정규화: 소문자+법인/무역 접미사·특수문자 제거) UNIQUE + upsert 백필(빈 컨택/담당자만, 더 높은 score 만). cursor = `platform_settings.buyer_collect_cursor`.

**의도 피드 입력 스키마**(대표가 정제해 게시하는 JSON 항목): `{company, country, target_market?, category?, intent?('rfq'|'buying_lead'|'import_record'|'exhibitor'|'directory'), imports_from_korea?, website?, email?, phone?, contact_name?, contact_title?, contact_email?, est_volume?, description?}`. `intent` 를 명시하면 그 티어로 스코어링(미명시=directory).

## 7. 롤백

env 미설정이면 수집 no-op. 완전 롤백: `index.ts` mount 1줄 + admin route/menu + 5파일 제거(격리 테이블이라 소비자/도매 무영향).

## ✅ 구현 로그
- 2026-07-20 초기 구현(엔진·어드민 API·어드민 UI·env·설계문서) — 게이트 OFF, draft PR. commit: (배포 후 기록)
