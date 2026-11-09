/**
 * 🎬 사장님 — 이용권 콘텐츠 관리 (2026-11-04 대표 확정 **사장님 2 + 사장님 3 후보 고르기**)
 *   시안 https://claude.ai/artifact/8jrxtpbGUfwxLwrJTHKaMe
 *
 * 위에서부터
 *   ① 새로 찾은 후보 — 한 장씩 크게 보고 [넘기기 · 보이기]. 자동 검색이 찾은 것은 여기서 켜기 전엔 손님에게 안 보인다.
 *   ② 손님에게 이렇게 보여요 — 보이는 순서 그대로. 카드마다 [맨 앞 고정 · 앞으로/뒤로 · 숨기기 · 삭제].
 *   ③ 유어딜 사람 — 체험단 · 유어쇼츠 · 담아 파는 사람. **숨기기만** 된다(삭제 없음 — 소개로 파는 사람을 지우지 않는다).
 *   ④ 숨긴 것 — 다시 켤 수 있다.
 * 같은 가게의 이용권들은 콘텐츠를 함께 쓴다(가게 단위) — 여기서 바꾸면 그 가게 이용권 전체에 같이 적용된다.
 *
 * 🔒 라이트 고정 대시보드 화면 — `dark:` 를 쓰지 않는다(check-dashboard-theme).
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { useTranslation } from '@/lib/i18n-lite'
import SellerLayout from '@/components/SellerLayout'
import BrandLoader from '@/components/brand/BrandLoader'
import { CONTENT_PLATFORM_LABEL, type ContentItem, type PinPerson } from '@/shared/creator-content'
import { PlatformMark, urdealBadge } from './group-buy/creator-content/content-marks'

type Row = ContentItem & { status: 'candidate' | 'visible' | 'hidden'; source: string }
interface Payload { store_name: string | null; items: Row[]; urdeal: (ContentItem & { hidden: boolean })[]; pinners: (PinPerson & { hidden: boolean })[] }

const BTN = 'inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-[13px] font-medium'

function Thumb({ item, tall }: { item: ContentItem; tall?: boolean }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-xl bg-gray-100 ${tall ? 'aspect-[9/16] w-24' : 'h-16 w-16'}`}>
      {item.thumb_url && <img src={item.thumb_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
      <PlatformMark platform={item.platform} urdeal={!!item.urdeal} className="absolute left-1 top-1" />
    </span>
  )
}

/** 사장님·어드민 공용 본문(2026-11-09 — 어드민 고르기 화면이 같은 부품을 쓴다). `base` 가 사장님/어드민 API 를 가른다. */
export function CreatorContentManager({ base, headers }: { base: string; headers?: Record<string, string> }) {
  const { t } = useTranslation()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get(base, { headers }).then((r) => { if (r.data?.success) setData(r.data.data); else setError(r.data?.error || 'error') })
      .catch((e) => setError(e?.response?.data?.error || t('seller.creatorContent.loadFail', { defaultValue: '불러오지 못했어요' })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base])
  useEffect(() => { load() }, [load])

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setMsg(null)
    try { await fn(); load() } catch (e) { setMsg((e as { response?: { data?: { error?: string } } })?.response?.data?.error || t('seller.creatorContent.actFail', { defaultValue: '처리하지 못했어요' })) } finally { setBusy(false) }
  }
  const setItem = (id: string, body: Record<string, unknown>) => act(() => api.patch(`${base}/items/${id.slice(2)}`, body, { headers }))
  const delItem = (id: string) => act(() => api.delete(`${base}/items/${id.slice(2)}`, { headers }))
  const setRef = (ref: 'seeding' | 'urshorts' | 'pin', id: number | string, hidden: boolean) => act(() => api.patch(`${base}/refs`, { ref, id: Number(id), hidden }, { headers }))
  const add = () => act(async () => { await api.post(base, { url }, { headers }); setUrl(''); setAdding(false) })

  if (error) return <p className="p-5 text-[15px] text-gray-600">{error}</p>
  if (!data) return <BrandLoader />

  const candidates = data.items.filter((i) => i.status === 'candidate')
  const visible = data.items.filter((i) => i.status === 'visible')
  const hidden = data.items.filter((i) => i.status === 'hidden')
  const cand = candidates[0]
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...visible]; const j = idx + dir
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    act(() => api.put(`${base}/order`, { ids: next.map((x) => Number(x.id.slice(2))) }, { headers }))
  }

  return (
    <>
      <div className="mx-auto max-w-[720px] px-4 pb-12 pt-4 text-gray-900">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-semibold">{t('seller.creatorContent.title', { defaultValue: '다녀온 사람들 관리' })}</h1>
            <p className="mt-1 truncate text-[13px] text-gray-500">{data.store_name} · {t('seller.creatorContent.scope', { defaultValue: '이 가게 이용권 전체에 같이 보여요' })}</p>
          </div>
          <button type="button" onClick={() => setAdding((v) => !v)} className="ur-btn ur-btn-sm ur-btn-primary shrink-0"><Plus className="h-4 w-4" />{t('seller.creatorContent.add', { defaultValue: '추가' })}</button>
        </div>

        {adding && (
          <div className="mt-3 rounded-xl bg-white p-4 shadow-lift">
            <p className="text-[13px] text-gray-600">{t('seller.creatorContent.addHint', { defaultValue: '유튜브 · 인스타그램 · 틱톡 · 네이버 클립 · 네이버 블로그 주소를 붙여 넣으세요. 바로 손님에게 보여요.' })}</p>
            <input id="cc-url" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://"
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 text-[15px] text-gray-900 outline-none focus:border-brand" />
            <button type="button" disabled={busy || !url.trim()} onClick={add} className="ur-btn ur-btn-md ur-btn-primary mt-2 w-full disabled:opacity-50">
              {t('seller.creatorContent.addConfirm', { defaultValue: '추가하기' })}
            </button>
          </div>
        )}
        {msg && <p className="mt-3 text-[13px] text-tone-bad">{msg}</p>}

        {cand && (
          <section className="mt-5">
            <h2 className="text-[16px] font-semibold">{t('seller.creatorContent.candidates', { defaultValue: '새로 찾은 후보' })} <span className="text-gray-500 tabular-nums">{candidates.length}</span></h2>
            <p className="mt-1 text-[13px] text-gray-500">{t('seller.creatorContent.candidatesHint', { defaultValue: '자동으로 찾은 글·영상이에요. 보이기를 눌러야 손님에게 보여요.' })}</p>
            <div className="mt-3 flex gap-3 rounded-xl bg-white p-3 shadow-lift">
              <Thumb item={cand} tall={cand.kind === 'video'} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-3 text-[15px] font-medium">{cand.title || CONTENT_PLATFORM_LABEL[cand.platform]}</p>
                <p className="mt-1 truncate text-[12px] text-gray-500">{CONTENT_PLATFORM_LABEL[cand.platform]}{cand.author_name ? ` · ${cand.author_name}` : ''}{cand.sponsored ? ` · ${t('seller.creatorContent.sponsored', { defaultValue: '협찬' })}` : ''}</p>
                {cand.summary && <p className="mt-1 line-clamp-2 text-[13px] text-gray-600">{cand.summary}</p>}
                <a href={cand.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[13px] text-brand-text">{t('seller.creatorContent.openOriginal', { defaultValue: '원본 보기' })} ↗</a>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => setItem(cand.id, { status: 'hidden' })} className={`${BTN} flex-1 bg-gray-100 text-gray-700`}>{t('seller.creatorContent.skip', { defaultValue: '넘기기' })}</button>
                  <button type="button" disabled={busy} onClick={() => setItem(cand.id, { status: 'visible' })} className="ur-btn ur-btn-sm ur-btn-primary flex-1">{t('seller.creatorContent.show', { defaultValue: '보이기' })}</button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-[16px] font-semibold">{t('seller.creatorContent.visible', { defaultValue: '손님에게 이렇게 보여요' })}</h2>
          {visible.length === 0 && data.urdeal.filter((u) => !u.hidden).length === 0
            ? <p className="mt-2 text-[13px] text-gray-500">{t('seller.creatorContent.empty', { defaultValue: '아직 보이는 콘텐츠가 없어요. 후보를 고르거나 주소로 추가해 보세요. 0개면 손님 화면에서 이 칸은 숨겨져요.' })}</p>
            : (
              <ul className="mt-3 divide-y divide-rule rounded-xl bg-white px-3 shadow-lift">
                {visible.map((v, i) => (
                  <li key={v.id} className="flex items-center gap-3 py-3">
                    <Thumb item={v} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{v.title || v.author_name || CONTENT_PLATFORM_LABEL[v.platform]}</p>
                      <p className="truncate text-[12px] text-gray-500">{CONTENT_PLATFORM_LABEL[v.platform]}{v.pinned ? ` · ${t('seller.creatorContent.pinned', { defaultValue: '맨 앞 고정' })}` : ''}{v.source === 'auto' ? '' : ` · ${t('seller.creatorContent.addedByOwner', { defaultValue: '직접 추가' })}`}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button type="button" disabled={busy} onClick={() => setItem(v.id, { pinned: !v.pinned })} className={`${BTN} ${v.pinned ? 'bg-brand-tint text-brand-text' : 'bg-gray-100 text-gray-700'}`}>{v.pinned ? t('seller.creatorContent.unpin', { defaultValue: '고정 해제' }) : t('seller.creatorContent.pin', { defaultValue: '맨 앞 고정' })}</button>
                        <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={t('seller.creatorContent.moveUp', { defaultValue: '앞으로' })} className={`${BTN} bg-gray-100 text-gray-700 disabled:opacity-40`}><ArrowLeft className="h-4 w-4" /></button>
                        <button type="button" disabled={busy || i === visible.length - 1} onClick={() => move(i, 1)} aria-label={t('seller.creatorContent.moveDown', { defaultValue: '뒤로' })} className={`${BTN} bg-gray-100 text-gray-700 disabled:opacity-40`}><ArrowRight className="h-4 w-4" /></button>
                        <button type="button" disabled={busy} onClick={() => setItem(v.id, { status: 'hidden' })} className={`${BTN} bg-gray-100 text-gray-700`}>{t('seller.creatorContent.hide', { defaultValue: '숨기기' })}</button>
                        <button type="button" disabled={busy} onClick={() => delItem(v.id)} className={`${BTN} bg-gray-100 text-tone-bad`}><X className="h-4 w-4" />{t('common.delete', { defaultValue: '삭제' })}</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </section>

        {(data.urdeal.length > 0 || data.pinners.length > 0) && (
          <section className="mt-8">
            <h2 className="text-[16px] font-semibold">{t('seller.creatorContent.urdeal', { defaultValue: '유어딜 사람' })}</h2>
            <p className="mt-1 text-[13px] text-gray-500">{t('seller.creatorContent.urdealHint', { defaultValue: '체험단 · 유어쇼츠 · 이 이용권을 유어샵에서 파는 사람이에요. 숨길 수는 있지만 지울 수는 없어요.' })}</p>
            <ul className="mt-3 divide-y divide-rule rounded-xl bg-white px-3 shadow-lift">
              {data.urdeal.map((u) => (
                <li key={u.id} className={`flex items-center gap-3 py-3${u.hidden ? ' opacity-50' : ''}`}>
                  <Thumb item={u} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{u.author_name || u.title || CONTENT_PLATFORM_LABEL[u.platform]}</p>
                    <p className="truncate text-[12px] text-brand-text">{urdealBadge(u)}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => setRef(u.urdeal === 'seeding' ? 'seeding' : 'urshorts', u.id.split(':')[1], !u.hidden)} className={`${BTN} shrink-0 bg-gray-100 text-gray-700`}>
                    {u.hidden ? t('seller.creatorContent.unhide', { defaultValue: '다시 보이기' }) : t('seller.creatorContent.hide', { defaultValue: '숨기기' })}
                  </button>
                </li>
              ))}
              {data.pinners.map((p) => (
                <li key={`p${p.user_id}`} className={`flex items-center gap-3 py-3${p.hidden ? ' opacity-50' : ''}`}>
                  <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200">{p.avatar && <img src={p.avatar} alt="" className="h-full w-full object-cover" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{p.name || p.handle}</p>
                    <p className="truncate text-[12px] text-brand-text">{t('seller.creatorContent.selling', { defaultValue: '유어샵에서 판매 중' })}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => setRef('pin', p.user_id, !p.hidden)} className={`${BTN} shrink-0 bg-gray-100 text-gray-700`}>
                    {p.hidden ? t('seller.creatorContent.unhide', { defaultValue: '다시 보이기' }) : t('seller.creatorContent.hide', { defaultValue: '숨기기' })}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hidden.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[16px] font-semibold">{t('seller.creatorContent.hiddenTitle', { defaultValue: '숨긴 것' })} <span className="text-gray-500 tabular-nums">{hidden.length}</span></h2>
            <ul className="mt-3 divide-y divide-rule rounded-xl bg-white px-3 shadow-lift">
              {hidden.map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-3">
                  <Thumb item={h} />
                  <p className="min-w-0 flex-1 truncate text-[15px] text-gray-600">{h.title || h.author_name || CONTENT_PLATFORM_LABEL[h.platform]}</p>
                  <button type="button" disabled={busy} onClick={() => setItem(h.id, { status: 'visible' })} className={`${BTN} shrink-0 bg-gray-100 text-gray-700`}>{t('seller.creatorContent.unhide', { defaultValue: '다시 보이기' })}</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}

export default function SellerCreatorContentPage() {
  const { productId } = useParams()
  const base = `/api/seller/creator-content/${Number(productId)}`
  const headers = { Authorization: `Bearer ${localStorage.getItem('seller_token')}` }
  return <SellerLayout title="콘텐츠"><CreatorContentManager base={base} headers={headers} /></SellerLayout>
}
