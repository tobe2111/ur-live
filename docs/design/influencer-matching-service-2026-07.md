# 업체↔인플루언서 매칭 서비스 — 화면·UX·차별화 설계 (구현 전 기획)

> 작성 2026-07-14. 데이터 원천: `inflow_clicks`·`voucher_visits`·`orders`(데이터 감사 2단계).
> 연계 문서: `data-products-design-2026-07.md`(상품③ 매칭), `DATA_CAPTURE_AUDIT_2026-07.md`.
>
> **🔒 2026-07-14 방향 확정(대표)**: 매칭 서비스 = **어드민 전용 내부 운영 도구**. 직영 에이전시(운영자)가
> 실측 전환으로 매칭을 판단하는 화면 — 유어애즈(/ads) 인플루언서 발굴 패널 옆 `sec-matching` 섹션,
> **`requireAdmin` 잠금**. **매장·인플루언서 공개 뷰(§4 S1~S4, self-performance, 제안 흐름)는 데이터·법무
> 충분해지면(나중) — 지금 구현 안 함.** 엔진·로직은 실데이터 연결까지 지금 완성(데이터 희소해도 작동,
> n<5 억제). 정산은 기존 promo 커미션 구조 재사용(요율 placeholder), 머니 규율(게이트 OFF·#496).
> 아래 §2~§5 의 공개 뷰 화면 설계는 **향후(공개 단계) 참조용** — 현 구현은 §6 "구현 확정"만.

---

## 1. 차별화 — "팔로워"가 아니라 "실제 전환"

기존 체험단/인플루언서 마켓의 문제 = **팔로워 수·예상 도달**로 매칭 → 광고주가 돈 쓰고도 실제 매출 연결을 모름.

**유어딜의 무기(경쟁 불가 데이터)**: 우리는 인플루언서 링크→클릭→가입→구매→**오프라인 매장 방문→재방문**까지 한 `user_id`로 연결된 **실측 전환 이력**을 가짐. 즉:

| 기존 체험단 | 유어딜 성과 매칭 |
|---|---|
| 팔로워 12만 (자기신고) | 이 인플루언서 링크로 **실제 매장 방문 320건 / 재방문율 41%** |
| 예상 도달 | **업종별 실전환**: 카페 8.2% · 뷰티 3.1% (실측) |
| 협찬 후 성과 불명 | **정산 연동**: 발생 매출·커미션까지 추적 |

→ 셀링 문구: **"팔로워로 뽑지 마세요. 실제로 손님을 데려온 인플루언서를 붙여드립니다."**

**콜드스타트 대비**: 이력 없는 신규 인플루언서/매장은 (a) YouTube 발굴 프로필(팔로워·니치)로 폴백, (b) "성과 데이터 축적 중" 상태 배지. 실측 이력이 쌓일수록 매칭 신뢰도 ↑ = 시간이 우리 편(해자).

---

## 2. 행위자 & 진입점

| 행위자 | 목적 | 진입 |
|---|---|---|
| **매장(사업자 유저)** | 우리 매장에 맞는(전환 잘 내는) 인플루언서 찾기·제안 | 유어애즈 → "인플루언서 매칭" |
| **인플루언서** | 내 실제 성과 증명 + 협업 제안 받기 | 유어애즈(또는 링크샵 연계) → "내 성과 리포트" |
| **에이전시** | 매장↔인플루언서 조율(오프라인 벤더 모델) | 에이전시 대시보드 → 매칭 |
| **어드민** | 매칭 품질·정산 감독 | 어드민 |

> 커미션 재원: 커미션 재원 원칙(CLAUDE.md, 매장 promo 재원)과 정합 — 매칭 성사 시 정산은 기존 `influencer_attributions`/에이전시 축 재사용.

---

## 3. UX 흐름 (매장 관점 — 핵심 여정)

```
[유어애즈 홈] → "인플루언서 매칭" 카드
   ↓
[매칭 결과 리스트] — 우리 매장 업종·상권 기준 추천 인플루언서 랭킹
   · 각 카드: 실전환 지표(방문/재방문/CVR) + 적합도 점수 + 성과배지
   · 필터: 업종/상권/예산/성과기준
   ↓ (카드 클릭)
[인플루언서 성과 상세]
   · 이 인플루언서의 업종별/상권별 실전환
   · 우리 매장과의 적합도 근거(왜 추천됐나)
   · 과거 협업 성과(있으면)
   ↓ "협업 제안하기"
[제안 작성] — 캠페인 조건(이용권/보상/기간) → 발송
   ↓
[제안 관리] — 대기/수락/진행/완료 + 성과 추적(방배 후 실데이터)
```

**인플루언서 관점**: [내 성과 리포트] (자기 증명서) → [받은 제안] → 수락 → [진행 성과].

---

## 4. 화면 설계 (스크린별 — 데이터를 어떻게 보여줄지)

### S1. 매칭 결과 리스트 (`/ads/matching`)
- 상단: 우리 매장 컨텍스트(업종·상권) + 필터바(업종/상권/예산/최소성과)
- **인플루언서 카드**(랭킹순):
  - 프로필(아바타·이름·플랫폼·팔로워 — 참고용 회색 처리)
  - **핵심 = 실전환 지표(강조)**: `우리 업종 전환 8.2%` · `매장방문 유도 120건` · `재방문율 39%`
  - **적합도 점수**(0~100) + 근거 한 줄("카페·강남 상권 전환 상위 5%")
  - 성과 배지: 🏆실측 / 🌱데이터축적중(콜드스타트) / ⭐재방문강세
  - CTA: [성과 보기] [제안하기]
- **빈 상태(방배 전)**: "성과 데이터 수집 중 — 방배 오픈 후 실측 매칭 제공" + 발굴 프로필 기반 임시 추천.

### S2. 인플루언서 성과 상세 (`/ads/matching/:influencerId`)
- 헤더: 프로필 + 종합 성과 요약(총 유입·전환·매장방문·GMV)
- **업종별 전환 막대**: 카페 8.2% / 뷰티 3.1% / 음식 5.5% (우리 업종 하이라이트)
- **상권별 히트맵/리스트**: 어느 상권에서 전환 강한가(상권 단위 — 개인위치 아님)
- **재방문 곡선**: 유입 유저의 1회/2회/3회+ 방문 분포
- **적합도 근거 카드**: "당신 매장(카페·강남)과 이 인플루언서의 겹침 근거"
- **과거 협업**(있으면): 매장·기간·성과
- CTA: [협업 제안하기]

### S3. 제안 작성/관리 (`/ads/matching/proposals`)
- 작성: 캠페인 유형(이용권 협찬/보상), 조건, 기간, 메시지
- 관리 보드: 대기/수락/진행/완료 칼럼 + 각 건 성과 미니 추적(방배 후 실데이터)

### S4. 인플루언서용 내 성과 리포트 (`/ads/my-performance`)
- 자기 증명서: 총 성과 + 업종/상권별 강점 + 재방문 + (공유용 카드)
- 받은 제안 인박스

---

## 5. 데이터 표시 스펙 (필드 → 화면 매핑)

| 화면 지표 | 데이터 출처 | 산식(집계) | 신뢰성 표기 |
|---|---|---|---|
| 유입(클릭) | `inflow_clicks` by ref_id | count(distinct anon_id) | n<30 "표본 적음" |
| 가입 전환 | `inflow_clicks.user_id` | user_id 있는 비율 | |
| 구매 전환/GMV | `orders` (bound user) | Σ amount, count | |
| **매장방문(차별점)** | `voucher_visits` | count by seller→category/region | |
| **재방문율** | `voucher_visits` | user별 2회+ / 전체 | |
| 업종별 전환 | visits × products.category | 카테고리별 CVR | 셀 n<5 억제 |
| 상권별 전환 | visits × `product_regions` | 동/구별 집계 | 상권 단위(개인위치 X) |
| 적합도 점수 | 위 조합 | (우리 업종/상권 전환 vs 전체) 정규화 | 산식 투명 표기 |

**표시 원칙(법무 정합)**: 모든 수치는 **집계·가명**(개인 식별 불가), **n<5 셀 억제**, 위치는 **상권 단위 이상**. (data-products 문서 §3 법무 선결과 동일.)

---

## 6. 유어애즈 연계 (붙는 방식 — 구현 확정 · **어드민 전용**)

- **매칭 도구(어드민 전용)** = 유어애즈 대시보드의 **`sec-matching` 패널**(`InfluencerMatchingPanel`), 기존 `sec-influencers`(발굴) **바로 옆**. 발굴=신규 후보, 매칭=성과기반 판단. **이중 잠금**: 클라 `feature-flags.MATCHING_ENABLED`(기본 false) + **어드민 로그인(`admin_token`)** 둘 다여야 나브·패널 노출.
  - API: `src/features/marketing/api/admin-matching.routes.ts` → **`/api/admin/matching/influencers`**(랭킹), `/:id`(성과 상세). **`requireAdmin` 잠금**(비어드민 403). `admin-ads.routes.ts` 선례와 동일 패턴. env 게이트 불필요(어드민 인증이 게이트).
  - 패널은 `crossrole-ok`(유어애즈 대시보드에 얹힌 어드민 섹션이라 의도적으로 `/api/admin/*` 호출).
- **엔진(공용)**: `src/features/marketing/api/matching.ts` — 읽기 전용 집계(`inflow_clicks`↔`voucher_visits`↔`orders`), first-touch 귀속, n<5 억제, 테이블 없으면 빈 결과. 순수 함수(적합도/집계)는 유닛 테스트(`matching-engine.test.ts`). 데이터 0/희소면 패널이 **목업 미리보기**(화면 확인용).
- **공개 뷰(나중)**: 매장 검색·제안 흐름 · 인플루언서 self-performance(`/my-performance`)는 데이터·법무 충분해지면 별도 구현. (초기 구현했다가 방향 확정으로 제거 — 엔진의 `rankStoresForInfluencer` 는 그때 재사용.)
- **AI 마케터** 연계(후속): 적합도 근거를 AI 마케터가 생성(ANTHROPIC_API_KEY 기존 활용).
- **정산(별도 커밋·게이트)**: `creditOrderCommissions` 오케스트레이터 + `influencer_attributions`(source) 재사용, 매칭 수수료는 **promo owner-funding(5% 밖)**, 인플루언서 지급은 기존 딜 레일. 요율 placeholder(방배 실측 후 확정). env `MATCHING_SETTLEMENT_ENABLED`(기본 OFF, #496 규율). 순수 계산·불변식은 `matching-settlement.ts`(+테스트) 완성, 라이브 적립 배선은 단독 flip 세션.

---

## 7. 구현 순서 (지금 vs 방배 후)

**지금 (이 세션 — 검증 불필요)**
1. 프론트 뼈대: S1~S4 페이지 + 컴포넌트, **목업 데이터**(clearly mock), 유어애즈 라우트/레이아웃에 배치
2. 기능 플래그/역할 게이트로 **실사용자 비노출**(관리자/에이전시 프리뷰만)
3. 데이터 표시 스펙(§5)을 컴포넌트 prop 계약으로 고정 → 방배 후 실데이터만 갈아끼우면 됨

**방배 후 (별도 세션 — 검증 필수)**
4. 집계 배치/뷰(§5 산식) 구현 + n<5 억제
5. 적합도 스코어링 엔진 + 콜드스타트 폴백
6. 제안→정산 연동, 실측 성과 표시 on

---

## 구현 로그
- 2026-07-14 — 기획·화면 설계 문서(구현 전). 프론트 뼈대는 유어애즈 구조 확인 후 이어서.
- 2026-07-14 — **읽기 전용 매칭 엔진·프론트 풀개발 → 어드민 전용으로 확정**(게이트 OFF, 머니 무접촉). 신규/확정:
  - 엔진 `src/features/marketing/api/matching.ts`(rankInfluencersForStore/getInfluencerMetrics/aggregateInfluencerMetrics/rankStoresForInfluencer — first-touch 귀속, n<5 억제, graceful 빈결과) + 유닛 `matching-engine.test.ts`.
  - **어드민 API** `admin-matching.routes.ts`(`/api/admin/matching/*`, **requireAdmin**) — index.ts 마운트. (초기 업체용 `/api/ads/matching`·인플루언서 `/api/matching` 은 방향 확정으로 제거.)
  - 프론트 `InfluencerMatchingPanel`(실데이터+목업 폴백, `crossrole-ok`) 유어애즈 `sec-matching` 마운트 + 나브 — **어드민(`admin_token`)일 때만 노출**(패널·나브·페이지 마운트 모두). (초기 `MyPerformancePage` 제거.)
  - 게이트: 클라 `feature-flags.MATCHING_ENABLED=false` **+ 어드민 로그인**. 테이블(`inflow_clicks`/`voucher_visits`)은 감사 2단계(#514) — 없으면 빈결과.
- 2026-07-14 — **어드민 도구 완성도 ↑**(읽기 전용·게이트 유지). ① 엔진 `getMatchingCoverage`(데이터 준비도 — 유입/귀속/방문/인플루언서/실측 n≥5/업종·상권 커버리지, graceful) + `GET /api/admin/matching/coverage` + 패널 "데이터 준비도" 스트립. ② `POST /api/admin/matching/ai-rationale` — 후보(집계·가명: 공개 handle·적합도·방문·재방문·업종전환만, **PII 없음**)를 `callClaude`(기존 ANTHROPIC_API_KEY)로 매칭 근거 요약, 실측 표본 없으면 enough:false(생성 안 함) + 키 없으면 NOT_CONFIGURED. 패널 "🤝 AI 매칭 근거" 버튼. 전부 어드민 잠금 유지.
- 2026-07-14 — **정산(머니) — 별도 커밋·게이트 OFF**. `src/worker/utils/matching-settlement.ts`
  (`computeMatchingSettlement`/`assertPlatformNetIsFee` — 순수 계산: 매칭 커미션은 매장 promo(5% 밖),
  **유어딜 순수취 == 정확히 5%** 커미션과 독립) + `matching-settlement.test.ts`(예산 아비터 모델로 owner-funded
  축 = 플랫폼 예산 무접촉 → 순수취 5% 항등식). **INSERT 없음**(check-commission-budget R2 준수) —
  라이브 적립은 SSOT 아비터(`creditOrderCommissions`) 경유 배선이 필요하고, 그건 §6 "활성 런북"의
  **단독 flip 세션 + staging 실결제**(env `MATCHING_SETTLEMENT_ENABLED`) 대상. 이 커밋은 그 수학·불변식을
  완성·동결한다(활성 시 이 테스트가 계속 GREEN 이어야 함).
