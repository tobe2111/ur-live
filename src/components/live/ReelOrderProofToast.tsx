/**
 * 🛡️ 2026-05-22: ReelCard.tsx (1515줄) 분할 — 결제 사회적 증명 토스트.
 *
 * 2026-05-13: TikTok / 라이브 커머스 표준 패턴.
 * 4초 동안 슬라이드 인-아웃, 마스킹된 이름 + 상품명 표시.
 * chat 시스템 메시지와 중복이지만 채팅 안 보는 시청자에게도 명확.
 *
 * keyframes: index.css 의 animate-orderProofIn.
 */

import { useEffect, useState } from 'react'

interface OrderProof {
  buyer: string
  product: string
  amount: number
  ts: number
}

export default function ReelOrderProofToast({ proof }: { proof: OrderProof }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [proof.ts])

  if (!visible) return null

  return (
    <div className="absolute bottom-24 left-3 z-30 max-w-[260px] pointer-events-none">
      <div className="rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 px-3 py-2 shadow-2xl animate-orderProofIn">
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">🛍️</span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white truncate">
              {proof.buyer}님 구매!
            </p>
            <p className="text-[10px] text-white/70 truncate">{proof.product}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
