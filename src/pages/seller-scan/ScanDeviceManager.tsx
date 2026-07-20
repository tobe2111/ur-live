/**
 * 📟 2026-07-20 (대표 — "직원 폰·공기계로 스캔할 땐?"): 스캔 전용 기기 링크 발급/회수 UI.
 *   SellerVoucherScanPage(대시보드 스캔) 하단 섹션. 발급 → QR/링크를 직원 폰·공기계로 전달 →
 *   그 기기는 로그인 없이 /store/scan 에서 스캔만 가능(정산·설정 접근 불가). 분실 시 즉시 회수.
 *   ⚠️ 키 원문은 발급 응답 1회만 표시(서버엔 해시만) — 새로 보려면 재발급.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Smartphone, Copy, XCircle, Plus } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken } from '@/lib/seller-auth'

const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })))

interface Device { id: number; name: string; created_at: string; last_used_at: string | null; revoked_at: string | null }

export default function ScanDeviceManager() {
  const { t } = useTranslation()
  const [devices, setDevices] = useState<Device[]>([])
  const [issued, setIssued] = useState<{ name: string; link: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const headers = { Authorization: `Bearer ${getSellerToken()}` }

  const load = useCallback(() => {
    api.get('/api/seller/scan-devices', { headers })
      .then(r => { if (r.data?.success) setDevices(r.data.data || []) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])

  async function issue() {
    if (busy) return
    setBusy(true)
    try {
      const name = `스캔 기기 ${devices.filter(d => !d.revoked_at).length + 1}`
      const r = await api.post('/api/seller/scan-devices', { name }, { headers })
      if (r.data?.success && r.data.data?.link) {
        setIssued({ name: r.data.data.name, link: `${window.location.origin}${r.data.data.link}` })
        load()
      } else {
        toast.error(r.data?.error || t('seller.scanDevices.issueFail', { defaultValue: '발급에 실패했습니다' }))
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || t('seller.scanDevices.issueFail', { defaultValue: '발급에 실패했습니다' }))
    } finally { setBusy(false) }
  }

  async function revoke(id: number) {
    if (!window.confirm(t('seller.scanDevices.revokeConfirm', { defaultValue: '이 기기의 스캔 링크를 회수할까요? 그 기기에선 더 이상 스캔할 수 없어요.' }))) return
    try {
      const r = await api.post(`/api/seller/scan-devices/${id}/revoke`, {}, { headers })
      if (r.data?.success) { toast.success(t('seller.scanDevices.revoked', { defaultValue: '회수 완료' })); load() }
    } catch { toast.error(t('seller.scanDevices.revokeFail', { defaultValue: '회수에 실패했습니다' })) }
  }

  const active = devices.filter(d => !d.revoked_at)
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Smartphone className="w-4 h-4 text-brand shrink-0" />
          <h2 className="text-[14px] font-extrabold text-gray-900">{t('seller.scanDevices.title', { defaultValue: '직원·공기계용 스캔 링크' })}</h2>
        </div>
        <button onClick={issue} disabled={busy}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand text-white text-[12px] font-bold disabled:opacity-50">
          <Plus className="w-3.5 h-3.5" /> {t('seller.scanDevices.issue', { defaultValue: '링크 발급' })}
        </button>
      </div>
      <p className="text-[11.5px] text-gray-500 mt-1.5 leading-snug">
        {t('seller.scanDevices.desc', { defaultValue: '직원 폰이나 매장 공기계에서 사장님 로그인 없이 스캔만 할 수 있는 링크예요. 아래 QR을 그 기기로 찍거나 링크를 보내 홈 화면에 추가하세요. 분실하면 즉시 회수하면 돼요.' })}
      </p>

      {issued && (
        <div className="mt-3 rounded-xl bg-[var(--brand-tint)] p-4 flex flex-col items-center gap-3">
          <p className="text-[12px] font-bold text-gray-900">{issued.name} — {t('seller.scanDevices.oneTime', { defaultValue: '이 화면에서만 표시돼요 (다시 못 봄)' })}</p>
          <div className="bg-white p-3 rounded-xl">
            <Suspense fallback={<div className="w-[132px] h-[132px]" aria-hidden />}>
              <QRCodeSVG value={issued.link} size={132} />
            </Suspense>
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(issued.link).then(() => toast.success(t('common.copied', { defaultValue: '복사되었습니다' }))) }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-[12px] font-bold text-gray-900">
            <Copy className="w-3.5 h-3.5" /> {t('seller.scanDevices.copyLink', { defaultValue: '링크 복사 (카톡으로 보내기)' })}
          </button>
        </div>
      )}

      {active.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100">
          {active.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 truncate">{d.name}</p>
                <p className="text-[11px] text-gray-400">
                  {d.last_used_at
                    ? t('seller.scanDevices.lastUsed', { defaultValue: '마지막 사용' }) + ' ' + d.last_used_at.slice(0, 16)
                    : t('seller.scanDevices.neverUsed', { defaultValue: '아직 사용 전' })}
                </p>
              </div>
              <button onClick={() => revoke(d.id)} className="flex items-center gap-1 text-[12px] font-bold text-gray-400 hover:text-brand shrink-0">
                <XCircle className="w-3.5 h-3.5" /> {t('seller.scanDevices.revoke', { defaultValue: '회수' })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
