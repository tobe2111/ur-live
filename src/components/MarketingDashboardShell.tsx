import type { ReactNode } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'

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
 *   사이드바 nav = 섹션 앵커 스크롤(전부 마운트 유지 → 패널 상태 보존, 기능 불변).
 *   surface 분리(/ads): 소비자/도매 chrome 비노출(worker/App isMarketingSurface).
 */
const NAV: Array<{ id: string; label: string; icon: ReactNode }> = [
  { id: 'sec-keyword', label: '키워드 확장', icon: <path d="M11 4.5a6.5 6.5 0 1 0 4.5 11.2M11 8v6M8 11h6M20 20l-4.2-4.2" /> },
  { id: 'sec-searchad', label: '검색광고 실적', icon: <path d="M3 21h18M5 18v-7M10.3 18V6M15.6 18v-9" /> },
  { id: 'sec-efficiency', label: '키워드 효율', icon: <path d="M3 3v18h18M7 14l3-3 3 2 5-6" /> },
  { id: 'sec-autobid', label: '자동입찰', icon: <path d="M8 5v14M8 5l-3 3M8 5l3 3M16 19V5M16 19l-3-3M16 19l3-3" /> },
  { id: 'sec-ai', label: 'AI 마케터', icon: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4L12 3z" /> },
  { id: 'sec-report', label: '주간 리포트', icon: <path d="M4 19V5M4 19h16M8 16l3-4 3 2 4-6" /> },
  { id: 'sec-fraud', label: '부정클릭 방어', icon: <path d="M12 3l7 3v5c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V6l7-3zM9 12l2 2 4-4" /> },
  { id: 'sec-rank', label: '쇼핑 순위', icon: <path d="M12 15l-5 6 5-3 5 3-5-6zM12 2a6 6 0 1 0 0 12A6 6 0 0 0 12 2z" /> },
  { id: 'sec-price', label: '가격·소싱', icon: <path d="M20 12l-8 8-9-9V3h8l9 9zM7.5 7.5h.01" /> },
  { id: 'sec-alerts', label: '알림', icon: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /> },
  { id: 'sec-store', label: '발주 수집', icon: <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /> },
]

const SCOPED_CSS = `
.uad{--bg:#F4F5F7;--surface:#FFFFFF;--panel:#FFFFFF;--ink:#0B0E14;--ink2:#565E6C;--ink3:#8A93A3;--border:#ECEDF1;--border2:#E2E6F2;--brand:#3B6EF5;--brand-soft:#EAF0FF;--brand-ink:#2A56D4;--sidebar:#FFFFFF;--topbar:rgba(255,255,255,.85);--scroll:#C7CDD9}
.uad.dark{--bg:#06080F;--surface:#0A0E1A;--panel:#0E1322;--ink:#F5F7FA;--ink2:#9AA6BE;--ink3:#6E7A95;--border:#1B2233;--border2:#26304A;--brand:#3B6EF5;--brand-soft:#16224A;--brand-ink:#9BB0FF;--sidebar:#090C16;--topbar:rgba(6,8,15,.72);--scroll:#2A3450}
.uad .mono{font-family:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Menlo,monospace}
.uad .uad-nav{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:9px;font-size:13.5px;font-weight:600;color:var(--ink2);cursor:pointer;transition:background .12s,color .12s;background:transparent;border:none;text-align:left;width:100%}
.uad .uad-nav:hover{background:var(--surface);color:var(--ink)}
.uad.dark .uad-nav:hover{background:var(--surface)}
.uad:not(.dark) .uad-nav:hover{background:#F1F3F7}
.uad .uad-nav.active{background:var(--brand-soft);color:var(--brand-ink)}
.uad .uad-tgl{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;border:1px solid var(--border2);background:var(--surface);color:var(--ink2);cursor:pointer;font-size:14px}
.uad ::-webkit-scrollbar{width:9px;height:9px}
.uad ::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:6px;border:3px solid transparent;background-clip:content-box}
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
  const [active, setActive] = useState<string>(NAV[0].id)
  // 계정 드롭다운(헤더) — 회사명/계정설정/로그아웃. 모든 화면에서 직접 로그아웃.
  const [acctOpen, setAcctOpen] = useState(false)
  const company = typeof window !== 'undefined' ? (localStorage.getItem('ads_company') || '내 계정') : '내 계정'
  function logout() {
    for (const k of ['ads_token', 'ads_account_id', 'ads_company']) { try { localStorage.removeItem(k) } catch { /* ignore */ } }
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
  const addTenant = () => { setTenantOpen(false); go('sec-searchad') }

  // 스크롤스파이 — 보이는 섹션을 사이드바에 활성 표시(전부 마운트 유지). 섹션 없으면(비로그인) skip.
  useEffect(() => {
    if (!showNav) return
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (vis[0]?.target?.id) setActive(vis[0].target.id)
      },
      // 토픽바 바로 아래(상단)에 걸린 섹션을 활성으로 — 클릭 후 그 섹션이 계속 하이라이트.
      { rootMargin: '-72px 0px -62% 0px', threshold: [0, 1] },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [showNav])

  const go = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
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
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--ink3)', padding: '6px 4px 6px' }}>MENU</div>
          {showNav ? NAV.map((n) => (
            <button key={n.id} type="button" onClick={() => go(n.id)} className={`uad-nav${active === n.id ? ' active' : ''}`}>
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
