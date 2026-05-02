/**
 * 🛡️ 2026-05-02: TD-018 분할 — ProductDetailPage 공동구매 카운트다운.
 */
import { useEffect, useState } from 'react'

export default function GroupBuyCountdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setRemaining('마감됨'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setRemaining(d > 0 ? `${d}일 ${h}시간 남음` : `${h}시간 ${m}분 남음`)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [deadline])
  return <p className="text-[11px] text-red-400 font-medium mt-1.5">⏰ {remaining}</p>
}
