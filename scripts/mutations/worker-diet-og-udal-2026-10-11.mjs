/**
 * 🧬 주입 — 공유 카드 유달이를 워커 번들 밖(정적 파일)으로 (2026-10-11 배포 막힘: 워커 압축 1MB 게이트)
 */
const T = 'src/tests/unit/udal-touchpoints-2026-10-09.test.tsx'
export default [
  {
    name: '워커다이어트 — 유달이 정적 파일 경로를 틀린다(카드에서 유달이가 조용히 빠진다)',
    file: 'src/worker/utils/og-udal-png.ts',
    find: "export const UDAL_OG_PNG_PATH = '/static/og/udal-share-168.png'",
    replace: "export const UDAL_OG_PNG_PATH = '/og/udal.png'",
    test: T,
    why: '없는 경로를 읽으면 SPA 폴백 HTML 이 오고, 에러 없이 유달이 빠진 카드가 나간다.',
  },
  {
    name: '워커다이어트 — PNG 서명 검사를 지운다(HTML 을 그림으로 박는다)',
    file: 'src/worker/utils/og-udal-png.ts',
    find: 'if (buf.byteLength < 100 || sig[0] !== 0x89 || sig[1] !== 0x50) return null',
    replace: 'void sig',
    test: T,
    why: 'ASSETS 가 404 대신 index.html 을 주면 그 HTML 을 PNG data URI 로 카드에 박아 깨진 그림이 나간다.',
  },
  {
    name: '워커다이어트 — 라우트가 유달이를 안 넘긴다',
    file: 'src/worker/routes/og-image.routes.ts',
    find: 'const svg = generatePassCardSVG(product, photoUri, udalUri)',
    replace: 'const svg = generatePassCardSVG(product, photoUri)',
    test: T,
    why: '공유 카드에서 유달이가 사라진다(대표 확정 시안 ②).',
  },
]
