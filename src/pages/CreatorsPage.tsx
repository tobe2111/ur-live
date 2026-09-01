/**
 * ✨ 소개 파트너 모집 랜딩 — /creators (2026-07-19 대표 "웹페이지 3종" ③ — flip 시점 맞춰 공개)
 *   히어로 → 수익 구조(판매당 promo%) → 시작 3단계 → 성과 화면 프리뷰(스크린샷 placeholder —
 *   잔존 장치 2종 완성 후 실캡처 교체) → 시드 모집 폼(구글폼 임베드 — URL 전달 시 GOOGLE_FORM_URL 교체).
 *   카피는 대표 별도 전달분으로 교체 예정. 브랜드 토큰: brand/#16181C/#FAF7F5.
 */
import { Link } from 'react-router-dom'
import { Link2, MousePointerClick, Share2, UserPlus, ArrowRight, Bell, BarChart3 } from 'lucide-react'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import UrDealLogo from '@/components/brand/UrDealLogo'

/** 📋 시드 모집 폼 — 기본은 유어딜 네이티브 신청 폼(/creators/apply, 사전동의·풀 자동적재).
 *  대표가 별도 구글폼 URL 을 전달하면 여기에 넣어 iframe 임베드로 대체(없으면 네이티브 폼 사용). */
const GOOGLE_FORM_URL = ''

const STEPS = [
  { icon: UserPlus, t: '가입', d: '카카오 로그인 1분이면 내 유어샵이 자동으로 생겨요' },
  { icon: MousePointerClick, t: '딜 선택', d: '동네 맛집·뷰티 딜 중 소개하고 싶은 걸 내 유어샵에 담아요' },
  { icon: Share2, t: '링크 공유', d: '인스타·블로그·카톡에 내 링크 하나만 올리면 끝' },
]

