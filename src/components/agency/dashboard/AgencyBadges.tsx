import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: t('agency.statusApproved'), cls: 'bg-green-100 text-green-700' },
    pending:  { label: t('agency.statusPending'), cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: t('agency.statusRejected'), cls: 'bg-red-100 text-red-700' },
    suspended:{ label: t('agency.statusSuspended'), cls: 'bg-gray-100 text-gray-600' },
  }
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
}

export function PayBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  if (status === 'approved') return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" />{t('common.paid')}</span>
  if (status === 'failed' || status === 'cancelled') return <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3 h-3" />{t('common.cancelled')}</span>
  return <span className="flex items-center gap-1 text-xs text-amber-600"><Clock className="w-3 h-3" />{t('common.pending')}</span>
}
