# 유어딜 에이전시(매니징 조직) 소개서 — 콘텐츠 브리프 (DESIGN AI 용 SOURCE MATERIAL)

> ⚠️ 이 문서는 **디자인 결과물이 아니라, 디자인 AI 가 슬라이드 덱(소개서)을 레이아웃할 때 사용할 "정확하고 상세한 원천 자료(content brief)"** 입니다.
> 모든 수치는 실제 코드/설정에서 추출했습니다. 불확실한 항목은 `[확인 필요]`, 추정/가정(특히 경쟁사)은 `[가정]` 으로 표기했습니다.
> `[디자인 지시]` 콜아웃은 디자인 AI 가 따라야 할 시각 지침입니다.
> 이 덱은 유어딜 제안서 **family 의 5번째**(도매몰 / 오프라인 공구 / 온라인 입점 / 링크샵 + **에이전시**)이며, §0 그라데이션 디자인 시스템은 다른 4개 덱과 **동일 토큰(verbatim)**을 공유합니다.
>
> 🔎 **소개 대상 명확화**: 이 소개서는 *특정 에이전시 회사를 소개하는 자료가 아닙니다.* **유어딜이 에이전시(매니징 조직)에게 제공하는 "에이전시 기능/시스템"** 을 소개·제안하는 자료입니다. 즉 주제 = 우리 서비스의 에이전시 기능, 독자 = 그 기능을 도입할 에이전시. (나머지 4개 덱이 각각 도매몰·오프라인공구·온라인입점·링크샵 *기능* 을 소개하는 것과 동일한 관점.)
>
> **추출 출처 (Ground Truth):**
> - 수수료/분배 SSOT: `src/shared/constants/policy.ts` (`COMMISSION_DEFAULTS`)
> - 에이전시 매장영입 commission: `src/worker/utils/agency-store-intro-commission.ts`
> - 에이전시 정산: `src/features/agency/api/agency-settlements.routes.ts`
> - 셀러 영입(초대): `src/features/agency/api/agency-invites.routes.ts`
> - 셀러 이전(전속 이동): `src/features/agency/api/seller-transfer.routes.ts` + `src/features/seller/api/seller-transfer-respond.routes.ts` (TD-016 보안)
> - 멤버 권한: `src/features/agency/api/agency-members.routes.ts`, `agency-role-guard.ts`
> - 캠페인/인센티브: `agency-campaigns.routes.ts`, `agency-incentives.routes.ts`
> - PK 배틀: `pk-battles.routes.ts` / 매칭: `agency-match-suggestions.routes.ts` / 노출부스팅: `promote-boosts.routes.ts`
> - KPI/통계: `agency-kpi.routes.ts`, `agency-stats.routes.ts`
> - 공구·숙소·캘린더: `agency-group-buy`(`agency.routes`), `agency-stays.routes.ts`, `agency-calendar.routes.ts`
> - 공개 페이지: `agency-public.routes.ts` (`/a/:slug`), 가입/인증: `agency.routes.ts`
> - 대시보드 IA: `src/components/AgencyLayout.tsx`, `src/pages/Agency*.tsx`
> - 세금/원천징수: `src/worker/utils/tax-withholding.ts` · 정책 규칙: `CLAUDE.md`
> - 인벤토리 매핑: `docs/proposals/00-service-overview-and-coverage.md` (카테고리 E: E1~E5)

---

## 0. 🎨 그라데이션 디자인 시스템 (덱 전체 공통 — 필수 준수)

> 이 덱은 **그라데이션을 시그니처 비주얼 언어**로 사용합니다. 표지·섹션헤더·CTA·스탯·트리/퍼널 다이어그램에 적극 적용하고, 본문 카드/표는 subtle 하게 사용합니다. 에이전시 대시보드는 **라이트 테마**(`#F4F5F7` 베이스, 화이트 카드) + 포인트 `#FF0033` 입니다. (유어딜 제안서 family 공통 토큰 — 다른 4개 덱과 cross-deck 일관성 유지. 토큰은 verbatim 동일.)

### 0-1. 그라데이션 토큰 (verbatim — 그대로 사용)

| 토큰명 | CSS | 용도 |
|---|---|---|
| **시그니처 (Primary)** | `linear-gradient(135deg, #FF0033 0%, #FF3D6E 100%)` | CTA 버튼·스탯 숫자·핵심 강조·단계 번호 배지 |
| **warm (성장·매출)** | `linear-gradient(135deg, #FF0033 0%, #FF7A00 100%)` | 라이브커머스 에너지·매출/성장 지표·타임라인 진행선·KPI |
| **deep (표지·전환)** | `linear-gradient(160deg, #C9184A 0%, #FF0033 60%, #FF4D6D 100%)` | 표지·섹션 전환 풀폭·신뢰 섹션 풀폭 배경 |
| **mesh 배경 (옅게)** | `radial-gradient(at 20% 20%, rgba(255,0,51,.16), transparent 42%), radial-gradient(at 85% 0%, rgba(255,122,0,.12), transparent 46%)` | 큰 면적 배경에 옅게 깔아 깊이감 (텍스트는 흰 카드 위) |
| **카드 subtle** | `linear-gradient(180deg, #FFFFFF 0%, #FFF1F3 100%)` + border `#FFE4E9` | 가치/운영도구/FAQ 카드 면 |
| **아이콘 원 (포인트)** | `linear-gradient(135deg, #FF0033 0%, #FF3D6E 100%)` (지름 40~56px 원) | 카드 좌상단 아이콘 백그라운드 |
| **표 헤더행** | `linear-gradient(90deg, #FF0033 0%, #FF3D6E 100%)` | 수수료/정산/비교표 헤더행 (텍스트 흰색) |

### 0-2. 용도 규칙 (어디에 무엇을)

- **표지 / 섹션 전환 / 신뢰 풀폭**: deep 그라데이션 + mesh 오버레이. 큰 면적·드라마틱.
- **CTA 버튼 / 스탯 대형 숫자(30%, 2%, +6 KPI) / 단계 번호 배지**: 시그니처 그라데이션. + CTA 버튼은 glow (`box-shadow: 0 8px 28px rgba(255,0,51,.38)`).
- **매출·성장·KPI 지표 / 타임라인 진행선 / PK 경쟁 게이지**: warm 그라데이션 (에너지·역동).
- **본문 카드 면 (가치·운영도구·FAQ)**: 카드 subtle (거의 흰색, 분홍 hint) — 본문 텍스트 가독성 우선.
- **표 헤더행 (수수료·정산·비교)**: 표 헤더행 그라데이션 + 흰 텍스트. 데이터 셀은 흰 배경.
- **큰 빈 배경**: mesh 를 옅게 (절대 진하게 X — 본문 가독성 해침).

### 0-3. 접근성 (필수)

- 그라데이션 **진한 부분(빨강~딥핑크/주황) 위에만 흰 텍스트** 허용. 밝은 부분(`#FFF1F3`, `#FF7A00` 의 밝은 끝) 위에는 흰 텍스트 금지 → 대비 부족.
- deep/mesh 위에 텍스트를 얹을 땐 **스크림**(`rgba(0,0,0,.28)` 오버레이 또는 텍스트 뒤 어두운 vignette) 추가로 WCAG AA(4.5:1) 확보.
- subtle 카드(`#FFF1F3`) 위 본문은 **항상 `text-gray-900`/`text-gray-700`** (흰 텍스트 금지).
- 표 헤더행 그라데이션 위 텍스트는 흰색 + `font-weight 600` 이상.
- 그라데이션은 **장식**, 정보 전달은 텍스트/숫자로. 색만으로 의미 구분 금지(색맹 대응).
- **에이전시 대시보드 목업은 라이트(`#F4F5F7`) 고정** — `dark:` variant 금지(`CLAUDE.md` 대시보드 룰). 목업 내부 KPI/표 셀은 흰 배경(숫자 가독성), 그라데이션은 베젤/헤더 띠/포인트에만.

### 0-4. Do / Don't

- ✅ Do: 표지·CTA·스탯·트리/퍼널에 시그니처/딥/warm 풀강도. 카드는 subtle. 한 슬라이드 1~2개 그라데이션 면 + 1개 포인트.
- ✅ Do: 그라데이션 각도 통일(135deg 시그니처/warm, 160deg deep, 90deg 표헤더).
- ❌ Don't: 본문 텍스트 블록 전체를 진한 그라데이션 위에 배치(가독성↓).
- ❌ Don't: 한 슬라이드에 3개 이상 강한 그라데이션 면(시각 과부하).
- ❌ Don't: 그라데이션 위 흰 텍스트를 밝은 끝(분홍/주황 밝은 쪽)에 배치.
- ❌ Don't: 대시보드/표 데이터 셀 배경에 그라데이션(숫자 가독성↓ — 흰 배경 유지).

### 0-5. 적용 빈도 가이드

- **풀강도 그라데이션 면** (deep/시그니처 큰 면): 슬라이드당 최대 1개 (표지·CTA·신뢰·섹션전환).
- **subtle 카드 그라데이션**: 카드형 슬라이드(가치·운영도구·FAQ)에 반복 OK.
- **포인트 그라데이션** (아이콘 원·배지·숫자·진행선): 슬라이드당 여러 개 OK (작은 면적).
- **mesh 배경**: 흰 베이스 슬라이드에 옅게 상시 깔기 OK (깊이감).

`[디자인 지시: 그라데이션]` 위 토큰을 SSOT 로 — 모든 `[디자인 지시]` 콜아웃의 그라데이션 지정은 이 §0 토큰명을 참조한다(임의 색 추가 금지). 각 섹션의 `[디자인 지시: 그라데이션]` 콜아웃을 함께 적용할 것. 슬라이드별 매핑은 §17-A 체크리스트가 최종 SSOT.

---

## 1. 문서 목적 & 타깃

### 문서 목적
유어딜이 제공하는 **에이전시(매니징 조직) 시스템** — 소속 셀러/크리에이터를 한곳에서 매니징하고, 통합 정산·KPI·영입·매칭·PK·공구/숙소 운영 대행·공개 페이지까지 운영할 수 있는 **MCN형 백오피스** — 의 가치를 설득력 있게 전달하는 **에이전시 소개서 덱**을 제작하기 위한 콘텐츠 브리프.

