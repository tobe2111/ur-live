/**
 * 🐌 B2B 수집 페이지(`/admin/partner-pool`) — **화면에 없는 917KB 를 매번 받고 있었다** (2026-08-05 대표 신고).
 *
 * ## 실측 (라이브, 어드민 토큰)
 * ```
 *   /api/admin/partner-pool/meta        1.4 KB   0.60s
 *   /api/admin/partner-pool/keywords  917.0 KB   1.36s   ← 4,546개
 *   /api/admin/partner-pool/stats      17.0 KB   1.44s
 *   /api/admin/partner-pool?limit=50   38.0 KB   0.51s
 * ```
 * 키워드 패널(`CompanyKeywordManager`)은 `showOps` 안에 있고 **기본이 접힘**이다. 즉 그 917KB 는
 * **한 번도 화면에 그려지지 않은 채** 매 진입마다 전송됐다.
 *
 * 🩸 **왜 오래 안 보였나**: 렌더 쪽은 이미 최적화돼 있었다(`details` 게이트 · 상위 80 미리보기 · `useMemo`).
 *   그래서 "이 패널은 이미 최적화됨"으로 읽혔다 — 비용이 **렌더가 아니라 전송**에 있었기 때문이다.
 *   ⇒ 느린 화면을 볼 때 렌더만 보지 말고 **마운트가 실제로 받는 바이트**를 먼저 재라.
 *
 * ⚠️ **이 시험이 못 보는 것**
 * - 실제 체감 속도. 페이로드가 줄었다는 것만 코드로 고정할 수 있다.
 * - `stats`(1.44s, 서버 계산)와 `meta`(0.60s)는 그대로다 — 상단 카드가 항상 쓰므로 지연 대상이 아니다.
 * - 서버가 4,546개를 통째로 주는 것 자체는 안 고쳤다(검색이 클라이언트라 자르면 검색이 깨진다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/** 주석을 지운 사본 — **배선은 코드에서만 판정한다**(이 레포가 반복해 밟은 "주석에만 남아도 통과" 함정). */
const SRC = readFileSync(resolve(process.cwd(), 'src/pages/admin/AdminPartnerPoolPage.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('키워드 917KB 는 펼칠 때만 받는다', () => {
  it('🔒 마운트 이펙트가 키워드를 **안** 부른다 — 이게 회귀하면 917KB 가 그대로 돌아온다', () => {
    const mount = SRC.slice(SRC.indexOf('useEffect(() => { loadMeta()'), SRC.indexOf('useEffect(() => { loadMeta()') + 120)
    expect(mount, '마운트 이펙트를 못 찾았다 — 코드가 옮겨갔나(낡은 지도)').toContain('loadMeta()')
    expect(mount, '마운트에서 다시 키워드를 부른다 — 접힌 패널의 917KB 가 부활했다').not.toContain('loadKeywords')
  })

  it('🔒 펼침(showOps)에 걸려 있다', () => {
    expect(SRC).toMatch(/if \(showOps && !kwLoaded\.current\)[^\n]*loadKeywords\(\)/)
  })

  it('🔒 한 번만 받는다 — 접었다 펼 때마다 917KB 를 다시 받으면 더 나쁘다', () => {
    expect(SRC, '1회 가드(useRef)가 없다').toMatch(/const kwLoaded = useRef\(false\)/)
    expect(SRC, '플래그를 세우지 않으면 펼칠 때마다 재요청한다').toMatch(/kwLoaded\.current = true/)
  })

  it('🔒 사용자가 키워드를 바꾸면 **다시 받는다** — 지연이 갱신을 죽이면 안 된다', () => {
    expect(SRC, 'onChanged 재조회가 사라졌다 — 켜고 끈 결과가 화면에 안 보인다').toMatch(/onChanged=\{loadKeywords\}/)
  })

  it('🔒 항상 보이는 상단 카드용 요청은 지연시키지 않았다(meta·stats)', () => {
    expect(SRC).toMatch(/useEffect\(\(\) => \{ loadMeta\(\); loadStats\(\) \}/)
  })
})
