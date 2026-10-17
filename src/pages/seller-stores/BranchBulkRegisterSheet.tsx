/**
 * 🏬 지점 여러 곳 한 번에 등록 (2026-10-17 대표 "응응 다 해줘" — 프랜차이즈 편의 기능)
 *
 * 한 곳씩 등록하는 `StoreRegisterModal` 은 지점마다 검색·담당자·약관을 다시 묻는다. 지점이 30곳이면
 * 30번이다. 여기서는 **브랜드 이름으로 검색해 여러 지점을 고르고**, 공통 정보(담당자 번호·사업자번호·
 * 약관)는 **한 번만** 받는다.
 *
 * ## 서버는 그대로 — 한 곳씩 같은 등록 경로를 탄다
 * 지점마다 `POST /api/seller/stores` 를 한 번씩 부른다. 새 서버 경로를 만들지 않으니 중복 등록 방지
 * (`STORE_EXISTS`)·국세청 조회·승인 대기·약관 기록이 한 곳씩 등록과 **한 벌**이다.
 *
 * ## 직접(내 가게)만
 * 이 화면은 본사 직영이든 점주 본인 가게든 **내가 주인인 지점**을 등록한다. 남의 가게를 대신 등록하는
 * 일은 에이전시 계정이 한다(2026-10-11 결정 — 개인 중개 등록은 닫혀 있다).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { Check, Loader2, Search, X } from 'lucide-react'
import type { KakaoPlace } from '@/components/KakaoMapPicker'
import { toRegisterPlace, type RegisterPlace } from '@/components/seller/StoreRegisterModal'
import { formatPhone, isValidMobilePhone, digitsOnly } from '@/utils/format-phone'
import { TERMS_CURRENT_VERSION } from '@/pages/terms/terms-types'

type Outcome = { kind: 'ok' } | { kind: 'exists' } | { kind: 'fail'; error: string }

/** 한 번에 고를 수 있는 지점 수 — 등록 한도(시간당)와 같은 값. 넘으면 나눠서 하면 된다. */
export const BRANCH_BULK_MAX = 60

