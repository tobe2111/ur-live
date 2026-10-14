/**
 * 🎛️ 유어애즈 어드민 라우트 — 앞에 등록된 `/:id` 가 뒤의 고정 경로를 삼키지 않는다 〔2026-10-14〕
 *
 * ## 무엇이 틀렸나
 * 대표 지시로 네이버 카페 수집을 끄려고 `PATCH /api/admin/ads/influencer-pool/collect-gates {cafe:false}` 를
 * 보냈더니 `{"error":"잘못된 ID"}` 가 왔다. 같은 마운트에서 **먼저 등록된** `PATCH /influencer-pool/:id` 가
 * `collect-gates` 를 id 로 받아 숫자가 아니라고 거절한 것이다. Hono 는 등록 순서대로 맞춘다.
 * ⇒ 어드민 화면의 카페 원클릭 토글(`CafeTrackToggle`)은 **만들어진 날부터 한 번도 저장되지 않았다**.
 *   GET 은 같은 자리에 `/:id` 가 없어 멀쩡히 응답했으니, 화면은 늘 정상처럼 보였다.
 *
 * ## 이 시험이 잠그는 것
 * `/api/admin/ads` 아래 모든 라우트를 **실제 마운트 순서대로** 펼쳐서, 고정 경로마다 그보다 앞에 등록된
 * 같은 메서드의 동적 경로가 그것을 먼저 맞추지 않는지 본다(`:id{[0-9]+}` 처럼 제약이 있으면 그 제약으로 판정).
 *
 * ## 못 막는 것
 * - 이 네 파일 밖에서 같은 접두로 마운트한 라우트.
 * - 템플릿 문자열·변수로 조립한 경로.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const DIR = 'src/features/marketing/api/'
const read = (f: string) => readFileSync(DIR + f, 'utf8')

/** 모듈 변수명 → 파일. `app.route('/', X)` 를 만나면 그 자리에 X 의 라우트를 끼워 넣는다. */
const MODULES: Record<string, string> = {
  adminAdsInfluencerRoutes: 'admin-ads-influencers.routes.ts',
  adminAdsPoolOpsRoutes: 'admin-ads-pool-ops.routes.ts',
  adminAdsCollectGatesRoutes: 'admin-ads-collect-gates.routes.ts',
  poolReadRoutes: 'pool-timeline.routes.ts',
}

type Route = { method: string; path: string; file: string }

function expand(file: string): Route[] {
  const out: Route[] = []
  const rx = /^\s*[A-Za-z]+\.(get|post|patch|put|delete)\('([^']+)'|^\s*app\.route\('\/',\s*([A-Za-z]+)\)/
  for (const line of read(file).split('\n')) {
    const m = rx.exec(line)
    if (!m) continue
    if (m[3]) { if (MODULES[m[3]]) out.push(...expand(MODULES[m[3]])) }
    else out.push({ method: m[1], path: m[2], file })
  }
  return out
}

/** 라우트 패턴 → 정규식. `:x` 는 한 구간, `:x{re}` 는 그 정규식. */
function toRegex(path: string): RegExp {
  const parts = path.split('/').map((seg) => {
    const p = /^:[A-Za-z_]+(?:\{(.+)\})?$/.exec(seg)
    if (!p) return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return p[1] ? `(?:${p[1]})` : '[^/]+'
  })
  return new RegExp(`^${parts.join('/')}$`)
}
const isStatic = (p: string) => !p.includes(':') && !p.includes('*')

const ROUTES = expand('admin-ads.routes.ts')

describe('유어애즈 어드민 — 고정 경로가 앞의 동적 경로에 삼켜지지 않는다', () => {
  it('펼친 라우트가 비어 있지 않다(헛도는 가드 방지)', () => {
    expect(ROUTES.length).toBeGreaterThan(40)
    expect(ROUTES.some((r) => r.path === '/influencer-pool/collect-gates' && r.method === 'patch')).toBe(true)
    expect(ROUTES.some((r) => r.path.startsWith('/influencer-pool/:id') && r.method === 'patch')).toBe(true)
  })

  it('카페 원클릭 토글 PATCH 가 /:id 에 먹히지 않는다', () => {
    const idx = ROUTES.findIndex((r) => r.method === 'patch' && r.path === '/influencer-pool/collect-gates')
    const shadow = ROUTES.slice(0, idx).find((r) => r.method === 'patch' && toRegex(r.path).test('/influencer-pool/collect-gates'))
    expect(shadow, shadow && `${shadow.file} ${shadow.method} ${shadow.path}`).toBeUndefined()
  })

  it('풀 바로 아래 id 라우트(PATCH·DELETE)는 숫자만 받는다 — 같은 접두에 고정 경로가 계속 생긴다', () => {
    const ids = ROUTES.filter((r) => /^\/influencer-pool\/:id(\{[^}]*\})?$/.test(r.path))
    expect(ids.map((r) => r.method).sort()).toEqual(['delete', 'patch'])
    for (const r of ids) expect(r.path, `${r.method} ${r.path}`).toBe('/influencer-pool/:id{[0-9]+}')
  })

  it('모든 고정 경로 — 앞에 등록된 같은 메서드의 동적 경로가 먼저 맞추지 않는다', () => {
    const bad: string[] = []
    ROUTES.forEach((r, i) => {
      if (!isStatic(r.path)) return
      const s = ROUTES.slice(0, i).find((e) => e.method === r.method && !isStatic(e.path) && toRegex(e.path).test(r.path))
      if (s) bad.push(`${r.method.toUpperCase()} ${r.path} (${r.file}) ← ${s.path} (${s.file})`)
    })
    expect(bad).toEqual([])
  })
})
