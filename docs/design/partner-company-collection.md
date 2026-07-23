# 🤝 B2B 파트너(업체) 수집 트랙 — 설계 SSOT

> **2026-07-21 대표 확정** (이 세션): 유어애즈(ur-ads) 워커 안에 **인플루언서 수집 옆에 업체(파트너) 수집 트랙**을 additive 로 붙인다.
> 목적 = 유어딜 매장 입점을 **대신 데려올 수 있는 업체들의 공개 연락처 DB** 구축.
> 1차 = 마케팅 대행사, 2차 = 소상공인 접점 업체(POS·간판·세무사·주류도매·프랜차이즈 본사 등).

> **우선순위(대표 확정)**: ① 지역 키워드 시딩(기존 요청) · ② 유어애즈 확인 8문항 → **그다음** 이 트랙. 9월 대행사 영업 시작 전까지 라이브면 충분.
> **착수 순서(대표 승인)**: 테이블·어드민(상태머신 포함) 먼저 → 레인 A(자동수집) → 레인 B(레지스트리 배치) → 레인 C(수동). 어드민이 뜨면 대표가 방배 리드를 첫 주부터 손으로 입력 시작.

---

## 0. 한 줄 요약 — 인플루언서와 **같은 결**, 바이어와는 **다른 결**

| | 🎬 인플루언서 | 🤝 업체(파트너) | 🌐 해외 바이어 |
|---|---|---|---|
| 성격 | 영입 깔때기(볼륨) | **영입 깔때기(볼륨)** | 매칭·자격심사(소수 고가치) |
| 발견 | 키워드 × 콘텐츠 플랫폼 검색 API | **키워드 × 지역 네이버 검색 API + 공공 레지스트리** | 대표 등록 무료 피드(스크래핑 X) |
| 신호 | 구독자 수 | 접점 성격(소상공인 반복 접촉) | 한국 수입 이력 |
| 컨택 | 채널 주인 이메일 | **업체 대표 전화/이메일** | 회사→구매담당자(MD) 2단 |
| 소속 워커 | ur-ads | **ur-ads (동일)** | 도매(wholesale) 워커 |

**결론**: 업체 트랙은 **인플루언서 트랙의 사실상 복제**다(같은 ur-ads 워커, 같은 `FetchBudget`, 같은 어드민 풀 UI 패턴, 같은 아웃리치 상태머신). 해외 바이어와는 소속 워커·수집 방식이 다르다.

**머지 = 라이브 영향 0**: 신규 격리 테이블 `ad_company_leads` + 게이트 `ADS_COMPANY_COLLECT_ENABLED`(기본 OFF). 자동 발송 경로 **부존재**.

---

## 1. 대원칙 (인플루언서 수집과 동일)

1. **수집 ≠ 발송.** 공개 API + 업체가 스스로 공개한 홈페이지 연락처만 저장. 자동 발송 **절대 없음**. ✉는 **mailto 초안만**(수신거부 문구 포함). B2B도 광고성 메일은 정보통신망법 사전 동의 대상 → 동일 가드.
2. **ur-ads 워커 내 구현** — 메인 무접촉, Service Binding(`env.ADS`) 유지, **커스텀 도메인 금지**(2026-04-22 사고 준수).
3. **유어딜 데이터는 읽기전용 경계** 그대로. 소비자/도매 트랜잭션 테이블 무접촉.
4. **인플루언서와 격리** — 별도 테이블·별도 키워드 풀·별도 커서. 한쪽 쿼리가 다른 쪽 행을 안 건드림.

---

## 2. 접점 분류 (대표 리스트 — 수집 카테고리 SSOT)

소상공인 사장님을 **반복적으로·신뢰 관계로 만나는 업체**가 기준. `category`(접점 성격) × `subcategory`(구체 업종) 2단.

| category | subcategory 예시 | 접점 강도 |
|---|---|---|
| **매장 인프라·장비** | POS·카드단말기(VAN 대리점), 테이블오더(티오더류), 키오스크, CCTV·보안, 간판, 인테리어, 주방설비 | 개업 시점 접점 |
| **정기 납품** | 주류 도매상, 식자재 유통·배송, 커피 원두, 유제품 배송, 배달대행 지사 | 주 단위 방문 — **신뢰 최상** |
| **전문 서비스** | 세무사·기장, 노무사, 정책자금·소상공인 대출 컨설팅, 상가 전문 부동산 | 모든 사업자 필수 거래처 |
| **창업 생태계** | 창업 컨설팅·상권분석, 창업박람회 운영사, 프랜차이즈 본사(10~50개점 중소), 소상공인 교육기관 | 창업 초기 접점 |
| **지역 조직·기관** | 상인회·전통시장 상인회, 소상공인연합회 지부, 지역 협동조합, 청년몰 운영단, 상권활성화재단·도시재생센터, 새마을금고·신협 | B2G 확장면 |
| **미디어·커뮤니티** | 지역 신문·매거진, 아파트 게시판 광고 대행, 체험단·플레이스 마케팅 업체 | 매장+소비자 양면 |
| **마케팅 대행사(1차)** | 퍼포먼스/바이럴/지역 마케팅 대행, 병원·뷰티 마케팅 대행 | 9월 영업 본진 |

> ⚠️ **수집 제외**: 지역 맘카페·당근 동네생활 **운영진**은 '업체'가 아니라 개인 + 스스로 공개한 사업자 연락처가 아님 → 대원칙 위반. DB 대상 아님(접촉은 카페 공식 제휴글로, DB화 X).

