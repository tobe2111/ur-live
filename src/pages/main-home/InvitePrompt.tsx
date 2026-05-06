import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SharePrompt from '@/components/SharePrompt'

export default function InvitePrompt() {
  const { t } = useTranslation()
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
      title={t('invite.title', { defaultValue: '친구를 초대해보세요! 🎉' })}
      message={t('invite.message', { defaultValue: '친구에게 유어딜을 소개하면 함께 혜택을 받을 수 있어요' })}
      shareTitle={t('invite.shareTitle', { defaultValue: '유어딜 - 라이브 커머스' })}
      shareDescription={t('invite.shareDesc', { defaultValue: '라이브 방송으로 만나는 최저가 특가 상품!' })}
      shareLink="/"
      shareButtonText={t('invite.shareBtn', { defaultValue: '유어딜 보러가기' })}
      reward={t('invite.reward', { defaultValue: '친구 초대 시 500딜 적립!' })}
      onClose={() => setShow(false)}
    />
  )
}