### 타깃 (Primary)
- **MCN / 라이브커머스 에이전시** — 다수의 셀러/크리에이터를 매니징하며 매출·방송을 관리하는 조직
- **인플루언서 매니지먼트 / 커머스 대행사** — 셀러 라이브·상품·정산을 대신 운영해주는 곳
- **공동구매/맛집 영업 조직** — 매장(store_owner)을 영입해 동네딜·교환권 공구를 운영·확산하는 영업팀

### 부 타깃 (Secondary)
- **매니징을 받고 싶은 셀러/크리에이터** — 정산·세무·노출·영업을 위임하고 본업(콘텐츠/방송)에 집중하려는 셀러
- **에이전시 합류를 고민하는 매장 사장님** — 동네딜/숙소 운영을 대행 받고 싶은 매장

> `[확인 필요]` 에이전시 계정 주체는 코드상 `agencies` 테이블(별도 인증, JWT `type:'agency'`)이며, 일반 셀러(`sellers`)·유저(`users`)와 분리된 상위 레이어입니다. 멤버는 4개 role(owner/manager/agent/analyst)로 운영(출처 `agency-members.routes.ts`).

`[디자인 지시]` 표지에 타깃 3종(MCN/커머스 대행사 · 인플루언서 매니지먼트 · 공동구매 영업조직)을 아이콘 3개로 시각화. 부 타깃(매니징받고 싶은 셀러)은 별도 보조 배지로. "한곳에서 전속 셀러 전부를 관리" 메시지를 표지 헤드라인으로.

`[디자인 지시: 그라데이션]` **표지 = deep 그라데이션 풀폭** (`linear-gradient(160deg, #C9184A 0%, #FF0033 60%, #FF4D6D 100%)`) + 그 위에 mesh 오버레이로 깊이감. 헤드라인 흰 텍스트는 좌하단 `rgba(0,0,0,.28)` 스크림 위에 배치(AA 확보). 타깃 아이콘 3개는 흰 라운드 칩 안에 두고 아이콘만 시그니처 그라데이션. 부 타깃 보조 배지는 warm 그라데이션 pill. 하단 얇은 띠에 warm 그라데이션 라인으로 마감. 배경에 옅은 "에이전시→소속 셀러 트리" 실루엣을 deep 위에 더 어두운 톤으로 깔아 정체성 암시.

---

## 1-A. 📍 이 소개서의 범위 & 경계 (먼저 읽어주세요)

> 유어딜은 하나의 코드베이스/DB 위에서 여러 사업 라인을 운영합니다. 이 소개서가 다루는 **에이전시는 다른 사업 라인을 "운영·관리하는 상위 레이어"** 입니다. 인접 소개서와의 관계를 먼저 명확히 합니다.

### 이 소개서가 다루는 것 (IN SCOPE — 인벤토리 카테고리 E)
**에이전시(매니징 조직) → 소속 셀러/매장 → 소비자** 의 매니징·운영·정산 전 영역.

- **E1 소속 셀러 매니징** — 담당 셀러 관리, 스케줄/방송 캘린더, 캠페인, 인센티브 규칙, 메시지 템플릿, 쿠폰 배포, 팀 멤버 권한.
- **E2 통합 정산/KPI** — 에이전시 입점 분배(platform_fee 중 30%) · 에이전시 본인 commission(매출 2%) · 정산/명세서 · 6대 KPI · 셀러 랭킹/비교/매출 목표.
- **E3 영입/매칭/PK** — QR/링크 셀러 영입(invite codes), 자동 매칭 제안, 매장 영입(store intro, 매출 2% + 첫결제 ₩30,000), 셀러 vs 셀러 PK 배틀, 노출 부스팅 쿠폰.
- **E4 에이전시 단위 공구/숙소/캘린더** — 에이전시가 소속 매장/셀러의 동네딜 공구·숙소·일정을 대행 운영.
- **E5 에이전시 공개 페이지/파트너 랜딩** — `/a/:slug` 공개 프로필(소속 셀러·누적 매출 노출) + 파트너(셀러) 모집 랜딩.

### 이 소개서가 다루지 **않는** 것 (OUT — 다른 소개서가 주력)
| 영역 | 무엇 | 담당 소개서 |
|---|---|---|
| **개별 셀러 온라인 입점** | 상품 1회 등록 → 쇼핑/라이브/링크샵 3채널 판매(셀러 본인 관점) | **온라인 입점 소개서** |
| **개별 크리에이터 링크샵** | bio 링크 1개 올인원 샵·큐레이터 핀·후원·추천(크리에이터 본인) | **링크샵 소개서** |
| **B2B 도매 유통** | 제조사↔유통사 무재고 사입, 등급제, OEM (utongstart.com) | **도매몰 소개서** |
| **오프라인 매장 공구/동네딜 자체** | 매장 선결제→교환권 즉시발급(매장 본인 관점) | **오프라인 공구 소개서** |

> **핵심 경계 한 줄**: 위 4개 소개서가 "각 주체가 **직접** 파는 법"이라면, **에이전시 소개서는 그 주체들을 묶어 "대신 운영·관리·정산해 주는 조직"**을 다룹니다. 즉 에이전시는 온라인입점·링크샵·오프라인공구의 **상위 운영 레이어**입니다. (동일 기능을 셀러는 자기 대시보드에서, 에이전시는 다수 셀러를 묶어 자기 대시보드에서 봅니다.)

### 관계도 (상위 레이어)
```
            ┌──────────────────────────────────────────┐
            │      에이전시 (매니징 조직 / 이 소개서)        │
            │  통합 대시보드 · 정산 · KPI · 영입 · PK         │
            └───────┬───────────┬───────────┬──────────┘
                    │ 매니징      │ 매니징      │ 영입/대행
            ┌───────▼──┐   ┌────▼─────┐  ┌──▼────────┐
            │ 크리에이터  │   │ 온라인셀러 │  │ 매장 사장님 │
            │ (링크샵)   │   │ (온라인입점)│  │ (오프라인공구)│
            └──────────┘   └──────────┘  └───────────┘
                    └───────── 소비자 (B2C) ──────────┘
```

`[디자인 지시]` 이 섹션은 **상위 레이어 트리/계층도**로 시각화 — 최상단 "에이전시" 박스 1개, 그 아래 3종 주체(크리에이터/온라인셀러/매장)로 가지가 뻗고, 맨 아래 "소비자"로 수렴. 인접 4개 소개서는 흐린 원으로 주변 배치하고 "에이전시가 이들을 운영" 화살표로 연결.

`[디자인 지시: 그라데이션]` 최상단 "에이전시" 박스만 **시그니처 그라데이션** 풀 채움 + glow, 3종 주체 박스는 카드 subtle(흰+분홍 hint), "소비자" 종착은 deep 그라데이션 작은 필. 연결선은 warm 그라데이션 stroke(위→아래 흐름 화살표). 인접 소개서 흐린 원은 무채색 그라데이션(`linear-gradient(160deg,#E9ECEF,#CED4DA)`). 본 레이어 강조를 위해 에이전시 박스만 풀강도.

---

## 2. 한 줄 요약 & 엘리베이터 피치

**한 줄 요약**
> "흩어진 셀러들을 한 대시보드로 — 매니징·정산·영입·KPI·PK까지, 에이전시를 위한 라이브커머스 백오피스."

**엘리베이터 피치 (30초)**
> 셀러가 10명만 넘어가도 정산·세무·방송 일정·실적 관리가 통제 불능이 됩니다. 유어딜 에이전시 시스템은 **소속 셀러 전부를 하나의 대시보드**로 묶어줍니다. QR 한 장으로 셀러를 영입하고(`agency_invite_codes`), 매출·라이브 진행률 등 **6대 KPI**를 한눈에 보고, 캠페인·인센티브 규칙을 자동 적용합니다. 정산은 셀러별 수수료에 **에이전시 본인 commission(매출 2%)**이 합산되어 함께 계산되고, 새 매장을 영입하면 그 매장 매출의 **2% + 첫 결제 ₩30,000**이 영구 적립됩니다. 플랫폼 수수료(기본 5%) 중 **30%가 에이전시 입점 분배**로 돌아옵니다. 셀러 이전은 **셀러 본인 동의 없이는 절대 불가능**(보안 잠금)합니다.

`[디자인 지시]` 표지 직후 "한 대시보드로 전속 셀러 전부" 한 줄을 큰 타이포 + #FF0033 강조. 핵심 숫자(30% / 2% / ₩30,000 / 6대 KPI)를 스탯 칩 4개로.

`[디자인 지시: 그라데이션]` 한 줄 헤드라인의 키워드("한 대시보드")는 **시그니처 그라데이션 텍스트 클립**(`background:linear-gradient(135deg,#FF0033,#FF3D6E)` + `-webkit-background-clip:text;color:transparent`). 스탯 칩 4개 숫자도 동일 그라데이션 텍스트. 배경은 흰색 + 옅은 mesh.

---

## 3. 문제 정의 — 다수 셀러를 관리한다는 것

### 에이전시가 겪는 현실 (문제)
| 문제 | 설명 |
|---|---|
| **다수 셀러의 분산 관리** | 셀러마다 계정·채널·실적이 흩어져 있어, 전체 매출·방송 현황을 한눈에 볼 도구가 없음. 엑셀·카톡·구글시트로 수기 취합 |
| **정산/세무 복잡성** | 셀러별 수수료율·정산 주기·원천징수(3.3%/8.8%)가 제각각 → 매월 정산 계산·증빙·송금이 반복 노가다 |
| **신규 셀러 영입 비용** | 셀러 발굴·계약·온보딩에 영업 리소스 소모. 영입해도 추적·귀속(누가 데려왔나)이 모호 |
| **셀러 이탈/이전 리스크** | 셀러가 말없이 다른 곳으로 옮기거나, 반대로 강제 이전 분쟁 발생 → 신뢰·법적 리스크 |
| **동기부여 수단 부재** | 셀러를 움직일 캠페인·인센티브·경쟁(PK)·노출 부스팅 도구가 없어 실적 관리가 정성적 |
| **공구/숙소 운영 대행 부담** | 매장 대신 동네딜 공구·숙소 일정을 운영하려면 별도 시스템이 필요 |

