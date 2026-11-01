/**
 * 🔗 SNS 연동 목록 — 인스타그램 · 유튜브 · 틱톡 (2026-10-31)
 *
 * 누르면 플랫폼 로그인으로 간다(우리가 숫자를 받아 적지 않는다 — 플랫폼이 직접 알려 준 팔로워만 쓴다).
 * 설정이 아직 없는 플랫폼은 "준비 중" — 에러가 아니다.
 *
 * 🪪 **2026-11-01 — 줄 목록 → 정보 블록**(대표 *"이런 식으로 정보들도 나오고 새로고침도 있고 해야하지 않을까"*).
 *    저장된 값(`username`·`follower_count`·`verified_at`)은 처음부터 다 있었고 **화면만 한 줄로 눌러 담고
 *    있었다** — 특히 *언제 확인한 숫자인가*(`verified_at`)를 아예 안 보여 줘서, 사장님이 요구하는 팔로워
 *    조건을 이 숫자로 판정하는데 그게 **한 달 전 값인지 방금 값인지 알 길이 없었다**. 그래서 신선도와
 *    다시 확인 버튼을 같은 줄에 둔다(둘은 짝이다 — 오래됐다고 알려 주면서 고칠 손잡이를 안 주면 소용없다).
 *
 * 🔴 **블록마다 카드를 씌우지 않는다** — 이 목록은 이미 카드(`/my-seeding` 의 `SNS 연동` 섹션) **안**이고
 *    신청 시트 안이다. 안에 또 판을 깔면 *카드 안에 카드*가 된다(2026-10-12 공유 카드에서 치른 교훈).
 *    대신 규칙 ⑦ 의 평면 목록 문법 — 블록 사이 hairline(`divide-rule`) 하나.
 */
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { relativeFromNow } from '@/utils/date'
import { OkIcon } from '@/components/icons/urdeal-icons'
import { SNS_LOGO } from '@/components/icons/sns-logos'
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

  /**
   * 🔄 제자리 갱신 — 저장된 토큰으로 팔로워만 다시 읽는다(앱을 안 벗어난다).
   *   토큰이 죽었으면(`reconnect`) 그때만 플랫폼 로그인으로 보낸다 — 그게 실제로 고치는 길이고,
   *   누른 사람의 의도("다시 확인")와도 같다. 조용히 실패하면 숫자가 왜 안 바뀌는지 알 수 없다.
   */
  async function refresh(p: SeedingPlatform) {
    setBusy(p)
    try {
      const r = await api.post(`/api/seeding/sns/${p}/refresh`)
      if (r.data?.success) { toast.success('다시 확인했어요'); onChanged?.(); return }
      toast.error(r.data?.error || '다시 확인하지 못했어요')
    } catch (e) {
      const d = (e as { response?: { data?: { error?: string; reconnect?: boolean } } }).response?.data
      toast.error(d?.error || '다시 확인하지 못했어요')
      if (d?.reconnect) { await connect(p); return }
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
        const Logo = SNS_LOGO[p]
        return (
          <li key={p} className="py-4 first:pt-2 last:pb-0">
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${l ? 'bg-brand-tint text-brand-text' : 'bg-warm text-gray-400 dark:text-gray-500'}`}>
                <Logo size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-gray-900 dark:text-white">
                  {l ? `@${l.username || l.display_name || PLATFORM_LABEL[p]}` : PLATFORM_LABEL[p]}
                </p>
                <p className="truncate text-[12px] text-gray-500 dark:text-gray-400">
                  {/* 🔤 미연동 줄은 짧게 — "연동하면 …" 안내는 바로 위 섹션 설명과 같은 말이고, 390px 에서 잘린다. */}
                  {l ? PLATFORM_LABEL[p] : available[p] ? '연동 안 됨' : '연동 준비 중'}
                </p>
              </div>
              {l ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-tint px-2 py-1 text-[12px] font-medium text-brand-text">
                  <OkIcon size={13} /> 연동됨
                </span>
              ) : (
                <button type="button" disabled={!!busy || !available[p]} onClick={() => connect(p)}
                  className="shrink-0 rounded-full bg-brand px-4 py-2 text-[13px] font-medium text-white disabled:bg-warm disabled:text-gray-500">
                  연동하기
                </button>
              )}
            </div>

            {l && (
              <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                <p className="min-w-0">
                  {/* 🔢 숫자가 주인공(규칙 ③). 못 읽은 경우에 0 을 적지 않는다 — 모르는 것과 0 은 다르다. */}
                  <span className="text-[24px] font-bold leading-none text-gray-900 dark:text-white">
                    {l.follower_count === null ? '—' : formatNumber(l.follower_count)}
                  </span>
                  <span className="ml-1 text-[13px] text-gray-500 dark:text-gray-400">
                    {l.follower_count === null ? `${FOLLOWER_WORD[p]} 수를 읽지 못했어요` : FOLLOWER_WORD[p]}
                  </span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" disabled={!!busy || !available[p]} onClick={() => refresh(p)}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] text-gray-600 hover:bg-warm disabled:opacity-50 dark:text-gray-300">
                    <RefreshCw size={14} strokeWidth={1.6} aria-hidden="true" className={busy === p ? 'animate-spin' : undefined} />
                    {busy === p ? '확인 중' : `${relativeFromNow(l.verified_at) || '확인'} 확인`}
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => unlink(p)}
                    className="rounded-full px-2 py-1 text-[13px] text-gray-400 hover:bg-warm dark:text-gray-500">해제</button>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
