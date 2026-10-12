/**
 * 🗺️ 지도(/map) 카카오 SDK 조기 출발 (2026-10-12, 대표 "처음 접속하는 디바이스 유저는 너무 느려") — 주입 매니페스트.
 * 가드: src/tests/unit/map-early-kakao-sdk-2026-10-12.test.ts
 */
const TEST = 'src/tests/unit/map-early-kakao-sdk-2026-10-12.test.ts'

export default [
  {
    name: '🗺️ 조기 SDK 가 실패해도 자기 태그를 안 지운다(정상 경로가 죽은 태그를 재사용해 멈춤)',
    file: 'index.html',
    find: 'if(s.parentNode)s.parentNode.removeChild(s);',
    replace: '',
    test: TEST,
    why: 'ensureKakaoMaps 의 정상 경로는 dapi.kakao.com sdk.js 태그가 있으면 그걸 재사용한다 — 실패한 태그가 남으면 load 이벤트가 영영 안 와 지도가 멈춘다.',
  },
  {
    name: '🗺️ 조기 SDK 가 모든 경로에서 출발한다(지도 아닌 화면에 카카오 SDK 를 실음)',
    file: 'index.html',
    find: 'if(!/^\\/map\\/?$/.test(location.pathname))return;',
    replace: '',
    test: TEST,
    why: '홈·이용권 등 지도가 없는 화면의 첫 로딩에 카카오 SDK 와 연결 3개가 끼어들어 CSS·사진과 회선을 다툰다.',
  },
  {
    name: '🗺️ preconnect 에 crossorigin 이 붙는다(no-cors 스크립트·타일이 그 연결을 못 쓴다)',
    file: 'index.html',
    find: "l.rel='preconnect';l.href=h;",
    replace: "l.rel='preconnect';l.crossOrigin='';l.href=h;",
    test: TEST,
    why: 'crossorigin 연결 풀은 no-cors 요청과 따로다 — 붙이면 미리 연 연결을 아무도 안 쓰고 다시 연다.',
  },
  {
    name: '🗺️ ensureKakaoMaps 가 이른 약속을 이어받지 않는다(SDK 를 두 번 받는다)',
    file: 'src/lib/kakao-sdk.ts',
    find: '  if (early) {',
    replace: '  if (early && false) {',
    test: TEST,
    why: '이어받지 않으면 정상 경로가 이미 로드 중인 태그를 재사용하긴 하지만, load 를 놓친 뒤라면 kakao.maps.load 를 기다리며 멈출 수 있다.',
  },
  {
    name: '🗺️ 이른 약속이 거절되면 정상 경로로 다시 안 간다',
    file: 'src/lib/kakao-sdk.ts',
    find: '      return ensureKakaoMaps()\n',
    replace: '      throw new Error("no retry")\n',
    test: TEST,
    why: '조기 출발은 가속일 뿐이다 — 실패했을 때 정상 경로로 안 돌아가면 그 방문자에게 지도가 영영 안 뜬다.',
  },
]
