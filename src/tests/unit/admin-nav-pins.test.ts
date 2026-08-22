/**
 * ⭐ 어드민 즐겨찾기 영속 (2026-08-22 대표 신고 "즐겨찾기가 계속 초기화 돼")
 *
 * 원인은 저장 **위치**였다. localStorage 는 오리진·브라우저·프로필마다 따로이고
 * 시크릿창·"사이트 데이터 지우기"·기기 변경·도메인 전환에 조용히 사라진다.
 * 게다가 최초 진입의 기본값 시드가 **저장되지 않아서**, 저장소가 비는 순간 항상 기본 4개로
 * 돌아갔다 — 그게 "초기화"의 모습이다.
 *
 * 그래서 이 테스트가 지키는 것은 "코드가 예쁘다"가 아니라 **저장이 계정에 붙어 있는가**다.
 * 이 파일이 초록인데도 대표가 또 초기화를 겪는다면, 원인은 저장이 아니라 **읽기**(하이드레이트
 * 실패를 조용히 삼키는 자리)이니 그쪽을 볼 것.
 *
 * 못 막는 것: 실제 D1 쓰기·읽기(런타임), 그리고 네트워크 실패 시의 사용자 체감.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isSelfServiceAdminPath } from '../../shared/admin-roles'

const read = (p: string) => readFileSync(p, 'utf-8')
const LAYOUT = 'src/components/AdminLayout.tsx'
const ROUTES = 'src/features/auth/api/admin.routes.ts'
const PREFS = 'src/worker/utils/admin-prefs.ts'
const REPAIR = 'src/worker/routes/repair-schema.routes.ts'

describe('즐겨찾기는 계정에 저장된다 (localStorage 단독 금지)', () => {
  it('클라가 서버에 저장한다 — 토글이 localStorage 로만 끝나지 않는다', () => {
    const s = read(LAYOUT)
    expect(s, 'persistPins 가 사라졌다').toContain('const persistPins =')
    expect(s).toMatch(/api\.put\(\s*'\/api\/admin\/me\/prefs\/nav_pins'/)
    // togglePin 이 persistPins 를 거치지 않고 직접 setItem 만 하면 원래 버그로 복귀.
    const toggle = s.slice(s.indexOf('const togglePin ='), s.indexOf('const isPinned ='))
    expect(toggle).toContain('persistPins(next)')
    expect(toggle, 'togglePin 이 다시 localStorage 단독 저장으로 돌아갔다').not.toContain('localStorage.setItem')
  })

  it('서버 값으로 하이드레이트한다 (다른 기기에서도 따라온다)', () => {
    const s = read(LAYOUT)
    expect(s).toMatch(/api\s*\n?\s*\.get<[^>]*>\('\/api\/admin\/me\/prefs\/nav_pins'\)/)
  })

  it('서버에 없으면 현재 값을 승격 저장한다 — 시드 미저장이 초기화의 절반이었다', () => {
    const s = read(LAYOUT)
    const hydrate = s.slice(s.indexOf("prefs/nav_pins'"), s.indexOf('const togglePin ='))
    expect(hydrate, '최초 진입 시 승격 저장이 없다 — 저장소가 비면 매번 기본값으로 돌아간다').toContain(
      'persistPins(prev)',
    )
  })

  it('조회 실패가 대시보드를 막지 않는다 (fail-soft)', () => {
    const s = read(LAYOUT)
    const hydrate = s.slice(s.indexOf("prefs/nav_pins'"), s.indexOf('const togglePin ='))
    expect(hydrate).toContain('.catch(')
  })

  it('저장소가 비어도 기본값으로 시작한다 (파싱 실패 시 빈 배열 금지)', () => {
    const s = read(LAYOUT)
    const init = s.slice(s.indexOf('const [pinnedPaths'), s.indexOf('const pinsHydrated'))
    expect(init).toContain('return DEFAULT_PINS')
    // 예전엔 catch 에서 [] 를 돌려줘 즐겨찾기 섹션이 통째로 사라졌다.
    expect(init).not.toMatch(/catch\s*\{\s*return \[\]\s*\}/)
  })
})

describe('서버 라우트 — 본인 것만, 형태 강제', () => {
  it('대상 admin_id 를 바디/쿼리에서 받지 않는다 (IDOR)', () => {
    const s = read(ROUTES)
    const block = s.slice(s.indexOf("adminRoutes.get('/me/prefs/:key'"))
    expect(block).toContain("get('user')")
    expect(block, '요청에서 admin_id 를 읽으면 남의 설정을 건드릴 수 있다').not.toMatch(
      /body\.admin_id|req\.query\('admin_id'\)/,
    )
  })

  it('키는 화이트리스트 (임의 키 저장 금지)', () => {
    const s = read(ROUTES)
    expect(s).toContain('parsePrefKey')
    expect(read(PREFS)).toContain('ADMIN_PREF_KEYS')
  })

  it('nav_pins 형태를 서버가 강제한다 (다음 로드에서 렌더가 터지지 않게)', () => {
    const s = read(ROUTES)
    const put = s.slice(s.indexOf("adminRoutes.put('/me/prefs/:key'"))
    expect(put).toContain('Array.isArray(value)')
    expect(put).toMatch(/startsWith\('\/admin'\)/)
    expect(put).toMatch(/value\.length > 40/)
  })

  it('값 크기 상한이 있다 (무한 성장 차단)', () => {
    expect(read(ROUTES)).toContain('ADMIN_PREF_MAX_BYTES')
    expect(read(PREFS)).toMatch(/ADMIN_PREF_MAX_BYTES\s*=\s*\d+/)
  })

  it('per-request DDL 금지 — ensure 는 인스턴스당 1회', () => {
    expect(read(PREFS)).toContain('WeakSet')
  })

  it('테이블이 repair-schema 에 등록돼 있다 (마이그레이션 CI 미작동)', () => {
    expect(read(REPAIR)).toContain("{ name: 'admin_prefs'")
  })
})

describe('RBAC — 개인 설정은 역할과 무관하다', () => {
  it('읽기전용(viewer) 도 자기 메뉴는 고정할 수 있다', () => {
    expect(isSelfServiceAdminPath('/api/admin/me/prefs/nav_pins')).toBe(true)
  })

  it('`me` 세그먼트를 통째로 열지 않는다 (미래 라우트의 RBAC 우회 방지)', () => {
    expect(isSelfServiceAdminPath('/api/admin/me/impersonate')).toBe(false)
    expect(isSelfServiceAdminPath('/api/admin/me')).toBe(false)
    expect(isSelfServiceAdminPath('/api/admin/me/prefs/nav_pins/../../users')).toBe(false)
  })

  it('기존 self-service(보안 PIN·2FA)는 그대로 열려 있다', () => {
    expect(isSelfServiceAdminPath('/api/admin/set-login-pin')).toBe(true)
    expect(isSelfServiceAdminPath('/api/admin/2fa/setup')).toBe(true)
    expect(isSelfServiceAdminPath('/api/admin/users')).toBe(false)
  })
})
