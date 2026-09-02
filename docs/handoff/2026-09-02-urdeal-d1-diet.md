# 2026-09-02 — 유어딜 D1 읽기 다이어트 (PR-B)

> 감사 랭킹표·전체 계획·다음 세션 첫 액션은 **`docs/handoff/2026-09-02-d1-read-diet.md`**(PR #1299 브랜치에 있음).
> 이 파일은 그중 유어딜 cron 수리분(PR-B)만 적는다 — 두 PR 이 같은 인계 파일을 다투지 않게 따로 뒀다.

## 무엇을 고쳤나 (`claude/urdeal-d1-diet`)
| 감사 # | 수리 | 롤백 |
|---|---|---|
| 2-1 #1 | `cache-prewarm` 동적 워밍(셀러/상품/큐레이터 12) :00/:30 · products 정규화 UPDATE 19:35 UTC 하루 1회. **HOT_PATHS 불변** | 호출부 옵션 제거 |
| 2-1 #2 | `group-buy-feed-cache` **지문 게이트**(활성 이용권 행만 읽어 카드 값 지문 → 같으면 `computed_at` touch, 다르거나 60분 경과면 전체) + `(status=? OR ?='all')` OR 분리 | `FEED_FP_KEY` 블록 제거 |
| 2-1 #3 | `scheduled-cleanup` 3티어 — 매 틱: 3·6·14 / 매시 :10 / 매일 04:20 KST: GC(8·9·9b·15~19·22·탈퇴·23). GC 13개는 `scheduled-cleanup-daily.ts` 로 분리(래칫 1127>1041 이 막아서 — 본문 byte-동일) | 호출부 `{hourly:true,daily:true}` |
| 2-1 #4 | `SELECT DISTINCT id FROM users` DISTINCT 제거 | — |
| 2-1 #10 | `prospects-commission-activate` 매시 :40 | 게이트 제거 |
| 2-1 #11 | 백업 `*/5` 슬롯 **중복 배선 제거**(08-25 전용 트리거 `2,17,32,47` 만) — 시간당 8→4회 | 블록 복원(+테스트) |
| 2-1 #15 | 하트비트 리더 `LIKE 'cron_hb:%'` → PK 범위 | — |
| 2-1 #16 | 알림톡 COUNT → `SELECT 1 … LIMIT 1` + `idx_alimtalk_failures_retry` | — |

가드: `d1-read-diet.test.ts` 14건 · `backup-cadence.test.ts` 전용 트리거 형태로 · `cron-slot-gate.test.ts` 가 `slotOpen({…})` 도 격자 검사 · 주입 3건.

## 배포 후 판정 (09:00 KST 리셋 창)
`/api/admin/cron-heartbeats` 의 `rows_read`(PR #1299) 로 `scheduled-cleanup`·`group-buy-feed-cache`·`cache-prewarm` 의 틱당 값이
전보다 줄었는지. 피드 캐시는 `r` 에 `unchanged=true touched=20` 이 대부분의 틱에 찍혀야 한다.

## 틀렸던/조심한 판단
- 청소 33개를 "전부 GC" 로 보고 하루 1회로 밀 뻔했다 — 3(공구 마감)·6(타임딜)·14(달성 알림)은 **구매 가능 여부**를 분 단위로
  바꾼다. 티어를 셋으로 나눈 이유.
- `first()` 를 세는 계량기 한계 때문에 이 PR 의 효과 일부(COUNT→LIMIT 1)는 `qu` 로만 보인다.
