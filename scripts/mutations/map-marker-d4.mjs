/**
 * 🗺️ 지도 마커 안 N1 + D4 (2026-09-09) — 주입 매니페스트.
 * 가드: src/tests/unit/map-marker-d4.test.ts
 */
export default [
  {
    name: '🗺️ 이미 본 것이 할인 강조에 짐 (무게 3단계가 무너진다)',
    file: 'src/shared/map-marker.ts',
    find: "  if (isSeen) return 'seen'\n  return discount >= MAP_HIGHLIGHT_DISCOUNT_PCT ? 'highlight' : 'normal'",
    replace: "  if (discount >= MAP_HIGHLIGHT_DISCOUNT_PCT) return 'highlight'\n  return isSeen ? 'seen' : 'normal'",
    test: 'src/tests/unit/map-marker-d4.test.ts',
    why: "이미 본 것을 할인 때문에 되살리면 '무엇이 새 것인가'를 못 읽는다. 순서가 곧 규칙이다.",
  },
  {
    name: '🗺️ 할인율을 전부 띄운다 (임계값 무력화 — 다 세일이라 배경음이 된다)',
    file: 'src/pages/restaurant-map/map-overlays.ts',
    find: "  const showDiscount = (tier === 'highlight' || tier === 'selected') && discount > 0",
    replace: '  const showDiscount = discount > 0',
    test: 'src/tests/unit/map-marker-d4.test.ts',
    why: '라이브 실측상 활성 이용권 50건 전부 할인 중이다 — 전부 띄우면 변별력이 0 이 되고 30%+ 아홉 건이 묻힌다.',
  },
  {
    name: '🗺️ seen 라벨을 visibility 로 감춤 (자리를 차지해 그 핀만 위로 뜬다)',
    file: 'src/pages/restaurant-map/map-overlays.ts',
    find: "    label.style.display = st.hideLabel ? 'none' : 'block'",
    replace: "    label.style.visibility = st.hideLabel ? 'hidden' : 'visible'",
    test: 'src/tests/unit/map-marker-d4.test.ts',
    why: 'visibility:hidden 은 자리를 차지한다. yAnchor:1 이라 seen 핀만 라벨 높이만큼 위로 떠 엉뚱한 좌표를 가리킨다.',
  },
  {
    name: '🗺️ 핀 앵커가 0.5 로 돌아감 (꼬리가 엉뚱한 자리를 짚는다)',
    file: 'src/pages/restaurant-map/useKakaoMap.ts',
    find: 'position: pos, content, yAnchor: 1, xAnchor: 0.5, zIndex: 3',
    replace: 'position: pos, content, yAnchor: 0.5, xAnchor: 0.5, zIndex: 3',
    test: 'src/tests/unit/map-marker-d4.test.ts',
    why: '꼬리 달린 핀은 바닥이 좌표를 가리켜야 한다. 0.5 면 알약이 좌표 위에 얹혀 꼬리가 거짓말을 한다.',
  },
  {
    name: '🗺️ 지도가 다시 자기 할인율을 계산 (서버 정렬·카드와 정의가 갈린다)',
    file: 'src/pages/RestaurantMapPage.tsx',
    find: '        return priceDisplay(b).discount - priceDisplay(a).discount',
    replace: '        return (b.original_price > b.price ? (1 - b.price / b.original_price) : 0) - (a.original_price > a.price ? (1 - a.price / a.original_price) : 0)',
    test: 'src/tests/unit/map-marker-d4.test.ts',
    why: '같은 상품이 화면마다 다른 할인율을 보이면 버그가 아니라 거짓말이다. 서버 정렬·카드·마커가 한 정의를 써야 한다.',
  },
  {
    name: '🗺️ 마커 아이콘이 칩과 갈림 (거울 검사)',
    file: 'src/shared/map-marker-icons.ts',
    find: '<path d="M3 19V9a2 2 0 0 1 2-2h2v4h10V9h2a2 2 0 0 1 2 2v8M3 15h18"/>',
    replace: '<path d="M4 19V9a2 2 0 0 1 2-2h2v4h10V9h2a2 2 0 0 1 2 2v8M4 15h18"/>',
    test: 'src/tests/unit/map-marker-d4.test.ts',
    why: '같은 카테고리가 칩에선 이 그림, 마커에선 저 그림이면 사용자는 다른 것으로 읽는다.',
  },
  {
    name: '🗺️ restyle 이 자기 숫자를 다시 적기 시작 (빌드와 갈린다)',
    file: 'src/pages/restaurant-map/useKakaoMap.ts',
    find: '      applyPinTierStyle(el, tier)',
    replace: "      applyPinTierStyle(el, tier)\n      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.30)'",
    test: 'src/tests/unit/map-marker-d4.test.ts',
    why: '스타일 값이 빌더와 restyle 두 곳에 있으면 한쪽만 고쳐져 조용히 갈린다(종전 코드가 정확히 그랬다).',
  },
  {
    name: '🗺️ 지도 목록 행이 다시 자기 할인율을 계산 (마커와 한 화면에서 갈린다)',
    file: 'src/pages/restaurant-map/RestaurantRow.tsx',
    find: '  const { discount } = priceDisplay(r)',
    replace: '  const discount = r.original_price > r.price ? Math.round((1 - r.price / r.original_price) * 100) : 0',
    test: 'src/tests/unit/map-marker-d4.test.ts',
    why:
      '이 행은 지도 **바로 아래**에 있다. 마커가 34% 라고 한 상품이 여기서 다른 숫자면 사용자가 ' +
      '한 화면에서 두 값을 동시에 본다 — 서버 선언값이 계산값보다 클 때 실제로 갈린다.',
  },
  {
    name: '🗺️ 선택 카드가 다시 자기 할인율을 계산',
    file: 'src/pages/restaurant-map/SelectedDealCard.tsx',
    find: '    ? priceDisplay(selected).discount',
    replace: '    ? Math.round((1 - selected.price / selected.original_price) * 100)',
    test: 'src/tests/unit/map-marker-d4.test.ts',
    why: '핀을 눌러 뜨는 카드다 — 방금 본 마커의 숫자와 다르면 그 자리에서 바로 어긋난다.',
  },
]
