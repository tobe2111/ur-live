/**
 * ⚡ **인플루언서 풀 첫 페인트에서 224KB 를 빼낸다** — 2026-08-05 대표 *"로딩이 너무 느린데"*.
 *
 * ## 실측 (라이브)
 *   `/stats` 1.10s·8.8KB · `/influencer-pool?limit=50` 0.73s·86KB · **`/keywords` 0.47s·224KB**
 *   → 첫 로딩 310KB 중 **72% 가 키워드**인데, 그걸 쓰는 `KeywordManager` 는 **접힌 `<details>`** 라
 *   열기 전엔 본문도 안 그린다. 대부분의 방문에서 받아 파싱만 하고 버렸다
 *   (서버 SELECT 가 `LIMIT 1000` 이라 비활성 키워드까지 전부 온다).
 *
 * ## 여기서 고정하는 것
 *   ① 마운트는 **통계만** 받는다 ② 키워드는 **처음 펼칠 때** ③ 정비 폴링(10초)도 통계만
 *   — ③ 이 빠지면 정비 중 224KB 를 10초마다 다시 받는다(느려진 이유가 다시 생긴다).
 *
 * ⚠️ 못 보는 것: 실제 체감 속도. 그건 배포 후 라이브에서만 판정된다(이 환경엔 그 화면이 없다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const PAGE = code(read('src/pages/admin/AdminInfluencerPoolPage.tsx'))
const MGR = code(read('src/pages/admin/influencer-pool/KeywordManager.tsx'))
// 🔁 2026-08-05: 로더 3종이 페이지 600줄 래칫으로 훅(usePoolMeta)으로 옮겨졌다. 불변식은 그대로 — 보는 위치만 이동.
const HOOK = code(read('src/pages/admin/influencer-pool/usePoolMeta.ts'))

describe('첫 페인트 — 키워드 224KB 를 받지 않는다', () => {
  it('🔒 마운트 이펙트는 통계만 부른다', () => {
    expect(PAGE).toMatch(/useEffect\(\(\) => \{ loadStats\(\) \}, \[loadStats\]\)/)
    // 🚫 회귀 형태: 마운트에서 loadMeta(통계+키워드)를 부르면 224KB 가 첫 페인트로 돌아온다.
    expect(PAGE).not.toMatch(/useEffect\(\(\) => \{ loadMeta\(\) \}, \[loadMeta\]\)/)
  })

  it('🔒 통계와 키워드가 분리된 함수다 — 한 덩어리면 나눠 부를 수 없다', () => {
    expect(HOOK).toMatch(/const loadStats = useCallback/)
    expect(HOOK).toMatch(/const loadKeywords = useCallback/)
    // 페이지는 그 훅을 실제로 쓴다 — 훅만 있고 안 부르면 아무 효과가 없다.
    expect(PAGE).toMatch(/usePoolMeta\(applyMeta\)/)
  })

  it('🔒 정비 폴링(10초)은 통계만 — 아니면 224KB 를 10초마다 다시 받는다', () => {
    expect(PAGE).toMatch(/setInterval\(\(\) => \{ void loadStats\(\) \}, 10_000\)/)
  })

  it('🔒 키워드 편집 뒤에는 둘 다 다시 받는다(분류 통계도 같이 바뀐다)', () => {
    expect(HOOK).toMatch(/const loadMeta = useCallback\(async \(\) => \{ await Promise\.all\(\[loadStats\(\), loadKeywords\(\)\]\) \}/)
    expect(PAGE).toMatch(/onChanged=\{loadMeta\}/)
  })
})

describe('패널 — 열 때 받아오고, 그 전엔 개수를 속이지 않는다', () => {
  it('🔒 처음 펼칠 때 한 번만 가져온다', () => {
    expect(PAGE).toMatch(/onFirstOpen=\{loadKeywords\}/)
    expect(MGR).toMatch(/if \(o && !fetched\) \{ setFetched\(true\); void onFirstOpen\?\.\(\) \}/)
  })

  it('🔒 받기 전에는 "활성 0" 을 보여주지 않는다 — 키워드가 사라진 걸로 읽힌다', () => {
    expect(MGR).toMatch(/fetched \? `[^`]*활성 \$\{activeCount\}/)
  })
})
