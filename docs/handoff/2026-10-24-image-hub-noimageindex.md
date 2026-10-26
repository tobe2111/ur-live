# 2026-10-24 — 구글 이미지: 상품 사진 제목이 전부 홈 제목

## 원인
상품 사진이 홈·지도·목록·유어샵 카드에 같은 URL 로 수십 번 실리고 상세엔 한 번 → 구글이 사진의 출처를 홈으로 잡아 "유어딜 - 우리 동네…" 제목을 붙였다.

## 한 것
- `src/shared/seo/image-hub.ts`(허브 판정 SSOT) + `applySurfaceMeta` 가 허브 정본에만 `<meta name="robots" content="noimageindex">` 를 붙인다.
- 허브 = `/` `/map` `/browse` `/vouchers` `/stays` `/region(/시도(/시군구))` `/urshorts` `/videos` `/u/x` `/s/x` `/profile/x`. 상세(`/pass` `/stays/:id` `/products/:id` `/vouchers/:id`)는 절대 아님.
- 페이지 색인(`index, follow`)은 그대로 — 사진만 빠진다. 사람 화면 변화 0.
- 시험 `image-hub-noimageindex-2026-10-24.test.ts` + 주입 3건.
- 10-21 에 만든 /about "브랜드" 섹션(로고·유달이 이미지)은 이번엔 뺐다 — 범위 최소화.

## 다음 세션 첫 액션(E4)
- 배포 후 `curl -A 'Googlebot' https://urdeal.kr/` 에 `noimageindex` 1개, `/pass/2919` 엔 0개.
- 구글 이미지 반영은 수주 — 대표에게 서치콘솔 "실적 > 검색 유형: 이미지" 로 확인 요청.