### 유어딜이 보는 기회
- **통합 백오피스**: 모든 소속 셀러를 한 대시보드로 — 매출/방송/정산/실적 일괄 가시화.
- **자동 정산 합산**: 셀러 수수료 + 에이전시 commission 을 주문 단위로 자동 계산.
- **추적 가능한 영입**: QR/링크 코드로 영입 → 누가 데려왔는지 자동 귀속 + commission 적립.
- **셀러 동기부여 엔진**: 캠페인·인센티브 규칙·PK 배틀·노출 부스팅으로 실적을 게이미피케이션.

`[디자인 지시]` 좌(문제: 흩어진 셀러 아이콘 6개 + 엑셀/카톡 난잡) vs 우(기회: 하나의 대시보드로 수렴) Before/After 대비 레이아웃.

`[디자인 지시: 그라데이션]` 좌(문제)는 무채색 그라데이션(`linear-gradient(160deg,#E9ECEF,#CED4DA)`)으로 칙칙·산만하게, 우(기회=통합 대시보드)는 시그니처 그라데이션으로 정돈·생기있게. 전환 화살표/구분선에 warm 그라데이션. 문제 표는 흰 카드(subtle), 각 행 좌측 회색 dot — 우측 기회 리스트는 시그니처 아이콘 원.

---

## 4. 솔루션 = 유어딜 에이전시 시스템 (통합 대시보드)

소속 셀러 전부를 **하나의 라이트 테마 대시보드**(`#F4F5F7`)로 운영. 좌측 사이드바는 **모드 토글(전체/라이브/매장)**로 라이브 셀러·매장 셀러를 분리해 볼 수 있습니다. (출처 `AgencyLayout.tsx` — 모드: all/live/store)

### 대시보드 IA (실제 메뉴 구조 — 6개 그룹)
| 그룹 | 메뉴 (route) |
|---|---|
| **운영** | 대시보드(`/agency`) · 담당 셀러(`/agency/sellers`) · 내 입점 가게(`/agency/introduced-stores`) · 라이브 현황(`/agency/streams`) · 방송 캘린더(`/agency/schedule`) |
| **판매 관리** | 주문 현황(`/agency/orders`) · 공동구매(`/agency/group-buy`) · 숙소 운영(`/agency/stays`) · 반품/CS(`/agency/returns`) |
| **분석 & 성과** | 통계 분석(`/agency/stats`) · 셀러 랭킹(`/agency/ranking`) · 셀러 비교(`/agency/compare`) · 매출 목표(`/agency/targets`) |
| **캠페인 & 영업** | 캠페인(`/agency/campaigns`) · 인센티브 규칙(`/agency/incentives`) · 메시지 템플릿(`/agency/messages`) · 쿠폰 배포(`/agency/coupons`) · 라이브 캘린더(`/agency/calendar`) · 셀러 영입(`/agency/invites`) · 자동 매칭 제안(`/agency/match-suggestions`) · PK 이벤트(`/agency/pk`) · 자사 챌린지(`/agency/events`) · 노출 부스팅(`/agency/promote-boosts`) · 셀러 이전(`/agency/transfers`) |
| **팀 운영** | 팀 멤버(`/agency/members`) |
| **재무 & 설정** | 정산 관리(`/agency/settlements`) · 계약 관리(`/agency/contracts`) · 셀러 공지(`/agency/notices`) · 운영 가이드(`/agency/guide`) · 프로필 설정(`/agency/profile`) |

> 한 조직이 **소속 셀러 매니징 → 판매 운영 → 성과 분석 → 영입/동기부여 → 정산**까지 전 라이프사이클을 이 6개 그룹으로 처리합니다.

`[디자인 지시]` **에이전시 대시보드 목업** (라이트 테마 `#F4F5F7`) — 좌측 6그룹 사이드바 + 상단 모드 토글(전체/라이브/매장) + 본문에 소속 셀러 카드 그리드·KPI 카드·차트. "한 화면에서 전부" 헤드라인.

`[디자인 지시: 그라데이션]` 대시보드 목업은 **라이트(`#F4F5F7`) 고정**. 사이드바 활성 메뉴 highlight·상단 모드 토글 활성 칩만 시그니처 그라데이션, 본문 KPI/표 카드 면은 흰 배경(데이터 가독성). 매출/성장 KPI 숫자는 warm 그라데이션 텍스트, 메인 차트 라인/막대 fill 1개만 시그니처→warm(`linear-gradient(180deg,#FF0033,#FF7A00)`). 베젤 상단 바만 시그니처 그라데이션 띠.

---

## 5. 에이전시 가치 제안 (구체 기능·수치)

> 모든 수치 출처: `policy.ts COMMISSION_DEFAULTS`, `agency-store-intro-commission.ts`, 각 `agency-*.routes.ts`.

| 가치 | 무엇인지 | 구체 수치 / 근거 |
|---|---|---|
| **① 소속 셀러 통합 매니징** | 담당 셀러 전체를 한 대시보드로 — 프로필·실적·방송·CS 일괄 관리. 모드 토글(전체/라이브/매장) | `agency-sellers.routes.ts`, `AgencyLayout` 모드 3종 |
| **② 통합 정산 (자동 합산)** | 소속 셀러 주문에 셀러 수수료 + **에이전시 commission 2%** 자동 합산 계산, 명세서 발행 | `agencies.commission_rate` default **2.0%**, `total_commission_rate = seller_rate + agency_rate` (`agency-settlements.routes.ts`) |
| **③ 입점 분배 (platform fee 중 30%)** | 플랫폼 기본 수수료(5%) 중 **30%**가 에이전시 입점 분배로 귀속 | `COMMISSION_DEFAULTS.AGENCY_SHARE_PCT = 30` (cf. 인플루언서 입점 분배 20%) |
| **④ 매장 영입 commission** | 영입한 매장(`introduced_by_agency_id`) 매출의 **2%** 영구 적립 + 가게 **첫 결제 시 ₩30,000** 1회 보너스 | `store_intro_commission_pct` default **2.0%**, `SIGNUP_BONUS_AMOUNT = 30,000` (`agency-store-intro-commission.ts`) |
| **⑤ 6대 KPI 대시보드** | 총 매출 · 라이브 진행률 · 유효 라이브 진행률(30분+) · 활성 셀러 · 유효 활성 셀러 · 신규 셀러 (week/month) | `agency-kpi.routes.ts` (TikTok Backstage 6대 지표 적응, **참고/벤치마크용 — 강제 패널티 X**) |
| **⑥ QR/링크 셀러 영입** | 8자 코드 QR/링크로 셀러 가입 시 자동 소속 매핑 + 사용 통계 | `agency_invite_codes` — 8자 영숫자, **7일 유효**, 기본 max_uses **100** (`agency-invites.routes.ts`) |
| **⑦ 자동 매칭 제안** | 점수 기반(`score`)으로 어울리는 셀러를 제안 → 수락 시 소속 추가 | `agency-match-suggestions.routes.ts` (`ams.score DESC`, `match_reason`) |
| **⑧ PK 배틀 (셀러 경쟁)** | 소속 셀러 2명을 매칭, 라이브 매출 경쟁 → 종료 시 우승자 자동 결정 + 보상 | `pk-battles.routes.ts` (owner/manager 생성, ends_at 자동 집계) |
| **⑨ 캠페인 & 인센티브 규칙** | 캠페인별 참여 셀러 KPI·보너스율 설정 + 규칙 엔진(payout 자동/preview dry-run) | `agency-campaigns.routes.ts`, `agency-incentives.routes.ts` |
| **⑩ 노출 부스팅 쿠폰** | 셀러에게 등급별(bronze/silver/gold) 부스트 쿠폰 발급 → 라이브 시 메인 피드 가중치 | `promote-boosts.routes.ts` (30일 유효) |
| **⑪ 공구·숙소·캘린더 운영 대행** | 에이전시 단위로 동네딜 공구·숙소 예약·방송 일정 운영 | `agency.routes`(group-buy), `agency-stays.routes.ts`, `agency-calendar.routes.ts` |
| **⑫ 메시지/쿠폰/공지/계약** | 메시지 템플릿·쿠폰 배포·셀러 공지·계약 관리로 소속 셀러 일괄 커뮤니케이션 | `agency-messages.routes.ts`, `agency-coupons.routes.ts`, `AgencyNoticesPage`, `AgencyContractsPage` |
| **⑬ 에이전시 공개 페이지** | `/a/:slug` 공개 프로필 — 로고/커버/bio + (옵션) 소속 셀러·누적 매출 노출 → 파트너 모집 랜딩 | `agency-public.routes.ts`, `AgencyPartnerLandingPage` |
| **⑭ 팀 멤버 권한 분리** | owner/manager/agent/analyst 4단계 권한으로 팀 운영 | `agency-members.routes.ts` (ROLE_DEFAULTS) |

`[디자인 지시]` 14개 가치 중 **핵심 6개**(통합 매니징·통합 정산·입점 분배 30%·매장영입 2%·6대 KPI·QR 영입)를 상단 대형 카드로, 나머지는 하단 보조 카드 그리드. "에이전시가 받는 것"을 숫자로 강조.

`[디자인 지시: 그라데이션]` 각 가치 카드 = **카드 subtle 그라데이션** 면(`linear-gradient(180deg,#FFFFFF,#FFF1F3)` + border `#FFE4E9`). 좌상단 **아이콘 원**(48px)은 시그니처 그라데이션 채움 + 흰 아이콘. 상단 핵심 6카드는 좌측 4px warm 그라데이션 액센트 바로 한 단계 강조. 수치(30%/2%/₩30,000/6대 KPI)는 시그니처 그라데이션 텍스트. 카드 본문은 `text-gray-900`/`text-gray-600`.

---

## 6. 작동 방식 (스텝 바이 스텝)

> 출처: `agency.routes.ts`(가입/승인), `agency-invites.routes.ts`(영입), `seller-transfer.routes.ts` + `seller-transfer-respond.routes.ts`(이전), `agency-campaigns.routes.ts`(캠페인), `agency-settlements.routes.ts`(정산), `agency-kpi.routes.ts`(KPI).

