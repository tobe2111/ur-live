# 12개 레인이 매시간 죽는데 기록은 `err=Error` 한 단어 (2026-08-01)

## 판정 — 앞선 수정 두 개는 먹혔다

| 항목 | 근거 |
|---|---|
| **카카오 스윕 예약(#901)** | `08-01 00:01:18 · tried 35 · found 1 · **limit_hit false**` — 이전엔 `tried 50 · limit_hit true` 로 자기 기록조차 못 썼다 |
| **self-beat(#899)** | 12:00 틱에 9개 레인이 자기 이름으로 기록. 스케줄러(`ads:scheduled`)도 12:00:23 정상 |

## 지금 남은 고장 — 외부 HTTP 를 쓰는 레인만 죽는다

12:00 틱 기준:

| 12:00 에 기록됨 (전부 ok) | 07:00 이후 기록 없음 (전부 `ok=false`) |
|---|---|
| match-registry · reclassify · collect-maker · maintenance?phase=merge · collect · consented-reminder · inbound-onboarding · social-maintenance | enrich-company · enrich-influencer-driver · collect-neis · sheets-sync · collect-commerce · collect-storeinfo · enrich-prospects · collect-company |
| **D1 전용(외부 호출 0)** | **전부 외부 HTTP 레인** |

죽는 시각은 제각각이다(부모 기준 `ms`: 1782 · 3491 · 3863 · 5516 · 5792 · 6213 · 7362 · 9524 · 9649 · 13541).
**동시에 끊긴 게 아니다** — 즉 "부모가 한 순간에 회수돼 전부 취소" 는 아니다.

## 그런데 사유가 전부 `err=Error` 였다

`cronErrorCode` 는 `name || 'Error'` 를 돌려준다. 한도(`limit`)·타임아웃(`timeout`)만 분류하고
**그 밖의 Error 는 메시지를 통째로 버린다.** 그래서 12개가 죽는데 원인 후보를 하나도 못 좁혔다.

⚠️ 자식측 기록(#904 `writeSelfBeat`)은 **자식이 강제 종료되면 실행조차 안 된다.**
그 경우 부모의 이 한 줄이 유일한 단서인데, 그 한 줄이 `err=Error` 였다.

⇒ 부모도 **원문을 함께** 싣는다(분류는 유지). `summarizeResult` 가 72자로 자른다.

## 다음 세션의 첫 액션 — 이제 진짜로 갈린다

배포 후 다음 정시에 `GET /api/admin/cron-heartbeats` → `ok=false` 인 레인의 `result.detail`:

| detail 원문 | 뜻 | 처방 |
|---|---|---|
| `Too many subrequests` 류 | 자식 인보케이션이 한도 초과 | 레인별 예산·라운드 분할 |
| `Network connection lost` / `The script will never generate a response` | 자식이 런타임에 종료됨 | 수명 축(드라이버 체인) |
| `internal error` / 그 외 | 플랫폼측 | 재시도·백오프 |

⚠️ **detail 이 비어 있으면**(메시지 없는 throw) 여전히 분류만 남는다. 그때는 자식측 기록이 있는지 보고,
그것도 없으면 "인보케이션째 사라짐"이 확정이다(그 부재가 신호다).

## 아직 안 풀린 것

- **통신판매 자기 스탬프**: 여전히 `07-29 14:00:40`. 그 레인이 02:00 에 `ok=false` 로 죽었으니
  스탬프를 쓸 기회 자체가 없었다. 위 detail 이 나오면 같이 풀린다.
- **인허가 `1741000`**: 대표 확인 대기(요청 형태 5종 소진 · 진단 한계). 코드로 더 할 것이 없다.
- 풀은 계속 자란다: 171,617 → **173,563**(+1,946). 연락처 없음 150,294(86.6%).
