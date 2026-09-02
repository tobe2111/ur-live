/**
 * 🛡️ 2026-05-28: 가입 진입 분기 (docs/SERVICE_MODEL.md §8).
 * 🏁 2026-06-15 (옵션 1 — 소개=유저 분리, 대표 승인): 소개하는 사람은 "셀러"로 가입하지 않는다.
 *   매장만 등록 절차를 거치고, 사고 소개하는 사람은 로그인만 하면 유어샵으로 바로 시작(별도 가입 X).
 *   🏷️ 2026-08-26: 사람을 신분(크리에이터/이용자)으로 부르지 않고 **행위**(내 가게 팔기 / 사고 소개하기)로 나눈다. 다크 테마, 분홍 액센트 제거(검정/뉴트럴).
 */

import { Link } from 'react-router-dom'
import { Megaphone, Store } from 'lucide-react'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'

const CHOICES = [
  {
    to: '/store/new',
    Icon: Store,
    title: '내 가게 팔기',
    desc: '카카오맵에서 우리 가게를 찾아 등록하면, 이용권을 올리고 손님을 모을 수 있어요. 매출은 현금으로 정산받습니다.',
    cta: '내 가게 등록하기',
  },
  {
    to: '/login',
    Icon: Megaphone,
    title: '딜 사고 소개하기',
    desc: '별도 가입 없이 로그인만 하면 시작! 동네 딜을 사고, 마음에 든 딜은 내 유어샵에 담아 소개하면 됩니다.',
    cta: '로그인하고 시작',
  },
] as const

export default function JoinChoicePage() {
  return (
    <>
      <SEO title={CONSUMER_SURFACE_SEO['/join'].title} description={CONSUMER_SURFACE_SEO['/join'].description} url="/join" />
      <div className="min-h-screen bg-[#11141C] text-white px-4 py-10">
        <div className="ur-content-narrow mx-auto">
          <h1 className="text-2xl font-bold mb-1">동네 핫플, 친구랑 공동구매</h1>
          <p className="text-gray-400 text-sm mb-8">어떻게 시작하시겠어요?</p>

          <div className="space-y-4">
            {CHOICES.map((ch) => (
              <Link
                key={ch.to}
                to={ch.to}
                className="block rounded-2xl bg-[#1D1F29] border border-[#2C2F35] p-5 hover:border-[#2C2F35] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-2xl">
                    {<ch.Icon className="w-7 h-7 text-gray-500 dark:text-gray-400" aria-hidden="true" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white">{ch.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ch.desc}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-gray-900 bg-white rounded-full px-3 py-1.5">{ch.cta}</span>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-center text-xs text-gray-500 mt-8">
            이미 계정이 있으신가요? <Link to="/login" className="text-white font-bold underline">로그인</Link>
          </p>
        </div>
      </div>
    </>
  )
}
