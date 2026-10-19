/** 🧬 주입 — LCP 사진 Link 헤더가 실제 cdn-cgi 주소(쉼표 포함)를 버린다 (2026-10-19 배포 후 실측) */
export default [
  {
    name: 'LCP쉼표 — 쉼표 섞인 주소를 다시 버린다',
    file: 'src/worker/utils/lcp-image-link.ts',
    find: "href.startsWith('//') || /[<>;\\s]/.test(href)) return",
    replace: "href.startsWith('//') || /[<>,;\\s]/.test(href)) return",
    test: 'src/tests/unit/lcp-image-link-2026-10-19.test.ts',
    why: '모든 cfImage 주소가 쉼표를 품어 사진 미리받기 헤더가 한 번도 안 실린다(배포 후 라이브 0건).',
  },
]