### 우선순위 tier (대표 방배 기준 1~5 — **어드민에서 수동 조정 가능**)

정렬 기준 = ① 인센티브 정렬(소개할 이유 있나) ② 결정권자 만나기 쉬운가 ③ 방배에서 바로 되나.

1. **주류 도매상·식자재 납품** — 신뢰 최상 + 방배 요식업 전부와 이미 거래 + 사장 개인이 결정권자
2. **상가 부동산 + 간판집** — 신규 개업 매장을 남보다 먼저 아는 조합, 개업 패키지와 맞물림
3. **POS·테이블오더 대리점** — 디지털 수용성 높은 매장만 걸러 데려오는 필터 효과
4. **세무사 사무소** — 접점 최강이나 문화 보수적 → 2~3분기 숙성용
5. **중소 프랜차이즈 본사** — 한 방 최대이나 승인 프로세스 있어 속도전 부적합(10월 이후)

> `tier` 는 **시드 기본값만 부여**하고, 최종은 어드민 수동 조정(방배에서 화법 검증 후 재정렬). UI 1급 필터.

---

## 3. 3레인 설계 — 접점 성격별로 수집 방식이 다르다

**하나의 수집기가 아니다.** 같은 테이블(`ad_company_leads`)에 쌓되, 유입 경로를 3개 레인으로 분리한다(`source` 컬럼으로 구분).

### 레인 A — 자동 수집 (네이버 지역검색 주력)

동네에 간판 걸고 장사하는 업체 = 네이버 플레이스에 존재 → **"지역 × 업종" 키워드 그리드**로 자동 수집. 전화·주소 즉시 확보.

- **주 소스: 네이버 지역검색 API** (`search/local.json`) — 업체명·**전화**·주소·카테고리·**홈페이지 링크**. 무료, 일 25,000/앱.
- **보충: 네이버 웹문서** (`search/webkr.json`) — 지역검색에 안 잡히는 대행사 홈페이지.
- **이메일 보충 크롤**: 수집된 홈페이지 URL 1~2p(메인+회사소개/컨택)에서 공개 이메일·전화 정규식 추출.
- **대상**: 마케팅 대행사, 주류도매·식자재, 상가부동산·간판·인테리어·주방설비, 세무사·노무사, POS·키오스크·테이블오더 대리점, 창업컨설팅·상권분석.
- **키워드 시딩**: 방배·서초·강남부터 (인플루언서 트랙의 서울 25구 그리드 패턴). 대행사 + 지역×업종.

> ⚠️ **네이버 엔드포인트 정정(구현자 필독)**: 기존 인플루언서 트랙은 `local.json`/`webkr.json`을 **안 쓴다**(`blog.json`/`cafearticle.json`+유튜브+카카오 사용). 즉 지역검색/웹문서는 ur-ads 에 **새로 붙이는 엔드포인트**다 — 단, 같은 네이버 무료 Search API(같은 Client-Id/Secret)라 엔드포인트 추가만으로 가능. 일 25,000 쿼터 안에서 인플루언서 분량과 공존 확인 필요.

### 레인 B — 레지스트리 일괄 (공식 명부가 크롤보다 나은 것들)

검색으로 긁는 것보다 공식 명부 임포트가 압도적으로 좋은 카테고리. **크론 아님 — 분기 1회 배치 임포트**.

- **프랜차이즈 본사** → 공정위 **가맹사업 정보공개서**(등록 본사 전국 명부 + 대표 연락처 공개). 가맹점 수로 "10~50개점 중소" 필터.
- **새마을금고·신협** → 중앙회 지점 명부 공식 공개.
- **소진공 교육 수행기관** → 선정기관 목록 공고.
- 붙이는 법: 해외 바이어의 `fetchFeeds` 패턴 참고(대표 등록 무료 소스 → JSON 정제 → 임포트).

### 레인 C — 수동 큐레이션 (자동화 부적합)

- **상인회·협동조합·상권활성화재단** — 지역당 몇 개 + B2G 관계 기반. 어드민에서 손으로 등록 + 상태머신 관리.
- 자동수집 없이 어드민 수기 입력. (대표 방배 리드 첫 주 입력도 이 경로.)

---

## 4. 데이터 모델 — 신규 격리 테이블 `ad_company_leads`

> **현재 레포에 존재하지 않음**(grep 확인). 신규 생성. 인플루언서 `ad_influencer_leads` 와 **분리**.

**생성 방식**: 인플루언서 트랙과 동일하게 **런타임 `ensureCompanySchema()`**(`CREATE TABLE IF NOT EXISTS` + 멱등 `ALTER TABLE ADD COLUMN`). `migrations/` 아님(ur-ads 는 CI 마이그레이션 미작동 — repair-schema 패턴).

컬럼(초안):
```
id, company_name, category, subcategory, tier(int, 시드 기본값·어드민 조정),
region, website, email, phone, address, description,
source('local'|'webkr'|'registry'|'manual'), source_keyword,
status('new'|'contacted'|'interested'|'contracted'|'rejected'|'hold'),
memo, contact_channel, outreach_draft(JSON),
contacted_at, follow_up_at, collected_at
```

- **중복 차단**: `UNIQUE(website)` 우선, website 없으면 `UNIQUE(company_name, region)` 보조. (인플루언서의 `ON CONFLICT DO UPDATE` upsert 패턴.)
- **연락처 자가치유 백필**: 빈 값(email/phone)만 `COALESCE` 로 채움 — status/memo/tier 는 불변(수동 큐레이션 보존).
- **저장**: `DB.batch`, CHUNK=50 (인플루언서 `saveLeadsBatch` 미러).
- **2차 dedup**: 어드민 트리거 merge-duplicates(email → phone 순, 인플루언서 패턴 재사용).

