/** 🧬 주입 — SSR 시드 위치(2026-10-19) */
const T = 'src/tests/unit/ssr-seed-body-end-2026-10-19.test.ts'
export default [
  {
    name: 'SSR시드위치 — 시드를 다시 head 에 붙인다',
    file: 'src/worker/index.ts',
    find: "            if (ssrSlot === 'MAIN' && ssrExtraPayload) for (const link",
    replace: "            el.append(`<script id=\"__SSR_INITIAL_MAIN__\" type=\"application/json\">${ssrPayload}</script>`, { html: true })\n            if (ssrSlot === 'MAIN' && ssrExtraPayload) for (const link",
    test: T,
    why: '첫 화면이 시드 44KB 뒤로 밀린다.',
  },
  {
    name: 'SSR시드위치 — body 핸들러가 MAIN 시드를 빠뜨린다',
    file: 'src/worker/index.ts',
    find: '          el.append(`<script id="${scriptId}" type="application/json">${ssrPayload}</script>`, { html: true });',
    replace: '',
    test: T,
    why: '시드가 없으면 0-RTT 가 깨져 첫 화면 뒤에 같은 데이터를 또 받는다.',
  },
]
