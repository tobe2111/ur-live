# 2026-09-02 — 유어애즈 D1 읽기 다이어트 (PR-D)

> 감사표·계획: `docs/handoff/2026-09-02-d1-read-diet.md`(PR #1299) §3. 대표 우선순위: **유어딜이 먼저**, 유어애즈는 문제가 있어도 됨.
> 그래서 이 PR 은 §3 의 **싼 것·확실한 것**만 담는다. 큰 것(merge pool 집계 4개 · sheets OFFSET keyset)은 남겼다.

| 감사 § | 수리 | 절감(추정/일) | 롤백 |
|---|---|---|---|
| 3 #1 | `recomputeKeywordContactYield` **6h 버킷 게이트**(`platform_settings` 스탬프) — 92회/일 → 4회/일 | ~1,350만 | 게이트 `if` 제거 |
| 3 결함 | `inflow-watchdog.readSendableTotals` 교차 DB 한 문장 → 테이블당 한 문장. **`sendable_*` 두 축이 조용히 빠져 있던 라이브 결함 수리** | (관측 복구) | — |
| 3 #5 | `cleanSelfLinkNoise` — `links IS NOT NULL` 명시 + 부분 인덱스 `idx_ad_inf_leads_selflink(account_id,id) WHERE platform='naver_blog' AND links IS NOT NULL` + 꼬리 조기 종료 | ~300만 | 인덱스 DROP |
| 3 #8 | 리마인드/온보딩 0건 모양 전수 → 부분 인덱스 `idx_ad_inf_leads_remind_todo` / `idx_ad_inf_leads_onboard_todo`(ALTER 직후 생성) | ~180만 | DROP |
| 3 #11 | `idx_ad_inf_leads_collected_at` (업체 쪽 쌍둥이) | ~50만 | DROP |

**남긴 것**: §3 #2·#3(merge pool — 23회/일 집계 4개, 표현식 인덱스 필요) · #4(sheets OFFSET → keyset, 커서 구조 변경) · #6·#7·#9·#10.

**판정**: 배포 후 `cron_hb:ads:maintenance` 의 `rr`(PR #1299) — reclassify 슬롯이 버킷 안에서는 `kwyield={skipped:'bucket'}` 로 찍히고,
유입 감시 `sendable_*` 축이 다시 값을 갖는지(`ads_inflow_*` 판정).

**되돌려-검증**: 주입 2건(게이트 제거 · 교차 문장 복원) red 확인. 플래너 실증은 `node:sqlite` 하네스(`urads-d1-diet.test.ts`).
