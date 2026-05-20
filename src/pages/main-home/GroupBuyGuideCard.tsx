/**
 * 🛡️ 2026-05-20: 홈 피드 상단 — "공구로 딜 얻는 법" 가이드 카드.
 *
 * 사용자 요청: 예전 + 버튼 시절의 공구→딜 플로우 가이드 복원.
 * 단순화된 홈에 맞게 compact 카드 (3-step horizontal, 작은 dismissible).
 *
 * Dismissible: localStorage 'ur_home_guide_dismissed_v1' 플래그로 한 번 닫으면 영구 숨김.
 *   v 번호 올리면 새 가이드 보이게 가능.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, Sparkles } from 'lucide-react'

const DISMISS_KEY = 'ur_home_guide_dismissed_v1'

export default function GroupBuyGuideCard() {
  const [dismissed, setDismissed] = useState(true) // SSR/hydration 안전 — 초기엔 안 보임.

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch { /* localStorage 차단 */ }
  }, [])

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* noop */ }
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="mx-4 mt-3 mb-1 rounded-2xl bg-gradient-to-br from-pink-50 to-amber-50 dark:from-pink-500/[0.08] dark:to-amber-500/[0.08] border border-pink-100 dark:border-pink-500/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-pink-600 dark:text-pink-300">
          <Sparkles className="w-3.5 h-3.5" />
          공구로 딜 얻는 법
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="가이드 닫기"
          className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3-step horizontal flow */}
      <ol className="grid grid-cols-3 gap-2 text-center">
        <li className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-white dark:bg-[#1A1A1A] border border-pink-200 dark:border-pink-500/30 flex items-center justify-center text-base mb-1">
            🛒
          </div>
          <p className="text-[10px] font-bold text-gray-900 dark:text-white">결제</p>
          <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">마음에 든 공구권 결제</p>
        </li>
        <li className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-white dark:bg-[#1A1A1A] border border-pink-200 dark:border-pink-500/30 flex items-center justify-center text-base mb-1">
            💌
          </div>
          <p className="text-[10px] font-bold text-gray-900 dark:text-white">공유</p>
          <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">친구가 결제 시 자동 적립</p>
        </li>
        <li className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-white dark:bg-[#1A1A1A] border border-pink-200 dark:border-pink-500/30 flex items-center justify-center text-base mb-1">
            💰
          </div>
          <p className="text-[10px] font-bold text-gray-900 dark:text-white">적립</p>
          <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">현금처럼 쓰는 딜 받기</p>
        </li>
      </ol>

      {/* CTA — 자세히 보기 / referral 페이지 */}
      <div className="mt-2.5 flex items-center justify-center gap-3 text-[11px]">
        <Link to="/influencer" className="font-bold text-pink-600 dark:text-pink-300 hover:underline">
          내 추천 링크 →
        </Link>
        <span className="text-gray-300 dark:text-gray-600">·</span>
        <Link to="/help/deal-guide" className="font-medium text-gray-600 dark:text-gray-400 hover:underline">
          자세히
        </Link>
      </div>
    </div>
  )
}
