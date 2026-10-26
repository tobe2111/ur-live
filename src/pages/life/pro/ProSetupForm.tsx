/**
 * 🏠 사장님 등록 — 하는 일(카테고리) · 일하는 지역 · 알림 받을 번호.
 * 지역은 시/도 전체 또는 시·구 단위. 처음 저장하면 무료 참여권 3장 + 그 지역에 보관돼 있던 요청이 바로 온다.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { sellerHeaders } from '../life-shared'
import { enterStoreSeat } from '@/utils/enter-store'
import { TERMS_CURRENT_VERSION } from '@/pages/terms/terms-types'
import { PRO_INTRO_MAX, PRO_LINKS_MAX, proLinkLabel } from '@/shared/home-service-review'

export interface ProMe {
  registered: boolean
  pro: { phone: string | null; active: number; intro?: string | null; links?: string[] } | null
  reviews?: { avg: number | null; count: number; recent: { rating: number; body: string; reviewer: string; created_at: string }[] } | null
  categories: string[]
  areas: { sido: string; sigungu: string }[]
  seller: { name: string; approved: boolean; phone: string | null }
  balance: number
  packages: { key: string; credits: number; price: number; label: string }[]
  chargeEnabled: boolean
  allCategories: { key: string; label: string }[]
  sidoList: string[]
}

const INPUT = 'rounded-xl border border-rule bg-surface px-3 py-2 text-[15px] text-ink outline-none focus:border-brand'

/** 공유 링크에서 온 업체 — 그 요청의 업종·지역을 미리 채운다(2026-10-25 대표 "업종을 선택을 하는게 좋을까?"). */
export interface ProPrefill { cat?: string | null; sido?: string | null; sigungu?: string | null }

function withPrefill(me: ProMe, p?: ProPrefill) {
  const cats = [...me.categories]
  if (p?.cat && me.allCategories.some((c) => c.key === p.cat) && !cats.includes(p.cat)) cats.push(p.cat)
  const areas = [...me.areas]
  if (p?.sido && me.sidoList.includes(p.sido)) {
    const g = p.sigungu && /^[가-힣]{1,10}(시|군|구)$/.test(p.sigungu) ? p.sigungu : ''
    const covered = areas.some((a) => a.sido === p.sido && (a.sigungu === '' || a.sigungu === g))
    if (!covered) areas.push({ sido: p.sido, sigungu: g })
  }
  return { cats, areas }
}

/**
 * 🚪 `signup` — 판매 좌석이 없는 사람(카카오 로그인만 한 상태)의 **한 번에 가입**(2026-10-25 대표 "가입 쉽게").
 * 같은 칸에 상호·약관 동의만 더하고 `POST /pro/signup` → 그 매장 좌석에 앉는다. 칸이 두 벌이면 검증이 갈린다.
 */