---

## 5. 크론·예산 (인플루언서와 공유)

- ur-ads 는 **단일 매시간 크론**(`0 * * * *`)을 `scheduled()` 안에서 `hourUTC` 로 분기(계정 5-크론 한도 때문). 이 패턴에 업체 분기를 얹음.
- **분기: 짝수 시 = 인플루언서, 홀수 시 = 업체** (`event.scheduledTime` 기준). 서로 예산 독점 → 겹침 0.
- **`FetchBudget` 공유**(tick당 실제 기본 300, 문서 180): 업체 분기가 자기 시각엔 예산 전량 사용. 별도 env `ADS_COMPANY_SUBREQUEST_BUDGET` 로 조정 가능(미설정=공용값 상속).
- **네이버 쿼터**: 일 25,000/앱. 지역검색+웹문서 추가분이 인플루언서 blog/cafe 분량과 합쳐 한도 내인지 diag 로 확인(수용기준 ③).
- 커서: `platform_settings` 별도 키(`ads_company_cursor` 등). 인플루언서 커서 무접촉.

---

## 6. 어드민 — `/admin/partner-pool` (인플루언서 풀 복제·간소화)

- **페이지·CRUD 는 메인 앱**(`/api/admin/ads/partner-pool/*`, 메인 admin JWT). **수집 엔진만 ur-ads**(`runCompanyAutoCollect`). 수집 트리거는 메인→`env.ADS.fetch('/__ads/collect-company')` 위임(인플루언서 `/__ads/collect` 미러).
- **필터(1급)**: 카테고리 / subcategory / 지역 / **tier** / 이메일·전화 보유 / 상태 / 검색.
- **재사용**: 아웃리치 상태머신(new→contacted→interested→contracted / rejected·hold) · 팔로업(follow_up_at 다이제스트) · 엑셀 내보내기(CSV 수식 인젝션 가드) · 중복 통합.
- **화면 우선순위**: 대표 실사용 = "방배 + tier 1~2 → 엑셀 → 동선표". 이메일보다 **전화·주소·방문기록**이 앞에 오는 레이아웃.
- **tier 수동 조정**: 인라인 편집(PATCH `/partner-pool/:id`).
- **관측성**: diag 에 company 트랙 추가(`{configured, found, saved, error}` per source), 기존 배너·Discord 경보에 합류.

---

## 7. 미해결 결정지점 (착수 전 확정 필요)

### 결정 1 — 홈페이지 이메일 크롤 방식 ⚠️ (수용기준 ② 관건)

`pickBusinessEmail`은 **주어진 텍스트에서 이메일만 추출하는 순수함수**(크롤 안 함). 실제 홈페이지 fetch 는 별도 fetcher 가 하는데 인플루언서 트랙은 **host 화이트리스트**(정해진 도메인만)로 SSRF 방어 → **임의 업체 홈페이지와 충돌**. 두 방식 중 택1:

- **(a) robots.txt 존중 임의 도메인 fetcher 신설** — 요청서 명시("robots.txt 존중"). ⚠️ 현재 ur-ads 엔 robots.txt 로직 없음(별도 `naver-ad-scraper` 에만) → **신규 컴포넌트**. 이메일 확보율↑.
- **(b) 크롤 없이 네이버 검색 스니펫 연락처만 추출** — 안전하나 이메일 확보율↓ → 수용기준 40% 미달 위험.

> **권장**: 착수 전 **표본 검증** — 네이버 지역검색 실응답 + 프랜차이즈 정보공개서로 대상별 **전화/이메일 실제 확보율**을 찍어보고 (a)/(b) 결정. 전화 우선이면 (b)로도 40% 달성 가능(지역검색이 전화를 바로 줌).

### 결정 2 — 이메일 vs 전화 우선

지역검색은 **전화를 바로** 준다. 대행사·POS·간판은 전화/문의폼으로 접촉하니 "전화 우선"이면 이메일 크롤 없이 수용기준 충족 가능. 이메일 크롤은 그 위 보너스. (결정 1 (b) 와 연결.)

---

## 8. 수용 기준 (대표 확정)

1. 키워드 10개 시딩 후 **48시간 내 업체 리드 300+ 적재**
2. **이메일 또는 전화 보유율 40%+**
3. 인플루언서 수집 **성능·쿼터에 영향 없음**(diag 로 확인)
4. **자동 발송 경로 부존재**

---

## 9. 구현 todo 체크리스트

