import { describe, it, expect } from 'vitest'
import { readCode, sliceFrom } from '../helpers/source-text'
import {
  REQUEST_SKEW_MS, REFRESH_BEFORE_EXPIRY_MS,
  decodeJwtExpMs, needsPreemptiveRefresh, dashboardRefreshUrl, dashboardTokenKeys,
  isDashboardRefreshUrl,
} from '@/lib/dashboard-token'
import { errorCode } from '@/utils/api-error-code'

/**
 * 🔑 2026-09-23 — 대표 콘솔 실측 두 건의 회귀 가드.
 *
 * ① 어드민 재방문 첫 화면에 401 이 일곱 개: 만료된 access 토큰을 그대로 붙여 보내고 **서버가 거절한
 *    뒤에야** 갱신했다. 고치는 자리는 훅이 아니라 **요청 인터셉터**다(React 가 자식 effect 를 먼저
 *    돌리므로 부모 레이아웃의 훅은 자식 쿼리보다 절대 먼저 못 뛴다).
 * ② `PATCH /sellers/24/approve` 400: 이미 승인된 매장인데 **목록이 낡아** 그 줄이 남아 있었다.
 *
 * ⚠️ 이 파일이 **못 보는 것**: 실제 네트워크 왕복 수(브라우저에서 재야 한다) · React effect 순서 ·
 *    토스트가 실제로 뜨는 모양. 여기서 고정하는 것은 *판정 규칙*과 *배선* 뿐이다.
 */

const NOW = 1_800_000_000_000
const b64u = (o: object) =>
  btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (expMs: number) => `${b64u({ alg: 'HS256' })}.${b64u({ exp: Math.floor(expMs / 1000) })}.sig`

describe('① 토큰 신선도 판정 (순수)', () => {
  it('JWT exp 를 ms 로 읽는다', () => {
    expect(decodeJwtExpMs(jwt(NOW))).toBe(NOW)
  })

  it('🔒 디코드 불가·부재 토큰은 null — 모르는 세션을 건드리지 않는다', () => {
    expect(decodeJwtExpMs(null)).toBeNull()
    expect(decodeJwtExpMs('')).toBeNull()
    expect(decodeJwtExpMs('not-a-jwt')).toBeNull()
    expect(decodeJwtExpMs('a.@@@@.c')).toBeNull()
    expect(decodeJwtExpMs(`${b64u({ alg: 'HS256' })}.${b64u({ sub: 'x' })}.sig`)).toBeNull()
  })

  it('🔒 만료된 토큰은 보내기 전에 갈아야 한다 (= 이 사건의 본체)', () => {
    expect(needsPreemptiveRefresh(NOW - 1, NOW)).toBe(true)
    expect(needsPreemptiveRefresh(NOW - 24 * 3_600_000, NOW)).toBe(true)
  })

  it('🔒 살아 있는 토큰은 안 건드린다 — 요청마다 갱신하면 refresh 호출만 는다', () => {
    expect(needsPreemptiveRefresh(NOW + 60_000, NOW)).toBe(false)
    expect(needsPreemptiveRefresh(NOW + REQUEST_SKEW_MS + 1, NOW)).toBe(false)
  })

  it('요청 직전 여유는 좁다(10초) — 보내는 사이에 죽을 토큰만 막는다', () => {
    expect(REQUEST_SKEW_MS).toBe(10_000)
    expect(needsPreemptiveRefresh(NOW + REQUEST_SKEW_MS, NOW)).toBe(true)
  })

  it('훅의 예약 창(5분)을 인자로 넘기면 그 창으로 판정한다', () => {
    expect(REFRESH_BEFORE_EXPIRY_MS).toBe(5 * 60 * 1000)
    expect(needsPreemptiveRefresh(NOW + 4 * 60_000, NOW, REFRESH_BEFORE_EXPIRY_MS)).toBe(true)
    expect(needsPreemptiveRefresh(NOW + 6 * 60_000, NOW, REFRESH_BEFORE_EXPIRY_MS)).toBe(false)
  })

  it('🔒 판단 불가(null exp)는 false — 레거시/비-JWT 세션을 임의로 갱신하지 않는다', () => {
    expect(needsPreemptiveRefresh(null, NOW)).toBe(false)
  })

  it('역할별 엔드포인트·저장소 키가 어긋나지 않는다', () => {
    expect(dashboardRefreshUrl('admin')).toBe('/api/admin/refresh')
    expect(dashboardRefreshUrl('seller')).toBe('/api/seller/refresh')
    expect(dashboardRefreshUrl('agency')).toBe('/api/agency/refresh')
    expect(dashboardTokenKeys('admin')).toEqual({ token: 'admin_token', refresh: 'admin_refresh_token' })
    expect(dashboardTokenKeys('seller')).toEqual({ token: 'seller_token', refresh: 'seller_refresh_token' })
  })

  it('🔒 refresh 엔드포인트 자신은 사전 갱신 대상에서 제외 — 자기를 기다리는 모양 방지', () => {
    expect(isDashboardRefreshUrl('/api/admin/refresh')).toBe(true)
    expect(isDashboardRefreshUrl('/api/seller/refresh?x=1')).toBe(true)
    expect(isDashboardRefreshUrl('/api/agency/refresh')).toBe(true)
    expect(isDashboardRefreshUrl('/api/admin/refresh-token-list')).toBe(false)
    expect(isDashboardRefreshUrl('/api/admin/sellers')).toBe(false)
  })
})

