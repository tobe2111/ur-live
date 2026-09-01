/**
 * 📣 소개로 수익 만들기 — 공개 랜딩 `/influencer`
 *
 * 🩸 2026-08-26 전면 재작성. 이전 판은 **지금은 없는 것을 세 가지나 광고**하고 있었다:
 *   ① "친구 추천 양쪽 0.5% 보너스 딜" — `invite_reward_enabled` 가 기본 OFF(행 부재 = 꺼짐)
 *   ② "누구나 share 하면 커미션" — 어필리에이트는 **2026-08-22 대표 결정으로 종료**
 *   ③ "실제 인플루언서 수익 사례 — 월 1,500만원+ / 베타 참여 평균" — 출처가 코드 어디에도 없는
 *      하드코딩 숫자였다. 공개 페이지에서 **수익을 숫자로 약속하는 것**은 표시광고 문제가 되고,
 *      무엇보다 사실이 아니면 처음 온 사람과의 관계가 거기서 끝난다.
 *
 * ⇒ 지금 실제로 도는 것 하나만 말한다: **매장과 맺은 딜**(`seller_influencer_deals`)이 있어야
 *   소개 커미션이 붙고, 비율은 매장이 정한다. 딜이 없으면 담아 소개할 수는 있어도 커미션은 0 이다.
 *   이용권 상세의 소개 배너(`ShareRewardBanner`)와 결제 시점 적립이 **같은 함수**(`findActiveDealPct`)를
 *   쓰므로, 여기 적은 말과 실제 정산이 갈릴 수 없다.
 *
 * 🏷️ 명칭: 사람을 신분('인플루언서/크리에이터')으로 부르지 않고 **행위**(담기=소개)로 말한다.
 */
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Store, Handshake, Link2, Wallet } from 'lucide-react'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'

const STEPS = [
  { icon: Link2, title: '내 유어샵에 담기', desc: '가입하면 내 유어샵(urdeal.kr/u/내핸들)이 이미 있어요. 마음에 든 동네 이용권을 카드의 + 버튼으로 담습니다.' },
  { icon: Handshake, title: '매장과 딜 맺기', desc: '소개 몫이 걸린 이용권은 소개 마켓에서 찾을 수 있어요. 매장이 제안하거나 내가 신청하면, 수락된 순간부터 그 비율이 적용됩니다.' },
  { icon: Wallet, title: '팔리면 쌓이기', desc: '내 링크로 팔린 건에 대해 매장이 정한 비율만큼 쌓입니다. 최소 10,000원부터 출금(원천징수 3.3% 자동).' },
] as const

export default function InfluencerLandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0D0F12] text-gray-900 dark:text-white">
      <SEO
        title={CONSUMER_SURFACE_SEO['/influencer'].title} description={CONSUMER_SURFACE_SEO['/influencer'].description}
        url="/influencer"
        type="website"
      />

      <nav className="sticky top-0 z-30 bg-white/90 dark:bg-[#0D0F12]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35] px-4 lg:px-12 py-4 flex items-center justify-between">
        <Link to="/" className="text-lg font-extrabold tracking-tight">유어딜</Link>
        <div className="flex items-center gap-3">
          <Link to="/business" className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">사장님</Link>
          <Link to="/agency-partner" className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">에이전시</Link>
          <button onClick={() => navigate('/login?returnUrl=%2Fu%2Fme')} className="px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-full text-sm font-bold">
            시작하기
          </button>
        </div>
      </nav>

      <section className="px-6 lg:px-12 py-12 lg:py-24 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 bg-brand/10 text-brand rounded-full text-xs font-bold mb-5">✨ 팔로워 수 제한 없음</span>
          <h1 className="text-4xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            아는 가게를<br />
            <span className="text-brand">소개하면</span> 몫이 남습니다.
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl mx-auto mb-8">
            매장을 직접 섭외하지 않아도 됩니다. 마음에 든 동네 이용권을 내 유어샵에 담아<br className="hidden sm:inline" />
            링크로 소개하면, 그 링크로 팔릴 때마다 매장이 정한 비율만큼 쌓여요.
          </p>
          <button
            onClick={() => navigate('/login?returnUrl=%2Fu%2Fme')}
            className="px-8 py-4 bg-brand hover:bg-brand-dark text-white rounded-full font-extrabold text-lg shadow-xl inline-flex items-center gap-2"
          >
            내 유어샵 열어보기 <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-xs text-gray-400 mt-4">카카오 로그인만 하면 됩니다 · 별도 가입·심사 없음</p>
        </div>
      </section>

      {/* 어떻게 되는지 — 숫자를 약속하지 않고 구조를 설명한다 */}
      <section className="bg-gray-50 dark:bg-[#1A1C21] px-6 lg:px-12 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl lg:text-3xl font-extrabold text-center mb-10">어떻게 되나요?</h2>
          <div className="space-y-4">
            {STEPS.map((s, i) => (
              <div key={i} className="bg-white dark:bg-[#0D0F12] rounded-2xl p-6 border border-gray-200 dark:border-[#2C2F35] flex gap-4">
                <span className="w-11 h-11 shrink-0 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                  <s.icon className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold mb-1">{i + 1}. {s.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ⚠️ 이 문단이 이 페이지에서 가장 중요하다 — 없으면 "담기만 하면 돈이 된다"로 읽힌다 */}
          <div className="mt-6 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-5 py-4">
            <p className="text-[13.5px] font-extrabold text-amber-900 dark:text-amber-200">먼저 알아두세요</p>
            <p className="text-[12.5px] text-amber-800 dark:text-amber-300/90 mt-1 leading-relaxed">
              모든 이용권에 소개 몫이 붙는 건 아니에요. <strong>매장과 맺은 딜이 있을 때만</strong> 커미션이 발생하고,
              비율도 매장이 정합니다. 딜이 없는 이용권도 담아서 소개할 수는 있지만 그때는 적립이 없습니다.
              내가 지금 몇 %를 받는지는 이용권 상세 화면에 그대로 표시됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* 매장을 갖고 있다면 */}
      <section className="px-6 lg:px-12 py-16 max-w-4xl mx-auto">
        <div className="rounded-3xl border border-gray-200 dark:border-[#2C2F35] p-7 lg:p-10 text-center">
          <span className="w-12 h-12 mx-auto rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12] flex items-center justify-center mb-4">
            <Store className="w-6 h-6" />
          </span>
          <h2 className="text-xl lg:text-2xl font-extrabold mb-2">내 가게가 있다면 직접 팔 수도 있어요</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl mx-auto mb-6">
            카카오맵에서 우리 가게를 찾아 등록하면 같은 유어샵에서 내 이용권을 직접 팝니다.
            수수료는 팔린 만큼만 5%입니다. 광고비를 미리 낼 필요가 없어요.
          </p>
          <button
            onClick={() => navigate('/store/new')}
            className="px-6 py-3 rounded-full bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12] font-extrabold text-[15px] inline-flex items-center gap-2"
          >
            내 가게 등록하기 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <footer className="px-6 lg:px-12 py-8 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-[#2C2F35]">
        © 2026 리스터코퍼레이션 · <a href="mailto:jiwon@ur-team.com" className="underline">jiwon@ur-team.com</a>
      </footer>
    </div>
  )
}
