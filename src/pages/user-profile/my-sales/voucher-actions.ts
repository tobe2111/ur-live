import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import type { HomeVoucher } from '@/pages/seller-page/useSellerHome'

/**
 * 🎟️ 마이 이용권 시트의 동작 — 서버 계약은 셀러 이용권 화면(`seller-group-buy/VoucherRow`)과 **같은 호출**이다.
 *   새 서버 경로를 만들지 않는다. 판매 스위치·복구 = `PUT /api/seller/products/:id { is_active, status }`
 *   (허용 status 는 ACTIVE/HIDDEN · 삭제는 soft delete 라 복구도 같은 호출) · 삭제 = `DELETE` · 사장님 링크 = `resend-store-link`.
 */
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('seller_token')}` })
const errOf = (err: unknown, fb: string) => (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fb

export async function setVoucherSale(v: Pick<HomeVoucher, 'id'>, next: boolean, okMsg: string): Promise<boolean> {
  try {
    const r = await api.put(`/api/seller/products/${v.id}`, { is_active: next, status: next ? 'ACTIVE' : 'HIDDEN' }, { headers: authHeaders() })
    if (r.data?.success) { toast.success(okMsg); return true }
    toast.error(r.data?.error || '판매 상태를 바꾸지 못했어요')
  } catch (err) { toast.error(errOf(err, '판매 상태를 바꾸지 못했어요')) }
  return false
}

export async function deleteVoucher(v: Pick<HomeVoucher, 'id' | 'name'>): Promise<boolean> {
  if (!(await confirmDialog(`'${v.name}' 이용권을 삭제할까요?\n이미 발급된 이용권은 그대로 사용할 수 있고, 새 판매만 중단됩니다.`))) return false
  try {
    const r = await api.delete(`/api/seller/products/${v.id}`, { headers: authHeaders() })
    if (r.data?.success) { toast.success('이용권이 삭제되었습니다'); return true }
    toast.error(r.data?.error || '삭제하지 못했어요')
  } catch (err) { toast.error(errOf(err, '삭제하지 못했어요')) }
  return false
}

export async function resendStoreLink(v: Pick<HomeVoucher, 'id'>): Promise<boolean> {
  try {
    const r = await api.post(`/api/seller/products/${v.id}/resend-store-link`, { rotate: false }, { headers: authHeaders() })
    if (r.data?.success) { toast.success('사장님께 알림톡이 발송되었습니다'); return true }
    toast.error(r.data?.error || '발송하지 못했어요')
  } catch (err) { toast.error(errOf(err, '발송하지 못했어요')) }
  return false
}

export function copyStoreLink(v: Pick<HomeVoucher, 'id' | 'store_owner_token'>) {
  const url = `${window.location.origin}/store/stats/${v.id}${v.store_owner_token ? `?t=${v.store_owner_token}` : ''}`
  void navigator.clipboard?.writeText(url)
  toast.success('사장님 링크를 복사했어요')
}
