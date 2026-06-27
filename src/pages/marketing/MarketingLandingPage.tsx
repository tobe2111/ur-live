/**
 * 🆕 2026-06-27 유어애즈(UR Ads) — 라이트 테마 랜딩(소개) 페이지.
 *
 *   유어팀의 3번째 서비스(유어딜=소비자 / 유통스타트=도매 / 유어애즈=마케팅)의 공개 세일즈 표면.
 *   브리프: docs/design/urads-service-page-brief.md
 *   레퍼런스(보라웨어식 흐름): docs/design/urads-boraware-reference.md
 *
 *   흐름: 가입혜택 3컬럼 → 히어로 → 공식 API 신뢰바 → 기능 6블록(좌/우 교차) →
 *         차별점("왜 유어애즈") → 요금제 표 → FAQ → 최종 CTA(14일 무료체험) → 푸터.
 *
 *   톤: 신뢰감 있는 B2B SaaS. "네이버 공식 API 기반"(크롤링 아님) 강조, 과장 없는 수치.
 *   surface 분리: /ads (worker isMarketingSurface, App.tsx isMarketingSurface) — 소비자/도매 chrome 비노출.
 *   양모드 토큰(라이트 우선 + dark: variant) — 디자인 정체성은 라이트.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Gauge,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Bot,
  PackageCheck,
  CheckCircle2,
  Lock,
  Zap,
  TrendingDown,
  Plus,
  Minus,
} from 'lucide-react'
import SEO from '@/components/SEO'

const DASHBOARD_PATH = '/ads/dashboard'

/* ─────────────────────────── 기능 6블록 데이터 ─────────────────────────── */

const FEATURES = [
  {
    no: '01',
    key: 'autobid',
    icon: Gauge,
    title: '자동입찰',
    headline: '목표순위·최대입찰가만 정하세요',
    body: '나머지는 유어애즈가 합니다. 네이버 공식 추정치를 기반으로 24/365 입찰을 조정해 원하는 순위를 최저 CPC로 노출합니다.',
    bullets: ['목표순위 자동 유지', 'CPC 최대 15% 절감', '시간대·요일·지역 전략'],
  },
  {
    no: '02',
    key: 'clickguard',
    icon: ShieldCheck,
    title: '부정클릭 방어',
    headline: '광고비를 갉아먹는 의심 클릭, 자동 차단',
    body: '추적 픽셀로 방문 패턴을 분석해 의심 IP를 가려냅니다. 네이버 노출제한 IP에 바로 등록할 차단 목록을 만들어 드립니다.',
    bullets: ['의심 클릭 실시간 탐지', '차단 IP 목록 자동 생성', '절감 추정 리포트'],
  },
  {
    no: '03',
    key: 'keyword',
    icon: Sparkles,
    title: '키워드 확장',
    headline: '고성과 키워드를 무한 확장',
    body: '연관검색어·자동완성·키워드도구를 한 번에 긁어와 검색량·경쟁도와 함께 보여줍니다. 마음에 들면 원클릭으로 광고그룹에 등록.',
    bullets: ['연관키워드 + 검색량', '자동완성 발굴', '원클릭 자동 등록'],
  },
  {
    no: '04',
    key: 'stats',
    icon: BarChart3,
    title: '통합 실적',
    headline: '광고비 → 클릭 → 주문 → 매출, 한 화면',
    body: '흩어진 지표를 ROAS 퍼널 하나로 모읍니다. 매일·매주·매월 자동 리포트가 메일과 알림톡으로 도착합니다.',
    bullets: ['ROAS·CPA 퍼널', '기간 비교', '자동 정기 리포트'],
  },
  {
    no: '05',
    key: 'ai',
    icon: Bot,
    title: 'AI 마케터',
    headline: '데이터를 읽고 다음 액션을 제안',
    body: '자체 AI가 실적·키워드를 진단하고 "이 키워드 입찰을 올리세요" 같은 구체적 실행안을 제시합니다. 광고계정 연동 전에도 진단부터 시작.',
    bullets: ['실행 가능한 제안 카드', '예산·입찰 진단', '연동 0개여도 진단 가능'],
  },
  {
    no: '06',
    key: 'sourcing',
    icon: PackageCheck,
    title: '발주 수집',
    headline: '여러 스토어 주문을 한곳에',
    body: '연동한 스마트스토어의 주문을 자동으로 모아 한 리스트에서 발송 처리합니다. 매일 새벽, 빠진 주문 없이.',
    bullets: ['주문 자동 통합', '스토어 연동 상태', '발송 처리 한 화면'],
  },
] as const

