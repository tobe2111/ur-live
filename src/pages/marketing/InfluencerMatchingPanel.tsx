/**
 * 🤝 유어애즈 — 체험단(업체↔인플루언서) 성과기반 매칭 — **어드민 전용 내부 운영 도구**.
 *
 * 설계: docs/design/influencer-matching-service-2026-07.md
 * 차별화: 팔로워가 아니라 **실제 전환(매장방문·재방문·업종별 CVR)** 기준 매칭.
 *
 * 유어애즈 인플루언서 발굴 패널 옆에 붙지만 **플랫폼 어드민만** 사용(직영 에이전시가 매칭 판단).
 * 매장·인플루언서 공개 뷰는 데이터·법무 충분해지면(나중).
 * 데이터: GET /api/admin/matching/influencers (requireAdmin, 읽기 전용 집계 matching.ts).
 *   - 실데이터 있으면 실측 랭킹. 데이터 0/희소(n<5 억제)면 **목업 미리보기**(화면 확인용) + 배너.
 *
 * crossrole-ok: 유어애즈(marketing) 대시보드에 얹힌 **어드민 전용** 섹션이라 의도적으로 /api/admin/* 호출.
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'

// 어드민 인증 헤더 — 이 섹션은 플랫폼 어드민(admin_token)만 사용.
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

// ── 서버 계약(matching.ts MatchCandidate / InfluencerMetrics 와 1:1) ──────────
interface Candidate {
  influencerId: string
  handle: string | null
  displayName: string | null
  visits: number
  visitors: number
  repeatRate: number
  gmv: number
  categoryCvr: number
  fitScore: number
  fitReason: string
  badge: 'measured' | 'repeat' | 'cold'
  confidence: 'measured' | 'sparse' | 'cold'
  suppressed: boolean
}
interface CatStat { category: string; label: string; visits: number; visitors: number; cvr: number; suppressed: boolean }
interface RegStat { code: string; visits: number; visitors: number; strength: number; suppressed: boolean }
interface Metrics {
  influencerId: string; handle: string | null; displayName: string | null
  inflowClicks: number; signups: number; visitors: number; visits: number
  repeatRate: number; gmv: number; aov: number
  categoryStats: CatStat[]; regionStats: RegStat[]
}
interface Coverage {
  totalInflow: number; attributedUsers: number; influencersWithData: number
  measuredInfluencers: number; totalVisits: number; categoriesCovered: number; regionsCovered: number
}

const CATEGORIES = [
  { code: 'meal_voucher', label: '식사' },
  { code: 'beauty_voucher', label: '미용' },
  { code: 'stay_voucher', label: '숙소' },
  { code: 'etc_voucher', label: '기타' },
] as const
const REGIONS = [
  { code: '11680', label: '강남' },
  { code: '11200', label: '성수' },
  { code: '11440', label: '홍대' },
] as const

// ── 목업(미리보기 — 서버 enabled:false/빈결과 시) ────────────────────────────
const MOCK: Candidate[] = [
  { influencerId: 'm1', handle: 'cafe_jihyun', displayName: '카페투어_지현', visits: 320, visitors: 210, repeatRate: 41, gmv: 5_400_000, categoryCvr: 8.2, fitScore: 92, badge: 'measured', confidence: 'measured', suppressed: false, fitReason: '식사 실전환 8.2% · 이 상권 강세 · 재방문율 41%' },
  { influencerId: 'm2', handle: 'local_mukbang', displayName: '먹방_로컬', visits: 540, visitors: 300, repeatRate: 53, gmv: 9_100_000, categoryCvr: 7.4, fitScore: 78, badge: 'repeat', confidence: 'measured', suppressed: false, fitReason: '재방문율 53% — 단골을 만드는 유형' },
  { influencerId: 'm3', handle: 'sora_beauty', displayName: '뷰티_소라', visits: 130, visitors: 96, repeatRate: 33, gmv: 2_300_000, categoryCvr: 3.0, fitScore: 61, badge: 'measured', confidence: 'measured', suppressed: false, fitReason: '뷰티 전환 강세 · 식사 업종엔 중간(참고용)' },
  { influencerId: 'm4', handle: 'new_creator', displayName: '신규_크리에이터', visits: 0, visitors: 0, repeatRate: 0, gmv: 0, categoryCvr: 0, fitScore: 44, badge: 'cold', confidence: 'cold', suppressed: true, fitReason: '성과 데이터 수집 중 — 발굴 프로필 기반 임시 추천(방배 후 실측 대체)' },
]
const MOCK_DETAIL: Record<string, Metrics> = {
  m1: { influencerId: 'm1', handle: 'cafe_jihyun', displayName: '카페투어_지현', inflowClicks: 4200, signups: 2560, visitors: 210, visits: 320, repeatRate: 41, gmv: 5_400_000, aov: 16875,
    categoryStats: [ { category: 'meal_voucher', label: '식사', visits: 210, visitors: 150, cvr: 8.2, suppressed: false }, { category: 'etc_voucher', label: '기타', visits: 110, visitors: 70, cvr: 6.1, suppressed: false } ],
    regionStats: [ { code: '11680', visits: 240, visitors: 160, strength: 88, suppressed: false }, { code: '11200', visits: 80, visitors: 50, strength: 62, suppressed: false } ] },
}

const REGION_LABEL: Record<string, string> = Object.fromEntries(REGIONS.map((r) => [r.code, r.label]))
const won = (n: number) => formatNumber(n)
const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
const BADGE: Record<Candidate['badge'], { label: string; cls: string }> = {
  measured: { label: '🏆 실측 성과', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  repeat: { label: '⭐ 재방문 강세', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400' },
  cold: { label: '🌱 데이터 축적중', cls: 'bg-gray-100 text-gray-500 dark:bg-[#1A1A1A] dark:text-gray-400' },
}
const nameOf = (c: { displayName: string | null; handle: string | null; influencerId: string }) =>
  c.displayName || (c.handle ? `@${c.handle}` : `인플루언서 #${c.influencerId}`)

export default function InfluencerMatchingPanel() {
  const [cat, setCat] = useState<string>('meal_voucher')
  const [region, setRegion] = useState<string>('11680')
  const [live, setLive] = useState<Candidate[] | null>(null) // 실데이터(있으면)
  const [preview, setPreview] = useState(true)               // 목업 미리보기 여부
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, Metrics | null>>({})
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiNote, setAiNote] = useState<string | null>(null)

  // 데이터 준비도(전역) — 마운트 1회.
  useEffect(() => {
    api.get('/api/admin/matching/coverage', { headers: authHeader() })
      .then((r) => setCoverage(r.data?.coverage || null)).catch(() => { /* graceful */ })
  }, [])

  async function runAi() {
    setAiBusy(true); setAiText(null); setAiNote(null)
    try {
      const r = await api.post('/api/admin/matching/ai-rationale', { category: cat, region }, { headers: authHeader() })
      if (r.data?.success) { if (r.data.enough) setAiText(r.data.rationale || ''); else setAiNote(r.data.note || '표본 부족') }
      else setAiNote(r.data?.error || 'AI 근거 생성 실패')
    } catch (e: unknown) {
      setAiNote((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'AI 근거 생성 실패')
    } finally { setAiBusy(false) }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/api/admin/matching/influencers?category=${cat}&region=${region}&limit=20`, { headers: authHeader() })
      const candidates: Candidate[] = Array.isArray(r.data?.candidates) ? r.data.candidates : []
      if (candidates.length) { setLive(candidates); setPreview(false) }
      else { setLive(null); setPreview(true) } // 데이터 0/희소(n<5) → 목업 미리보기(화면 확인용)
    } catch {
      setLive(null); setPreview(true) // 오류(비어드민 403 포함)도 우아하게 미리보기로
    } finally { setLoading(false) }
  }, [cat, region])
  useEffect(() => { load() }, [load])

  const rows: Candidate[] = preview ? MOCK : (live || [])

  async function toggleDetail(c: Candidate) {
    if (openId === c.influencerId) { setOpenId(null); return }
    setOpenId(c.influencerId)
    if (detail[c.influencerId] !== undefined) return
    if (preview) { setDetail((d) => ({ ...d, [c.influencerId]: MOCK_DETAIL[c.influencerId] || null })); return }
    try {
      const r = await api.get(`/api/admin/matching/influencers/${c.influencerId}`, { headers: authHeader() })
      setDetail((d) => ({ ...d, [c.influencerId]: r.data?.metrics || null }))
    } catch { setDetail((d) => ({ ...d, [c.influencerId]: null })) }
  }

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-gray-900 dark:text-white">체험단 매칭</span>
            <span className="shrink-0 rounded-full bg-gray-900 text-white dark:bg-white dark:text-[#0A0A0A] px-2 py-0.5 text-[9.5px] font-bold tracking-wide">ADMIN</span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-gray-400 dark:text-gray-500">
            운영자(직영 에이전시)가 <b className="text-gray-600 dark:text-gray-300">실제 전환(매장방문·재방문)</b>으로 어느 인플루언서를 붙일지 판단하는 내부 도구입니다.
          </p>
        </div>
        {preview && <span className="shrink-0 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 px-2.5 py-1 text-[10.5px] font-bold">미리보기(목업)</span>}
      </div>

      {preview && (
        <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-800 dark:text-amber-300">
          아래 수치는 <b>예시(목업)</b>입니다(실측 표본 부족 · n&lt;5 억제). 유입→방문→재방문 데이터가 쌓이면 <b>같은 화면에 실제 숫자</b>로 자동 전환됩니다.
        </div>
      )}

      {/* 데이터 준비도 — 매칭 신뢰도 한눈에 */}
      {coverage && (
        <div className="mt-3">
          <div className="text-[10.5px] font-bold tracking-wide text-gray-400 dark:text-gray-500">데이터 준비도</div>
          <div className="mt-1.5 grid grid-cols-3 sm:grid-cols-6 gap-2">
            <Cov label="유입" v={won(coverage.totalInflow)} />
            <Cov label="귀속 방문자" v={won(coverage.attributedUsers)} />
            <Cov label="매장방문" v={won(coverage.totalVisits)} />
            <Cov label="인플루언서" v={won(coverage.influencersWithData)} />
            <Cov label="실측(n≥5)" v={won(coverage.measuredInfluencers)} accent />
            <Cov label="업종·상권" v={`${coverage.categoriesCovered}·${coverage.regionsCovered}`} />
          </div>
          {coverage.measuredInfluencers === 0 && (
            <p className="mt-1.5 text-[10.5px] text-gray-400 dark:text-gray-500">실측(n≥5) 인플루언서가 아직 없어요 — 아래는 목업 미리보기. 유입·방문이 쌓이면 실측으로 전환됩니다.</p>
          )}
        </div>
      )}

      {/* 필터바 — 우리 매장 업종·상권 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">우리 매장 기준</span>
        {CATEGORIES.map((c) => (
          <button key={c.code} onClick={() => setCat(c.code)}
            className={`rounded-full px-3 py-1 text-[11.5px] font-semibold border ${cat === c.code ? 'bg-gray-900 text-white dark:bg-white dark:text-[#0A0A0A] border-transparent' : 'border-gray-200 dark:border-[#2A2A2A] text-gray-500 dark:text-gray-400'}`}>{c.label}</button>
        ))}
        <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-[#2A2A2A]" />
        {REGIONS.map((r) => (
          <button key={r.code} onClick={() => setRegion(r.code)}
            className={`rounded-full px-3 py-1 text-[11.5px] font-semibold border ${region === r.code ? 'bg-gray-900 text-white dark:bg-white dark:text-[#0A0A0A] border-transparent' : 'border-gray-200 dark:border-[#2A2A2A] text-gray-500 dark:text-gray-400'}`}>{r.label}</button>
        ))}
        {loading && <span className="text-[11px] text-gray-400 dark:text-gray-500">불러오는 중…</span>}
        <button onClick={runAi} disabled={aiBusy} className="ml-auto rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-3 py-1 text-[11.5px] font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50">{aiBusy ? 'AI 분석 중…' : '🤝 AI 매칭 근거'}</button>
      </div>

      {/* AI 매칭 근거(집계·가명만 전송) */}
      {(aiText || aiNote) && (
        <div className="mt-2 rounded-lg bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-[#1A1A1A] p-3">
          {aiNote && <p className="text-[11.5px] text-amber-700 dark:text-amber-400">{aiNote}</p>}
          {aiText && (
            <div className="space-y-1 text-[12px] leading-relaxed text-gray-700 dark:text-gray-200">
              {aiText.split('\n').filter((l) => l.trim()).map((l, i) => <p key={i}>{l.replace(/\*\*/g, '')}</p>)}
            </div>
          )}
          <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">※ AI 에는 집계·가명 지표(공개 핸들·전환율)만 전송 — 개인정보 없음.</p>
        </div>
      )}

      {/* 실데이터인데 빈 결과(게이트 ON·표본 부족) — 우아한 안내 */}
      {!preview && rows.length === 0 && (
        <p className="mt-4 py-6 text-center text-[12.5px] text-gray-400 dark:text-gray-500">이 업종·상권에서 아직 실측 매칭 표본이 부족합니다(n&lt;5 억제). 데이터가 쌓이면 자동 표시됩니다.</p>
      )}

      {/* 매칭 결과 랭킹 */}
      <div className="mt-3 space-y-2">
        {rows.map((c, i) => {
          const open = openId === c.influencerId
          const d = detail[c.influencerId]
          return (
            <div key={c.influencerId} className="rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A]">
              <div className="flex items-center gap-3 p-3">
                <div className="shrink-0 grid h-8 w-8 place-items-center rounded-full bg-gray-100 dark:bg-[#1A1A1A] text-[12px] font-bold text-gray-400">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold text-gray-900 dark:text-white">{nameOf(c)}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${BADGE[c.badge].cls}`}>{BADGE[c.badge].label}</span>
                  </div>
                  {c.handle && <div className="text-[11px] text-gray-400 dark:text-gray-500">@{c.handle}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[18px] font-extrabold leading-none text-gray-900 dark:text-white">{c.fitScore}<span className="text-[11px] font-bold text-gray-400"> /100</span></div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">적합도</div>
                </div>
              </div>

              {/* 실측 지표 3종(차별점) */}
              <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-[#1A1A1A] text-center">
                <Metric label="매장방문 유도" value={c.badge === 'cold' ? '—' : `${won(c.visits)}건`} />
                <Metric label="재방문율" value={c.badge === 'cold' ? '—' : `${c.repeatRate}%`} highlight={c.badge === 'repeat'} />
                <Metric label="업종 전환" value={c.suppressed || c.badge === 'cold' ? '—' : `${c.categoryCvr}%`} />
              </div>

              <div className="flex items-center justify-between gap-2 p-3">
                <p className="min-w-0 flex-1 truncate text-[11.5px] text-gray-500 dark:text-gray-400">💡 {c.fitReason}</p>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => toggleDetail(c)} className="rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-3 py-1.5 text-[11.5px] font-semibold text-gray-600 dark:text-gray-300">{open ? '접기' : '성과 보기'}</button>
                </div>
              </div>

              {open && (
                <div className="border-t border-gray-100 dark:border-[#1A1A1A] p-3 space-y-3">
                  {c.badge === 'cold' ? (
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">아직 실측 전환 이력이 없어요. 유입이 쌓이면 업종·상권별 실전환과 재방문 곡선이 여기에 표시됩니다.</p>
                  ) : d === undefined ? (
                    <p className="text-[12px] text-gray-400 dark:text-gray-500">불러오는 중…</p>
                  ) : d ? (
                    <>
                      {d.categoryStats.length > 0 && (
                        <div>
                          <div className="mb-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">업종별 실전환</div>
                          {d.categoryStats.map((s) => (
                            <Bar key={s.category} label={s.label} pct={s.suppressed ? 0 : s.cvr} max={10} suffix={s.suppressed ? ' (표본부족)' : '%'} active={s.category === cat} />
                          ))}
                        </div>
                      )}
                      {d.regionStats.length > 0 && (
                        <div>
                          <div className="mb-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">상권별 강세 <span className="font-normal text-gray-400">(상권 단위 — 개인위치 아님)</span></div>
                          {d.regionStats.map((s) => (
                            <Bar key={s.code} label={REGION_LABEL[s.code] || s.code} pct={s.suppressed ? 0 : s.strength} max={100} suffix={s.suppressed ? ' (표본부족)' : ''} active={s.code === region} />
                          ))}
                        </div>
                      )}
                      <div className="rounded-lg bg-gray-50 dark:bg-[#121212] px-3 py-2 text-[11.5px] text-gray-600 dark:text-gray-300">
                        발생 매출 <b className="text-gray-900 dark:text-white">₩{won(d.gmv)}</b> · 객단가 ₩{won(d.aov)} · 유입 {won(d.inflowClicks)} → 가입 {won(d.signups)} → 방문 {won(d.visitors)}
                      </div>
                    </>
                  ) : (
                    <p className="text-[12px] text-gray-400 dark:text-gray-500">성과 상세를 불러오지 못했습니다.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[10.5px] text-gray-400 dark:text-gray-500">
        ※ 모든 집계는 가명·집계(개인 식별 불가), 소량 셀(n&lt;5)은 표시 억제, 위치는 상권 단위 — 개인정보·위치정보 원칙 준수.
      </p>
    </div>
  )
}

function Cov({ label, v, accent }: { label: string; v: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] px-2 py-1.5 text-center">
      <div className={`text-[14px] font-extrabold tabular-nums ${accent ? 'text-violet-600 dark:text-violet-400' : 'text-gray-900 dark:text-white'}`}>{v}</div>
      <div className="text-[9.5px] text-gray-400 dark:text-gray-500">{label}</div>
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white dark:bg-[#0A0A0A] py-2">
      <div className={`text-[14px] font-extrabold ${highlight ? 'text-violet-600 dark:text-violet-400' : 'text-gray-900 dark:text-white'}`}>{value}</div>
      <div className="text-[10px] text-gray-400 dark:text-gray-500">{label}</div>
    </div>
  )
}

function Bar({ label, pct, max, suffix, active }: { label: string; pct: number; max: number; suffix?: string; active?: boolean }) {
  const w = Math.max(2, Math.min(100, (pct / max) * 100))
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={`w-12 shrink-0 text-[11px] ${active ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{label}</span>
      <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden">
        <div className={`h-full rounded-full ${active ? 'bg-gray-900 dark:bg-white' : 'bg-gray-300 dark:bg-[#3A3A3A]'}`} style={{ width: `${w}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{pct}{suffix || ''}</span>
    </div>
  )
}
