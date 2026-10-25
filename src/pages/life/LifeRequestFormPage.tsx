/**
 * 🏠 생활 요청서 — 오늘의집 흐름(2026-10-25 대표 공유 · `docs/design/life-quote-flow-ohouse-ref.md`).
 *
 *  - **로그인은 맨 끝에.** 질문을 다 답한 뒤 [견적 신청] 에서야 카카오 로그인 — 답은 `request/draft.ts` 가 들고 있는다.
 *    로그인은 빼지 않는다: 카카오가 확인한 휴대폰 번호가 곧 본인 확인이다(업체가 돈을 내고 견적을 보내므로
 *    장난 요청을 막아야 한다).
 *  - **요약 카드 + 질문 하나씩 시트.** 답하면 다음 질문이 저절로 열린다.
 *  - **다 마치면 함께 할 일 하나**(이사 → 입주청소 등, `crossSell`).
 * 칸 정의는 `shared/home-service.ts` 하나 — 서버가 같은 표로 검증한다.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { categoryDef, PRIVATE_ADDRESS_SUFFIX, type CategoryDef, type HomeServiceCategory, type RequestField } from '@/shared/home-service'
import { getUserIdSync } from '@/utils/auth'
import { loginPathFromHere } from '@/utils/login-return'
import { LifeHeader } from './life-shared'
import { clearDraft, loadDraft, saveDraft, type Draft } from './request/draft'
import { Sheet } from './request/Sheet'
import { MultiSheet, NumberSheet, OptionSheet, TextSheet } from './request/FieldSheets'
import { DateSheet } from './request/DateSheet'
import { AddressSheet } from './request/AddressSheet'

const CONSENT_KEY = '__consent'

/** 저절로 여는 질문 — 비워 둬도 되는 메모는 사람이 누를 때만 연다(매번 [건너뛰기] 를 누르게 하지 않는다). */
function autoChain(def: CategoryDef): RequestField[] {
  return def.fields.filter((f) => f.required || f.type !== 'textarea')
}

function nextOpen(def: CategoryDef, visited: Set<string>, after?: string): string | null {
  const chain = autoChain(def)
  const from = after ? chain.findIndex((f) => f.key === after) + 1 : 0
  return chain.slice(from).find((f) => !visited.has(f.key))?.key ?? chain.find((f) => !visited.has(f.key))?.key ?? null
}

function shown(f: RequestField, values: Draft): string {
  const v = values[f.key]
  if (!v) return ''
  if (f.type === 'region') return values[f.key + PRIVATE_ADDRESS_SUFFIX] || v
  if (f.type === 'number' && f.unit) return `${v}${f.unit}`
  return v
}

