/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 이름 옆 셀러 전환 inline 컨트롤.
 * 🏁 2026-07-02 (대표 "B — 단일 퍼널"): 가입 UI 를 SellerApplyModal(별도 3번째 폼)에서
 *   단일 관문(/seller/register/supplier)으로 통일 + 카카오 유저 숨김(구 :67 return null — 한국
 *   라이브는 카카오 전용이라 사실상 전원에게 진입점이 안 보였음) 제거. 심사중 배지는 상태
 *   페이지(/seller/waiting)로 연결 — 유저가 항상 다음 행동을 알 수 있게.
 *
 * 🪑 2026-09-25 (설계 §15-2 — 좌석 출처 단일화): **좌석이 하나라도 있으면 이 칩은 사라진다.**
 *   바로 아래 `SellerSection`("내 가게")이 가게 이름·상태·전환을 전부 말하므로, 여기까지 남으면
 *   같은 화면에 진입점이 **둘**이 되고 둘은 반드시 갈린다.
 *
 *   그리고 `/my-seller-status` 는 **좌석이 0곳일 때만** 부른다. 그 API 는 `linked_user_id`
 *   한 행(UNIQUE 1인 1행)만 보는 옛 길이라, `POST /store/new` 가 만든 좌석(권한이
 *   `seller_operators` 에만 있는 매장 — 라이브 9개)을 **한 개도 못 본다.** 그걸 먼저 믿으면
 *   자기 가게가 있는 사장님에게 "내 가게 등록" 을 권하게 된다.
 *
 *   ⚠️ 그래도 이 API 를 지우지는 않는다 — 좌석이 0곳일 때 (a) 정지(`suspended`, 좌석 요약에서
 *   빠진다) 배지와 (b) 이메일/비번으로 먼저 만든 셀러 행의 **자동 연결 치유**가 여기서만 일어난다.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Store } from 'lucide-react'
import type { MyStoresState } from './useMyStores'

interface SellerStatus {
  has_seller: boolean
  seller_id?: number
  status?: string
  seller_type?: string
  business_name?: string
  is_kakao_user?: boolean
}

export default function SellerSwitchInline({ seats }: { seats: MyStoresState }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [status, setStatus] = useState<SellerStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // 좌석이 확정되기 전에는 아무것도 묻지 않는다(좌석이 있으면 이 칩 자체가 안 뜬다).
  const seatsResolved = !seats.loading
  const hasSeat = seats.stores.length > 0

  useEffect(() => {
    if (!seatsResolved || hasSeat) return
    let alive = true
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/seller/my-seller-status')
        .then(r => { if (alive && r.data.success) setStatus(r.data.data) })
        .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
        .finally(() => { if (alive) setLoading(false) })
    })
    return () => { alive = false }
  }, [seatsResolved, hasSeat])

  // 🪑 좌석이 있으면 "내 가게" 섹션이 전부 말한다 — 여기선 사라진다.
  if (hasSeat) return null
  if (!seatsResolved || loading) return null

  if (status?.has_seller && status.status === 'pending') {
    // 🏁 심사중 배지 → 탭 시 상태 페이지 (자동갱신 + 승인 시 대시보드 자동 진입)
    return (
      <button
        onClick={() => navigate('/seller/waiting')}
        aria-label={t('sellerSwitch.pendingAria', { defaultValue: '셀러 심사 상태 보기' })}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-yellow-500/15 text-[10px] text-yellow-300 font-semibold border border-yellow-500/30 active:scale-95 transition-all"
      >
        <Store className="w-2.5 h-2.5" aria-hidden="true" /> {t('sellerSwitch.pending', { defaultValue: '심사 중' })}
      </button>
    )
  }

  if (status?.has_seller && (status.status === 'rejected' || status.status === 'suspended')) {
    return (
      <button
        onClick={() => navigate('/seller/waiting')}
        aria-label={t('sellerSwitch.statusAria', { defaultValue: '셀러 상태 보기' })}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-red-500/15 text-[10px] text-red-300 font-semibold border border-red-500/30 active:scale-95 transition-all"
      >
        <Store className="w-2.5 h-2.5" aria-hidden="true" />
        {status.status === 'rejected' ? t('sellerSwitch.rejected', { defaultValue: '반려' }) : t('sellerSwitch.suspended', { defaultValue: '정지' })}
      </button>
    )
  }

  // 비셀러 (카카오 포함 전원) → **매장 등록**(카카오맵에서 내 가게 찾기).
  // 🏷️ 2026-08-26 (대표 "내 쇼핑몰 열기는 하면 안될 것 같아"): 문구를 '내 가게 등록'으로.
  //   유어샵은 **가입하면 이미 있다**(모든 유저에게 `/u/{handle}` 자동 생성) — "쇼핑몰을 연다"는
  //   말은 사실과 다르고, 이미 가진 걸 또 만들라는 소리로 들린다. 여기서 새로 만드는 건 **매장**이다.
  // 🔁 2026-08-26: 종전 목적지는 셀러 가입 폼(`/seller/register/supplier`)이었다. 그런데 대표 확정
  //   순서는 "대시보드 첫 단계는 매장 등록, 무조건 선행"이고, `POST /api/seller/stores` 가 매장 행 +
  //   운영 권한을 함께 만든다 — 사장님에게 사업자 폼부터 들이밀 이유가 없다. 내 가게부터 찾게 한다.
  return (
    <button
      onClick={() => navigate('/store/new')}
      aria-label={t('sellerSwitch.applyAria', { defaultValue: '내 가게 등록하기' })}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 bg-gray-100 dark:bg-white/[0.08] border border-white/[0.12] text-[10px] text-gray-900 dark:text-white/85 font-semibold active:scale-95 transition-all"
    >
      <Store className="w-2.5 h-2.5" aria-hidden="true" /> {t('sellerSwitch.openMyShop', { defaultValue: '내 가게 등록' })}
    </button>
  )
}