1. **에이전시 가입 / 승인** — 에이전시 등록(`POST /api/agency/register`). 필수: name(조직명), contact_name(담당자), email, password(+선택 phone). 가입 직후 status=`pending` → **어드민 승인** 후 `active`. (카카오 유저는 `register-from-user`로 에이전시 확장도 가능, 동일 pending→승인.) 비밀번호 복잡도 검증 + 가입 rate limit(시간당 3회).
2. **팀 멤버 셋업** — owner 가 manager/agent/analyst 멤버 초대(`/agency/members`). role 별 권한 자동 적용(초대·정산·캠페인·메시지·쿠폰·계약·멤버·조회). owner 는 1명(이전은 별도 절차).
3. **셀러 영입 / 매칭** — QR/링크 영입 코드 발급(`POST /api/agency/invites`, 8자·7일·max 100) → 셀러가 `?invite=<code>`로 가입하면 **자동 소속 매핑**. 또는 자동 매칭 제안(`/agency/match-suggestions`)을 수락해 소속 추가.
4. **셀러 이전 (전속 이동, 셀러 동의 필수)** — 다른 에이전시 소속 셀러를 데려올 때: ⓐ from_agency 가 신청(`POST /api/agency/transfers`) → ⓑ to_agency(받는 쪽 = 본인)가 수락 → **ⓒ 셀러 본인이 자기 토큰으로 직접 동의**(`POST /api/seller/transfers/:id/respond`) → 매핑 변경. 셀러 동의 없이는 절대 이전 불가(TD-016 보안). 이전 후 **30일 cooldown**.
5. **캠페인 / 공구 운영** — 캠페인 생성(참여 셀러·기간·인센티브율·KPI) + 동네딜 공구·숙소·방송 캘린더를 에이전시 단위로 운영. PK 배틀·노출 부스팅·쿠폰으로 셀러 동기부여.
6. **정산 / KPI 관리** — 소속 셀러 주문에 셀러 수수료 + 에이전시 commission(2%) 자동 합산(`/agency/settlements`), 정산 신청(권한 게이팅) → 명세서. 6대 KPI(`/agency/kpi`)·랭킹·목표로 실적 관리.

`[디자인 지시]` **에이전시 운영 타임라인** — 6스텝 가로 타임라인. 4번(셀러 이전)은 3단 동의(from→to→셀러) 미니 분기로 강조하고 "셀러 동의 필수" 보안 배지. 3번(영입)은 QR 아이콘.

`[디자인 지시: 그라데이션]` **타임라인 = 단계 번호 배지 + 진행선 그라데이션.**
> - 각 스텝 **번호 배지(1~6, 원형 36~44px)**: 시그니처 그라데이션 채움 + 흰 숫자 + 작은 glow.
> - 스텝 잇는 **진행선(가로 레일)**: warm 그라데이션(`linear-gradient(90deg,#FF0033,#FF7A00)`) 좌→우 흐름, 두께 4px.
> - **4번 "셀러 이전"의 3단 동의 분기**(from→to→셀러): 각 노드 시그니처 채움, 마지막 "셀러 동의" 노드만 deep 그라데이션(신뢰/잠금 강조) + 자물쇠 아이콘. "셀러 동의 필수" 배지는 deep pill.
> - 스텝 설명 카드는 흰색(subtle), 본문 `text-gray-700`. 배경 옅은 mesh.

---

## 7. 수수료 / 정산 / 세금 구조

> 모든 수치 출처: `policy.ts COMMISSION_DEFAULTS`, `agency-store-intro-commission.ts`, `agency-settlements.routes.ts`, `tax-withholding.ts`, `CLAUDE.md`. **비율 hardcode 금지 — 이 상수가 SSOT.**

### 7-1. 에이전시 수익 구조 표
| 항목 | 기본값 | 의미 / 출처 |
|---|---|---|
| **에이전시 입점 분배** | **30%** | 플랫폼 기본 수수료(5%) **중** 30%가 에이전시에 귀속 (`AGENCY_SHARE_PCT = 30`). cf. 인플루언서 입점 분배 20%(`INFLUENCER_INTRO_SHARE_PCT`) |
| **에이전시 본인 commission** | **2.0%** | 소속 셀러 매출 기준 (`AGENCY_OWN_RATE = 2.0` / `agencies.commission_rate` default 2.0). 정산 시 셀러 수수료에 합산 |
| **합산 수수료율** | 셀러율 + 2% | `total_commission_rate = seller_commission_rate(기본 5) + agency_rate(2)` (`agency-settlements.routes.ts`) |
| **매장 영입 commission** | **2.0%** | 영입 매장 매출의 2% 영구 (`store_intro_commission_pct` default 2.0) |
| **매장 영입 가입 보너스** | **₩30,000** | 영입 매장 **첫 PAID 주문 시 1회** (`SIGNUP_BONUS_AMOUNT = 30,000`) |
| **노출 부스팅 쿠폰** | 등급별 | bronze/silver/gold, 30일 유효 (`promote-boosts.routes.ts`) `[확인 필요]` 발급 비용/차감 정책 |
| **PK 배틀 보상** | 가변 | 우승자 자동 보상 (`pk-battles.routes.ts`) `[확인 필요]` 보상 금액 정책 |

> `[확인 필요]` 에이전시 입점 분배 30%의 **정확한 적용 조건**(소속 셀러 전체 매출 vs 영입 귀속 매출)은 운영 정책으로 확정 필요. 코드 상수는 분배 "비율"만 정의.

### 7-2. 소속 셀러 정산 흐름
- 소속 셀러 주문(`status IN ('delivered','DONE')`) 단위로 에이전시 정산 화면에 집계(`GET /agency/settlements`, 최근 100건).
- 각 주문: `agency_commission = total_amount × agency_rate / 100` 자동 계산 + 셀러 수수료 별도 표기.
- 정산 신청(`POST /agency/settlements/request`)은 **권한 게이팅**(owner/manager의 `settle` 권한) — analyst/agent 불가.
- 명세서/인보이스: `GET /agency/settlement-invoices`, `/:id` 로 증빙 조회.
- 최소 출금액 등 출금 정책은 셀러 정산과 동일 인프라(`WITHDRAWAL_DEFAULTS.MIN_AMOUNT = 10,000원`) `[확인 필요]` 에이전시 전용 최소 출금 별도 여부.

### 7-3. 세금 (원천징수)
> 출처: `tax-withholding.ts WITHHOLDING_RATES`. 에이전시·소속 셀러 정산 송금 시 적용.

| 소득 유형 | 비율 | 적용 |
|---|---|---|
| **사업소득** (default) | **3.3%** (소득세 3% + 지방세 0.3%) | 반복적 활동 — 대부분 에이전시/셀러 (`business_income`) |
| **기타소득** | **8.8%** (소득세 8% + 지방세 0.8%) | 단발성 (`other_income`) |

- **사업자 검증 시 원천징수 면제**: 검증된 사업자(`verified`/`exempt`)는 세금계산서 발행, 원천징수 0.
- 에이전시는 소속 셀러의 정산·세무 복잡성을 **대신 관리·가시화**하는 것이 핵심 가치(셀러별 수수료/원천징수가 한 화면에 정리됨).

`[디자인 지시]` **수익 구조 표** — "입점 분배 30%" + "본인 commission 2%" + "매장영입 2% + ₩30,000"을 대형 숫자 3개로. 정산 합산 공식(`셀러율 + 2%`)을 콜아웃. 세금 표(3.3%/8.8%)는 별도 박스. 경쟁사 비교는 §11.

`[디자인 지시: 그라데이션]` **표 = 표 헤더행 그라데이션.**
> - 수익 구조 표·세금 표 모두 **헤더행에 표 헤더행 그라데이션**(`linear-gradient(90deg,#FF0033,#FF3D6E)`) + 흰 텍스트. **데이터 셀은 흰 배경** 유지(숫자 가독성).
> - **"30%" / "2%" / "₩30,000" 대형 숫자**: 시그니처 그라데이션 텍스트 클립. 슬라이드 중앙 히어로 숫자 3개.
> - **합산 공식 콜아웃**(`셀러율 + 2%`): 카드 subtle 면 + 좌측 4px warm 그라데이션 액센트 바. 본문 `text-gray-900`/`text-gray-700`.
> - 세금 표 3.3%/8.8% 숫자는 시그니처 그라데이션 텍스트 포인트.
> - 풀강도 그라데이션 면 0개(표 헤더행 + 히어로 숫자만) — 데이터 슬라이드 가독성 우선.

---

## 8. 신뢰 / 안전

- **셀러 이전 = 셀러 본인 동의 필수 (IDOR 방지)**: 과거 from_agency 가 셀러 동의를 대행하는 위험 endpoint(`/:id/seller-approve`)가 있었으나 **410 Gone 으로 영구 차단**(TD-016 CRITICAL). 셀러는 **자기 토큰**으로만 동의/거부 가능(`/api/seller/transfers/:id/respond`). → 에이전시가 셀러 행세로 강제 이전 불가.
- **권한 분리 (4단계 role)**: owner(전권) / manager(영업·정산·캠페인) / agent(현장 운영) / analyst(조회만). 정산·멤버·계약 등 민감 작업은 role 게이팅(`agency-role-guard.ts`). owner 는 1명 — 강등/추가 owner 차단.
- **잠긴 Toss 결제/정산 SSOT**: 모든 결제(충전/주문/공구/숙소/교환권)는 단일 SSOT(`toss-gateway.ts confirmTossPayment`) — 금액 서버 재검증·idempotency·circuit breaker 자동. 에이전시 commission 적립은 **결제 흐름을 막지 않는 fail-soft side-effect**(order_id 멱등), 환불 시 자동 역전.
- **소속 검증 (IDOR)**: 이전 신청·PK 매칭·정산 조회는 모두 `agency_sellers`로 **본 에이전시 소속 셀러인지 검증**. 타 에이전시 셀러에 대한 작업 차단(403).
- **가입 승인 게이트**: 에이전시 가입은 pending → 어드민 승인 후에만 active. rate limit(시간당 3회) + 비밀번호 복잡도.
- **보안 규칙 일반**: 권한 검증·rate limit·에러 메시지 generic(계정 enumeration 방지).