describe('① 배선 — 요청 인터셉터가 살아 있는 토큰을 붙인다', () => {
  const api = readCode('src/lib/api.ts')

  it('🔒 대시보드 토큰을 붙이는 자리는 전부 ensureFreshDashboardToken 을 거친다', () => {
    // localStorage 에서 곧바로 꺼내 헤더에 붙이면 만료 토큰이 그대로 나간다(= 401 일곱 개).
    expect(api).not.toMatch(/Bearer \$\{localStorage\.getItem\((['"])(admin|seller|agency)_token\1\)/)
    // 분기마다 따로 본다 — 총 개수만 세면 한 곳이 옛 동작으로 돌아가도 남은 것들이 가려 준다.
    //   (첫 판이 실제로 그랬고 주입 러너가 잡았다.)
    for (const anchor of [
      "if (/^\\/api\\/admin[-/]/.test(url)) {",            // 대표의 401 일곱 개가 지나간 분기
      "if (/^\\/api\\/[a-z0-9-]+\\/admin(\\/|$)/.test(url)) {",
      "if (url.startsWith('/api/_errors/recent')",
      "if (url.startsWith('/api/seller/')",
    ]) {
      expect(sliceFrom(api, anchor, 'return config;'), anchor)
        .toMatch(/const token = await ensureFreshDashboardToken\(/)
    }
  })

  it('🔒 여러 역할이 섞이는 엔드포인트(알림·가이드·영입)도 예외가 아니다', () => {
    // 이 셋은 우선순위 사슬이라 정규식 한 줄로 못 잡힌다 — 분기마다 따로 고정한다.
    for (const anchor of ["url.startsWith('/api/prospects')", "url.startsWith('/api/guides/')", "url.startsWith('/api/notifications')"]) {
      const block = sliceFrom(api, anchor, 'return config;')
      expect(block, anchor).toMatch(/await ensureFreshDashboardToken\(role\)/)
      expect(block, anchor).not.toMatch(/Bearer \$\{(agency|admin|seller)Token\}/)
    }
    // 역할 선택은 '토큰이 있는가' 로만 — 만료를 여기서 거르면 갱신 가능한 세션이 비로그인으로 떨어진다.
    const pick = sliceFrom(api, 'function pickDashboardRole(', '\n}')
    expect(pick).toMatch(/if \(localStorage\.getItem\(dashboardTokenKeys\(role\)\.token\)\) return role;/)
  })

  it('🔒 refresh 요청 자신은 인터셉터에서 조기 반환', () => {
    expect(api).toMatch(/if \(isDashboardRefreshUrl\(url\)\) return config/)
  })

  it('🔒 갱신 실행부는 한 곳 — inflight 락이 갈리면 회전 토큰 경합으로 강제 로그아웃', () => {
    expect(api).toMatch(/from '\.\/dashboard-refresh'/)
    expect(api).not.toMatch(/_inflightRefresh/)            // api.ts 에 사본을 다시 만들지 말 것
    const hook = readCode('src/hooks/useTokenAutoRefresh.ts')
    expect(hook).toMatch(/ensureFreshDashboardToken\(role, REFRESH_BEFORE_EXPIRY_MS\)/)
    expect(hook).not.toMatch(/axios\.post/)                // 훅의 생 갱신 호출 부활 금지
  })

  it('🔒 2026-07-04 무한재귀 가드는 그대로 — 재스케줄은 미래 목표시각일 때만', () => {
    const hook = readCode('src/hooks/useTokenAutoRefresh.ts')
    expect(hook).toMatch(/if \(shouldRescheduleAfterAttempt\(localStorage\.getItem\(`\$\{role\}_token`\), Date\.now\(\)\)\) schedule\(\)/)
  })

  it('갱신 모듈은 락을 공유하고, 실패를 삼켜 기존 401 흐름에 맡긴다', () => {
    const refresh = readCode('src/lib/dashboard-refresh.ts')
    expect(refresh).toMatch(/if \(_inflightRefresh\[cacheKey\]\) return _inflightRefresh\[cacheKey\]!/)
    expect(refresh).toMatch(/if \(!refreshed\) return token/)
  })
})

describe('② 승인 400 — 안정적인 code + 목록 재동기화', () => {
  it('🔒 서버가 ALREADY_APPROVED 코드를 준다 (문구 매칭 금지)', () => {
    const route = readCode('src/features/admin/api/admin-sellers.routes.ts')
    const block = sliceFrom(route, "adminSellersRoutes.patch('/sellers/:id/approve'", 'prevStatus =')
    expect(block).toMatch(/code: 'ALREADY_APPROVED'/)
    expect(block).toMatch(/\}, 400\)/)
  })

  it('🔒 승인·거절 모두 성공/실패 무관하게 목록을 다시 불러온다', () => {
    const page = readCode('src/pages/AdminSellerApprovalPage.tsx')
    const approve = sliceFrom(page, 'const approve = async (id: number)', 'const reject =')
    // finally 에서 load() — 실패 때 목록이 낡은 채 남아 같은 줄을 또 누르게 되던 것이 원인이었다.
    expect(approve).toMatch(/finally \{ setActingId\(null\); load\(\) \}/)
    expect(approve).toMatch(/errorCode\(err\) === 'ALREADY_APPROVED'/)
    const reject = sliceFrom(page, 'const reject = async (id: number)', '\n  //')
    expect(reject).toMatch(/finally \{ setActingId\(null\); load\(\) \}/)
  })

  it('errorCode 는 axios 에러·응답 본문 어느 모양에서도 코드를 꺼낸다', () => {
    expect(errorCode({ response: { data: { code: 'ALREADY_APPROVED' } } })).toBe('ALREADY_APPROVED')
    expect(errorCode({ data: { code: 'X' } })).toBe('X')
    expect(errorCode({ code: 'Y' })).toBe('Y')
  })

  it('🔒 코드가 없으면 null — "실패"로 떨어져야 한다(빈 문자열도 코드가 아니다)', () => {
    expect(errorCode(null)).toBeNull()
    expect(errorCode('boom')).toBeNull()
    expect(errorCode({ response: { data: { error: '이미 승인된 판매자입니다' } } })).toBeNull()
    expect(errorCode({ response: { data: { code: '' } } })).toBeNull()
  })
})
