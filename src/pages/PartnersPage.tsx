/**
 * 🏪 입점(파트너) 랜딩 — /partners (2026-07-19 대표 "웹페이지 3종" ① 최우선, 8월 온보딩 전)
 *   구조: 그루폰 상인 페이지 차용 — ①히어로(헤드라인+신뢰숫자3) ②작동 4단계 ③내 몫 계산기(프론트 단순계산)
 *   ④FAQ 아코디언 5문항 ⑤하단 고정 CTA(셀러 가입 + 카카오채널). 모바일 퍼스트(인스타·카톡 유입).
 *   카피는 대표 별도 전달분으로 교체 예정 — 상수(TRUST/STEPS/FAQS)만 갈아끼우면 됨.
 *   브랜드 토큰: brand(#1C69EF) / 잉크 #16181C / 웜 #F8F7FC (지시서 공통).
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, QrCode, FileCheck2, Wallet, PenLine, MessageCircle, ArrowRight } from 'lucide-react'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { formatNumber } from '@/utils/format'

const KAKAO_CHANNEL = 'http://pf.kakao.com/_AITdn/chat'
/** 💰 계산기 기본율 — 플랫폼 수수료 5%(업계 최저, platform_settings 기본과 동일 표기). 카피 전달 시 조정. */
const PLATFORM_FEE = 0.05

const TRUST = [
  { n: '19조', d: '글로벌 동일 모델 시장 규모' },
  { n: '서초구', d: '상권 활성화 사업 수행' },
  { n: '5%', d: '수수료 업계 최저' },
]

const STEPS = [
  { icon: PenLine, t: '초안은 저희가', d: '메뉴·가격·사진까지 딜 초안을 유어딜이 만들어 드려요' },
  { icon: FileCheck2, t: '사장님은 승인만', d: '카톡으로 받은 초안을 확인하고 승인 한 번이면 판매 시작' },
  { icon: QrCode, t: 'QR 스캔만', d: '손님이 보여주는 QR을 매장 폰으로 스캔하면 끝' },
  { icon: Wallet, t: '정산 자동', d: '사용된 만큼 자동 정산. 대시보드에서 실시간 확인' },
]

/** FAQ 초안 — 8월 온보딩에서 수집·갱신 예정(대표 전달분으로 교체). */
const FAQS = [
  { q: '광고비를 미리 내야 하나요?', a: '아니요. 선불 광고비·가입비·월 이용료가 전혀 없습니다. 손님이 실제로 결제하고 매장에 방문했을 때만 판매액의 5% 수수료가 발생합니다.' },
  { q: '할인을 얼마나 해야 하나요?', a: '할인율은 사장님이 정합니다. 첫 방문을 만드는 미끼 메뉴는 20~30%, 마진이 좋은 세트는 10~15%처럼 메뉴별로 다르게 설정할 수 있어요.' },
  { q: '정산은 언제 어떻게 받나요?', a: '손님이 이용권을 사용(QR 스캔)하면 정산 대상이 되고, 주 단위로 등록 계좌에 자동 입금됩니다. 정산 내역은 셀러 대시보드에서 실시간으로 확인할 수 있습니다.' },
  { q: '가게에 따로 기계나 설치가 필요한가요?', a: '아무것도 필요 없습니다. 쓰시던 스마트폰으로 QR을 스캔하면 끝이에요. 포스 연동·단말기 설치·직원 교육이 필요 없습니다.' },
  { q: '이용권이 안 팔리면 어떻게 되나요?', a: '안 팔리면 비용도 0원입니다. 노출·페이지 제작·마케팅 비용을 유어딜이 부담하기 때문에 사장님은 잃을 것이 없습니다.' },
]

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[#EAE4E0] dark:border-[#2C2F35]">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between gap-3 py-4 text-left">
        <span className="text-[14.5px] font-bold text-[#16181C] dark:text-[#F5F3F1]">{q}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-4 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-300">{a}</p>}
    </div>
  )
}

