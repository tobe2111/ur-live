/**
 * 🏠 생활 요청서 — 오늘의집 흐름(2026-10-25 대표 공유 · `docs/design/life-quote-flow-ohouse-ref.md`).
 *
 *  - **로그인은 맨 끝에.** 질문을 다 답한 뒤 [견적 신청] 에서야 카카오 로그인 — 답은 `request/draft.ts` 가 들고 있는다.
 *    로그인은 빼지 않는다: 카카오가 확인한 휴대폰 번호가 곧 본인 확인이다(업체가 돈을 내고 견적을 보내므로
 *    장난 요청을 막아야 한다).
 *  - **단계식 — 한 화면에 질문 하나.** 위에 진행 막대(3/9), 고르면 다음 질문으로 바로 넘어가고, 마지막은
 *    한 장짜리 확인 화면(줄을 누르면 그 질문으로 돌아가 고친다). 2026-10-25 대표 "단계별로 쭉쭉 자동으로 ·
 *    지금은 너무 세로로 길고" — 질문 전체를 목록으로 늘어놓던 요약 카드를 맨 끝 확인 화면으로 옮겼다.
 *  - **다 마치면 함께 할 일 하나**(이사 → 입주청소 등, `crossSell`).
 * 칸 정의는 `shared/home-service.ts` 하나 — 서버가 같은 표로 검증한다.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { categoryDef, PRIVATE_ADDRESS_SUFFIX, type HomeServiceCategory, type RequestField } from '@/shared/home-service'
import { getUserIdSync } from '@/utils/auth'
import { loginPathFromHere } from '@/utils/login-return'
import { BigTicketNote, shareLifeRequest } from './life-shared'
import { SEEN_KEY, clearDraft, firstOpenStep, loadDraft, saveDraft, type Draft } from './request/draft'
import { Sheet, StepFrameContext } from './request/Sheet'
import { MultiSheet, NumberSheet, OptionSheet, TextSheet } from './request/FieldSheets'
import { DateSheet } from './request/DateSheet'
import { AddressSheet } from './request/AddressSheet'
import { lifeCategoryTitle } from '@/shared/life-seo'
import { withSiteName } from '@/shared/seo/consumer-surfaces'
import { PhotoSheet } from './request/PhotoSheet'

const CONSENT_KEY = '__consent'
function shown(f: RequestField, values: Draft): string {
  const v = values[f.key]
  if (!v) return ''
  if (f.type === 'region') return values[f.key + PRIVATE_ADDRESS_SUFFIX] || v
  if (f.type === 'photos') return `사진 ${v.split(',').filter(Boolean).length}장`
  if (f.type === 'number' && f.unit) return `${v}${f.unit}`
  return v
}

export default function LifeRequestFormPage() {
  const { category } = useParams()
  const def = categoryDef(category as HomeServiceCategory)
  const navigate = useNavigate()
  const [values, setValues] = useState<Draft>(() => (def ? loadDraft(def.key) : {}))
  // 단계식(2026-10-25 대표 "단계별로 쭉쭉 자동으로") — 한 화면에 질문 하나, 마지막은 확인 화면.
  const [step, setStep] = useState<number>(() => (def ? firstOpenStep(def.fields, values) : 0))
  // 확인 화면에서 고치러 들어간 질문이면 답한 뒤 확인 화면으로 돌아온다.
  const [editing, setEditing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [doneId, setDoneId] = useState<number | null>(null)
  const [doneShare, setDoneShare] = useState<string | null>(null)
  const [crossOpen, setCrossOpen] = useState(false)
  const loggedIn = !!getUserIdSync()
  // 이 일을 받는 업체 수 — 0 이면 "업체 모집 중" 을 미리 알린다(요청은 보관됐다가 업체가 생기면 간다).
  const [proCount, setProCount] = useState<number | null>(null)
  useEffect(() => {
    if (!def) return
    api.get('/api/home-service/config').then((r) => {
      const n = r.data?.data?.proCounts?.[def.key]
      if (r.data?.data?.proCounts) setProCount(typeof n === 'number' ? n : 0)
    }).catch(() => {})
  }, [def])

  useEffect(() => { if (def && doneId == null) saveDraft(def.key, values) }, [def, values, doneId])

  if (!def) {
    return (
      <div className="min-h-[100dvh] bg-warm px-4 py-20 text-center text-ink">
        <p className="text-[15px] font-bold">없는 카테고리예요</p>
        <Link to="/life" className="mt-4 inline-block text-[13px] text-brand-text">생활 서비스로 돌아가기</Link>
      </div>
    )
  }

  const REVIEW = def.fields.length

  function answer(f: RequestField, patch: Draft) {
    const nextValues = { ...values }
    for (const [k, v] of Object.entries(patch)) { if (v) nextValues[k] = v; else delete nextValues[k] }
    const seen = new Set((nextValues[SEEN_KEY] || '').split(',').filter(Boolean)).add(f.key)
    nextValues[SEEN_KEY] = [...seen].join(',')
    setValues(nextValues)
    setStep(editing ? REVIEW : step + 1)
    setEditing(false)
  }

  function back() {
    if (editing) { setEditing(false); setStep(REVIEW); return }
    if (step === 0) { navigate('/life'); return }
    setStep(step - 1)
  }

  function edit(i: number) { setEditing(true); setStep(i) }

  const missing = def.fields.filter((f) => f.required && !values[f.key])
  const consent = values[CONSENT_KEY] === '1'
  const ready = missing.length === 0

  async function submit() {
    setError('')
    if (!ready) { edit(def!.fields.indexOf(missing[0])); return }
    if (!consent) { setError('연락처 전달에 동의해 주세요'); return }
    if (!loggedIn) { saveDraft(def!.key, values); navigate(loginPathFromHere()); return }
    setSending(true)
    try {
      const fields = Object.fromEntries(Object.entries(values).filter(([k]) => !k.startsWith('__')))
      const r = await api.post('/api/home-service/requests', { category: def!.key, fields, consent: true })
      if (r.data?.success) {
        clearDraft(def!.key)
        setDoneId(Number(r.data.data.id))
        setDoneShare(r.data.data.share_token || null)
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

  if (doneId != null) {
    return (
      <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
        <SEO title={`${def.label} 견적 요청 완료 - 유어딜`} description={def.blurb} url={`/life/request/${def.key}`} />
        <div className="ur-content-narrow px-4 pt-20 pb-10 text-center">
          <h1 className="text-[24px] font-bold tracking-tight">{def.label} 견적 요청을 보냈어요</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
            근처 업체가 견적을 보내면 알려 드릴게요.<br />비교하고 마음에 드는 한 곳만 고르세요.
          </p>
          <Link to={`/life/requests/${doneId}`} replace className="ur-btn ur-btn-lg ur-btn-primary mt-8 flex w-full justify-center">내 요청 보기</Link>
          {/* 2026-10-31 대표 *"그 견적 링크를 공유해야 홍보도 되는거잖아"* — 막 보낸 순간이 공유하기 가장 좋은 때다. */}
          {doneShare && (<>
            <button type="button" onClick={() => shareLifeRequest(doneShare, `${def.label} 견적 요청`)}
              className="ur-btn ur-btn-lg mt-3 flex w-full justify-center bg-surface text-ink shadow-lift">아는 업체에 링크 보내기</button>
            <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">링크엔 이름·연락처·상세 주소가 가려져요.</p>
          </>)}
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

  const recruiting = proCount === 0 && (
    <p className="rounded-2xl bg-warm p-4 text-[13px] leading-relaxed">
      지금 {def.label} 업체를 모집하고 있어요. 요청은 보관해 두었다가 업체가 들어오는 대로 보내 드려요.
    </p>
  )
  // 첫 질문 위 소개 — 업종 설명 + 연락처 규칙(격자 타일에서 뺀 설명을 여기서 한 번 말한다).
  const intro = (
    <div className="rounded-2xl bg-warm px-4 py-3">
      <p className="text-[15px] font-medium leading-relaxed">{def.blurb}</p>
      <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">견적은 무료이고, 비교해서 고른 한 곳에만 연락처가 전달돼요.</p>
    </div>
  )
  const seo = <SEO title={withSiteName(lifeCategoryTitle(def))} description={def.blurb} url={`/life/request/${def.key}`} />

  if (step < REVIEW) {
    const f = def.fields[step]
    const v = values[f.key] || ''
    const done = (patch: Draft) => answer(f, patch)
    return (
      <StepFrameContext.Provider value={{ step: step + 1, total: REVIEW, label: `${def.label} 견적`, notice: recruiting || undefined, intro }}>
        {seo}
        {f.type === 'photos'
          ? <PhotoSheet key={f.key} f={f} value={v} loggedIn={loggedIn} onClose={back}
              onLogin={() => { saveDraft(def.key, values); navigate(loginPathFromHere()) }}
              onDone={(x) => done({ [f.key]: x })} />
          : f.type === 'select'
            ? <OptionSheet key={f.key} f={f} value={v} onClose={back} onPick={(x) => done({ [f.key]: x })} />
            : f.type === 'date'
              ? <DateSheet key={f.key} f={f} value={v} lucky={def.luckyDays} onClose={back} onDone={(x) => done({ [f.key]: x })} />
              : f.type === 'region'
                ? <AddressSheet key={f.key} f={f} onClose={back} onDone={(pub, full) => done({ [f.key]: pub, [f.key + PRIVATE_ADDRESS_SUFFIX]: full })} />
                : f.type === 'number'
                  ? <NumberSheet key={f.key} f={f} value={v} onClose={back} onDone={(x) => done({ [f.key]: x })} />
                  : f.type === 'multi'
                    ? <MultiSheet key={f.key} f={f} value={v} onClose={back} onDone={(x) => done({ [f.key]: x })} />
                    : <TextSheet key={f.key} f={f} value={v} onClose={back} onDone={(x) => done({ [f.key]: x })} />}
      </StepFrameContext.Provider>
    )
  }

  // 확인 화면 — 답을 한 줄씩 보고, 누르면 그 질문으로 돌아가 고친다.
  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      {seo}
      <header className="ur-content-narrow flex h-14 items-center gap-3 px-4">
        <button type="button" aria-label="이전" onClick={() => setStep(REVIEW - 1)} className="-ml-2 p-2 text-ink"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-[17px] font-bold">{def.label} 견적 요청</h1>
      </header>
      <div className="ur-content-narrow space-y-5 px-4 pb-10">
        <h2 className="text-[24px] font-bold leading-snug tracking-tight">이대로 견적을 받을까요?</h2>
        {recruiting}
        <div className="divide-y divide-rule rounded-2xl bg-surface px-5 shadow-lift">
          {def.fields.map((f, i) => {
            const v = shown(f, values)
            return (
              <button key={f.key} type="button" onClick={() => edit(i)} className="flex w-full items-start gap-3 py-3 text-left">
                <span className="w-24 shrink-0 pt-px text-[13px] text-gray-500 dark:text-gray-400">{f.label}</span>
                <span className={`min-w-0 flex-1 break-words text-[13px] ${v ? 'font-medium text-ink' : f.required ? 'font-medium text-brand-text' : 'text-gray-400 dark:text-gray-500'}`}>
                  {v || (f.required ? '알려 주세요' : '없음')}
                </span>
                <span className="shrink-0 text-[13px] text-gray-400 dark:text-gray-500">수정</span>
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

        {def.bigTicket && <BigTicketNote />}
        {error && <p className="text-[13px] font-medium text-tone-bad">{error}</p>}
        <button type="button" disabled={sending} onClick={submit} className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-60">
          {sending ? '보내는 중' : loggedIn ? '견적 신청' : '카카오로 로그인하고 견적 신청'}
        </button>
        {!loggedIn && <p className="text-center text-[13px] text-gray-500 dark:text-gray-400">적은 내용은 로그인하고 돌아와도 그대로 남아 있어요.</p>}
      </div>
    </div>
  )
}
