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

## 3. 생활 업종 + 전문직 수집 (대표 *"응 모아줘. 필요해. 전문직종과 생활 카테고리 모두 각자 넣어줘야지. 가장 이상적으로"*)
- **카테고리 4개 신설**: `이사` · `청소` · `방역·소독` · `수리·설치` — 이름을 유어딜 생활 칩(`src/shared/life-deal-subcat.ts`)과 **똑같이**(시험 대조). 간판은 이미 있었다.
  `전문서비스` 세부도 국가자격 11종으로 정리(옛 '법률·세무·기장·회계·노무' 제거 — 어드민 필터 목록이 옛 라벨을 보여 주고 있었다).
- **분류 규칙 12개**(`company-classify.ts` BIZ_RULES, 인테리어보다 앞). 함정: `이사청소`→청소 · `방수시공`→수리 · `주방설비`는 그대로 · `청소년`/`드라이클리닝`/`대표이사`/`스타일` 오탐 차단. `CLASSIFY_RULES_VERSION` 12.
- **검색어 5단계**(`company-keyword-grid.ts`, 배열 끝 — 시드 이어받기 유지, `KEYWORD_SEED_VERSION` 6):
  생활 5종 × 235지역(포장이사·입주청소·에어컨 청소·방역 소독·누수 설비) · 법무사·변호사 사무소·행정사 × 235 · 변리사·감정평가사·관세사·손해사정사 × 62(서울·광역시·경기). 약 2,130개.
  세무사·회계사·노무사는 상가정보 업종코드가 통째로 받으므로 넣지 않았다.
- 가드: `company-life-profession-2026-11-02.test.ts` + 주입 4건(`scripts/mutations/company-life-profession-2026-11-02.mjs`) 전부 빨간불 확인.
- 판정(배포 후 며칠): `SELECT category, COUNT(*), SUM(active=1) FROM ad_company_leads WHERE category IN ('이사','청소','방역·소독','수리·설치') GROUP BY 1` 이 늘어나는가 · `ad_company_keywords` 에서 5단계 키워드 `saved_total`.
- ⚠️ **못 한 것**: 상가정보(정부 업종코드) 통째 수집에 생활·법무사 코드를 넣는 일. 코드표(2302)가 레포에 9개분만 있고 이 환경에서 `apis.data.go.kr` 이 막혀 코드를 확인할 수 없다 — 틀린 코드는 엉뚱한 업종을 대량으로 넣으므로 추측으로 넣지 않았다. 대표가 업종분류표를 다시 주면 `STOREINFO_TARGETS` 에 한 줄씩 추가하면 된다.

## 4. 개선 묶음 (대표 *"개선할 것들 최대한 알아봐"* → *"2번 빼고 일단 다 해줘"*)
라이브 실측으로 찾은 10개 중 ②(남의/가짜 연락처 공유 — 이메일 2,988행·전화 2,756행)는 **대표가 빼라고 했다. 손대지 않았다.**
- ① **보강 레인 헛돌기**: `enrich-lane.ts` 대상 WHERE 에서 `active = 0 OR` 제거. 이메일 있는 보류 행 11,691건이 도장 없이 매 회차 큐 머리에 섰다(하루 examined 50,339 중 skip_email 50,131 · enriched 102). 짝 인덱스는 정렬 키라 무변경.
- ③ **빈 페이지 제목·도어웨이**: `company-classify.ts` `PLACEHOLDER_TITLE`·`DOORWAY_WORD`(webkr 한정). 재분류는 이 사유면 **DELETE 대신 보류**(`HOLD_NOT_DELETE_REASONS`).
- ④ **카카오 전화 스윕** 시간당 1→3(`lane-alarm-runners.ts`, `MAX_BOOST_RUNS_PER_HOUR` 와 같은 안전선). commerce 를 스윕에서 빼는 것은 안 했다 — 그 파일이 "증거로 가중" 원칙을 적어 둠(오늘 증거 18조회 0건뿐).
- ⑤ **포화 키워드 휴식**: `company-keyword-rest.ts` — 찾은 게 40건+ 인데 신규 0 → `active=2`, 60일 뒤 복귀, 수동 키워드 제외. 어드민 칩에 💤 표시.
- ⑥ **프랜차이즈 저장 0**: 로컬 SQLite 로 같은 리드를 같은 저장 함수에 넣으면 정상 저장된다 → 라이브 전용 실패. 원인은 못 찾았고, **저장 예외 원문을 `diag.save_error` 에 남기게** 했다(백오프에 영향 안 주게 `error` 와 분리).
- ⑦ **국세청 폐업 조회**: 회차당 100건 × 10묶음(상한 20, env `ADS_NTS_BATCHES`). 조회 실패 묶음에서 커서 정지(예전엔 실패해도 넘어가 그 행이 빠졌다).
- ⑧ **등록부 대조 0건은 결함이 아니었다** — 스킵 사유 대부분이 `no_registry_row`(지도 업체가 통신판매 신고를 안 한 것). 국민연금은 그쪽 503. 코드 변경 없음.
- ⑨ **중국 무료메일 온라인판매 보류**: `company-lead-hygiene.ts` 🌏 + 백로그 스윕 세대 2(`company-hygiene-sweep.ts`, 테이블 한 번 더 훑음).
- 가드: `partner-pool-improvements-2026-11-02.test.ts` + 주입 7건 전부 빨간불.
- 판정(배포 후): 보강 스냅샷 `p2.skip_email` 이 0 근처 · `enriched` 증가 / 카카오 `day_lookups` ~3배 / 키워드 화면 '포화 휴식' 수(칩에 '(휴식)') / 국세청 `checked` 1,000 근처 / 프랜차이즈 `diag.save_error` 원문.

