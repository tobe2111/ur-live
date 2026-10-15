// 🔁 엔트리 CSS preload 의 crossorigin(2026-10-15) — 되돌려-검증 주입.
const TEST = 'src/tests/unit/css-first-boot-2026-10-12.test.ts'

export default [
  {
    name: '🔁 엔트리 CSS preload 에서 crossorigin 을 뺀다(같은 CSS 를 두 번 받는다)',
    file: 'src/worker/utils/css-first-boot.ts',
    find: "as=style${ENTRY_CSS_CROSSORIGIN ? '; crossorigin' : ''}`)",
    replace: 'as=style`)',
    test: TEST,
    why: 'Vite 태그는 crossorigin 이라 모드가 다른 preload 는 재사용되지 않는다 — 첫 화면을 막는 37KB 를 두 번 받는다.',
  },
  {
    name: '🔁 crossorigin 스위치를 끈다(태그와 어긋난다)',
    file: 'src/worker/utils/css-first-boot.ts',
    find: 'export const ENTRY_CSS_CROSSORIGIN = true',
    replace: 'export const ENTRY_CSS_CROSSORIGIN = false',
    test: TEST,
    why: 'Vite 태그는 crossorigin 인데 스위치를 끄면 미리 받은 CSS 가 버려진다(폰트 쪽 반대 방향 주입은 2026-10-15 기기 글꼴 전환으로 대상이 사라져 이것으로 재조준).',
  },
]
