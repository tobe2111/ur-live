/**
 * 💬 2026-10-01 셀러 — 인스타 댓글 → 자동 DM (내 가게 인스타).
 *   대표 *"중개사까지 마이에서 되게끔"* — 사장님·중개사(운영자) 둘 다 좌석 토큰으로 들어온다.
 *   마이 → 전체 도구에서 열면 같은 화면이 시트 안에 뜬다(ToolPageSheet — 라우트 표가 지도).
 *
 *   연결은 **인스타 로그인**(토큰 없음) · 켜기는 계정마다(기본 OFF) · 발송은 유어딜이 매장 발송을 연 뒤부터.
 *   ⚠️ 라이트 대시보드(SellerLayout) — dark: variant 금지.
 *   백엔드: /api/seller/instagram-dm/* (features/instagram-autodm).
 */
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import SellerLayout from '@/components/SellerLayout'
import { isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import { useSellerEmbedded } from '@/shared/seller-embed'
import { Loader2, AlertTriangle } from 'lucide-react'
import ConnectCard from '@/components/seller/instagram-autodm/ConnectCard'
import RulesSection from '@/components/seller/instagram-autodm/RulesSection'
import SendsTable from '@/components/seller/instagram-autodm/SendsTable'
import { useIgReturnToast } from '@/components/seller/instagram-autodm/useIgReturnToast'
import type { AutoDmStatus } from '@/components/seller/instagram-autodm/types'

const BASE = '/api/seller/instagram-dm'

export default function SellerInstagramDmPage() {
  const navigate = useNavigate()
  const embedded = useSellerEmbedded()
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    if (!isSellerAuthenticated()) redirectToLogin(navigate)
  }, [navigate])

  const status = useApiQuery<AutoDmStatus>(['seller', 'ig-autodm', 'status'], `${BASE}/status`, { select: (r: any) => r?.data })
  useIgReturnToast(params, setParams, () => { status.refetch() })

  return (
    <SellerLayout title="인스타 자동 DM">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="font-semibold text-gray-900">"댓글에 OOO 적어 주세요, 링크 DM 보내드려요"</p>
          <p className="mt-1 text-sm text-gray-500">
            내 가게 인스타 게시물에 정해 둔 키워드로 댓글이 달리면, 그 사람에게 링크를 DM 으로 자동으로 보냅니다.
            인스타가 허용하는 공식 방식이라 계정이 정지될 걱정이 없고, 댓글 1개당 DM 1통 · 댓글 후 7일 안에만 보냅니다.
            인스타 계정은 <b>비즈니스 또는 크리에이터</b> 계정이어야 합니다(인스타 설정에서 무료로 바꿀 수 있어요).
          </p>
        </div>

        {status.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : status.isError || !status.data ? (
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-tone-bad">
            <AlertTriangle className="h-4 w-4" /> 상태를 불러오지 못했습니다.
            <button onClick={() => status.refetch()} className="ml-2 underline">다시 시도</button>
          </div>
        ) : (
          <>
            <ConnectCard base={BASE} status={status.data} returnPath="/seller/instagram-dm" fromMy={embedded} onChange={() => status.refetch()} />
            <RulesSection base={BASE} queryKey="seller" connected={status.data.connected} onChanged={() => status.refetch()} />
            <SendsTable base={BASE} queryKey="seller" />
          </>
        )}
      </div>
    </SellerLayout>
  )
}
