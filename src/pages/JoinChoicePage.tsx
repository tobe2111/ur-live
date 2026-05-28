/**
 * 🛡️ 2026-05-28: 가입 진입 분기 (docs/SERVICE_MODEL.md §8).
 *
 * "동네 핫플, 친구랑 공동구매" — 역할을 명확히 분기:
 *   🏪 매장 운영자  → /seller/register/supplier (store_owner)
 *   🎤 크리에이터    → /seller/register/business (influencer: 방송·영입·홍보)
 *   🛒 일반 이용     → 로그인 (큐레이터 — 별도 가입 없음, 추천 수익 가능)
 *
 * 다크 테마 (유저 대면 메인).
 */

import { Link } from 'react-router-dom'
import SEO from '@/components/SEO'

const CHOICES = [
  {
    to: '/seller/register/supplier',
    emoji: '🏪',
    title: '매장 운영자',
    desc: '우리 가게 공동구매를 올리고 손님을 모아요. 매출은 현금으로 정산받습니다.',
    accent: 'from-pink-500 to-rose-500',
  },
  {
    to: '/seller/register/business',
    emoji: '🎤',
    title: '크리에이터',
    desc: '라이브·SNS로 매장 공구를 홍보하고, 매장을 영입해 커미션을 받아요.',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    to: '/login',
    emoji: '🛒',
    title: '그냥 이용할래요',
    desc: '공구에 참여하고, 마음에 든 상품을 친구에게 추천해 수익도 만들 수 있어요.',
    accent: 'from-amber-400 to-orange-500',
  },
] as const

export default function JoinChoicePage() {
  return (
    <>
      <SEO title="시작하기 - 유어딜" description="동네 핫플, 친구랑 공동구매. 매장·크리에이터·일반 이용을 선택하세요." url="/join" />
      <div className="min-h-screen bg-[#020202] text-white px-4 py-10">
        <div className="ur-content-narrow mx-auto">
          <h1 className="text-2xl font-bold mb-1">동네 핫플, 친구랑 공동구매</h1>
          <p className="text-gray-400 text-sm mb-8">어떻게 시작하시겠어요?</p>

          <div className="space-y-4">
            {CHOICES.map((ch) => (
              <Link
                key={ch.to}
                to={ch.to}
                className="block rounded-2xl bg-[#121212] border border-[#1A1A1A] p-5 hover:border-[#2A2A2A] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${ch.accent} flex items-center justify-center text-2xl`}>
                    {ch.emoji}
                  </div>
                  <div>
                    <p className="font-bold text-white">{ch.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ch.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-center text-xs text-gray-500 mt-8">
            이미 계정이 있으신가요? <Link to="/login" className="text-pink-400 font-bold">로그인</Link>
          </p>
        </div>
      </div>
    </>
  )
}
