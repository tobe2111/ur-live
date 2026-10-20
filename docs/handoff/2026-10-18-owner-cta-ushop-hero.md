# 2026-10-18 — 이용권 주인 [구매하기] 혼동 · 유어샵 '이번 주 픽' 결함 3건

대표: *"잠금파일 허가해줄게. 유어샵 버그도 가장 이상적인 방향이 뭐야"* (PR #1885 머지 직후).

## 한 것
- 주인 판정 = 서버 `GET /api/group-buy/viewer/:id` → `isSelfOwnedGroupBuy`(구매 차단과 같은 함수).
  그 함수가 주인 좌석(`seller_operators.role='owner'`)도 보게 함 — `/store/new` 사장님 구멍.
- 주인이면 PC 상자·모바일 바에 `OwnerManagePanel`([관리하기] → `/seller/group-buy` 경유).
- 유어샵 `featured-pick.ts`: 사진 있는 것만 히어로 · 칩은 두 목록 다 있을 때만 · `detailHref`.
- 가드 `owner-cta-ushop-hero-2026-10-18.test.tsx` 15건 · 주입 `scripts/mutations/owner-cta-ushop-2026-10-18.mjs` 6건.

## 다음 세션 첫 액션
- 배포 후 사장님 계정으로 자기 이용권 상세 → [관리하기]만 보이는지(E4, 로그인 필요 — 대표 확인).
- 현정 님 유어샵: 히어로가 사진 있는 이용권이거나 없음, [이용권] 칩이 사라졌는지.
- PR #1885 숙소 staging 실결제는 여전히 대표 대기.

## 틀렸던 판단
- 없음. 다만 서버 차단이 주인 좌석을 안 본다는 것은 이번에 처음 발견(종전 보고엔 "서버는 막고 있다"고 썼다 — linked 계정만 맞는 말이었다).
