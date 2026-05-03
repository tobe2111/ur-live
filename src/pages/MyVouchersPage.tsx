import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Ticket, MapPin, Clock, CheckCircle, XCircle, QrCode, X, Gift, Share2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { LargeTitle, WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import { walletTokens } from '@/components/wallet/walletTokens'

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
      height={size} loading="lazy" />
  )
}

function QRModal({ voucher, onClose }: { voucher: Voucher; onClose: () => void }) {
  const { t } = useTranslation()
  useEscapeKey(onClose)
  const qrUrl = `https://live.ur-team.com/v/${voucher.code}`

  async function shareVoucher() {
    const shareData = {
      title: t('voucher.shareTitle', { productName: voucher.product_name }),
      text: t('voucher.shareText', { restaurant: voucher.restaurant_name ? voucher.restaurant_name + ' · ' : '', productName: voucher.product_name }),
      url: qrUrl,
    }
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav && 'share' in nav) {
      try { await (nav as Navigator).share(shareData); return } catch { /* cancelled or fallback */ }
    }
    try {
      await (nav as Navigator)?.clipboard.writeText(`${shareData.text}\n${qrUrl}`)
      toast.success(t('voucher.linkCopied'))
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose} role="presentation">
      <div className="bg-white rounded-2xl p-6 mx-4 max-w-xs w-full relative" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('voucher.qrCode', { defaultValue: 'QR 코드' })}>
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
              <Share2 className="w-3.5 h-3.5" /> {t('voucher.share')}
            </button>
            <button onClick={shareVoucher}
              className="py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1">
              <Gift className="w-3.5 h-3.5" /> {t('voucher.gift')}
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

  // 🛡️ 2026-04-30: CLAUDE.md 규칙 — /my-vouchers 는 화이트 테마 (쇼핑/결제 플로우)
  const theme = 'light' as const
  const tk = walletTokens[theme]

  // 상태별 그룹핑
  const groups = [
    { key: 'unused',   label: t('voucher.groupUnused'),   items: vouchers.filter(v => v.status === 'unused') },
    { key: 'used',     label: t('voucher.groupUsed'),     items: vouchers.filter(v => v.status === 'used') },
    { key: 'expired',  label: t('voucher.groupExpired'),  items: vouchers.filter(v => v.status === 'expired') },
    { key: 'refunded', label: t('voucher.groupRefunded'), items: vouchers.filter(v => v.status === 'refunded') },
  ].filter(g => g.items.length > 0)

  return (
    <WalletPageWrapper theme={theme}>
      <SEO title={t('voucher.seoTitle')} description={t('voucher.seoDescription')} url="/my-vouchers" />

      {/* 상단 chrome — 뒤로가기 + 알림 영역 */}
      <div className="sticky top-0 z-30 px-2 pt-3 pb-2 flex items-center"
        style={{ background: tk.chrome, borderBottom: `0.5px solid ${tk.separator}` }}>
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: tk.fillSoft, color: tk.label }}
          aria-label="뒤로가기"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Large Title */}
      <LargeTitle theme={theme} title={t('voucher.myVouchers')} />

      <div className="ur-content-narrow px-4 lg:px-8 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: tk.accent, borderTopColor: 'transparent' }} />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="w-12 h-12 mx-auto mb-3" style={{ color: tk.tertiary }} />
            <p className="font-bold mb-1" style={{ color: tk.label }}>{t('voucher.empty')}</p>
            <p className="text-sm mb-4" style={{ color: tk.secondary }}>{t('voucher.emptyHint')}</p>
            <button
              onClick={() => navigate('/browse?category=meal_voucher')}
              className="px-5 py-2.5 rounded-full text-sm font-bold text-white active:opacity-90"
              style={{ background: tk.accentGradient }}
            >
              {t('voucher.exploreRestaurants')}
            </button>
          </div>
        ) : (
          <>
            {groups.map(group => (
              <div key={group.key} className="mb-6">
                <p className="px-1 mb-1.5 uppercase"
                  style={{ fontSize: 12, color: tk.secondary, fontWeight: 500, letterSpacing: '-0.01em' }}>
                  {group.label} <span style={{ color: tk.tertiary }}>· {group.items.length}</span>
                </p>
                <div className="space-y-2">
                  {group.items.map(v => {
                    const st = STATUS_MAP[v.status] || STATUS_MAP.unused
                    const muted = v.status !== 'unused'
                    return (
                      <div
                        key={v.id}
                        className="rounded-2xl overflow-hidden"
                        style={{ background: tk.card, opacity: muted ? 0.6 : 1 }}
                      >
                        <div className="flex">
                          {v.product_image && (
                            <img src={v.product_image} alt="" loading="lazy" className="w-24 h-auto object-cover shrink-0" />
                          )}
                          <div className="flex-1 p-3.5 min-w-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                              style={{ background: tk.fillSoft, color: tk.label, fontSize: 10, fontWeight: 700 }}>
                              <st.icon className="w-3 h-3" />
                              {t(st.labelKey)}
                            </span>
                            <p style={{ fontSize: 14, fontWeight: 700, color: tk.label, marginTop: 6 }} className="line-clamp-2">{v.product_name}</p>
                            {v.restaurant_name && (
                              <p className="flex items-center gap-1 mt-1" style={{ fontSize: 11, color: tk.secondary }}>
                                <MapPin className="w-3 h-3" /> {v.restaurant_name}
                              </p>
                            )}
                            {/* 바우처 코드 row */}
                            <div className="mt-2 rounded-lg px-3 py-2 flex items-center justify-between"
                              style={{ background: tk.fillSoft }}>
                              <code style={{ fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700, color: tk.accent, letterSpacing: '-0.01em' }}>{v.code}</code>
                              <div className="flex items-center gap-2">
                                {v.status === 'unused' && (
                                  <button
                                    onClick={() => setQrVoucher(v)}
                                    className="flex items-center gap-0.5"
                                    style={{ fontSize: 11, color: tk.accent, fontWeight: 600 }}
                                  >
                                    <QrCode className="w-3 h-3" />
                                    {t('voucher.scan')}
                                  </button>
                                )}
                                {v.status === 'unused' && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard?.writeText(v.code)
                                      toast.success(t('voucher.copied', { defaultValue: '복사됨' }))
                                    }}
                                    style={{ fontSize: 11, color: tk.secondary, fontWeight: 500 }}
                                  >
                                    {t('voucher.copy')}
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* 유효기간 */}
                            {v.expires_at && (
                              <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: 10, color: tk.secondary }}>
                                <Clock className="w-3 h-3" />
                                {v.status === 'used' && v.used_at
                                  ? `${t('voucher.usedAt')}: ${new Date(v.used_at).toLocaleDateString(locale)}`
                                  : `${t('voucher.expiresAt')}: ${new Date(v.expires_at).toLocaleDateString(locale)}${t('voucher.until')}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* QR Code Modal */}
      {qrVoucher && <QRModal voucher={qrVoucher} onClose={() => setQrVoucher(null)} />}
    </WalletPageWrapper>
  )
}
