/**
 * 🛡️ 2026-05-02: TD-018 분할 — MainHomePage 친구 초대 prompt (최근 본 상품 ≤1 인 신규 유저 대상).
 */
import { useEffect, useState } from 'react'
import SharePrompt from '@/components/SharePrompt'

export default function InvitePrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const userId = localStorage.getItem('user_id')
    if (!userId || localStorage.getItem('invite_prompt_shown') === '1') return
    const recent = localStorage.getItem('recently_viewed')
    if (!recent || JSON.parse(recent).length <= 1) {
      setTimeout(() => setShow(true), 3000)
      localStorage.setItem('invite_prompt_shown', '1')
    }
  }, [])

  if (!show) return null

  return (
    <SharePrompt
      title="친구를 초대해보세요! 🎉"
      message="친구에게 유어딜을 소개하면 함께 혜택을 받을 수 있어요"
      shareTitle="유어딜 - 라이브 커머스"
      shareDescription="라이브 방송으로 만나는 최저가 특가 상품!"
      shareLink="/"
      shareButtonText="유어딜 보러가기"
      reward="친구 초대 시 500딜 적립!"
      onClose={() => setShow(false)}
    />
  )
}