- [x] `ad_company_leads` 테이블 + `ensureCompanySchema()` (런타임, `UNIQUE(company_key)`·빈컨택 백필) — `company-discovery.ts`
- [x] `/admin/partner-pool` 페이지 + `/api/admin/partner-pool/*` (메인 워커, requireAdmin, 프록시 비위임) — `partner-pool.routes.ts` · `AdminPartnerPoolPage.tsx`
- [x] 아웃리치 상태머신(new→contacted→interested→contracted/rejected·hold)·팔로업·CSV(수식인젝션 방어) — 수동입력 + 인라인 편집
- [x] tier 인라인 수동 조정 (1~5, 목록 셀렉트 + 추가 폼)
- [ ] 중복통합(website/회사명|지역 키 멱등 upsert 로 1차 방어 — merge UI 는 후속)
- [x] **레인 A**: 네이버 지역검색(`local.json`) 어댑터 — `company-collect.ts` `searchNaverLocal`(전화·주소·홈페이지링크·카테고리, display 5) → `saveCompanyLeads`. (웹문서 `webkr.json` 은 후속 보충)
- [x] 키워드 풀 `ad_company_keywords`(category/subcategory/region) + 방배/서초/강남 × 12업종 + 지역무관 대행사 5 시딩
- [x] 크론 **홀수시** 분기(인플루언서 매시간 유지 → 반토막 방지) + `runCompanyAutoCollect` + 커서(`ads_company_cursor`) + `FetchBudget`(별도 60) · 수동 트리거 `/__ads/collect-company`(ur-ads) ← `/api/admin/partner-pool/collect`(메인 위임) · 어드민 '지금 수집' 버튼 + 게이트/최근실행 상태
- [ ] 홈페이지 이메일 크롤 (결정 1 확정 후 (a) or (b)) — phone-first 라 수용기준은 지역검색 전화로 충족, 이메일은 additive 후속
- [ ] 웹문서 `webkr.json` 보충(대행사 홈페이지)
- [ ] **레인 B**: 공정위 정보공개서·명부 배치 임포트(`fetchFeeds` 패턴)
- [ ] **레인 C**: 어드민 수기 입력 경로
- [ ] diag(company found/saved/error) + Discord 경보 합류
- [ ] 게이트 `ADS_COMPANY_COLLECT_ENABLED`(기본 OFF)
- [ ] 표본 검증: 대상별 전화/이메일 확보율 → 결정 1·2 확정
- [ ] 맘카페/당근 운영진 **수집 제외** 확인

---

## 11. 🔄 공공데이터 API 전환 (2026-07-22 대표 확정 — "크롤보다 이게 먼저") · 착수: 키 발급 후

**배경(대표)**: 네이버 검색 API 는 상위 노출분만 조각조각 + 폐업 업체가 계속 남음 → "계속 자동"이 안 됨.
공공데이터 API 로 전환하면 **전국 단위를 통째로·주기적으로** 받고, 국세청 상태조회로 폐업 자동 정리 가능.
**우선순위: 소스 1(상가정보)이 압도적** — tier 2~5 를 한 번에 해결. 여기부터 착수.

### 소스 3종 (공공데이터포털, 키=대표 발급)
| 소스 | 커버 | 방식 | 주기 |
|---|---|---|---|
| **① 소상공인 상가(상권)정보** (data.go.kr 15090955) | **tier 2~5** 전부(주류도매·식자재·부동산·간판·인테리어·주방설비·POS·세무…) | 업종코드(대10/중75/소247) × 지역으로 **검색 아닌 통째 조회**. 상호·업종코드·지번/도로명주소·경위도. 개발계정 일 1,000 / 운영계정 일 100,000(승인 1~2일) | **주 1회 지역 순환** |
| **② 공정위 가맹정보** (fairdata / data.go.kr 15125570) | **tier 6 프랜차이즈 본사** | 정보공개서 목록 + 브랜드별 가맹점 현황(평균매출·가맹점수). 가맹점 수 10~50 필터 자동 | **월 1회 배치** |
| **③ 통신판매사업자** | 이메일 보강(온라인 겸업 업체) | 사업자번호 기준 상호·대표자·전화·전자우편(일부 비식별화). 나머지는 홈페이지 크롤 2단 | 보강 루프에 편입 |

**유지(전환 안 함)**: **마케팅 대행사(tier 1)** — B2B 서비스업이라 상가정보 업종분류 미포착 → 네이버 지역검색·웹문서 + 홈페이지 이메일 크롤 유지.

### 🔁 4 루프 (지금은 ①발굴만 있음 — 나머지 셋이 있어야 DB 안 썩음)
1. **발굴** — 공공 API 정기 조회(상가 주1회·공정위 월1회) + 네이버(대행사) 보완.
2. **보강** — 연락처 없는 리드에 이메일·홈페이지 채우기(크롤 = 이미 구현, 자가치유 백필 재사용). 매시간 잔여 예산.
3. **갱신** — 공공 API 재조회 diff 로 기존 리드 상호·주소·전화 변경 반영.
4. **정리** — 폐업 비활성화. **국세청 사업자등록 상태조회 재활용**(셀러 가입에 이미 쓰는 그 API). 월 1회.

### 스키마/어드민 (전환 시 additive)
- `ad_company_leads` += `data_source`(publicapi/naver/manual) · `last_verified_at` · `business_no`(상태조회 키) · `active`(폐업 0).
- **subcategory ↔ 업종코드 매핑 테이블**(우리 접점 업종 ↔ 상가정보 소분류 247) — 소스 ① 어댑터의 SSOT.
- 어드민: 리드에 `data_source` + `last_verified_at` 표시, **폐업/활성 필터** 추가.
- 기존 `FetchBudget`·커서·게이트(`ADS_COMPANY_COLLECT_ENABLED`) 승계.

### 착수 게이트(대표 몫)
data.go.kr 가입 → **상가(상권)정보 + 공정위 가맹정보 활용신청**(개발계정 30분 / 운영계정 승인 1~2일). 발급 후 어댑터 착수 — **소스 ① 부터**.

## 12. 🗺️ 공공데이터 소스 로드맵 (2026-07-22 대표 확정 — A급 지금 신청 / B급 후속)

