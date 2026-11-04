/** 🧬 주입 — 견적 공유 카톡 카드(2026-11-04). 가드: src/tests/unit/life-share-2026-10-25.test.ts */
const TEST = 'src/tests/unit/life-share-2026-10-25.test.ts'
export default [
  {
    name: '🔗 견적 공유 카드가 다시 문자열 시드를 못 읽는다(라이브 카톡 카드 = 유어딜 홈)',
    file: 'src/worker/utils/life-share-ssr.ts',
    find: "  if (typeof payload !== 'string') return payload\n  try { return JSON.parse(payload) } catch { return null }",
    replace: '  return payload',
    test: TEST,
    why: '워커는 시드를 JSON 문자열로 넘긴다 — 못 풀면 카드가 조용히 기본값으로 나간다(2026-10-25~11-04 실제로 그랬다).',
  },
  {
    name: '🔗 견적 공유 카드에 사진이 안 실린다',
    file: 'src/shared/home-service-share.ts',
    find: 'photos = all.filter(isRequestPhotoUrl).slice(0, SHARE_PHOTOS_MAX)',
    replace: 'photos = []',
    test: TEST,
    why: '대표 "사진도 말이야".',
  },
]