## 남은 것 (대표 판단)
- (해결됨 → 위 3) 생활 업종·법무사 미수집.
- 상가정보 업종분류표(2302 xlsx) 재제공 여부 — 받으면 생활·법무사도 통째 수집으로 넓힌다.
- ② 남의/가짜 연락처 공유 정리 — 대표가 이번엔 빼라고 함.
- ⑥ 프랜차이즈 — 배포 후 `diag.save_error` 원문을 보고 다시 판단.

## 5. 배포 후 라이브 판정 (2026-11-17) + 프랜차이즈 진단 재수리
| 항목 | 전 (11-02) | 지금 (11-17) |
|---|---|---|
| 깨진 상호 | 222 | **38** |
| 옛 중복 라벨(세무·기장·회계·노무·법률) | 4,763 | **400** (재분류 v12 거의 완주) |
| 이사 / 청소 / 방역·소독 / 수리·설치 | 거의 0 | **3,443 / 3,232 / 1,251 / 1,688** |
| 법무사 / 변호사 | 35 / 73 | **3,515 / 3,724** |
| 보강 `skip_email` | 하루 50,131 | **0**(키 없음) |
| 카카오 전화 조회 | 하루 1,092 | 오늘 오전까지 1,809 |
| 국세청 폐업 조회 | 100/일 · 누적 폐업 515 | **1,000/일** · 누적 **1,503** |
| 포화 휴식 키워드 | — | 152 |
| 중국 무료메일 활성(온라인판매) | 2,489 | 693(스윕 진행 중) |

- ❌ **프랜차이즈는 여전히 0** — 그리고 `diag.save_error` 도 비어 있었다. 원인: 저장 함수(`company-save.ts`) **안**의 `DB.batch(...).catch(() => null)` 이 먼저 삼켜 예외가 레인까지 안 왔다(11-02 진단이 헛돈 이유). 이번에 저장 함수가 직접 `error`(묶음 실패 원문 / `ALL_REJECTED {사유:건수}`)를 돌려주게 했다. 가드 `company-save-error-surface-2026-11-17.test.ts` + 주입 2.
- 판정: 배포 후 `GET /api/admin/partner-pool/stats` → `franchise.run.diag.save_error` 원문.
- 통신판매(온라인판매) 543,000곳 중 518,594곳(95%)은 아직 세부 업종 없이 `통신판매` — detail 수집이 돌수록 줄어든다(종합몰 11-02 2,623 → 7,543).

## 6. ② 남의·가짜 연락처 정리 + 숨은 고장 2건 (2026-11-17 대표 *"다 해줘. 더 개선할 건?"*)
라이브 실측(조회만):
- **가짜 연락처** — 판정 `company-contact-quality.ts`. 전화 461행(`N/A` 213 · `010-0000-0000` 91 · `010-1234-5678` 52 · `010-개인정보` 25…) ·
  이메일 66행(`gmail.com@gmail.com` 21 · `email@naver.com` 12 · `111@111.com` 10…). 그중 연락처가 하나도 안 남아 보류로 내려갈 활성 행 157.
  입구(`company-save`·보강 저장)에서도 버린다. 백로그는 위생 스윕 v3(id 창 5만 · 약 하루).
- **남의 연락처** = 같은 연락처가 **업종 3개 이상**에 걸림(행 5+). 이메일 16개(`hosting@gabia.com` 92행 · `support@dable.io` · `ad@daangn.com`…) ·
  전화 25개(`052-5525-5255` 101행 · `031-709-8111` 48행…). 같은 브랜드 지점 묶음(업종 1~2개 — `그린프로청소`·`새집느낌`·`풍연1~9지점`)은 **안 건드린다.**
  주 1회 정리(`sweepSharedContacts`, 재분류 레인 하트비트 `shared=`): 이메일은 `ad_email_suppress`(사유 `shared_vendor`) → 보강·등록부·발송이 모두 거른다 ·
  전화는 `ads_shared_phone_block` 설정 → 보강 저장이 거른다. 등록부 출처(commerce·govreg·registry) 전화는 남긴다.
