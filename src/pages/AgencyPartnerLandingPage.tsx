/**
 * 🛡️ 2026-05-15: 에이전시 가입 안내 — PC 풀 너비.
 *
 * 핵심 메시지: "총판처럼 운영. 셀러 데려오면 평생 GMV 분배."
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Repeat, BarChart3, ShieldCheck, Phone } from 'lucide-react'
import SEO from '@/components/SEO'

export default function AgencyPartnerLandingPage() {
  const navigate = useNavigate()
  const [sellers, setSellers] = useState(50)
  const [avgGmv, setAvgGmv] = useState(2_000_000)

  const totalGmv = sellers * avgGmv
  const ourCommission = totalGmv * 0.05
  const agencyShare = ourCommission * 0.3  // 30% rebate
  const monthlySubscription = 500_000  // 정액 50만

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <SEO
        title="유어딜 에이전시 파트너 — 셀러 데려오면 평생 GMV 분배"
        description="공구 에이전시 / 마케팅 회사 / 인플루언서 MCN 을 위한 총판 파트너십. 자체 셀러 망 + 우리 인프라 = 30% 수수료 분배 + 월 정액 + 데이터 dashboard."
        url="/agency-partner"
        type="website"
      />

      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100 px-4 lg:px-12 py-4 flex items-center justify-between">
        <Link to="/" className="text-lg font-extrabold tracking-tight">유어딜</Link>
        <div className="flex items-center gap-3">
          <Link to="/business" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">사장님</Link>
          <Link to="/influencer" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">인플루언서</Link>
          <a href="mailto:jiwon@ur-team.com?subject=에이전시%20파트너%20문의" className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-full text-sm font-bold">
            제휴 문의
          </a>
        </div>
      </nav>

      <section className="px-6 lg:px-12 py-12 lg:py-24 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 bg-gray-900 text-white rounded-full text-xs font-bold mb-5">🤝 에이전시 파트너십</span>
          <h1 className="text-4xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            셀러 망(網)이<br />
            <span className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">평생 매출</span> 입니다.
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto mb-8">
            기존 공동구매 / 인플루언서 MCN / 동네 마케팅 회사 — 자체 셀러 망 + 우리 인프라 = 즉시 수익화.<br />
            <span className="font-bold">셀러 데려오면 그 셀러의 평생 GMV 5% × 30% 가 매월 분배됩니다.</span>
          </p>
          <a
            href="mailto:jiwon@ur-team.com?subject=에이전시%20파트너%20문의"
            className="inline-block px-8 py-4 bg-gray-900 hover:bg-black text-white rounded-full font-extrabold text-lg shadow-xl"
          >
            제휴 문의 보내기 →
          </a>
        </div>
      </section>

      {/* 에이전시 가치 4 */}
      <section className="bg-gray-50 px-6 lg:px-12 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-10">왜 우리와 파트너 해야 하나요?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Building2, title: '인프라 0원', desc: '결제 / 정산 / 환불 / 알림 — 우리가 다 해드립니다. 개발 X.' },
              { icon: Repeat, title: '평생 분배', desc: '데려온 셀러의 모든 향후 GMV 의 1.5% 가 매월 자동 입금.' },
              { icon: BarChart3, title: '실시간 dashboard', desc: '본인 망 셀러 매출 / 정산 / 분쟁 — 한 화면에서 다 관리.' },
              { icon: ShieldCheck, title: '브랜드 lock-in', desc: '에이전시 전용 도메인 + 본인 브랜드로 추천 가능.' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100">
                <f.icon className="w-8 h-8 text-gray-900 mb-3" />
                <h3 className="text-base font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 수익 시뮬레이터 */}
      <section className="px-6 lg:px-12 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-3">에이전시 수익 시뮬레이터</h2>
            <p className="text-gray-600">데려올 셀러 수와 평균 매출을 입력하세요</p>
          </div>
          <div className="bg-gray-50 rounded-3xl p-6 lg:p-10">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700">관리할 셀러 수</label>
                  <span className="text-2xl font-extrabold text-gray-900">{sellers}곳</span>
                </div>
                <input type="range" min="10" max="500" step="10" value={sellers} onChange={e => setSellers(Number(e.target.value))} className="w-full accent-gray-900" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700">셀러당 월 GMV (평균)</label>
                  <span className="text-2xl font-extrabold text-gray-900">{(avgGmv / 10000).toFixed(0)}만원</span>
                </div>
                <input type="range" min="500000" max="20000000" step="500000" value={avgGmv} onChange={e => setAvgGmv(Number(e.target.value))} className="w-full accent-gray-900" />
              </div>
              <div className="border-t border-gray-200 pt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">총 GMV (월)</span>
                  <span className="font-bold">{(totalGmv / 100_000_000).toFixed(2)}억원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">플랫폼 수수료 5%</span>
                  <span>{(ourCommission / 10000).toFixed(0)}만원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">에이전시 분배 30%</span>
                  <span className="font-bold text-pink-600">{(agencyShare / 10000).toFixed(0)}만원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">월 정액 구독료</span>
                  <span className="font-bold text-pink-600">{(monthlySubscription / 10000).toFixed(0)}만원</span>
                </div>
                <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl p-5 text-white text-center mt-4">
                  <p className="text-sm opacity-90 mb-1">에이전시 월 수익</p>
                  <p className="text-3xl font-extrabold">{((agencyShare + monthlySubscription) / 10000).toFixed(0)}<span className="text-xl font-bold">만원</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-900 px-6 lg:px-12 py-16 text-white text-center">
        <h2 className="text-3xl lg:text-5xl font-extrabold mb-5">한 번 데려오면<br />평생 분배 받습니다.</h2>
        <a href="mailto:jiwon@ur-team.com?subject=에이전시%20파트너%20문의" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-full font-extrabold text-lg shadow-xl hover:scale-105 transition-transform">
          <Phone className="w-5 h-5" /> 제휴 문의
        </a>
        <p className="text-xs opacity-70 mt-6">jiwon@ur-team.com · 0507-0177-0432</p>
      </section>

      <footer className="px-6 lg:px-12 py-8 text-center text-xs text-gray-400 border-t border-gray-100">
        © 2026 리스터코퍼레이션 · 사업자등록번호: 479-09-02930
      </footer>
    </div>
  )
}
