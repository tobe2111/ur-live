# 2026-11-02 `[UNLOCK_LOADING]` 이용권 상세 — 매장 칸 지도 `bare` (테두리 상자·안쪽 이름/주소 줄 제거)

- **승인**: 대표 `AskUserQuestion` 답 **"허가 — 진행 (추천)"** (질문: 지도 부품이 테두리 상자와 가게 이름·주소를 또 그려 같은 이름이
  한 구역에 세 번 나온다. 이용권 상세에서만 '테두리 없는 지도 + 지도 위 작은 [카카오맵] 버튼'으로 그리려면 잠금 파일 둘을 한두 줄 고쳐야 한다).
- **배경**: 대표 *"응 더 개선할 건 없어? 디자인적으로나"* → 제안 넷 중 ①②③④ 전부 선택.

## 바꾼 것
| 파일 | 전 → 후 |
|---|---|
| `src/components/RestaurantMiniMap.tsx` | `bare?: boolean`(기본 false) 추가 — true 면 테두리 상자·이름/주소 머리 줄 없이 지도만, 카카오 장소 링크는 지도 위 흰 알약(`light-island`, 그림자 대신 `ring-1`) |
| `src/pages/GroupBuyDetailPage.tsx` | `<RestaurantMiniMap bare …>` 한 단어 |

## 건드리지 않은 잠금 항목
`shouldLoadSdk` IntersectionObserver 늦게 받기(가드가 그대로 있는지 시험) · 상세의 지도 lazy 경계(`DeferUntilVisible` + `Suspense`) ·
숙소 상세(`StayDetailPage`)는 `bare` 를 안 넘겨 종전 모양.

## 검증
`detail-polish-2026-11-02` 12건(지도 `bare` · 숙소 무변화 · 늦게 받기 유지 포함) · 주입 5건 빨간불 · 하네스 렌더 라이트/다크.
