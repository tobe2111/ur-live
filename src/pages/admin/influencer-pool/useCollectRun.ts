import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 🔄 통합 수집 실행 훅 (2026-07-27 — 페이지 이탈 안전성 정리).
 *
 *   수집 자체는 브라우저와 분리돼 있다: 메인 워커가 waitUntil 로 던지고, ur-ads 워커가
 *   self-chain(자기 자신을 waitUntil 호출)으로 YT 예산 소진까지 자가전파한다 → **페이지를 떠나도
 *   서버 작업은 끝까지 돈다**(진행/결과는 D1 에 기록). 문제는 화면 쪽 두 가지였다:
 *
 *   ① 이탈 후에도 폴링 루프(12s × 25 = 최대 5분)가 계속 돌아 쓸데없는 요청을 냈다 → 언마운트에서 중단.
 *   ② '수집 중' 이 화면 로컬 state 라 나갔다 오면 버튼이 다시 활성화돼 보였고, 다시 누르면 서버 lease 가
 *      막아 아무 일도 안 하는데 UI 는 "시작했어요" 라고 했다 → 서버 lease(collect_running)를 신호로 쓰고,
 *      busy 응답은 정직하게 "이미 진행 중" 으로 안내.
 */
const POLL_MS = 12_000
const MAX_TICKS = 25   // 12s × 25 ≈ 5분(수집 한 사이클 상한). 넘으면 폴링만 멈추고 서버는 계속.
const IDLE_STOP = 2    // lease 미보유가 연속 2회 = 실행 종료(체인 홉 사이 짧은 공백 오판 방지)

type MetaPayload = { run?: { yt_budget?: { used?: number; total?: number } }; collect_running?: boolean }

export function useCollectRun(
  applyMeta: (d: Record<string, unknown>) => void,
  onFinish: () => void,
) {
  const [starting, setStarting] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, []) // 🚪 언마운트 = 폴링 중단(서버 작업은 무관하게 계속)

  const collectNow = useCallback(async () => {
    setStarting(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/collect-burst', {})
      if (!r.data?.success) { toast.error(r.data?.error || '수집 시작 실패'); return }
      if (r.data.busy) toast.info('이미 수집이 진행 중입니다 — 새로 시작하지 않았어요. 끝나면 통계가 자동 갱신됩니다')
      else toast.success('통합 수집을 시작했어요 — 유튜브·네이버·티스토리 전 매체, YouTube 예산 소진까지 백그라운드로 진행됩니다. 페이지를 떠나도 계속돼요')
      let idle = 0
      for (let i = 0; i < MAX_TICKS; i++) {
        await new Promise(res => setTimeout(res, POLL_MS))
        if (!alive.current) return
        try {
          const s = await api.get('/api/admin/ads/influencer-pool/stats')
          if (!alive.current) return
          if (!s.data?.success) continue
          applyMeta(s.data)
          const d = s.data as MetaPayload
          const yb = d.run?.yt_budget
          if (yb && typeof yb.used === 'number' && typeof yb.total === 'number' && yb.used >= yb.total) {
            toast.success(`오늘 YouTube 예산 소진 완료 (${yb.used}/${yb.total}) — 수집 마감`); break
          }
          idle = d.collect_running === false ? idle + 1 : 0
          if (idle >= IDLE_STOP) break // 실행 종료 — 더 볼 게 없음
        } catch { /* 폴링 지속 */ }
      }
      if (alive.current) onFinish()
    } catch { toast.error('수집 시작 실패') } finally { if (alive.current) setStarting(false) }
  }, [applyMeta, onFinish])

  return { starting, collectNow }
}
