import { useEffect } from 'react'
import { SELLER_STATUS_KEY } from '@/shared/seller-approval'

/**
 * 🥕 마이 판매 구역의 매장 상태 안내문 (2026-10-12 SellerSection 에서 분리 — 파일 크기 래칫).
 */
const STATUS_NOTE: Record<string, string> = {
  pending: '승인 대기 중이에요. 준비는 지금 하고, 메인 노출과 정산은 승인 뒤에 시작됩니다.',
  rejected: '서류가 반려됐어요. 사업자등록증을 다시 올리면 바로 다시 심사합니다.',
}
/**
 * 🪪 매장은 대기인데 **등록증만** 반려된 경우 — "심사 중" 이라고 말하면 사장님은 기다리기만 한다(아무 일도 안 일어난다).
 *   2026-10-12 까지는 셀러 대시보드 틀의 승인 배너가 이 문장을 말했다. 틀을 지웠으므로 마이가 말한다.
 */
const CERT_REJECTED_NOTE = '사업자등록증이 반려됐어요. 전체 도구 › 사업자 정보에서 다시 올리면 바로 다시 심사합니다.'
/** 매장 상태 + 등록증 상태로 안내문을 고른다. */
export function storeStatusNote(status: string | null | undefined, certStatus?: string | null): string | undefined {
  if (status === 'pending' && certStatus === 'rejected') return CERT_REJECTED_NOTE
  return status ? STATUS_NOTE[status] : undefined
}

/**
 * 🥕 심사 상태를 적어 둔다 — '전체 도구'가 승인 전 매장에 유어애즈 문을 안 보여 주는 데 쓴다(`seller-approval.ts`).
 *   2026-10-12 까지는 대시보드 틀의 승인 배너가 썼다. 틀을 지웠으므로 이 매장을 아는 마이가 쓴다(서버가 진짜 벽이다).
 */
export function useRecordSellerStatus(status: string | null | undefined): void {
  useEffect(() => {
    if (!status) return
    try { localStorage.setItem(SELLER_STATUS_KEY, status) } catch { /* quota */ }
  }, [status])
}
