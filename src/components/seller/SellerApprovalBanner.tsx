/**
 * 🥕 **심사 상태 배너** — 대기·반려여도 대시보드 안에서 알린다 (2026-09-16 대표 지시).
 *
 * > 대표: *"일단 반려는 되더라도 셀러 대시보드를 쓸 수는 있나보네. 우리도 반려는 되더라도
 * > 쓸 수는 있게 하고 …"* (당근비즈니스 화면 6장을 보내며)
 *
 * 종전엔 승인 전 계정이 `/seller/waiting` 에 갇혀 있었다. 그래서 **서류를 고쳐 내려는
 * 사장님이 고칠 화면에 들어갈 수가 없었다.** 이제 들여보내므로, 화면이 상태를 말해야 한다 —
 * 아무 표시가 없으면 "승인됐구나" 로 읽고 이용권을 올린 뒤 메인에 안 보인다고 신고한다.
 *
 * ## 세 가지 말만 한다
 *   1. **반려** — 사유를 그대로 옮기고 서류 화면으로 보낸다(고칠 사람이 고칠 자리에).
 *   2. **대기 + 등록증 없음** — 지금 올리면 심사가 시작된다(가장 흔한 막힘이다).
 *   3. **대기 + 등록증 있음** — 기다리면 된다고 말해 문의를 줄인다.
 *   승인됐으면 **아무것도 그리지 않는다**.
 *
 * ## ⚠️ 판정 근거는 서버 응답 하나뿐
 * `localStorage` 나 JWT 의 `status` 를 읽지 않는다 — 7일짜리 토큰 스냅샷은 승인·반려가
 * 바뀌어도 그대로라, 배너가 **틀린 상태를 계속 띄우는** 쪽이 아예 없는 것보다 나쁘다.
 * 대신 이 컴포넌트가 받은 값을 `seller_status` 로 **한 곳에서만** 써서, 네비가 유어애즈
 * 탭을 숨길 때 쓰게 한다(쓰는 곳이 여럿이어도 **쓰는 곳은 여기 하나**).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileWarning, Clock, Upload } from 'lucide-react'
import api from '@/lib/api'
import { SELLER_STATUS_KEY } from '@/shared/seller-approval'

interface SurfaceResponse {
  status?: string | null
  reject_reason?: string | null
  has_business_cert?: boolean
}

export default function SellerApprovalBanner() {
  const navigate = useNavigate()
  const [s, setS] = useState<SurfaceResponse | null>(null)

  useEffect(() => {
    let alive = true
    api.get('/api/seller/surface')
      .then((r) => {
        if (!alive) return
        const d = (r?.data ?? {}) as SurfaceResponse
        // 서버가 status 를 못 준 경우(구 배포·조회 실패)는 **아무 말도 하지 않는다** —
        // 모르면서 "대기 중" 이라고 띄우면 승인된 사장님에게 거짓말이 된다.
        if (typeof d.status !== 'string') return
        try { localStorage.setItem(SELLER_STATUS_KEY, d.status) } catch { /* quota */ }
        setS(d)
      })
      .catch(() => { /* fail-soft — 배너가 없다고 대시보드가 막히지는 않는다 */ })
    return () => { alive = false }
  }, [])

  if (!s || s.status === 'approved' || s.status === 'active') return null

  const rejected = s.status === 'rejected'
  const needsCert = !s.has_business_cert
  const Icon = rejected ? FileWarning : needsCert ? Upload : Clock
  const tone = rejected ? 'text-tone-bad' : 'text-tone-warn'

  const title = rejected
    ? '제출하신 정보를 다시 확인해주세요'
    : needsCert
      ? '사업자등록증 사본이 아직 없어요'
      : '심사가 진행 중이에요'

  const desc = rejected
    ? (s.reject_reason || '사유를 확인하고 수정한 뒤 다시 요청해주세요.')
    : needsCert
      ? '등록증 사본이 도착해야 심사를 시작할 수 있어요. 지금 올리면 보통 1영업일 안에 끝납니다.'
      : '승인되면 이용권이 메인에 노출되고 파트너 찾기가 열립니다. 그 전에도 이용권 등록은 지금 하실 수 있어요.'

  return (
    <div className="rounded-xl bg-white shadow-lift px-4 py-3.5 flex items-center gap-3">
      <Icon className={`w-5 h-5 shrink-0 ${tone}`} strokeWidth={1.6} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${tone}`}>{title}</p>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/seller/business-info')}
        className="ur-btn ur-btn-sm ur-btn-primary shrink-0"
      >
        {rejected ? '다시 요청하기' : '서류 올리기'}
      </button>
    </div>
  )
}
