# [UNLOCK_LOADING] 지갑 이용권 목록 판 → 평면 — 2026-11-02

- **바꾼 잠금 파일**: `src/pages/MyVouchersPage.tsx` (잠긴 항목: VoucherMap lazy chunk — **불변**)
- **대표 승인 문구(그대로, AskUserQuestion)**: *"허가 — 평면으로"*
  - 질문: *"이용권 지갑(/my-vouchers)의 이용권 목록 판과 위쪽 가로 넘김 카드는 '로딩 최적화 잠금' 파일 안에 있습니다.
    클래스만 바꾸는 일(그림자·흰 바탕 제거)인데 잠금 규칙상 허가가 필요합니다. 평면으로 바꿀까요? (로딩 동작은 건드리지 않습니다)"*
- **배경 결정**: 같은 날 대표 확정 **"A안 — 평면"** · 범위 **"소비자 화면 전체"**
  (원문 *"이용권 페이지도 한번 확인해볼래? 그림자 져있는 것들이라던지 개선이 필요해 디자인 통합을 해야지."*).

## 무엇을

| 자리 | 전 | 후 |
|---|---|---|
| 사용 가능 이용권 목록 판 | `overflow-hidden rounded-2xl bg-surface shadow-lift divide-y divide-rule` | `-mx-4 overflow-hidden divide-y divide-rule` |
| 지도 위 가로 넘김 카드 | 그대로 | **그대로** — 지도 타일 위에 떠 있는 면이라 흰 면·그림자가 경계다 |

`-mx-4`: 판이 사라지면 판 안쪽 여백(줄의 px-4)과 바깥 여백(컨테이너 px-4)이 겹쳐 글자가 탭보다 16px 안으로
들어간다 — 2026-10-31 `.ur-my-flat` 이 같은 이유로 쓴 처방(바깥만큼 되돌림)과 같다.

🩸 첫 판이 가로 넘김 카드까지 걷었다 — 그 카드의 부모가 `absolute` 라 그 줄만 보면 흐름 속처럼 보였다.
렌더 전에 diff 로 잡아 되돌렸고, 판정 규칙(`consumer-plate-flat.mjs` `KEEP_LINE`)에 `snap-start shrink-0` 를 더했다.

## 불변으로 지킨 잠금 항목
VoucherMap lazy chunk(Kakao Maps SDK) · import·Suspense·데이터 훅 무변경. className 문자열 한 줄만.

## 가드
`src/tests/unit/consumer-plate-flat-2026-11-02.test.ts` ④(지갑 판 평면) · ③(지도 위 카드는 그림자 유지)
+ 주입 `scripts/mutations/consumer-plate-flat-2026-11-02.mjs`.

## E4 · 롤백
배포 후 폰으로 `/my-vouchers` — 목록에 흰 판·그림자가 없고, 줄 글자 왼쪽 선이 탭(`사용 가능`)과 맞는가.
지도 보기에서 아래 가로 카드는 여전히 흰 면인가. 롤백은 className 한 줄 revert.
