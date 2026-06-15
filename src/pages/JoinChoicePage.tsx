/**
 * 🛡️ 2026-05-28: 가입 진입 분기 (docs/SERVICE_MODEL.md §8).
 * 🏁 2026-06-15 (옵션 1 — 크리에이터=유저 분리, 대표 승인): 크리에이터는 더 이상 "셀러"로 가입하지 않는다.
 *   업주(매장)만 정식 가입(사업자), 크리에이터·이용자는 로그인만 하면 링크샵으로 바로 시작(별도 가입 X).
 *   → 업주 vs 크리에이터 충돌 근본 제거. 다크 테마, 분홍 액센트 제거(검정/뉴트럴).
 */

import { Link } from 'react-router-dom'
import SEO from '@/components/SEO'

const CHOICES = [
  {
    to: '/seller/register/supplier',
    emoji: '🏪',
    title: '매장 운영자',
    desc: '우리 가게 공동구매를 올리고 손님을 모아요. 매출은 현금으로 정산받습니다.',
    cta: '매장 가입하기',
  },
  {
    to: '/login',
    emoji: '🎤',
    title: '크리에이터 · 이용자',
    desc: '별도 가입 없이 로그인만 하면 시작! 공구에 참여하고, 내 링크샵으로 상품을 추천해 커미션을 받아요.',
    cta: '로그인하고 시작',
  },
] as const

export default function JoinChoicePage() {
  return (
    <>
      <SEO title="시작하기 - 유어딜" description="동네 핫플, 친구랑 공동구매. 매장 가입 또는 로그인으로 시작하세요." url="/join" />
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
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-2xl">
                    {ch.emoji}
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