`[디자인 지시]` "셀러 동의 없이 이전 불가" + "4단계 권한 분리" + "토스 안전결제·자동 역전" 3개 신뢰 배지. 자물쇠/방패/체크 아이콘. 4번(셀러 이전 보안)을 가장 크게.

`[디자인 지시: 그라데이션]` **신뢰 섹션 = deep 그라데이션 풀폭(드라마틱·믿음).**
> - 슬라이드 배경 풀폭에 **deep 그라데이션** + mesh 오버레이. 헤드라인 흰 텍스트는 `rgba(0,0,0,.28)` 스크림 위 → WCAG AA 확보.
> - **3개 신뢰 배지**: deep 위에 **흰 라운드 카드**(본문 가독성), 카드 내 자물쇠/방패 아이콘 원만 시그니처 그라데이션. 본문 `text-gray-900`/`text-gray-700`.
> - 풀폭 deep 면 슬라이드당 1개 한도. 하단 마감 띠는 warm 그라데이션 얇은 라인.

---

## 9. 차별점 (경쟁사 대비)

> ⚠️ 경쟁사 수치/특성은 모두 `[가정]` — 제안서에 넣을 경우 최신 공식 자료로 검증 필요.

| 항목 | 유어딜 에이전시 | 일반 MCN/대행사 `[가정]` | 자체 엑셀/수기 관리 `[가정]` | TikTok Backstage류 `[가정]` |
|---|---|---|---|---|
| 소속 셀러 통합 대시보드 | **내장** (모드 토글·KPI·랭킹) | 별도 협업툴 `[가정]` | 없음(수기) | 플랫폼 종속 `[가정]` |
| 정산 자동 합산 | **셀러율 + 에이전시 2% 자동** | 수기 정산 `[가정]` | 엑셀 계산 | 플랫폼별 `[가정]` |
| 영입 추적/귀속 | **QR/링크 자동 귀속 + commission** | 수기 계약 `[가정]` | 없음 | 제한적 `[가정]` |
| 셀러 이전 안전장치 | **셀러 본인 동의 필수(잠금)** | 계약서 의존 `[가정]` | 없음 | 해당 없음 |
| 동기부여 엔진 | **캠페인·인센티브·PK·부스팅 내장** | 별도 운영 `[가정]` | 없음 | 일부 `[가정]` |
| 공구/숙소 운영 대행 | **에이전시 단위 내장** | 없음 `[가정]` | 없음 | 없음 |
| 공개 페이지/파트너 모집 | **`/a/:slug` 내장** | 별도 홈페이지 `[가정]` | 없음 | 없음 |

**유어딜 에이전시만의 한 줄 차별점:** "흩어진 셀러를 한 대시보드로 묶고 — 영입·정산·KPI·동기부여(PK)·공구운영까지, 셀러 이전은 본인 동의로만 안전하게."

`[디자인 지시]` 비교표는 유어딜 컬럼을 #FF0033 헤더로 강조. 경쟁/대안 셀은 회색. 표 하단 `[가정] = 공식 자료 검증 필요` 주석 작게.

`[디자인 지시: 그라데이션]` **비교표 = 유어딜 컬럼 그라데이션 하이라이트.**
> - **유어딜 컬럼**: 헤더 셀 표 헤더행 그라데이션 + 흰 텍스트, 컬럼 본문 셀은 옅은 `#FFF1F3` 틴트(본문 `text-gray-900` 유지).
> - **대안 컬럼**: 헤더 회색(`#E9ECEF`), 셀 흰 배경 — 그라데이션 없음(대비로 유어딜 강조).
> - 유어딜 행 핵심 우위 값("2% 자동", "본인 동의 필수", "PK 내장")은 시그니처 그라데이션 텍스트.
> - `[가정]` 주석 회색 작은 텍스트. 표 헤더행만 그라데이션, 데이터 셀 배경 그라데이션 금지.

---

## 10. 온보딩 & 지원

- **가입 경로**: 에이전시 등록(`/agency/register`, `AgencyRegisterPage`) → 어드민 승인 대기(`AgencyWaitingPage`). 사업자 정보(`AgencyRegisterBusinessPage`). 카카오 유저 → 에이전시 확장(`register-from-user`).
- **승인 후**: 로그인(`/agency/login`), 비밀번호 찾기/재설정(`AgencyForgotPasswordPage`/`AgencyResetPasswordPage`), PIN 인증(민감 작업, `agency-pin.routes.ts`).
- **첫 셋업 4스텝**: ① 팀 멤버 초대 → ② 셀러 영입 코드 발급(QR) → ③ 캠페인/인센티브 규칙 설정 → ④ 공개 페이지(`/a/:slug`) 꾸미기.
- **운영 가이드**: `/agency/guide` (DB `operation_guides` 의 `agency` 가이드, 자동 코드참조 섹션 포함 — `CLAUDE.md` 운영가이드 3종 룰).
- **지원 채널**: `[확인 필요]` 에이전시 전용 입점/제휴 문의 채널(이메일/카카오 채널) — 운영 연락처 확정 필요.

`[디자인 지시]` "1. 가입·승인 → 2. 팀/셀러 셋업 → 3. 캠페인 설정 → 4. 공개 페이지" 4스텝 온보딩 + QR/링크 CTA. 어드민 승인은 "심사 후 활성" 배지.

`[디자인 지시: 그라데이션]` **4스텝 온보딩 = 번호 배지 + 진행선(§6 타임라인과 동일 언어).**
> - 번호 배지(1~4): 시그니처 그라데이션 채움 + 흰 숫자 + glow(`box-shadow:0 4px 14px rgba(255,0,51,.30)`).
> - 진행선: warm 그라데이션(`linear-gradient(90deg,#FF0033,#FF7A00)`).
> - QR/링크 CTA: 시그니처 그라데이션 버튼 + glow. QR 코드 흑백 유지(스캔성), 프레임 테두리만 시그니처 그라데이션.
> - 스텝 설명 카드 흰색(subtle), 배경 옅은 mesh.

---

## 11. 범위 & 경계 (상위 레이어 재확인)

> §1-A 를 슬라이드 1장으로 압축. 에이전시 = **다른 사업 라인을 운영·관리하는 상위 레이어**임을 다시 못박는 슬라이드.

| 인접 소개서 | 그 소개서의 주체 | 에이전시와의 관계 |
|---|---|---|
| **온라인 입점** | 개별 셀러(브랜드/제조사/온라인셀러) | 에이전시가 **이 셀러들을 매니징**(상품·라이브·정산 대행) |
| **링크샵** | 개별 크리에이터 | 에이전시가 **이 크리에이터들을 매니징**(전속·실적·영입) |
| **오프라인 공구** | 매장 사장님 | 에이전시가 **매장을 영입**(intro 2% + ₩30k)하고 **공구·숙소 운영 대행** |
| **도매몰** | 제조사·유통사(B2B) | 별개 도메인(utongstart.com) — 에이전시 범위 밖 (단, 소속 셀러가 도매 상품을 팔 수 있음 `[확인 필요]`) |

> **한 문장 경계**: "다른 4개 소개서가 '각자 파는 법'이라면, 에이전시 소개서는 '그들을 묶어 대신 운영·정산·영입·동기부여하는 조직'을 다룬다."

`[디자인 지시]` §1-A 의 상위 레이어 트리를 재사용(축약판) — 에이전시 박스를 중심에 두고 4개 소개서 주체를 위성처럼 배치, "운영/매니징" 화살표로 연결.

`[디자인 지시: 그라데이션]` 에이전시 중심 박스만 시그니처 그라데이션 풀 채움 + glow, 위성 4개 주체 박스는 카드 subtle, 연결 화살표 warm 그라데이션 stroke. 도매몰(범위 밖)은 점선 + 무채색 그라데이션으로 구분.

---

## 12. 섹션별 슬라이드 카피 초안 (실제 카피)

| # | 슬라이드 | 헤드라인 | 서브카피 |
|---|---|---|---|
| 1 | 표지 | **흩어진 셀러를, 한 대시보드로** | 유어딜 에이전시(매니징 조직) 소개서 |
| 2 | 한 줄 요약 | **매니징·정산·영입·KPI, 전부 한곳에서** | MCN을 위한 라이브커머스 백오피스 |
| 3 | 문제 | **셀러 10명만 넘어도 통제 불능입니다** | 분산 관리·정산 노가다·영입 추적 부재 |
| 4 | 솔루션(대시보드) | **소속 셀러 전부, 한 화면에** | 운영·판매·분석·영업·정산 6개 그룹 통합 대시보드 |
| 5 | 가치 제안 | **에이전시가 받는 것은 분명합니다** | 입점 분배 30% · 본인 2% · 매장영입 2%+₩30,000 |
| 6 | 작동 방식 | **가입부터 정산까지, 6스텝** | 영입(QR) → 이전(셀러 동의) → 캠페인 → 정산 |
| 7 | 수수료/정산 | **셀러 수수료에 2%가 더해집니다** | 입점 분배 30% + 본인 commission 2% 자동 합산 |
| 8 | 신뢰/안전 | **셀러 동의 없이는 이전되지 않습니다** | 권한 4단계 분리 · 토스 안전결제 · 자동 역전 |
| 9 | 차별점 | **수기 정산은 그만** | 통합 대시보드 + 영입 자동 귀속 + PK 동기부여 |
| 10 | 영입/PK | **데려오고, 경쟁시키고, 보상하세요** | QR 영입 + 자동 매칭 + PK 배틀 + 노출 부스팅 |
| 11 | 온보딩 | **승인되면 바로 셋업합니다** | 팀 → 셀러 영입 → 캠페인 → 공개 페이지 |
| 12 | CTA | **지금 에이전시로 시작하세요** | 소속 셀러를 한곳에서 운영하세요 |

`[디자인 지시]` 헤드라인 18~28자 이내. 숫자(30%, 2%, ₩30,000, 6대 KPI)는 대형 타이포 별도 처리.

`[디자인 지시: 그라데이션]` 헤드라인 내 숫자·핵심 키워드("한 대시보드", "30%", "2%", "셀러 동의")는 시그니처 그라데이션 텍스트 클립으로 일관 강조. 표지(1)·CTA(12)는 풀폭 그라데이션 면(표지=deep, CTA=시그니처) 위 흰 텍스트(스크림). 슬라이드별 주 그라데이션은 §17-A SSOT.