**엔티티 3개 분리** (한쪽 쿼리가 반대쪽 무접촉):
| 엔티티 | 테이블 | 소스 | 용도 |
|---|---|---|---|
| 업체 파트너 리드 | `ad_company_leads`(구현됨) | 네이버·상가정보·공정위·통신판매 | 매장을 *데려올* 업체 |
| 🆕 매장 후보 | `store_prospects`(신규) | **지방행정 인허가정보** | 유어딜에 *입점시킬* 매장 |
| 🆕 공고 스캐너 | `gov_notices`(신규) | 나라장터·기업마당 | B2G 수주 + 지원사업 관계영업 |
+ **도로명주소 API** = 3 엔티티 공통 주소정규화·좌표통일 → **중복 판별 백본**(소스 3~4개면 필수).

### A급 (지금 신청·구현)
1. **지방행정 인허가정보** → `store_prospects` (유어딜 최고 소스). 일반음식점·휴게음식점·미용업·숙박업 등. **전체분 다운로드(월)** + **변동분 OPEN API(일)**. `영업상태구분코드` = 01 영업중 / 02 휴업 / 03 폐업 / 04 취소·말소·만료·정지. 3용도 동시: ⓐ 매장 발굴(방배 요식·미용 전수) ⓑ **신규 개업 감지**(이번주 인허가 → 개업 직후 = 입점 전환율 최고 세그먼트, 개업 패키지 영업 리드 자동 축적) ⓒ 폐업 자동 정리(03/04 → 4루프 '정리' 완성). ⚠️ **localdata.go.kr 2026-04-16 폐쇄** → 공공데이터포털 이관(데이터찾기 > 국가중점데이터 > '인허가').
2. **소상공인 상가(상권)정보** → `ad_company_leads`. **구현 완료**(아래 로그, 2026-07-22 코드 확정). tier3·5 전문서비스·인프라. ⚠️ 도매업 분류 없음 → tier2 도매는 네이버.
3. **조달청 나라장터 입찰공고정보** → `gov_notices`. 물품·용역·공사·외자 입찰공고+기초금액+참가지역+변경이력. **오퍼레이션이 업무구분별로 나뉨**(맞는 것 써야 정상응답). "상권활성화·소상공인·마케팅" 키워드 매일 스캔 → 알림. 하반기 공고 러시(10~12월) 누락 방지.
4. **기업마당(bizinfo) 지원사업 공고 API** → `gov_notices`. 기관·분야별 지원사업 공모. 지자체 소상공인 지원사업 자동수집 → ⓐ 직접 응모 ⓑ 상인회·아인에 "이런 사업 떴어요" 전달(관계 영업 무기).

### B급 (붙이면 좋은 것)
- **공정위 가맹정보**(tier6 프랜차이즈, 결정 완료) · **통신판매사업자**(이메일 보강) — 둘 다 `ad_company_leads`.
- **도로명주소 API** — 주소 정규화·좌표 통일(소스 3~4개로 늘면 중복 판별 필수).
- **한국관광공사 TourAPI** — 숙소 카테고리 보강 + 지역 축제·행사 → 드랍 캘린더 시즌 편성.
- **기상청 단기예보** — 날씨 연동 딜 추천(비 오는 날 국밥). 후순위.

### 착수 순서(권장)
① 상가정보(완료) → ② 인허가 `store_prospects`(매장 발굴+개업 감지+폐업 정리 = 핵심) → ③ 공고 스캐너(나라장터+기업마당) → ④ 도로명주소 dedup → B급.
각 소스: **대표 활용신청 → 키 → 게이트 OFF 배포 → 라이브 실측/diag → 확정.** (이 환경은 네트워크 정책상 data.go.kr 미도달 → 실검증은 ur-ads 라이브에서.)

## 10. 구현 로그

- **2026-07-23 — 이메일 확보 최우선 강화 (대표 "이메일이 가장 중요, 가장 이상적으로").**
  - **크롤러 `mailto:` 우선화**: `contact-enrich.ts` 신규 `extractEmailFromHtml` — HTML 의 `mailto:` href(업체가 명시적으로 건 연락 링크 = 최고 신뢰) 먼저, 없으면 본문 `pickBusinessEmail`(난독복원+문맥점수). 플랫폼 기본값/플레이스홀더(wixpress/example/your-domain…) 제외. `crawlContact`(홈+/contact/about/company/contact-us/company/contact 6경로)·`crawlCompanyEmail` 둘 다 이 추출기 경유 → 이메일 수율↑. 추측·조합 0.
  - **매장 후보(store_prospects) 이메일 경로 신설(기존 0)**: 인허가엔 이메일이 없음 → `email`/`website`/`contact_source` 컬럼 추가(ALTER 보강) + 신규 `prospect-enrich.ts` `enrichProspectContacts`: ① website 있으면 홈페이지 크롤 ② 없으면 **네이버 지역검색으로 홈페이지 link 발견**(`naverLocalLookup` — 카카오 place_url 은 지도라 크롤 불가, 네이버 `link` 가 실홈페이지) → 크롤 ③ 전화 없으면 카카오로 부가 보강. 상호+주소 완전일치만 채택(허위 방지). 인허가 전화는 `contact_source='govreg'` 태그, 재수집이 이메일/홈페이지 덮어쓰지 않음(COALESCE 대칭).
  - **배선**: `/api/admin/store-prospects/enrich-contacts` → ur-ads `/__ads/enrich-prospects`(`enrichProspectContacts`) + **매시간 자동 드레인**(게이트 `ADS_LOCALDATA_ENABLED`) → 이메일 백로그 자동 소진. 어드민 '📧 이메일 보강' 버튼 · '이메일 보유' 통계 · '이메일 보유만' 필터 · 목록 이메일 컬럼(출처 태그 + mailto 링크).
  - **정직한 한계 명시**: 식당·미용실·숙박 대다수는 홈페이지/게시 이메일이 없어 이메일 수율은 구조적으로 낮음(버그 아님). 이메일이 많은 곳 = 온라인 겸업(**통신판매사업자** — 등록 이메일 직접 제공)·프랜차이즈·홈페이지 보유 매장. tsc 0·sql(bind/column/table/not-null)/theme/file-size/pagination 가드 GREEN.
