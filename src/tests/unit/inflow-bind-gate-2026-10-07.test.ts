/**
 * 🧹 **유입 귀속은 묶을 것이 있을 때만 보낸다** (2026-10-07)
 *
 * 대표: *"2번은 무조건 하는게 좋으면 해줘."*
 *
 * ## 무엇이 틀려 있었나 (라이브 실측)
 * `bindInflowClicksIfLoggedIn` 이 `App` 마운트마다 **무조건** POST 했다. `?ref=` 로 들어온 적이
 * 없는 계정으로 라이브를 재 보니(`urdeal.kr/map`·`/user/profile`, 유입 기록 0) 그 POST 가
 * 그대로 보였고, 변경 요청이라 **`/api/csrf-token` 까지 한 번 더** 받고 있었다:
 *
 * ```
 * +3834ms GET  /api/csrf-token
 * +3908ms POST /api/acquisition/inflow/bind      ← 묶을 행이 0인데도
 * ```
 *
 * 즉 둘러보기만 하는 로그인 사용자에게 **요청 2개 + D1 왕복**이 매 하드로드마다 공짜로 나갔다.
 * 에러가 안 나고 화면도 안 깨져서 아무도 신고하지 않는 종류다.
 *
 * ## 이 파일이 **동작**을 잰다
 * 소스 문자열이 아니라 함수를 실제로 호출한다 — 이 수리의 전부가 런타임 분기이기 때문이다
 * (2026-10-06 에 CSRF 단일비행이 *"소스엔 멀쩡한데 6회 그대로"* 였던 교훈).
 *
 * ## 못 잡는 것
 * 실제로 몇 번 나가는가는 브라우저로만 알 수 있다 — `scripts/check-duplicate-fetch.mjs` 의 몫이고,
 * 이 파일은 **분기 규칙**만 고정한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.fn((_url: string, _body?: unknown) => Promise.resolve({ data: { success: true } }))
vi.mock('@/lib/api', () => ({ default: { post } }))

// 환경은 jsdom — **진짜 localStorage** 를 쓴다(공용 setup 이 afterEach 에서 clear 한다).
const store = {
  clear: () => localStorage.clear(),
  set: (k: string, v: string) => localStorage.setItem(k, v),
  get: (k: string) => localStorage.getItem(k),
  has: (k: string) => localStorage.getItem(k) !== null,
}
beforeEach(() => {
  vi.unstubAllGlobals()
  store.clear()
  post.mockClear()
  post.mockImplementation(() => Promise.resolve({ data: { success: true } }))
})

const SENT = 'ur_inflow_sent_v1'
const BOUND = 'ur_inflow_bound_v1'

async function bind(loggedIn = true) {
  const { bindInflowClicksIfLoggedIn } = await import('@/utils/affiliate-track')
  bindInflowClicksIfLoggedIn(loggedIn)
  await Promise.resolve(); await Promise.resolve()
}

describe('유입 귀속 게이트', () => {
  it('로그아웃이면 안 보낸다 (종전 동작)', async () => {
    store.set(SENT, '10')
    await bind(false)
    expect(post).not.toHaveBeenCalled()
  })

  it('🔑 `?ref=` 로 들어온 적이 없으면 **안 보낸다** — 라이브에서 보인 그 요청', async () => {
    await bind()
    expect(post, '유입 기록이 0인데 POST 가 나갔다').not.toHaveBeenCalled()
  })

  it('유입 기록이 있고 아직 안 묶였으면 보낸다', async () => {
    store.set(SENT, '10')
    await bind()
    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls.at(0)?.[0]).toBe('/api/acquisition/inflow/bind')
  })

  it('성공하면 묶은 ref 를 적어 두고, 다음 진입엔 안 보낸다', async () => {
    store.set(SENT, '10')
    await bind()
    expect(store.get(BOUND)).toBe('10')
    post.mockClear()
    await bind()
    expect(post, '같은 유입을 다시 보냈다').not.toHaveBeenCalled()
  })

  it('🔁 **새 ref 를 누르면 다시 보낸다** — 영구 플래그면 두 번째 유입이 영영 안 묶인다', async () => {
    store.set(SENT, '10'); store.set(BOUND, '10')
    post.mockClear()
    await bind()
    expect(post, '이미 묶은 ref 라 안 보내야 한다').not.toHaveBeenCalled()
    store.set(SENT, '20') // 다른 사람 링크를 새로 눌렀다
    await bind()
    expect(post, '새 유입인데 안 보냈다 — 그 행은 영영 user_id NULL 로 남는다').toHaveBeenCalledTimes(1)
  })

  it('실패하면 묶음 표시를 안 남긴다 (다음 진입에 재시도)', async () => {
    store.set(SENT, '10')
    post.mockImplementation(() => Promise.reject(new Error('offline')))
    await bind()
    expect(store.has(BOUND), '실패했는데 묶었다고 적었다').toBe(false)
  })

  it('스토리지가 통째로 막혀도 던지지 않는다 (fail-soft)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      clear: () => {},
    })
    await expect(bind()).resolves.toBeUndefined()
    expect(post).not.toHaveBeenCalled()
  })
})

describe('배선 — 호출부는 그대로다', () => {
  it('App 이 로그인 여부를 넘겨 부른다', async () => {
    const { readCode } = await import('../helpers/source-text')
    const app = readCode('src/App.tsx')
    expect(app).toContain('bindInflowClicksIfLoggedIn(loggedIn)')
  })
})
