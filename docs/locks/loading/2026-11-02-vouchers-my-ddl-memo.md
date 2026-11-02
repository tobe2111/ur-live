# [UNLOCK_LOADING] 내 이용권(`/api/vouchers/my`) 색인 DDL — 매 요청 → isolate 당 1회 — 2026-11-02

- **바꾼 잠금 파일**: `src/features/group-buy/api/group-buy-public.routes.ts`
  (잠긴 항목: `Cache-Control`/`CDN-Cache-Control` 분리 · `group_buy_tiers` 서버 parse — **둘 다 불변**)
- **대표 승인 문구(그대로, AskUserQuestion)**: *"허가 — 고쳐줘"*
  - 질문: *"마이페이지 '내 이용권' 데이터는 열 때마다 서버가 '색인 만들기' 명령을 먼저 한 번 더 실행해서, 매번 미국 DB를
    한 번 더 다녀옵니다. … 서버가 켜진 뒤 한 번만 실행하도록 고칠까요? (화면 내용 변화 없음, 돈과 무관)"*
- **배경**: 대표 *"부분적으로 느린 경우들이 많아서 유저들이 헷갈려해"* → *"모두 순서대로 해줘"*.

## 무엇을
`GET /my` 앞의 `CREATE INDEX IF NOT EXISTS idx_vouchers_user_created …` 를 모듈 `WeakSet`(`_voucherIdxDone`)으로
isolate 당 한 번만. 같은 색인은 `repair-schema/column-repairs.ts` 도 보장한다. 질의·응답·캐시 헤더 무변경.
줄 수 래칫(1139) 안에서 — 메모 선언을 마지막 import 줄에 붙였다.

## 가드
`src/tests/unit/partial-slow-round2-2026-11-02.test.ts` + 주입 `scripts/mutations/partial-slow-round2-2026-11-02.mjs`.

## 롤백
revert(코드만).
