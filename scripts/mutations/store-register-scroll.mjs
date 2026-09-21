/**
 * 🖱️ 매장 등록 모달 스크롤 하나 + 사업자번호 자동 하이픈 (2026-09-21 대표 신고) — 주입 매니페스트.
 * 가드: src/tests/unit/store-register-scroll-2026-09-21.test.tsx
 *
 * 스크롤 결함은 **에러가 안 난다** — 화면은 멀쩡히 그려지고 손가락만 헛돈다. 깨뜨려 보지 않으면
 * 가드가 실제로 그걸 잡는지 알 수 없는 종류다.
 */
const T = 'src/tests/unit/store-register-scroll-2026-09-21.test.tsx'

export default [
  {
    name: '🖱️ 결과 목록이 다시 max-h 자체 스크롤이 된다 (두 번째 표면 부활)',
    file: 'src/components/KakaoMapPicker.tsx',
    find: "`${fill ? 'flex-1 min-h-0' : 'max-h-64'} overflow-y-auto overscroll-contain",
    replace: "`max-h-64 overflow-y-auto",
    test: T,
    why: '지도 아래에 자체 스크롤 상자가 또 생기면, 커서 위치에 따라 움직이는 게 달라지는 그 증상이 그대로 돌아온다.',
  },
  {
    name: '🖱️ 지도 단계에서도 모달 바디가 스크롤한다 (지도를 지나쳐야 목록에 닿는다)',
    file: 'src/components/seller/StoreRegisterModal.tsx',
    find: "mapStep ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'",
    replace: "'overflow-y-auto'",
    test: T,
    why: '바디가 스크롤되면 지도가 화면을 가로막는 벽이 된다 — 지도 위에서는 아무것도 안 내려간다.',
  },
  {
    name: '📐 지도 높이가 바뀌어도 relayout 을 안 부른다 (회색 띠)',
    file: 'src/components/KakaoMapPicker.tsx',
    find: '        mapRef.current.relayout()',
    replace: '        void 0',
    test: T,
    why: '카카오 지도는 컨테이너가 줄어든 걸 스스로 모른다. 높이만 바꾸고 끝내면 반드시 밟는 함정이다.',
  },
  {
    name: '🔢 사업자번호 자동 하이픈이 사라진다',
    file: 'src/components/seller/StoreRegisterModal.tsx',
    find: 'setBno(formatBusinessNumber(e.target.value))',
    replace: 'setBno(e.target.value)',
    test: T,
    why: '대표가 직접 요청한 표기다. 손으로 하이픈을 넣게 두면 사람마다 다른 모양이 저장된다.',
  },
]
