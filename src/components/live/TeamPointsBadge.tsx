import React, { useState, useEffect } from 'react'
import api from '@/lib/api'

// 팀 포인트 잔액 뱃지 (상단 왼쪽, LIVE 뱃지 아래)
export function TeamPointsBadge() {
  const [balance, setBalance] = useState(0)
  useEffect(() => {
    api.get('/api/points/balance')
      .then(r => { if (r.data.success) setBalance(r.data.data.balance) })
      .catch(() => {})
  }, [])
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md">
      <span className="text-xs">🎁</span>
      <span className="text-[11px] font-bold text-white/90">{balance.toLocaleString()}팀</span>
    </div>
  )
}