/* ─────────────────────────── 요금제 ─────────────────────────── */

const PLANS = [
  {
    name: '스타트',
    desc: '처음 시작하는 1인 셀러',
    price: '무료',
    priceNote: '체험 14일',
    features: ['연관키워드 추천', '검색어 트렌드', '브랜드 평판 모니터링', '읽기 전용 진단'],
    cta: '무료로 시작',
    highlight: false,
  },
  {
    name: '일반',
    desc: '광고를 직접 돌리는 셀러',
    price: '₩39,000',
    priceNote: '월',
    features: ['스타트 전체 +', '자동입찰 엔진', '키워드 자동 등록', '통합 실적 리포트'],
    cta: '시작하기',
    highlight: true,
  },
  {
    name: '부스터',
    desc: '광고비를 본격적으로 쓰는 셀러',
    price: '₩89,000',
    priceNote: '월',
    features: ['일반 전체 +', '부정클릭 방어', 'AI 마케터 제안', '발주 수집'],
    cta: '시작하기',
    highlight: false,
  },
  {
    name: '대행 파트너',
    desc: '여러 고객사를 관리하는 에이전시',
    price: '맞춤',
    priceNote: '문의',
    features: ['멀티테넌트 전환', '고객사 통합 모니터링', '우선 지원', 'AI 자율 운영'],
    cta: '상담 신청',
    highlight: false,
  },
] as const

/* ─────────────────────────── FAQ ─────────────────────────── */

const FAQS = [
  {
    q: '네이버 순위를 어떻게 알아내나요? 크롤링인가요?',
    a: '아니요. 유어애즈는 네이버 검색광고 공식 API의 추정·통계 지표만 사용합니다. 검색결과 페이지를 긁는 스크래핑은 하지 않습니다(법적 리스크 회피). 순위는 공식 추정치 기반임을 그대로 안내합니다.',
  },
  {
    q: '광고계정을 꼭 연동해야 쓸 수 있나요?',
    a: '연관키워드·트렌드·평판 모니터링·AI 진단 같은 읽기 기능은 광고계정 연동 없이도 바로 사용할 수 있습니다. 입찰 자동 변경·키워드 등록·IP 차단 같은 쓰기 기능만 검색광고 계정 연동이 필요합니다.',
  },
  {
    q: '자동입찰이 입찰가를 과도하게 올리지 않을까요?',
    a: '입찰 변경에는 하드캡(상·하한)과 킬스위치, dry-run 로그가 적용됩니다. 사용자가 정한 최대입찰가를 절대 넘지 않으며, 모든 변경은 기록으로 남습니다.',
  },
  {
    q: '대행사도 쓸 수 있나요?',
    a: '네. 멀티테넌트 구조로 고객사를 전환하며 관리할 수 있고, 입찰·키워드·부정클릭·통합실적 운영 상황을 한 화면에서 모니터링합니다.',
  },
] as const

/* ─────────────────────────── 컴포넌트 ─────────────────────────── */