---

## 13. 추천 비주얼 & 다이어그램

1. **에이전시 → 소속 셀러 트리** (§1-A, §11) — 최상단 에이전시 → 크리에이터/온라인셀러/매장 가지 → 소비자 수렴. **덱의 정체성 비주얼.**
2. **통합 대시보드 목업** (§4) — 라이트(`#F4F5F7`) + 6그룹 사이드바 + 모드 토글(전체/라이브/매장) + 소속 셀러 카드·KPI·차트.
3. **KPI 대시보드 목업** (§5 ⑤) — 6대 KPI 카드(총매출/라이브 진행률/유효 진행률/활성 셀러/유효 활성/신규 셀러) + week/month 토글.
4. **정산 흐름도** (§7) — 소속 셀러 주문 → (셀러 수수료 + 에이전시 2%) 합산 → 명세서 → 송금(원천징수). 매장영입 commission(2% + ₩30k) 별도 흐름.
5. **영입/PK 다이어그램** (§5 ⑥⑧, §6) — QR 영입 코드 → 셀러 가입 자동 귀속 / 셀러 이전 3단 동의(from→to→셀러) / PK 배틀 매출 경쟁 게이지.
6. **에이전시 공개 페이지 목업** (§5 ⑬) — `/a/:slug` 로고/커버/bio + 소속 셀러 그리드 + 누적 매출 + "파트너 모집" CTA.

`[디자인 지시]` 비주얼은 실제 스크린샷 자리표시(placeholder)로 위치만 잡고, 캡션에 출처 경로(`/agency`, `/agency/kpi`, `/agency/settlements`, `/a/:slug` 등) 명기. 대시보드 목업은 모두 라이트 테마.

`[디자인 지시: 그라데이션]` **목업/다이어그램 프레임 규칙.**
> - **모든 대시보드 placeholder 프레임**: 라이트 유지, 베젤 상단 바(또는 사이드바 활성 highlight)에만 시그니처 그라데이션. 내부 KPI/표 셀은 흰 배경.
> - **트리(1) / 정산 흐름도(4) / 영입·PK(5)**: SVG 그라데이션 def(`<linearGradient id="gradSig/gradWarm/gradDeep">`) 1세트 전역 재사용 — 엣지 stroke·노드 fill 일관. PK 매출 경쟁 게이지는 warm 그라데이션 fill, 우승 측 시그니처.
> - **공개 페이지 목업(6)**: 커버/아바타 링에 deep 그라데이션(`/a/:slug`는 다크여도 OK `[확인 필요]` 실제 테마), "파트너 모집" CTA 시그니처 버튼+glow.
> - placeholder 캡션·출처 경로 텍스트는 회색(그라데이션 X).

---

## 14. 추가 — 영입 / 매칭 / PK (E3 전용 강화 섹션)

> §5 의 ⑥⑦⑧⑩을 한 슬라이드로 묶어 "셀러를 데려오고, 매칭하고, 경쟁시키는" 영업 엔진을 강조. 출처: `agency-invites.routes.ts`, `agency-match-suggestions.routes.ts`, `pk-battles.routes.ts`, `promote-boosts.routes.ts`, `agency-introduced-stores.routes.ts`.

| 도구 | 무엇인지 | 핵심 수치 / 작동 | 근거 |
|---|---|---|---|
| **QR/링크 영입** | 8자 코드 QR로 셀러 가입 시 자동 소속 매핑 + 사용 통계 | 8자 영숫자, **7일 유효**, max **100회**, `?invite=<code>` 자동 매핑 | `agency_invite_codes` |
| **자동 매칭 제안** | 점수 기반으로 어울리는 셀러를 제안 → 수락 시 소속 추가 | `score DESC`, `match_reason`, 셀러 tier_score 참고 | `agency-match-suggestions.routes.ts` |
| **매장 영입(store intro)** | 매장을 영입(`introduced_by_agency_id`)하면 매출 2% 영구 + 첫 결제 ₩30,000 | intro 코드 자동 생성, commission ledger(pending/available) | `agency-introduced-stores.routes.ts` |
| **PK 배틀** | 소속 셀러 2명 라이브 매출 경쟁 → 종료 시 우승 자동 결정 + 보상 | owner/manager 생성, 둘 다 라이브 시작 → ends_at 자동 집계 | `pk-battles.routes.ts` |
| **노출 부스팅 쿠폰** | 셀러에게 등급별 부스트 쿠폰 발급 → 라이브 시 메인 피드 가중치 | bronze/silver/gold, **30일 유효** | `promote-boosts.routes.ts` |

`[디자인 지시]` "데려오고(영입) → 매칭하고 → 경쟁시키고(PK) → 띄운다(부스팅)" 4단 영업 엔진 흐름도. PK 는 두 셀러 매출 막대 대결 게이지로 강조.

`[디자인 지시: 그라데이션]` 4단 노드 = 시그니처 그라데이션 채움 + 흰 아이콘, 연결선 warm 그라데이션 흐름. PK 게이지는 좌/우 셀러 막대 — 우세 측 시그니처, 열세 측 회색. 영입 commission(2%/₩30,000) 수치는 시그니처 그라데이션 텍스트. QR 코드 흑백+시그니처 프레임.

---

## 15. FAQ (에이전시) — 실제 정책 근거

1. **Q. 에이전시 가입은 어떻게 하나요? 바로 쓸 수 있나요?**
   A. `/agency/register` 에서 조직명·담당자·이메일·비밀번호로 가입하면 status=`pending` 으로 접수되고, **어드민 승인 후 `active`** 가 됩니다. 카카오 유저는 에이전시로 확장(`register-from-user`)할 수도 있습니다.

2. **Q. 에이전시가 가져가는 수익은 어떻게 되나요?**
   A. (1) 플랫폼 기본 수수료(5%) 중 **30%**가 에이전시 입점 분배(`AGENCY_SHARE_PCT=30`)로 귀속되고, (2) 소속 셀러 매출 기준 **에이전시 본인 commission 2%**(`agencies.commission_rate` default 2.0)가 정산 시 셀러 수수료에 합산됩니다.

3. **Q. 새 매장을 영입하면 얼마를 받나요?**
   A. 영입한 매장(`introduced_by_agency_id`) 매출의 **2%**가 영구 적립되고, 그 가게의 **첫 결제 시 ₩30,000** 가입 보너스가 1회 지급됩니다(`agency-store-intro-commission.ts`).

4. **Q. 소속 셀러를 다른 에이전시에서 데려올 수 있나요? 강제로 빼가는 건 아닌가요?**
   A. 셀러 이전은 from_agency 신청 → to_agency(본인) 수락 → **셀러 본인이 자기 토큰으로 직접 동의**해야만 완료됩니다. 셀러 동의 없이는 절대 이전 불가(TD-016 보안 잠금)이며, 이전 후 **30일 cooldown**이 있습니다.

5. **Q. 팀원에게 권한을 나눠줄 수 있나요?**
   A. owner/manager/agent/analyst **4단계 role**로 멤버를 운영합니다. 정산·멤버·계약 등 민감 작업은 role 별로 게이팅되며(analyst 는 조회만), owner 는 1명입니다.

6. **Q. 셀러 영입은 어떻게 추적되나요?**
   A. QR/링크 영입 코드(8자, 7일 유효, max 100회)를 발급해 셀러가 `?invite=<code>` 로 가입하면 **자동으로 소속 매핑**되고 사용 통계가 집계됩니다. 자동 매칭 제안(`/agency/match-suggestions`)으로도 영입할 수 있습니다.

7. **Q. KPI는 무엇을 보나요?**
   A. 총 매출 · 라이브 진행률 · 유효 라이브 진행률(30분+) · 활성 셀러 · 유효 활성 셀러 · 신규 셀러 **6대 지표**를 week/month 로 봅니다(`/agency/kpi`). 강제 패널티 없이 **참고/벤치마크**용입니다.

8. **Q. PK 배틀·노출 부스팅은 뭔가요?**
   A. PK 배틀은 소속 셀러 2명의 라이브 매출을 경쟁시켜 종료 시 우승자에게 보상하는 동기부여 도구입니다. 노출 부스팅은 등급별(bronze/silver/gold) 쿠폰을 셀러에게 발급해 라이브 시 메인 피드 노출 가중치를 주는 도구입니다(30일 유효).

9. **Q. 에이전시도 공구나 숙소를 직접 운영할 수 있나요?**
   A. 네. 에이전시 단위로 동네딜 공동구매(`/agency/group-buy`)·숙소(`/agency/stays`)·방송 캘린더(`/agency/calendar`)를 운영·대행할 수 있습니다.

10. **Q. 정산·세금은 셀러마다 다른데 어떻게 관리하나요?**
    A. 소속 셀러 주문에 셀러 수수료 + 에이전시 2%가 자동 합산되어 한 화면에 집계되고, 명세서로 증빙됩니다. 원천징수(사업소득 3.3% / 기타소득 8.8%)는 자동 적용되며 사업자 검증 시 면제됩니다.

11. **Q. 외부에 우리 에이전시를 알릴 페이지가 있나요?**
    A. `/a/:slug` 공개 프로필을 제공합니다 — 로고/커버/bio + (옵션) 소속 셀러·누적 매출을 노출해 파트너(셀러) 모집 랜딩으로 쓸 수 있습니다(`agency-public.routes.ts`).

`[디자인 지시]` FAQ 는 아코디언/Q&A 2열 카드. 2·3·4번(수익·영입·이전 보안)을 강조 박스.

`[디자인 지시: 그라데이션]` **FAQ 카드 = subtle, 강조 항목만 액센트.**
> - Q&A 카드 면: 카드 subtle 그라데이션. "Q" 뱃지 원(28~32px)은 시그니처 그라데이션 채움 + 흰 "Q".
> - **2·3·4번 강조 박스**: 좌측 4px warm 그라데이션 액센트 바 + border 시그니처 그라데이션 stroke(1.5px). 본문 `text-gray-900`/`text-gray-700`.
> - 답변 내 핵심 수치(30%, 2%, ₩30,000, 6대 KPI, 4단계)는 시그니처 그라데이션 텍스트.

---

## 16. CTA & 동선

