/**
 * 🙋 소개자 공개 프로필 — 인플루언서 표면 (2026-08-27)
 *
 * ## 왜 생겼나
 * 매장이 딜을 제안하려면 상대의 **유어딜 유저 ID** 를 알아야 했는데, 제안 화면이 그걸 손으로
 * 타이핑하게 돼 있었다(`placeholder: 'user_12345'`). 사장님이 남의 계정 ID 를 알 방법이 없으니
 * 그 화면은 현실에서 못 쓰는 것이었고, 딜이 0건인 이유 중 하나다.
 *
 * 검색을 붙이려 해도 **모수가 없었다** — `users` 전체를 셀러에게 열 수는 없고(가입자 전원 노출),
 * 실적 랭킹은 실적이 있어야 뜨는데 딜이 0건이라 비어 있다. 그래서 **본인이 켜는 공개 프로필**을
 * 만들었다. 이 화면이 그 스위치다.
 *
 * ⚠️ 여기 넣는 건 **공개 채널 링크**지 연락처가 아니다. 이메일·전화는 응답에도 안 담기고,
 *   매장과의 연락은 딜 제안(플랫폼 안)으로만 이뤄진다.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Megaphone, Plus, X, Store, Copy } from 'lucide-react'

type ChannelKind = 'instagram' | 'youtube' | 'blog' | 'tiktok' | 'other'
interface Channel { kind: ChannelKind; url: string; followers?: number | null }
interface Profile {
  is_open: 0 | 1
  intro: string | null
  channels: Channel[]
  categories: string[]
  regions: string[]
}

const KIND_LABEL: Record<ChannelKind, string> = {
  instagram: '인스타그램', youtube: '유튜브', blog: '블로그', tiktok: '틱톡', other: '기타',
}
const CAT_LABEL: Record<string, string> = {
  meal_voucher: '식사', beauty_voucher: '뷰티', stay_voucher: '숙박', etc_voucher: '기타',
}

export default function PublicProfileSection() {
  const [p, setP] = useState<Profile | null>(null)
  const [opts, setOpts] = useState<{ categories: string[]; regions: string[] }>({ categories: [], regions: [] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/influencer-profile/me')
      .then((r) => {
        if (!r.data?.success) return
        setP(r.data.data as Profile)
        setOpts(r.data.options || { categories: [], regions: [] })
      })
      .catch(() => { /* 조용히 — 이 섹션이 없어도 정산 화면은 동작한다 */ })
  }, [])

  if (!p) return null

  const patch = (v: Partial<Profile>) => setP((cur) => (cur ? { ...cur, ...v } : cur))
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  async function save(next: Profile) {
    setSaving(true)
    try {
      const r = await api.put('/api/influencer-profile/me', next)
      if (r.data?.success) {
        setP({ ...next, ...(r.data.data || {}) })
        toast.success(next.is_open ? '공개했습니다 — 매장이 찾을 수 있어요' : '비공개로 바꿨습니다')
      } else {
        toast.error(r.data?.error || '저장하지 못했습니다')
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || '저장하지 못했습니다')
    } finally { setSaving(false) }
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] p-4 mb-4">
      <div className="flex items-start gap-2 mb-3">
        <Megaphone className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">소개자 프로필</h2>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
            공개하면 매장이 나를 찾아 <b>소개 제안</b>을 보낼 수 있어요. 연락처는 공개되지 않습니다.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => save({ ...p, is_open: p.is_open ? 0 : 1 })}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${
            p.is_open ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-[#1A1C21] text-gray-600 dark:text-gray-300'
          } disabled:opacity-50`}
        >
          {p.is_open ? '공개 중' : '비공개'}
        </button>
      </div>

      <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-200 mb-1">한 줄 소개</label>
      <input
        value={p.intro ?? ''}
        onChange={(e) => patch({ intro: e.target.value })}
        maxLength={200}
        placeholder="예) 성수동 카페를 주로 소개합니다"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#131A24] text-sm text-gray-900 dark:text-white mb-3"
      />

      <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-200 mb-1">
        내 채널 <span className="text-gray-400">(공개하려면 1개 이상)</span>
      </label>
      <div className="space-y-2 mb-3">
        {p.channels.map((c, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <select
              value={c.kind}
              onChange={(e) => patch({ channels: p.channels.map((x, j) => (j === i ? { ...x, kind: e.target.value as ChannelKind } : x)) })}
              className="px-2 py-2 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#131A24] text-xs text-gray-900 dark:text-white shrink-0"
            >
              {(Object.keys(KIND_LABEL) as ChannelKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <input
              value={c.url}
              onChange={(e) => patch({ channels: p.channels.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
              placeholder="https://..."
              className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#131A24] text-xs text-gray-900 dark:text-white"
            />
            <input
              value={c.followers ?? ''}
              onChange={(e) => patch({ channels: p.channels.map((x, j) => (j === i ? { ...x, followers: e.target.value ? Number(e.target.value) : null } : x)) })}
              placeholder="팔로워"
              inputMode="numeric"
              className="w-20 px-2 py-2 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#131A24] text-xs text-gray-900 dark:text-white shrink-0"
            />
            <button type="button" onClick={() => patch({ channels: p.channels.filter((_, j) => j !== i) })}
              className="p-1.5 text-gray-400 hover:text-red-500 shrink-0" aria-label="채널 삭제">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        {p.channels.length < 5 && (
          <button type="button" onClick={() => patch({ channels: [...p.channels, { kind: 'instagram', url: '', followers: null }] })}
            className="flex items-center gap-1 text-xs font-bold text-pink-600">
            <Plus className="w-3.5 h-3.5" /> 채널 추가
          </button>
        )}
      </div>

      <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-200 mb-1">주로 소개하는 분야</label>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {opts.categories.map((k) => (
          <button key={k} type="button" onClick={() => patch({ categories: toggle(p.categories, k) })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
              p.categories.includes(k)
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white dark:bg-[#131A24] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#2C2F35]'
            }`}>{CAT_LABEL[k] || k}</button>
        ))}
      </div>

      <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-200 mb-1">활동 지역</label>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {opts.regions.map((r) => (
          <button key={r} type="button" onClick={() => patch({ regions: toggle(p.regions, r) })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
              p.regions.includes(r)
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white dark:bg-[#131A24] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#2C2F35]'
            }`}>{r}</button>
        ))}
      </div>

      <button type="button" disabled={saving} onClick={() => save(p)}
        className="w-full py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-bold disabled:opacity-50">
        {saving ? '저장 중...' : '저장'}
      </button>

      <StoreInviteLink />
    </section>
  )
}

/**
 * 🏪 매장 초대 링크 — "내가 데려온 매장"을 증거 있게 만드는 유일한 자동 경로.
 *
 * 이 링크로 등록한 매장은 **등록 순간에 나에게 귀속**된다(`introduced_by_influencer_id`).
 * 그 전엔 대표가 어드민에서 손으로 지정하는 길밖에 없었고, 분쟁 시 근거가 없었다.
 * 귀속 시각이 곧 **2% 유효기간 1년의 기산점**이다.
 */
function StoreInviteLink() {
  const myId = (() => {
    try { return localStorage.getItem('user_id') || localStorage.getItem('userId') || '' } catch { return '' }
  })()
  if (!myId) return null
  const url = `https://urdeal.kr/store/new?ref=${encodeURIComponent(myId)}`

  return (
    <div className="mt-4 rounded-lg border border-dashed border-gray-300 dark:border-[#2C2F35] p-3">
      <div className="flex items-start gap-2">
        <Store className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-gray-900 dark:text-white">매장 초대 링크</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
            이 링크로 등록한 매장은 내가 데려온 것으로 기록되고,
            그 매장 매출의 <b>2%</b>를 <b>1년간</b> 받습니다.
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <code className="flex-1 min-w-0 truncate rounded bg-gray-50 dark:bg-[#1A1C21] px-2 py-1.5 text-[10px] text-gray-600 dark:text-gray-300">
              {url}
            </code>
            <button
              type="button"
              onClick={async () => {
                try { await navigator.clipboard.writeText(url); toast.success('초대 링크 복사됨') }
                catch { toast.error('복사하지 못했습니다') }
              }}
              className="shrink-0 rounded-lg border border-gray-200 dark:border-[#2C2F35] p-1.5 text-gray-600 dark:text-gray-300"
              aria-label="초대 링크 복사"
            ><Copy className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
