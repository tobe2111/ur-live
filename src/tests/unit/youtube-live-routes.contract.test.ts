import { describe, it, expect } from 'vitest'
import { youtubeLiveRoutes } from '@/features/youtube/api/youtube-live.routes'

/**
 * 🛡️ 2026-06-01 (c) God 파일 분해 0단계 — 라이브 라우트 인벤토리 계약 테스트.
 *
 * 배경: 2026-05-12 사고 — youtube-live.routes.ts(라이브 송출 핵심) 가 전체 덮어쓰기로
 *   날아가 `// PLACEHOLDER` 2줄만 남고 라이브 API 전부 404 → 셀러 방송 시작 불가(운영 중단).
 *   tsc/build 는 통과해서 못 잡았음.
 *
 * 이 테스트는 라우터가 노출하는 엔드포인트 집합을 고정(SSOT)한다:
 *   - 파일이 비거나 핸들러가 사라지면 즉시 실패 (사고 재현 차단)
 *   - 3369줄 파일을 sub-route 로 분해할 때, 분해 전/후 공개 라우트 표면이 동일함을 보장
 *     (분해는 이 테스트가 green 인 상태에서만 안전)
 *
 * 라우트를 의도적으로 추가/제거할 때만 이 목록을 갱신할 것.
 */

const EXPECTED_ROUTES = [
  'DELETE /streaming/whip-proxy-ome/:streamId',
  'DELETE /streaming/whip-proxy/:streamId',
  'GET /live-readiness',
  'GET /live/:id/chat',
  'GET /live/:id/detect-webcam',
  'GET /live/:id/diagnose',
  'GET /live/:id/status',
  'GET /live/:id/youtube-stats',
  'GET /live/_admin-quota-dashboard',
  'GET /live/_health-check',
  'GET /live/_quota',
  'GET /streaming-setup',
  'GET /streaming/health',
  'PATCH /live/:id/link-broadcast',
  'PATCH /streaming/whip-proxy-ome/:streamId',
  'POST /admin/rotate-all-stream-keys',
  'POST /live/:id/_force-live',
  'POST /live/:id/admin-force-end',
  'POST /live/:id/end',
  'POST /live/:id/end-beacon',
  'POST /live/:id/force-transition',
  'POST /live/:id/notify-followers',
  'POST /live/:id/refresh-thumbnail',
  'POST /live/:id/reset-zombie',
  'POST /live/:id/start',
  'POST /live/_cleanup-pushes',
  'POST /live/_verify-whip-proxy',
  'POST /live/create',
  'POST /live/create-webcam',
  'POST /rotate-stream-key',
  'POST /streaming-setup/init',
  'POST /streaming/whip-proxy-ome/:streamId',
  'POST /streaming/whip-proxy/:streamId',
  'POST /streaming/whip-token',
] as const

// 손실 시 = 서비스 중단인 방송 생명주기 핵심 (절대 사라지면 안 됨)
const CRITICAL_LIFECYCLE = [
  'POST /live/create',
  'POST /live/create-webcam',
  'POST /live/:id/start',
  'GET /live/:id/status',
  'POST /live/:id/end',
  'PATCH /live/:id/link-broadcast',
  'GET /live/:id/chat',
] as const

function mountedRoutes(): Set<string> {
  const routes = (youtubeLiveRoutes as unknown as { routes: { method: string; path: string }[] }).routes
  return new Set(routes.map((r) => `${r.method} ${r.path}`))
}

describe('youtube-live 라우트 인벤토리 계약', () => {
  it('방송 생명주기 핵심 엔드포인트가 전부 마운트되어 있다', () => {
    const mounted = mountedRoutes()
    for (const r of CRITICAL_LIFECYCLE) {
      expect(mounted.has(r), `핵심 라우트 누락: ${r} (라이브 송출 중단 위험)`).toBe(true)
    }
  })

  it('기대 라우트 집합이 모두 존재한다 (핸들러 소실 차단)', () => {
    const mounted = mountedRoutes()
    const missing = EXPECTED_ROUTES.filter((r) => !mounted.has(r))
    expect(missing, `사라진 라우트: ${missing.join(', ')}`).toEqual([])
  })

  it('라우트 수가 최소 기대치 이상이다 (대량 삭제/파일 소실 차단)', () => {
    expect(mountedRoutes().size).toBeGreaterThanOrEqual(EXPECTED_ROUTES.length)
  })
})
