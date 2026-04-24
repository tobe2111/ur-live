import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Ticket, MapPin, Clock, CheckCircle, XCircle, QrCode, X, Gift, Share2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'

interface Voucher {
  id: number
  code: string
  status: 'unused' | 'used' | 'expired' | 'refunded'
  product_name: string
  restaurant_name?: string
  restaurant_address?: string
  product_image?: string
  expires_at?: string
  used_at?: string
  created_at: string
}

const STATUS_MAP = {
  unused: { labelKey: 'voucher.status.unused', color: 'bg-green-100 text-green-700', icon: Ticket },
  used: { labelKey: 'voucher.status.used', color: 'bg-gray-100 text-gray-500', icon: CheckCircle },
  expired: { labelKey: 'voucher.status.expired', color: 'bg-red-100 text-red-600', icon: XCircle },
  refunded: { labelKey: 'voucher.status.refunded', color: 'bg-yellow-100 text-yellow-700', icon: XCircle },
} as const

function VoucherQRCode({ value, size = 160 }: { value: string; size?: number }) {
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`}
      alt="QR Code"
      className="mx-auto"
      width={size}
      height={size}
    />
  )
}

function QRModal({ voucher, onClose }: { voucher: Voucher; onClose: () => void }) {
  const { t } = useTranslation()
  const qrUrl = `https://live.ur-team.com/v/${voucher.code}`

  async function shareVoucher() {
    const shareData = {
      title: `[유어딜 식사권] ${voucher.product_name}`,
      text: `${voucher.restaurant_name ? voucher.restaurant_name + ' · ' : ''}${voucher.product_name} 식사권을 보내드립니다.`,
      url: qrUrl,
    }
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav && 'share' in nav) {
      try { await (nav as Navigator).share(shareData); return } catch { /* cancelled or fallback */ }
    }
    try {
      await (nav as Navigator)?.clipboard.writeText(`${shareData.text}\n${qrUrl}`)
      toast.success('링크가 복사되었습니다')
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 mx-4 max-w-xs w-full relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-500" />
        </button>
        <p className="text-center text-sm font-bold text-gray-900 mb-1">{voucher.product_name}</p>
        {voucher.restaurant_name && (
          <p className="text-center text-xs text-gray-500 mb-4">{voucher.restaurant_name}</p>
        )}
        <div className="flex justify-center mb-4">
          <VoucherQRCode value={qrUrl} size={160} />
        </div>
        <div className="bg-gray-100 rounded-lg px-3 py-2 text-center">
          <code className="text-sm font-mono font-bold text-pink-500">{voucher.code}</code>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-2">{t('voucher.showQrAtStore')}</p>

        {/* 선물/공유 버튼 (사용 가능한 식사권만) */}
        {voucher.status === 'unused' && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={shareVoucher}
              className="py-2.5 rounded-xl bg-pink-50 border border-pink-200 text-pink-600 text-xs font-bold flex items-center justify-center gap-1">
              <Share2 className="w-3.5 h-3.5" /> 공유
            </button>
            <button onClick={shareVoucher}
              className="py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1">
              <Gift className="w-3.5 h-3.5" /> 선물하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MyVouchersPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [qrVoucher, setQrVoucher] = useState<Voucher | null>(null)

  useEffect(() => {
    api.get('/api/vouchers/my')
      .then(r => { if (r.data.success) setVouchers(r.data.data || []) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [])

  const locale = i18n.language?.startsWith('ko') ? 'ko-KR' : i18n.language || 'en-US'

  return (
    <div className="min-h-screen bg-white pb-20">
      <SEO title={t('voucher.seoTitle')} description={t('voucher.seoDescription')} url="/my-vouchers" />
      {/* 헤더 */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center px-4 py-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <h1 className="flex-1 text-center text-[18px] font-bold text-gray-900 pr-10">{t('voucher.myVouchers')}</h1>
        </div>
      </div>

      <div className="px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-900 font-bold mb-1">{t('voucher.empty')}</p>
            <p className="text-gray-500 text-sm mb-4">{t('voucher.emptyHint')}</p>
            <button onClick={() => navigate('/browse?category=meal_voucher')} className="px-5 py-2.5 bg-pink-500 text-white rounded-full text-sm font-bold">
              {t('voucher.exploreRestaurants')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {vouchers.map(v => {
              const st = STATUS_MAP[v.status] || STATUS_MAP.unused
              return (
                <div key={v.id} className={`bg-white rounded-2xl overflow-hidden border border-gray-200 ${v.status === 'unused' ? '' : 'opacity-60'}`}>
                  <div className="flex">
                    {/* 상품 이미지 */}
                    {v.product_image && (
                      <img src={v.product_image} alt="" className="w-24 h-full object-cover shrink-0" />
                    )}
                    <div className="flex-1 p-4">
                      {/* 상태 배지 */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.color}`}>
                        <st.icon className="w-3 h-3" />
                        {t(st.labelKey)}
                      </span>
                      {/* 상품명 */}
                      <p className="text-sm font-bold text-gray-900 mt-1.5">{v.product_name}</p>
                      {/* 식당 */}
                      {v.restaurant_name && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" /> {v.restaurant_name}
                        </p>
                      )}
                      {/* 바우처 코드 */}
                      <div className="mt-2 bg-gray-100 rounded-lg px-3 py-2 flex items-center justify-between">
                        <code className="text-sm font-mono font-bold text-pink-400">{v.code}</code>
                        <div className="flex items-center gap-2">
                          {v.status === 'unused' && (
                            <button
                              onClick={() => setQrVoucher(v)}
                              className="text-[10px] text-pink-500 hover:text-pink-600 font-medium flex items-center gap-0.5"
                            >
                              <QrCode className="w-3 h-3" />
                              {t('voucher.scan')}
                            </button>
                          )}
                          {v.status === 'unused' && (
                            <button
                              onClick={() => navigator.clipboard?.writeText(v.code)}
                              className="text-[10px] text-gray-500 hover:text-gray-900"
                            >
                              {t('voucher.copy')}
                            </button>
                          )}
                        </div>
                      </div>
                      {/* 유효기간 */}
                      {v.expires_at && (
                        <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {v.status === 'used'
                            ? `${t('voucher.usedAt')}: ${new Date(v.used_at!).toLocaleDateString(locale)}`
                            : `${t('voucher.expiresAt')}: ${new Date(v.expires_at).toLocaleDateString(locale)}${t('voucher.until')}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {qrVoucher && <QRModal voucher={qrVoucher} onClose={() => setQrVoucher(null)} />}
    </div>
  )
}