export default function MarketingLandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white">
      <SEO
        title="유어애즈 UR Ads — 광고 입찰부터 발주까지, 하나로 자동화"
        description="네이버 검색광고·커머스를 한곳에서 자동화하는 B2B 종합 마케팅 솔루션. 자동입찰으로 CPC 최대 15% 절감, 부정클릭 방어, 키워드 확장, 통합 실적, AI 마케터. 네이버 공식 API 기반."
        url="/ads"
        type="website"
      />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 bg-white/90 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A] px-4 lg:px-12 py-3.5 flex items-center justify-between">
        <Link to="/ads" className="flex items-baseline gap-1.5">
          <span className="text-[17px] font-extrabold tracking-tight text-gray-900 dark:text-white">유어애즈</span>
          <span className="text-[12px] font-bold text-gray-400 dark:text-gray-500">UR Ads</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="#features" className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">기능</a>
          <a href="#pricing" className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">요금</a>
          <Link
            to={DASHBOARD_PATH}
            className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
          >
            무료로 시작
          </Link>
        </div>
      </nav>

      {/* ── 가입혜택 3컬럼 스트립 ── */}
      <div className="bg-gray-50 dark:bg-[#121212] border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="mx-auto max-w-6xl px-4 lg:px-12 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-[13px]">
          <div className="flex items-center justify-center gap-1.5 text-gray-700 dark:text-gray-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 14일 무료체험 · 카드 불필요
          </div>
          <div className="flex items-center justify-center gap-1.5 text-gray-700 dark:text-gray-300">
            <Lock className="w-4 h-4 text-emerald-500" /> 네이버 공식 API · 크롤링 없음
          </div>
          <div className="flex items-center justify-center gap-1.5 text-gray-700 dark:text-gray-300">
            <Zap className="w-4 h-4 text-emerald-500" /> 연동 없이도 바로 진단
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="px-4 lg:px-12 pt-16 lg:pt-24 pb-12 lg:pb-16">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1A1A1A] rounded-full px-3 py-1 mb-5">
              <Sparkles className="w-3.5 h-3.5" /> 유어팀 종합 마케팅 솔루션
            </p>
            <h1 className="text-[34px] leading-[1.15] sm:text-5xl lg:text-[56px] lg:leading-[1.1] font-extrabold tracking-tight text-gray-900 dark:text-white">
              광고 입찰부터 발주까지,<br />
              <span className="text-gray-900 dark:text-white">하나로 자동화</span>
            </h1>
            <p className="mt-5 text-base lg:text-lg text-gray-600 dark:text-gray-300 max-w-xl">
              네이버 검색광고와 커머스를 한곳에서. 자동입찰으로 광고비를 줄이고, 흩어진 실적을 ROAS 한 화면으로 모읍니다.
              <span className="font-semibold text-gray-900 dark:text-white"> 네이버 공식 API 기반</span>이라 안심하세요.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={DASHBOARD_PATH}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-extrabold text-base hover:opacity-90 transition-opacity"
              >
                14일 무료로 시작 <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-6 py-3.5 border border-gray-200 dark:border-[#2A2A2A] text-gray-800 dark:text-gray-200 rounded-full font-bold text-base hover:border-gray-300 dark:hover:border-[#3A3A3A] transition-colors"
              >
                기능 둘러보기
              </a>
            </div>
            {/* 핵심 수치 칩 */}
            <div className="mt-9 grid grid-cols-3 gap-3 max-w-md">
              {[
                { v: '최대 15%↓', l: 'CPC 절감' },
                { v: '24/365', l: '자동 입찰' },
                { v: '공식 API', l: '합법 · 안심' },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-gray-100 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#121212] px-3 py-4 text-center">
                  <div className="text-lg lg:text-xl font-extrabold text-gray-900 dark:text-white">{s.v}</div>
                  <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero 목업 — 자동입찰 미니 대시보드 */}
          <div className="relative">
            <div className="rounded-3xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] shadow-xl shadow-gray-200/50 dark:shadow-black/40 overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A]">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-[#2A2A2A]" />
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-[#2A2A2A]" />
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-[#2A2A2A]" />
                <span className="ml-2 text-[11px] text-gray-400 dark:text-gray-500">유어애즈 · 자동입찰</span>
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-gray-500 px-1">
                  <span className="flex-1">키워드</span>
                  <span className="w-12 text-right">목표</span>
                  <span className="w-12 text-right">현재</span>
                  <span className="w-16 text-right">CPC</span>
                </div>
                {[
                  { k: '무선이어폰', goal: 2, now: 2, cpc: '420', good: true },
                  { k: '블루투스이어폰', goal: 3, now: 3, cpc: '380', good: true },
                  { k: '게이밍이어폰', goal: 1, now: 2, cpc: '610', good: false },
                  { k: '노이즈캔슬링', goal: 2, now: 2, cpc: '450', good: true },
                ].map((r) => (
                  <div key={r.k} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-[#1A1A1A] px-3 py-2.5 text-[13px]">
                    <span className="flex-1 font-medium text-gray-800 dark:text-gray-100 truncate">{r.k}</span>
                    <span className="w-12 text-right text-gray-500 dark:text-gray-400">{r.goal}위</span>
                    <span className={`w-12 text-right font-semibold ${r.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{r.now}위</span>
                    <span className="w-16 text-right font-mono text-gray-700 dark:text-gray-200">₩{r.cpc}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1 text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <TrendingDown className="w-4 h-4" /> 이번 주 평균 CPC 12.4% 절감
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 공식 API 신뢰 바 ── */}
      <section className="bg-gray-900 dark:bg-[#121212] text-white px-4 lg:px-12 py-5">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center text-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">모든 데이터는 네이버 검색광고·오픈 API 공식 채널만 사용합니다.</span>
          <span className="text-gray-300 dark:text-gray-400">검색결과 크롤링 없음 · 개인정보 처리방침 준수</span>
        </div>
      </section>

      {/* ── 기능 6블록 (좌/우 교차) ── */}
      <section id="features" className="px-4 lg:px-12 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="text-sm font-bold tracking-wide text-gray-400 dark:text-gray-500 mb-2">FEATURES</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white">필요한 모든 마케팅 자동화, 한 곳에서</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">광고를 처음 돌리는 1인 셀러부터, 수십 개 계정을 관리하는 대행사까지.</p>
          </div>

          <div className="space-y-16 lg:space-y-24">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              const reverse = i % 2 === 1
              return (
                <div key={f.key} className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
                  {/* 텍스트 */}
                  <div className={reverse ? 'lg:order-2' : ''}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="text-sm font-extrabold tracking-widest text-gray-300 dark:text-gray-600">{f.no}</span>
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{f.title}</span>
                    </div>
                    <h3 className="text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white leading-snug">{f.headline}</h3>
                    <p className="mt-4 text-gray-600 dark:text-gray-300 text-base lg:text-lg max-w-xl">{f.body}</p>
                    <ul className="mt-6 space-y-2.5">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2.5 text-gray-800 dark:text-gray-100">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          <span className="font-medium">{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 미니 시각화 목업 */}
                  <div className={reverse ? 'lg:order-1' : ''}>
                    <FeatureMock featureKey={f.key} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 차별점: 왜 유어애즈 ── */}
      <section className="bg-gray-50 dark:bg-[#121212] border-y border-gray-100 dark:border-[#1A1A1A] px-4 lg:px-12 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white">왜 유어애즈인가</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: Bot, t: '자체 AI 보유', d: '외부 의존 없이 데이터를 진단하고 실행안을 제시합니다. AI 마케터가 연동 0개여도 먼저 일합니다.' },
              { icon: ShieldCheck, t: '공식 API · 합법', d: '크롤링 대신 네이버 공식 API만 사용해 계정 정지·법적 리스크를 구조적으로 피합니다.' },
              { icon: BarChart3, t: '입찰부터 발주까지 통합', d: '광고·키워드·부정클릭·실적·주문을 한 대시보드에서. 도구를 옮겨 다닐 필요가 없습니다.' },
            ].map((c) => {
              const Icon = c.icon
              return (
                <div key={c.t} className="rounded-2xl bg-white dark:bg-[#0A0A0A] border border-gray-100 dark:border-[#1A1A1A] p-6">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 mb-4">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">{c.t}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{c.d}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 요금제 ── */}
      <section id="pricing" className="px-4 lg:px-12 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="text-sm font-bold tracking-wide text-gray-400 dark:text-gray-500 mb-2">PRICING</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white">규모에 맞춰 시작하세요</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">모든 플랜은 14일 무료체험 · 약정 없음 · 언제든 해지.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-3xl border p-6 flex flex-col ${
                  p.highlight
                    ? 'border-gray-900 dark:border-white bg-white dark:bg-[#121212] shadow-xl shadow-gray-200/60 dark:shadow-black/40'
                    : 'border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A]'
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-bold">
                    가장 인기
                  </span>
                )}
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{p.name}</h3>
                <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 min-h-[34px]">{p.desc}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white">{p.price}</span>
                  <span className="text-[13px] text-gray-400 dark:text-gray-500">{p.priceNote}</span>
                </div>
                <ul className="mt-5 space-y-2.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={DASHBOARD_PATH}
                  className={`mt-6 inline-flex items-center justify-center px-4 py-2.5 rounded-full font-bold text-sm transition-opacity hover:opacity-90 ${
                    p.highlight
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'border border-gray-200 dark:border-[#2A2A2A] text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
            ※ 표시 금액은 예시이며 실제 요금은 베타 종료 시 확정됩니다.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-gray-50 dark:bg-[#121212] border-y border-gray-100 dark:border-[#1A1A1A] px-4 lg:px-12 py-16 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white">자주 묻는 질문</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((item, i) => {
              const open = openFaq === i
              return (
                <div key={item.q} className="rounded-2xl bg-white dark:bg-[#0A0A0A] border border-gray-100 dark:border-[#1A1A1A] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={open}
                  >
                    <span className="font-bold text-gray-900 dark:text-white text-[15px]">{item.q}</span>
                    {open ? (
                      <Minus className="w-5 h-5 text-gray-400 shrink-0" />
                    ) : (
                      <Plus className="w-5 h-5 text-gray-400 shrink-0" />
                    )}
                  </button>
                  {open && (
                    <p className="px-5 pb-5 -mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{item.a}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 최종 CTA ── */}
      <section className="px-4 lg:px-12 py-20 lg:py-28 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
            오늘 연결하고,<br />이번 주 광고비부터 줄이세요.
          </h2>
          <p className="mt-5 text-lg text-gray-600 dark:text-gray-300">
            카드 등록 없이 14일 무료. 연동 없이도 진단부터 바로 시작할 수 있습니다.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={DASHBOARD_PATH}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-extrabold text-lg hover:opacity-90 transition-opacity"
            >
              무료로 시작하기 <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">신용카드 불필요 · 약정 없음 · 네이버 공식 API 기반</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-4 lg:px-12 py-10 border-t border-gray-100 dark:border-[#1A1A1A]">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400 dark:text-gray-500">
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-gray-700 dark:text-gray-300">유어애즈</span>
            <span className="font-bold">UR Ads</span>
            <span className="ml-2">유어팀 종합 마케팅</span>
          </div>
          <div className="text-center sm:text-right">
            © 2026 리스터코퍼레이션 · 네이버 공식 API 기반 마케팅 솔루션 ·{' '}
            <a href="mailto:jiwon@ur-team.com" className="underline">jiwon@ur-team.com</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ─────────────────────────── 기능별 미니 시각화 목업 ─────────────────────────── */

function MockCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] shadow-lg shadow-gray-200/50 dark:shadow-black/30 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-[#1A1A1A] text-[11px] font-semibold text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function FeatureMock({ featureKey }: { featureKey: string }) {
  switch (featureKey) {
    case 'autobid':
      return (
        <MockCard label="자동입찰 · 시간대 전략">
          <div className="space-y-2">
            {[
              { t: '오전 9–12시', s: '피크 전략', w: 'w-5/6' },
              { t: '오후 12–18시', s: '균형 전략', w: 'w-2/3' },
              { t: '저녁 18–24시', s: '마감 부스트', w: 'w-full' },
            ].map((r) => (
              <div key={r.t} className="rounded-xl bg-gray-50 dark:bg-[#1A1A1A] px-3 py-2.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-gray-800 dark:text-gray-100">{r.t}</span>
                  <span className="text-gray-500 dark:text-gray-400">{r.s}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-[#2A2A2A] overflow-hidden">
                  <div className={`h-full ${r.w} rounded-full bg-gray-900 dark:bg-white`} />
                </div>
              </div>
            ))}
          </div>
        </MockCard>
      )
    case 'clickguard':
      return (
        <MockCard label="부정클릭 · 차단 IP">
          <div className="space-y-2">
            {[
              { ip: '211.45.xx.xx', n: 27, b: true },
              { ip: '118.220.xx.xx', n: 14, b: true },
              { ip: '175.223.xx.xx', n: 9, b: false },
            ].map((r) => (
              <div key={r.ip} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-[#1A1A1A] px-3 py-2.5 text-[13px]">
                <span className="font-mono text-gray-700 dark:text-gray-200">{r.ip}</span>
                <span className="text-gray-500 dark:text-gray-400">{r.n}회</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.b ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                  {r.b ? '차단' : '관찰'}
                </span>
              </div>
            ))}
            <div className="pt-1 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">이번 달 ₩214,000 절감 추정</div>
          </div>
        </MockCard>
      )
    case 'keyword':
      return (
        <MockCard label="키워드 확장 · 연관키워드">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-gray-500 px-1">
              <span className="flex-1">키워드</span><span className="w-16 text-right">월검색량</span><span className="w-12 text-right">경쟁</span>
            </div>
            {[
              { k: '캠핑의자', v: '49,200', c: '중간' },
              { k: '경량 캠핑의자', v: '12,800', c: '낮음' },
              { k: '릴렉스 체어', v: '8,100', c: '낮음' },
              { k: '감성캠핑 의자', v: '5,400', c: '낮음' },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-[#1A1A1A] px-3 py-2 text-[13px]">
                <span className="flex-1 font-medium text-gray-800 dark:text-gray-100">{r.k}</span>
                <span className="w-16 text-right font-mono text-gray-600 dark:text-gray-300">{r.v}</span>
                <span className="w-12 text-right text-gray-500 dark:text-gray-400">{r.c}</span>
              </div>
            ))}
          </div>
        </MockCard>
      )
    case 'stats':
      return (
        <MockCard label="통합 실적 · ROAS 퍼널">
          <div className="space-y-2.5">
            {[
              { t: '광고비', v: '₩1,240,000', w: 'w-1/3' },
              { t: '클릭', v: '8,420', w: 'w-1/2' },
              { t: '주문', v: '312', w: 'w-2/3' },
              { t: '매출', v: '₩9,180,000', w: 'w-full' },
            ].map((r) => (
              <div key={r.t}>
                <div className="flex items-center justify-between text-[13px] mb-1">
                  <span className="text-gray-600 dark:text-gray-300">{r.t}</span>
                  <span className="font-bold text-gray-900 dark:text-white">{r.v}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-[#2A2A2A] overflow-hidden">
                  <div className={`h-full ${r.w} rounded-full bg-gray-900 dark:bg-white`} />
                </div>
              </div>
            ))}
            <div className="pt-1 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">ROAS 740%</div>
          </div>
        </MockCard>
      )
    case 'ai':
      return (
        <MockCard label="AI 마케터 · 제안">
          <div className="space-y-2.5">
            <div className="rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 text-[13px] leading-relaxed">
              ‘무선이어폰’ 키워드의 전환율이 평균보다 2.1배 높아요. 입찰가를 ₩420 → ₩480으로 올리면 노출 점유율이 늘어날 것으로 보입니다.
            </div>
            <div className="flex gap-2">
              <span className="flex-1 text-center text-[12px] font-bold rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-2">적용</span>
              <span className="flex-1 text-center text-[12px] font-bold rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-300 py-2">나중에</span>
            </div>
          </div>
        </MockCard>
      )
    case 'sourcing':
      return (
        <MockCard label="발주 수집 · 통합 주문">
          <div className="space-y-2">
            {[
              { s: '스마트스토어 A', p: '캠핑의자 2EA', st: '신규' },
              { s: '스마트스토어 B', p: '릴렉스 체어 1EA', st: '신규' },
              { s: '스마트스토어 A', p: '경량의자 3EA', st: '발송' },
            ].map((r, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-[#1A1A1A] px-3 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{r.p}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500">{r.s}</div>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.st === '신규' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                  {r.st}
                </span>
              </div>
            ))}
          </div>
        </MockCard>
      )
    default:
      return null
  }
}
