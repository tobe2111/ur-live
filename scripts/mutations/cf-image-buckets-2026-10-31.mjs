/**
 * 🧬 주입 — 사진 변환 칸 묶기(2026-10-31). 가드: src/tests/unit/cf-image-buckets-2026-10-31.test.ts
 */
const T = 'src/tests/unit/cf-image-buckets-2026-10-31.test.ts'
export default [
  {
    name: '변환 칸 — 묶기를 뺀다',
    file: 'src/utils/cf-image.ts',
    find: '  opts = snapResizeOptions(opts)',
    replace: '  opts = { ...opts }',
    test: T,
    why: '폭 40가지가 그대로 나가 한 사진이 여러 번 세어지고 무료 한도(월 5,000)를 넘긴다.',
  },
  {
    name: '변환 칸 — srcset 기본을 3x 로 되돌린다',
    file: 'src/utils/cf-image.ts',
    find: 'baseWidth: number, maxDpr: 1 | 2 | 3 = 2): string {',
    replace: 'baseWidth: number, maxDpr: 1 | 2 | 3 = 3): string {',
    test: T,
    why: '3x 후보는 사진마다 변환을 하나 더 만들어 한도만 쓴다.',
  },
]