export default function ProSetupForm({ me, onSaved, prefill, signup }: { me: ProMe; onSaved: () => void; prefill?: ProPrefill; signup?: boolean }) {
  const [cats, setCats] = useState<string[]>(() => withPrefill(me, prefill).cats)
  const [areas, setAreas] = useState(() => withPrefill(me, prefill).areas)
  const [sido, setSido] = useState(me.sidoList[0] || '서울')
  const [sigungu, setSigungu] = useState('')
  const [phone, setPhone] = useState(me.pro?.phone || me.seller.phone || '')
  const [saving, setSaving] = useState(false)
  const [bizName, setBizName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [intro, setIntro] = useState(me.pro?.intro || '')
  const [links, setLinks] = useState<string[]>(() => {
    const l = [...(me.pro?.links ?? [])]
    return l.length ? l : ['']
  })

  function addArea() {
    const g = sigungu.trim()
    if (g && !/^[가-힣]{1,10}(시|군|구)$/.test(g)) { toast.error('시·군·구 이름으로 적어 주세요(예: 강남구)'); return }
    if (areas.some((a) => a.sido === sido && a.sigungu === g)) return
    setAreas([...areas, { sido, sigungu: g }])
    setSigungu('')
  }

  async function save() {
    setSaving(true)
    try {
      if (signup) {
        if (!agreed) { toast.error('이용약관에 동의해 주세요'); return }
        const r = await api.post('/api/home-service/pro/signup', { business_name: bizName, categories: cats, areas, phone, terms_agreed_version: TERMS_CURRENT_VERSION })
        if (!r.data?.success) { toast.error(r.data?.error || '가입하지 못했어요'); return }
        await enterStoreSeat(r.data.data?.seller_id)
        toast.success(r.data.data?.granted ? `가입했어요. 무료 참여권 ${r.data.data.granted}장을 드렸어요` : '가입했어요')
        onSaved()
        return
      }
      const bad = links.map((l) => l.trim()).find((l) => l && !proLinkLabel(l))
      if (bad) { toast.error('숨고·미소·네이버·카카오맵·당근·인스타그램 주소(https://…)만 넣을 수 있어요'); return }
      const r = await api.put('/api/home-service/pro/me', { categories: cats, areas, phone, intro, links: links.map((l) => l.trim()).filter(Boolean) }, sellerHeaders())
      if (r.data?.success) {
        toast.success(r.data.data?.granted ? `저장했어요. 무료 참여권 ${r.data.data.granted}장을 드렸어요` : '저장했어요')
        onSaved()
      } else toast.error(r.data?.error || '저장하지 못했어요')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error || '저장하지 못했어요')
    } finally { setSaving(false) }
  }

  return (
    <section className="space-y-5 rounded-2xl bg-surface p-5 shadow-lift">
      {signup && (
        <div>
          <p className="mb-2 text-[15px] font-bold">상호</p>
          <input className={`${INPUT} w-full`} placeholder="예: 깨끗한 방역" maxLength={40} value={bizName} onChange={(e) => setBizName(e.target.value)} />
          <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">손님 견적 카드에 이 이름이 보여요.</p>
        </div>
      )}
      <div>
        <p className="mb-2 text-[15px] font-bold">하는 일</p>
        <div className="flex flex-wrap gap-2">
          {me.allCategories.map((c) => {
            const on = cats.includes(c.key)
            return (
              <button key={c.key} type="button" onClick={() => setCats(on ? cats.filter((k) => k !== c.key) : [...cats, c.key])}
                className={`rounded-full px-4 py-2 text-[13px] font-medium ${on ? 'bg-brand text-white' : 'bg-warm text-ink'}`}>
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[15px] font-bold">일하는 지역</p>
        <div className="flex gap-2">
          <select className={INPUT} value={sido} onChange={(e) => setSido(e.target.value)}>
            {me.sidoList.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className={`${INPUT} min-w-0 flex-1`} placeholder="시·구 (비우면 전체)" value={sigungu} onChange={(e) => setSigungu(e.target.value)} />
          <button type="button" onClick={addArea} className="shrink-0 rounded-xl bg-warm px-4 text-[13px] font-medium text-ink">추가</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {areas.map((a) => (
            <button key={`${a.sido}-${a.sigungu}`} type="button" onClick={() => setAreas(areas.filter((x) => x !== a))}
              className="rounded-full bg-warm px-3 py-1 text-[13px] text-ink">
              {a.sido} {a.sigungu || '전체'} ✕
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[15px] font-bold">알림톡 받을 번호</p>
        <input className={`${INPUT} w-full`} inputMode="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      {!signup && (
        <div>
          <p className="mb-2 text-[15px] font-bold">업체 소개</p>
          <textarea className={`${INPUT} w-full`} rows={3} maxLength={PRO_INTRO_MAX} placeholder="예: 원룸·투룸 입주청소 8년, 주말도 가능해요"
            value={intro} onChange={(e) => setIntro(e.target.value)} />
          <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">손님 견적 카드에 보여요.</p>
        </div>
      )}

      {!signup && (
        <div>
          <p className="mb-2 text-[15px] font-bold">다른 곳 후기 링크</p>
          <p className="mb-2 text-[12px] text-gray-500 dark:text-gray-400">숨고·미소·네이버 플레이스·카카오맵·당근 등에 쌓인 후기가 있으면 주소를 넣어 주세요. 손님이 견적 카드에서 바로 봐요.</p>
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input className={`${INPUT} min-w-0 flex-1`} inputMode="url" placeholder="https://soomgo.com/profile/…" value={l}
                  onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))} />
                <button type="button" onClick={() => setLinks(links.length > 1 ? links.filter((_, j) => j !== i) : [''])}
                  className="shrink-0 rounded-xl bg-warm px-3 text-[13px] text-ink" aria-label="링크 빼기">✕</button>
              </div>
            ))}
          </div>
          {links.length < PRO_LINKS_MAX && (
            <button type="button" onClick={() => setLinks([...links, ''])} className="mt-2 text-[13px] font-medium text-brand-text">+ 링크 더 넣기</button>
          )}
        </div>
      )}

      {signup && (
        <label className="flex items-start gap-2 text-[13px] text-gray-600 dark:text-gray-300">
          <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span><a href="/terms/seller" target="_blank" rel="noreferrer" className="underline">판매자 이용약관</a>에 동의해요. 사업자등록증은 나중에 올려도 돼요.</span>
        </label>
      )}

      <button type="button" disabled={saving} onClick={save} className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-60">
        {saving ? '저장 중' : signup ? '가입하고 무료 참여권 받기' : me.registered ? '저장하기' : '등록하고 무료 참여권 받기'}
      </button>
    </section>
  )
}
