import type { ReactNode } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/api'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'
import { DASH_TABS } from '@/pages/marketing/dashboard-tabs'

interface Tenant { customer_id: string; tenant_label: string | null; connected_at: string | null; is_active: number }
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

/**
 * 🆕 2026-06-27 유어애즈 대시보드 chrome — 코스믹 네이비 사이드바 + 토픽바.
 *   디자인 SSOT: docs/design/urads/UR Ads Dashboard.dc.html (236px 사이드바 · mono 라벨 · line 아이콘).
 *   본문(기능 패널)은 그대로 — 다크 시 루트 `dark` 스코프로 패널의 dark: variant 활성(코스믹),
 *   라이트 시 `dark` 제거로 패널이 라이트 variant(흰 카드) 렌더. 토픽바 토글(기본 다크, localStorage 유지).
 *   🗂️ 2026-07-27 재편(대표 "한 페이지에 다 몰아넣어 투박함"): 앵커 스크롤 18항목 → 기능 그룹 7탭.
 *   사이드바/모바일 칩 = URL(?tab=) 전환 — 탭 SSOT dashboard-tabs.tsx, 활성 탭 패널만 렌더.
 *   surface 분리(/ads): 소비자/도매 chrome 비노출(worker/App isMarketingSurface).
 */

const SCOPED_CSS = `
@font-face{font-family:'PretendardV';src:url(https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/woff2/PretendardVariable.woff2) format('woff2-variations');font-weight:45 920;font-style:normal;font-display:swap}
.uad{font-family:"Pretendard Variable","PretendardV",Pretendard,system-ui,-apple-system,sans-serif}
.uad{--bg:#F4F5F7;--surface:#FFFFFF;--panel:#FFFFFF;--ink:#0B0E14;--ink2:#565E6C;--ink3:#8A93A3;--border:#ECEDF1;--border2:#E2E6F2;--brand:#3B6EF5;--brand-soft:#EAF0FF;--brand-ink:#2A56D4;--sidebar:#FFFFFF;--topbar:rgba(255,255,255,.85);--scroll:#C7CDD9}
.uad.dark{--bg:#06080F;--surface:#0A0E1A;--panel:#0E1322;--ink:#F5F7FA;--ink2:#9AA6BE;--ink3:#6E7A95;--border:#1B2233;--border2:#26304A;--brand:#3B6EF5;--brand-soft:#16224A;--brand-ink:#9BB0FF;--sidebar:#090C16;--topbar:rgba(6,8,15,.72);--scroll:#2A3450}
/* 2026-07-27 폰트 통일: mono(IBM Plex — 미로드라 임의 시스템 mono 렌더)도 Pretendard 상속 */
.uad .mono{font-family:inherit;font-weight:700}
.uad .uad-nav{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:9px;font-size:13.5px;font-weight:600;color:var(--ink2);cursor:pointer;transition:background .12s,color .12s;background:transparent;border:none;text-align:left;width:100%}
.uad .uad-nav:hover{background:var(--surface);color:var(--ink)}
.uad.dark .uad-nav:hover{background:var(--surface)}
.uad:not(.dark) .uad-nav:hover{background:#F1F3F7}
.uad .uad-nav.active{background:var(--brand-soft);color:var(--brand-ink)}
.uad .uad-tgl{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;border:1px solid var(--border2);background:var(--surface);color:var(--ink2);cursor:pointer;font-size:14px}
/* 2026-09-03 스크롤 일관화: 이 표면만 9px/반경6/테두리3 이었다 — 전역(8px/알약/2px)과 같은 치수로.
   색은 이 대시보드 자기 토큰(--scroll)을 그대로 쓴다(라이트·다크 각자 값을 갖고 있다). */
.uad ::-webkit-scrollbar{width:8px;height:8px}
.uad ::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:99px;border:2px solid transparent;background-clip:content-box}
.uad [id^="sec-"]{scroll-margin-top:76px}
`

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {children}
    </svg>
  )
}

