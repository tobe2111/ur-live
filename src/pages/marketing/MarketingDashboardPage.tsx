import { useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import MarketingDashboardShell from '@/components/MarketingDashboardShell'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import SearchAdPanel from './SearchAdPanel'
import AutobidPanel from './AutobidPanel'
import ClickGuardPanel from './ClickGuardPanel'
import PricePanel from './PricePanel'
import SourcingPanel from './SourcingPanel'
import WeeklyReportPanel from './WeeklyReportPanel'
import AlertsPanel from './AlertsPanel'
import EfficiencyPanel from './EfficiencyPanel'
import RankPanel from './RankPanel'
import TrendPanel from './TrendPanel'
import SavedKeywordsPanel from './SavedKeywordsPanel'
import OpportunityPanel from './OpportunityPanel'
import ContentStudioPanel from './ContentStudioPanel'
import ServiceMarketplacePanel from './ServiceMarketplacePanel'
import ShortLinksPanel from './ShortLinksPanel'
import InfluencerDiscoveryPanel from './InfluencerDiscoveryPanel'
import InfluencerMatchingPanel from './InfluencerMatchingPanel'
import OnboardingChecklist from './OnboardingChecklist'
import { MATCHING_ENABLED, ADS_AI_HIDDEN } from '@/shared/feature-flags'
import LazyMount from './LazyMount'
import { DASH_TABS, SEC_TO_TAB } from './dashboard-tabs'
import HomeTab from './dashboard/HomeTab'
import DemoPreview from './dashboard/DemoPreview'
import { warmServices } from './services-warm'
import KeywordToolsSection from './dashboard/KeywordToolsSection'
import StoreOrdersSection from './dashboard/StoreOrdersSection'
import AiMarketerSection from './dashboard/AiMarketerSection'

/**
 * 🆕 2026-06-26 통합 마케팅 서비스 — 멀티테넌트 입점 대시보드.
 *   tenant = 유어애즈 독립 계정(ads_token / ad_accounts.id). 셀러/카카오/유어딜·도매몰과 무관.
 *   owner_type='marketing' 으로 도매(supplier/distributor) 연결과 격리.
 *
 * 🗂️ 2026-07-27 탭 재편(대표 "너무 투박, 한 페이지에 다 몰아넣음, 가시적이지 않음"):
 *   패널 18개 단일 스크롤 → 기능 그룹 7탭(?tab= URL SSOT, dashboard-tabs.tsx). 활성 탭 패널만 렌더.
 *   옛 앵커(#sec-*)·결제 리턴(?adsPaySvc)은 해당 탭으로 자동 매핑(하위호환 — 온보딩/결제확정 보존).
 *   큰 인라인 블록(키워드도구/발주수집/AI마케터)은 dashboard/ 섹션 컴포넌트로 추출(600줄 캡).
 */
export default function MarketingDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sp, setSp] = useSearchParams()
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('ads_token')
  // 체험단 매칭은 어드민 전용 내부 도구 — 플랫폼 어드민(admin_token) 로그인 시만 노출/호출.
  const isAdminOperator = typeof window !== 'undefined' && !!localStorage.getItem('admin_token')

  const rawTab = sp.get('tab') || 'home'
  const tab = DASH_TABS.some((t) => t.id === rawTab) ? rawTab : 'home'

  // ⚡ 서비스몰 선워밍 — 대시보드 진입 시 서비스 목록을 미리 요청(콜드 ur-ads 워커 웜업 겸).
  //   탭 클릭 시 패널이 같은 in-flight 를 이어받아 즉시 표시(대표 "서비스몰이 늦게 떠" 수리).
  useEffect(() => { if (hasToken) warmServices() }, [hasToken])

  // 베타 액세스 코드 게이트: 로그인했지만 미해제면 코드 입력 화면으로(직접/북마크 진입 방어).
  //   캐시('ads_unlocked'==='1')면 즉시 통과, 아니면 서버 확인 후 분기.
  useEffect(() => {
    if (!hasToken || localStorage.getItem('ads_unlocked') === '1') return
    let cancelled = false
    api.get('/api/ads/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('ads_token')}` } })
      .then((r) => {
        if (cancelled) return
        if (r.data?.account?.access_unlocked === 1) localStorage.setItem('ads_unlocked', '1')
        else navigate('/ads/unlock', { replace: true })
      })
      .catch(() => { /* /me 실패는 게이트 강제 안 함(네트워크 일시오류) — 다음 진입에서 재확인 */ })
    return () => { cancelled = true }
  }, [hasToken, navigate])

  // 딥링크 하위호환 ①: 토스 결제 리턴(?adsPaySvc/?adsPayFail)은 서비스몰 탭 강제 —
  //   ServiceMarketplacePanel 이 마운트돼야 결제 확정(confirm) effect 가 실행됨(누락 시 미확정!).
  // ②: 옛 앵커(#sec-*) 북마크/온보딩 링크는 해당 탭으로 치환 후 섹션 스크롤.
  useEffect(() => {
    if ((sp.has('adsPaySvc') || sp.has('adsPayFail')) && tab !== 'services') {
      const next = new URLSearchParams(sp); next.set('tab', 'services'); setSp(next, { replace: true })
      return
    }
    const anchor = location.hash.replace('#', '')
    const mapped = SEC_TO_TAB[anchor]
    if (mapped && mapped !== tab) {
      const next = new URLSearchParams(sp); next.set('tab', mapped); setSp(next, { replace: true })
      setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    }
    // sp/tab 최신값만 필요 — 결제 리턴·해시는 마운트/URL 변경 시 1회 처리면 충분.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, sp])

  // 온보딩/홈 런처의 이동 — 앵커면 탭 매핑 후 스크롤, 탭 id 면 그대로 전환.
  const goTab = (idOrAnchor: string) => {
    const target = SEC_TO_TAB[idOrAnchor] || idOrAnchor
    const next = new URLSearchParams(sp); next.set('tab', target); setSp(next)
    try { window.scrollTo({ top: 0 }) } catch { /* ignore */ }
    if (SEC_TO_TAB[idOrAnchor]) setTimeout(() => document.getElementById(idOrAnchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }

  const tabMeta = DASH_TABS.find((t) => t.id === tab)

  return (
    <MarketingDashboardShell title={tabMeta?.label === '홈' ? '대시보드' : (tabMeta?.label || '대시보드')} showNav={hasToken}>
      <SEO title="유어애즈 UR Ads - 유어팀 종합 마케팅" description="네이버 검색광고 자동입찰 + 쇼핑몰 발주수집 + 키워드 — 유어팀 종합 마케팅 툴" url="/ads/dashboard" />
      {/* 2026-07-27 de-AI: 영문 대문자 mono 오버라인 제거 — 탭 설명만 간결히 */}
      {tab !== 'home' && <p className="text-[13px]" style={{ color: 'var(--ink2)' }}>{tabMeta?.desc || ''}</p>}

      {!hasToken && (
        <div className="mt-5 rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] p-4">
          <p className="text-[13px] text-gray-700 dark:text-gray-300">유어애즈 계정으로 로그인 후 이용할 수 있습니다. 가입은 1분이면 됩니다.</p>
          <div className="mt-3 flex gap-2">
            <a href="/ads/login" className="inline-block rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[13px] font-bold text-white dark:text-[#0F151D]">로그인</a>
            <a href="/ads/signup" className="inline-block rounded-lg border border-gray-300 dark:border-[#2A3446] px-4 py-2 text-[13px] font-bold text-gray-700 dark:text-gray-200">회원가입</a>
          </div>
        </div>
      )}

      {/* ── 🏠 홈: KPI 요약 + 온보딩 + 기능 런처 ─────────────────────────── */}
      {hasToken && tab === 'home' && (
        <>
          <OnboardingChecklist onGo={goTab} />
          <HomeTab onGo={goTab} />
        </>
      )}

      {/* ── 🔎 키워드: 도구/연관/평판 + 기회 발굴 + 포트폴리오 ────────────── */}
      {hasToken && tab === 'keywords' && (
        <div className="mt-4">
          <KeywordToolsSection />
          <LazyMount id="sec-opportunity"><OpportunityPanel /></LazyMount>
          <LazyMount id="sec-portfolio"><SavedKeywordsPanel /></LazyMount>
        </div>
      )}

      {/* ── 📊 광고 성과: 연동 → 추세 → 효율 → 자동입찰 → 리포트 ─────────── */}
      {hasToken && tab === 'performance' && (
        <div className="mt-4">
          {/* 🎬 미연동일 때만 — 연동 후엔 스스로 사라짐(실데이터가 대체) */}
          <DemoPreview />
          <section id="sec-searchad" style={{ scrollMarginTop: 76 }}><SearchAdPanel /></section>
          <section id="sec-trend" style={{ scrollMarginTop: 76 }}><TrendPanel /></section>
          <LazyMount id="sec-efficiency"><EfficiencyPanel /></LazyMount>
          <LazyMount id="sec-autobid"><AutobidPanel /></LazyMount>
          <LazyMount id="sec-report"><WeeklyReportPanel /></LazyMount>
        </div>
      )}

      {/* ── 🛡️ 모니터링: 순위 → 가격·소싱 → 알림 → 부정클릭 ──────────────── */}
      {hasToken && tab === 'monitoring' && (
        <div className="mt-4">
          <section id="sec-rank" style={{ scrollMarginTop: 76 }}><RankPanel /></section>
          <LazyMount id="sec-price"><PricePanel /><SourcingPanel /></LazyMount>
          <LazyMount id="sec-alerts"><AlertsPanel /></LazyMount>
          <LazyMount id="sec-fraud"><ClickGuardPanel /></LazyMount>
        </div>
      )}

      {/* ── ✨ AI 스튜디오: 콘텐츠 생성 + AI 마케터 (ADS_AI_HIDDEN 시 미노출 — 탭도 제거됨) ── */}
      {!ADS_AI_HIDDEN && hasToken && tab === 'ai' && (
        <div className="mt-4">
          <section id="sec-content" style={{ scrollMarginTop: 76 }}><ContentStudioPanel /></section>
          <AiMarketerSection />
        </div>
      )}

      {/* ── 🛍️ 서비스몰: 직접 마운트(결제 리턴 confirm effect 보장 — LazyMount 금지) ── */}
      {hasToken && tab === 'services' && (
        <div className="mt-4">
          <section id="sec-services" style={{ scrollMarginTop: 76 }}><ServiceMarketplacePanel /></section>
        </div>
      )}

      {/* ── 🧰 부가 도구: 단축링크 → 인플루언서 발굴 → (어드민)매칭 → 발주수집 ── */}
      {hasToken && tab === 'tools' && (
        <div className="mt-4">
          <section id="sec-links" style={{ scrollMarginTop: 76 }}><ShortLinksPanel /></section>
          <LazyMount id="sec-influencers"><InfluencerDiscoveryPanel /></LazyMount>
          {MATCHING_ENABLED && isAdminOperator && <LazyMount id="sec-matching"><InfluencerMatchingPanel /></LazyMount>}
          <StoreOrdersSection />
        </div>
      )}
    </MarketingDashboardShell>
  )
}