export default function PartnersPage() {
  const [price, setPrice] = useState(30000)
  const [discount, setDiscount] = useState(10)
  const calc = useMemo(() => {
    const p = Math.max(0, price || 0)
    const d = Math.min(90, Math.max(0, discount || 0))
    const paid = Math.round(p * (1 - d / 100))
    const fee = Math.round(paid * PLATFORM_FEE)
    return { paid, fee, payout: paid - fee }
  }, [price, discount])

  return (
    <div className="min-h-[100dvh] bg-[#F8F7FC] dark:bg-[#11141C]">
      {/* 🔎 2026-07-29: 문구 SSOT = shared/seo/consumer-surfaces (워커 메타와 같은 값). */}
      <SEO title={CONSUMER_SURFACE_SEO['/partners'].title} description={CONSUMER_SURFACE_SEO['/partners'].description} url="/partners" />
      {/* 상단 미니 바 */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-12 bg-[#F8F7FC]/90 dark:bg-[#11141C]/90 backdrop-blur-sm">
        <Link to="/" aria-label="유어딜 홈"><UrDealLogo size={18} /></Link>
        <Link to="/about" className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">서비스 소개</Link>
      </header>

      <main className="px-5 pb-32 max-w-xl mx-auto">
        {/* ① 히어로 */}
        <section className="pt-8 pb-10">
          <p className="text-[12px] font-extrabold tracking-widest text-brand mb-3">유어딜 입점 파트너</p>
          <h1 className="text-[26px] leading-[1.3] font-extrabold text-[#16181C] dark:text-[#F5F3F1]">
            광고는 클릭에 돈을 쓰고,<br />유어딜은 <span className="text-brand">손님이 매장에 온 다음</span>에만 비용이 듭니다
          </h1>
          <div className="grid grid-cols-3 gap-2 mt-7">
            {TRUST.map(({ n, d }) => (
              <div key={d} className="rounded-2xl bg-white dark:bg-[#1D1F29] px-2 py-4 text-center">
                <p className="text-[19px] font-extrabold text-[#16181C] dark:text-[#F5F3F1]">{n}</p>
                <p className="text-[10.5px] leading-tight text-gray-500 dark:text-gray-400 mt-1">{d}</p>
              </div>
            ))}
          </div>
          <a href="#cta" className="mt-6 flex items-center justify-center gap-1.5 w-full h-12 rounded-2xl bg-brand text-white text-[15px] font-extrabold active:scale-[0.98] transition-transform">
            입점 문의 <ArrowRight className="w-4 h-4" />
          </a>
        </section>

        {/* ② 작동 방식 4단계 */}
        <section className="pb-10">
          <h2 className="text-[19px] font-extrabold text-[#16181C] dark:text-[#F5F3F1] mb-4">사장님이 하실 일은 거의 없습니다</h2>
          <div className="space-y-2.5">
            {STEPS.map(({ icon: Icon, t, d }, i) => (
              <div key={t} className="flex items-start gap-3.5 rounded-2xl bg-white dark:bg-[#1D1F29] p-4">
                <div className="w-9 h-9 rounded-xl bg-[var(--brand-tint)] dark:bg-[#16243D] flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 w-[18px] h-[18px] text-brand" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14.5px] font-extrabold text-[#16181C] dark:text-[#F5F3F1]"><span className="text-brand mr-1">{i + 1}.</span>{t}</p>
                  <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ③ 내 몫 계산기 */}
        <section className="pb-10">
          <h2 className="text-[19px] font-extrabold text-[#16181C] dark:text-[#F5F3F1] mb-1">내 몫 계산기</h2>
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mb-4">정가와 할인율만 넣어보세요. 입금액이 바로 보입니다</p>
          <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11.5px] font-bold text-gray-500 dark:text-gray-400">정가 (원)</span>
                <input type="number" inputMode="numeric" value={price} min={0} step={1000}
                  onChange={e => setPrice(Number(e.target.value))}
                  className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#11141C] text-[15px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
              </label>
              <label className="block">
                <span className="text-[11.5px] font-bold text-gray-500 dark:text-gray-400">할인율 (%)</span>
                <input type="number" inputMode="numeric" value={discount} min={0} max={90}
                  onChange={e => setDiscount(Number(e.target.value))}
                  className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#11141C] text-[15px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
              </label>
            </div>
            <div className="rounded-xl bg-[#F8F7FC] dark:bg-[#11141C] p-4 space-y-1.5">
              <div className="flex justify-between text-[13px] text-gray-600 dark:text-gray-300"><span>손님 결제</span><b className="text-gray-900 dark:text-white">{formatNumber(calc.paid)}원</b></div>
              <div className="flex justify-between text-[13px] text-gray-600 dark:text-gray-300"><span>유어딜 수수료 5%</span><b>−{formatNumber(calc.fee)}원</b></div>
              <div className="border-t border-dashed border-gray-200 dark:border-[#2C2F35] pt-2 flex justify-between items-baseline">
                <span className="text-[13.5px] font-bold text-[#16181C] dark:text-[#F5F3F1]">사장님 입금</span>
                <b className="text-[22px] font-extrabold text-brand">{formatNumber(calc.payout)}원</b>
              </div>
            </div>
            <p className="text-[10.5px] text-gray-400 dark:text-gray-500">선불 광고비와 가입비, 월 이용료가 없습니다. 수수료는 실제 판매가 일어난 금액에만 부과됩니다.</p>
          </div>
        </section>

        {/* ④ FAQ */}
        <section className="pb-10">
          <h2 className="text-[19px] font-extrabold text-[#16181C] dark:text-[#F5F3F1] mb-2">자주 묻는 질문</h2>
          <div>{FAQS.map(f => <Faq key={f.q} {...f} />)}</div>
        </section>

        {/* ⑤ CTA 앵커 섹션 */}
        <section id="cta" className="pb-6">
          <div className="rounded-2xl bg-[#16181C] dark:bg-[#1D1F29] p-6 text-center">
            <p className="text-[17px] font-extrabold text-[#F8F7FC]">지금 입점하면 첫 딜 초안까지 무료로 만들어 드립니다</p>
            <p className="text-[12.5px] text-[#A5A29E] mt-1.5">가입 5분 · 설치 0 · 선불 비용 0</p>
          </div>
        </section>
      </main>

      {/* 하단 고정 CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#11141C]/95 backdrop-blur-md border-t border-gray-100 dark:border-[#2C2F35] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto flex gap-2.5">
          <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer"
            className="flex-1 h-12 rounded-2xl border border-[#16181C]/15 dark:border-[#2C2F35] bg-white dark:bg-[#1D1F29] flex items-center justify-center gap-1.5 text-[14px] font-extrabold text-[#16181C] dark:text-[#F5F3F1]">
            <MessageCircle className="w-4 h-4" /> 카카오 문의
          </a>
          <Link to="/store/new"
            className="flex-[1.4] h-12 rounded-2xl bg-brand text-white flex items-center justify-center gap-1.5 text-[14px] font-extrabold active:scale-[0.98] transition-transform">
            셀러 가입하기 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
