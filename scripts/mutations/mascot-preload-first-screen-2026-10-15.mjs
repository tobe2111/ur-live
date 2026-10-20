// 🦦 2026-10-15 — 첫 화면 표면에서 유달이 preload 를 지우는 재작성기 (css-first-boot.ts)
export default [
  {
    name: '🦦 유달이 preload 제거가 엉뚱한 주소를 겨눈다(아무것도 안 지움)',
    file: 'src/worker/utils/css-first-boot.ts',
    find: 'link[rel="preload"][href="${UDAL_LOADER_SRC}"]',
    replace: 'link[rel="preload"][href="/assets/none.webp"]',
    test: 'src/tests/unit/mascot-preload-first-screen-2026-10-15.test.ts',
    why: '첫 화면 표면에서 유달이가 다시 최우선으로 회선을 나눠 쓴다',
  },
]