- **2026-07-23 — 인허가 전 업종 엔드포인트 고정 (미용업·숙박업·동물미용업 승인 완료).** 대표 활성화 화면 3장 추가 공유. `LICENSE_UPJONG` SSOT 에 `beauty_salons=미용업`·`tourist_accommodations=숙박업`·`pet_grooming=동물미용업` 고정(기존 general_restaurants·rest_cafes 와 합쳐 5업종). `LICENSE_CATEGORIES` 5종. env 임시병합(ADS_LOCALDATA_ENDPOINTS) 불필요해짐(향후 추가 업종용으로만 잔존). tsc 0·sql/file-size 가드 GREEN. ⚠️ 키(일반 인증키)는 Cloudflare 환경변수에만 — 코드 무노출.
- **2026-07-23 — 인허가 어댑터 실구조 교정 (업종별 개별 REST 엔드포인트 + localdata 소문자 필드).** 대표가 활성화 화면 2장 공유(일반음식점 `/1741000/general_restaurants`·휴게음식점 `/1741000/rest_cafes`, 참고문서 개방자치단체코드·영업상태코드.xlsx, REST/JSON, 처리상태 승인).
  - **발견**: 인허가는 **단일 API + opnSvcId 파라미터가 아니라 업종별 엔드포인트가 따로**이고, 응답 필드는 **localdata 표준 소문자**(bplcnm/sitetel/sitewhladdr/rdnwhladdr/trdstategbn/apvpermymd/lastmodts/opnsvcid/mgtno/opnsfteamcode/uptaenm/x/y). opnSvcId 는 쿼리가 아니라 **응답 필드**에서 복합키로 회수. (이전 어댑터는 단일 URL+opnSvcId 쿼리+카멜케이스 가정 — 전부 교정.)
  - **`store-prospects.ts`**: `LICENSE_UPJONG` 를 **endpoint 슬러그→카테고리 SSOT**로 재정의(general_restaurants=일반음식점·rest_cafes=휴게음식점 2종 승인분; 미용업·숙박업은 활성화 후 추가) + 필터 표시용 `LICENSE_CATEGORIES`(4업종 전체). 라우트 `/meta` categories = LICENSE_CATEGORIES.
  - **`localdata-collect.ts`**: 베이스 `https://apis.data.go.kr/1741000` + `Object.entries(LICENSE_UPJONG)` 순회로 `/{slug}` 조회(opnSvcId 쿼리 제거). URL `?serviceKey&pageIndex&pageSize=500&type=json&resultType=json&lastModTsBgn&lastModTsEnd`. `extractRows`(봉투 다형태: `{<svc>:{row}}`·response.body.items.item·result.body.rows[0].row·data[]) + `g()`(소문자 우선·카멜 폴백) 방어 파싱. head[].RESULT.MESSAGE 회수 → 0건 시 diag.error 노출(키오류/등록대기 감지). 복합키 opn_svc_id 는 응답 opnsvcid(없으면 슬러그 폴백).
  - **무배포 확장**: `ADS_LOCALDATA_ENDPOINTS` env(JSON `{"beauty_shops":"미용업",…}`)로 미용업·숙박업 슬러그를 활성화 후 코드배포 없이 병합. `ADS_LOCALDATA_ENDPOINT` 는 이제 공통 베이스 override.
  - tsc 0·sql(bind/table)/file-size 가드 GREEN. ⚠️ 실검증은 ur-ads 라이브(이 환경 프록시 data.go.kr 차단): `ADS_LOCALDATA_ENABLED=true` + '인허가 수집' → diag.sample 로 실필드 최종 확인.
- **2026-07-22 — 연락처 확보 폭포수(waterfall) + 출처(provenance) 태그.** 대표 "지금 방식+다른 경로 섞어서 가장 이상적으로".
  - **📇 `contact-enrich.ts`**: ① **카카오 로컬 API**(`dapi.kakao.com/v2/local/search/keyword`, `KAKAO_REST_API_KEY` 보유) — 네이버가 못 주는 **전화를 준다**. 상호 완전일치 + 주소 동일매장(토큰 2개+ 공유)일 때만 채택. ② **홈페이지 크롤 확장** — 이메일 + **전화(tel:/패턴)** 를 root+/contact+/about 에서(robots 준수, 추측 0).
  - **폭포수**: `enrichHeldLeads` 재작성 — 보류 리드에 [카카오 전화 → 홈페이지 이메일/전화] 순차, 홈페이지 없어도 카카오로 전화 확보 가능(상가정보 보류에 특히 유효). 못 찾으면 비워둠.
  - **출처 태그**: `ad_company_leads.contact_source`(govreg/kakao/homepage/commerce/franchise…) 컬럼 + 저장/보강이 기록 + 어드민 '출처: 카카오/홈페이지…' 표시 → 허위 우려 원천 차단(어디서 왔는지 다 보임). 통신판매='commerce'·공정위='franchise' 태그.
  - tsc 0·sql/theme/file-size 가드 GREEN. 게이트 무관(어드민 보강). ⚠️ 카카오 로컬은 실호출로 검증 필요(이 환경 외부망 제한).
