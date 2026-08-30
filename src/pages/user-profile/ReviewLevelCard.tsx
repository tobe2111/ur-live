// 🗺️ 2026-07-02 (카카오맵 리뷰 게이미피케이션 — 대표 "유어딜과 잘 연계되게"): 마이페이지 동네 리뷰어
//   레벨 카드. 게이미피케이션 동기부여 루프를 프로필에 상시 노출(레벨/진행도 + 후기 미션 진입).
//   설계: docs/design/kakao-review-gamification.md
import { useState, useEffect } from 'react'
import { formatNumber, safeNum } from '@/utils/format'
import { useNavigate } from 'react-router-dom'
import { Award, ChevronRight } from 'lucide-react'
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
  // 🔢 2026-08-30: 응답 필드가 비면 `undefined건` / `width: NaN%` 이 그대로 화면에 나간다.
  //   CLAUDE.md "숫자 포매팅" 룰(대시보드 ₩NaN 사고)의 소비자판 — 직접 보간하지 말 것.
  //   ⚠️ 프리뷰 목 응답에서 발견했다. 라이브 API 는 정상일 수 있지만, 부분 응답은
  //      언제든 생기고 그때 사용자에게 'undefined' 가 보이는 건 어느 쪽이든 결함이다.
  const approved = safeNum(data.approved_count)
  const pct = data.next_threshold != null && data.next_threshold > 0
    ? Math.min(100, Math.round((approved / data.next_threshold) * 100))
    : 100

  return (
    // 📐 2026-08-17 (대표 신고 — PC 에서 이 카드만 화면 풀폭으로 벌어짐): 형제 섹션(OrderStatusBar·
    // TeamPointsCard·ShoppingGroup …)은 전부 `ur-content-medium px-4 lg:px-8` 로 자기 폭을 감싸는데
    // 이 카드만 bare `w-full` 이라 /user/profile 풀블리드(PC)에서 혼자 컨테이너 밖까지 늘어났다.
    <div className="ur-content-medium px-4 lg:px-8">
    <button
      type="button"
      onClick={() => navigate('/my-vouchers')}
      className="w-full mt-3 rounded-2xl bg-white dark:bg-[#1A2334] px-4 py-3.5 text-left active:bg-gray-50 dark:active:bg-white/[0.06] transition-colors"
    >
      <div className="flex items-center gap-3">
        <Award className="w-6 h-6 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-gray-900 dark:text-white">동네 리뷰어 Lv.{formatNumber(data.level)}</span>
            <span className="text-[11px] font-medium text-gray-500 dark:text-white/50">· {data.label}</span>
          </div>
          <p className="text-[10.5px] text-gray-500 dark:text-white/45 mt-0.5">
            {data.next_level != null && data.remaining != null
              ? `Lv.${data.next_level}까지 카카오맵 후기 ${formatNumber(data.remaining)}건 더 (누적 ${formatNumber(approved)}건)`
              : `최고 레벨 달성 · 누적 후기 ${formatNumber(approved)}건`}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
            <div className="h-full rounded-full bg-gray-900 dark:bg-white transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-white/30 shrink-0" aria-hidden="true" />
      </div>
    </button>
    </div>
  )
}
