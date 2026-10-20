# 2026-08-05 — 카카오 스윕 소스별 인터리브 (어제 수리의 **정정**)

## 1. 어제 내가 틀렸다

2026-08-04 에 "storeinfo 17,979건 × 적중률 20% ≈ 전화 3,500건(+12.7%)" 이라고 보고했다.
배포 후 실측하니 **틀렸다.**

```
스윕 적격 행을 실제 정렬 순서대로 묶어 본 결과
  t1~2 local        867
  t3   storeinfo  2,742   ← 여기까지만 닿는다 (≈10일)
  t4   commerce 111,256   ← 벽
  t5   storeinfo 15,518   ← 309일 뒤. 사실상 그대로 굶는다
```

어제 수리(미조회 우선)는 **앞줄이 30일마다 되살아나는 반복**은 끊었다. 그건 맞다.
하지만 미조회끼리는 여전히 tier 가 줄을 세운다 — 그래서 닿는 건 **2,742건(≈550 전화, +2%)**이지
17,979건이 아니다.

🩸 **왜 틀렸나**: *"tier 는 안 건드렸다, 축만 늘렸다"* 고 신중하게 설계해 놓고, **기대값은 tier 를
무시한 채** storeinfo 전체에 적중률을 곱했다. 설계 문장과 산수가 따로 놀았다.

## 2. 무엇을 했나 — 소스별 인터리브

```sql
ROW_NUMBER() OVER (PARTITION BY source ORDER BY <어제의 3축>) AS rn
...
ORDER BY rn ASC, (tier IS NULL) ASC, tier ASC, id ASC LIMIT ?
```

각 소스의 1등끼리, 2등끼리 묶어 뽑는다 → **큰 소스가 작은 소스를 구조적으로 굶길 수 없다.**
라이브 확인(읽기 전용): `rn <= 9` 로 뽑으면 storeinfo·market·local·commerce 가 **각 9건씩**
(예전엔 commerce 가 전부 가져갔다). D1 이 윈도우 함수를 지원하는지도 같은 쿼리로 확인했다.

**tier 를 뒤집는 선택지는 버렸다.** "commerce(통신판매)보다 storeinfo(오프라인 매장)가 먼저여야
하지 않나"는 그럴듯하지만 **추측**이다 — 소스별 적중률을 우리는 한 번도 재본 적이 없고, commerce 는
조회를 받은 적이 없어 높은지 낮은지 알 수가 없다. **어제 storeinfo 를 "수율 2.7%니 잘라내자"고
오판한 것과 정확히 같은 함정**(분모가 처리된 적이 없었다). 인터리브는 모든 소스가 증거를 만들게 한다.

그래서 같은 커밋에 `by_source`(소스별 시도/적중) 계측을 넣었다 — **아직 아무 판정에도 안 쓴다.**
증거가 쌓이면 그때 수율로 가중한다. 키워드 축이 `contactPenalty`(증거 40건 이상일 때만 감점)로
밟은 순서 그대로다.

## 3. 알림("레인 4개 침묵 · CPU 사망 15회")에 대한 판정 — 내 변경과 무관

72시간 `cron_failures` 실측:
```
ads:sheets-sync      10회  08-02 03:00 부터      ads:collect-company    6회  08-02 부터
ads:enrich-company    9회  08-02 05:00 부터      ads:collect-commerce   6회  08-02 부터
ads:enrich-prospects  6회  08-02 부터            ads:collect-storeinfo  6회  08-02 부터
```
상위 6개가 43회로 대부분이고 **전부 8월 2일부터**, 어제 손댄 파일과 겹치지 않는다.
`sweep-kakao-chain`(어제 고친 레인)은 7일간 **2회** — 08-04 05:00(머지 14:15 **이전**)과 08-05 01:00.
새 패턴이 아니다. 표본 2건이라 단정은 못 하니 계속 관찰할 것.

알림 자체도 일부 낡았다 — `collect-store-kakao` 는 01:00 에 ok 로 돌았다.
`collect-neis`·`reclassify-company` 의 2.8시간 공백은 **구조**다(무료 플랜 틱당 6개 레인 × 34개 레인
= 한 바퀴 5~6시간). 임계 3시간이 이 구조를 모르고 잡는다 → **임계값이 레인 수를 반영해야 한다**(미해결).

## 4. 가드

- `kakao-sweep-query.ts` — SQL SSOT 분리. 하루에 두 번 틀린 자리라 테스트가 붙는 곳에 뒀다.
- `kakao-sweep-order.test.ts` 14개 — 안쪽 정렬 3축 + 순서 · 인터리브(파티션·바깥 ORDER BY 순서) ·
  WHERE 불변 4항 · 계측(빈 소스도 안 버림) · 배선.
- 주입 2건(3축 제거 / 파티션 제거) — 전부 빨강 확인. 총 **209**.
- 낡은 지도 2건이 잡혔다: 옛 주입 find(인라인 타입) · `ads-cpu-work-cap-callsites` 의 SQL 앵커.
  **둘 다 검사가 먼저 잡았다** — 이게 그 두 검사가 존재하는 이유다.

## 5. 다음 세션 첫 액션

1. 배포 하루 뒤 — 인터리브가 실제로 도는가:
   ```sql
   SELECT source, COUNT(*) n, SUM(kakao_checked_at IS NOT NULL) checked,
          SUM(phone IS NOT NULL AND phone<>'') phones
     FROM ad_company_leads WHERE merged_into IS NULL GROUP BY source ORDER BY n DESC;
   ```
   **`storeinfo`·`commerce` 의 `checked` 가 둘 다 0에서 올라가면** 산 것이다.
   한쪽만 오르면 인터리브가 안 걸린 것(파티션 확인).
2. `ads_kakao_sweep_stats.by_source` 가 쌓이기 시작하면 **소스별 적중률**을 읽는다.
   그 값이 갈리면(예: storeinfo 30% vs commerce 5%) 그때 가중을 넣는다 — **그전엔 넣지 않는다.**
3. 하트비트 침묵 임계(3시간)가 레인 수와 무관하게 고정이라 정상 로테이션을 오탐한다. 임계를
   `레인수 ÷ 틱당레인수 × 1시간` 기반으로 바꾸는 것이 맞다(이번 커밋 범위 밖).
