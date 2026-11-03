# [UNLOCK_LOADING] 2026-11-03 — /pass ↔ /stays 서로 보내기 루프 차단 + 숙소 상세 '팔아보기'

- 파일: `src/pages/GroupBuyDetailPage.tsx`, `src/pages/StayDetailPage.tsx`(잠금표 밖, 같은 쌍이라 함께 기록)
- 허가: 대표 2026-11-03 (위와 같다)
- 🩸 오늘 앞 PR(#2151)이 /pass 의 숙소를 /stays 로 보냈는데, 숙소 상세는 숙소 정보가 없는 상품을 /pass 로 되돌려 보낸다(2026-07-20 안전판) → 둘이 서로를 끝없이 보낼 수 있었다(라이브 숙소 102개는 전부 숙소 정보가 있어 실제 발생 0).
- 고친 것: 숙소 상세의 되돌려 보내기에 `?nostay=1`, /pass 는 그 표시가 있으면 보내지 않는다.
- 함께: 숙소 상세에 `SellThisCard`(스위치 ON 일 때만) · `?aff=` 저장(이용권과 같은 `storeAffiliateRef`).
