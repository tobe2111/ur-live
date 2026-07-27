/**
 * 🆕 2026-06-27 유어애즈(UR Ads) — 라이트 테마 랜딩(소개) 페이지.
 *
 *   디자인 SSOT: `docs/design/urads/UR Ads Landing Light.dc.html` (+ Handoff Spec 토큰).
 *   유어팀의 3번째 서비스(유어딜=소비자 / 유통스타트=도매 / 유어애즈=마케팅)의 공개 세일즈 표면.
 *
 *   브랜드 정체성: 코스믹 네이비 — 단색 #3B6EF5 + 그라데이션(#3B6EF5→#8B5CF6→#EC4899).
 *   surface 분리: /ads (worker isMarketingSurface, App.tsx isMarketingSurface) — 소비자/도매 chrome 비노출.
 *
 *   ⚠️ 디자인 시안을 픽셀 충실히 옮기기 위해 인라인 스타일 + 스코프드 CSS 사용(.ua-landing).
 *   양모드: CSS 변수(--bg/--ink/--panel…)를 `.ua-landing`(라이트 기본)·`[data-theme="dark"]`
 *   (코스믹 네이비=Landing v2)에서 오버라이드, 컴포넌트 마크업 불변(Handoff Spec 규칙). 네비 토글.
 *   본문/수치/CTA 카피는 시안과 동일(절감액·ROAS 등은 더미 예시 — 실데이터 연동 시 교체).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '@/components/SEO'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'

const APP = '/ads/dashboard'
const CONTACT = 'mailto:jiwon@ur-team.com'

const SCOPED_CSS = `
.ua-landing{
  --bg:#FFFFFF;--ink:#0B0E14;--ink-strong:#2A303B;--ink2:#565E6C;--muted:#8A93A3;
  --panel:#FFFFFF;--panel2:#FAFBFD;--line:#ECEDF1;--hair:#EEF0F3;--chip:#F2F3F6;
  --brand:#3B6EF5;--soft-bg:#EAF0FF;--soft-bd:#C9D8FF;--soft-tx:#2A56D4;--up:#16A36B;--btn-bd:#DADCE2;
  --nav-bg:rgba(255,255,255,.82);--nav-bd:#ECEDF1;
  --hero-bg:radial-gradient(120% 90% at 82% -10%,#E9EFFF 0%,#F4F7FF 36%,#FFFFFF 68%);
  --tint-bg:linear-gradient(120deg,#EEF2FF,#F6F0FF);--tint-bd:#DCE3FB;
  font-family:"Pretendard Variable",Pretendard,system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  background:var(--bg);color:var(--ink);min-height:100dvh
}
.ua-landing[data-theme="dark"]{
  --bg:#06080F;--ink:#F5F7FA;--ink-strong:#C7D0E0;--ink2:#9AA6BE;--muted:#7E8BA6;
  --panel:#0C1120;--panel2:#0E1322;--line:#1B2233;--hair:rgba(255,255,255,.08);--chip:rgba(255,255,255,.06);
  --brand:#3B6EF5;--soft-bg:rgba(59,110,245,.12);--soft-bd:rgba(59,110,245,.35);--soft-tx:#BFD0FF;--up:#34D399;--btn-bd:rgba(255,255,255,.16);
  --nav-bg:rgba(6,8,15,.72);--nav-bd:rgba(255,255,255,.07);
  --hero-bg:radial-gradient(120% 90% at 82% -10%,#16225A 0%,#0A1030 34%,#06080F 66%);
  --tint-bg:linear-gradient(120deg,#0E1430,#160E2A);--tint-bd:rgba(255,255,255,.10)
}
.ua-landing a{text-decoration:none;color:inherit}
.ua-landing .grad{background:linear-gradient(96deg,#3B6EF5 0%,#8B5CF6 52%,#EC4899 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.ua-landing .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
.ua-landing details>summary{list-style:none;cursor:pointer}
.ua-landing details>summary::-webkit-details-marker{display:none}
.ua-landing details[open] .fp{transform:rotate(45deg)}
.ua-landing .ua-nav{background:var(--nav-bg);border-bottom:1px solid var(--nav-bd)}
.ua-landing .ua-hero{background:var(--hero-bg)}
.ua-landing .ua-tint{background:var(--tint-bg);border:1px solid var(--tint-bd)}
.ua-landing .ua-hero-dots{position:absolute;inset:0;pointer-events:none;opacity:.6;background-image:radial-gradient(#D6DEF2 1px,transparent 1px);background-size:24px 24px;-webkit-mask-image:radial-gradient(ellipse 80% 70% at 80% 0%,#000,transparent 70%);mask-image:radial-gradient(ellipse 80% 70% at 80% 0%,#000,transparent 70%)}
.ua-landing[data-theme="dark"] .ua-hero-dots{opacity:.5;background-size:auto;-webkit-mask-image:none;mask-image:none;background-image:radial-gradient(1px 1px at 18% 30%,#fff,transparent),radial-gradient(1px 1px at 42% 68%,#cdd6ff,transparent),radial-gradient(1px 1px at 64% 22%,#fff,transparent),radial-gradient(1.4px 1.4px at 80% 50%,#bcd,transparent),radial-gradient(1px 1px at 30% 82%,#fff,transparent)}
.ua-landing .ua-tglbtn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;border:1px solid var(--btn-bd);background:var(--panel);color:var(--ink2);cursor:pointer;font-size:15px}
.ua-landing .ua-navlinks{display:flex;gap:26px}
@media(max-width:720px){.ua-landing .ua-navlinks{display:none}}
`

/** 체크 아이콘 (브랜드 블루 stroke) */
function Check({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="#3B6EF5" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }}>
      <path d="M4 9.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, color: 'var(--ink-strong)' }}>
      <Check />
      <span>{children}</span>
    </li>
  )
}

