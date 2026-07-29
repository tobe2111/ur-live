/**
 * 🧭 서비스 소개 랜딩 — /about (2026-07-19 대표 "웹페이지 3종" ② — 소비자·제휴처(재단·지자체·에이전시) 겸용 1페이지)
 *   한 줄 정의 → 소비자 혜택 → 3자 구조도(매장·인플루언서·소비자) → 실적/보도 placeholder(10월 방배 실측 교체)
 *   → 앱 진입 CTA. 기존 상세 소개서(구 AboutPage, 인쇄/PDF 지원)는 /about/print 로 보존 — 하단 링크.
 *   카피는 대표 별도 전달분으로 교체 예정. 브랜드 토큰: brand/#1A2C42/#FAF7F5.
 */
import { Link } from 'react-router-dom'
import { Store, Users, Megaphone, QrCode, BadgePercent, MapPin, ArrowRight, FileText } from 'lucide-react'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'

const BENEFITS = [
  { icon: BadgePercent, t: '동네 할인', d: '내 주변 맛집·뷰티·숙소를 정가보다 싸게' },
  { icon: QrCode, t: 'QR 간편 사용', d: '결제는 미리, 매장에선 QR 한 번이면 끝' },
  { icon: MapPin, t: '지도로 발견', d: '지금 내 위치 주변의 딜을 지도에서 바로' },
]

const TRIANGLE = [
  { icon: Store, t: '매장', d: '선불 광고비 없이 새 손님 — 팔린 만큼만 수수료 5%' },
  { icon: Megaphone, t: '인플루언서', d: '링크 하나로 동네 딜을 소개하고 판매 커미션' },
  { icon: Users, t: '소비자', d: '검증된 동네 가게를 할인가로, QR 로 간편하게' },
]

export default function AboutServicePage() {
  return (
    <div className="min-h-[100dvh] bg-[#FAF7F5] dark:bg-[#0F151D]">
      <SEO title="서비스 소개 - 유어딜" description="유어딜은 동네 가게의 할인 이용권을 앱에서 사고 매장에서 QR 로 쓰는 로컬 딜 플랫폼입니다." url="/about" />
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-12 bg-[#FAF7F5]/90 dark:bg-[#0F151D]/90 backdrop-blur-sm">
        <Link to="/" aria-label="유어딜 홈"><UrDealLogo size={18} /></Link>
        <div className="flex items-center gap-3">
          <Link to="/partners" className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">입점 안내</Link>
          <Link to="/creators" className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">크리에이터</Link>
        </div>
      </header>

      <main className="px-5 pb-32 max-w-xl mx-auto">
        {/* 한 줄 정의 */}
        <section className="pt-8 pb-10">
          <p className="text-[12px] font-extrabold tracking-widest text-brand mb-3">ABOUT URDEAL</p>
          <h1 className="text-[26px] leading-[1.35] font-extrabold text-[#1A2C42] dark:text-[#F5F3F1]">
            동네 가게의 할인 이용권을<br /><span className="text-brand">앱에서 사고, 매장에서 QR</span> 로 쓰는<br />로컬 딜 플랫폼
          </h1>
        </section>

        {/* 소비자 혜택 */}
        <section className="pb-10">
          <h2 className="text-[19px] font-extrabold text-[#1A2C42] dark:text-[#F5F3F1] mb-4">소비자에게는</h2>
          <div className="space-y-2.5">
            {BENEFITS.map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex items-center gap-3.5 rounded-2xl bg-white dark:bg-[#1A2334] p-4">
                <div className="w-9 h-9 rounded-xl bg-[var(--brand-tint)] dark:bg-[#3A2530] flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px] text-brand" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14.5px] font-extrabold text-[#1A2C42] dark:text-[#F5F3F1]">{t}</p>
                  <p className="text-[12.5px] text-gray-500 dark:text-gray-400 leading-snug">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3자 구조도 */}
        <section className="pb-10">
          <h2 className="text-[19px] font-extrabold text-[#1A2C42] dark:text-[#F5F3F1] mb-1">셋이 함께 커지는 구조</h2>
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mb-4">매장 · 인플루언서 · 소비자 — 누구도 먼저 돈을 내지 않습니다</p>
          <div className="grid grid-cols-3 gap-2">
            {TRIANGLE.map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl bg-white dark:bg-[#1A2334] p-3 text-center">
                <div className="w-9 h-9 mx-auto rounded-xl bg-[var(--brand-tint)] dark:bg-[#3A2530] flex items-center justify-center">
                  <Icon className="w-[18px] h-[18px] text-brand" />
                </div>
                <p className="text-[13px] font-extrabold text-[#1A2C42] dark:text-[#F5F3F1] mt-2">{t}</p>
                <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/partners" className="h-11 rounded-xl border border-[#1A2C42]/15 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] flex items-center justify-center text-[13px] font-bold text-[#1A2C42] dark:text-[#F5F3F1]">매장 입점 안내 →</Link>
            <Link to="/creators" className="h-11 rounded-xl border border-[#1A2C42]/15 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] flex items-center justify-center text-[13px] font-bold text-[#1A2C42] dark:text-[#F5F3F1]">크리에이터 모집 →</Link>
          </div>
        </section>

        {/* 실적/보도 — 10월 방배 실측으로 교체 예정 placeholder */}
        <section className="pb-10">
          <h2 className="text-[19px] font-extrabold text-[#1A2C42] dark:text-[#F5F3F1] mb-4">숫자와 이야기</h2>
          <div className="rounded-2xl bg-white dark:bg-[#1A2334] p-5">
            <div className="grid grid-cols-3 gap-2 text-center">
              {/* 📊 10월 방배 파일럿 실측치로 교체 예정 */}
              <div><p className="text-[18px] font-extrabold text-[#1A2C42] dark:text-[#F5F3F1]">서초구</p><p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">상권 활성화 사업 수행</p></div>
              <div><p className="text-[18px] font-extrabold text-[#1A2C42] dark:text-[#F5F3F1]">19조</p><p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">글로벌 동일 모델 시장</p></div>
              <div><p className="text-[18px] font-extrabold text-brand">준비 중</p><p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">방배 파일럿 실측 (10월)</p></div>
            </div>
            <p className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-4">보도·성과 자료는 파일럿 이후 이 자리에 업데이트됩니다.</p>
          </div>
          <Link to="/about/print" className="mt-3 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-[#1A2C42]/15 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] text-[13px] font-bold text-[#1A2C42] dark:text-[#F5F3F1]">
            <FileText className="w-4 h-4" /> 상세 소개서 보기 (PDF 저장 가능)
          </Link>
        </section>
      </main>

      {/* 하단 고정 CTA — 앱 진입 */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#0F151D]/95 backdrop-blur-md border-t border-gray-100 dark:border-[#2A3446] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto">
          <Link to="/" className="flex h-12 rounded-2xl bg-brand text-white items-center justify-center gap-1.5 text-[14px] font-extrabold active:scale-[0.98] transition-transform">
            내 주변 딜 보러가기 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
