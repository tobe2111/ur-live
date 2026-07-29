/**
 * 🛡️ 2026-06-25 (전수조사): 대시보드 목록 로드 실패 표면화 — 401/403/500 을 "데이터 없음"과 구분.
 *   기존 다수 admin/도매 목록 페이지가 isError 를 안 봐서 세션만료(401)·IP화이트리스트/권한(403)·
 *   서버오류(500)가 빈 목록("없음")으로 위장 → 입금/출금/클레임 같은 머니 큐가 0건처럼 보였음.
 *   상태별 정확 안내 + 재시도/재로그인. (AdminSellerApprovalPage 의 인라인 카드를 공용 컴포넌트로.)
 */
interface Props {
  /** axios 에러 객체 (response.status 로 상태별 메시지). */
  error?: unknown
  /** 다시 시도(refetch). */
  onRetry?: () => void
  /** 다시 로그인 경로. 미지정 시 버튼 숨김. */
  loginPath?: string
  /** 무엇을 못 불러왔는지 (예: '셀러 목록'). */
  label?: string
}

export default function DashboardLoadError({ error, onRetry, loginPath, label = '목록' }: Props) {
  const st = (error as { response?: { status?: number } } | undefined)?.response?.status
  const msg = st === 403 ? '관리자 허용 IP 또는 권한이 아닙니다 — 운영자에게 ADMIN_IP_WHITELIST(허용 IP) 확인을 요청하세요'
    : st === 401 ? '로그인 세션이 만료되었습니다 — 다시 로그인해주세요'
    : st === 500 ? '서버 오류가 발생했습니다 — 잠시 후 다시 시도해주세요'
    : '네트워크/서버 상태를 확인해주세요'
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-bold text-red-700">{label}을(를) 불러오지 못했습니다</p>
      <p className="mt-1 text-xs text-red-600">{msg}{st ? ` (HTTP ${st})` : ''}</p>
      <div className="mt-4 flex items-center justify-center gap-2">
        {onRetry && <button onClick={onRetry} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800">다시 시도</button>}
        {loginPath && <button onClick={() => { window.location.href = loginPath }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">다시 로그인</button>}
      </div>
    </div>
  )
}