- 🩸 **숨은 고장 ① — DB 를 섞은 SQL 2건.** 업체 리드가 `ADS_COMPANY_DB` 로 이사(08-23)한 뒤 `ad_email_suppress` 는 리드 DB 에만 있다.
  `registry-email-match` 의 UPDATE 와 `sweepSuppressedEmails` 의 업체 쪽 UPDATE 가 그 표를 서브쿼리로 불러 **업체 DB 에서 `no such table`** 로 죽었다
  (등록부 대조는 매칭이 0 인 날이 많아 안 보였을 뿐, 하나라도 맞으면 묶음 전체가 실패). 둘 다 "목록을 먼저 읽고 업체 표만 만진다"로 고침 + 가드(④).
- 🩸 **숨은 고장 ② — 보류가 되살아난다.** `active = 0` 이 *연락처 없음* 과 *규칙이 뺌*(중국 메일·도어웨이)을 겸해서, 수집·보강 7경로가 연락처를 보면 1 로 올렸다.
  중국 메일 활성 693(오전) → 728(오후) · v12 도장인데 활성인 도어웨이 18. ⇒ `hold_reason` 칸을 이번 PR 에서 **만들기만** 한다.
  컬럼 가드는 라이브에 실제로 있는 칸만 믿으므로(`live-schema.snapshot.json`), **쓰는 코드는 다음 PR**.
- 가드 `company-contact-quality-2026-11-17.test.ts`(진짜 SQLite) + 주입 5건 전부 빨간불.

### 이어받는 세션의 첫 액션 (대표가 이어서 하라고 했을 때만)
1. 배포 후 업체 DB(`0e9a8f82…`)에 `SELECT COUNT(*) FROM pragma_table_info('ad_company_leads') WHERE name='hold_reason'` → 1 이면
   `node scripts/snapshot-live-schema.mjs` 로 사진을 다시 찍고, 보류 고정 PR(재활성 7경로 `WHEN hold_reason IS NOT NULL THEN active` ·
   중국 메일/도어웨이 보류에 사유 기록 · 위생 스윕 v4 · 재활성 SQL 전수 가드)을 올린다.
2. 재분류 하트비트 `shared=e16/… p25/…` 가 찍혔는지 · 위생 스윕 `hyg=` 가 v3 로 다시 돌기 시작했는지.

### 틀렸던 판단
- 처음 "남의 연락처 2,988행"으로 셌는데, 대부분은 **같은 브랜드 지점들**이었다(업종 1개). 진짜 남의 것은 업종이 흩어진 것뿐이다.
- `contact_source NOT IN (…)` 은 NULL 행(54만)을 통째로 뺀다 — 첫 집계가 13개만 나온 이유. `COALESCE` 필요.
- 가짜 판정 첫 판은 `02-928-6446(팩스)`(글자 섞임)와 `lawus@lawus.co.kr`(아이디=도메인)를 잡았다 — 라이브 후보에 돌려 보고 좁혔다.

## 7. 이메일 보강 순서 + 정리 결과 화면 (2026-11-17 대표 *"다 이상적으로 해줘"*) — PR #2389 머지 `ba04aff` 뒤
- **보강 순서**: 생활·전문직(`ENRICH_PRIORITY_CATEGORIES` — 이사·청소·방역·소독·수리·설치·전문서비스)과 일반 줄을 **번갈아** 세운다.
  회차가 마감선 때문에 앞의 10건 남짓만 처리하므로(라운드 64회 전부 deadline) 순서가 곧 배분이다. 처리량은 그대로.
  🩸 첫 판은 일반 쿼리에 `category IN` 을 붙였는데 라이브에서 **회당 69,563행**(하루 445만)을 읽었다 — 정렬 인덱스를 못 탄다.
  그래서 업종마다 `(category, id)` 인덱스를 커서(`ads_enrich_prio_cursor`)로 내려가는 별 쿼리로 바꿨다 — 실측 **회당 28행**. `enrich-priority.ts`.
  판정(며칠 뒤): `SELECT category, SUM(email IS NOT NULL AND email!='') FROM ad_company_leads WHERE category IN (…) GROUP BY 1` 이 184·208·879 에서 늘었는가.
- **화면**: `/admin/partner-pool` 운영 상태줄에 "연락처 정리" 한 줄(남의 연락처 주간 결과 · 위생 스윕 진척). 값은 `/stats` 의 `contactQuality`.