const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  border: '1px solid var(--line)', borderRadius: 14, background: 'var(--panel)', overflow: 'hidden',
  boxShadow: '0 16px 44px -28px rgba(11,14,30,.3)', ...extra,
})
const eyebrow: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'var(--brand)', letterSpacing: '.04em' }
const h3: React.CSSProperties = { fontSize: 'clamp(26px,3vw,33px)', lineHeight: 1.18, fontWeight: 800, letterSpacing: '-.035em', margin: '14px 0 0' }
const lead: React.CSSProperties = { fontSize: 16, lineHeight: 1.65, color: 'var(--ink2)', margin: '16px 0 0', maxWidth: 440 }
const featRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(360px,100%),1fr))', gap: 60, alignItems: 'center', padding: '46px 0' }
const thRow: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--muted)' }

export default function MarketingLandingPage() {
  const [dark, setDark] = useState(false) // 기본 라이트(Landing Light). 토글 시 코스믹 네이비(v2).
  useUrAdsFavicon()
  // 로그인 상태면 대시보드로, 아니면 유어애즈 코스믹 로그인(/ads/login → 카카오 → /ads/dashboard 복귀).
  //   2026-07-27 대표 "로그인/로그아웃 버튼이 잘 안 보임" — 텍스트 링크 → 명시적 버튼 + 로그아웃 노출.
  const [loggedIn, setLoggedIn] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem('ads_token'))
  const loginHref = loggedIn ? APP : '/ads/login'
  function logout() {
    for (const k of ['ads_token', 'ads_account_id', 'ads_company', 'ads_unlocked']) { try { localStorage.removeItem(k) } catch { /* ignore */ } }
    setLoggedIn(false)
  }
  return (
    <div className="ua-landing" data-theme={dark ? 'dark' : undefined}>
      <style>{SCOPED_CSS}</style>
      <SEO
        title="유어애즈 UR Ads — 광고 입찰부터 발주까지, 하나로 자동화"
        description="네이버 검색광고·커머스를 한곳에서 자동화하는 B2B 종합 마케팅 솔루션. 자동입찰으로 평균 CPC 15% 절감, 부정클릭 방어, 키워드 확장, 통합 실적(ROAS), AI 마케터, 발주 수집. 네이버 공식 API 기반 · 크롤링 아님."
        image="https://urdeal.kr/og-urads.png"
        url="/ads"
        type="website"
      />

      {/* ── NAV ── */}
      <header className="ua-nav" style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'saturate(160%) blur(14px)', WebkitBackdropFilter: 'saturate(160%) blur(14px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 38 }}>
            <Link to="/ads"><UrAdsLogo size={26} /></Link>
            <nav className="ua-navlinks" style={{ fontSize: 14, color: 'var(--ink2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              <a href="#features">기능</a><a href="#pricing">요금제</a><a href="#proof">고객사례</a><a href="#faq">FAQ</a>
            </nav>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="button" className="ua-tglbtn" onClick={() => setDark(v => !v)} aria-label={dark ? '라이트 모드' : '다크 모드'} title={dark ? '라이트 모드' : '다크 모드'}>{dark ? '☀️' : '🌙'}</button>
            <a className="ua-navlinks" href={CONTACT} style={{ fontSize: 14, color: 'var(--ink2)', fontWeight: 500, whiteSpace: 'nowrap' }}>Contact Us</a>
            {loggedIn && (
              <button type="button" onClick={logout} style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink2)', background: 'transparent', border: '1px solid var(--btn-bd)', padding: '8px 14px', borderRadius: 8, whiteSpace: 'nowrap', cursor: 'pointer' }}>로그아웃</button>
            )}
            <Link to={loginHref} style={{ fontSize: 14, fontWeight: 700, color: '#fff', background: '#3B6EF5', padding: '9px 18px', borderRadius: 8, whiteSpace: 'nowrap' }}>{loggedIn ? '대시보드 →' : '로그인 / 시작하기'}</Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="ua-hero" style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--line)' }}>
        <div className="ua-hero-dots" />
        <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(380px,100%),1fr))', gap: 'clamp(28px,5vw,52px)', alignItems: 'center', padding: 'clamp(48px,9vw,86px) 0 clamp(44px,8vw,78px)' }}>
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--soft-tx)', background: 'var(--soft-bg)', border: '1px solid var(--soft-bd)', padding: '7px 14px', borderRadius: 999 }}>● 네이버 공식 API 기반 · 크롤링 아님</span>
              <h1 style={{ fontSize: 'clamp(38px,5vw,56px)', lineHeight: 1.08, fontWeight: 800, letterSpacing: '-.045em', margin: '22px 0 0' }}>광고 입찰부터 발주까지,<br /><span className="grad">하나로 자동화.</span></h1>
              <p style={{ fontSize: 17, lineHeight: 1.62, color: 'var(--ink2)', margin: '20px 0 0', maxWidth: 460 }}>목표 순위와 최대 입찰가만 정하세요. 최저 CPC를 24/365 자동으로 찾고, 부정클릭을 가려내고, 흩어진 성과를 ROAS 한 화면에 모읍니다.</p>
              <div style={{ display: 'flex', gap: 13, alignItems: 'center', marginTop: 30, flexWrap: 'wrap' }}>
                {/* 🟡 유어딜 카카오 계정으로 즉시 시작(브리지) — 별도 가입 폼 없이 3초 */}
                <a href={loggedIn ? APP : `/auth/kakao/start?redirect=${encodeURIComponent('/ads/kakao')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#191919', background: '#FEE500', padding: '14px 26px', borderRadius: 9, whiteSpace: 'nowrap' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#191919" aria-hidden><path d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.65l-.95 3.54c-.08.31.27.56.54.38l4.19-2.79c.51.05 1.03.08 1.56.08 5.52 0 10-3.54 10-7.86C22 6.54 17.52 3 12 3z" /></svg>
                  {loggedIn ? '대시보드 열기' : '카카오로 3초 시작'}
                </a>
                <Link to={loginHref} style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', background: 'var(--panel)', border: '1px solid var(--btn-bd)', padding: '14px 24px', borderRadius: 9, whiteSpace: 'nowrap' }}>{loggedIn ? '대시보드' : '이메일로 시작'}</Link>
              </div>
              <div style={{ display: 'flex', gap: 30, marginTop: 36 }}>
                <div><div className="num grad" style={{ fontSize: 26, fontWeight: 800 }}>24/365</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>무중단 자동 입찰</div></div>
                <div style={{ width: 1, background: 'var(--line)' }} />
                <div><div className="num grad" style={{ fontSize: 26, fontWeight: 800 }}>41,000+</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>자체 인플루언서 풀</div></div>
                <div style={{ width: 1, background: 'var(--line)' }} />
                <div><div className="num grad" style={{ fontSize: 26, fontWeight: 800 }}>공식 API</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>네이버 · 크롤링 아님</div></div>
              </div>
            </div>
            {/* product window */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, boxShadow: '0 30px 80px -36px rgba(59,110,245,.45)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--hair)', background: 'var(--panel2)' }}>
                <div style={{ display: 'flex', gap: 6 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#E0E2E8' }} />)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>urdeal.kr/ads/dashboard</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto', opacity: .8 }}>예시 화면</div>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>통합 실적</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--up)' }} />실시간 동기화</span></div>
                <div style={{ border: '1px solid var(--hair)', borderRadius: 11, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: 'var(--ink2)' }}>통합 ROAS</span><span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--up)' }}>▲ 18.4%</span></div>
                  <div className="num" style={{ fontSize: 31, fontWeight: 800, letterSpacing: '-.03em', marginTop: 4 }}>412.8<span style={{ fontSize: 18, color: 'var(--muted)' }}>%</span></div>
                  <svg width="100%" height="48" viewBox="0 0 340 48" preserveAspectRatio="none" style={{ marginTop: 8 }}><defs><linearGradient id="hl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3B6EF5" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs><polyline points="0,38 38,34 76,36 114,26 152,28 190,18 228,20 266,11 304,13 340,5" fill="none" stroke="url(#hl)" strokeWidth="2.4" /></svg>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div style={{ border: '1px solid var(--hair)', borderRadius: 11, padding: 14 }}><div style={{ fontSize: 11.5, color: 'var(--ink2)' }}>평균 CPC</div><div className="num" style={{ fontSize: 20, fontWeight: 800, marginTop: 3 }}>₩248</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--up)' }}>▼ 15.2%</div></div>
                  <div style={{ border: '1px solid var(--hair)', borderRadius: 11, padding: 14 }}><div style={{ fontSize: 11.5, color: 'var(--ink2)' }}>자동입찰 키워드</div><div className="num" style={{ fontSize: 20, fontWeight: 800, marginTop: 3 }}>142개</div><div style={{ fontSize: 11, fontWeight: 700, color: '#3B6EF5' }}>입찰 진행 중</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST — 실제 근거만(가공 고객사 로고 금지): 운영사 도그푸딩 + 실 인프라 ── */}
      <section style={{ borderBottom: '1px solid var(--line)', background: 'var(--panel2)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--ink2)', whiteSpace: 'nowrap' }}><b style={{ color: 'var(--ink)' }}>유어딜(urdeal.kr) 운영사가 직접 만들고, 매일 씁니다.</b></span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {['네이버 공식 API', '카카오 로그인', '토스페이먼츠 결제', 'Cloudflare 인프라'].map(t => (
              <span key={t} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', border: '1px solid var(--line)', background: 'var(--panel)', padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUE BAND ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '84px 28px 20px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#3B6EF5', letterSpacing: '.06em' }}>WHY UR ADS</div>
        <h2 style={{ fontSize: 'clamp(28px,3.4vw,38px)', lineHeight: 1.18, fontWeight: 800, letterSpacing: '-.035em', margin: '14px 0 0', maxWidth: 720 }}>광고대행사 한 명이 하던 일을,<br />UR Ads가 <span className="grad">24시간 대신</span>합니다.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(220px,100%),1fr))', marginTop: 44, border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
          {[
            { v: '24/365', t: <>무중단 자동 입찰<br /><span style={{ color: 'var(--muted)', fontSize: 12.5 }}>새벽 경쟁 입찰까지 대응</span></> },
            { v: '₩0', t: <>베타 기간 도구 무료<br /><span style={{ color: 'var(--muted)', fontSize: 12.5 }}>승인제 · 카드 등록 없음</span></> },
            { v: '41,000+', t: <>자체 인플루언서 풀<br /><span style={{ color: 'var(--muted)', fontSize: 12.5 }}>유튜브·블로그 자동 수집·정비</span></> },
            { v: '1분', t: <>검색광고 연동<br /><span style={{ color: 'var(--muted)', fontSize: 12.5 }}>공식 API · 크롤링 아님</span></> },
          ].map((s, i, arr) => (
            <div key={i} style={{ padding: '28px 26px', borderRight: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div className="num" style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.03em' }}>{s.v}</div>
              <div style={{ fontSize: 14, color: 'var(--ink2)', marginTop: 6, lineHeight: 1.5 }}>{s.t}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>* 기능 소개 화면의 수치는 이해를 돕기 위한 예시입니다. 실제 성과는 계정·업종·예산에 따라 다릅니다.</p>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ maxWidth: 1200, margin: '0 auto', padding: '70px 28px 30px' }}>

        {/* 01 자동입찰 */}
        <div style={featRow}>
          <div>
            <div style={eyebrow}>POINT 01 — 자동입찰</div>
            <h3 style={h3}>목표순위·최대입찰가만,<br /><span className="grad">최저 CPC는 자동으로.</span></h3>
            <p style={lead}>원하는 노출 순위와 상한가만 설정하면, 경쟁 상황을 읽어 가장 낮은 비용으로 그 자리를 지킵니다. 시간대·요일 전략과 CSV 대량 설정까지, 상한가를 절대 넘지 않는 안전장치와 함께.</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '22px 0 0', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <Bullet>시간대·요일별 입찰 전략(피크·마감·주말·야간)</Bullet>
              <Bullet>키워드 대량 CSV 일괄 등록</Bullet>
              <Bullet>상한가 초과 없이 예산 안전장치 작동</Bullet>
            </ul>
          </div>
          <div style={card()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--hair)' }}><span style={{ fontSize: 13, fontWeight: 700 }}>자동입찰 키워드</span><span style={{ fontSize: 11, fontWeight: 600, color: '#0E8C5A', background: '#E3F6EE', padding: '4px 9px', borderRadius: 999 }}>자동입찰 ON</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .8fr .8fr', background: 'var(--panel2)', padding: '10px 16px', ...thRow }}><div>KEYWORD</div><div style={{ textAlign: 'right' }}>목표/현재</div><div style={{ textAlign: 'right' }}>입찰가</div><div style={{ textAlign: 'right' }}>CPC</div></div>
            {[
              { k: '무선 이어폰', goal: '2위', now: '2위', nc: 'var(--up)', bid: '₩320', cpc: '₩214' },
              { k: '블루투스 스피커', goal: '1위', now: '3위', nc: '#C8961A', bid: '₩480', cpc: '₩390' },
              { k: '노캔 헤드폰', goal: '3위', now: '2위', nc: 'var(--up)', bid: '₩540', cpc: '₩468' },
            ].map((r) => (
              <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .8fr .8fr', padding: '13px 16px', fontSize: 13, borderTop: '1px solid var(--hair)', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>{r.k}</div>
                <div className="num" style={{ textAlign: 'right' }}><span style={{ color: 'var(--muted)' }}>{r.goal}</span>/<span style={{ color: r.nc, fontWeight: 700 }}>{r.now}</span></div>
                <div className="num" style={{ textAlign: 'right' }}>{r.bid}</div>
                <div className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{r.cpc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 02 부정클릭 (이미지 좌 / 텍스트 우) */}
        <div style={{ ...featRow, borderTop: '1px solid var(--line)' }}>
          <div style={card({ order: 2 })}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--hair)' }}><span style={{ fontSize: 13, fontWeight: 700 }}>의심 클릭 모니터</span><span style={{ fontSize: 11, fontWeight: 600, color: '#C3373C', background: '#FCE9EA', padding: '4px 9px', borderRadius: 999 }}>IP 12 차단</span></div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, color: 'var(--ink2)' }}>오늘 차단</div><div className="num" style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>312<span style={{ fontSize: 13, color: 'var(--muted)' }}>건</span></div></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, color: 'var(--ink2)' }}>절감 추정</div><div className="num" style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: 'var(--up)' }}>₩78K</div></div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 8, letterSpacing: '.06em' }}>SUSPICIOUS CLICK TIMELINE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { t: '09:41', w: '70%', c: '#E5484D', tc: '#C3373C', ip: '211.x.x.18' },
                  { t: '10:02', w: '45%', c: '#E5484D', tc: '#C3373C', ip: '59.x.x.7' },
                  { t: '11:20', w: '30%', c: '#E2A018', tc: '#9A6700', ip: '175.x.x.2' },
                  { t: '13:08', w: '88%', c: '#E5484D', tc: '#C3373C', ip: '203.x.x.9' },
                ].map((r) => (
                  <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                    <span className="num" style={{ color: 'var(--muted)', width: 42 }}>{r.t}</span>
                    <span style={{ flex: 1, height: 6, borderRadius: 3, background: `linear-gradient(90deg,${r.c} ${r.w},#F2F3F6 0)` }} />
                    <span className="num" style={{ color: r.tc, fontWeight: 700 }}>{r.ip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ order: 1 }}>
            <div style={eyebrow}>POINT 02 — 부정클릭 방어</div>
            <h3 style={h3}>새는 광고비를<br /><span className="grad">실시간으로 막습니다.</span></h3>
            <p style={lead}>반복·비정상 클릭 패턴을 탐지해 의심 IP를 가려냅니다. 네이버 검색광고에 바로 등록할 차단 목록을 자동으로 만들어 드리고, 막은 만큼의 절감액을 투명하게 보여줍니다.</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '22px 0 0', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <Bullet>의심 클릭 패턴 자동 탐지 · 차단 목록 자동 생성</Bullet>
              <Bullet>차단 내역·절감 추정액 리포트</Bullet>
            </ul>
          </div>
        </div>

        {/* 03 키워드 확장 */}
        <div style={{ ...featRow, borderTop: '1px solid var(--line)' }}>
          <div>
            <div style={eyebrow}>POINT 03 — 키워드 확장</div>
            <h3 style={h3}>팔리는 키워드를<br /><span className="grad">대신 찾아드립니다.</span></h3>
            <p style={lead}>상품과 맞닿은 고매출 연관 키워드를 검색량·경쟁도와 함께 자동 발굴합니다. 트렌드를 읽어 지금 떠오르는 키워드를 한발 먼저 잡으세요.</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '22px 0 0', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <Bullet>검색량·경쟁도 기반 연관 키워드 추천</Bullet>
              <Bullet>추가·제외 키워드 원클릭 관리</Bullet>
            </ul>
          </div>
          <div style={card()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--hair)' }}><span style={{ fontSize: 13, fontWeight: 700 }}>연관 키워드 발굴</span><span style={{ fontSize: 11, color: 'var(--muted)' }}>+38개 추천</span></div>
            <div style={{ padding: '8px 16px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr .7fr', padding: '10px 0', ...thRow }}><div>KEYWORD</div><div>검색량/경쟁도</div><div /></div>
              {[
                { k: '무선 이어폰 추천', v: '14,200', w: '80%', bar: 'linear-gradient(90deg,#3B6EF5,#8B5CF6)', tag: '추가', tc: 'var(--soft-tx)', tb: 'var(--soft-bg)' },
                { k: '블루투스 이어폰', v: '21,300', w: '92%', bar: 'linear-gradient(90deg,#3B6EF5,#8B5CF6)', tag: '추가', tc: 'var(--soft-tx)', tb: 'var(--soft-bg)' },
                { k: '운동용 이어폰', v: '6,540', w: '42%', bar: '#D7DCE6', tag: '제외', tc: 'var(--muted)', tb: 'var(--chip)' },
              ].map((r) => (
                <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr .7fr', padding: '11px 0', fontSize: 13, borderTop: '1px solid var(--hair)', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>{r.k}</div>
                  <div><span className="num" style={{ fontSize: 12, color: 'var(--ink2)' }}>{r.v}</span><div style={{ height: 4, width: r.w, background: r.bar, borderRadius: 2, marginTop: 4 }} /></div>
                  <div style={{ textAlign: 'right' }}><span style={{ fontSize: 11, fontWeight: 600, color: r.tc, background: r.tb, padding: '4px 9px', borderRadius: 6 }}>{r.tag}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 04 통합 실적 (tinted band) */}
        <div className="ua-tint" style={{ margin: '46px 0', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(360px,100%),1fr))', gap: 52, alignItems: 'center', padding: '50px 44px' }}>
            <div>
              <div style={eyebrow}>POINT 04 — 통합 실적</div>
              <h3 style={h3}>광고비부터 매출까지,<br /><span className="grad">하나의 퍼널로.</span></h3>
              <p style={lead}>광고비 → 클릭 → 주문 → 매출(ROAS)을 한 화면에서. 기간을 비교하고 캠페인별 기여를 분석해, 어디에 더 투자할지 한눈에 판단합니다.</p>
            </div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 13, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><span style={{ fontSize: 13, fontWeight: 700 }}>전환 퍼널</span><span style={{ fontSize: 11, color: 'var(--muted)' }}>최근 30일</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { l: '광고비', v: '₩12.4M', w: '100%', bar: 'linear-gradient(90deg,#3B6EF5,#6E8BFF)', vc: undefined as string | undefined, fw: 600 },
                  { l: '클릭', v: '50,120', w: '82%', bar: 'linear-gradient(90deg,#6155E0,#8B5CF6)', vc: undefined, fw: 600 },
                  { l: '주문', v: '2,840', w: '54%', bar: 'linear-gradient(90deg,#8B5CF6,#C152C0)', vc: undefined, fw: 600 },
                  { l: '매출', v: '₩51.2M', w: '40%', bar: 'var(--up)', vc: 'var(--up)', fw: 700 },
                ].map((r) => (
                  <div key={r.l}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}><span style={{ color: 'var(--ink2)' }}>{r.l}</span><span className="num" style={{ fontWeight: r.fw, color: r.vc }}>{r.v}</span></div>
                    <div style={{ height: 28, borderRadius: 7, background: r.bar, width: r.w }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hair)' }}><span style={{ fontSize: 13, color: 'var(--ink2)' }}>통합 ROAS</span><span className="num grad" style={{ fontSize: 22, fontWeight: 800 }}>412.8%</span></div>
            </div>
          </div>
        </div>

        {/* 05 AI 마케터 */}
        <div style={featRow}>
          <div>
            <div style={eyebrow}>POINT 05 — AI 마케터</div>
            <h3 style={h3}>데이터를 읽고,<br /><span className="grad">다음 액션을 제안합니다.</span></h3>
            <p style={lead}>AI가 실적을 분석해 "이 키워드는 입찰을 올리세요" 같은 구체적 액션을 제안합니다. 매주 자동 리포트로 한 주를 정리해 드리고, 연동 전에도 읽기 진단부터 시작할 수 있습니다.</p>
          </div>
          <div style={card()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: '1px solid var(--hair)' }}><span style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg,#3B6EF5,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4L12 3z" /></svg></span><span style={{ fontSize: 13, fontWeight: 700 }}>AI 마케터</span></div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--panel2)' }}>
              <div style={{ alignSelf: 'flex-end', maxWidth: '78%', background: '#3B6EF5', color: '#fff', fontSize: 13, lineHeight: 1.5, padding: '11px 14px', borderRadius: '14px 14px 4px 14px' }}>이번 주 어디를 개선하면 좋을까?</div>
              <div style={{ maxWidth: '88%', background: 'var(--panel)', border: '1px solid var(--hair)', fontSize: 13, lineHeight: 1.55, padding: '13px 15px', borderRadius: '14px 14px 14px 4px', color: 'var(--ink-strong)' }}><span>'블루투스 스피커'는 전환율이 높은데 현재 3위예요. 입찰가를 <b className="grad">₩480 → ₩540</b>로 올리면 1~2위 복귀가 예상됩니다.</span><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#3B6EF5', padding: '7px 13px', borderRadius: 7 }}>적용하기</span><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', background: 'var(--chip)', padding: '7px 13px', borderRadius: 7 }}>나중에</span></div></div>
              <div style={{ maxWidth: '88%', background: 'var(--panel)', border: '1px solid var(--hair)', fontSize: 13, lineHeight: 1.55, padding: '13px 15px', borderRadius: 14, color: 'var(--ink-strong)' }}><span>또한 '운동용 이어폰'은 클릭 대비 주문이 적어 <b style={{ color: '#C3373C' }}>입찰 하향</b>을 추천해요.</span></div>
            </div>
          </div>
        </div>

        {/* 06 발주 수집 (이미지 좌 / 텍스트 우) */}
        <div style={{ ...featRow, borderTop: '1px solid var(--line)' }}>
          <div style={card({ order: 2 })}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--hair)' }}><span style={{ fontSize: 13, fontWeight: 700 }}>발주 수집</span><span style={{ fontSize: 11, color: 'var(--muted)' }}>스토어 3곳 연동</span></div>
            <div style={{ padding: '8px 16px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr .8fr', padding: '10px 0', ...thRow }}><div>주문</div><div>스토어</div><div style={{ textAlign: 'right' }}>상태</div></div>
              {[
                { p: '무선 이어폰 ×2', id: '#A-20614', s: '스토어 A', st: '발송완료', stc: '#0E8C5A', stb: '#E3F6EE' },
                { p: '가습기 ×1', id: '#N-88231', s: '스토어 B', st: '신규', stc: '#9A6700', stb: '#FCF3E1' },
                { p: '스피커 ×1', id: '#D-10925', s: '스토어 C', st: '처리중', stc: 'var(--soft-tx)', stb: 'var(--soft-bg)' },
              ].map((r) => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr .8fr', padding: '12px 0', fontSize: 13, borderTop: '1px solid var(--hair)', alignItems: 'center' }}>
                  <div><div style={{ fontWeight: 600 }}>{r.p}</div><div className="num" style={{ fontSize: 11, color: 'var(--muted)' }}>{r.id}</div></div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{r.s}</div>
                  <div style={{ textAlign: 'right' }}><span style={{ fontSize: 11, fontWeight: 600, color: r.stc, background: r.stb, padding: '4px 9px', borderRadius: 6 }}>{r.st}</span></div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><span style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: '#fff', background: '#3B6EF5', padding: 9, borderRadius: 8 }}>선택 발송처리</span><span style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)', background: 'var(--chip)', padding: '9px 14px', borderRadius: 8 }}>엑셀</span></div>
            </div>
          </div>
          <div style={{ order: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={eyebrow}>POINT 06 — 발주 수집</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9A6700', background: '#FCF3E1', padding: '3px 9px', borderRadius: 999 }}>준비 중</span>
            </div>
            <h3 style={h3}>여러 스토어 주문을,<br /><span className="grad">한 곳에서 처리.</span></h3>
            <p style={lead}>스토어마다 따로 들어갈 필요 없이, 모든 주문을 한 리스트에 모아 한 번에 발송 처리하는 기능을 준비하고 있습니다. 네이버 커머스 공식 연동으로 곧 제공됩니다.</p>
          </div>
        </div>
      </section>

      {/* ── PROOF — 가공 후기 대신 실사용(도그푸딩) 사실만 ── */}
      <section id="proof" style={{ borderTop: '1px solid var(--line)', background: 'var(--panel2)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 28px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#3B6EF5', letterSpacing: '.06em' }}>BUILT & USED IN-HOUSE</div>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,36px)', lineHeight: 1.2, fontWeight: 800, letterSpacing: '-.035em', margin: '14px 0 0' }}>우리가 첫 번째 고객입니다</h2>
          <p style={{ fontSize: 15, color: 'var(--ink2)', margin: '12px 0 0', maxWidth: 640, lineHeight: 1.6 }}>유어애즈는 지역 커머스 유어딜(urdeal.kr)을 운영하는 유어팀이 자기 사업에 쓰려고 만든 도구입니다. 팔기 전에 우리가 먼저 매일 검증합니다.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: 20, marginTop: 36 }}>
            {[
              { m: '41,000+', h: '인플루언서 풀 자체 구축', q: '유튜브·네이버 블로그의 지역 크리에이터를 매시간 자동 수집합니다. 유어애즈 협찬 매칭 대행이 파는 건 이 실제 재고입니다.' },
              { m: '매일 밤', h: '사람 없이 도는 데이터 정비', q: '중복 통합, 브랜드 계정 걸러내기, 활동성 재측정, 리드 점수화(0~100)가 매일 밤 자동으로 돌아 풀이 스스로 깨끗해집니다.' },
              { m: '유어딜 실사용', h: '매장 협찬 영업에 매일 사용', q: '유어딜 입점 매장의 지역 인플루언서 협찬 제안을 유어애즈로 직접 돌립니다. 도구가 멈추면 우리 영업이 멈추는 구조라, 안 돌아가는 기능이 없습니다.' },
            ].map((c) => (
              <div key={c.h} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, padding: 26 }}>
                <div className="num grad" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em' }}>{c.m}</div>
                <div style={{ fontSize: 15, fontWeight: 700, margin: '12px 0 0' }}>{c.h}</div>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink2)', margin: '8px 0 0' }}>{c.q}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING — 정직한 베타 구조(구매 불가능한 가상 요금 카드 금지) ── */}
      <section id="pricing" style={{ maxWidth: 1200, margin: '0 auto', padding: '84px 28px' }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12.5, fontWeight: 600, color: '#3B6EF5', letterSpacing: '.06em' }}>PRICING</div><h2 style={{ fontSize: 'clamp(28px,3.4vw,38px)', lineHeight: 1.18, fontWeight: 800, letterSpacing: '-.035em', margin: '14px 0 0' }}>지금은 베타 — 도구는 무료입니다</h2><p style={{ fontSize: 16, color: 'var(--ink2)', margin: '14px 0 0' }}>승인제로 운영합니다. 카드 등록 없이 전 기능을 쓰고, 정식 출시 시 베타 참여 계정에 우선 혜택을 드립니다.</p></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px,100%),1fr))', gap: 20, marginTop: 44, alignItems: 'start' }}>
          {/* 베타(도구) */}
          <div style={{ border: '1.5px solid #3B6EF5', borderRadius: 16, padding: 30, background: 'var(--panel)', position: 'relative', boxShadow: '0 24px 60px -30px rgba(59,110,245,.55)' }}>
            <span style={{ position: 'absolute', top: -12, left: 30, fontSize: 11, fontWeight: 700, color: '#fff', background: 'linear-gradient(96deg,#3B6EF5,#8B5CF6)', padding: '5px 11px', borderRadius: 999 }}>지금 이용 가능</span>
            <div style={{ fontSize: 15, fontWeight: 700 }}>베타 · 도구 전 기능</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>자동입찰 · 키워드 · 모니터링 · AI</div>
            <div style={{ margin: '22px 0 0', display: 'flex', alignItems: 'baseline', gap: 4 }}><span className="num" style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.03em' }}>₩0</span><span style={{ fontSize: 14, color: 'var(--muted)' }}>/베타 기간</span></div>
            <Link to={loginHref} style={{ display: 'block', textAlign: 'center', marginTop: 22, fontSize: 14, fontWeight: 600, color: '#fff', background: '#3B6EF5', padding: 12, borderRadius: 9 }}>가입하고 입장 요청</Link>
            <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5, color: 'var(--ink-strong)' }}>
              <li style={{ display: 'flex', gap: 9 }}><Check size={17} />자동입찰 · 키워드 확장 · 통합 실적</li>
              <li style={{ display: 'flex', gap: 9 }}><Check size={17} />순위·가격 모니터링 · 부정클릭 방어</li>
              <li style={{ display: 'flex', gap: 9 }}><Check size={17} />AI 마케터 · 주간 리포트</li>
              <li style={{ display: 'flex', gap: 9 }}><Check size={17} />승인제 입장 — 가입 후 원클릭 요청</li>
            </ul>
          </div>
          {/* 대행 서비스(서비스몰) */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 30, background: 'var(--panel)' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>대행 서비스</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>직접 돌릴 시간이 없는 사장님</div>
            <div style={{ margin: '22px 0 0', display: 'flex', alignItems: 'baseline', gap: 6 }}><span className="num" style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.03em' }}>건당</span><span style={{ fontSize: 14, color: 'var(--muted)' }}>서비스몰 주문</span></div>
            <Link to="/ads/dashboard?tab=services" style={{ display: 'block', textAlign: 'center', marginTop: 22, fontSize: 14, fontWeight: 600, color: 'var(--ink)', border: '1px solid var(--btn-bd)', padding: 12, borderRadius: 9 }}>서비스몰 보기</Link>
            <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5, color: 'var(--ink-strong)' }}>
              <li style={{ display: 'flex', gap: 9 }}><Check size={17} />지역 인플루언서 리스트업</li>
              <li style={{ display: 'flex', gap: 9 }}><Check size={17} />협찬 제안 발송 대행(회신 1차 응대)</li>
              <li style={{ display: 'flex', gap: 9 }}><Check size={17} />카드 결제(토스) 지원</li>
            </ul>
          </div>
          {/* 에이전시 */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 30, background: 'var(--panel)' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>에이전시</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>여러 고객사를 관리하는 대행사</div>
            <div style={{ margin: '22px 0 0', display: 'flex', alignItems: 'baseline', gap: 6 }}><span className="num" style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.03em' }}>문의</span><span style={{ fontSize: 14, color: 'var(--muted)' }}>맞춤 견적</span></div>
            <a href={CONTACT} style={{ display: 'block', textAlign: 'center', marginTop: 22, fontSize: 14, fontWeight: 600, color: 'var(--ink)', border: '1px solid var(--btn-bd)', padding: 12, borderRadius: 9 }}>영업팀 문의</a>
            <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5, color: 'var(--ink-strong)' }}>
              <li style={{ display: 'flex', gap: 9 }}><Check size={17} />멀티테넌트 · 고객사 전환</li>
              <li style={{ display: 'flex', gap: 9 }}><Check size={17} />고객사별 실적·자동입찰 분리</li>
              <li style={{ display: 'flex', gap: 9 }}><Check size={17} />도입 상담 · 맞춤 조건</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ borderTop: '1px solid var(--line)', background: 'var(--panel2)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '80px 28px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: '#3B6EF5', letterSpacing: '.06em' }}>FAQ</div><h2 style={{ fontSize: 'clamp(26px,3.2vw,34px)', lineHeight: 1.2, fontWeight: 800, letterSpacing: '-.035em', margin: '14px 0 0' }}>자주 묻는 질문</h2></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { open: true, q: '네이버 약관에 위배되지 않나요?', a: 'UR Ads는 네이버가 공식 제공하는 검색광고 API를 통해 동작합니다. 화면을 긁어오는 크롤링 방식이 아니므로 안심하고 사용하실 수 있습니다. 순위는 공식 API 기반 추정치로 제공됩니다.' },
              { open: false, q: '자동입찰로 광고비가 갑자기 늘 수 있나요?', a: '아니요. 키워드별 최대 입찰가(상한가)를 직접 정하므로, 어떤 경우에도 설정한 금액을 넘지 않습니다. 일/월 예산 한도도 함께 설정할 수 있습니다.' },
              { open: false, q: '광고 계정 연동은 얼마나 걸리나요?', a: '검색광고 API 인증 정보를 한 번 입력하면 연동이 완료됩니다. 보통 1분이면 캠페인·키워드·실적이 모두 동기화됩니다. (스토어 발주 수집 연동은 준비 중입니다.)' },
              { open: false, q: '승인제는 어떻게 진행되나요?', a: '가입(카카오 3초 또는 이메일) 후 "입장 요청" 버튼을 누르면 접수됩니다. 운영팀이 확인 후 승인하며, 승인되면 다시 로그인할 때 자동으로 대시보드에 입장됩니다. 베타 기간 도구 이용은 무료입니다.' },
              { open: false, q: '대행사인데 여러 고객사를 관리할 수 있나요?', a: '멀티테넌트를 지원합니다. 고객사를 추가하고 상단 셀렉터로 즉시 전환하며 관리할 수 있습니다. 도입 조건은 영업팀 문의로 안내드립니다.' },
            ].map((f) => (
              <details key={f.q} open={f.open} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '4px 20px' }}>
                <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', fontSize: 15.5, fontWeight: 600 }}>{f.q}<span className="fp" style={{ fontSize: 20, color: '#3B6EF5', transition: 'transform .2s', lineHeight: 1 }}>+</span></summary>
                <div style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink2)', padding: '0 0 18px' }}>{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA (dark) ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '90px 28px' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, background: 'radial-gradient(90% 140% at 50% -20%,#1c2a78 0%,#0e1430 48%,#0a0e1f 80%)', padding: '70px 48px', textAlign: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(1px 1px at 25% 40%,#fff,transparent),radial-gradient(1px 1px at 70% 60%,#cdd6ff,transparent),radial-gradient(1px 1px at 50% 25%,#fff,transparent)', opacity: .4, pointerEvents: 'none' }} />
          <h2 style={{ position: 'relative', fontSize: 'clamp(30px,4vw,46px)', lineHeight: 1.14, fontWeight: 800, letterSpacing: '-.04em', margin: 0, color: '#fff' }}>광고비 낭비를 멈추는 가장<br /><span className="grad">빠른 시작.</span></h2>
          <p style={{ position: 'relative', fontSize: 17, color: '#AEB7D0', margin: '18px auto 0', maxWidth: 460 }}>목표 순위만 정하세요. 나머지는 UR Ads가 자동으로. 베타 기간 무료, 카드 등록 없이 시작합니다.</p>
          <div style={{ position: 'relative', display: 'flex', gap: 13, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
            <a href={loggedIn ? APP : `/auth/kakao/start?redirect=${encodeURIComponent('/ads/kakao')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#191919', background: '#FEE500', padding: '15px 28px', borderRadius: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#191919" aria-hidden><path d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.65l-.95 3.54c-.08.31.27.56.54.38l4.19-2.79c.51.05 1.03.08 1.56.08 5.52 0 10-3.54 10-7.86C22 6.54 17.52 3 12 3z" /></svg>
              {loggedIn ? '대시보드 열기' : '카카오로 3초 시작'}
            </a>
            <a href={CONTACT} style={{ fontSize: 15, fontWeight: 600, color: '#DCE3F2', border: '1px solid rgba(255,255,255,.18)', padding: '15px 26px', borderRadius: 10 }}>영업팀 문의</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '54px 28px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 36 }}>
            <div style={{ gridColumn: 'span 2', minWidth: 220 }}>
              <UrAdsLogo size={26} />
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '16px 0 0', maxWidth: 260 }}>네이버 광고·커머스를 한 곳에서 자동화하는 종합 마케팅 솔루션. 유어팀 그룹.</p>
            </div>
            <div><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>제품</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--ink2)' }}><a href="#features">자동입찰</a><a href="#features">부정클릭 방어</a><a href="#features">통합 실적</a><a href="#features">AI 마케터</a></div></div>
            <div><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>회사</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--ink2)' }}><a href="#features">소개</a><a href="#pricing">요금제</a><a href="#proof">고객사례</a><a href={CONTACT}>문의</a></div></div>
            <div><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>지원</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--ink2)' }}><a href={CONTACT}>도움말</a><a href={CONTACT}>문의하기</a><Link to={loginHref}>대시보드</Link></div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 44, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>© 2026 UR Ads · 유어팀(리스터코퍼레이션). All rights reserved.</span>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--muted)' }}><a href="/ads/terms">이용약관</a><a href="/ads/privacy">개인정보처리방침</a><span>네이버 공식 API 기반</span></div>
          </div>
        </div>
      </footer>
    </div>
  )
}
