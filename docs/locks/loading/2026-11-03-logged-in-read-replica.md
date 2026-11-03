# [UNLOCK_LOADING] 로그인 손님 읽기도 한국 근처 DB 사본으로 (2026-11-03)

**대표 지시(원문)**: *"3,4 해결해줘 1번은 돈 드는거 아니야?"* → (추가 비용 없음 답변 후) *"1,3,4 다 해줘"*.
1번 = 로그인 화면도 한국 근처 사본에서 읽기.

## 바꾼 잠금 항목
| 파일 | 무엇을 |
|---|---|
| `src/features/group-buy/api/group-buy-public.routes.ts` | `GET /my`(내 이용권) — `userReadDb`. 색인 DDL 메모는 `dbKey`(원본) 기준, DDL 은 원본으로 |
| `src/worker/index.ts` | `/api/*` 에 `recentWriteMarker()` 한 줄(추가만 — SSR 블록·캐시 read 불변) |

잠금 밖: 쿠폰함(`coupons.routes` GET /my + 받기 GET 이 직접 표시) · 알림 설정 조회 · 리뷰 레벨(`review-level` 메모 dbKey) · 유어샵 로그인 방문.

## 규칙
- 이 브라우저가 `/api/*` 에서 GET·HEAD 아닌 요청을 성공시키면 `ur_d1_fresh=1`(30초, HttpOnly) → 그동안 원본에서 읽는다(방금 바꾼 게 바로 보인다).
- 돈 화면(딜 잔액·주문·결제·정산·사장님 매출)은 사본을 안 쓴다 — `d1-user-read-2026-11-03.test.ts` 가 허용 파일 5개를 고정.
- 비용: 복제는 무료(읽은 행 수로만 과금 — 사본에서 읽어도 같은 값).

## 회귀 감시
`src/tests/unit/d1-user-read-2026-11-03.test.ts` · 주입 `scripts/mutations/d1-user-read-2026-11-03.mjs`(5건 빨간불 확인) · 재조준 2건(유어샵 주인 · 내 이용권 색인 메모).

## 못 본 것
- 실제로 사본이 응답하는지·얼마나 빨라졌는지는 라이브에서만(로그인 필요 — 대표 폰 E5).
- GET 인데 쓰는 새 핸들러가 생기면 표시가 안 붙는다(쿠폰 받기처럼 직접 붙여야 한다).