- **주 CTA**: "지금 에이전시 신청하기" → 에이전시 가입(`/agency/register`)
- **보조 CTA**: "에이전시 가이드 보기" → `/agency/guide`, "데모/문의" → `[확인 필요]` 파트너 문의 채널
- **동선**: 표지 → 한 줄 요약 → 문제 → 통합 대시보드 → 가치 제안 → 작동 방식 → 수수료/정산 → 신뢰 → 차별점 → 영입/PK → 온보딩 → **CTA**
- `[확인 필요]` 에이전시 제휴/입점 문의 연락처(이메일/카카오 채널/전화) — 운영 확정 후 CTA 에 삽입.

`[디자인 지시]` 마지막 슬라이드 전면 CTA + QR코드(가입 링크) + 파트너 문의 연락처 자리.

`[디자인 지시: 그라데이션]` **CTA 슬라이드 = 시그니처 버튼 + glow(덱의 마무리 임팩트).**
> - 배경: 흰색 + 옅은 mesh, 또는 상단/배경 띠에 deep 그라데이션 풀폭(표지와 수미상관). 헤드라인 "지금 에이전시로 시작하세요"는 deep 면 위 흰 텍스트(스크림) 또는 흰 배경 위 시그니처 그라데이션 텍스트 중 택1.
> - **주 CTA 버튼**: 시그니처 그라데이션 채움 + 흰 텍스트 + **glow**(`box-shadow:0 8px 28px rgba(255,0,51,.38)`). 가장 강한 시각 요소.
> - **보조 CTA**: 시그니처 그라데이션 **테두리(outline) 버튼**(채움 X, border 1.5px + 흰 배경 + 그라데이션 텍스트).
> - **QR 코드**: 흑백 유지(스캔성), 프레임 테두리만 시그니처 그라데이션. 문의 연락처는 흰 카드 위 `text-gray-700`.
> - 풀강도 그라데이션 면(deep 띠) + 주 CTA 버튼 1개 — 슬라이드당 한도 준수.

---

## 17. 디자인 톤

- **테마**: 에이전시 대시보드 **라이트 테마** 기반. 배경 `#F4F5F7` / 화이트 카드. **`dark:` variant 금지**(대시보드 고정 라이트 룰, `CLAUDE.md`).
- **포인트 컬러**: 유어딜 **#FF0033** (강조/CTA/핵심 숫자).
- **타이포**: 전문적 + 관리자 감성(신뢰·통제·효율). 헤드라인 굵게, 숫자(30%, 2%, ₩30,000, 6대 KPI) 대형 강조.
- **무드**: "통제 가능한 관리"(여러 셀러를 한곳에) + "투명한 수익"(분배/commission 명확). B2B 백오피스 톤 — 과한 이모지/장식 지양, 데이터 기반 신뢰.
- **목업**: 모두 라이트 대시보드. 단 `/a/:slug` 공개 페이지·소속 셀러 링크샵 미리보기 등 유저 대면 화면이 등장하면 그 부분만 실제 테마(다크 가능) `[확인 필요]`.

`[디자인 지시]` 전체 덱: 라이트 베이스(`#F4F5F7`/화이트) + #FF0033 포인트. 숫자·통계는 항상 포인트 컬러 강조. 관리자/백오피스 무드.

---

## 17-A. 🎨 그라데이션 적용 체크리스트 (슬라이드별 SSOT)

> 각 슬라이드의 **면(배경)·주 그라데이션·포인트 그라데이션·필수 여부**를 1:1 지정. 토큰명은 §0-1 SSOT 참조(임의 색 금지). "필수"는 덱의 그라데이션 정체성 유지를 위해 반드시 적용.

| # | 슬라이드 (섹션) | 면(배경) | 주 그라데이션 | 포인트 그라데이션 | 필수 |
|---|---|---|---|---|---|
| 1 | 표지 (§1) | deep 풀폭 + mesh 오버레이 | **deep** (160deg) | 타깃 아이콘=시그니처 원 / 부타깃 pill=warm / 하단 띠=warm 라인 / 배경 트리 실루엣 | ✅ 필수 |
| 2 | 한 줄 요약 (§2) | 흰 + 옅은 mesh | 시그니처 텍스트 클립("한 대시보드"/"30%"/"2%") | 스탯 칩 4개 숫자=시그니처 텍스트 | ✅ 필수 |
| 3 | 상위 레이어/범위 (§1-A,§11) | 흰 + mesh | 에이전시 박스=**시그니처** 풀+glow / 종착=deep | 연결선=warm stroke / 인접 소개서=무채색 grad | ✅ 필수 |
| 4 | 문제→솔루션 (§3) | 좌=무채색 grad / 우=시그니처 | 좌 `linear-gradient(160deg,#E9ECEF,#CED4DA)` / 우 **시그니처** | 전환 화살표=warm / 우측 아이콘 원=시그니처 | ✅ 필수 |
| 5 | 통합 대시보드 (§4) | `#F4F5F7` 목업 (라이트 고정) | 사이드바 활성+모드 토글=**시그니처** / 베젤 상단 바 시그니처 | KPI 숫자=warm 텍스트 / 차트 fill=시그니처→warm | ✅ 필수 |
| 6 | 가치 제안 (§5) | 흰 + mesh | 카드 **subtle** (180deg) 반복 | 아이콘 원=시그니처 / 핵심 6카드=warm 액센트 바 / 수치=시그니처 텍스트 | 권장 |
| 7 | 작동 방식 타임라인 (§6) | 흰 + 옅은 mesh | 진행선=**warm** (90deg) | 번호 배지 1~6=시그니처+glow / 4번 "셀러 동의" 노드=deep + 자물쇠 | ✅ 필수 |
| 8 | 수수료/정산/세금 (§7) | 흰 (데이터) | 표 헤더행=**시그니처**(90deg) | 30%/2%/₩30,000 히어로 숫자=시그니처 텍스트 / 합산공식 콜아웃=subtle+warm 바 | ✅ 필수 |
| 9 | 신뢰/안전 (§8) | deep 풀폭 + mesh | **deep** (160deg) | 배지 카드=흰 + 아이콘 원 시그니처 / 하단 띠=warm | ✅ 필수 |
| 10 | 차별점 비교 (§9) | 흰 (데이터) | 유어딜 컬럼 헤더=**시그니처**(90deg) + `#FFF1F3` 틴트 | 우위 값 텍스트=시그니처 / 대안=회색 | ✅ 필수 |
| 11 | 영입/매칭/PK (§14) | 흰 + mesh | 4단 노드=**시그니처** 채움 | 연결선=warm / PK 게이지=warm(우세)·회색(열세) / 수치=시그니처 텍스트 | 권장 |
| 12 | 온보딩 (§10) | 흰 + 옅은 mesh | 진행선=**warm** (90deg) | 번호 배지 1~4=시그니처+glow / CTA 버튼=시그니처+glow | 권장 |
| 13 | KPI/공개페이지 목업 (§13) | 흰 / `#F4F5F7` 목업 | 목업 베젤=시그니처 / 공개페이지 커버=deep | KPI 숫자=warm 텍스트 / SVG grad def 전역 재사용 | 권장 |
| 14 | 카피 (§12) | 슬라이드별 상이 | 헤드라인 키워드=**시그니처 텍스트** | (각 슬라이드 매핑 = 본 표) | 권장 |
| 15 | FAQ (§15) | 흰 + mesh | 카드 **subtle** | Q 뱃지=시그니처 원 / 2·3·4번=warm 바+시그니처 stroke / 수치=시그니처 텍스트 | 권장 |
| 16 | CTA (§16) | deep 띠 + mesh | **deep** 띠 / 주 CTA=**시그니처 버튼+glow** | 보조 CTA=시그니처 outline / QR 프레임=시그니처 | ✅ 필수 |
| — | 공통(전 슬라이드) | 흰/`#F4F5F7` 베이스에 옅은 mesh | — | 숫자·핵심 키워드=시그니처 그라데이션 텍스트 / 각도 통일(135/160/90deg) | — |

> **글로벌 가드(§0 재확인)**: ① 풀강도 그라데이션 면은 슬라이드당 최대 1개. ② 데이터 표/대시보드 셀 배경엔 그라데이션 금지(흰 유지). ③ 그라데이션 위 흰 텍스트는 진한 부분 + 스크림에서만. ④ subtle 카드 위 본문은 항상 `text-gray-900`/`text-700`. ⑤ 각도는 시그니처/warm=135deg, deep=160deg, 표 헤더=90deg 로 통일. ⑥ **에이전시 대시보드 목업은 라이트(`#F4F5F7`) 고정, `dark:` 금지.**

---

### 부록 A — 핵심 수치 빠른 참조 (디자인 검증용)
| 수치 | 값 | 출처 |
|---|---|---|
| 에이전시 입점 분배 (platform fee 중) | 30% | `policy.ts AGENCY_SHARE_PCT` |
| 인플루언서 입점 분배 (대조군) | 20% | `policy.ts INFLUENCER_INTRO_SHARE_PCT` |
| 에이전시 본인 commission | 2.0% | `policy.ts AGENCY_OWN_RATE` / `agencies.commission_rate` |
| 매장 영입 commission | 2.0% | `store_intro_commission_pct` default (`agency-store-intro-commission.ts`) |
| 매장 영입 가입 보너스 | ₩30,000 (첫 결제 1회) | `SIGNUP_BONUS_AMOUNT` |
| 플랫폼 기본 수수료 | 5% | `policy.ts PLATFORM_FEE_PCT` |
| 영입 코드 유효기간 / 최대 사용 | 7일 / 100회 | `agency-invites.routes.ts` |
| 영입 코드 길이 | 8자 | `agency-invites.routes.ts` |
| 셀러 이전 cooldown | 30일 | `seller-transfer.routes.ts` |
| 멤버 role 수 | 4 (owner/manager/agent/analyst) | `agency-members.routes.ts` |
| KPI 지표 수 | 6 | `agency-kpi.routes.ts` |
| 유효 라이브 기준 | 30분+ | `agency-kpi.routes.ts` |
| 노출 부스팅 쿠폰 유효 | 30일 (bronze/silver/gold) | `promote-boosts.routes.ts` |
| 원천징수 (사업소득/기타소득) | 3.3% / 8.8% | `tax-withholding.ts` |
| 최소 출금액 | 10,000원 | `policy.ts WITHDRAWAL_DEFAULTS.MIN_AMOUNT` |

