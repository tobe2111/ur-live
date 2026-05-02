/**
 * 🛡️ 2026-05-02: TD-018 분할 — AgencyPage 인플루언서 초대 링크 섹션.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus, Link2, Copy } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function InviteLinkSection() {
  const { t } = useTranslation()
  const agencyId = localStorage.getItem('agency_id')
  const inviteUrl = `https://live.ur-team.com/seller/register?agency=${agencyId}`
  const [recruitedCount, setRecruitedCount] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('agency_token')
    if (!token) return
    api.get('/api/agency/sellers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const sellers = r.data.data || []
        setRecruitedCount(sellers.length)
      })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success(t('agency.inviteLinkCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('common.copyFailed'))
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8EAEE] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <UserPlus className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{t('agency.influencerInvite')}</h3>
          <p className="text-xs text-gray-500">{t('agency.shareLink')}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">{t('agency.recruitedSellers', { count: recruitedCount })}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 truncate font-mono">
          {inviteUrl}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors shrink-0"
        >
          <Copy className="w-3.5 h-3.5" />
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
    </div>
  )
}
