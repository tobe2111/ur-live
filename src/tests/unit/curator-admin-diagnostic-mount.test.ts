import { describe, it, expect } from 'vitest'
import { curatorRoutes } from '@/worker/routes/curator.routes'

/**
 * 🔌 2026-08-27 — 어드민 진단을 `curator.routes.ts` 밖으로 **옮긴 뒤** 그 경로가 살아 있는지.
 *
 * 파일 크기 래칫에 걸려 블록을 별도 파일로 뽑았다(rebaseline 대신 추출). 그런데 이 레포에서
 * **경로가 조용히 사라지는 사고**가 반복됐다 — 라우트를 옮기거나 중복 선언하면 빌드는 통과하고
 * 페이지만 죽는다(`check-duplicate-routes` 가 생긴 이유). 문자열 검사로는 마운트 지점(`route('/')`)
 * 이 맞는지 알 수 없으므로, **조립된 라우터에 실제로 요청을 넣어** 404 가 아님을 확인한다.
 *
 * ⚠️ 못 막는 것: 핸들러가 옳은 데이터를 주는지. 여기서 보는 건 **경로의 실재**뿐이다
 *   (인증 미들웨어가 먼저 막으므로 401/500 이 나오는 게 정상 — 404 만 아니면 된다).
 */
describe('유어샵 어드민 진단 — 분리 후에도 같은 경로에 있다', () => {
  it('GET /admin/affiliate-diagnostic 가 404 가 아니다', async () => {
    const res = await curatorRoutes.request('/admin/affiliate-diagnostic')
    expect(res.status, '마운트가 어긋나면 이 경로가 조용히 사라진다').not.toBe(404)
  })
  it('없는 경로는 404 다 (이 검사가 헛돌지 않는다는 증거)', async () => {
    const res = await curatorRoutes.request('/admin/does-not-exist-xyz')
    expect(res.status).toBe(404)
  })
})
