/**
 * 🎁 사장님 — 인플루언서 무상 체험 제공 설정 칸 (2026-10-31 대표 "모집 인원도 사장님이 이용권 등록할 때 설정")
 *
 * 이용권 등록(셀러 대시보드, 라이트 고정) · 매장 요청함(`/store/seeding`) 두 곳이 같은 칸을 쓴다.
 * 값의 정규화는 `shared/seeding.ts` `normalizeOffer` — 화면이 허용한 값을 서버가 거절하지 않게.
 * ⚠️ 대시보드(라이트 고정)와 다크 지원 화면 양쪽에서 쓰므로 `dark:` 대신 테마 토큰(surface·warm·ink·rule)만 쓴다.
 */
import { OFFER_LIMITS, PLATFORM_LABEL, SEEDING_PLATFORMS, type SeedingOffer, type SeedingPlatform } from '@/shared/seeding'

const inputCls = 'w-full rounded-xl border border-rule bg-surface px-3 py-3 text-[15px] text-ink'

export default function SeedingOfferFields({ value, onChange }: { value: SeedingOffer; onChange: (v: SeedingOffer) => void }) {
  const set = <K extends keyof SeedingOffer>(k: K, v: SeedingOffer[K]) => onChange({ ...value, [k]: v })
  const togglePlatform = (p: SeedingPlatform) => {
    const has = value.platforms.includes(p)
    const next = has ? value.platforms.filter((x) => x !== p) : [...value.platforms, p]
    if (next.length) set('platforms', next)
  }
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-lift">
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-[15px] font-bold text-ink">인플루언서 무상 체험 제공</span>
          <span className="mt-1 block text-[13px] text-ink-soft">
            조건에 맞는 인플루언서가 신청하면 승인할 수 있어요. 방문 후 게시물을 올리는 조건이에요.
          </span>
        </span>
        <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={value.enabled}
          onChange={(e) => set('enabled', e.target.checked)} aria-label="무상 체험 제공" />
      </label>

      {value.enabled && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">신청 가능한 플랫폼</p>
            <div className="flex flex-wrap gap-2">
              {SEEDING_PLATFORMS.map((p) => {
                const on = value.platforms.includes(p)
                return (
                  <button key={p} type="button" onClick={() => togglePlatform(p)}
                    className={`rounded-full px-4 py-2 text-[13px] font-medium ${on ? 'bg-brand text-white' : 'bg-warm text-ink'}`}>
                    {PLATFORM_LABEL[p]}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink">최소 팔로워(구독자)</span>
              <input type="number" inputMode="numeric" min={0} max={OFFER_LIMITS.followersMax} className={inputCls}
                value={value.min_followers} onChange={(e) => set('min_followers', Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink">한 달 모집 인원</span>
              <input type="number" inputMode="numeric" min={OFFER_LIMITS.slotsMin} max={OFFER_LIMITS.slotsMax} className={inputCls}
                value={value.slots_per_month} onChange={(e) => set('slots_per_month', Math.floor(Number(e.target.value) || 1))} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink">제공 내용 (선택)</span>
            <input className={inputCls} maxLength={OFFER_LIMITS.noteMax} placeholder="예: 2인 세트 1회"
              value={value.offer_note} onChange={(e) => set('offer_note', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink">게시 의무</span>
            <textarea rows={2} className={inputCls} maxLength={OFFER_LIMITS.requirementMax}
              value={value.post_requirement} onChange={(e) => set('post_requirement', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink">게시 기한 (방문 후 며칠 안에)</span>
            <input type="number" inputMode="numeric" min={OFFER_LIMITS.deadlineMin} max={OFFER_LIMITS.deadlineMax} className={inputCls}
              value={value.post_deadline_days} onChange={(e) => set('post_deadline_days', Math.floor(Number(e.target.value) || 7))} />
          </label>
          <p className="text-[12px] text-ink-soft">
            방문하지 않거나 기한 안에 게시하지 않은 인플루언서는 다음 신청이 제한돼요. 체험 이용권은 0원이라 정산되지 않아요.
          </p>
        </div>
      )}
    </section>
  )
}
