/**
 * 🚦 미리 받기(Link 헤더)의 crossorigin 이 실제 <link> 와 같다 (2026-10-14 — 같은 CSS 를 두 번 받던 것) — 주입 매니페스트.
 * 가드: src/tests/unit/css-first-boot-2026-10-12.test.ts ⑦
 */
const TEST = 'src/tests/unit/css-first-boot-2026-10-12.test.ts'
const FILE = 'src/worker/utils/css-first-boot.ts'

export default [
  {
    name: '🚦 엔트리 CSS 미리 받기에서 crossorigin 을 뺀다',
    file: FILE,
    find: '`<${h}>; rel=preload; as=style; crossorigin`',
    replace: '`<${h}>; rel=preload; as=style`',
    test: TEST,
    why: '실제 태그는 crossorigin 이라 요청 방식이 갈려 미리 받은 CSS 가 버려지고 첫 그림이 두 번째 다운로드를 기다린다.',
  },
  {
    name: '🔤 지운 폰트 CSS 를 다시 미리 받으라고 한다',
    file: FILE,
    find: "rel=preload; as=style; crossorigin`).join(', ')",
    replace: "rel=preload; as=style; crossorigin`).concat(['</static/fonts/pretendard-dynamic-subset-v1.3.9.css>; rel=preload; as=style']).join(', ')",
    test: TEST,
    why: '2026-10-15 손님 화면은 기기 글꼴이라 그 시트가 없다 — 없는 파일을 매 첫 방문 미리 받는다(404).',
  },
]
