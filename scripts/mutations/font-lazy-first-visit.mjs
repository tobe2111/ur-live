/**
 * 🔤 첫 방문 Pretendard 미루기 (2026-10-12, 대표 "처음 접속하는 디바이스 유저는 너무 느려") — 주입 매니페스트.
 * 가드: src/tests/unit/font-lazy-first-visit-2026-10-12.test.ts
 */
const TEST = 'src/tests/unit/font-lazy-first-visit-2026-10-12.test.ts'

export default [
  {
    name: '🔤 첫 방문에도 폰트를 바로 받는다(시트를 안 끈다)',
    file: 'index.html',
    find: 'href="/static/fonts/pretendard-dynamic-subset-v1.3.9.css"\n      media="print"',
    replace: 'href="/static/fonts/pretendard-dynamic-subset-v1.3.9.css"',
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
    find: "if(localStorage.getItem('ur_font_warm')==='1'){l.media='all';return}",
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
  {
    name: '🔤 /static/fonts/* 가 /* 의 no-store 를 안 뗀다(헤더가 합쳐져 캐시 무효)',
    file: 'public/_headers',
    find: '/static/fonts/*\n  ! Cache-Control\n',
    replace: '/static/fonts/*\n',
    test: 'src/tests/unit/self-hosted-fonts-2026-10-12.test.ts',
    why: 'Pages 는 맞는 규칙의 헤더를 합친다 — 떼지 않으면 no-store 가 이겨 폰트를 매 방문 다시 받는다(라이브 BYPASS 실측).',
  },
  {
    name: '📦 폰트 조각을 기다리지 않고 바로 켠다(조각마다 재배치)',
    file: 'index.html',
    find: "var k=u.length,c=0;if(!k)return flip();",
    replace: "var k=u.length,c=0;return flip();",
    test: TEST,
    why: '조각 파일이 하나씩 도착할 때마다 문서 전체를 다시 배치한다(재생 트레이스: load 뒤 전체 레이아웃 여러 번).',
  },
  {
    name: '📦 폰트 조각을 화면 글자와 대조하지 않고 전부 받는다',
    file: 'index.html',
    find: "if(m&&hit(r.style.getPropertyValue('unicode-range'),cs))",
    replace: 'if(m)',
    test: TEST,
    why: '92개 조각을 전부 받으면 2MB — 화면이 안 쓰는 글자까지 받는다.',
  },
  {
    name: '📦 폰트 조각 preload 가 crossorigin 없이 나가 캐시를 못 쓴다',
    file: 'index.html',
    find: "x.crossOrigin='anonymous';",
    replace: '',
    test: TEST,
    why: '폰트 요청은 CORS 라 crossorigin 없는 preload 와 캐시 키가 다르다 — 같은 파일을 두 번 받는다.',
  },
  {
    name: '📦 폰트 조각 대조가 이분 탐색 경계를 놓친다',
    file: 'index.html',
    find: 'if(lo<cs.length&&cs[lo]<=b)return 1',
    replace: 'if(lo<cs.length&&cs[lo]<b)return 1',
    test: TEST,
    why: '범위 끝 글자만 쓰는 조각을 안 받는다 — 그 글자는 켠 뒤에 따로 받아 재배치가 한 번 더 생긴다.',
  },
]