- **2026-07-22 — 나머지 소스 전부 구현 (통신판매·공정위·공고 스캐너, 게이트 OFF).** 대표 "모두 다 소스부터 진행".
  - **🛒 통신판매사업자**(`commerce-notify-collect.ts`, 공정위 1130000) → `ad_company_leads` source='commerce'. **전화·이메일이 데이터에 직접 붙어 옴**(매칭 없음=오매칭 0) → 온라인 겸업 업체 발굴 + 이메일 소스. 게이트 `ADS_COMMERCE_ENABLED`.
  - **🏢 공정위 가맹정보**(`franchise-collect.ts`) → source='franchise'. 프랜차이즈 본사(브랜드·대표전화·가맹점수). 게이트 `ADS_FRANCHISE_ENABLED`.
  - **📢 공고 스캐너**(신규 엔티티 `gov_notices` + `notice-scan.ts`) — 나라장터 입찰(용역) + 기업마당 지원사업, "상권활성화·소상공인·마케팅·창업·상권" 키워드 스캔 → 복합키 UNIQUE(source, notice_no). 어드민 '📢 공고 스캐너'(`/admin/gov-notices`, nav 등록) + 상태머신(신규→응모/전달/수주). 게이트 `ADS_NOTICE_ENABLED`. ur-ads 크론: 통신판매 짝수시·공정위 22시·공고 21시.
  - 파트너 풀에 '🛒 통신판매'·'🏢 프랜차이즈' 수집 버튼 + `/collect-commerce`·`/collect-franchise` 위임. 키 전부 `PUBLIC_DATA_SERVICE_KEY`. ⚠️ 엔드포인트/필드는 표준 기준(placeholder) — 활용가이드/diag.sample로 확정. tsc 0·sql/theme/file-size 가드 GREEN.
- **2026-07-22 — 매장 후보(store_prospects) + 인허가 어댑터 구현 (게이트 OFF).** 대표 스펙 지시("복합키·전일 변동분·pageSize 500·4업종").
  - **신규 엔티티 `store_prospects`**(`store-prospects.ts`) — 파트너 리드(`ad_company_leads`)와 별개. **복합키 UNIQUE(opn_svc_id, opn_sf_team_code, mgt_no)**. 영업상태구분(01영업중=active1 / 02휴업 / 03폐업·04말소=active0) + **신규 개업 감지**(`is_new_open`, apvPermYmd 최근 30일 · todayYmd 주입=비결정 회피). 멱등 upsert(변동분 재수신 시 상태/주소/전화 갱신·active/개업 재계산).
  - **인허가 어댑터**(`localdata-collect.ts`) — 지방행정 인허가 4업종(일반음식점·휴게음식점·미용업·숙박업) × **전일 변동분(lastModTsBgn/End)** × pageSize 500 페이지네이션. 전국 수집 → region은 응답 자치단체코드/주소로 유도. 키 `ADS_LOCALDATA_SERVICE_KEY || PUBLIC_DATA_SERVICE_KEY`(같은 data.go.kr 계정이면 공유). ur-ads **일1회 크론**(hourUTC=20=KST05시, `ADS_LOCALDATA_ENABLED` OFF) + `/__ads/collect-localdata` ← `/api/admin/store-prospects/collect` 위임.
  - **어드민 '🏪 매장 후보'**(`AdminStoreProspectsPage`, `/admin/store-prospects`, nav 등록) — 통계(전체/영업중/신규개업/전화/입점/폐업) · 업종·지역·신규개업·전화·폐업포함 필터 · 인허가 수집 버튼 · 인라인 상태머신(new→입점). 라우트/라우터/nav 등록.
  - **동반: 파트너 풀 체크박스 선택삭제**(대표 요청) — `deleteCompanyLeads`(복수 id, IN 청크 최대 500) + `POST /partner-pool/delete-bulk` + AdminPartnerPoolPage 헤더/행 체크박스·전체선택·'🗑 선택 삭제(n)'·삭제 후 재로드.
  - ⚠️ **엔드포인트/필드명은 LOCALDATA 표준 기준(placeholder 가능)** — 인허가 활용가이드로 확정 예정(상가정보처럼). 방어적 파싱(봉투 2형태) + stats.diag.sample 로 라이브 검증. tsc 0·sql(bind/column/not-null/table)/theme/file-size/pagination/iserror/api-auth 가드 GREEN. 이 환경 프록시가 data.go.kr 차단 → 실검증은 ur-ads 라이브.
