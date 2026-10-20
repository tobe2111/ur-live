# 관측이 틀린 답을 주면 없느니만 못하다 — 오탐 3건 (2026-08-03)

## 다음 세션의 첫 액션

```bash
curl -sS "https://live.ur-team.com/api/admin/cron-heartbeats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
 | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print('orphan:',d['orphan_lanes']);print('never :',d['never_fired'])"
```
**판정**: `orphan_lanes` 가 **16 → 1~2건**(진짜 고아만)으로 줄고, `never_fired` 에서
`reclassify-company?passes=5` 가 사라지면 수리가 먹은 것이다.

---

## 🔴 내가 틀렸던 것 두 가지 — 먼저 적는다

이전 인계(`2026-08-03-urads-deploy-silent-miss.md`)에 "다음 세션 후보"로 적어 둔 A·B 중
**A 는 결함이 아니었고, B 는 결함이지만 원인이 내가 쓴 것과 달랐다.**

### A. "보강 팬아웃이 자기 잠금" — ❌ **사실이 아니다**
`prev_landed=false` 는 **팬아웃을 막지 않는다.** `reportFanout` 은 순수 관측자이고(던지지 않음),
그 직후 `const kids = Array.from(...)` 로 **무조건** 자식을 띄운다(`enrich.routes.ts`).
하는 일은 하트비트 `ok` 를 빨강으로 뒤집어 stale-watch 가 잡게 하는 것뿐이다.
⇒ **자기 잠금은 존재하지 않는다.** 이전 인계의 그 항목은 폐기한다.
🔑 교훈: 게이트처럼 *읽히는* 로그 문구(`why=…자식이 아무것도 못 했다`)를 게이트로 단정했다.
**호출부를 열어 보기 전에는 "막는다"고 쓰지 말 것.**

### B. "하트비트가 수동 라우트를 구분 못 함" — 부분적으로 틀림
구분 장치(`orphan_lanes`)는 **이미 있었다**(다른 세션이 07-29 에 만듦). 내가 raw `items` 만 보고
`stale:true` 를 읽어 "구분 못 한다"고 판단했다. 실제 결함은 다른 데 있었다 ↓

---

## 무엇을 고쳤나

### ① `orphan_lanes` 가 **살아 있는 레인 16개를 고아로** 찍고 있었다

실측(08-03 02:30 KST):
```
orphan_lanes: [maintenance?phase=merge, …?phase=quality, …?phase=reclassify, …?phase=selflink,
               enrich-influencer-driver, enrich-influencer-fanout, lane-alarm-boot, sheets-sync, …]  ← 16건
```
이 중 대부분이 **그 순간 멀쩡히 돌고 있었다.** 원인: 판정이 *"디스패처의 알려진 목록에 없으면 고아"* 였는데,
**#975 이후 정비·보강 레인이 DO 알람으로 옮겨가** 그 목록에 안 들어간다(우회 레인 `sheets-sync` 도 마찬가지).

**수정**: **나이를 함께 본다.** 목록에 없든 있든 **최근에 뛰고 있으면 고아가 아니다.**
목록을 손으로 관리하지 않아도 되므로 새 실행 경로(알람·우회)가 또 생겨도 안 깨진다.

> 고칠 게 없는 경보 16줄은 **진짜 하나**(`sweep-kakao-phone`, 4일 정지)를 묻어 버린다.
> 그게 이 세션이 그걸 "기아"로 오독한 이유다 — **오탐이 오진을 만든다.**

### ② `never_fired` 가 **쿼리 붙은 레인을 영원히 "안 돎"** 으로

`known` 은 쿼리를 단 채 들어오는데(`reclassify-company?passes=5`) 하트비트 쪽만 쿼리를 뗐다 —
**비대칭 정규화**. 그래서 기록이 멀쩡히 있어도(16:01 KST 하트비트 존재) 영원히 never_fired 였다.
**수정**: 비교하는 **양쪽 모두** `baseLaneName()` 을 통과시킨다.

### ③ PR 검증이 조용히 건너뛰어짐 (CI)

```
concurrency: cancel-in-progress  →  코드 커밋의 run 을 취소
paths-ignore: ['docs/**']        →  뒤이은 문서 커밋은 자기 run 을 안 만듦
────────────────────────────────────────────────────────────
결과: PR 에 실패한 체크가 하나도 없는데 그 코드는 한 번도 검증되지 않은 상태
```
초록불도 빨간불도 아닌 **무(無)** 였다. 08-02 PR #976 에서 실제로 발생했고, 머지 직전에 알아채
커밋을 하나 더 밀어 되살렸다 — **못 알아챘으면 미검증 코드가 머지됐다.**

**수정**: `pull_request` 에서 `paths-ignore` 제거(= PR 은 항상 전수 검증). `push` 쪽 skip 은 유지 —
그쪽은 그 푸시의 파일만 보므로 문서 푸시를 건너뛰는 게 옳다.
비용은 문서 PR 도 ~10분 도는 것(public 레포라 Actions 무료), 얻는 건 **머지되는 코드는 반드시 검증됨**.

---

## ⚠️ 아직 못 막는 것 (정직하게)

- **필수 상태체크(branch protection)가 없다.** Verify 가 빨강이어도 GitHub 이 머지를 막지 않는다.
  코드가 강제할 수 없는 **레포 설정**이라 대표 판단 사항이다. 지금 보장하는 건 *"검증이 돌기는 한다"* 까지.
- **`orphan_lanes` 의 나이 문턱(24h)은 추정이다.** 주간/월간 레인이 생기면 오탐이 난다.
  그때는 문턱을 올리기보다 그 레인의 기대 주기(`max_gap_min`)를 쓰는 쪽이 맞다.

## 남은 결정 / 대표 판단 대기 (다시 묻지 말 것)

- **Workers Paid + `ADS_PLAN=paid`** — 전환하면 레인 수 학습기가 천장 64 까지 스스로 올라간다.
- **`WORK24_API_KEY` 기업회원 키 교체.**
- 죽은 공공 소스(franchise/nara 404 · localdata 500 · nts 503) — 제공자측.