export default function CreatorsPage() {
  return (
    <div className="min-h-[100dvh] bg-[#FAF7F5] dark:bg-[#0D0F12]">
      {/* 🔎 2026-07-29: 문구 SSOT = shared/seo/consumer-surfaces (워커 메타와 같은 값). */}
      <SEO title={CONSUMER_SURFACE_SEO['/creators'].title} description={CONSUMER_SURFACE_SEO['/creators'].description} url="/creators" />
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-12 bg-[#FAF7F5]/90 dark:bg-[#0D0F12]/90 backdrop-blur-sm">
        <Link to="/" aria-label="유어딜 홈"><UrDealLogo size={18} /></Link>
        <Link to="/about" className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">서비스 소개</Link>
      </header>

      <main className="px-5 pb-32 max-w-xl mx-auto">
        {/* 히어로 */}
        <section className="pt-8 pb-10">
          <p className="text-[12px] font-extrabold tracking-widest text-brand mb-3">유어딜에서 소개하기</p>
          <h1 className="text-[26px] leading-[1.3] font-extrabold text-[#16181C] dark:text-[#F5F3F1]">
            <span className="text-brand">링크 하나</span>로 동네 맛집을 팔고<br />커미션을 받으세요
          </h1>
          <p className="text-[14px] text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
            팔로워가 많지 않아도 괜찮아요. 동네 이웃에게 진짜 좋은 딜을 소개하는 것부터 시작합니다.
          </p>
        </section>

        {/* 수익 구조 */}
        <section className="pb-10">
          <h2 className="text-[19px] font-extrabold text-[#16181C] dark:text-[#F5F3F1] mb-4">수익 구조는 단순합니다</h2>
          <div className="rounded-2xl bg-white dark:bg-[#1A1C21] p-5">
            <div className="flex items-center gap-2 text-[14px] font-bold text-[#16181C] dark:text-[#F5F3F1]">
              <Link2 className="w-4 h-4 text-brand shrink-0" />
              내 링크로 판매될 때마다 <span className="text-brand">판매액의 소개비(promo%)</span> 적립
            </div>
            <ul className="mt-3 space-y-1.5 text-[13px] text-gray-600 dark:text-gray-300 list-disc pl-5">
              <li>소개비율은 딜마다 표시되니 고르기 전에 미리 확인하세요</li>
              <li>손님이 환불하면 적립도 자동 회수됩니다 (원장 기준)</li>
              <li>적립금은 정산 계좌로 출금 (사업소득 원천징수 후 지급)</li>
            </ul>
          </div>
        </section>

        {/* 시작 3단계 */}
        <section className="pb-10">
          <h2 className="text-[19px] font-extrabold text-[#16181C] dark:text-[#F5F3F1] mb-4">시작은 3단계</h2>
          <div className="space-y-2.5">
            {STEPS.map(({ icon: Icon, t, d }, i) => (
              <div key={t} className="flex items-start gap-3.5 rounded-2xl bg-white dark:bg-[#1A1C21] p-4">
                <div className="w-9 h-9 rounded-xl bg-[var(--brand-tint)] dark:bg-[#3A2530] flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px] text-brand" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14.5px] font-extrabold text-[#16181C] dark:text-[#F5F3F1]"><span className="text-brand mr-1">{i + 1}.</span>{t}</p>
                  <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 성과 화면 프리뷰 — 실스크린샷 교체 예정 placeholder */}
        <section className="pb-10">
          <h2 className="text-[19px] font-extrabold text-[#16181C] dark:text-[#F5F3F1] mb-4">팔리는 순간, 바로 알려드려요</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {/* 📸 잔존 장치 2종(실시간 적립 알림·내 성과 탭) 완성 후 실제 캡처로 교체 */}
            <div className="rounded-2xl bg-white dark:bg-[#1A1C21] p-4 aspect-[3/4] flex flex-col items-center justify-center text-center gap-2">
              <Bell className="w-7 h-7 text-brand" />
              <p className="text-[13px] font-extrabold text-[#16181C] dark:text-[#F5F3F1]">실시간 적립 알림</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">"방금 내 링크로 1건 판매!"<br />(화면 준비 중)</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-[#1A1C21] p-4 aspect-[3/4] flex flex-col items-center justify-center text-center gap-2">
              <BarChart3 className="w-7 h-7 text-brand" />
              <p className="text-[13px] font-extrabold text-[#16181C] dark:text-[#F5F3F1]">내 성과 탭</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">클릭·판매·적립 한눈에<br />(화면 준비 중)</p>
            </div>
          </div>
        </section>

        {/* 시드 모집 폼 */}
        <section id="apply" className="pb-6">
          <h2 className="text-[19px] font-extrabold text-[#16181C] dark:text-[#F5F3F1] mb-4">1기 소개 파트너 모집</h2>
          {GOOGLE_FORM_URL ? (
            <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1A1C21]">
              <iframe src={GOOGLE_FORM_URL} title="1기 소개 파트너 지원 폼" className="w-full h-[640px] border-0" loading="lazy" />
            </div>
          ) : (
            <Link to="/creators/apply" className="block rounded-2xl bg-[#16181C] dark:bg-[#1A1C21] p-6 text-center active:scale-[0.99] transition-transform">
              <p className="text-[15px] font-extrabold text-[#FAF7F5]">1기 소개 파트너를 모집하고 있어요</p>
              <p className="text-[12.5px] text-[#A5A29E] mt-1.5">지금 지원하시면 온보딩 안내를 보내드립니다</p>
            </Link>
          )}
        </section>
      </main>

      {/* 하단 고정 CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#0D0F12]/95 backdrop-blur-md border-t border-gray-100 dark:border-[#2C2F35] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto flex gap-2.5">
          {GOOGLE_FORM_URL ? (
            <a href={GOOGLE_FORM_URL} target="_blank" rel="noopener noreferrer"
              className="flex-1 h-12 rounded-2xl bg-brand text-white flex items-center justify-center gap-1.5 text-[14px] font-extrabold active:scale-[0.98] transition-transform">
              소개 파트너 지원 <ArrowRight className="w-4 h-4" />
            </a>
          ) : (
            <Link to="/creators/apply"
              className="flex-1 h-12 rounded-2xl bg-brand text-white flex items-center justify-center gap-1.5 text-[14px] font-extrabold active:scale-[0.98] transition-transform">
              소개 파트너 지원 <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
