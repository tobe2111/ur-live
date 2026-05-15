/**
 * 🛡️ 2026-05-15: 셀러 onboarding checklist — 가입 후 첫 매출까지 무엇 할 지 명확.
 *
 * 5 단계:
 *   1. 첫 공구 상품 등록
 *   2. Magic Link 사장님에게 발송 (또는 본인 매장이면 PIN 등록)
 *   3. 정산 계좌 등록
 *   4. 첫 voucher 발급 (= 첫 매출)
 *   5. 사업자등록증 업로드 (월 GMV 100만 도달 시 강제)
 *
 * 데이터: /api/seller/dashboard/stats 의 onboarding 필드 활용 (없으면 클라이언트 추정).
 * 모든 단계 완료 시 자동 hide.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, ArrowRight, X, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'

interface ChecklistItem {
  id: string
  title: string
  desc: string
  done: boolean
  cta: string
  href: string
  optional?: boolean
}

const DISMISS_KEY = 'seller_onboarding_dismissed_v1'

export default function SellerOnboardingChecklist() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    if (dismissed) { setLoading(false); return }
    const headers = { Authorization: `Bearer ${getSellerToken()}` }
    Promise.all([
      api.get('/api/seller/products?category=meal_voucher', { headers }).catch(() => ({ data: { data: [] } })),
      api.get('/api/seller/profile', { headers }).catch(() => ({ data: { data: null } })),
      api.get('/api/seller/settlements', { headers }).catch(() => ({ data: { data: [] } })),
    ]).then(([pRes, profRes, sRes]) => {
      const products = pRes.data?.data || []
      const profile = profRes.data?.data || profRes.data || {}
      const settlements = sRes.data?.data || []
      const hasProduct = products.length > 0
      const hasMagicLink = products.some((p: { store_owner_token?: string }) => p.store_owner_token)
      const hasBank = !!(profile.bank_name || profile.account_number)
      const hasSale = settlements.length > 0 || products.some((p: { group_buy_current?: number }) => (p.group_buy_current ?? 0) > 0)
      const hasBusinessLicense = !!profile.business_registration_url

      setItems([
        { id: 'product', title: '첫 공구 상품 등록', desc: '카카오맵 검색 → 메뉴판 사진 → 30초 등록', done: hasProduct, cta: '등록하기', href: '/seller/meal-voucher/new' },
        { id: 'magic', title: '사장님께 Magic Link 발송', desc: '사장님이 PIN 없이 통계/사용 처리 가능', done: hasMagicLink, cta: '확인', href: '/seller/group-buy', optional: true },
        { id: 'bank', title: '정산 계좌 등록', desc: '첫 매출 발생 후 출금하려면 필요', done: hasBank, cta: '등록', href: '/seller/profile/edit' },
        { id: 'sale', title: '첫 매출 발생', desc: '공구 share 로 친구 초대하면 가속', done: hasSale, cta: '공구 보기', href: '/seller/group-buy' },
        { id: 'license', title: '사업자등록증 업로드', desc: '월 매출 100만원 도달 시 강제 (그 전엔 선택)', done: hasBusinessLicense, cta: '업로드', href: '/seller/business-info', optional: true },
      ])
    }).finally(() => setLoading(false))
  }, [dismissed])

  const completedRequired = items.filter(i => !i.optional && i.done).length
  const totalRequired = items.filter(i => !i.optional).length
  const allDone = totalRequired > 0 && completedRequired === totalRequired
  if (dismissed || loading || items.length === 0 || allDone) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* silent */ }
    setDismissed(true)
  }

  const progress = Math.round((completedRequired / totalRequired) * 100)

  return (
    <div className="bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-200 rounded-2xl p-5 mb-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pink-500" />
          <h3 className="text-base font-extrabold text-gray-900">시작 가이드</h3>
          <span className="text-[11px] text-pink-600 font-bold">({completedRequired}/{totalRequired})</span>
        </div>
        <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 p-1" aria-label="가이드 닫기">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-full bg-white rounded-full h-2 mb-4 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => navigate(item.href)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
              item.done ? 'bg-white/50' : 'bg-white hover:bg-gray-50 shadow-sm'
            }`}
          >
            {item.done ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-gray-300 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${item.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {item.title}
                {item.optional && <span className="ml-1.5 text-[10px] text-gray-400 font-normal">선택</span>}
              </p>
              {!item.done && <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>}
            </div>
            {!item.done && (
              <span className="px-2.5 py-1 bg-pink-500 text-white text-[10px] font-bold rounded-full flex items-center gap-1 shrink-0">
                {item.cta} <ArrowRight className="w-3 h-3" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
