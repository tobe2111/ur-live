/**
 * 🛡️ 2026-05-15: 인플루언서 대상 랜딩 — 공구 영업으로 수익화.
 *
 * 핵심 메시지:
 * - 매장 섭외 X (셀러는 매장이 직접)
 * - 본인 팔로워에게 share 만 → 수수료 receive
 * - 친구 추천 0.5% × 양쪽 + 셀러 추천 시 commission 분할
 */
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Megaphone, Wallet, BarChart3, Phone } from 'lucide-react'
import SEO from '@/components/SEO'

export default function InfluencerLandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <SEO
        title="유어딜 인플루언서 — 팔로워가 곧 수익이 됩니다"
        description="매장 섭외 없이 카톡 share 만으로 공구 수익. 친구 추천 양쪽 0.5% 보너스 딜 + 셀러 추천 commission 분할."
        url="/influencer"
        type="website"
      />

      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100 px-4 lg:px-12 py-4 flex items-center justify-between">
        <Link to="/" className="text-lg font-extrabold tracking-tight">유어딜</Link>
        <div className="flex items-center gap-3">
          <Link to="/business" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">사장님</Link>
          <Link to="/agency-partner" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">에이전시</Link>
          <button onClick={() => navigate('/register')} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-full text-sm font-bold">
            지금 가입
          </button>
        </div>
      </nav>

      <section className="px-6 lg:px-12 py-12 lg:py-24 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold mb-5">✨ 인플루언서 / 크리에이터 전용</span>
          <h1 className="text-4xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            팔로워가<br />
            <span className="bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">곧 매출</span> 이 됩니다.
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto mb-8">
            매장 섭외 없이 — 우리가 검증한 공구를 인스타 / 카톡 / 틱톡으로 share 만 하세요.<br />
            친구가 참여하면 <span className="font-bold text-pink-600">양쪽 0.5% 보너스 딜</span>.
          </p>
          <button
            onClick={() => navigate('/register')}
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-amber-500 text-white rounded-full font-extrabold text-lg shadow-xl"
          >
            지금 가입하고 share 시작 →
          </button>
        </div>
      </section>

      {/* 수익 사례 카드 */}
      <section className="bg-gray-50 px-6 lg:px-12 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-10">실제 인플루언서 수익 사례</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { tier: '마이크로 (팔로워 1만)', monthly: '40-80만원', desc: '주 1-2회 share + 본인 단골 매장' },
              { tier: '미디엄 (팔로워 10만)', monthly: '300-600만원', desc: '주 3-5회 share + 카테고리 specialty' },
              { tier: '메가 (팔로워 50만+)', monthly: '1,500만원+', desc: '본인 브랜드 공구 + 셀러 영입 추가' },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100">
                <p className="text-xs text-gray-500 mb-2">{c.tier}</p>
                <p className="text-3xl font-extrabold text-pink-600 mb-2">{c.monthly}</p>
                <p className="text-sm text-gray-600">{c.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center mt-6">* 베타 참여 인플루언서 평균 (2026 4월 기준)</p>
        </div>
      </section>

      {/* 수익 구조 */}
      <section className="px-6 lg:px-12 py-16 max-w-4xl mx-auto">
        <h2 className="text-3xl font-extrabold text-center mb-10">3가지 수익원</h2>
        <div className="space-y-4">
          {[
            { icon: Wallet, title: '친구 추천 보상', desc: '내 share 링크로 친구가 공구 참여 시 양쪽 0.5% 보너스 딜 (첫 1회).', amt: '예: 친구 5만원 공구 → 250딜 × 양쪽' },
            { icon: Megaphone, title: '본인 공구 진행', desc: '본인이 검증한 매장과 직접 공구 캠페인. 5% 수수료 후 90% 인플루언서 수령 옵션.', amt: '예: 100만 GMV → 90만 수령' },
            { icon: BarChart3, title: '셀러 영입 commission', desc: '본인이 영입한 셀러의 평생 GMV 의 일정 비율 분배 (에이전시 모델).', amt: '예: 영입 셀러 월 GMV 1천만 → 인플루언서 50만/월' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 flex gap-4">
              <s.icon className="w-10 h-10 text-pink-500 shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold mb-1">{s.title}</h3>
                <p className="text-sm text-gray-600 mb-2">{s.desc}</p>
                <p className="text-xs text-pink-600 font-semibold">{s.amt}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-amber-500 to-pink-500 px-6 lg:px-12 py-16 text-white text-center">
        <h2 className="text-3xl lg:text-5xl font-extrabold mb-5">지금 share 한 번이<br />다음 달 월급이 됩니다.</h2>
        <button
          onClick={() => navigate('/register')}
          className="px-8 py-4 bg-white text-pink-600 rounded-full font-extrabold text-lg shadow-xl hover:scale-105 transition-transform"
        >
          무료로 가입 →
        </button>
        <p className="text-xs opacity-70 mt-6">팔로워 수 제한 없음 · 신용카드 불필요</p>
      </section>

      <footer className="px-6 lg:px-12 py-8 text-center text-xs text-gray-400 border-t border-gray-100">
        © 2026 리스터코퍼레이션 · <a href="mailto:jiwon@ur-team.com" className="underline">jiwon@ur-team.com</a>
      </footer>
    </div>
  )
}
