import { useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import PanelError from './PanelError'

/**
 * 🆕 2026-07-02 유어애즈 — AI 콘텐츠 스튜디오.
 *   리퍼포징(원문→멀티플랫폼) · 생성(블로그/인스타/틱톡/광고문구) · 댓글답변 · 성과분석 · 보관함.
 *   전부 초안(자동 게시 없음). 영상/음성/아바타는 로드맵(외부 유료 API).
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}
const card = 'rounded-2xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#1A1C21] p-4'
const input = 'w-full h-9 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400'
const ta = 'w-full rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] p-2.5 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400'
const btnPrimary = 'shrink-0 rounded-lg bg-gray-900 dark:bg-white px-4 h-9 text-[12.5px] font-bold text-white dark:text-[#0D0F12] disabled:opacity-40'
const chip = (on: boolean) => `rounded-full px-3 py-1 text-[12px] font-semibold ${on ? 'bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12]' : 'border border-gray-200 dark:border-[#2C2F35] text-gray-600 dark:text-gray-300'}`

type Mode = 'repurpose' | 'generate' | 'reply' | 'analyze' | 'media' | 'library'
const MODES: Array<{ k: Mode; l: string }> = [
  { k: 'repurpose', l: '리퍼포징' }, { k: 'generate', l: '생성' }, { k: 'reply', l: '댓글 답변' }, { k: 'analyze', l: '성과 분석' }, { k: 'media', l: '미디어' }, { k: 'library', l: '보관함' },
]
const MEDIA_KINDS = [{ k: 'image', l: '이미지' }, { k: 'voice', l: '음성' }, { k: 'video', l: '영상' }] as const
const GEN_TYPES = [{ k: 'blog', l: '블로그' }, { k: 'instagram', l: '인스타' }, { k: 'tiktok', l: '틱톡' }, { k: 'ad_copy', l: '광고문구' }] as const
const TONES = [{ k: 'polite', l: '정중' }, { k: 'friendly', l: '친근' }, { k: 'apologetic', l: '사과·해결' }, { k: 'concise', l: '간결' }]

interface AdVariant { title: string; desc: string; titleLen: number; descLen: number; titleOk: boolean; descOk: boolean }
interface Gen { type: string; title: string | null; body: string; hashtags: string[]; variants: AdVariant[] }
interface Pack { summary: string; blog: { title: string; body: string } | null; instagram: { caption: string; hashtags: string[] } | null; tiktok: { hook: string; script: string; hashtags: string[] } | null; ad_copy: AdVariant[]; seo: { metaTitle: string; metaDescription: string; keywords: string[] } | null }
interface LibItem { id: number; type: string; title: string | null; body: string; created_at: string }

const copy = (text: string) => { navigator.clipboard?.writeText(text).then(() => toast.success('복사됨')).catch(() => toast.error('복사 실패')) }
const errMsg = (e: unknown, fb: string) => {
  const r = (e as { response?: { data?: { error?: string }; status?: number } })?.response
  return r?.status === 503 ? 'AI 기능은 API 키 설정 후 사용할 수 있습니다' : (r?.data?.error || fb)
}
const AdCopyList = ({ variants }: { variants: AdVariant[] }) => (
  <div className="space-y-1.5">
    {variants.map((v, i) => (
      <div key={i} className="rounded-lg border border-gray-100 dark:border-[#2C2F35] p-2 text-[12px]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-gray-900 dark:text-white">{v.title}</span>
          <span className={`shrink-0 text-[10px] ${v.titleOk ? 'text-gray-400' : 'text-red-500 font-bold'}`}>제목 {v.titleLen}/15</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-gray-600 dark:text-gray-300">{v.desc}</span>
          <span className={`shrink-0 text-[10px] ${v.descOk ? 'text-gray-400' : 'text-red-500 font-bold'}`}>설명 {v.descLen}/45</span>
        </div>
      </div>
    ))}
  </div>
)
const Actions = ({ onCopy, onSave }: { onCopy: () => void; onSave?: () => void }) => (
  <div className="mt-2 flex gap-1.5">
    <button onClick={onCopy} className="rounded-lg border border-gray-200 dark:border-[#2C2F35] px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-200">복사</button>
    {onSave && <button onClick={onSave} className="rounded-lg border border-gray-200 dark:border-[#2C2F35] px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">보관함 저장</button>}
  </div>
)

export default function ContentStudioPanel() {
  const [mode, setMode] = useState<Mode>('repurpose')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // 공통 입력
  const [brand, setBrand] = useState('')
  const [keywords, setKeywords] = useState('')
  // 리퍼포징
  const [source, setSource] = useState('')
  const [pack, setPack] = useState<Pack | null>(null)
  // 생성
  const [genType, setGenType] = useState<typeof GEN_TYPES[number]['k']>('blog')
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [gen, setGen] = useState<Gen | null>(null)
  // 답변
  const [comment, setComment] = useState('')
  const [tone, setTone] = useState('polite')
  const [reply, setReply] = useState<string | null>(null)
  // 분석
  const [analysis, setAnalysis] = useState<string | null>(null)
  // 보관함
  const [lib, setLib] = useState<LibItem[]>([])
  const [libLoaded, setLibLoaded] = useState(false)
  // 미디어
  const [mediaStat, setMediaStat] = useState<{ enabled: boolean; image: string | null; voice: string | null; video: string | null } | null>(null)
  const [mKind, setMKind] = useState<'image' | 'voice' | 'video'>('image')
  const [mPrompt, setMPrompt] = useState('')
  const [mResult, setMResult] = useState<{ kind: string; url?: string; jobId?: number; status?: string } | null>(null)

  const save = useCallback(async (type: string, body: string, title?: string | null, meta?: unknown) => {
    try { const r = await api.post('/api/ads/content/save', { type, body, title, meta }, { headers: authHeader() }); if (r.data?.success) { toast.success('보관함 저장'); setLib(r.data.items || []) } else toast.error(r.data?.error || '저장 실패') }
    catch (e) { toast.error(errMsg(e, '저장 실패')) }
  }, [])

  async function run(fn: () => Promise<void>) { setBusy(true); setErr(null); try { await fn() } catch (e) { setErr(errMsg(e, '요청 실패')) } finally { setBusy(false) } }

  const doRepurpose = () => run(async () => {
    setPack(null)
    const r = await api.post('/api/ads/content/repurpose', { source, brand, keywords }, { headers: authHeader() })
    if (r.data?.success) setPack(r.data.pack); else setErr(r.data?.error || '생성 실패')
  })
  const doGenerate = () => run(async () => {
    setGen(null)
    const r = await api.post('/api/ads/content/generate', { type: genType, topic, brand, audience, keywords }, { headers: authHeader() })
    if (r.data?.success) setGen(r.data.content); else setErr(r.data?.error || '생성 실패')
  })
  const doReply = () => run(async () => {
    setReply(null)
    const r = await api.post('/api/ads/content/reply', { comment, tone, brand }, { headers: authHeader() })
    if (r.data?.success) setReply(r.data.reply); else setErr(r.data?.error || '생성 실패')
  })
  const doAnalyze = () => run(async () => {
    setAnalysis(null)
    const r = await api.post('/api/ads/content/analyze', {}, { headers: authHeader() })
    if (r.data?.success) setAnalysis(r.data.analysis); else setErr(r.data?.error || '분석 실패')
  })
  const loadLib = useCallback(() => run(async () => {
    const r = await api.get('/api/ads/content/list', { headers: authHeader() })
    if (r.data?.success) { setLib(r.data.items || []); setLibLoaded(true) }
  }), [])
  async function delLib(id: number) {
    try { const r = await api.delete(`/api/ads/content?id=${id}`, { headers: authHeader() }); if (r.data?.success) setLib(r.data.items || []) } catch { toast.error('삭제 실패') }
  }

  const loadMediaStatus = useCallback(() => run(async () => {
    const r = await api.get('/api/ads/content/media/status', { headers: authHeader() })
    if (r.data?.success) setMediaStat(r.data.status)
  }), [])
  const doMedia = () => run(async () => {
    setMResult(null)
    if (mKind === 'video') {
      const r = await api.post('/api/ads/content/media/video', { prompt: mPrompt }, { headers: authHeader() })
      if (r.data?.success) { setMResult({ kind: 'video', jobId: r.data.jobId, status: r.data.status }); toast.success('영상 작업을 제출했습니다. 잠시 후 상태를 확인하세요.') }
      else setErr(r.data?.error || '제출 실패')
    } else {
      const ep = mKind === 'image' ? 'image' : 'voice'
      const payload = mKind === 'image' ? { prompt: mPrompt } : { text: mPrompt }
      const r = await api.post(`/api/ads/content/media/${ep}`, payload, { headers: authHeader() })
      if (r.data?.success) setMResult({ kind: mKind, url: r.data.url }); else setErr(r.data?.error || '생성 실패')
    }
  })
  const pollVideoJob = async () => {
    if (!mResult?.jobId) return
    try { const r = await api.get(`/api/ads/content/media/video/${mResult.jobId}`, { headers: authHeader() }); if (r.data?.success) setMResult(m => m ? { ...m, status: r.data.status, url: r.data.url } : m) } catch { /* ignore */ }
  }

  const switchMode = (m: Mode) => { setMode(m); setErr(null); if (m === 'library' && !libLoaded) loadLib(); if (m === 'media' && !mediaStat) loadMediaStatus() }
  const packText = (p: Pack) => [p.summary && `[요약]\n${p.summary}`, p.blog && `[블로그] ${p.blog.title}\n${p.blog.body}`, p.instagram && `[인스타]\n${p.instagram.caption}\n${p.instagram.hashtags.join(' ')}`, p.tiktok && `[틱톡]\n${p.tiktok.hook}\n${p.tiktok.script}\n${p.tiktok.hashtags.join(' ')}`, p.seo && `[SEO] ${p.seo.metaTitle} / ${p.seo.metaDescription}`].filter(Boolean).join('\n\n')

  return (
    <div className={`mt-3 ${card}`}>
      <div className="text-[14px] font-bold text-gray-900 dark:text-white">AI 콘텐츠 스튜디오</div>
      <p className="mt-0.5 text-[11.5px] text-gray-400 dark:text-gray-500">원문 하나로 여러 채널 콘텐츠를 만들고, 광고문구·댓글답변까지. 결과는 초안이니 검토 후 사용하세요.</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {MODES.map(m => <button key={m.k} onClick={() => switchMode(m.k)} className={chip(mode === m.k)}>{m.l}</button>)}
      </div>

      {(mode === 'repurpose' || mode === 'generate') && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <input className={input} placeholder="브랜드/상호 (선택)" value={brand} onChange={e => setBrand(e.target.value)} />
          <input className={input} placeholder="강조 키워드 (선택, 쉼표)" value={keywords} onChange={e => setKeywords(e.target.value)} />
        </div>
      )}

      {/* ── 리퍼포징 ── */}
      {mode === 'repurpose' && (
        <div className="mt-2">
          <textarea className={ta} rows={5} placeholder="유튜브 대본·블로그 글·제품 설명 등 원문을 붙여넣으세요 (20자 이상)" value={source} onChange={e => setSource(e.target.value)} />
          <button onClick={doRepurpose} disabled={busy} className={`mt-2 ${btnPrimary}`}>{busy ? '변환 중…' : '멀티플랫폼으로 변환'}</button>
          {pack && (
            <div className="mt-3 space-y-2.5">
              {pack.summary && <div className="rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3"><div className="text-[12px] font-bold text-gray-900 dark:text-white">요약</div><p className="mt-1 text-[12.5px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{pack.summary}</p></div>}
              {pack.blog && <div className="rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3"><div className="text-[12px] font-bold text-gray-900 dark:text-white">블로그 · {pack.blog.title}</div><pre className="mt-1 text-[12px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans">{pack.blog.body}</pre><Actions onCopy={() => copy(`${pack.blog!.title}\n\n${pack.blog!.body}`)} onSave={() => save('blog', pack.blog!.body, pack.blog!.title)} /></div>}
              {pack.instagram && <div className="rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3"><div className="text-[12px] font-bold text-gray-900 dark:text-white">인스타그램</div><p className="mt-1 text-[12.5px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{pack.instagram.caption}</p><p className="mt-1 text-[11.5px] text-blue-600 dark:text-blue-400">{pack.instagram.hashtags.join(' ')}</p><Actions onCopy={() => copy(`${pack.instagram!.caption}\n\n${pack.instagram!.hashtags.join(' ')}`)} onSave={() => save('instagram', pack.instagram!.caption, null, { hashtags: pack.instagram!.hashtags })} /></div>}
              {pack.tiktok && <div className="rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3"><div className="text-[12px] font-bold text-gray-900 dark:text-white">틱톡 · {pack.tiktok.hook}</div><pre className="mt-1 text-[12px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans">{pack.tiktok.script}</pre><p className="mt-1 text-[11.5px] text-blue-600 dark:text-blue-400">{pack.tiktok.hashtags.join(' ')}</p><Actions onCopy={() => copy(`${pack.tiktok!.hook}\n${pack.tiktok!.script}\n${pack.tiktok!.hashtags.join(' ')}`)} onSave={() => save('tiktok', `${pack.tiktok!.hook}\n${pack.tiktok!.script}`, null, { hashtags: pack.tiktok!.hashtags })} /></div>}
              {pack.ad_copy.length > 0 && <div className="rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3"><div className="text-[12px] font-bold text-gray-900 dark:text-white mb-1.5">광고 문구</div><AdCopyList variants={pack.ad_copy} /><Actions onCopy={() => copy(pack.ad_copy.map(v => `[${v.title}] ${v.desc}`).join('\n'))} onSave={() => save('ad_copy', pack.ad_copy.map(v => `[${v.title}] ${v.desc}`).join('\n'), null, { variants: pack.ad_copy })} /></div>}
              {pack.seo && <div className="rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3"><div className="text-[12px] font-bold text-gray-900 dark:text-white">SEO</div><p className="mt-1 text-[12px] text-gray-600 dark:text-gray-300">제목: {pack.seo.metaTitle}</p><p className="text-[12px] text-gray-600 dark:text-gray-300">설명: {pack.seo.metaDescription}</p><p className="mt-1 text-[11.5px] text-gray-500 dark:text-gray-400">키워드: {pack.seo.keywords.join(', ')}</p></div>}
              <button onClick={() => copy(packText(pack))} className="rounded-lg border border-gray-200 dark:border-[#2C2F35] px-3 py-1.5 text-[11.5px] font-bold text-gray-700 dark:text-gray-200">전체 복사</button>
            </div>
          )}
        </div>
      )}

      {/* ── 생성 ── */}
      {mode === 'generate' && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1.5">{GEN_TYPES.map(t => <button key={t.k} onClick={() => setGenType(t.k)} className={chip(genType === t.k)}>{t.l}</button>)}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input className={input} placeholder="주제/상품 (필수)" value={topic} onChange={e => setTopic(e.target.value)} />
            <input className={input} placeholder="타겟 고객 (선택)" value={audience} onChange={e => setAudience(e.target.value)} />
          </div>
          <button onClick={doGenerate} disabled={busy || !topic.trim()} className={`mt-2 ${btnPrimary}`}>{busy ? '생성 중…' : '생성'}</button>
          {gen && (
            <div className="mt-3 rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3">
              {gen.title && <div className="text-[13px] font-bold text-gray-900 dark:text-white">{gen.title}</div>}
              {gen.variants.length > 0 ? <AdCopyList variants={gen.variants} /> : <pre className="text-[12.5px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans">{gen.body}</pre>}
              {gen.hashtags.length > 0 && <p className="mt-1.5 text-[11.5px] text-blue-600 dark:text-blue-400">{gen.hashtags.join(' ')}</p>}
              <Actions onCopy={() => copy(gen.hashtags.length ? `${gen.body}\n\n${gen.hashtags.join(' ')}` : gen.body)} onSave={() => save(gen.type, gen.body, gen.title, { hashtags: gen.hashtags, variants: gen.variants })} />
            </div>
          )}
        </div>
      )}

      {/* ── 댓글 답변 ── */}
      {mode === 'reply' && (
        <div className="mt-2.5">
          <textarea className={ta} rows={3} placeholder="답변할 고객 댓글/리뷰를 붙여넣으세요" value={comment} onChange={e => setComment(e.target.value)} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] text-gray-500 dark:text-gray-400">톤</span>
            {TONES.map(t => <button key={t.k} onClick={() => setTone(t.k)} className={chip(tone === t.k)}>{t.l}</button>)}
            <button onClick={doReply} disabled={busy || !comment.trim()} className={`ml-auto ${btnPrimary}`}>{busy ? '작성 중…' : '답변 초안'}</button>
          </div>
          {reply && <div className="mt-3 rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3"><p className="text-[12.5px] text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{reply}</p><Actions onCopy={() => copy(reply)} onSave={() => save('reply', reply)} /></div>}
        </div>
      )}

      {/* ── 성과 분석 ── */}
      {mode === 'analyze' && (
        <div className="mt-2.5">
          <p className="text-[12px] text-gray-500 dark:text-gray-400">광고 실적을 근거로 <b className="text-gray-700 dark:text-gray-200">어떤 메시지가 잘 통하는지</b> 분석하고 콘텐츠 방향을 제안합니다. (광고계정 연동 필요)</p>
          <button onClick={doAnalyze} disabled={busy} className={`mt-2 ${btnPrimary}`}>{busy ? '분석 중…' : '성과 분석 받기'}</button>
          {analysis && <div className="mt-3 rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3"><pre className="text-[12.5px] text-gray-700 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{analysis}</pre><Actions onCopy={() => copy(analysis)} /></div>}
        </div>
      )}

      {/* ── 미디어(이미지/음성/영상) ── */}
      {mode === 'media' && (
        <div className="mt-2.5">
          {(() => {
            const avail = mediaStat && (mKind === 'image' ? mediaStat.image : mKind === 'voice' ? mediaStat.voice : mediaStat.video)
            const anyOn = mediaStat && mediaStat.enabled && (mediaStat.image || mediaStat.voice || mediaStat.video)
            return (
              <>
                <div className="flex flex-wrap gap-1.5">{MEDIA_KINDS.map(t => <button key={t.k} onClick={() => { setMKind(t.k); setMResult(null) }} className={chip(mKind === t.k)}>{t.l}</button>)}</div>
                {!anyOn ? (
                  <div className="mt-2 rounded-xl border border-amber-100 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-3 text-[12px] text-amber-700 dark:text-amber-400">
                    미디어 생성(이미지·음성·영상)은 외부 생성 API 연동이 필요합니다. 관리자가 설정하면 여기서 바로 사용할 수 있습니다.
                  </div>
                ) : !avail ? (
                  <p className="mt-2 text-[12px] text-gray-400 dark:text-gray-500">이 미디어 유형은 아직 설정되지 않았습니다. 다른 유형을 선택해보세요.</p>
                ) : (
                  <>
                    <textarea className={`${ta} mt-2`} rows={3} placeholder={mKind === 'voice' ? '읽어줄 텍스트 (800자 이내)' : mKind === 'image' ? '이미지 설명 (예: 미니멀한 무선이어폰 제품컷, 밝은 배경)' : '숏폼 영상 설명/컨셉'} value={mPrompt} onChange={e => setMPrompt(e.target.value)} />
                    <button onClick={doMedia} disabled={busy || !mPrompt.trim()} className={`mt-2 ${btnPrimary}`}>{busy ? '생성 중…' : mKind === 'video' ? '영상 작업 제출' : '생성'}</button>
                    {mResult && (
                      <div className="mt-3 rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3">
                        {mResult.kind === 'image' && mResult.url && <img src={mResult.url} alt="생성 이미지" className="max-w-full rounded-lg" />}
                        {mResult.kind === 'voice' && mResult.url && <audio controls src={mResult.url} className="w-full" />}
                        {mResult.kind === 'video' && (
                          mResult.url ? <video controls src={mResult.url} className="max-w-full rounded-lg" />
                          : <div className="flex items-center justify-between gap-2"><span className="text-[12px] text-gray-500 dark:text-gray-400">상태: {mResult.status === 'processing' ? '생성 중…' : mResult.status}</span><button onClick={pollVideoJob} className="rounded-lg border border-gray-200 dark:border-[#2C2F35] px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-200">상태 확인</button></div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── 보관함 ── */}
      {mode === 'library' && (
        <div className="mt-2.5">
          {!libLoaded && busy ? <p className="text-[12px] text-gray-400 dark:text-gray-500">불러오는 중…</p>
            : lib.length === 0 ? <p className="text-[12px] text-gray-400 dark:text-gray-500">저장한 콘텐츠가 없습니다. 생성 결과의 '보관함 저장'을 눌러 담아보세요.</p>
            : <div className="space-y-1.5">{lib.map(it => (
                <div key={it.id} className="rounded-lg border border-gray-100 dark:border-[#2C2F35] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">{it.type}{it.title ? ` · ${it.title}` : ''}</span>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => copy(it.body)} className="text-[10.5px] font-bold text-gray-500 dark:text-gray-400">복사</button>
                      <button onClick={() => delLib(it.id)} className="text-[10.5px] font-bold text-gray-400 hover:text-red-500">삭제</button>
                    </div>
                  </div>
                  <p className="mt-1 text-[11.5px] text-gray-500 dark:text-gray-400 line-clamp-2 whitespace-pre-wrap">{it.body}</p>
                </div>
              ))}</div>}
        </div>
      )}

      {err && <PanelError onRetry={() => setErr(null)} label={err} />}
    </div>
  )
}
