/**
 * 🏠 생활 요청서 — 카테고리마다 그 일에 맞는 칸 (2026-10-24 대표 "미리 사전에 사용자의 니즈 리드를 받는게 좋지 않을까?").
 * 칸 정의는 `shared/home-service.ts` 하나 — 서버가 같은 표로 검증한다.
 * 🔒 연락처는 묻지 않는다 — 카카오 계정의 인증된 번호를 쓰고, 손님이 고른 한 곳에만 전달된다.
 */
import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { categoryDef, type HomeServiceCategory, type RequestField } from '@/shared/home-service'
import { kstYmd } from '@/shared/stays-early'
import { LifeHeader } from './life-shared'

const INPUT = 'w-full rounded-xl border border-rule bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-brand'

function FieldInput({ f, value, onChange }: { f: RequestField; value: string; onChange: (v: string) => void }) {
  if (f.type === 'select') {
    return (
      <div className="flex flex-wrap gap-2">
        {(f.options || []).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-full px-4 py-2 text-[13px] font-bold ${value === o ? 'bg-brand text-white' : 'bg-surface text-ink shadow-lift'}`}
          >
            {o}
          </button>
        ))}
      </div>
    )
  }
  if (f.type === 'textarea') {
    return <textarea className={`${INPUT} min-h-[96px]`} maxLength={500} placeholder={f.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  return (
    <div className="flex items-center gap-2">
      <input
        className={INPUT}
        type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
        inputMode={f.type === 'number' ? 'numeric' : undefined}
        min={f.type === 'date' ? kstYmd(0) : f.type === 'number' ? 1 : undefined}
        placeholder={f.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {f.unit && <span className="shrink-0 text-[15px] text-gray-500 dark:text-gray-400">{f.unit}</span>}
    </div>
  )
}

export default function LifeRequestFormPage() {
  const { category } = useParams()
  const def = categoryDef(category as HomeServiceCategory)
  const navigate = useNavigate()
  const [values, setValues] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  if (!def) {
    return (
      <div className="min-h-[100dvh] bg-warm px-4 py-20 text-center text-ink">
        <p className="text-[15px] font-bold">없는 카테고리예요</p>
        <Link to="/life" className="mt-4 inline-block text-[13px] text-brand-text">생활 서비스로 돌아가기</Link>
      </div>
    )
  }

  async function submit() {
    setError('')
    if (!consent) { setError('연락처 전달에 동의해 주세요'); return }
    setSending(true)
    try {
      const r = await api.post('/api/home-service/requests', { category: def!.key, fields: values, consent: true })
      if (r.data?.success) navigate(`/life/requests/${r.data.data.id}`, { replace: true })
      else setError(r.data?.error || '요청을 접수하지 못했어요')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error || '요청을 접수하지 못했어요')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title={`${def.label} 견적 요청 - 유어딜`} description={def.blurb} url={`/life/request/${def.key}`} />
      <LifeHeader title={`${def.label} 견적 요청`} back="/life" />
      <div className="ur-content-narrow space-y-6 px-4 pb-10">
        <p className="text-[13px] text-gray-600 dark:text-gray-300">{def.blurb}</p>
        {def.fields.map((f) => (
          <div key={f.key}>
            <label className="mb-2 block text-[15px] font-bold">
              {f.label}{!f.required && <span className="ml-1 text-[12px] font-normal text-gray-500 dark:text-gray-400">(선택)</span>}
            </label>
            <FieldInput f={f} value={values[f.key] || ''} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
          </div>
        ))}

        <label className="flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-lift">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="text-[13px] leading-relaxed">
            견적을 보낸 사장님 중 <b>제가 고른 한 곳</b>에 제 이름과 휴대폰 번호(카카오 계정 번호)를 전달하는 데 동의합니다.
            고르기 전에는 어느 사장님에게도 전달되지 않아요.
          </span>
        </label>

        {error && <p className="text-[13px] font-bold text-tone-bad">{error}</p>}
        <button type="button" disabled={sending} onClick={submit} className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-60">
          {sending ? '보내는 중' : '견적 요청 보내기'}
        </button>
      </div>
    </div>
  )
}
