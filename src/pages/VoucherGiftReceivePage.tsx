/**
 * 🎁 이용권 선물 받기 — `/gift/v/:token` (2026-10-11 대표 "1,2,4 해줄래" 중 4번)
 *
 * 카카오톡으로 받은 링크가 여는 화면. 로그인 안 했으면 받기 버튼이 로그인으로 보내고(돌아올 주소를 싣는다),
 * 받으면 내 이용권 지갑으로 간다. 이용권 코드(QR)는 받기 전엔 서버가 아예 안 준다.
 * 선물 링크는 개인 링크라 검색에 안 올린다(noindex).
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import Udal from '@/components/mascot/Udal'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'
import { loginPathFromHere } from '@/utils/login-return'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { safeDate } from '@/utils/safe-date'

type GiftView = {
  state: 'pending' | 'accepted' | 'cancelled' | 'unavailable'
  message: string | null
  sender_name: string | null
  product_name: string | null
  product_image: string | null
  store_name: string | null
  store_address: string | null
  expires_at: string | null
}

const DEAD: Record<Exclude<GiftView['state'], 'pending'>, string> = {
  accepted: '이미 받은 선물이에요',
  cancelled: '보낸 분이 선물을 취소했어요',
  unavailable: '더 이상 받을 수 없는 선물이에요',
}

export default function VoucherGiftReceivePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [gift, setGift] = useState<GiftView | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    api.get(`/api/group-buy/gifts/${encodeURIComponent(token)}`)
      .then((r) => { if (alive) setGift(r.data?.data ?? null) })
      .catch((e) => { if (alive) setError(e?.response?.data?.error || '선물을 찾을 수 없어요') })
    return () => { alive = false }
  }, [token])

  const accept = async () => {
    if (busy) return
    if (!getUserIdSync()) { navigate(loginPathFromHere()); return }
    setBusy(true)
    try {
      await api.post(`/api/group-buy/gifts/${encodeURIComponent(token)}/accept`)
      toast.success('선물을 받았어요. 내 이용권에 넣어 뒀어요')
      navigate('/my-vouchers', { replace: true })
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '선물을 받지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  if (!gift && !error) return <BrandLoader fullScreen />

  const exp = safeDate(gift?.expires_at)
  const expLabel = exp ? `${exp.getFullYear()}.${String(exp.getMonth() + 1).padStart(2, '0')}.${String(exp.getDate()).padStart(2, '0')}까지` : null
  const dead = !gift ? error : gift.state === 'pending' ? '' : DEAD[gift.state]

  return (
    <div className="min-h-[100dvh] bg-warm px-4 pt-10 pb-[calc(24px+env(safe-area-inset-bottom))]">
      <SEO title="이용권 선물 - 유어딜" description="친구가 보낸 이용권 선물이에요" url={`/gift/v/${token}`} noindex />
      <div className="mx-auto max-w-[420px]">
        <div className="flex justify-center">
          <Udal mood={dead ? 'lost' : 'yay'} size={112} />
        </div>
        <h1 className="mt-4 text-center text-[24px] font-bold text-gray-900 dark:text-white">
          {dead ? dead : `${gift?.sender_name || '친구'}님이 이용권을 선물했어요`}
        </h1>

        {gift && (
          <div className="mt-6 rounded-2xl p-4 flex gap-3">
            <div className="w-[72px] h-[72px] shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
              {gift.product_image && (
                <img src={cfImage(gift.product_image, { width: 200, quality: 82, format: 'auto' }) || gift.product_image} alt=""
                  className="w-full h-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, gift.product_image)} />
              )}
            </div>
            <div className="min-w-0">
              {gift.store_name && <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">{gift.store_name}</p>}
              <p className="text-[15px] font-medium text-gray-900 dark:text-white leading-snug">{gift.product_name || '이용권'}</p>
              {expLabel && <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">{expLabel}</p>}
            </div>
          </div>
        )}

        {gift?.message && !dead && (
          <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-[15px] text-gray-900 dark:text-white whitespace-pre-wrap">“{gift.message}”</p>
        )}

        {dead ? (
          <button type="button" onClick={() => navigate('/')}
            className="mt-8 w-full py-4 rounded-2xl bg-brand text-white text-[15px] font-bold">
            유어딜 둘러보기
          </button>
        ) : (
          <>
            <button type="button" onClick={accept} disabled={busy}
              className="mt-8 w-full py-4 rounded-2xl bg-brand text-white text-[15px] font-bold disabled:opacity-50 active:scale-[0.98] transition-transform">
              {busy ? '받는 중…' : getUserIdSync() ? '선물 받기' : '로그인하고 선물 받기'}
            </button>
            <p className="mt-3 text-center text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
              받으면 내 이용권 지갑에 들어가요. 매장에서 QR을 보여 주고 쓰면 돼요.<br />
              선물 받은 이용권은 직접 취소·환불할 수 없어요.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