export default function MarketingDashboardShell({ title = '대시보드', planLabel, showNav = true, children }: { title?: string; planLabel?: string; showNav?: boolean; children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  // 활성 탭 = 대시보드 URL 의 ?tab= (기본 home). 대시보드 밖(계정설정 등)에선 활성 없음.
  const onDash = location.pathname === '/ads/dashboard'
  const active = onDash ? (new URLSearchParams(location.search).get('tab') || 'home') : ''
  // 계정 드롭다운(헤더) — 회사명/계정설정/로그아웃. 모든 화면에서 직접 로그아웃.
  const [acctOpen, setAcctOpen] = useState(false)
  const company = typeof window !== 'undefined' ? (localStorage.getItem('ads_company') || '내 계정') : '내 계정'
  function logout() {
    for (const k of ['ads_token', 'ads_account_id', 'ads_company', 'ads_unlocked']) { try { localStorage.removeItem(k) } catch { /* ignore */ } }
    navigate('/ads/login', { replace: true })
  }
  // 화이트(라이트) 기본 + 다크 토글(대표 지시 2026-06-28 "기본은 화이트테마"). 선택은 localStorage 유지
  //   — 이전에 'dark' 로 명시 토글한 사용자는 다크 유지, 미설정/신규는 라이트.
  const [dark, setDark] = useState<boolean>(() => {
    try { return localStorage.getItem('urads_dash_theme') === 'dark' } catch { return false }
  })
  const toggleTheme = () => setDark((v) => { const next = !v; try { localStorage.setItem('urads_dash_theme', next ? 'dark' : 'light') } catch { /* ignore */ } return next })
  useUrAdsFavicon()

  // 멀티테넌트 — 연결된 고객사 목록 + 활성 전환.
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantOpen, setTenantOpen] = useState(false)
  const loadTenants = useCallback(async () => {
    if (!showNav) return
    try {
      const r = await api.get('/api/ads/searchad/tenants', { headers: authHeader() })
      if (r.data?.success) setTenants(r.data.tenants || [])
    } catch { /* graceful */ }
  }, [showNav])
  useEffect(() => { loadTenants() }, [loadTenants])
  // 드롭다운 바깥 클릭 / Esc 로 닫기.
  useEffect(() => {
    if (!tenantOpen) return
    const onDown = (e: MouseEvent) => { if (!(e.target as Element | null)?.closest?.('.uad-tenant')) setTenantOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTenantOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [tenantOpen])
  // 계정 드롭다운 바깥 클릭 / Esc 로 닫기.
  useEffect(() => {
    if (!acctOpen) return
    const onDown = (e: MouseEvent) => { if (!(e.target as Element | null)?.closest?.('.uad-acct')) setAcctOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAcctOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [acctOpen])
  const activeTenant = tenants.find((t) => t.is_active) || tenants[0] || null
  const tenantName = (t: Tenant) => t.tenant_label || `고객 ${t.customer_id}`
  async function switchTenant(customerId: string) {
    if (customerId === activeTenant?.customer_id) { setTenantOpen(false); return }
    try {
      await api.post('/api/ads/searchad/tenant/activate', { customer_id: customerId }, { headers: authHeader() })
      window.location.reload() // 모든 패널을 새 고객사 데이터로 새로고침
    } catch { setTenantOpen(false) }
  }
  const addTenant = () => { setTenantOpen(false); go('performance') }

  // 탭 전환 — URL(?tab=) 이 SSOT. 대시보드 밖(계정설정 등)에서 눌러도 대시보드 해당 탭으로 이동.
  const go = (tab: string) => {
    navigate(`/ads/dashboard?tab=${tab}`)
    try { window.scrollTo({ top: 0 }) } catch { /* ignore */ }
  }

  return (
    <div className={`uad${dark ? ' dark' : ''}`} style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex' }}>
      <style>{SCOPED_CSS}</style>

      {/* SIDEBAR (lg+) */}
      <aside className="hidden lg:flex" style={{ width: 236, flexShrink: 0, background: 'var(--sidebar)', borderRight: '1px solid var(--border)', flexDirection: 'column', height: '100dvh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <Link to="/ads" aria-label="유어애즈 홈" style={{ color: 'var(--ink)' }}><UrAdsLogo size={24} /></Link>
        </div>

        {/* 고객사 전환(멀티테넌트) — 연결된 고객사가 있을 때만 */}
        {showNav && activeTenant && (
          <div className="uad-tenant" style={{ padding: '14px 14px 4px' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--ink3)', padding: '0 2px 7px' }}>고객사 전환</div>
            <button type="button" onClick={() => setTenantOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 9, padding: '9px 11px', cursor: 'pointer', color: 'var(--ink)' }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--brand-soft)', color: 'var(--brand-ink)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{tenantName(activeTenant).slice(0, 1)}</span>
              <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenantName(activeTenant)}</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ stroke: 'var(--ink3)', strokeWidth: 1.8 }}><path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {tenantOpen && (
              <div style={{ marginTop: 6, background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 9, padding: 5 }}>
                {tenants.map((t) => (
                  <div key={t.customer_id} onClick={() => switchTenant(t.customer_id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 9px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontWeight: t.is_active ? 600 : 400, background: t.is_active ? 'var(--brand-soft)' : 'transparent', color: t.is_active ? 'var(--brand-ink)' : 'var(--ink2)' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--ink2)' }}>{tenantName(t).slice(0, 1)}</span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenantName(t)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', margin: '5px 0' }} />
                <div onClick={addTenant} style={{ padding: '8px 9px', fontSize: 13, color: 'var(--brand)', fontWeight: 600, cursor: 'pointer' }}>+ 고객사 추가</div>
              </div>
            )}
          </div>
        )}

        <nav style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflowY: 'auto' }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.1em', color: 'var(--ink3)', padding: '6px 4px 6px' }}>메뉴</div>
          {showNav ? DASH_TABS.map((n) => (
            <button key={n.id} type="button" onClick={() => go(n.id)} title={n.desc} className={`uad-nav${active === n.id ? ' active' : ''}`}>
              <NavIcon>{n.icon}</NavIcon>{n.label}
            </button>
          )) : (
            <div style={{ padding: '8px 11px' }}>
              <p style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.6, margin: 0 }}>로그인하면 메뉴가 표시됩니다.</p>
              <a href="/ads/login" style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--brand-ink)' }}>로그인 / 시작하기 →</a>
            </div>
          )}
        </nav>
        <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {showNav && (
            <Link to="/ads/account" className="uad-nav" style={{ padding: '8px 11px' }}>
              <NavIcon><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></NavIcon>계정 설정
            </Link>
          )}
          <Link to="/ads" className="mono" style={{ fontSize: 11, letterSpacing: '.08em', color: 'var(--ink3)' }}>← 랜딩으로</Link>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 60, flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--topbar)', backdropFilter: 'saturate(160%) blur(12px)', WebkitBackdropFilter: 'saturate(160%) blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="lg:hidden" style={{ color: 'var(--ink)' }}><UrAdsLogo size={22} /></span>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em' }}>{title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 모바일 고객사 칩(사이드바 셀렉터가 숨겨지므로) */}
            {showNav && activeTenant && (
              <button type="button" className="lg:hidden uad-tenant" onClick={() => setTenantOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--brand-soft)', color: 'var(--brand-ink)', border: 'none', padding: '5px 10px', borderRadius: 999, cursor: 'pointer', maxWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tenantName(activeTenant)} ▾
              </button>
            )}
            <span className="mono hidden sm:inline" style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink3)' }}>{planLabel || '네이버 공식 API'}</span>
            <button type="button" className="uad-tgl" onClick={toggleTheme} aria-label={dark ? '라이트 모드' : '다크 모드'} title={dark ? '라이트 모드' : '다크 모드'}>{dark ? '☀️' : '🌙'}</button>
            {/* 계정 드롭다운 — 회사명·계정설정·로그아웃 (모든 화면) */}
            {showNav && (
              <div className="uad-acct" style={{ position: 'relative' }}>
                <button type="button" className="uad-tgl" onClick={() => setAcctOpen((v) => !v)} aria-label="계정" title="계정">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
                </button>
                {acctOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 40, minWidth: 180, background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: 10, padding: 6, boxShadow: '0 14px 40px -12px rgba(0,0,0,.4)', zIndex: 40 }}>
                    <div style={{ padding: '8px 10px 9px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company}</div>
                      <div className="mono" style={{ fontSize: 10, letterSpacing: '.08em', color: 'var(--ink3)', marginTop: 2 }}>UR ADS ACCOUNT</div>
                    </div>
                    <Link to="/ads/account" onClick={() => setAcctOpen(false)} style={{ display: 'block', padding: '9px 10px', fontSize: 13, color: 'var(--ink2)', borderRadius: 7 }}>계정 설정</Link>
                    <button type="button" onClick={logout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', fontSize: 13, color: '#EF4444', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7 }}>로그아웃</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* 모바일 탭 바 — 사이드바가 숨는 <lg 에서 탭 전환(기존엔 모바일 네비 0 이었음) */}
        {showNav && (
          <nav className="lg:hidden" style={{ position: 'sticky', top: 60, zIndex: 18, background: 'var(--topbar)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 12px', whiteSpace: 'nowrap' }}>
            {DASH_TABS.map((n) => (
              <button key={n.id} type="button" onClick={() => go(n.id)}
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: active === n.id ? 'transparent' : 'var(--border2)', background: active === n.id ? 'var(--brand-soft)' : 'var(--surface)', color: active === n.id ? 'var(--brand-ink)' : 'var(--ink2)' }}>
                {n.label}
              </button>
            ))}
          </nav>
        )}

        {/* 모바일 고객사 드롭다운(칩 클릭 시) */}
        {showNav && activeTenant && tenantOpen && (
          <div className="lg:hidden uad-tenant" style={{ position: 'sticky', top: 60, zIndex: 19, background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: 8 }}>
            {tenants.map((t) => (
              <div key={t.customer_id} onClick={() => switchTenant(t.customer_id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 11px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: t.is_active ? 600 : 400, background: t.is_active ? 'var(--brand-soft)' : 'transparent', color: t.is_active ? 'var(--brand-ink)' : 'var(--ink2)' }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--ink2)' }}>{tenantName(t).slice(0, 1)}</span>
                {tenantName(t)}
              </div>
            ))}
            <div onClick={addTenant} style={{ padding: '10px 11px', fontSize: 14, color: 'var(--brand)', fontWeight: 600, cursor: 'pointer' }}>+ 고객사 추가</div>
          </div>
        )}
        <main style={{ flex: 1, minWidth: 0, padding: '20px clamp(14px,3vw,28px) 60px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  )
}