### 부록 B — 인벤토리 커버리지 (카테고리 E) 매핑
| 인벤토리 라인 | 커버 섹션 |
|---|---|
| **E1 에이전시 셀러 매니징** (담당 셀러·스케줄·캠페인·인센티브) | §4(대시보드), §5 ①⑨⑫, §6 |
| **E2 에이전시 정산/KPI** (입점 분배 30%·정산·KPI·랭킹) | §5 ②③⑤, §7, §13(KPI 목업) |
| **E3 에이전시 매장/셀러 영입** (영입·매칭·PK·부스트) | §5 ④⑥⑦⑧⑩, §6(영입/이전), §14 |
| **E4 에이전시 공구/숙소/캘린더** | §5 ⑪, §4(판매 관리 그룹) |
| **E5 에이전시 공개 페이지/파트너 랜딩** (`/a/:slug`) | §5 ⑬, §13(공개페이지 목업) |
| (경계) 상위 레이어 vs 온라인입점/링크샵/오프라인공구/도매몰 | §1-A, §11 |

### 부록 C — 불확실/확인 필요 목록 (제안서 확정 전 검토)
- 입점 분배 30%의 정확한 적용 대상(전체 매출 vs 영입 귀속) — `[확인 필요]`
- 에이전시 전용 최소 출금액·정산 주기(셀러와 동일 여부) — `[확인 필요]`
- PK 배틀 보상 금액·노출 부스팅 쿠폰 발급 비용 정책 — `[확인 필요]`
- 에이전시 제휴/파트너 문의 연락처 — `[확인 필요]`
- `/a/:slug` 공개 페이지 테마(라이트/다크) — `[확인 필요]`
- 소속 셀러의 도매몰(B2B) 상품 판매 가능 여부 — `[확인 필요]`
- 경쟁사(MCN/Backstage류) 특성/수치 — 전부 `[가정]`, 공식 자료 검증 필요

---

<!-- AUTO-GENERATED:proposal-refs START -->

## 🤖 코드 자동 동기화 (수치 SSOT + 기능 인벤토리) — 자동 생성, 수동 수정 금지

> 도메인: **에이전시**. 이 블록은 `scripts/generate-proposal-refs.mjs` 가 코드에서 추출해 자동 채웁니다.
> 값이 코드와 다르면 코드를 수정하고 `npm run generate:proposal-refs` 실행. (수동 편집 금지 — 다음 커밋에 덮어써짐.)

### 핵심 수치 (자동 추출)

| 항목 | 값 | 출처 (파일:심볼) |
|---|---|---|
| 에이전시 입점 분배 (platform_fee 중) | 30% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.AGENCY_SHARE_PCT` |
| 에이전시 본인 commission (매출 기준) | 2% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.AGENCY_OWN_RATE` |
| 인플루언서 입점 분배 (platform_fee 중) | 20% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.INFLUENCER_INTRO_SHARE_PCT` |
| 크리에이터 매장 영입 commission (default) | 1.5% | `src/worker/utils/influencer-store-intro-commission.ts:DEFAULT_STORE_INTRO_PCT` |
| 원천징수 — 사업소득 (반복 활동, default) | 3.3% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.business_income` |
| 원천징수 — 기타소득 (단발성 협업) | 8.8% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.other_income` |
| 기타소득 분리과세 연 한도 | 3,000,000원 | `src/worker/utils/tax-withholding.ts:ANNUAL_THRESHOLD` |

### 도메인 코드 인벤토리 (자동) — 페이지 (39개)

- `/agency`
- `/agency/calendar`
- `/agency/campaigns`
- `/agency/compare`
- `/agency/contracts`
- `/agency/coupons`
- `/agency/events`
- `/agency/forgot-password`
- `/agency/group-buy`
- `/agency/guide`
- `/agency/incentives`
- `/agency/introduced-stores`
- `/agency/invites`
- `/agency/ledger`
- `/agency/login`
- `/agency/match-suggestions`
- `/agency/members`
- `/agency/messages`
- `/agency/notices`
- `/agency/orders`
- `/agency/pk`
- `/agency/profile`
- `/agency/promote-boosts`
- `/agency/prospects`
- `/agency/ranking`
- `/agency/register`
- `/agency/register/business`
- `/agency/reset-password`
- `/agency/returns`
- `/agency/schedule`
- `/agency/sellers`
- `/agency/sellers/:sellerId/products`
- `/agency/settlements`
- `/agency/stats`
- `/agency/stays`
- `/agency/streams`
- `/agency/targets`
- `/agency/transfers`
- `/agency/waiting`

### 도메인 코드 인벤토리 (자동) — API 엔드포인트 (86개)


**/api/admin/agencies**
- `GET /api/admin/agencies/`
- `POST /api/admin/agencies/`
- `DELETE /api/admin/agencies/:id`
- `PATCH /api/admin/agencies/:id`
- `POST /api/admin/agencies/:id/reset-password`
- `GET /api/admin/agencies/:id/sellers`
- `POST /api/admin/agencies/:id/sellers`
- `DELETE /api/admin/agencies/:id/sellers/:sellerId`
- `GET /api/admin/agencies/unassigned-sellers`

**/api/agency/contracts**
- `GET /api/agency/contracts`
- `POST /api/agency/contracts`
- `PUT /api/agency/contracts/:id`

**/api/agency/dashboard**
- `GET /api/agency/dashboard/bundle`

**/api/agency/forgot-password**
- `POST /api/agency/forgot-password`

**/api/agency/intro-code**
- `GET /api/agency/intro-code`

**/api/agency/introduced-stores**
- `GET /api/agency/introduced-stores`
- `GET /api/agency/introduced-stores/commissions`
- `GET /api/agency/introduced-stores/summary`

**/api/agency/invite-seller**
- `POST /api/agency/invite-seller`

**/api/agency/kakao-link-status**
- `GET /api/agency/kakao-link-status`

**/api/agency/kpi**
- `GET /api/agency/kpi/`

**/api/agency/kpiagency**
- `GET /api/agency/kpiagency`

**/api/agency/link-kakao**
- `POST /api/agency/link-kakao`

**/api/agency/login**
- `POST /api/agency/login`

**/api/agency/match-suggestions**
- `GET /api/agency/match-suggestions`
- `POST /api/agency/match-suggestions/:id/accept`
- `POST /api/agency/match-suggestions/:id/decline`

**/api/agency/monthly-tasks**
- `GET /api/agency/monthly-tasks`

**/api/agency/my-agency-status**
- `GET /api/agency/my-agency-status`

**/api/agency/notices**
- `GET /api/agency/notices`
- `POST /api/agency/notices`

**/api/agency/notifications**
- `GET /api/agency/notifications`
- `PUT /api/agency/notifications/read-all`

**/api/agency/orders**
- `GET /api/agency/orders`

**/api/agency/pin-status**
- `GET /api/agency/pin-status`

**/api/agency/profile**
- `GET /api/agency/profile`
- `PUT /api/agency/profile`

**/api/agency/ranking**
- `GET /api/agency/ranking`

**/api/agency/register**
- `POST /api/agency/register`

**/api/agency/register-from-user**
- `POST /api/agency/register-from-user`

**/api/agency/report**
- `GET /api/agency/report/csv`

**/api/agency/request-kakao-stepup**
- `POST /api/agency/request-kakao-stepup`

**/api/agency/reset-password**
- `POST /api/agency/reset-password`

**/api/agency/returns**
- `GET /api/agency/returns`

**/api/agency/schedule**
- `GET /api/agency/schedule`

**/api/agency/self-events**
- `GET /api/agency/self-events/`
- `POST /api/agency/self-events/`
- `POST /api/agency/self-events/:id/cancel`
- `POST /api/agency/self-events/:id/join`
- `GET /api/agency/self-events/:id/leaderboard`

**/api/agency/self-eventsagency**
- `GET /api/agency/self-eventsagency`

**/api/agency/sellers**
- `GET /api/agency/sellers`
- `GET /api/agency/sellers/:id/inventory`
- `GET /api/agency/sellers/:id/products`
- `POST /api/agency/sellers/:id/products`
- `PUT /api/agency/sellers/:id/products/:productId`
- `GET /api/agency/sellers/:id/stats`
- `POST /api/agency/sellers/:id/streams`
- `GET /api/agency/sellers/compare`

**/api/agency/set-pin**
- `POST /api/agency/set-pin`

**/api/agency/settlement-invoices**
- `GET /api/agency/settlement-invoices`
- `GET /api/agency/settlement-invoices/:id`

**/api/agency/settlements**
- `GET /api/agency/settlements`
- `GET /api/agency/settlements/csv`
- `POST /api/agency/settlements/request`

**/api/agency/stats**
- `GET /api/agency/stats`
- `GET /api/agency/stats/batch`
- `GET /api/agency/stats/daily`
- `GET /api/agency/stats/kpi`
- `GET /api/agency/stats/kt-alpha`
- `GET /api/agency/stats/realtime`

**/api/agency/stays**
- `GET /api/agency/stays`
- `GET /api/agency/stays/bookings`
- `GET /api/agency/stays/kpi`

**/api/agency/streams**
- `GET /api/agency/streams`

**/api/agency/targets**
- `GET /api/agency/targets`
- `PUT /api/agency/targets`

**/api/agency/transfers**
- `GET /api/agency/transfers/`
- `POST /api/agency/transfers/`
- `POST /api/agency/transfers/:id/cancel`
- `POST /api/agency/transfers/:id/respond`
- `POST /api/agency/transfers/:id/seller-approve`

**/api/agency/transfersagency**
- `GET /api/agency/transfersagency`

**/api/agency/unlink-kakao**
- `POST /api/agency/unlink-kakao`

**/api/agency/verify-pin**
- `POST /api/agency/verify-pin`

**/api/agencyagency**
- `GET /api/agencyagency`


> 마지막 생성: 2026-06-07T09:17:23.153Z
> 생성기: `scripts/generate-proposal-refs.mjs`

<!-- AUTO-GENERATED:proposal-refs END -->
