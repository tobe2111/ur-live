# 측정 4배 장치가 이사 중 유실됐다 — 샤딩으로 되살림(2배부터)

**2026-08-09 · 유어애즈 측정(보강) 처리량** · 대표 지시 *"키워드 활성화가 수확을 더 늘리는지 확인 먼저"* → *"2배로 켜줘"*

## 1. 먼저 답한 질문 — 키워드 활성화는 지금 답이 아니다

대표가 물은 것: 활성 키워드(7,980 중 399)를 늘리면 수확이 느는가.

```
활성    399개 → 실행된 키워드당 157.6명
비활성 9,015개 → 실행된 키워드당  49.7명    ← 3분의 1
```
활성화 확대 = **수율 3배 낮은 키워드를 섞는 것**. 게다가 이미 유입이 처리 능력을 넘었다:

| 날짜 | 유입 | 측정 | 차이 |
|---|---|---|---|
| 08-04 | 4,730 | 5,800 | +1,070 |
| 08-05 | 5,342 | 5,342 | 0 |
| 08-06 | 5,582 | 4,156 | −1,426 |
| 08-07 | 5,945 | 4,197 | −1,748 |
| 08-08 | 6,256 | 4,245 | **−2,011** |

```
측정됨 42,868 → 이메일 11,335 (26.4%)
미측정 31,037 → 이메일    163 ( 0.5%)   ← 53배
```
⇒ 행을 더 만들어도 **0.5%짜리로 쌓일 뿐**이다. 병목은 수집이 아니라 **측정**이고,
백로그 31,037명 안에 잠든 이메일이 **약 8,200명**(현재 보유 11,335의 70%)이다.

## 2. 진짜 원인 — 4배 팬아웃이 이사 중 유실됐다

```
enrich-influencer-driver   152시간(6.3일) 정지
enrich-influencer-fanout   152시간, ok=false
```
`index.ts` 의 드라이버 kick 은 **`if (!laneAlarmOn)` 게이트 뒤**에 있다. 2026-08-02 알람 전환 후
**cron 은 "알람이 하겠지" 하고 손을 뗐는데 알람 등록부엔 그 레인이 없었다.** 양쪽이 서로를
믿어 아무도 안 하게 된 상태. `lane-alarm-boot.ts` 헤더가 예고한 그대로다 —
*"cron 킥은 게이트로 꺼져 있어 이 레인이 통째로 사라진다."*

**한 회차는 이미 꽉 찼다**: `spent=44 / budget_total=45`, 처리 20행 · 알람 12회/시간
= 하루 ~4,200(관측값과 일치). ⇒ 인보케이션당 서브리퀘스트가 천장이라 **갈래를 늘리는 것**만이 길이다.

## 3. 수리 — 알람 레인을 샤드로 생성

| 항목 | 파일 |
|---|---|
| `ENRICH_SHARDS = 2` + `enrichShardLanes()` 생성식 | `worker-ads/lane-alarm-runners.ts` |
| `opts.naverOnly` — 앞 레인(bio+YT) 건너뜀 | `features/marketing/api/influencer-enrich-lane.ts` |

- 샤드 0 = `enrich-influencer`(**이름 불변** — DO 인스턴스가 이름으로 갈린다), 앞 레인 담당
- 샤드 1+ = 네이버 전용. **왜**: `enrichYouTubePerformance` 는 `slice` 를 안 받아 샤드마다 통째로
  반복되는데 **YT 쿼터는 이미 초과**이고 백로그의 98%가 네이버다(`youtube` 667명뿐)
- 손으로 나열하지 않고 **생성**한다 — 레인 수와 `slice.k` 가 어긋나면 중복/누락이 조용히 생긴다
- 🔙 **롤백 = `ENRICH_SHARDS` 를 1 로** (`sliceClause` 가 조건을 안 붙여 이전과 완전히 동일.
  남는 DO 인스턴스는 `lookupAlarmLane` 이 null 을 줘 조용히 멎는다)

## 4. 검증

유닛 **5,240 pass**(신규 8) · tsc 0 · build 0 · **audit-gate ALL GREEN 88** · guard-mutations 223 전부 빨간불 확인

되돌려-검증 3건 — slice 미전달 / `naverOnly:false` / 분기가 앞 레인도 돎. 셋 다 해당 가드만 빨간불.

🩸 **주입 실험이 내 테스트의 구멍을 잡았다**: `sliceClause` 순수함수만 검증했더니 **러너가 slice 를
안 넘겨도 초록**이었다(= 두 샤드가 같은 사람을 중복 측정하는데 통과). 배선 검사를 추가해 red 확인.

기존 가드 2개가 내 변경을 잡았다(설계대로) — 둘 다 **소스 문자열 형태**를 고정하고 있었다.
지키려는 사실(등록돼 있는가 · `driver:'alarm'` 이 실리는가)로 바꿨다. 하나는 런타임 검사로 승격.

## 5. 다음 세션의 첫 액션 — 하루 뒤 판정

```sql
SELECT key,value FROM platform_settings WHERE key='ads_naver_crawl_block';   -- ⚠️ 먼저
SELECT (SELECT COUNT(*) FROM ad_influencer_leads WHERE perf_checked_at > datetime('now','-24 hours')) 측정_24h,
       (SELECT COUNT(*) FROM ad_influencer_leads WHERE collected_at   > datetime('now','-24 hours')) 유입_24h,
       (SELECT COUNT(*) FROM ad_influencer_leads WHERE perf_checked_at IS NULL) 백로그;
SELECT key,value FROM platform_settings WHERE key LIKE 'cron_hb:ads:lane-alarm-boot:enrich%';
```
1. **`blocked` 가 0 인가** ← 이게 첫 관문. 0 이 아니면 **즉시 `ENRICH_SHARDS` 를 1 로 되돌린다**
   (차단당하면 측정이 통째로 멎어 얻는 것보다 잃는 게 크다)
2. 측정이 ~4,200 → ~8,000 으로 올랐는가. 안 올랐으면 `lane-alarm-boot:enrich-influencer-2`
   하트비트가 있는지 확인(없으면 부트스트랩이 새 인스턴스를 못 세운 것)
3. 백로그가 **감소로 돌아섰는가**(유입 6,000 < 측정)
4. 1~3 이 다 좋으면 **`ENRICH_SHARDS` 4 로** — 같은 절차로 하루 더 관측

## 6. 아직 모르는 것 / 안 한 것

- **YT 에 `slice` 를 배선하면** `naverOnly` 스위치가 필요 없어진다(그땐 YT 도 갈라져 총 호출량 불변).
  지금은 안 했다 — 쿼터가 초과라 YT 처리량을 늘릴 이유가 없었다.
- 팬아웃이 2026-08-02 에 죽은 이유(*"자식이 아무것도 못 했다"*)는 CPU 사망기와 겹치는데,
  **이 경로로 검증된 건 아니다.** 샤드가 안 돌면 이 가설부터 다시 볼 것.
- `enrich-influencer-driver` / `-fanout` 레인은 **여전히 죽어 있다**(cron 게이트 뒤). 샤딩이 그 역할을
  대체하므로 지금은 무해하지만, 정리(삭제 또는 알람 편입)는 안 했다.
