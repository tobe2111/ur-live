/**
 * 🛡️ 2026-05-15: 자영업자/매장 대상 랜딩 — PC 풀 너비.
 *
 * 핵심 메시지:
 * - 3분 등록 (Magic Link)
 * - 운영 마찰 0 (자동 환불 / 알림톡 / 통계)
 * - 수수료 5% (대형 셀러 차등 4%/3%)
 * - 수익 시뮬레이터
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Clock, Zap, Shield, TrendingUp, Phone, Sparkles, CheckCircle2 } from 'lucide-react'
import SEO from '@/components/SEO'

export default function BusinessLandingPage() {
  const navigate = useNavigate()
  const [participants, setParticipants] = useState(20)
  const [price, setPrice] = useState(15000)
  const [campaigns, setCampaigns] = useState(4)

  const monthlyGmv = participants * price * campaigns
  const commissionRate = monthlyGmv >= 100_000_000 ? 0.03 : monthlyGmv >= 10_000_000 ? 0.04 : 0.05
  const commission = Math.round(monthlyGmv * commissionRate)
  const netRevenue = monthlyGmv - commission

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <SEO
        title="유어딜 사장님 — 3분이면 매장 매출이 시작됩니다"
        description="자영업자를 위한 모바일 우선 공동구매 플랫폼. Magic Link 로 PIN 없이 통계 확인, 자동 환불, 카카오톡 알림톡까지. 수수료 3-5%."
        url="/business"
        type="website"
      />

      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A] px-4 lg:px-12 py-4 flex items-center justify-between">
        <Link to="/" className="text-lg font-extrabold tracking-tight text-gray-900">유어딜</Link>
        <div className="flex items-center gap-3">
          <Link to="/influencer" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">인플루언서</Link>
          <Link to="/agency-partner" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">에이전시</Link>
          <button onClick={() => navigate('/seller/register')} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-full text-sm font-bold">
            무료 시작하기
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-12 py-12 lg:py-24 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block px-3 py-1 bg-pink-50 text-pink-600 rounded-full text-xs font-bold mb-5">🎯 자영업자 1인 사업자 전용</span>
            <h1 className="text-4xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
              사장님,<br />
              <span className="bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">3분 등록</span> 하면<br />
              오늘부터 매출 시작.
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              카카오맵으로 매장 검색 1번, 가격 입력만 하면 끝.<br />
              나머지는 알아서 — 자동 환불, 알림톡, 사장님 통계 페이지까지.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/seller/register')}
                className="px-6 py-3.5 bg-pink-500 hover:bg-pink-600 text-white rounded-full font-bold flex items-center gap-2 shadow-lg shadow-pink-200"
              >
                무료로 시작 <ArrowRight className="w-4 h-4" />
              </button>
              {/* 🛡️ 2026-05-20: 공급자 (가게 사장님) 셀프 가입 CTA — 카카오 로그인 후 진입. */}
              <button
                onClick={() => navigate('/seller/register/supplier')}
                className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold flex items-center gap-2 shadow-lg shadow-emerald-200"
              >
                공급자 가입 <ArrowRight className="w-4 h-4" />
              </button>
              <a href="tel:0507-0177-0432" className="px-6 py-3.5 border-2 border-gray-200 dark:border-[#2A2A2A] hover:border-gray-300 rounded-full font-bold flex items-center gap-2 text-gray-700">
                <Phone className="w-4 h-4" /> 0507-0177-0432
              </a>
            </div>
          </div>

          {/* 모바일 액자 — 셀러 등록 미리보기 */}
          <div className="hidden lg:flex justify-center">
            <div className="relative w-[300px] aspect-[9/19.5] rounded-[40px] border-[8px] border-gray-900 bg-gray-100 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 p-4 flex flex-col gap-3">
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">📍 매장 검색</p>
                  <p className="text-sm font-bold text-gray-900">동래원 본점</p>
                  <p className="text-[10px] text-gray-400 mt-1">부산 동래구 충렬대로...</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">💰 공구 가격</p>
                  <p className="text-2xl font-extrabold text-pink-500">15,000<span className="text-sm font-bold">딜</span></p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-2">🎯 진행 현황</p>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                    <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500" style={{ width: '85%' }} />
                  </div>
                  <p className="text-xs text-gray-700"><span className="font-bold">17명</span> / 20명 · <span className="text-pink-600 font-bold">3명 남음</span></p>
                </div>
                <button className="bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl py-3 text-sm font-bold mt-auto">
                  공구 시작하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 핵심 가치 */}
      <section className="bg-gray-50 px-6 lg:px-12 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-center mb-12">
            왜 사장님들이 유어딜을 선택할까요?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Clock, title: '3분 등록', desc: '카카오맵 검색 + 사진 자동 추천 + 가격 입력. 회원가입 없이도 OK.' },
              { icon: Zap, title: '운영 마찰 0', desc: 'Magic Link 로 사장님은 클릭만. PIN, 비밀번호, 앱 설치 없음.' },
              { icon: Shield, title: '자동 환불', desc: '미달성 시 보증금 자동 환불. 분쟁/CS 부담 없음.' },
              { icon: TrendingUp, title: '실시간 통계', desc: '오늘 매출, 사용 voucher, 정산 예정 — 실시간 알림톡.' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 dark:border-[#1A1A1A]">
                <f.icon className="w-8 h-8 text-pink-500 mb-3" />
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
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-3">
              한 달에 얼마 벌 수 있을까요?
            </h2>
            <p className="text-gray-600">슬라이더로 직접 계산해보세요</p>
          </div>

          <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-3xl p-6 lg:p-10 border border-pink-100">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700">공구당 참여자 수</label>
                  <span className="text-2xl font-extrabold text-pink-600">{participants}명</span>
                </div>
                <input type="range" min="5" max="100" step="1" value={participants} onChange={e => setParticipants(Number(e.target.value))} className="w-full accent-pink-500" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700">공구 가격 (1인)</label>
                  <span className="text-2xl font-extrabold text-pink-600">{price.toLocaleString()}원</span>
                </div>
                <input type="range" min="5000" max="100000" step="1000" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full accent-pink-500" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700">월 공구 횟수</label>
                  <span className="text-2xl font-extrabold text-pink-600">{campaigns}회</span>
                </div>
                <input type="range" min="1" max="20" step="1" value={campaigns} onChange={e => setCampaigns(Number(e.target.value))} className="w-full accent-pink-500" />
              </div>

              <div className="border-t border-pink-200 pt-6 grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">월 GMV</p>
                  <p className="text-xl font-extrabold text-gray-900">{monthlyGmv.toLocaleString()}원</p>
                </div>
                <div className="bg-white rounded-2xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">수수료 ({(commissionRate * 100).toFixed(0)}%)</p>
                  <p className="text-xl font-extrabold text-gray-400">-{commission.toLocaleString()}원</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-6 text-center text-white">
                <p className="text-sm opacity-90 mb-1">사장님이 받는 금액</p>
                <p className="text-4xl font-extrabold">{netRevenue.toLocaleString()}<span className="text-xl font-bold">원/월</span></p>
                {monthlyGmv >= 10_000_000 && (
                  <p className="text-xs opacity-90 mt-2">🎉 월 GMV {monthlyGmv >= 100_000_000 ? '1억+ → 수수료 3%' : '1천만+ → 수수료 4%'} 차등 적용</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-pink-500 to-rose-500 px-6 lg:px-12 py-16 text-white text-center">
        <h2 className="text-3xl lg:text-5xl font-extrabold mb-5">지금 시작하면<br />이번 주 안에 첫 매출.</h2>
        <p className="text-lg opacity-90 mb-8">월 5만원도, 월 5천만원도 — 사장님이 결정합니다.</p>
        <button
          onClick={() => navigate('/seller/register')}
          className="px-8 py-4 bg-white text-pink-600 rounded-full font-extrabold text-lg shadow-xl hover:scale-105 transition-transform"
        >
          무료로 시작하기 →
        </button>
        <p className="text-xs opacity-70 mt-6">신용카드 불필요 · 등록 후 바로 카톡 share 가능 · 계약 기간 없음</p>
      </section>

      {/* Footer */}
      <footer className="px-6 lg:px-12 py-8 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-[#1A1A1A]">
        © 2026 리스터코퍼레이션 · 사업자등록번호: 479-09-02930 ·{' '}
        <a href="mailto:jiwon@ur-team.com" className="underline">jiwon@ur-team.com</a>
      </footer>
    </div>
  )
}
