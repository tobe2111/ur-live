/**
 * 📍 지도 핀 끌어 위치 잡기 (2026-09-21 시안 ②) 되돌려-검증 주입.
 * 가드: src/tests/unit/pin-move-2026-09-21.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/pin-move-2026-09-21.test.ts'

export default [
  {
    name: '📍핀이동 주소 못 찾으면 기존 주소를 빈 값으로 덮는다',
    file: 'src/shared/pin-move.ts',
    find: "    restaurant_address: loc.address || current.restaurant_address || '',",
    replace: '    restaurant_address: loc.address,',
    test: TEST,
    why: '역지오코딩은 바다·신규 필지에서 빈손으로 돌아온다. 맞게 들어가 있던 주소가 조용히 사라진다.',
  },
  {
    name: '📍핀이동 좌표를 주소가 있을 때만 반영한다',
    file: 'src/shared/pin-move.ts',
    find: '    restaurant_lat: loc.lat,\n    restaurant_lng: loc.lng,',
    replace: '    restaurant_lat: loc.address ? loc.lat : current.restaurant_lat,\n    restaurant_lng: loc.address ? loc.lng : current.restaurant_lng,',
    test: TEST,
    why: '핀은 옮겨졌는데 저장값이 그대로면 고친 줄 알고 넘어간다 — 에러 없는 어긋남.',
  },
  {
    name: '📍핀이동 이름·전화까지 갈아엎는다 (장소 선택과 합침)',
    file: 'src/shared/pin-move.ts',
    find: '    restaurant_lat: loc.lat,',
    replace: "    restaurant_name: '',\n    restaurant_phone: '',\n    restaurant_lat: loc.lat,",
    test: TEST,
    why: '핀을 조금 끌었다고 방금 채운 전화번호가 지워지는, 이 분리의 존재 이유.',
  },
  {
    name: '📍핀이동 페이지가 SSOT 를 안 쓰고 직접 계산한다',
    file: 'src/pages/SellerMealVoucherNewPage.tsx',
    find: '    setForm(f => ({ ...f, ...applyPinMove(f, loc) }))',
    replace: '    setForm(f => ({ ...f, restaurant_lat: loc.lat, restaurant_lng: loc.lng }))',
    test: TEST,
    why: '규칙이 두 벌이 되면 주소 보존이 한쪽에서만 지켜진다. import 만 남아도 초록이 뜨는 함정.',
  },
  {
    name: '📍핀이동 StoreStep 배선 끊김 (지도 부품에 안 넘김)',
    file: 'src/pages/seller-meal-voucher/StoreStep.tsx',
    find: '                onPinMove={onPinMove}\n',
    replace: '',
    test: TEST,
    why: '핀이 드래그 안 되는 채로 배포된다. 타입 에러도 안 난다(옵셔널 prop).',
  },
  {
    name: '📍핀이동 핀이 드래그 안 된다',
    file: 'src/components/KakaoMapPicker.tsx',
    find: 'position: pos, map: mapRef.current, draggable: true, zIndex: 10,',
    replace: 'position: pos, map: mapRef.current, zIndex: 10,',
    test: TEST,
    why: '시안 ② 자체가 사라진다. 지도는 멀쩡히 뜨므로 눈으로만 보면 모른다.',
  },
  {
    name: '📍핀이동 역지오코딩 실패 경로가 콜백을 안 부른다',
    file: 'src/components/KakaoMapPicker.tsx',
    find: "    if (!g) { cb({ address: '', lat, lng }); return }",
    replace: '    if (!g) return',
    test: TEST,
    why: '지오코더가 없는 환경에서 핀을 끌면 아무 일도 안 일어난다 — 에러도 안 난다.',
  },
  {
    name: '📍핀이동 검색이 사용자가 잡아 둔 핀까지 지운다',
    file: 'src/components/KakaoMapPicker.tsx',
    find: '    markersRef.current.forEach(m => m.setMap(null))\n    markersRef.current = []',
    replace: '    markersRef.current.forEach(m => m.setMap(null))\n    markersRef.current = []\n    if (pinRef.current) { pinRef.current.setMap(null); pinRef.current = null }',
    test: TEST,
    why: '다시 검색하면 공들여 맞춘 위치가 사라진다.',
  },
  {
    name: '📍핀이동 핀을 안 쓰는 화면에도 지도 클릭·지오코더가 달린다',
    file: 'src/components/KakaoMapPicker.tsx',
    find: '    if (onPinMoveRef.current) {\n      try { geocoderRef.current = new window.kakao.maps.services.Geocoder() } catch { geocoderRef.current = null }',
    replace: '    {\n      try { geocoderRef.current = new window.kakao.maps.services.Geocoder() } catch { geocoderRef.current = null }',
    test: TEST,
    why: '이 부품을 쓰는 다른 화면의 지도 클릭 동작이 조용히 바뀐다(무회귀 약속 파기).',
  },
]
