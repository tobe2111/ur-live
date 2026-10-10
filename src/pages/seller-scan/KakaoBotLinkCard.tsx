/**
 * 💬 2026-10-10 (대표 "카카오톡으로 유어딜 세팅도 가능해? 이용권 관리같은거"): 카카오톡으로 매장 관리 — 연결 코드.
 *   SellerVoucherScanPage 하단 섹션. 코드를 받아 유어딜 카카오 채널에 `연결 123456` 을 보내면 그 채팅에서
 *   오늘 판매·사용 대기·정산 확인, 이용권 사용 처리, 판매 중지/재개를 할 수 있다(쓰기는 전부 "네" 확인).
 *   서버: `/api/seller/kakao-bot/*` (seller-kakao-bot.routes.ts). 게이트가 꺼져 있으면 "준비 중" 만 보인다.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Copy, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken } from '@/lib/seller-auth'
import { formatKSTShort } from '@/utils/date'

interface Link { key: string; key_masked: string; user_name: string | null; linked_at: string | null; last_used_at: string | null }

export default function KakaoBotLinkCard() {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [links, setLinks] = useState<Link[]>([])
  const [issued, setIssued] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const headers = { Authorization: `Bearer ${getSellerToken()}` }

  const load = useCallback(() => {
    api.get('/api/seller/kakao-bot/links', { headers })
      .then(r => { if (r.data?.success) { setEnabled(!!r.data.data?.enabled); setLinks(r.data.data?.links || []) } })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])

  async function issue() {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.post('/api/seller/kakao-bot/link-code', {}, { headers })
      if (r.data?.success && r.data.data?.code) setIssued(String(r.data.data.code))
      else toast.error(r.data?.error || t('seller.kakaoBot.issueFail', { defaultValue: '코드를 만들지 못했어요' }))
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || t('seller.kakaoBot.issueFail', { defaultValue: '코드를 만들지 못했어요' }))
    } finally { setBusy(false) }
  }

  async function copyUtterance() {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(t('seller.kakaoBot.utterance', { defaultValue: '연결 {{code}}', code: issued }))
      toast.success(t('seller.kakaoBot.copied', { defaultValue: '복사했어요' }))
    } catch { /* 클립보드 미지원 — 화면의 숫자를 보고 입력 */ }
  }

  async function revoke(key: string) {
    if (!window.confirm(t('seller.kakaoBot.revokeConfirm', { defaultValue: '이 채팅 연결을 끊을까요? 그 채팅에서는 더 이상 매장을 관리할 수 없어요.' }))) return
    try {
      const r = await api.post(`/api/seller/kakao-bot/links/${encodeURIComponent(key)}/revoke`, {}, { headers })
      if (r.data?.success) { toast.success(t('seller.kakaoBot.revoked', { defaultValue: '연결을 끊었어요' })); load() }
    } catch { toast.error(t('seller.kakaoBot.revokeFail', { defaultValue: '연결을 끊지 못했어요' })) }
  }

  if (enabled === null) return null

  return (
    <section className="mt-6 rounded-[var(--dash-radius,16px)] border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="w-4 h-4 text-brand shrink-0" />
          <h2 className="text-[15px] font-bold text-gray-900">{t('seller.kakaoBot.title', { defaultValue: '카카오톡으로 매장 관리' })}</h2>
        </div>
        {enabled && (
          <button onClick={issue} disabled={busy}
            className="ur-btn ur-btn-sm ur-btn-primary text-[12px] disabled:opacity-50">
            {t('seller.kakaoBot.issue', { defaultValue: '연결 코드 받기' })}
          </button>
        )}
      </div>
      <p className="text-[12px] text-gray-500 mt-2 leading-snug">
        {enabled
          ? t('seller.kakaoBot.desc', { defaultValue: '유어딜 카카오 채널에서 오늘 판매·사용 대기·정산을 보고, 이용권 사용 처리와 판매 중지를 할 수 있어요. 바꾸는 일은 채팅에서 한 번 더 확인해요.' })
          : t('seller.kakaoBot.notReady', { defaultValue: '준비 중이에요. 곧 카카오톡에서도 매장을 관리할 수 있어요.' })}
      </p>

      {enabled && issued && (
        <div className="mt-4 rounded-xl bg-[var(--brand-tint)] p-4">
          <p className="text-[13px] text-gray-700">
            {t('seller.kakaoBot.howTo', { defaultValue: '유어딜 카카오 채널에 아래처럼 보내 주세요. 10분 안에 한 번만 쓸 수 있어요.' })}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[24px] font-bold text-gray-900 tracking-wide">{t('seller.kakaoBot.utterance', { defaultValue: '연결 {{code}}', code: issued })}</p>
            <button onClick={copyUtterance} className="ur-btn ur-btn-sm flex items-center gap-1 text-[12px]">
              <Copy className="w-3.5 h-3.5" /> {t('seller.kakaoBot.copy', { defaultValue: '복사' })}
            </button>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100">
          {links.map(l => (
            <li key={l.key} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">
                  {l.user_name || t('seller.kakaoBot.chat', { defaultValue: '채팅' })} <span className="text-gray-400 font-normal">{l.key_masked}</span>
                </p>
                <p className="text-[12px] text-gray-500">
                  {t('seller.kakaoBot.lastUsed', { defaultValue: '마지막 사용' })} {l.last_used_at ? formatKSTShort(l.last_used_at) : '-'}
                </p>
              </div>
              <button onClick={() => revoke(l.key)} className="text-[12px] text-gray-500 flex items-center gap-1 shrink-0">
                <XCircle className="w-3.5 h-3.5" /> {t('seller.kakaoBot.revoke', { defaultValue: '연결 끊기' })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
