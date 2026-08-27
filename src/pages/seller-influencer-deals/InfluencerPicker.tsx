/**
 * 🔎 소개자 찾기 — 매장이 제안할 상대를 고르는 곳 (2026-08-27)
 *
 * ## 무엇을 대체하나
 * 이 자리에는 원래 **텍스트 입력 하나**가 있었다 — `placeholder: 'user_12345'`.
 * 사장님이 남의 유어딜 계정 ID 를 알 방법이 없으니, 제안 화면은 있으나 **쓸 수 없는 화면**이었다.
 * 딜이 0건인 이유 중 하나다.
 *
 * ## 모수는 "공개한 사람"뿐이다
 * 검색에 뜨는 건 소개자 프로필을 **본인이 공개(opt-in)** 한 사람만이다. 가입자 전체를 열 수는
 * 없고(사업자에게 전원 노출), 실적 랭킹은 실적이 있어야 떠서 지금은 비어 있다.
 * 그래서 결과가 0건일 수 있다 — 그때는 "아직 없다"고 정직하게 말한다(빈 화면은 고장처럼 보인다).
 *
 * ⚠️ 카드에 **연락처는 없다**(서버가 안 보낸다). 채널 링크는 공개 계정이고, 연락은 제안으로만 한다.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Search, Check, ExternalLink } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface Channel { kind: string; url: string; followers?: number | null }
export interface PickerRow {
  user_id: string
  handle: string | null
  name: string | null
  profile_image: string | null
  intro: string | null
  channels: Channel[]
  followers: number
  categories: string[]
  regions: string[]
  has_deal: boolean
}

const CAT_LABEL: Record<string, string> = {
  meal_voucher: '식사', beauty_voucher: '뷰티', stay_voucher: '숙박', etc_voucher: '기타',
}
const KIND_LABEL: Record<string, string> = {
  instagram: '인스타', youtube: '유튜브', blog: '블로그', tiktok: '틱톡', other: '채널',
}

export default function InfluencerPicker({
  selectedId, onPick, headers,
}: {
  selectedId: string
  onPick: (row: PickerRow) => void
  headers?: Record<string, string>
}) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [rows, setRows] = useState<PickerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      api.get('/api/seller-marketing/influencers', { params: { q, category: cat }, headers })
        .then((r) => { if (alive && r.data?.success) setRows(r.data.data || []) })
        .catch(() => { if (alive) setRows([]) })
        .finally(() => { if (alive) { setLoading(false); setLoaded(true) } })
    }, 250)  // 타이핑마다 때리지 않는다
    return () => { alive = false; clearTimeout(t) }
  }, [q, cat, headers])

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">소개 파트너 찾기</label>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임 · 핸들 · 소개글로 검색"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900"
        />
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {[['', '전체'], ...Object.entries(CAT_LABEL)].map(([k, label]) => (
          <button
            key={k || 'all'} type="button" onClick={() => setCat(k)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              cat === k ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >{label}</button>
        ))}
      </div>

      {loading && !loaded ? (
        <p className="py-6 text-center text-xs text-gray-500">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg bg-gray-50 px-3 py-5 text-center">
          <p className="text-xs font-medium text-gray-700">
            {q || cat ? '조건에 맞는 소개 파트너가 없습니다' : '아직 공개된 소개 파트너가 없습니다'}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            소개 파트너가 본인 프로필을 공개해야 여기에 나타납니다.<br />
            아는 분이 있다면 유어딜 가입 후 <b>마이 → 소개자 프로필 공개</b>를 안내해 주세요.
          </p>
        </div>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {rows.map((r) => {
            const picked = selectedId === r.user_id
            return (
              <li key={r.user_id}>
                <button
                  type="button" onClick={() => onPick(r)}
                  className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left ${
                    picked ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  {r.profile_image
                    ? <img src={r.profile_image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" loading="lazy" />
                    : <div className="h-9 w-9 shrink-0 rounded-full bg-gray-100" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-gray-900">{r.name || r.handle || '소개 파트너'}</span>
                      {r.handle && <span className="shrink-0 text-[11px] text-gray-400">@{r.handle}</span>}
                      {r.has_deal && (
                        <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">진행 중</span>
                      )}
                    </div>
                    {r.intro && <p className="truncate text-[11px] text-gray-600">{r.intro}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                      {r.followers > 0 && <span className="font-medium">팔로워 {formatNumber(r.followers)}</span>}
                      {r.categories.slice(0, 3).map((k) => <span key={k}>{CAT_LABEL[k] || k}</span>)}
                      {r.regions.slice(0, 2).map((v) => <span key={v}>{v}</span>)}
                    </div>
                    {r.channels.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {r.channels.slice(0, 3).map((c, i) => (
                          <a
                            key={i} href={c.url} target="_blank" rel="noopener noreferrer nofollow"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 hover:underline"
                          >
                            {KIND_LABEL[c.kind] || c.kind}<ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {picked && <Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-900" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