export default function LifeRequestFormPage() {
  const { category } = useParams()
  const def = categoryDef(category as HomeServiceCategory)
  const navigate = useNavigate()
  const [values, setValues] = useState<Draft>(() => (def ? loadDraft(def.key) : {}))
  const [visited, setVisited] = useState<Set<string>>(() => new Set(Object.keys(values)))
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [doneId, setDoneId] = useState<number | null>(null)
  const [crossOpen, setCrossOpen] = useState(false)
  const loggedIn = !!getUserIdSync()

  useEffect(() => { if (def && doneId == null) saveDraft(def.key, values) }, [def, values, doneId])
  // 처음 들어오면 아직 안 답한 첫 질문을 연다.
  useEffect(() => { if (def) setOpenKey(nextOpen(def, visited)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!def) {
    return (
      <div className="min-h-[100dvh] bg-warm px-4 py-20 text-center text-ink">
        <p className="text-[15px] font-bold">없는 카테고리예요</p>
        <Link to="/life" className="mt-4 inline-block text-[13px] text-brand-text">생활 서비스로 돌아가기</Link>
      </div>
    )
  }

  function answer(f: RequestField, patch: Draft) {
    const nextValues = { ...values }
    for (const [k, v] of Object.entries(patch)) { if (v) nextValues[k] = v; else delete nextValues[k] }
    const nextVisited = new Set(visited).add(f.key)
    setValues(nextValues)
    setVisited(nextVisited)
    setOpenKey(nextOpen(def!, nextVisited, f.key))
  }

  const missing = def.fields.filter((f) => f.required && !values[f.key])
  const consent = values[CONSENT_KEY] === '1'
  const ready = missing.length === 0

  async function submit() {
    setError('')
    if (!ready) { setOpenKey(missing[0].key); return }
    if (!consent) { setError('연락처 전달에 동의해 주세요'); return }
    if (!loggedIn) { saveDraft(def!.key, values); navigate(loginPathFromHere()); return }
    setSending(true)
    try {
      const fields = Object.fromEntries(Object.entries(values).filter(([k]) => !k.startsWith('__')))
      const r = await api.post('/api/home-service/requests', { category: def!.key, fields, consent: true })
      if (r.data?.success) {
        clearDraft(def!.key)
        setDoneId(Number(r.data.data.id))
        if (def!.crossSell) setCrossOpen(true)
      } else setError(r.data?.error || '요청을 접수하지 못했어요')
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } }
      if (err.response?.status === 401) { saveDraft(def!.key, values); navigate(loginPathFromHere()); return }
      setError(err.response?.data?.error || '요청을 접수하지 못했어요')
    } finally {
      setSending(false)
    }
  }

  function startCrossSell() {
    const cs = def!.crossSell
    if (!cs) return
    const carried: Draft = {}
    for (const [to, from] of Object.entries(cs.carry)) {
      if (values[from]) carried[to] = values[from]
      if (values[from + PRIVATE_ADDRESS_SUFFIX]) carried[to + PRIVATE_ADDRESS_SUFFIX] = values[from + PRIVATE_ADDRESS_SUFFIX]
    }
    saveDraft(cs.to, { ...loadDraft(cs.to), ...carried })
    navigate(`/life/request/${cs.to}`)
  }

  const openField = def.fields.find((f) => f.key === openKey) || null
  const close = () => setOpenKey(null)

  if (doneId != null) {
    return (
      <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
        <SEO title={`${def.label} 견적 요청 완료 - 유어딜`} description={def.blurb} url={`/life/request/${def.key}`} />
        <div className="ur-content-narrow px-4 pt-20 pb-10 text-center">
          <h1 className="text-[24px] font-extrabold tracking-tight">{def.label} 견적 요청을 보냈어요</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
            근처 업체가 견적을 보내면 알려 드릴게요.<br />비교하고 마음에 드는 한 곳만 고르세요.
          </p>
          <Link to={`/life/requests/${doneId}`} replace className="ur-btn ur-btn-lg ur-btn-primary mt-8 flex w-full justify-center">내 요청 보기</Link>
          <Link to="/life" className="mt-4 inline-block text-[13px] text-gray-500 dark:text-gray-400">생활 서비스로 돌아가기</Link>
        </div>
        {crossOpen && def.crossSell && (
          <Sheet
            title="함께 신청하시겠어요?"
            onClose={() => setCrossOpen(false)}
            footer={
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="ur-btn ur-btn-lg flex w-full justify-center bg-surface text-ink shadow-lift" onClick={() => setCrossOpen(false)}>괜찮아요</button>
                <button type="button" className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center" onClick={startCrossSell}>함께 신청</button>
              </div>
            }
          >
            <p className="pb-2 text-center text-[17px] font-bold leading-snug">{def.crossSell.title}</p>
            <p className="pb-4 text-center text-[13px] text-gray-500 dark:text-gray-400">방금 적은 주소와 날짜를 그대로 이어서 써요.</p>
          </Sheet>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title={`${def.label} 견적 요청 - 유어딜`} description={def.blurb} url={`/life/request/${def.key}`} />
      <LifeHeader title={`${def.label} 견적 요청`} back="/life" />
      <div className="ur-content-narrow space-y-6 px-4 pb-10">
        <h2 className="text-[24px] font-extrabold leading-snug tracking-tight">간단한 정보 입력하고<br />{def.label} 비교 견적 받아보세요</h2>

        <div className="divide-y divide-rule rounded-2xl bg-surface px-5 shadow-lift">
          {def.fields.map((f) => {
            const v = shown(f, values)
            return (
              <button key={f.key} type="button" onClick={() => setOpenKey(f.key)} className="flex w-full items-center gap-3 py-4 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-gray-500 dark:text-gray-400">
                    {f.label}{!f.required && ' (선택)'}
                  </span>
                  <span className={`mt-1 block break-words text-[15px] ${v ? 'font-bold text-ink' : 'text-gray-400 dark:text-gray-500'}`}>
                    {v || (f.type === 'select' || f.type === 'multi' ? '골라 주세요' : '알려 주세요')}
                  </span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" />
              </button>
            )
          })}
        </div>

        <label className="flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-lift">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={consent}
            onChange={(e) => setValues((s) => { const n = { ...s }; if (e.target.checked) n[CONSENT_KEY] = '1'; else delete n[CONSENT_KEY]; return n })} />
          <span className="text-[13px] leading-relaxed">
            견적을 보낸 업체 중 <b>제가 고른 한 곳</b>에 제 이름·휴대폰 번호(카카오 계정 번호)·상세 주소를 전달하는 데 동의합니다.
            고르기 전에는 어느 업체에도 전달되지 않아요.
          </span>
        </label>

        {error && <p className="text-[13px] font-bold text-tone-bad">{error}</p>}
        <button type="button" disabled={sending} onClick={submit} className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-60">
          {sending ? '보내는 중' : loggedIn ? '견적 신청' : '카카오로 로그인하고 견적 신청'}
        </button>
        {!loggedIn && <p className="text-center text-[13px] text-gray-500 dark:text-gray-400">적은 내용은 로그인하고 돌아와도 그대로 남아 있어요.</p>}
      </div>

      {openField && (openField.type === 'select'
        ? <OptionSheet f={openField} value={values[openField.key] || ''} onClose={close} onPick={(v) => answer(openField, { [openField.key]: v })} />
        : openField.type === 'date'
          ? <DateSheet f={openField} value={values[openField.key] || ''} lucky={def.luckyDays} onClose={close} onDone={(v) => answer(openField, { [openField.key]: v })} />
          : openField.type === 'region'
            ? <AddressSheet f={openField} onClose={close} onDone={(pub, full) => answer(openField, { [openField.key]: pub, [openField.key + PRIVATE_ADDRESS_SUFFIX]: full })} />
            : openField.type === 'number'
              ? <NumberSheet f={openField} value={values[openField.key] || ''} onClose={close} onDone={(v) => answer(openField, { [openField.key]: v })} />
              : openField.type === 'multi'
                ? <MultiSheet f={openField} value={values[openField.key] || ''} onClose={close} onDone={(v) => answer(openField, { [openField.key]: v })} />
                : <TextSheet f={openField} value={values[openField.key] || ''} onClose={close} onDone={(v) => answer(openField, { [openField.key]: v })} />)}
    </div>
  )
}
