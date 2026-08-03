# 수집 레인을 알람으로 — 대표의 1순위 축이 34개 중 가장 굶고 있었다

> 대표: *"어떻게 하는게 가장 이상적이야?"* → *"응 해줘"*

## 무엇이 문제였나 (전부 실측)

`ads:collect` 는 **마지막 성공이 KST 03:01, 그 뒤 6시간 30분 정지**였다. 그동안 리드 0건, 커서 0전진.
원인이 **둘이 겹쳐 있었다**.

### ① 순번을 거의 못 받는다

```
KST 09:00 회차 (per_tick 3 · 무료 플랜)
  influencer  budget 1 → run:[inbound-onboarding]
                         deferred:[collect, consented-reminder, social-maintenance]
  company     budget 1 → run:[3개]  always:2
  prospect    budget 1 → run:[collect-hira]  deferred:[4개]
  wholesale   budget 0 → run:[collect-maker]
```

인플루언서 도메인은 **레인 4개가 시간당 예산 1칸**을 나눠 쓴다 → collect 는 잘해야 4시간에 한 번.

### ② 그 한 번마저 죽는다

```
22:00:35  디스패치 (run:['collect'])
22:00:38  ads:collect            Worker exceeded CPU time limit.   ← 3초 뒤
22:00:38  ads:enrich-company     Worker exceeded CPU time limit.
22:00:38  ads:collect-storeinfo  Worker exceeded CPU time limit.
22:00:37  ads:sheets-sync        Worker exceeded CPU time limit.
```

자식 인보케이션의 CPU 는 부모에게 청구되므로 B2B 29개와 **같은 벽**에 부딪힌다.
24시간 CPU 사망 29건의 최다 소비자는 `sheets-sync` 6 · `enrich-company` 6 — **둘 다 인플루언서 축이 아니다.**

⇒ **예산 재분배로는 못 푼다.** 누가 굶느냐만 바뀌고 벽은 그대로라, 순번을 받아도 또 죽는다.

## ✅ 처방 — `collect` 를 DO 알람 레인으로 (`ALARM_LANES` 등록부)

자기 인보케이션·자기 CPU 를 갖는다 → B2B 29개와의 경쟁이 **끝난다**.
어젯밤 같은 패턴을 두 번 검증했다(`enrich-influencer`·`maintenance` 둘 다 fail_streak 0, 시간당 12회차 안정).
부수 효과로 인플루언서 도메인 예산 1칸이 비어 **나머지 3개 레인 순번도 빨라진다.**

### ⚠️ `runsPerHour: 1` — 증설이 아니라 복원이다

cron 이 원래 `0 * * * *`(시간당 1회)다. 기본값 12를 그대로 받으면 **설계 의도를 12배 넘는 증설**이고,
그건 네이버로 나가는 요청을 늘리는 일이라 **대표 판단 사항**이다. 여기서는 의도한 값으로 되돌리기만 한다.

### 🩸 내가 어제 틀렸던 판단 (이게 이 문서에서 제일 중요하다)

어제 나는 이 처방을 **"외부 검색량 4배"라며 보류**했다. 세 가지를 잘못 봤다:

1. **YT 검색량은 안 늘어난다** — `ytBudgetTotal`(하루 90~100)이 하드캡이라 회차 수와 무관하게 총량이 같다.
2. **네이버는 하루 25,000 쿼터에 실사용 ~2%** — 4배여도 8%.
3. 무엇보다 **"4배"의 기준이 설계 의도가 아니라 *고장 난 현재*(6시간에 한 번)였다.**

그리고 대표가 "밀지 마라"고 한 건 **측정 레인을 4조각으로 쪼개는 건**이었다. 그건 네이버에 **동시 요청**을
4배로 늘리는 일이라 성격이 완전히 다르다. **나는 그 판단을 엉뚱한 건에 가져다 붙였다.**
⇒ 교훈: *"과거 지시를 새 건에 적용하기 전에, 그 지시가 무엇을 걱정한 것인지부터 맞춰볼 것."*

## 🛡️ 가드 3건 (전부 일부러 깨뜨려 빨간불 확인 후 복원 · 매니페스트 등재)

| 불변식 | 안 지키면 |
|---|---|
| 알람이 몰면 부모는 수집을 안 던진다 | 리스가 이중 *실행* 은 막지만 **던지는 것 자체가 부모 CPU 를 먹는다** — 원인 재발 |
| `laneAlarmOn` 선언이 첫 사용보다 앞 | `const` TDZ → **런타임 ReferenceError**, 그런데 **타입체크는 통과한다**(작성 중 실제로 밟았다) |
| 수집 `runsPerHour: 1` | 빼면 기본 12 = 조용한 12배 증설 = 대표 판단 없이 외부 요청량 변경 |

## ▶️ 다음 세션의 첫 액션 — 배포 후 판정

배포 뒤 **다음 정각**에:

```bash
bash scratchpad/watch_collect.sh
```
- `collect_last_run` 이 **매시간 갱신**되면 성공(지금은 `2026-08-02 18:01:21` 에 고착).
- `focus_cursor` 가 생기고 값이 늘면 **#990 도 같이 판정**된다(그동안 collect 가 안 돌아 미판정이었다).
- `never_run` **16 → 감소** 하면 잠들어 있던 대행사 키워드가 깨어난 것이다.
- `ads_lane_alarm_last:collect` 의 `fail_streak` 이 0 이 아니면 알람 안에서 실패하는 것 — 그건 다른 문제다.

## 📌 남은 것

- **(b) 비-인플루언서 CPU 정리는 후속이다.** `sheets-sync` 는 24시간에 6번 죽는 raw-waitUntil 우회 레인이라
  부모 CPU 를 직접 태운다. 모두를 해치는 순수 낭비지만 collect 살리기와는 별개 건이다.
- 이 세션의 도구 결함 수리: `d1.sh`/`d1b.sh` 가 호출마다 **고유 임시파일**을 쓴다. 예전엔 공유
  `q_res.json` 이라 **백그라운드 감시가 내 쿼리 결과를 덮어썼다**(실제로 오진 직전까지 갔다).
