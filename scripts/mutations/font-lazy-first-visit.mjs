/**
 * 🔤 첫 방문 Pretendard 미루기 (2026-10-12, 대표 "처음 접속하는 디바이스 유저는 너무 느려") — 주입 매니페스트.
 * 가드: src/tests/unit/font-lazy-first-visit-2026-10-12.test.ts
 */
const TEST = 'src/tests/unit/font-lazy-first-visit-2026-10-12.test.ts'

export default [
  {
    name: '🔤 첫 방문에도 폰트를 바로 받는다(시트를 안 끈다)',
    file: 'index.html',
    find: "l.media='print';var done=0;",
    replace: 'var done=0;',
    test: TEST,
    why: '폰트 17개·420KB 가 최우선순위로 앱 스크립트와 회선을 다툰다 — 첫 방문 조작 가능이 1~1.5초 늦어진다.',
  },
  {
    name: '🔤 백스톱이 사라져 load 를 못 받은 사람은 Pretendard 를 영영 못 본다',
    file: 'index.html',
    find: "setTimeout(on,12000)",
    replace: 'void 0',
    test: TEST,
    why: 'load 이벤트를 놓친 브라우저(이미 complete 판정을 빗나간 경우 등)에서 시트가 print 로 남는다.',
  },
  {
    name: '🔤 한 번 받은 사람도 매번 미룬다(표식을 안 본다)',
    file: 'index.html',
    find: "if(localStorage.getItem('ur_font_warm')==='1')return",
    replace: 'void 0',
    test: TEST,
    why: '재방문자는 폰트가 캐시에 있어 비용 0 인데, 미루면 매 방문 시스템 글꼴 → Pretendard 교체가 보인다.',
  },
  {
    name: '🔤 폰트를 받기도 전에 표식을 세운다',
    file: 'index.html',
    find: "if(f&&f.length){try{localStorage.setItem('ur_font_warm','1')}catch(e){}}",
    replace: "{try{localStorage.setItem('ur_font_warm','1')}catch(e){}}",
    test: TEST,
    why: '시트 등록 전이면 빈 결과가 온다 — 그때 표식을 세우면 다음 방문이 캐시 없이 렌더를 막고 받는다.',
  },
]
