/** 🧬 주입 — "로더 먼저"가 조용히 되돌아가면 가드가 잡는가. 가드: src/tests/unit/loader-first-2026-11-09.test.ts */
const T = 'src/tests/unit/loader-first-2026-11-09.test.ts'
const F = 'src/worker/utils/css-first-boot.ts'
export default [
  {
    name: '⏳ 로더-먼저 표면을 다시 첫 화면 표면으로 좁힌다(검색·장바구니가 다시 1.1~1.5초 빈 화면)',
    file: F,
    find: '  return firstScreenApplies(pathname, ua, authed) || loaderFirstApplies(pathname)',
    replace: '  return firstScreenApplies(pathname, ua, authed)',
    test: T,
    why: '2026-11-09 실측 — HTML 은 0.3~0.5s 에 왔는데 인라인 로더조차 37KB 앱 CSS 뒤에서야 그려졌다.',
  },
  {
    name: '⏳ 첫 화면 CSS 가 없으면 앱 CSS 를 다시 렌더 차단으로(media=print 를 crit 뒤로)',
    file: F,
    find: "  rw = rw.on('link[rel=\"stylesheet\"]', {\n    element(el) { if (/^\\/assets\\/index-[^/]*\\.css$/.test(el.getAttribute('href') || '')) el.setAttribute('media', 'print') },\n  })",
    replace: "  if (crit) { rw = rw.on('link[rel=\"stylesheet\"]', {\n    element(el) { if (/^\\/assets\\/index-[^/]*\\.css$/.test(el.getAttribute('href') || '')) el.setAttribute('media', 'print') },\n  }) }",
    test: T,
    why: '로더-먼저 표면에선 그게 전부다 — 이 줄이 crit 안으로 들어가면 처방이 0 이 되고 에러는 없다.',
  },
  {
    name: '⏳ 첫 화면 없는 표면에 전체판 69KB 를 다시 인라인한다',
    file: F,
    find: "  if (!k) return '' // ⏳ 2026-11-09 첫 화면이 없는 표면은 인라인할 CSS 가 없다(로더는 자기 스타일을 든다) — 전체판 69KB 를 넣지 않는다",
    replace: "  if (!k) return full",
    test: T,
    why: '검색·장바구니 HTML 이 69KB 씩 무거워진다 — 첫 바이트 뒤 첫 그림이 도로 늦어진다.',
  },
]
