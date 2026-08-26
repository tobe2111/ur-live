/**
 * 🎁 "내 링크로 팔리면 N% 적립" — 이용권 상세의 소개 보상 배너 (2026-08-26 대표 지시)
 *
 * 대표: *"이 링크를 공유하면 x% 딜이 쌓여요! 이런 식으로도 보여야겠네?"*
 *
 * ⚠️ **아무에게나 띄우면 안 된다.** 2026-08-22 대표 결정으로 어필리에이트(누구나 공유 2%)는
 *   **종료**됐고("어필리에이트 전략은 빼려고 해. 심플하게"), 커미션 축은 **매장이 제안하고
 *   소개자가 수락한 딜** 하나만 남았다. 그래서 이 배너는 그 딜을 실제로 가진 사람에게만 뜬다.
 *   서버(`/api/influencer-settlement/deal-for-seller/:sellerId`)가 결제 시점과 **같은 조건**으로
 *   판정하므로, 화면의 % 와 정산의 % 가 갈릴 수 없다.
 *
 * fail-soft: 조회 실패·비로그인·딜 없음 → **아무것도 안 그린다**(없는 보상을 약속하지 않는다).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift, Copy, Check } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Props {
  /** 이 이용권을 파는 매장 */
  sellerId?: number | null
  /** 공유할 대상(이용권) id */
  productId: number | string
}

export default function ShareRewardBanner({ sellerId, productId }: Props) {
  // 내 유어샵 핸들은 여기서 직접 읽는다 — 호출부가 이 배너의 사정을 알 필요가 없다.
  const myHandle = (() => { try { return localStorage.getItem('user_handle') } catch { return null } })()
  const { t } = useTranslation()
  const [pct, setPct] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    const id = Number(sellerId)
    if (!Number.isFinite(id) || id <= 0) return
    api.get(`/api/influencer-settlement/deal-for-seller/${id}`)
      .then(r => {
        const d = r.data?.data
        if (alive && d?.active && Number(d.commission_pct) > 0) setPct(Number(d.commission_pct))
      })
      .catch(() => { /* 비로그인·권한없음·오류 — 조용히 미표시 */ })
    return () => { alive = false }
  }, [sellerId])

  if (pct == null) return null

  // 🔗 어트리뷰션은 유어샵 경유 링크에 붙는다(핀 클릭 리다이렉트 → affiliate_ref).
  //   핸들이 없으면(아직 미설정) 상세 링크라도 준다 — 없는 것보단 낫다.
  const shareUrl = myHandle
    ? `${window.location.origin}/u/${myHandle}/p/${productId}`
    : `${window.location.origin}/group-buy/${productId}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success(t('share.copied', { defaultValue: '링크를 복사했어요' }))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('share.copyFailed', { defaultValue: '복사에 실패했어요' }))
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-brand/25 bg-brand/[0.06] px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 shrink-0 rounded-xl bg-brand text-white flex items-center justify-center">
          <Gift className="w-[17px] h-[17px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-extrabold text-gray-900 dark:text-white">
            {t('share.rewardTitle', { defaultValue: '내 링크로 팔리면 {{pct}}% 적립돼요', pct })}
          </p>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            {t('share.rewardDesc', { defaultValue: '이 매장과 맺은 딜이에요. 아래 링크로 공유하면 내 몫으로 쌓입니다.' })}
          </p>
        </div>
      </div>
      <button
        onClick={copy}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-[#0F151D] text-[13px] font-bold active:scale-[0.98] transition"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? t('share.copied', { defaultValue: '링크를 복사했어요' }) : t('share.copyMyLink', { defaultValue: '내 링크 복사하기' })}
      </button>
    </div>
  )
}
