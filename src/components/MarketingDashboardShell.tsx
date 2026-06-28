import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'

/**
 * 🆕 2026-06-27 유어애즈 대시보드 chrome — 코스믹 네이비 사이드바 + 토픽바.
 *   디자인 SSOT: docs/design/urads/UR Ads Dashboard.dc.html (236px 사이드바 · mono 라벨 · line 아이콘).
 *   본문(기능 패널)은 그대로 — 루트에 `dark` 스코프를 강제해 패널의 dark: variant 가 활성(코스믹 다크).
 *   사이드바 nav = 섹션 앵커 스크롤(전부 마운트 유지 → 패널 상태 보존, 기능 불변).
 *   surface 분리(/ads): 소비자/도매 chrome 비노출(worker/App isMarketingSurface).
 */
const NAV: Array<{ id: string; label: string; icon: ReactNode }> = [
  { id: 'sec-keyword', label: '키워드 확장', icon: <path d="M11 4.5a6.5 6.5 0 1 0 4.5 11.2M11 8v6M8 11h6M20 20l-4.2-4.2" /> },
  { id: 'sec-searchad', label: '검색광고 실적', icon: <path d="M3 21h18M5 18v-7M10.3 18V6M15.6 18v-9" /> },
  { id: 'sec-autobid', label: '자동입찰', icon: <path d="M8 5v14M8 5l-3 3M8 5l3 3M16 19V5M16 19l-3-3M16 19l3-3" /> },
  { id: 'sec-ai', label: 'AI 마케터', icon: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4L12 3z" /> },
  { id: 'sec-report', label: '주간 리포트', icon: <path d="M4 19V5M4 19h16M8 16l3-4 3 2 4-6" /> },
  { id: 'sec-fraud', label: '부정클릭 방어', icon: <path d="M12 3l7 3v5c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V6l7-3zM9 12l2 2 4-4" /> },
  { id: 'sec-price', label: '가격·소싱', icon: <path d="M20 12l-8 8-9-9V3h8l9 9zM7.5 7.5h.01" /> },
  { id: 'sec-store', label: '발주 수집', icon: <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /> },
]

const SCOPED_CSS = `
.uad{--bg:#06080F;--surface:#0A0E1A;--panel:#0E1322;--ink:#F5F7FA;--ink2:#9AA6BE;--ink3:#6E7A95;--border:#1B2233;--border2:#26304A;--brand:#3B6EF5;--brand-soft:#16224A;--brand-ink:#9BB0FF;--sidebar:#090C16}
.uad .mono{font-family:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Menlo,monospace}
.uad .uad-nav{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:9px;font-size:13.5px;font-weight:600;color:var(--ink2);cursor:pointer;transition:background .12s,color .12s}
.uad .uad-nav:hover{background:var(--surface);color:var(--ink)}
.uad .uad-nav.active{background:var(--brand-soft);color:var(--brand-ink)}
.uad ::-webkit-scrollbar{width:9px;height:9px}
.uad ::-webkit-scrollbar-thumb{background:#2A3450;border-radius:6px;border:3px solid transparent;background-clip:content-box}
`

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {children}
    </svg>
  )
}

export default function MarketingDashboardShell({ title = '대시보드', planLabel, children }: { title?: string; planLabel?: string; children: ReactNode }) {
  const [active, setActive] = useState<string>(NAV[0].id)
  useUrAdsFavicon()

  // 스크롤스파이 — 보이는 섹션을 사이드바에 활성 표시(전부 마운트 유지).
  useEffect(() => {
    const ids = NAV.map((n) => n.id)
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (vis[0]?.target?.id) setActive(vis[0].target.id)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.2, 1] },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  return (
    <div className="uad dark" style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex' }}>
      <style>{SCOPED_CSS}</style>

      {/* SIDEBAR (lg+) */}
      <aside className="hidden lg:flex" style={{ width: 236, flexShrink: 0, background: 'var(--sidebar)', borderRight: '1px solid var(--border)', flexDirection: 'column', height: '100dvh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <Link to="/ads" aria-label="유어애즈 홈" style={{ color: 'var(--ink)' }}><UrAdsLogo size={24} /></Link>
        </div>
        <nav style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflowY: 'auto' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--ink3)', padding: '6px 4px 6px' }}>MENU</div>
          {NAV.map((n) => (
            <button key={n.id} type="button" onClick={() => go(n.id)} className={`uad-nav${active === n.id ? ' active' : ''}`}>
              <NavIcon>{n.icon}</NavIcon>{n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
          <Link to="/ads" className="mono" style={{ fontSize: 11, letterSpacing: '.08em', color: 'var(--ink3)' }}>← 랜딩으로</Link>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 60, flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'rgba(6,8,15,.72)', backdropFilter: 'saturate(160%) blur(12px)', WebkitBackdropFilter: 'saturate(160%) blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="lg:hidden" style={{ color: 'var(--ink)' }}><UrAdsLogo size={22} /></span>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em' }}>{title}</span>
          </div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink3)' }}>{planLabel || '네이버 공식 API'}</div>
        </header>
        <main style={{ flex: 1, minWidth: 0, padding: '20px clamp(14px,3vw,28px) 60px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  )
}
