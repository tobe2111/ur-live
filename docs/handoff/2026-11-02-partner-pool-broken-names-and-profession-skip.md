# 파트너 풀 — 깨진 상호 수리 + 전문직 재분류 구멍 (2026-11-02)

서비스: **유어애즈 · B2B 파트너 풀**(`/admin/partner-pool`, `ad_company_leads`). 머니 경로 없음.

## 대표 요청
*"B2B 파트너 필터링 잘 되고 있어?"* → *"(다)부터 하고, 법무사·회계사·세무사 같은 디테일한 업종, 유어딜 생활 카테고리(이사·청소)도 필터링 잘 되고 있어?"*

## 한 것
1. **깨진 상호(`�`) 222행** — 원인 둘
   - 보강 크롤(`contact-enrich.ts`)이 `res.text()`(무조건 UTF-8)로 EUC-KR 사이트를 읽어 `<title>` 이 뭉개졌고 이름 치유가 그걸 상호로 저장.
   - 네이버 웹검색이 EUC-KR 사이트 제목을 이미 뭉갠 채 돌려줌(`webkr-search.ts`, 수집 즉시 깨진 행).
   - 처방: `html-decode.ts`(선언 문자셋대로 디코딩 + `hasBrokenText` 거름망) · 두 입구 거름 · `enrich-name-heal.ts` 의 `repairBrokenNames` 가 회차당 8행씩 기존 행을 실명(또는 도메인)으로 수리.
2. **전문직 재분류가 벌크 전진에 건너뛰어짐** — `reclassify-registry-fastpath.ts` 가 표본 150행(대부분 통신판매)에서 변화 0 이면 5,000행씩 도장만 찍었다. 소수 규칙(상호의 자격명 · 중복 라벨)을 탈 행이 분류기를 안 거치고 v10 도장을 받음 → `정민법무사사무소` 가 `세무사`, `세무·기장` 4,162행이 그대로.
   - 처방: 벌크 조건에서 규칙이 바꿀 수 있는 행(자격명 낱말 · `CANON_SUBCATEGORY` 키)을 제외(`refinableExclusionSql`) + `CLASSIFY_RULES_VERSION` 10→11.
- 가드: `src/tests/unit/company-broken-name-2026-11-02.test.ts` (진짜 SQLite · 주입 3건 빨간불 확인).

## 이어받는 세션의 첫 액션 (대표가 이어서 하라고 했을 때만)
D1 `ad_company_leads`(DB `0e9a8f82…`) 에서:
- `SELECT COUNT(*) FROM ad_company_leads WHERE merged_into IS NULL AND instr(company_name, char(65533))>0` → 0 을 향해 줄어야 한다(회차당 최대 8).
- `SELECT subcategory, COUNT(*) FROM ad_company_leads WHERE merged_into IS NULL AND subcategory IN ('세무·기장','노무','회계','법률') GROUP BY 1` → 재분류 한 바퀴(수일) 뒤 0.
- 상태줄 `enrichRollup.p2` 의 `broken_renamed` / `broken_to_host` 비율 = Workers 가 `euc-kr` 디코더를 주는지의 판정(renamed 가 0 이고 to_host 만 늘면 미지원).

## 틀렸던 판단
- 처음엔 깨진 상호를 크롤러 하나의 문제로 봤는데, `name_verified` 가 비어 있는 채 수집 즉시 깨진 행이 있어 네이버 제목도 원인이었다.
- 재분류 코드는 맞았다. 틀린 건 *표본으로 건너뛰는 최적화*였다 — 표본은 평균 행을 대표해도 소수 규칙은 대표 못 한다.

## 남은 것 (대표 판단)
- **유어딜 생활 카테고리(이사·청소·방역·수리) 업체는 파트너 풀의 분류 축 자체에 없다.** 상호에 '이사'·'청소' 가 든 행이 250·225건뿐이고 대부분 `통신판매`·`대행사` 같은 엉뚱한 칸에 있다. 이걸 수집·분류 대상으로 넣을지(키워드 그리드 + 분류 규칙 신설)는 방향 결정이다.
- **법무사 거의 미수집**(35건). 등록부 코드가 세무사와 섞여 있고 키워드 그리드에 법무사가 없다.
