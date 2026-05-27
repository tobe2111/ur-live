/**
 * 🛡️ 2026-05-15: 셀러 onboarding checklist — 가입 후 첫 매출까지 무엇 할 지 명확.
 * 🛡️ 2026-05-27 (사용자 결정 — 강제 Wizard 화):
 *   - 필수 4단계 (등록 / 계좌 / 첫매출 / plus친구) 모두 완료 전엔 dismiss 불가
 *   - 선택 2단계 (Magic Link / 사업자등록증) 는 별도
 *   - 진행률 visualization 강조 (gamification)
 *
 * 필수 5 단계:
 *   1. 첫 공구 상품 등록
 *   2. 정산 계좌 등록 (현금 송금 받기 위해)
 *   3. 카카오 알림톡 plus친구 등록 (자동 알림 발송)
 *   4. 첫 매출 발생
 * 선택:
 *   5. Magic Link 사장님에게 발송 (담당자 분리 시)
 *   6. 사업자등록증 업로드 (월 GMV 100만 도달 시 강제)
 *
 * 데이터: /api/seller/dashboard/stats 의 onboarding 필드 활용 (없으면 클라이언트 추정).
 * 모든 필수 단계 완료 시 자동 hide.
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

const PLUS_FRIEND_KEY = 'seller_plus_friend_added_v1'

export default function SellerOnboardingChecklist() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
      const hasPlusFriend = (() => {
        try { return localStorage.getItem(PLUS_FRIEND_KEY) === '1' } catch { return false }
      })()

      setItems([
        { id: 'product', title: '첫 공구 상품 등록', desc: '💡 가격은 매장 기본가의 70-80% 추천 · 목표 인원 10명 · 마감 7일', done: hasProduct, cta: '등록하기', href: '/seller/meal-voucher/new' },
        { id: 'bank', title: '정산 계좌 등록', desc: '첫 매출 후 송금 받으려면 필수', done: hasBank, cta: '등록', href: '/seller/profile/edit' },
        // 🛡️ 2026-05-27: 카카오 알림톡 plus친구 등록 (자동 알림 발송 위해 필수)
        { id: 'plusfriend', title: '카카오 알림톡 plus친구 등록', desc: '@유어딜 추가 → 사용자 매장 방문 알림 자동 발송', done: hasPlusFriend, cta: '추가', href: '/seller/plus-friend-guide' },
        { id: 'sale', title: '첫 매출 발생', desc: '상품 공유 → 친구가 결제하면 즉시 매출 시작', done: hasSale, cta: '공구 보기', href: '/seller/group-buy' },
        { id: 'magic', title: 'Magic Link 사장님 발송', desc: '담당자가 별도면 PIN 없이 통계/사용 처리 가능', done: hasMagicLink, cta: '확인', href: '/seller/group-buy', optional: true },
        { id: 'license', title: '사업자등록증 업로드', desc: '월 매출 100만원 도달 시 강제 (그 전엔 선택)', done: hasBusinessLicense, cta: '업로드', href: '/seller/business-info', optional: true },
      ])
    }).finally(() => setLoading(false))
  }, [])

  const completedRequired = items.filter(i => !i.optional && i.done).length
  const totalRequired = items.filter(i => !i.optional).length
  const allDone = totalRequired > 0 && completedRequired === totalRequired
  if (loading || items.length === 0 || allDone) return null

  // 🛡️ 2026-05-27: 강제 wizard — 필수 단계 모두 완료 전엔 dismiss 불가.
  //   기존 dismiss 룰 (localStorage v1) 제거. 첫 매출까지 가이드 노출.

  const progress = Math.round((completedRequired / totalRequired) * 100)

  return (
    <div className="bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-200 rounded-2xl p-5 mb-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pink-500" />
          <h3 className="text-base font-extrabold text-gray-900">시작 가이드 ({completedRequired}/{totalRequired})</h3>
        </div>
        {/* 🛡️ 닫기 버튼 제거 — 첫 매출까지 강제 노출 */}
      </div>

      {/* 프로그레스 바 */}
      <div className="w-full bg-white rounded-full h-2 mb-2 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-[11px] text-pink-700 mb-3 font-bold">
        {progress === 100 ? '🎉 모든 단계 완료!' : `${totalRequired - completedRequired}단계 남음 — 첫 매출까지 가이드 표시`}
      </p>

      <div className="space-y-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'plusfriend' && !item.done) {
                // plus친구 추가 후 확인 modal 또는 별도 페이지 — 단순화: 카카오 채널 link 새 탭 + localStorage mark
                window.open('https://pf.kakao.com/_xXXxXxXx', '_blank')
                try { localStorage.setItem(PLUS_FRIEND_KEY, '1') } catch { /* ignore */ }
                alert('카카오 plus친구 추가 후 다시 확인됩니다')
                return
              }
              navigate(item.href)
            }}
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
