/**
 * 🔗 SNS 연동 목록 — 인스타그램 · 유튜브 · 틱톡 (2026-10-31)
 *
 * 누르면 플랫폼 로그인으로 간다(우리가 숫자를 받아 적지 않는다 — 플랫폼이 직접 알려 준 팔로워만 쓴다).
 * 설정이 아직 없는 플랫폼은 "준비 중" — 에러가 아니다.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { FOLLOWER_WORD, PLATFORM_LABEL, SEEDING_PLATFORMS, type SeedingPlatform } from '@/shared/seeding'

export interface SnsLinkView {
  platform: SeedingPlatform; username: string | null; display_name: string | null
  profile_url: string | null; follower_count: number | null; verified_at: string
}

export default function SnsLinkList({ links, available, only, returnTo, onChanged }: {
  links: SnsLinkView[]
  available: Record<SeedingPlatform, boolean>
  only?: SeedingPlatform[]
  returnTo: string
  onChanged?: () => void
}) {
  const [busy, setBusy] = useState('')
  const platforms = SEEDING_PLATFORMS.filter((p) => !only || only.includes(p))

  async function connect(p: SeedingPlatform) {
    setBusy(p)
    try {
      const r = await api.get(`/api/seeding/sns/${p}/start`, { params: { return: returnTo } })
      if (r.data?.success && r.data.data?.url) { window.location.href = r.data.data.url; return }
      toast.error(r.data?.error || '연동을 시작하지 못했어요')
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error || '연동을 시작하지 못했어요')
    } finally { setBusy('') }
  }

  async function unlink(p: SeedingPlatform) {
    setBusy(p)
    try { await api.delete(`/api/seeding/sns/${p}`); toast.success('연동을 해제했어요'); onChanged?.() }
    catch { toast.error('해제하지 못했어요') }
    finally { setBusy('') }
  }

  return (
    <ul className="divide-y divide-rule">
      {platforms.map((p) => {
        const l = links.find((x) => x.platform === p)
        return (
          <li key={p} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-gray-900 dark:text-white">{PLATFORM_LABEL[p]}</p>
              <p className="truncate text-[13px] text-gray-500 dark:text-gray-400">
                {l
                  ? `@${l.username || l.display_name || '-'} · ${l.follower_count === null ? `${FOLLOWER_WORD[p]} 수를 읽지 못함` : `${FOLLOWER_WORD[p]} ${formatNumber(l.follower_count)}명`}`
                  : available[p] ? '연동하면 팔로워 수가 자동으로 확인돼요' : '연동 준비 중'}
              </p>
            </div>
            {l ? (
              <div className="flex shrink-0 gap-2">
                <button type="button" disabled={!!busy || !available[p]} onClick={() => connect(p)}
                  className="rounded-full bg-warm px-3 py-2 text-[13px] text-gray-700 disabled:opacity-50 dark:text-gray-200">다시 확인</button>
                <button type="button" disabled={!!busy} onClick={() => unlink(p)}
                  className="rounded-full px-2 py-2 text-[13px] text-gray-500 dark:text-gray-400">해제</button>
              </div>
            ) : (
              <button type="button" disabled={!!busy || !available[p]} onClick={() => connect(p)}
                className="shrink-0 rounded-full bg-brand px-4 py-2 text-[13px] font-medium text-white disabled:bg-warm disabled:text-gray-500">
                연동하기
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
