import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { ArrowLeft, Ticket, MapPin, Clock, CheckCircle, XCircle, QrCode, X } from 'lucide-react'
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
  unused: { label: '사용 가능', color: 'bg-green-100 text-green-700', icon: Ticket },
  used: { label: '사용 완료', color: 'bg-gray-100 text-gray-500', icon: CheckCircle },
  expired: { label: '만료됨', color: 'bg-red-100 text-red-600', icon: XCircle },
  refunded: { label: '환불됨', color: 'bg-yellow-100 text-yellow-700', icon: XCircle },
}

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
  const qrUrl = `https://live.ur-team.com/v/${voucher.code}`

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
        <p className="text-[10px] text-gray-400 text-center mt-2">매장에서 이 QR 코드를 보여주세요</p>
      </div>
    </div>
  )
}

export default function MyVouchersPage() {
  const navigate = useNavigate()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [qrVoucher, setQrVoucher] = useState<Voucher | null>(null)

  useEffect(() => {
    api.get('/api/vouchers/my')
      .then(r => { if (r.data.success) setVouchers(r.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-white pb-20">
      <SEO title="내 식사권 - 유어딜" description="구매한 식사권을 확인하고 사용하세요" url="/my-vouchers" />
      {/* 헤더 */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center px-4 py-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <h1 className="flex-1 text-center text-[18px] font-bold text-gray-900 pr-10">내 식사권</h1>
        </div>
      </div>

      <div className="px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-900 font-bold mb-1">아직 식사권이 없습니다</p>
            <p className="text-gray-500 text-sm mb-4">맛집 공동구매에 참여해보세요!</p>
            <button onClick={() => navigate('/browse?category=meal_voucher')} className="px-5 py-2.5 bg-pink-500 text-white rounded-full text-sm font-bold">
              맛집 둘러보기
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
                        {st.label}
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
                              QR 보기
                            </button>
                          )}
                          {v.status === 'unused' && (
                            <button
                              onClick={() => navigator.clipboard?.writeText(v.code)}
                              className="text-[10px] text-gray-500 hover:text-gray-900"
                            >
                              복사
                            </button>
                          )}
                        </div>
                      </div>
                      {/* 유효기간 */}
                      {v.expires_at && (
                        <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {v.status === 'used' ? `사용일: ${new Date(v.used_at!).toLocaleDateString('ko-KR')}` : `유효기간: ${new Date(v.expires_at).toLocaleDateString('ko-KR')}까지`}
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