- **2026-07-22 — 소스 ① 상가정보 업종코드·명세 확정 (활용가이드 검증).** 대표가 OpenApi 활용가이드.zip 제공(HWP 가이드 + 업종분류표 2302 xlsx). **HWP 로 operation/파라미터/필드 전부 확인**: `storeListInUpjong`·`divId`·`indsSclsCd`/`indsMclsCd`·`bizesNm`·`rdnmAdr`·`lnoAdr`·`indsSclsNm`·`numOfRows`·`pageNo`·`serviceKey` — 어댑터 가정과 100% 일치. **유일 오류 = placeholder 업종코드** → 업종분류표에서 **실제 소분류코드 확정**: 세무사 M10402·회계 M10401·노무 M10307·간판/광고물제작 M11401·광고물설계 M10504·옥외광고 M10502·인테리어 M11201·상가부동산 L10203·경영컨설팅 M10703. `divId` 를 `indsSclsCd`(소분류 정밀) 로 전환. **핵심 발견: 상가정보 업종분류에 도매업 없음**(소매·서비스만) → tier2 주류/식자재 도매는 상가정보 미커버, 네이버 유지 확정. `store-info-collect.ts` STOREINFO_TARGETS 실코드 교체 + 헤더 문서화. tsc 0·sql/file-size 가드 GREEN. ⚠️ 이 환경 프록시가 apis.data.go.kr 차단(조직 정책) → 실호출 검증은 ur-ads 라이브에서(`ADS_STOREINFO_ENABLED=true` + '🏪 상가정보 수집' → diag.sample).
- **2026-07-22 — 소스 ① 상가정보 어댑터 + "연락처 필수" 정책 구현 (게이트 OFF).** 대표 "연락처 필수 + 1번 진행".
  - **연락처 필수(모든 소스 공통)**: `company-discovery.ts` `saveCompanyLeads(…, {requireContact})` — 전화·이메일 없는 리드는 `active=0`(보류, 액션풀 제외). 보강(전화 역조회/이메일 크롤)이 연락처를 채우면 `active=1` 승격(ON CONFLICT + UPDATE 대칭). `hasContact()` SSOT. 스키마 additive: `active`/`business_no`/`last_verified_at` + `idx_company_leads_active`. `listCompanyLeads` 기본 `active=1` 만(→ `includeHeld` 로 보류 검토), `companyStats.held_no_contact`. env `ADS_COMPANY_REQUIRE_CONTACT`(기본 ON). company-collect 저장/이메일보강도 승계.
  - **소스 ① 상가정보**: 신규 `store-info-collect.ts` `runStoreInfoCollect` — data.go.kr B553077 `storeListInUpjong`(업종중분류코드 × 커서 페이지) 통째 조회 → 상호·업종·주소(전화 없음) → `source='storeinfo'` 리드 저장(연락처 없어 active=0 보류) → **연락처 보강**(네이버 `local.json` 전화 역조회 이름근접 매칭 + 홈페이지 이메일 크롤) → active=1 승격. 키 `PUBLIC_DATA_SERVICE_KEY || NTS_API_KEY`(동일 data.go.kr 계정 serviceKey 재활용). ur-ads 크론 **짝수시** 게이트드(`ADS_STOREINFO_ENABLED`, 기본 OFF — company-collect 홀수시와 분리) + `/__ads/collect-storeinfo` ← `/api/admin/partner-pool/collect-storeinfo` 위임 + 어드민 '🏪 상가정보 수집' 버튼·상태·'연락처 보류' 통계/필터.
  - **⚠️ 활용신청 후 검증 필요**: `STOREINFO_TARGETS` 업종중분류코드(indsMclsCd)·응답 필드명은 **문서 기준 placeholder** — 첫 실전 조회의 `stats.diag.sample`(원응답 첫 항목)로 실제 필드/코드 확인 후 교정. 방어적 파싱(봉투 3형태·필드 폴백)이라 크래시는 안 나되 매핑은 실응답으로 확정. tsc 0·sql(bind/column/not-null/table)/theme/file-size/pagination 가드 GREEN.
  - **미구현(후속)**: 4루프 ③갱신(재조회 diff)·④정리(폐업 — storeinfo 는 재조회 diff, business_no 보유분은 NTS 상태조회) · 소스 ②공정위 · ③통신판매 · 업종코드↔subcategory 매핑 SSOT 확정.
- **2026-07-21 — 레인 A(네이버 지역검색 자동수집) 구현.** `company-collect.ts` — `ad_company_keywords` 풀(방배/서초/강남 × 12업종 + 대행사 5 시드) + `runCompanyAutoCollect`(커서 순환·`FetchBudget` 60·네이버 `local.json` display 5 → 전화·주소·홈페이지·카테고리 파싱 → `saveCompanyLeads`). ur-ads 크론 **홀수시** 게이트드(`ADS_COMPANY_COLLECT_ENABLED`, 기본 OFF — 인플루언서 매시간 유지, 반토막 방지) + 내부 트리거 `/__ads/collect-company` ← 메인 `/api/admin/partner-pool/collect` 위임(서비스바인딩) + 어드민 '지금 수집' 버튼·게이트/최근실행 상태·키워드 관리 API. **phone-first**(지역검색 전화로 수용기준 40% 충족) — 이메일 크롤(robots.txt fetcher, 결정 대기)·웹문서 보충은 후속. tsc 0·sql/theme/file-size/pagination 가드 GREEN. **⚠️ 활성 전**: `NAVER_SEARCH_CLIENT_ID/SECRET` + `ADS_COMPANY_COLLECT_ENABLED=true` → '지금 수집' 표본 검증(전화 확보율).
- **2026-07-21 — 1단계(테이블·어드민·수동입력) 구현.** `ad_company_leads` 격리 테이블(`company-discovery.ts` 런타임 스키마, `UNIQUE(company_key)` = website 우선/회사명|지역 폴백, 빈컨택만 백필) + `/api/admin/partner-pool/*`(`partner-pool.routes.ts`, requireAdmin, 메인 워커 마운트 — 프록시 비위임) + `/admin/partner-pool` 페이지(`AdminPartnerPoolPage.tsx`, 라이트 테마, 통계·필터·수동추가·인라인 상태머신/tier/채널/팔로업/메모·CSV). 대표가 방배 리드 손입력 가능. **레인 A(네이버 지역검색)·B(레지스트리)·C 수집엔진은 후속.** tsc 0·sql/theme/csv/pagination/file-size 가드 GREEN.
