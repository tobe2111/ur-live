# YT 우선 배분 + 중복 발송 제거 (2026-08-04, 대표 승인 "2,3 진행")

## 다음 세션의 첫 액션

**배포 24시간 뒤** 아래 두 개를 재측정한다. 둘 다 *같은 날 코호트끼리* 비교해야 한다 —
누적 수율은 크림스키밍 때문에 남은 큐에 안 맞는다(이번에 그걸로 오판할 뻔했다).

```sql
-- ① 배분이 실제로 바뀌었나 (YT 행 수가 회차당 14 → 20 근처로)
--    어드민 stats 의 enrich_lane: { yt, naver:{measured}, led, spent, budget_total }
-- ② 우위가 아직 살아 있나 (같은 날 측정분끼리)
SELECT platform, substr(perf_checked_at,1,10) d, COUNT(*) n,
       SUM(CASE WHEN email IS NOT NULL AND email<>'' THEN 1 ELSE 0 END) e
  FROM ad_influencer_leads
 WHERE account_id=0 AND perf_checked_at IS NOT NULL AND platform IN ('youtube','naver_blog')
 GROUP BY platform, d ORDER BY d DESC LIMIT 4
```

**판정선**: `youtube` 의 `e/n` 이 `naver_blog` 의 **2배 아래로** 내려오면 배분을 되돌린다
(YT 는 1 fetch/행, 블로거는 2 라 *2배*가 손익분기다). `planInfluencerEnrich` docblock 에 같은 조건을 적어 뒀다.
⚠️ **`led`(선두)도 같이 볼 것** — `led: 'naver'` 회차의 `yt` 가 0 이면 예약분이 안 먹은 것이다.

## 이번에 한 것

| | 무엇 | 파일 |
|---|---|---|
| ② | YT 몫 0.35 → **0.55** | `influencer-enrich-plan.ts`(신규 — 레인에서 순수 정책 분리) |
| ② | 블로거 선두 회차에 **YT 예약분** | 같은 파일 `naverRoomWithYtReserve` + 레인 배선 |
| ③ | 발송 큐 **중복 주소 제거** | `outreach-queue.ts` `dedupeByEmail`·`fetchSendQueuePage` |
| ③ | 연락 대상 내보내기도 같은 규칙 | `influencer-pool-export.ts` (전체 내보내기는 **제외**) |

**근거(라이브 실측 2026-08-04)**
- 플랫폼별 미측정: 블로거 20,357 · **YT 2,463** · 카페 3,141(이메일 0) · 티스토리 204
- **같은 날 측정 코호트 수율**: YT 26.7%(1,105→295) · 블로거 21.2%(2,580→547)
  → 서브리퀘스트당 **0.267 vs 0.106 = 2.5배**
- 중복 발송 대상: **130그룹 / 262행 → 132통이 두 번째**
- 회차 스냅샷: `yt 14`(= 옛 상한에 정확히 걸림) · `yt_units 718/7000`(**유튜브 쿼터는 병목이 아니다**)

**검증**: tsc 0 · 신규 유닛 21 pass · 주입 4건 전부 빨간불 · file-size GREEN(두 파일 다 추출로 해결)

## 이번에 틀렸던 판단 — **3건 다 "숫자를 잘못 읽었다"**

1. **누적 수율(39% vs 26%)로 판단할 뻔했다.** 그건 *좋은 채널부터 훑어 온* 결과라 남은 큐에 안 맞는다.
   일별로 쪼개 보니 YT 수율이 **43.8% → 34.7% → 26.7%** 로 하락 중이었다. 같은 날끼리 비교해서야
   진짜 값(2.5배)이 나왔다. ⇒ **"평균"을 보면 거의 항상 크림스키밍에 속는다.**
2. **`ytMax` 만 올리면 되는 줄 알았다.** `naverRoomFromRemaining` 이 `max(planned, affordable)` 이라
   **블로거가 선두인 회차에는 예산 전체를 가져간다** — 그 회차 YT 는 0행이다. 즉 상한만 올리면
   **회차의 절반에서 아무 효과가 없었다.** 예약분(`naverRoomWithYtReserve`)이 진짜 처방이다.
3. **주입 검증에서 내 가드 2개가 헛돌았다.** ⓐ `ytMax > naverMax` 는 옛 비율(14>10)에서도 참이라
   비율을 되돌려도 초록이었다 — 정책의 실체는 행이 아니라 **예산**(`ytMax > naverMax*2`)이다.
   ⓑ 예약분은 순수 함수만 테스트해서 **레인이 그걸 부르는지**를 아무도 안 봤다. 둘 다 배선/의미로 고쳐 재확인.

## 안 한 것 (보고만)

- **카테고리 없는 발송가능 리드 229건** — 조사해 보니 **버그가 아니다**. 연락 대상 내보내기는 이들을
  *제외하지 않고* 뒤로 정렬만 한다(`ORDER BY coreFirst, category`). 문안도 카테고리 없이 생성된다.
  전체 7,868 중 2.9% 라 코드를 넣을 값이 아니라고 판단했다 — 필요하면 정비 레인의 재분류로.
- **카페 3,141행** — 측정 0 · 이메일 0. 헤드라인 "총 51,235" 를 부풀리는 항목이라 지표에서 뺄지는 대표 판단.
