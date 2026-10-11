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
 *   (2026-10-10 조회 통일 ④ 뒤로 그 API 도 주인 좌석 하나는 본다 — 그래도 좌석 목록이 먼저다:
 *    중개 좌석·여러 가게는 여전히 그쪽만 안다.)
 *
 *   ⚠️ 그래도 이 API 를 지우지는 않는다 — 좌석이 0곳일 때 (a) 정지(`suspended`, 좌석 요약에서
 *   빠진다) 배지와 (b) 이메일/비번으로 먼저 만든 셀러 행의 **자동 연결 치유**가 여기서만 일어난다.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { UrShopIcon } from '@/components/icons/urdeal-icons'
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
    // ⚡ 2026-10-06 — `api` 정적 사용(비셀러 첫 화면의 2단 — 좌석 판정 뒤에 돈다).
    api.get('/api/seller/my-seller-status')
      .then(r => { if (alive && r.data.success) setStatus(r.data.data) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => { if (alive) setLoading(false) })
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
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 bg-yellow-500/15 text-[12px] text-yellow-300 font-semibold border border-yellow-500/30 active:scale-95 transition-all"
      >
        <UrShopIcon className="w-2.5 h-2.5" aria-hidden="true" /> {t('sellerSwitch.pending', { defaultValue: '심사 중' })}
      </button>
    )
  }

  if (status?.has_seller && (status.status === 'rejected' || status.status === 'suspended')) {
    return (
      <button
        onClick={() => navigate('/seller/waiting')}
        aria-label={t('sellerSwitch.statusAria', { defaultValue: '셀러 상태 보기' })}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 bg-red-500/15 text-[12px] text-red-300 font-semibold border border-red-500/30 active:scale-95 transition-all"
      >
        <UrShopIcon className="w-2.5 h-2.5" aria-hidden="true" />
        {status.status === 'rejected' ? t('sellerSwitch.rejected', { defaultValue: '반려' }) : t('sellerSwitch.suspended', { defaultValue: '정지' })}
      </button>
    )
  }

  /**
   * 🔇 2026-09-28 — **등록 문은 여기서 사라진다.** 같은 화면에 이미 하나 더 있었다.
   *
   * | 자리 | 문구 | 목적지 |
   * |---|---|---|
   * | 이름 옆 알약 (여기) | 내 가게 등록 | `/store/new` |
   * | `RoleCtaGrid` 타일 | 내 가게 등록 | `/store/new` |
   *
   * **같은 글자 · 같은 목적지 · 같은 화면 · 약 850px 간격.** 둘 중 남길 것은 타일이다 —
   * 타일은 *"카카오맵에서 내 가게를 찾아 이용권을 팔아요"* 라고 **무엇인지 말해 주고**,
   * 이 알약은 이름 옆 10px 글자라 무엇을 등록하는지 알 수 없다.
   *
   * ⚠️ **상태 배지(심사 중·반려·정지)는 위에 그대로 남는다** — 그건 중복이 아니라
   *   이 사람에게만 해당하는 상태이고, 타일은 그 말을 하지 않는다.
   * ⚠️ 되살리려면 이 `return null` 을 종전 버튼으로 되돌리면 된다(한 블록).
   *   다만 그때 `RoleCtaGrid` 의 타일과 **둘 다 뜨는지** 먼저 볼 것.
   */
  return null
}