export default function BranchBulkRegisterSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<RegisterPlace[]>([])
  const [searched, setSearched] = useState(false)
  const [picked, setPicked] = useState<Map<string, RegisterPlace>>(new Map())
  const [managerPhone, setManagerPhone] = useState('')
  const [bno, setBno] = useState('')
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [outcomes, setOutcomes] = useState<Map<string, Outcome>>(new Map())
  const [running, setRunning] = useState(false)

  async function search() {
    const q = query.trim()
    if (!q || searching) return
    setSearching(true)
    try {
      const r = await api.get(`/api/kakao/place/search?query=${encodeURIComponent(q)}&size=15`)
      const docs = (r.data?.data?.documents || []) as KakaoPlace[]
      setResults(docs.map(toRegisterPlace).filter((p) => !!p.id))
    } catch { setResults([]) } finally { setSearching(false); setSearched(true) }
  }

  function toggle(p: RegisterPlace) {
    const id = String(p.id)
    setPicked((prev) => {
      const n = new Map(prev)
      if (n.has(id)) n.delete(id)
      else if (n.size < BRANCH_BULK_MAX) n.set(id, p)
      return n
    })
  }

  const managerOk = isValidMobilePhone(digitsOnly(managerPhone))
  const bnoClean = bno.replace(/-/g, '')
  const bnoOk = bnoClean === '' || /^\d{10}$/.test(bnoClean)
  const infoOk = managerOk && bnoOk && termsAgreed

  async function run() {
    if (running || !infoOk) return
    setRunning(true); setStep(2)
    const next = new Map<string, Outcome>()
    // 한 곳씩 — 지점마다 국세청 조회·권한 연결이 있어 한 요청에 몰면 서버 한도에 걸린다.
    for (const [id, p] of picked) {
      try {
        const r = await api.post('/api/seller/stores', {
          name: p.name, address: p.address, phone: p.phone, category: p.category,
          kakao_place_id: p.id, kakao_place_url: p.place_url, lat: p.lat, lng: p.lng,
          channel: 'direct',
          manager_phone: digitsOnly(managerPhone),
          business_number: bnoClean || undefined,
          terms_agreed_version: TERMS_CURRENT_VERSION,
        })
        next.set(id, r.data?.success ? { kind: 'ok' } : { kind: 'fail', error: r.data?.error || '등록하지 못했어요' })
      } catch (e: unknown) {
        const err = e as { response?: { status?: number; data?: { code?: string; error?: string } } }
        if (err?.response?.status === 409 && err.response.data?.code === 'STORE_EXISTS') next.set(id, { kind: 'exists' })
        else next.set(id, { kind: 'fail', error: err?.response?.data?.error || '등록하지 못했어요' })
      }
      setOutcomes(new Map(next))
    }
    setRunning(false)
    onDone()
  }

  const okCount = [...outcomes.values()].filter((o) => o.kind === 'ok').length

  return (
    <div className="fixed inset-0 z-[10600] flex items-end justify-center bg-black/40 sm:items-center" onClick={running ? undefined : onClose}>
      <div className="w-full max-w-lg rounded-t-2xl bg-white sm:rounded-[var(--dash-radius,16px)] max-h-[90dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-[17px] font-bold text-gray-900">지점 여러 곳 한 번에 등록</p>
            <p className="mt-1 text-[13px] text-gray-500">
              {step === 0 ? '브랜드 이름으로 찾아서 내 지점을 고르세요' : step === 1 ? `${picked.size}곳 · 공통 정보는 한 번만` : '한 곳씩 등록하고 있어요'}
            </p>
          </div>
          {!running && <button type="button" onClick={onClose} aria-label="닫기" className="p-2 text-gray-400"><X size={18} /></button>}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5">
          {step === 0 && (
            <>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search() }}>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예) 교촌치킨 강남"
                  className="min-w-0 flex-1 rounded-xl border border-rule-strong px-3 py-3 text-[15px] text-gray-900 outline-none focus:border-brand" />
                <button type="submit" disabled={searching || !query.trim()} className="ur-btn ur-btn-md ur-btn-primary disabled:opacity-40">
                  {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </form>
              <p className="pt-2 text-[12px] text-gray-500">지역을 바꿔 여러 번 찾아도 고른 지점은 그대로 남아요. 최대 {BRANCH_BULK_MAX}곳.</p>
              {searched && results.length === 0 && <p className="py-6 text-center text-[13px] text-gray-500">검색 결과가 없어요</p>}
              <ul className="mt-2 divide-y divide-rule">
                {results.map((p) => {
                  const on = picked.has(String(p.id))
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => toggle(p)} className="flex w-full items-start gap-3 py-3 text-left">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${on ? 'bg-brand text-white' : 'border border-rule-strong'}`}>
                          {on && <Check size={13} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-gray-900">{p.name}</span>
                          <span className="block truncate text-[13px] text-gray-500">{p.address}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {step === 1 && (
            <div className="space-y-4 pb-2">
              <label className="block">
                <span className="text-[13px] font-semibold text-gray-700">담당자 휴대폰 (필수)</span>
                <input inputMode="tel" value={managerPhone} onChange={(e) => setManagerPhone(formatPhone(e.target.value))} placeholder="010-0000-0000"
                  className="mt-1 w-full rounded-xl border border-rule-strong px-3 py-3 text-[15px] text-gray-900 outline-none focus:border-brand" />
                <span className="mt-1 block text-[12px] text-gray-500">모든 지점에 같은 담당자로 들어가요. 나중에 지점마다 바꿀 수 있어요.</span>
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-gray-700">사업자등록번호 (선택)</span>
                <input inputMode="numeric" value={bno} onChange={(e) => setBno(e.target.value.replace(/[^0-9-]/g, '').slice(0, 12))} placeholder="숫자 10자리"
                  className="mt-1 w-full rounded-xl border border-rule-strong px-3 py-3 text-[15px] text-gray-900 outline-none focus:border-brand" />
                <span className="mt-1 block text-[12px] text-gray-500">직영점처럼 지점이 같은 사업자면 넣어 주세요. 가맹점은 점주가 각자 등록하는 게 맞아요.</span>
                {!bnoOk && <span className="mt-1 block text-[12px] text-tone-bad">사업자번호는 숫자 10자리예요</span>}
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={termsAgreed} onChange={(e) => setTermsAgreed(e.target.checked)} className="mt-1" />
                <span className="text-[13px] text-gray-700">
                  판매자 이용약관에 동의합니다 (지점마다 같은 동의로 기록돼요){' '}
                  <a href="/terms/seller" target="_blank" rel="noopener noreferrer" className="text-gray-500 underline">약관 보기</a>
                </span>
              </label>
              <p className="text-[12px] text-gray-500">등록한 지점은 승인 전까지 대기 상태예요. 사업자등록증은 지점마다 나중에 올려도 돼요.</p>
            </div>
          )}

          {step === 2 && (
            <ul className="divide-y divide-rule">
              {[...picked.values()].map((p) => {
                const o = outcomes.get(String(p.id))
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1 truncate text-[15px] text-gray-900">{p.name}</span>
                    {!o ? <Loader2 size={14} className="animate-spin text-gray-400" />
                      : o.kind === 'ok' ? <span className="text-[13px] font-bold text-tone-ok">등록됨</span>
                      : o.kind === 'exists' ? <span className="text-[13px] text-gray-500">이미 등록됨</span>
                      : <span className="max-w-[50%] truncate text-[13px] text-tone-bad">{o.error}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-2 px-5 pt-3 pb-5">
          {step === 0 && (
            <button type="button" onClick={() => setStep(1)} disabled={picked.size === 0} className="ur-btn ur-btn-lg ur-btn-primary w-full disabled:opacity-40">
              {picked.size > 0 ? `${picked.size}곳 고름 · 다음` : '지점을 골라 주세요'}
            </button>
          )}
          {step === 1 && (
            <>
              <button type="button" onClick={() => setStep(0)} className="ur-btn ur-btn-lg flex-1 border border-rule-strong bg-white text-gray-700">이전</button>
              <button type="button" onClick={run} disabled={!infoOk} className="ur-btn ur-btn-lg ur-btn-primary flex-[2] disabled:opacity-40">{picked.size}곳 등록</button>
            </>
          )}
          {step === 2 && (
            <button type="button" onClick={onClose} disabled={running} className="ur-btn ur-btn-lg ur-btn-primary w-full disabled:opacity-40">
              {running ? `등록 중… ${outcomes.size}/${picked.size}` : `${okCount}곳 등록했어요 · 닫기`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
