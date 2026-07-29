// 🗺️ 2026-07-02 (카카오맵 리뷰 게이미피케이션 — 대표 "유어딜과 잘 연계되게"): 마이페이지 동네 리뷰어
//   레벨 카드. 게이미피케이션 동기부여 루프를 프로필에 상시 노출(레벨/진행도 + 후기 미션 진입).
//   설계: docs/design/kakao-review-gamification.md
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import api from '@/lib/api'

type MyLevel = {
  level: number; label: string; score: number; approved_count: number
  next_level: number | null; next_threshold: number | null; remaining: number | null
}

export default function ReviewLevelCard() {
  const navigate = useNavigate()
  const [data, setData] = useState<MyLevel | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api.get('/api/review-bonus/my-level')
      .then((res) => { if (res.data?.success && res.data.data) setData(res.data.data as MyLevel) })
      .catch(() => { /* 비로그인/실패 — 카드 숨김 */ })
      .finally(() => setReady(true))
  }, [])

  if (!ready || !data) return null

  // 진행도 바 — 다음 레벨 임계값 대비 누적 승인 건수 (최고 레벨이면 100%)
  const pct = data.next_threshold != null && data.next_threshold > 0
    ? Math.min(100, Math.round((data.approved_count / data.next_threshold) * 100))
    : 100

  return (
    <button
      type="button"
      onClick={() => navigate('/my-vouchers')}
      className="w-full mt-3 rounded-2xl bg-gray-100 dark:bg-white/[0.04] px-4 py-3.5 text-left active:bg-gray-200 dark:active:bg-white/[0.06] transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">🏅</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-gray-900 dark:text-white">동네 리뷰어 Lv.{data.level}</span>
            <span className="text-[11px] font-medium text-gray-500 dark:text-white/50">· {data.label}</span>
          </div>
          <p className="text-[10.5px] text-gray-500 dark:text-white/45 mt-0.5">
            {data.next_level != null && data.remaining != null
              ? `Lv.${data.next_level}까지 카카오맵 후기 ${data.remaining}건 더 (누적 ${data.approved_count}건)`
              : `최고 레벨 달성 · 누적 후기 ${data.approved_count}건`}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
            <div className="h-full rounded-full bg-gray-900 dark:bg-white transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-white/30 shrink-0" aria-hidden="true" />
      </div>
    </button>
  )
}
