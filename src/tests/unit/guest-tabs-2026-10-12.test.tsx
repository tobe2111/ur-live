/**
 * 🚪 로그인 전 탭 화면 (2026-10-12 대표 확정 시안 — *"로그인이 안된 상태에서는 이용권 페이지, 유어샵 페이지,
 * 마이 페이지 모두 들어가면 로그인 페이지만 뜨거든? 그거는 이상적이진 않은 것 같아"*).
 *
 * 지키는 것:
 *   ① 하단 탭 셋(`/my-vouchers` · `/u/me` · `/user/profile`)은 로그아웃이면 **로그인 화면이 아니라 게스트 화면**
 *   ② 로그인이면 종전 페이지 그대로 — 판정은 잠긴 `isUserLoggedIn` **한 벌**(토큰 존재 검사 불변)
 *   ③ `guest` 를 안 준 보호 라우트는 종전대로 로그인으로 보낸다(결제·주소·찜 등 — 그쪽은 일부러 벽이다)
 *   ④ 카카오 버튼은 **그 탭으로 돌아오는** 주소를 싣는다(로그인했는데 홈으로 떨어지면 탭을 다시 눌러야 한다)
 *   ⑤ 꺼진 혜택을 약속하지 않는다 — "소개비"(담기 커미션 OFF)·초대 보상(종료)·"팔린 만큼만 수수료"(대표가 뺐다)
 *   ⑥ 카톡 간편로그인 준비는 **복귀 주소마다** 새로 받는다(첫 준비를 계속 돌려주면 다른 탭으로 돌아간다)
 *
 * ⚠️ 못 보는 것: 화면이 예쁜가(그려서 봐야 한다) · 실제 카카오 왕복(라이브에서 로그아웃 상태로 탭 셋을 눌러 볼 것).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { readCode } from '../helpers/source-text'

vi.mock('@/components/brand/BrandLoader', () => ({ default: () => <div>loading</div> }))
import { ProtectedRoute } from '@/components/auth/RouteGuards'

function at(path: string, el: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={el} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('① ② ③ ProtectedRoute guest — 동작', () => {
  beforeEach(() => { cleanup(); localStorage.clear() })

  it('로그아웃 + guest → 게스트 화면(로그인으로 안 보낸다)', () => {
    at('/my-vouchers', <ProtectedRoute requireUser guest={<div>GUEST</div>}><div>REAL</div></ProtectedRoute>)
    expect(screen.queryByText('GUEST')).not.toBeNull()
    expect(screen.queryByText('LOGIN')).toBeNull()
    expect(screen.queryByText('REAL')).toBeNull()
  })

  it('로그인(user_id) + guest → 진짜 페이지', () => {
    localStorage.setItem('user_id', '3')
    at('/my-vouchers', <ProtectedRoute requireUser guest={<div>GUEST</div>}><div>REAL</div></ProtectedRoute>)
    expect(screen.queryByText('REAL')).not.toBeNull()
    expect(screen.queryByText('GUEST')).toBeNull()
  })

  it('로그인(session_login) 도 같은 판정', () => {
    localStorage.setItem('session_login', '1')
    at('/user/profile', <ProtectedRoute requireUser guest={<div>GUEST</div>}><div>REAL</div></ProtectedRoute>)
    expect(screen.queryByText('REAL')).not.toBeNull()
  })

  it('guest 없는 보호 라우트는 종전대로 로그인으로', () => {
    at('/checkout', <ProtectedRoute requireUser><div>REAL</div></ProtectedRoute>)
    expect(screen.queryByText('LOGIN')).not.toBeNull()
  })
})

describe('① 배선 — 하단 탭 셋에 게스트 화면', () => {
  const app = readCode('src/App.tsx')
  it.each([
    ['/my-vouchers', 'GuestPassPage'],
    ['/u/me', 'GuestUrShopPage'],
    ['/user/profile', 'GuestMyPage'],
  ])('%s → %s', (path, comp) => {
    // 🏢 2026-10-26 안 A — 마이 자리는 에이전시 이메일 로그인이면 에이전시 마이, 아니면 그대로 GuestMyPage
    //   (`AgencyAwareGuest` 가 감싼다). 불변식(로그인 전엔 게스트 화면)은 그대로다.
    const guest = path === '/user/profile' ? `<AgencyAwareGuest guest=\\{<${comp} />\\} />` : `<${comp} />`
    const re = new RegExp(`path="${path.replace(/\//g, '\\/')}" element=\\{\\s*<ProtectedRoute requireUser guest=\\{${guest}\\}>`)
    expect(app).toMatch(re)
  })

  it('게스트 화면은 lazy(첫 페인트 번들에 안 들어간다)', () => {
    for (const c of ['GuestPassPage', 'GuestUrShopPage', 'GuestMyPage'])
      // 🚀 2026-10-15: lazyPage(lib/boot-page) 도 lazy 다 — 별도 청크 그대로, 준비됐으면 폴백 없이 그릴 뿐.
      expect(app).toMatch(new RegExp(`const ${c} = lazy(?:Page)?\\(\\(\\) => import\\('./pages/guest/${c}'\\)\\)`))
  })
})

describe('② 로그인 판정은 한 벌 — 잠긴 검사 불변', () => {
  const guards = readCode('src/components/auth/RouteGuards.tsx')
  it('isUserLoggedIn 본문이 토큰 존재 검사 그대로', () => {
    expect(guards).toContain("return !!localStorage.getItem('user_id') || !!localStorage.getItem('session_login')")
  })
  it('guest 는 isUserLoggedIn 이 거짓인 KR 분기에서만 그려진다', () => {
    const kr = guards.slice(guards.indexOf('if (isKorea()) {'), guards.indexOf('return <Navigate to={makeLoginUrl(location.pathname, location.search)} replace />\n}'))
    expect(kr.indexOf('if (isUserLoggedIn())')).toBeGreaterThan(-1)
    expect(kr.indexOf('if (guest !== undefined) return <>{guest}</>')).toBeGreaterThan(kr.indexOf('if (isUserLoggedIn())'))
  })
  it('게스트 화면이 자기 로그인 판정을 따로 만들지 않는다', () => {
    for (const f of ['GuestPassPage', 'GuestUrShopPage', 'GuestMyPage', 'GuestKakaoButton'])
      expect(readCode(`src/pages/guest/${f}.tsx`)).not.toMatch(/localStorage\.getItem\(['"](user_id|session_login)['"]\)/)
  })
})

describe('④ 카카오 버튼은 그 탭으로 돌아온다', () => {
  it.each([
    ['GuestPassPage', '/my-vouchers'],
    ['GuestUrShopPage', '/u/me'],
    ['GuestMyPage', '/user/profile'],
  ])('%s → returnPath=%s', (f, path) => {
    expect(readCode(`src/pages/guest/${f}.tsx`)).toContain(`<GuestKakaoButton returnPath="${path}"`)
  })

  it('버튼은 /login 을 거치지 않고 카카오로 — 복귀 주소는 safeInternalPath 경유', () => {
    const lib = readCode('src/pages/guest/guest-login.ts')
    expect(lib).toMatch(/\/auth\/kakao\/start\?\$\{new URLSearchParams\(\{ redirect \}\)/)
    expect(lib).toMatch(/const redirect = safeInternalPath\(returnPath, '\/'\)/)
    expect(lib).toMatch(/if \(startTalkLogin\(\)\) return/)
    expect(readCode('src/pages/guest/GuestKakaoButton.tsx')).not.toMatch(/['"`]\/login/)
  })
})

describe('⑤ 꺼진 혜택을 약속하지 않는다', () => {
  const all = ['GuestPassPage', 'GuestUrShopPage', 'GuestMyPage', 'GuestBenefits']
    .map((f) => readCode(`src/pages/guest/${f}.tsx`)).join('\n')
  it.each([
    ['소개비'], ['초대'], ['1,000딜'], ['팔린 만큼만 수수료'], ['안팔리면'], ['인플루언서'],
  ])('"%s" 없음', (w) => {
    expect(all).not.toContain(w)
  })
})

describe('⑥ 카톡 간편로그인 준비는 복귀 주소별', () => {
  it('주소가 바뀌면 새로 준비하고, 늦게 온 옛 준비가 새 표를 덮지 않는다', () => {
    const lib = readCode('src/lib/kakao-talk-login.ts')
    expect(lib).toMatch(/if \(preparing && preparedFor === key\) return preparing/)
    expect(lib).toMatch(/if \(preparedFor !== key\) return/)
  })
})
