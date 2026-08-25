/**
 * 💾 **어드민 설정 저장이 페이로드 크기 때문에 죽지 않는가** (2026-08-25 신설 — 실제 사고)
 *
 * ## 무엇이 있었나
 *
 * 대표가 `/admin/platform-settings` 에서 Cloudflare 토큰을 넣는데 **무엇을 해도 "저장 실패"** 였다.
 * 값이 틀린 게 아니었다 — **페이로드가 커서** 였다.
 *
 * 이 폼은 서버가 준 `platform_settings` **전체**로 시드된다. 그런데 그 테이블엔 설정이 아닌 행이
 * 잔뜩 있다: `cron_hb:*` 하트비트만 **129개**, `backup_chunk:*` 커서 등 — 200행대. 저장 시
 * 그 전부를 PUT 했고, 서버는 키 하나당 D1 write 를 **순차로** 돌렸다. 무료 플랜은 인보케이션당
 * 서브리퀘스트가 50 이고 D1 호출도 거기 센다 ⇒ 매번 한도에서 끊겨 **한 줄도 저장되지 않았다.**
 *
 * 무서운 건 이게 **어느 날 갑자기 생긴 선이 아니라는 것**이다. 하트비트가 하나씩 쌓이다 50을 넘는
 * 순간부터 페이지가 조용히 먹통이 됐다. 에러 로그도, 실패 알림도 없다 — 화면의 "저장 실패" 넉 자뿐.
 *
 * ## 두 겹으로 막는다
 *  1. **호출부** — 바뀐 키만 보낸다(보통 1~3개).
 *  2. **서버** — `batch()` 로 왕복 1회. 호출부가 또 커져도 크기에 목숨을 걸지 않는다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * 실제 서브리퀘스트 회계는 Workers 런타임에만 있다. 여기서는 *구조*(diff · batch)만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildSettingsPayload, CREDENTIAL_KEYS } from '../../pages/AdminPlatformSettingsPage'

/** 라이브를 닮은 스냅샷 — 하트비트가 대부분이고 진짜 설정은 몇 개뿐이다. */
function liveLikeSnapshot(): Record<string, string> {
  const snap: Record<string, string> = {
    commission_rate_default: '5',
    pg_reserve_pct: '2.5',
    cf_api_token: 'old-token-2254',
    cf_account_id: 'acct-1',
  }
  for (let i = 0; i < 129; i++) snap[`cron_hb:job-${i}`] = `{"at":"2026-08-25T00:0${i % 10}:00Z"}`
  for (let i = 0; i < 6; i++) snap[`backup_chunk:db-${i}`] = `{"tableIndex":${i}}`
  return snap
}

describe('💾 설정 저장 — 바뀐 키만 나간다', () => {
  it('한 칸만 고치면 **한 키만** 나간다 (139행이 아니라)', () => {
    const base = liveLikeSnapshot()
    const settings = { ...base, commission_rate_default: '7' }
    const { payload } = buildSettingsPayload(settings, base)
    expect(Object.keys(payload)).toEqual(['commission_rate_default'])
  })

  it('🔴 무료 플랜 서브리퀘스트 한도(50) 아래로 유지된다', () => {
    const base = liveLikeSnapshot()
    // 스냅샷 자체가 한도의 두 배가 넘는다 — 전체를 보내던 예전 코드가 왜 죽었는지가 여기 있다.
    expect(Object.keys(base).length, '픽스처가 한도보다 작다 — 이 시험이 헛돈다').toBeGreaterThan(100)
    const { payload } = buildSettingsPayload({ ...base, pg_reserve_pct: '3' }, base)
    expect(Object.keys(payload).length).toBeLessThan(50)
  })

  it('아무것도 안 고치면 **빈 페이로드** — 요청 자체를 안 보낸다', () => {
    const base = liveLikeSnapshot()
    const { payload } = buildSettingsPayload({ ...base }, base)
    expect(Object.keys(payload)).toEqual([])
  })

  it('🔑 자격: 새 값을 넣으면 나가고, 빈 칸이면 안 나간다 (빈 값 = 토큰 삭제)', () => {
    const base = liveLikeSnapshot()
    const typed = buildSettingsPayload({ ...base, cf_api_token: 'new-token-9999' }, base)
    expect(typed.payload.cf_api_token).toBe('new-token-9999')
    expect(typed.creds).toContain('API 토큰')

    // '교체' 를 눌러 칸만 열어 둔 상태 — 저장해도 자격은 건드리지 않는다.
    const blanked = buildSettingsPayload({ ...base, cf_api_token: '' }, base)
    expect(blanked.payload, '빈 값이 나가면 저장돼 있던 토큰이 지워진다').not.toHaveProperty('cf_api_token')
    expect(blanked.creds).toEqual([])
  })

  it('자격 키를 안 고쳤으면 되쓰지 않는다 (스냅샷과 같으면 제외)', () => {
    const base = liveLikeSnapshot()
    const { payload, creds } = buildSettingsPayload({ ...base }, base)
    for (const k of CREDENTIAL_KEYS) expect(payload).not.toHaveProperty(k)
    expect(creds).toEqual([])
  })

  it('🔴 서버가 키당 왕복이 아니라 batch 로 쓴다', () => {
    const routes = readFileSync('src/features/admin/api/admin-tools.routes.ts', 'utf8')
    const put = routes.slice(routes.indexOf("adminToolsRoutes.put('/settings'"))
    const body = put.slice(0, put.indexOf('adminToolsRoutes.get(') + 1 || put.length)
    expect(body.length, '핸들러를 못 찾았다 — 이 시험이 헛돈다').toBeGreaterThan(200)
    expect(body, 'batch 를 안 쓴다 — 큰 저장에서 다시 죽는다').toMatch(/DB\.batch\(/)
    expect(body, '아직 키당 순차 write 다')
      .not.toMatch(/for \(const \[key, value\] of Object\.entries\(body\)\)[\s\S]{0,200}?\.run\(\)/)
  })
})
